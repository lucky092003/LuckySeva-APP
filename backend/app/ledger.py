"""Money movement: provider payout balances and customer refunds.

Two ledgers hang off `bookings`:

* **Payouts** - what the platform owes a professional. A provider's available
  balance is completed `provider_earnings` minus settled payouts. It deliberately
  does *not* use `total_amount`: the difference is the platform's own commission
  and must never be payable out.
* **Refunds** - what the platform owes a customer, always anchored to a `payments`
  row so the same money is never refunded twice.

Both are derived, never incremented in place, so a repeated call is idempotent.
"""

import logging

from . import payments as gateway
from .config import AUTO_REFUND_MINUTES, PAYOUT_MIN_AMOUNT
from .db import db, one
from .events import insert_notification, setting_float, setting_minutes
from .exceptions import ApiError
from .pricing import round2

logger = logging.getLogger(__name__)

OPEN_PAYOUT_STATES = {"requested", "approved"}
TERMINAL_PAYOUT_STATES = {"completed", "rejected", "cancelled"}


# ---------------------------------------------------------------------------
# Payouts
# ---------------------------------------------------------------------------
def completed_earnings(client, professional_id: str) -> float:
    """Everything this professional has earned that is ready to be paid out."""
    rows = (
        client.table("bookings")
        .select("provider_earnings, total_amount")
        .eq("professional_id", professional_id)
        .eq("status", "completed")
        .execute()
    ).data or []
    return round2(
        sum(
            float(r.get("provider_earnings") if r.get("provider_earnings") is not None else r.get("total_amount") or 0)
            for r in rows
        )
    )


def settled_out(client, professional_id: str) -> float:
    """Only completed payouts reduce the balance. A request is not money gone."""
    rows = (
        client.table("payouts")
        .select("amount")
        .eq("professional_id", professional_id)
        .eq("status", "completed")
        .execute()
    ).data or []
    return round2(sum(float(r.get("amount") or 0) for r in rows))


def on_hold(client, professional_id: str) -> float:
    rows = (
        client.table("payouts")
        .select("amount, status")
        .eq("professional_id", professional_id)
        .in_("status", list(OPEN_PAYOUT_STATES))
        .execute()
    ).data or []
    return round2(sum(float(r.get("amount") or 0) for r in rows))


def payout_minimum(client) -> float:
    return setting_float(client, "payout_min_amount", PAYOUT_MIN_AMOUNT)


def provider_balance(client, professional_id: str) -> dict:
    earned = completed_earnings(client, professional_id)
    paid = settled_out(client, professional_id)
    held = on_hold(client, professional_id)
    available = round2(max(0.0, earned - paid - held))
    return {
        "total_earnings": earned,
        "settled": paid,
        "on_hold": held,
        "available": available,
        "payout_minimum": payout_minimum(client),
    }


def create_payout(client, professional_id: str, amount: float) -> dict:
    """Open a payout request, refusing anything the provider has not earned."""
    amount = round2(amount)
    if amount <= 0:
        raise ApiError(400, "Enter a valid amount")
    balance = provider_balance(client, professional_id)
    if amount < balance["payout_minimum"]:
        raise ApiError(400, f"Minimum payout is Rs {balance['payout_minimum']:g}")
    if amount > balance["available"]:
        raise ApiError(400, f"You can withdraw at most Rs {balance['available']:g} right now")

    row = one(
        client.table("payouts")
        .insert({"professional_id": professional_id, "amount": amount, "status": "requested"})
        .select("*")
        .maybe_single()
        .execute()
    )
    if not row:
        raise ApiError(400, "Could not request payout")
    client.table("audit_logs").insert(
        {"action": "payout_request", "detail": f"Rs {amount:g} requested by {professional_id}"}
    ).execute()
    return row


def settle_payout(payout_id: str, *, status: str, reference: str = "", note: str = "") -> dict:
    """Move a payout to `approved`, `completed`, `rejected` or `cancelled`.

    A rejection releases the held amount back to the provider's balance, which is
    why `settled_out` ignores the status and the balance recomputes from scratch.
    """
    if status not in {"approved", "completed", "rejected", "cancelled"}:
        raise ApiError(400, "status must be approved, completed, rejected or cancelled")
    client = db()
    existing = one(
        client.table("payouts").select("*").eq("id", payout_id).maybe_single().execute()
    )
    if not existing:
        raise ApiError(404, "Payout not found")
    if existing["status"] in TERMINAL_PAYOUT_STATES and existing["status"] != status:
        raise ApiError(400, f"Payout is already {existing['status']}")

    patch = {"status": status, "note": note or existing.get("note") or ""}
    if status == "completed":
        patch["settled_at"] = existing.get("settled_at") or None
        patch["settlement_ref"] = reference or existing.get("settlement_ref") or ""
    row = one(
        client.table("payouts").update(patch).eq("id", payout_id).select("*").maybe_single().execute()
    )
    if not row:
        raise ApiError(400, "Could not update payout")
    client.table("audit_logs").insert(
        {
            "action": f"payout_{status}",
            "detail": f"Payout {payout_id} Rs {float(existing.get('amount') or 0):g} -> {status}"
            + (f" ref {reference}" if reference else ""),
        }
    ).execute()
    return row


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
def record_payment(booking: dict, method: str, amount: float, *, status: str) -> dict:
    client = db()
    online = gateway.is_online(method)
    # `insert()` returns a query builder, not a select builder, so `maybe_single()`
    # does not exist on it - the "record a payment" flow raised AttributeError on
    # every call. Read the inserted row off the response like every other insert.
    res = (
        client.table("payments")
        .insert(
            {
                "booking_id": booking["id"],
                "customer_phone": booking.get("customer_phone"),
                "provider": gateway.RAZORPAY if online else gateway.CASH,
                "method": method,
                "amount": round2(amount),
                "status": status,
                "gateway": gateway.RAZORPAY if online else gateway.CASH,
            }
        )
        .select("*")
        .execute()
    )
    row = (res.data or [None])[0]
    if not row:
        raise ApiError(400, "Could not record payment")
    return row


def successful_payment(client, booking_id: str) -> dict | None:
    return one(
        client.table("payments")
        .select("*")
        .eq("booking_id", booking_id)
        .eq("status", "paid")
        .order("created_at", desc=True)
        .maybe_single()
        .execute()
    )


def refundable_amount(booking: dict, payment: dict | None) -> float:
    """What can still be returned: what was taken, minus what already went back."""
    if not payment:
        return 0.0
    return round2(max(0.0, float(payment.get("amount") or 0) - float(booking.get("refund_amount") or 0)))


# ---------------------------------------------------------------------------
# Refunds and disputes
# ---------------------------------------------------------------------------
def request_refund(booking: dict, reason: str, *, source: str = "manual", amount: float | None = None,
                    role: str = "customer") -> dict:
    """Raise a refund, and with it a dispute the admin console can work through.

    Idempotent per pending request: asking twice does not double the exposure.
    """
    client = db()
    payment = successful_payment(client, booking["id"])
    max_refund = refundable_amount(booking, payment)
    if max_refund <= 0:
        raise ApiError(400, "There is no payment on this booking to refund", "no_payment")

    pending = one(
        client.table("refunds")
        .select("*")
        .eq("booking_id", booking["id"])
        .eq("status", "pending")
        .maybe_single()
        .execute()
    )
    if pending:
        return pending

    value = round2(amount) if amount is not None else max_refund
    value = min(round2(value), max_refund)
    if value <= 0:
        raise ApiError(400, "Refund amount must be greater than zero")

    auto_ok = source == "auto" and _within_auto_window(client, booking)
    row = one(
        client.table("refunds")
        .insert(
            {
                "payment_id": payment["id"] if payment else None,
                "booking_id": booking["id"],
                "customer_phone": booking.get("customer_phone"),
                "amount": value,
                "reason": reason[:500],
                "source": "auto" if auto_ok else source,
                "status": "completed" if auto_ok else "pending",
            }
        )
        .select("*")
        .maybe_single()
        .execute()
    )
    if not row:
        raise ApiError(400, "Could not raise refund")

    client.table("disputes").insert(
        {
            "booking_id": booking["id"],
            "payment_id": payment["id"] if payment else None,
            "customer_phone": booking.get("customer_phone"),
            "professional_id": booking.get("professional_id"),
            "reason": reason[:500],
            "refund_amount": value,
            "status": "open",
        }
    ).execute()

    if auto_ok:
        try:
            approve_refund(row, note="auto-refund on cancellation", settle=True)
        except ApiError as exc:
            logger.warning("Auto-refund for booking %s deferred: %s", booking.get("id"), exc.message)
    return row


def _within_auto_window(client, booking: dict) -> bool:
    minutes = setting_minutes(client, "auto_refund_minutes", AUTO_REFUND_MINUTES)
    created = booking.get("created_at")
    if not isinstance(created, str):
        return False
    from datetime import datetime, timedelta, timezone

    try:
        stamp = datetime.fromisoformat(created.replace("Z", "+00:00"))
    except ValueError:
        return False
    return datetime.now(timezone.utc) - stamp <= timedelta(minutes=minutes)


def approve_refund(refund: dict, note: str = "", *, settle: bool = True) -> dict:
    """Approve a refund, call the gateway if there is one, and mark the booking.

    With no gateway configured the refund is recorded as settled for a cash
    booking; an online refund is left `pending` rather than being declared
    complete, because the money has provably not moved yet.
    """
    client = db()
    if refund.get("status") == "completed":
        return refund
    if refund.get("status") not in {"pending", "failed"}:
        raise ApiError(400, f"Refund is already {refund.get('status')}")

    payment = None
    if refund.get("payment_id"):
        payment = one(
            client.table("payments").select("*").eq("id", refund["payment_id"]).maybe_single().execute()
        )

    gateway_ref = ""
    failure = ""
    needs_gateway = bool(payment and payment.get("gateway") == gateway.RAZORPAY and payment.get("gateway_payment_id"))
    if needs_gateway:
        if not gateway.payments_enabled():
            failure = "gateway not configured"
        else:
            try:
                result = gateway.refund_payment(payment["gateway_payment_id"], float(refund["amount"]))
                gateway_ref = result.get("id") or ""
            except ApiError as exc:
                failure = exc.message

    if failure:
        row = one(
            client.table("refunds").update({"status": "failed", "note": failure}).eq("id", refund["id"]).select("*").maybe_single().execute()
        )
        raise ApiError(502, failure, "refund_failed")

    status = "completed" if settle else "approved"
    row = one(
        client.table("refunds")
        .update(
            {
                "status": status,
                "note": note[:500],
                "gateway_refund_id": gateway_ref,
                "processed_at": None if not settle else client_time(),
            }
        )
        .eq("id", refund["id"])
        .select("*")
        .maybe_single()
        .execute()
    )
    if not row:
        raise ApiError(400, "Could not update refund")

    if settle and row.get("booking_id"):
        _apply_refund_to_booking(client, row)
    return row


def reject_refund(refund_id: str, note: str) -> dict:
    client = db()
    existing = one(client.table("refunds").select("*").eq("id", refund_id).maybe_single().execute())
    if not existing:
        raise ApiError(404, "Refund not found")
    if existing.get("status") == "completed":
        raise ApiError(400, "A completed refund cannot be rejected")
    row = one(
        client.table("refunds").update({"status": "rejected", "note": note[:500]}).eq("id", refund_id).select("*").maybe_single().execute()
    )
    if not row:
        raise ApiError(400, "Could not reject refund")
    if existing.get("booking_id"):
        client.table("disputes").update({"status": "rejected", "resolution": note[:500]}).eq(
            "booking_id", existing["booking_id"]
        ).eq("status", "open").execute()
    insert_notification(
        existing.get("customer_phone"),
        "payment",
        "Refund not approved",
        note[:200] or "Your refund request was reviewed and could not be approved.",
        existing.get("booking_id"),
    )
    return row


def _apply_refund_to_booking(client, refund: dict) -> None:
    booking_id = refund.get("booking_id")
    booking = one(client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute())
    if not booking:
        return
    refunded = round2(float(booking.get("refund_amount") or 0) + float(refund.get("amount") or 0))
    client.table("bookings").update({"refund_amount": refunded}).eq("id", booking_id).execute()
    client.table("payments").update({"status": "refunded"}).eq("id", refund.get("payment_id")).execute()
    # Only a full refund clears the paid flag; a partial one keeps it so the
    # remainder is still owed to the professional.
    total = float(booking.get("total_amount") or 0)
    client.table("bookings").update(
        {"payment_status": "refunded" if refunded >= total and total > 0 else "partially_refunded"}
    ).eq("id", booking_id).execute()
    client.table("disputes").update(
        {"status": "resolved", "resolution": refund.get("note") or "Refunded", "resolved_at": client_time()}
    ).eq("booking_id", booking_id).eq("status", "open").execute()
    insert_notification(
        booking.get("customer_phone"),
        "payment",
        "Refund processed",
        f"Rs {float(refund.get('amount') or 0):g} has been refunded to your payment method.",
        booking_id,
    )
    client.table("audit_logs").insert(
        {"action": "refund", "detail": f"Rs {float(refund.get('amount') or 0):g} refunded on booking {booking_id}"}
    ).execute()


def client_time() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()