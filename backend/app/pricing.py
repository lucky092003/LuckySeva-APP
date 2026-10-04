"""Server-side money rules: commission split and coupon discounting.

Everything the platform earns and every discount it gives out is decided here,
from the database, on the server. The client sends an intent ("coupon ABC", "I
picked this professional"); it never sends an amount.

Kept free of FastAPI and of Supabase response shapes so the arithmetic can be
unit tested directly - the numbers are the part that must not drift.
"""

from .db import one

# Money is rounded to paise at every boundary. A total that differs by a rupee
# from the payment the customer actually authorised is a refund waiting to happen.
PAISE = 2

# A commission above this is always a configuration mistake (a stray "10" meaning
# 10% read as 1000%), so it is clamped rather than allowed to exceed the booking.
MAX_COMMISSION_PCT = 50.0

DEFAULT_COMMISSION_PCT = 10.0

VALID_DISCOUNT_TYPES = {"percent", "flat"}


def round2(value: float) -> float:
    """Round to paise, normalising -0.0 so it never prints as "-0"."""
    return round(float(value or 0) + 0.0, PAISE) + 0.0


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def commission_pct_for(client, category_slug: str | None, default_pct: float = DEFAULT_COMMISSION_PCT) -> float:
    """The take rate that applies to a booking in this category.

    A category's own `commission_pct` wins so cleaning and emergency work can be
    priced independently. NULL, a missing category or junk in the column all fall
    back to the platform-wide `admin_commission_pct` setting rather than 500-ing
    on a bad row.
    """
    slug = category_slug if isinstance(category_slug, str) else ""
    if slug:
        row = one(
            client.table("categories")
            .select("commission_pct, commission_enabled")
            .eq("slug", slug)
            .maybe_single()
            .execute()
        )
        if row and row.get("commission_enabled") is not False:
            try:
                if row.get("commission_pct") is not None:
                    return clamp(float(row["commission_pct"]), 0.0, MAX_COMMISSION_PCT)
            except (TypeError, ValueError):
                pass

    row = one(
        client.table("admin_settings")
        .select("value")
        .eq("key", "admin_commission_pct")
        .maybe_single()
        .execute()
    )
    try:
        return clamp(float(row["value"]), 0.0, MAX_COMMISSION_PCT) if row and row.get("value") else default_pct
    except (KeyError, TypeError, ValueError):
        return default_pct


def compute_split(total_amount: float, commission_pct: float) -> tuple[float, float]:
    """Split a booking total into the platform's fee and the provider's earnings.

    The fee is never allowed to exceed the total: a bookable total below the fee
    would otherwise book as a negative payout.
    """
    total = round2(total_amount)
    if total <= 0:
        return 0.0, 0.0
    fee = round2(total * clamp(float(commission_pct or 0), 0.0, MAX_COMMISSION_PCT) / 100.0)
    fee = clamp(fee, 0.0, total)
    return fee, round2(total - fee)


def discount_for(
    coupon: dict,
    eligible_total: float,
    *,
    booking_count: int = 0,
    redemption_count: int = 0,
) -> tuple[float, str | None]:
    """How much this coupon takes off, and why not if it does not apply.

    `booking_count` is how many bookings the customer already placed (gates
    `first_booking_only`); `redemption_count` is how many times they have used
    this code (gates `max_per_phone`). They are deliberately separate: a welcome
    offer is about the customer's history, a repeat-use cap is about abuse.

    Returns a zero discount with a human-readable reason rather than raising, so
    the booking flow can surface "expired" and "minimum Rs 200" as they happen.
    """
    total = round2(eligible_total)
    if not coupon:
        return 0.0, "Coupon not found"
    if coupon.get("active") is not True:
        return 0.0, "This coupon is no longer active"
    if total <= 0:
        return 0.0, "Nothing to discount yet"

    now = _now()
    starts_at = _as_datetime(coupon.get("starts_at"))
    expires_at = _as_datetime(coupon.get("expires_at"))
    if starts_at and now < starts_at:
        return 0.0, "This coupon is not active yet"
    if expires_at and now > expires_at:
        return 0.0, "This coupon has expired"

    usage_limit = _as_int(coupon.get("usage_limit"))
    used_count = _as_int(coupon.get("used_count"))
    if usage_limit is not None and used_count >= usage_limit:
        return 0.0, "This coupon has been fully claimed"

    if coupon.get("first_booking_only") is True and booking_count >= 1:
        return 0.0, "This coupon is valid on your first booking only"

    max_per_phone = _as_int(coupon.get("max_per_phone"))
    if max_per_phone is not None and redemption_count >= max_per_phone:
        return 0.0, "You have already used this coupon"

    min_amount = round2(coupon.get("min_amount") or 0)
    if total < min_amount:
        return 0.0, f"Minimum order of Rs {min_amount:g} for this coupon"

    kind = coupon.get("discount_type")
    if kind not in VALID_DISCOUNT_TYPES:
        return 0.0, "This coupon is misconfigured"
    value = coupon.get("discount_value")
    try:
        value = float(value or 0)
    except (TypeError, ValueError):
        return 0.0, "This coupon is misconfigured"
    if value <= 0:
        return 0.0, "This coupon is misconfigured"

    if kind == "percent":
        if value > 1:
            # Tolerate "20" where "0.20" was meant, but never above 100%.
            value = value / 100.0 if value <= 100 else 1.0
        amount = round2(total * value)
        cap = coupon.get("max_discount")
        if cap is not None:
            try:
                amount = min(amount, round2(float(cap)))
            except (TypeError, ValueError):
                pass
    else:
        amount = round2(value)

    # A discount can shrink the order but must never turn it into a payout.
    return clamp(amount, 0.0, total), None


def category_slug_for_service(client, service_id: str | None) -> str | None:
    """Resolve the category a service belongs to, used for coupon scoping."""
    if not service_id:
        return None
    svc = one(client.table("services").select("category_id").eq("id", service_id).maybe_single().execute())
    if not svc or not svc.get("category_id"):
        return None
    cat = one(client.table("categories").select("slug").eq("id", svc["category_id"]).maybe_single().execute())
    return (cat or {}).get("slug")


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


def _as_datetime(value):
    if not value or not isinstance(value, str):
        return None
    try:
        from datetime import datetime

        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _as_int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None