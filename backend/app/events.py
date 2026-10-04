"""Booking lifecycle events: customer notifications, accept-deadline expiry, push.

Sits between the routers and the database so `customer.py` and `provider.py` do
not each grow their own copy of "tell someone something happened". Every helper is
best effort - a failed notification insert never fails the write that triggered
it - except `sweep_expired_requests`, which is the one place a lazy, idempotent
housekeeping pass belongs.
"""

import logging
from datetime import datetime, timedelta, timezone

from .config import ACCEPT_DEADLINE_MINUTES
from .db import db

logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def insert_notification(customer_phone: str | None, type: str, title: str, message: str,
                        booking_id: str | None = None) -> None:
    """Write the in-app bell entry. Swallowed on failure by design."""
    if not customer_phone:
        return
    try:
        db().table("notifications").insert(
            {
                "customer_phone": customer_phone,
                "type": type,
                "title": title,
                "message": message,
                "booking_id": booking_id,
                "read": False,
            }
        ).execute()
    except Exception as exc:
        logger.warning("Could not insert notification for %s: %s", customer_phone, exc)


def setting_minutes(client, key: str, fallback: int) -> int:
    try:
        row = client.table("admin_settings").select("value").eq("key", key).maybe_single().execute()
        raw = (row.data or {}).get("value") if row.data else None
        return max(1, int(raw)) if raw not in (None, "") else fallback
    except (TypeError, ValueError):
        return fallback


def setting_float(client, key: str, fallback: float) -> float:
    try:
        row = client.table("admin_settings").select("value").eq("key", key).maybe_single().execute()
        raw = (row.data or {}).get("value") if row.data else None
        return float(raw) if raw not in (None, "") else fallback
    except (TypeError, ValueError):
        return fallback


def accept_deadline_minutes(client) -> int:
    return setting_minutes(client, "accept_deadline_minutes", ACCEPT_DEADLINE_MINUTES)


def new_accept_deadline(client) -> str:
    minutes = accept_deadline_minutes(client)
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


def sweep_expired_requests(client) -> int:
    """Lapse unaccepted requests whose window has closed. Returns how many.

    Run lazily from the provider feed and the customer's booking read rather than
    a scheduler, because the deployment target is a single free Render instance
    with no worker. `accept_expired_at IS NULL` makes it idempotent, so repeated
    sweeps in the same request are harmless and no row is notified twice.
    """
    try:
        pending = (
            client.table("bookings")
            .select("id, customer_phone, service_name, scheduled_date, scheduled_time, professional_id")
            .eq("status", "confirmed")
            .is_("accept_deadline", "not.null")
        )
        if hasattr(pending, "is_"):
            pending = pending.is_("accept_expired_at", None)
        pending = (
            pending.lt("accept_deadline", now_iso())
            .execute()
        )
    except Exception as exc:
        logger.warning("Could not read expiring requests: %s", exc)
        return 0

    rows = pending.data or []
    for row in rows:
        try:
            client.table("bookings").update({"accept_expired_at": now_iso()}).eq("id", row["id"]).execute()
        except Exception as exc:
            logger.warning("Could not expire booking %s: %s", row.get("id"), exc)
            continue
        # Only tell the customer when nobody was ever attached: a pre-picked
        # professional who went quiet is a different conversation.
        if not row.get("professional_id"):
            insert_notification(
                row.get("customer_phone"),
                "alert",
                "No professional accepted yet",
                f"Your {row.get('service_name')} request for {row.get('scheduled_date')} at "
                f"{row.get('scheduled_time')} timed out. Tap retry to send it out again.",
                row.get("id"),
            )
    return len(rows)


def providers_for_service(client, service_id: str | None, category_slug: str | None) -> list[str]:
    """Professionals who could take this service, restricted to those accepting.

    `professional_services` is the authoritative link table (see links.py); the
    category is only a fallback for rows predating it.
    """
    if service_id:
        rows = (
            client.table("professional_services")
            .select("professional_id")
            .eq("service_id", service_id)
            .execute()
        ).data or []
        ids = [r.get("professional_id") for r in rows if r.get("professional_id")]
        if ids:
            return ids
    if not category_slug:
        return []
    rows = (
        client.table("professionals")
        .select("id")
        .eq("category_slug", category_slug)
        .eq("accepting_jobs", True)
        .execute()
    ).data or []
    return [r["id"] for r in rows]


def accepting_professionals(client, professional_ids: list[str]) -> list[str]:
    """Filter candidates down to the ones currently accepting jobs."""
    if not professional_ids:
        return []
    rows = (
        client.table("professionals")
        .select("id")
        .in_("id", professional_ids)
        .eq("accepting_jobs", True)
        .execute()
    ).data or []
    return [r["id"] for r in rows if r.get("id")]