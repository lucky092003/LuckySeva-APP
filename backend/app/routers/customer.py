from datetime import date

from fastapi import APIRouter, Depends

from .. import events, ledger
from .. import payments as gateway
from ..db import db, one
from ..dependencies import require_customer
from ..events import (
    accepting_professionals,
    insert_notification,
    new_accept_deadline,
    providers_for_service,
    sweep_expired_requests,
)
from ..exceptions import ApiError
from ..pricing import category_slug_for_service, commission_pct_for, compute_split, discount_for, round2
from ..push import notify, notify_new_request
from .catalog import DEFAULT_NEARBY_RADIUS_KM, _as_float, _nearby_professionals

router = APIRouter(dependencies=[Depends(require_customer)])


def customer_phone(claims: dict) -> str:
    return claims["phone"]


DEFAULT_PRIORITY_FEE = 99.0
DEFAULT_PRIORITY_TOP_N = 5


def _setting_float(client, key: str, fallback: float) -> float:
    """Read a numeric platform setting, ignoring junk rather than 500-ing.

    Goes through the None-safe `one()` helper because postgrest returns bare
    None for a zero-row single-row lookup, which would otherwise blow up here.
    """
    row = one(
        client.table("admin_settings")
        .select("value")
        .eq("key", key)
        .maybe_single()
        .execute()
    )
    try:
        return float(row["value"]) if row and row.get("value") not in (None, "") else fallback
    except (KeyError, TypeError, ValueError):
        return fallback


def _is_priority_pick(
    client,
    service_id: str,
    professional_id: str,
    top_n: int,
    latitude: float | None,
    longitude: float | None,
) -> bool:
    """Was this professional one of the top-N recommended for the service?

    Recomputed server side through the very same helper that builds the picker's
    list, so the fee lines up with what the customer was actually shown. Ranking
    is not simply "highest rated": with coordinates the picker sorts by distance
    first, so this must defer to `_nearby_professionals` rather than re-sort.

    Trusting a flag in the body would let anyone claim the surcharge by hand or
    dodge it by sending a different professional_id.
    """
    svc = one(
        client.table("services")
        .select("category_id")
        .eq("id", service_id)
        .maybe_single()
        .execute()
    )
    if not svc:
        return False
    cat = one(
        client.table("categories")
        .select("slug")
        .eq("id", svc["category_id"])
        .maybe_single()
        .execute()
    )
    slug = (cat or {}).get("slug")
    if not slug:
        return False
    ranked = _nearby_professionals(
        slug,
        latitude,
        longitude,
        DEFAULT_NEARBY_RADIUS_KM,
        max(1, top_n),
    )
    return any(row.get("id") == professional_id for row in ranked)


def _load_coupon(client, code: str) -> dict | None:
    if not isinstance(code, str):
        return None
    return one(
        client.table("coupons").select("*").eq("code", code.strip().upper()).maybe_single().execute()
    )


def coupon_code_present(body: dict) -> bool:
    """Did the client actually try to use a code?

    Distinguishes "no coupon" (fine, full price) from "a code was sent and it is
    not valid" (must be an error, not a quiet full-price booking).
    """
    code = body.get("coupon_code")
    return isinstance(code, str) and bool(code.strip())


def _booking_count(client, phone: str) -> int:
    """How many live bookings this customer already placed, for welcome offers.

    Cancelled attempts do not count: a customer who booked, cancelled and is
    coming back is still a first-time customer as far as LUCKY20 is concerned.
    """
    res = (
        client.table("bookings")
        .select("id", count="exact", head=True)
        .eq("customer_phone", phone)
        .neq("status", "cancelled")
        .execute()
    )
    return res.count or 0


def _redemption_count(client, code: str, phone: str) -> int:
    res = (
        client.table("coupon_redemptions")
        .select("id", count="exact", head=True)
        .eq("coupon_code", code)
        .eq("customer_phone", phone)
        .execute()
    )
    return res.count or 0


def _price_quote(
    client,
    *,
    service_id: str | None,
    base: float,
    visit_fee: float,
    priority_fee: float,
    coupon_code: str | None,
    phone: str,
) -> tuple[float, float, float, dict | None, str | None]:
    """Work out the discount and the post-discount total.

    Pure apart from the reads it does, so `POST /customer/quote` and
    `create_booking` call the same function and are guaranteed to agree - which
    is what stops the screen showing one number and the invoice another.

    Returns (pre_discount, discount, total, coupon_row_or_None, error_or_None).
    """
    pre_discount = round2(base + visit_fee + priority_fee)
    discount = 0.0
    coupon = None
    coupon_error = None

    if coupon_code:
        coupon = _load_coupon(client, coupon_code)
        if coupon is None:
            coupon_error = "Invalid coupon code"
        else:
            slug = coupon.get("category_slug")
            if slug:
                booked_slug = category_slug_for_service(client, service_id)
                if booked_slug and booked_slug != slug:
                    coupon, coupon_error = None, "This coupon is valid on a different service"
            if coupon is not None:
                discount, coupon_error = discount_for(
                    coupon,
                    pre_discount,
                    booking_count=_booking_count(client, phone),
                    redemption_count=_redemption_count(client, coupon["code"], phone),
                )
                if coupon_error:
                    coupon = None

    return pre_discount, round2(discount), round2(pre_discount - discount), coupon, coupon_error


@router.get("/profile")
def profile(claims: dict = Depends(require_customer)):
    client = db()
    return one(client.table("profiles").select("*").eq("phone", customer_phone(claims)).maybe_single().execute())


@router.put("/profile")
def update_profile(body: dict, claims: dict = Depends(require_customer)):
    patch = {}
    if isinstance(body.get("name"), str) and body["name"].strip():
        patch["name"] = body["name"].strip()
    if isinstance(body.get("email"), str):
        patch["email"] = body["email"].strip() or None
    if isinstance(body.get("location"), str):
        patch["location"] = body["location"].strip() or None
    if not patch:
        raise ApiError(400, "Nothing to update")
    client = db()
    res = (
        client.table("profiles")
        .update(patch)
        .eq("phone", customer_phone(claims))
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(404, "Profile not found")
    return res.data[0]


@router.get("/addresses")
def addresses(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("addresses")
        .select("*")
        .eq("customer_phone", customer_phone(claims))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/addresses", status_code=201)
def add_address(body: dict, claims: dict = Depends(require_customer)):
    label = body.get("label")
    full = body.get("full_address")
    if not isinstance(label, str) or not isinstance(full, str):
        raise ApiError(400, "label and full_address are required")
    client = db()
    count_res = (
        client.table("addresses")
        .select("*", count="exact", head=True)
        .eq("customer_phone", customer_phone(claims))
        .execute()
    )
    is_first = count_res.count is None or count_res.count == 0
    if is_first:
        client.table("addresses").update({"is_default": False}).eq("customer_phone", customer_phone(claims)).execute()
    res = (
        client.table("addresses")
        .insert(
            {
                "customer_phone": customer_phone(claims),
                "label": label,
                "full_address": full,
                "is_default": is_first,
                "latitude": body.get("latitude") if isinstance(body.get("latitude"), (int, float)) else None,
                "longitude": body.get("longitude") if isinstance(body.get("longitude"), (int, float)) else None,
            }
        )
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create address")
    return res.data[0]


@router.put("/addresses/{address_id}")
def update_address(address_id: str, body: dict, claims: dict = Depends(require_customer)):
    client = db()
    existing = one(
        client.table("addresses")
        .select("*")
        .eq("id", address_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing:
        raise ApiError(404, "Address not found")
    patch = {}
    if isinstance(body.get("label"), str) and body["label"].strip():
        patch["label"] = body["label"].strip()
    if isinstance(body.get("full_address"), str) and body["full_address"].strip():
        patch["full_address"] = body["full_address"].strip()
    if body.get("is_default") is True:
        client.table("addresses").update({"is_default": False}).eq("customer_phone", customer_phone(claims)).execute()
        patch["is_default"] = True
    res = client.table("addresses").update(patch).eq("id", address_id).select("*").execute()
    return res.data[0]


@router.delete("/addresses/{address_id}")
def delete_address(address_id: str, claims: dict = Depends(require_customer)):
    client = db()
    existing = one(
        client.table("addresses")
        .select("is_default")
        .eq("id", address_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing:
        raise ApiError(404, "Address not found")
    client.table("addresses").delete().eq("id", address_id).execute()
    if existing.get("is_default"):
        remaining = (
            client.table("addresses")
            .select("id")
            .eq("customer_phone", customer_phone(claims))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if remaining.data:
            client.table("addresses").update({"is_default": True}).eq("id", remaining.data[0]["id"]).execute()
    return {"ok": True}


@router.get("/bookings/{booking_id}")
def booking(booking_id: str, claims: dict = Depends(require_customer)):
    client = db()
    # Lazily lapse anything whose accept window closed, so the customer sees the
    # truth about their own booking instead of it sitting "confirmed" forever.
    sweep_expired_requests(client)
    booking = one(
        client.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not booking:
        raise ApiError(404, "Booking not found")
    return booking


@router.get("/bookings")
def bookings(claims: dict = Depends(require_customer)):
    client = db()
    sweep_expired_requests(client)
    res = (
        client.table("bookings")
        .select("*")
        .eq("customer_phone", customer_phone(claims))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/bookings", status_code=201)
def create_booking(body: dict, claims: dict = Depends(require_customer)):
    client = db()
    profile = one(client.table("profiles").select("*").eq("phone", customer_phone(claims)).maybe_single().execute())
    service_id = body.get("service_id") if isinstance(body.get("service_id"), str) else None
    base = 0.0
    service_name = body.get("service_name", "")
    if service_id:
        svc = one(client.table("services").select("*").eq("id", service_id).maybe_single().execute())
        if svc:
            base = float(svc.get("starting_price") or 0)
            service_name = svc.get("name", service_name)

    professional_id = body.get("professional_id") if isinstance(body.get("professional_id"), str) else None
    professional_name = body.get("professional_name")
    if professional_id:
        pro = one(client.table("professionals").select("name").eq("id", professional_id).maybe_single().execute())
        if pro and pro.get("name"):
            professional_name = pro["name"]

    # Fees and total are computed here, never read from the body. Taking them
    # from the client let a caller post `total_amount: 1` and book for a rupee.
    # `visit_fee` stays client-supplied (the platform has no visit-fee setting yet)
    # but is clamped non-negative so it cannot be used to discount the booking.
    visit_fee = max(0.0, float(body.get("visit_fee") or 0))
    priority_fee = 0.0
    if professional_id and service_id:
        top_n = int(_setting_float(client, "priority_top_n", DEFAULT_PRIORITY_TOP_N))
        # The picker's ordering is location dependent, so rank against the same
        # coordinates the customer booked with rather than assuming a global list.
        if _is_priority_pick(
            client,
            service_id,
            professional_id,
            top_n,
            _as_float(body.get("latitude")),
            _as_float(body.get("longitude")),
        ):
            priority_fee = _setting_float(client, "priority_fee", DEFAULT_PRIORITY_FEE)
    name = profile.get("name") if profile else customer_phone(claims)

    # Coupons are priced server-side. A client that computed its own discount and
    # posted `total_amount: 0` previously got a free booking, because the total
    # was rebuilt from the fees regardless of the code.
    _, discount, total, coupon, coupon_error = _price_quote(
        client,
        service_id=service_id,
        base=base,
        visit_fee=visit_fee,
        priority_fee=priority_fee,
        coupon_code=body.get("coupon_code"),
        phone=customer_phone(claims),
    )
    if coupon_code_present(body) and coupon is None:
        # An unusable code must not silently become a full-price booking.
        raise ApiError(400, coupon_error or "This coupon cannot be applied", "coupon_invalid")

    # The platform's take and the professional's share, frozen at booking time
    # so a later commission change never rewrites history.
    commission_pct = commission_pct_for(client, category_slug_for_service(client, service_id))
    platform_fee, provider_earnings = compute_split(total, commission_pct)

    # `scheduled_date` is a real Postgres `date`, so a missing or malformed value
    # used to reach the driver as a 22P02 and surface as an unhandled 500. Check
    # it here instead and answer with the message the client can actually show.
    raw_date = body.get("scheduled_date")
    try:
        scheduled_date = date.fromisoformat(raw_date) if isinstance(raw_date, str) else None
    except ValueError:
        scheduled_date = None
    if scheduled_date is None:
        raise ApiError(400, "scheduled_date must be an ISO date (YYYY-MM-DD)")

    scheduled_time = body.get("scheduled_time")
    if not isinstance(scheduled_time, str) or not scheduled_time.strip():
        raise ApiError(400, "scheduled_time is required")
    scheduled_time = scheduled_time.strip()

    # Only accept an address the customer actually owns, so a booking can never
    # be linked to somebody else's saved address.
    address_id = body.get("address_id") if isinstance(body.get("address_id"), str) else None
    if address_id:
        owned = one(
            client.table("addresses")
            .select("id")
            .eq("id", address_id)
            .eq("customer_phone", customer_phone(claims))
            .maybe_single()
            .execute()
        )
        if not owned:
            address_id = None

    method = gateway.normalise_method(body.get("payment_method"))
    # Cash collects offline later; anything else must be authorised online, so it
    # starts as `pending` and only the verified callback flips it to `paid`.
    res = (
        client.table("bookings")
        .insert(
            {
                "customer_name": name,
                "customer_phone": customer_phone(claims),
                "customer_address": body.get("customer_address", ""),
                "address_id": address_id,
                "service_id": service_id,
                "service_name": service_name,
                "professional_id": professional_id,
                "professional_name": professional_name if isinstance(professional_name, str) else "Auto-assign",
                "scheduled_date": scheduled_date.isoformat(),
                "scheduled_time": scheduled_time,
                "notes": body.get("notes", ""),
                "base_price": base,
                "visit_fee": visit_fee,
                "priority_fee": priority_fee,
                "discount_amount": discount,
                "coupon_code": coupon["code"] if coupon else None,
                "commission_pct": commission_pct,
                "platform_fee": platform_fee,
                "provider_earnings": provider_earnings,
                "total_amount": total,
                "payment_method": method,
                "payment_status": "cash" if method == gateway.CASH else "pending",
                "status": "confirmed",
                # The window a provider has to take this job. Always set, even for
                # a pre-picked professional, so nobody waits forever.
                "accept_deadline": new_accept_deadline(client),
                "latitude": body.get("latitude") if isinstance(body.get("latitude"), (int, float)) else None,
                "longitude": body.get("longitude") if isinstance(body.get("longitude"), (int, float)) else None,
            }
        )
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create booking")
    booking_row = res.data[0]

    if coupon:
        # Redemption is recorded on success only, and the counter is bumped here
        # rather than by a database trigger so `usage_limit` stays single-writer.
        client.table("coupon_redemptions").insert(
            {
                "coupon_code": coupon["code"],
                "customer_phone": customer_phone(claims),
                "booking_id": booking_row["id"],
                "discount_amount": discount,
            }
        ).execute()
        client.table("coupons").update({"used_count": int(coupon.get("used_count") or 0) + 1}).eq(
            "id", coupon["id"]
        ).execute()

    insert_notification(
        customer_phone(claims),
        "booking",
        "Booking confirmed",
        f"Your {service_name} booking for {scheduled_date.isoformat()} at {scheduled_time} has been placed.",
        booking_row["id"],
    )

    # Tell the professionals who can actually take this trade and are accepting
    # jobs. Best effort: a push failure must not fail the booking.
    if not professional_id:
        candidates = providers_for_service(
            client, service_id, category_slug_for_service(client, service_id)
        )
        for pid in accepting_professionals(client, candidates):
            notify_new_request([pid], service_name, body.get("_distance_km"))
    else:
        notify(
            "provider",
            professional_id,
            "New booking assigned to you",
            f"{service_name} for {scheduled_date.isoformat()} at {scheduled_time}. Accept before it expires.",
            {"booking_id": booking_row["id"]},
        )

    return booking_row


@router.post("/quote")
def quote(body: dict, claims: dict = Depends(require_customer)):
    """Price a booking without creating it, so the review screen shows the truth.

    Same helper `create_booking` uses, so the number the customer approves is the
    number that gets stored and charged.
    """
    client = db()
    service_id = body.get("service_id") if isinstance(body.get("service_id"), str) else None
    base = 0.0
    if service_id:
        svc = one(client.table("services").select("starting_price").eq("id", service_id).maybe_single().execute())
        if svc:
            base = float(svc.get("starting_price") or 0)
    visit_fee = max(0.0, float(body.get("visit_fee") or 0))
    priority_fee = max(0.0, float(body.get("priority_fee") or 0))
    pre, discount, total, coupon, error = _price_quote(
        client,
        service_id=service_id,
        base=base,
        visit_fee=visit_fee,
        priority_fee=priority_fee,
        coupon_code=body.get("coupon_code"),
        phone=customer_phone(claims),
    )
    return {
        "base_price": round2(base),
        "charges": round2(visit_fee + priority_fee),
        "pre_discount": pre,
        "discount": discount,
        "total": total,
        "coupon_code": coupon["code"] if coupon else None,
        "coupon_description": coupon.get("description") if coupon else None,
        "error": error,
        "payments_enabled": gateway.payments_enabled(),
    }


@router.get("/coupons")
def list_coupons(claims: dict = Depends(require_customer)):
    """Active coupons the customer can actually use right now."""
    client = db()
    rows = client.table("coupons").select("*").eq("active", True).order("discount_value", desc=True).execute().data or []
    phone = customer_phone(claims)
    out = []
    for row in rows:
        discount, error = discount_for(
            row,
            round2(float(row.get("min_amount") or 0) or 0) or 100.0,
            booking_count=_booking_count(client, phone),
            redemption_count=_redemption_count(client, row["code"], phone),
        )
        # A code the customer has already burned is not worth showing.
        if error and ("already used" in error or "first booking" in error or "claimed" in error):
            continue
        out.append(
            {
                "code": row["code"],
                "description": row.get("description") or "",
                "discount_type": row.get("discount_type"),
                "discount_value": row.get("discount_value"),
                "category_slug": row.get("category_slug"),
                "min_amount": row.get("min_amount"),
                "note": error,
            }
        )
    return out


@router.put("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, body: dict, claims: dict = Depends(require_customer)):
    """Cancel a booking and, if money was taken, start the refund.

    Cancelling used to set `payment_status: cancelled` on a booking that may
    already have been paid, which marked the customer's money as simply gone.
    Now a paid booking raises a refund (auto-settled inside the platform's
    window) and the status reflects what is actually owed.
    """
    client = db()
    existing = one(
        client.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing:
        raise ApiError(404, "Booking not found")
    if existing["status"] == "completed":
        raise ApiError(400, "Completed bookings cannot be cancelled")
    if existing["status"] == "cancelled":
        raise ApiError(400, "This booking is already cancelled")
    if existing["status"] in {"on_the_way", "started"}:
        raise ApiError(400, "Your professional has already started. Please contact support.")

    reason = body.get("reason") if isinstance(body.get("reason"), str) else "Cancelled by customer"
    refund_note = ""
    payment = ledger.successful_payment(client, booking_id)
    if payment:
        try:
            ledger.request_refund(existing, reason, source="auto")
            refund_note = "Refund initiated."
        except ApiError as exc:
            # The cancellation still stands; the admin console picks the refund up.
            refund_note = f"Refund pending review: {exc.message}"

    payment_status = "refund_pending" if payment else "cancelled"
    res = (
        client.table("bookings")
        .update({"status": "cancelled", "payment_status": payment_status})
        .eq("id", booking_id)
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not cancel booking")
    if existing.get("professional_id"):
        notify(
            "provider",
            existing["professional_id"],
            "Booking cancelled",
            f"The {existing.get('service_name')} booking for {existing.get('scheduled_date')} was cancelled by the customer.",
            {"booking_id": booking_id},
        )
    insert_notification(
        customer_phone(claims),
        "alert",
        "Booking Cancelled",
        refund_note or f"Your {existing.get('service_name')} booking has been cancelled.",
        booking_id,
    )
    return res.data[0]


@router.put("/bookings/{booking_id}/payment")
def pay_booking(booking_id: str, body: dict, claims: dict = Depends(require_customer)):
    """Record an offline (cash) settlement.

    Online payments are not settled here. This endpoint used to accept
    `payment_status: paid` for any booking, which let a caller mark an unpaid
    booking as paid with one PUT. Only cash can be settled client-side now;
    online goes through `POST /payments/verify`, which checks Razorpay's HMAC.
    """
    client = db()
    existing = one(
        client.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing:
        raise ApiError(404, "Booking not found")
    if existing["status"] == "cancelled":
        raise ApiError(400, "This booking was cancelled")

    requested = body.get("payment_method")
    method = gateway.normalise_method(requested if requested is not None else existing.get("payment_method"))
    if gateway.is_online(method):
        raise ApiError(
            400,
            "Online payments are confirmed by the payment gateway, not by the app",
            "use_payment_flow",
        )

    amount = round2(existing.get("total_amount") or 0)
    payment = ledger.record_payment(existing, gateway.CASH, amount, status="paid")

    client.table("bookings").update(
        {"payment_method": gateway.CASH, "payment_status": "paid", "settled_amount": amount}
    ).eq("id", booking_id).execute()
    row = one(client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute())

    if existing.get("professional_id"):
        notify(
            "provider",
            existing["professional_id"],
            "Payment received",
            f"Rs {amount:g} collected in cash for your {existing.get('service_name')} job.",
            {"booking_id": booking_id},
        )
    insert_notification(
        customer_phone(claims),
        "payment",
        "Payment Recorded",
        f"Payment of Rs {amount:g} recorded for your {existing.get('service_name')} booking.",
        booking_id,
    )
    return {"booking": row, "payment": payment}


@router.post("/bookings/{booking_id}/refund-request")
def refund_request(booking_id: str, body: dict, claims: dict = Depends(require_customer)):
    """Ask for money back. Always creates a dispute the admin console can act on."""
    client = db()
    existing = one(
        client.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing:
        raise ApiError(404, "Booking not found")
    reason = body.get("reason") if isinstance(body.get("reason"), str) else ""
    if not reason.strip():
        raise ApiError(400, "Tell us what went wrong so we can act on it")
    row = ledger.request_refund(existing, reason.strip(), source="manual")
    return row


@router.get("/refunds")
def my_refunds(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("refunds")
        .select("*")
        .eq("customer_phone", customer_phone(claims))
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data or []


@router.post("/device-token")
def register_device_token(body: dict, claims: dict = Depends(require_customer)):
    """Register an FCM token so this customer can be reached outside the app."""
    token = body.get("token")
    if not isinstance(token, str) or len(token.strip()) < 20:
        raise ApiError(400, "A valid push token is required")
    platform = body.get("platform") if isinstance(body.get("platform"), str) else "web"
    res = (
        db().table("device_tokens")
        .upsert(
            {
                "role": "customer",
                "owner_id": customer_phone(claims),
                "token": token.strip(),
                "platform": platform,
                "last_seen_at": events.now_iso(),
            },
            on_conflict="token",
        )
        .execute()
    )
    return {"registered": bool(res.data is not None)}


@router.delete("/device-token")
def unregister_device_token(body: dict, claims: dict = Depends(require_customer)):
    token = body.get("token")
    if not isinstance(token, str):
        raise ApiError(400, "token required")
    db().table("device_tokens").delete().eq("token", token.strip()).eq(
        "owner_id", customer_phone(claims)
    ).execute()
    return {"ok": True}


@router.get("/favourites")
def favourites(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("favourites")
        .select("*, professional:professionals(*)")
        .eq("customer_phone", customer_phone(claims))
        .execute()
    )
    return [row.get("professional") for row in (res.data or []) if row.get("professional")]


@router.post("/favourites", status_code=201)
def add_favourite(body: dict, claims: dict = Depends(require_customer)):
    professional_id = body.get("professional_id")
    if not isinstance(professional_id, str):
        raise ApiError(400, "professional_id required")
    client = db()
    existing = one(
        client.table("favourites")
        .select("id")
        .eq("customer_phone", customer_phone(claims))
        .eq("professional_id", professional_id)
        .maybe_single()
        .execute()
    )
    if existing:
        raise ApiError(409, "Already a favourite")
    res = (
        client.table("favourites")
        .insert({"customer_phone": customer_phone(claims), "professional_id": professional_id})
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not add favourite")
    return res.data[0]


@router.delete("/favourites/{professional_id}")
def remove_favourite(professional_id: str, claims: dict = Depends(require_customer)):
    client = db()
    client.table("favourites").delete().eq("customer_phone", customer_phone(claims)).eq(
        "professional_id", professional_id
    ).execute()
    return {"ok": True}


@router.get("/notifications")
def notifications(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("notifications")
        .select("*")
        .eq("customer_phone", customer_phone(claims))
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return res.data or []


@router.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("notifications")
        .update({"read": True})
        .eq("id", notification_id)
        .eq("customer_phone", customer_phone(claims))
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(404, "Notification not found")
    return res.data[0]


@router.put("/notifications/read-all")
def mark_all_notifications_read(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("notifications")
        .update({"read": True})
        .eq("customer_phone", customer_phone(claims))
        .eq("read", False)
        .select("id")
        .execute()
    )
    return {"ok": True, "updated": len(res.data or [])}


@router.get("/tickets")
def tickets(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("support_tickets")
        .select("*")
        .eq("customer_phone", customer_phone(claims))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/tickets", status_code=201)
def create_ticket(body: dict, claims: dict = Depends(require_customer)):
    message = body.get("message")
    if not isinstance(message, str) or not message.strip():
        raise ApiError(400, "message required")
    client = db()
    res = (
        client.table("support_tickets")
        .insert(
            {
                "customer_phone": customer_phone(claims),
                "message": message.strip(),
                "status": "open",
            }
        )
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create ticket")
    return res.data[0]


@router.get("/reviews")
def my_reviews(claims: dict = Depends(require_customer)):
    """Reviews this customer actually wrote.

    `reviews.customer_name` stores the profile *name*, so filtering it on the
    phone number only ever matched reviews by customers who never set a name -
    which is why "My reviews" was empty for most accounts. Join back to the
    bookings instead, since the booking knows who paid for it.
    """
    client = db()
    phone = customer_phone(claims)
    mine = client.table("bookings").select("id, service_name, professional_id, scheduled_date").eq(
        "customer_phone", phone
    ).execute().data or []
    booking_ids = [b["id"] for b in mine if b.get("id")]
    if not booking_ids:
        return []
    res = (
        client.table("reviews")
        .select("*")
        .in_("booking_id", booking_ids)
        .order("created_at", desc=True)
        .execute()
    )
    # Reviews posted without a booking_id still belong to the customer if they
    # were written against a professional they actually booked.
    unlinked = (
        client.table("reviews")
        .select("*")
        .eq("customer_name", phone)
        .is_("booking_id", None)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return list(res.data or []) + unlinked


@router.post("/reviews", status_code=201)
def add_review(body: dict, claims: dict = Depends(require_customer)):
    professional_id = body.get("professional_id")
    if not isinstance(professional_id, str):
        raise ApiError(400, "professional_id required")
    rating = int(body.get("rating") or 5)
    rating = max(1, min(5, rating))
    client = db()
    profile = one(client.table("profiles").select("name").eq("phone", customer_phone(claims)).maybe_single().execute())
    name = profile.get("name") if profile else customer_phone(claims)
    res = (
        client.table("reviews")
        .insert(
            {
                "booking_id": body.get("booking_id") if isinstance(body.get("booking_id"), str) else None,
                "professional_id": professional_id,
                "customer_name": name,
                "rating": rating,
                "comment": body.get("comment", ""),
            }
        )
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create review")
    pro = one(client.table("professionals").select("rating, reviews_count").eq("id", professional_id).maybe_single().execute())
    if pro:
        old_count = int(pro.get("reviews_count") or 0)
        old_rating = float(pro.get("rating") or 0)
        new_count = old_count + 1
        new_rating = round(((old_rating * old_count) + rating) / new_count, 1) if new_count else rating
        client.table("professionals").update({"rating": new_rating, "reviews_count": new_count}).eq(
            "id", professional_id
        ).execute()
    return res.data[0]