"""Customer-facing payment endpoints.

The whole flow in three calls: open an order, hand it to Razorpay Checkout,
then prove the result.

`verify` is the only place a booking can become `paid`. It recomputes
Razorpay's HMAC from the server-side secret, so neither the client nor a
replayed webhook can mark an order paid without money actually moving.
"""

import json

from fastapi import APIRouter, Depends, Header, Request

from .. import ledger
from .. import payments as gateway
from ..db import db, one
from ..dependencies import require_customer
from ..events import insert_notification
from ..exceptions import ApiError
from ..pricing import round2
from ..push import notify

router = APIRouter(dependencies=[Depends(require_customer)])


def _customer_phone(claims: dict) -> str:
    return claims["phone"]


def _owned_booking(booking_id: str, phone: str) -> dict:
    row = one(
        db().table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("customer_phone", phone)
        .maybe_single()
        .execute()
    )
    if not row:
        raise ApiError(404, "Booking not found")
    return row


@router.get("/config")
def config():
    """What the checkout screen needs before it can render."""
    return {
        "enabled": gateway.payments_enabled(),
        "gateway": gateway.RAZORPAY,
        "key_id": gateway.RAZORPAY_KEY_ID if gateway.payments_enabled() else None,
        "cash_supported": True,
        "methods": sorted(gateway.ONLINE_METHODS),
    }


@router.post("/order")
def create_order(booking_id: str, body: dict, claims: dict = Depends(require_customer)):
    """Open a Razorpay order for the amount the server already computed.

    The amount is never taken from the request: it comes from
    `bookings.total_amount`, which itself was priced server-side including any
    coupon and commission.
    """
    if not gateway.payments_enabled():
        raise ApiError(503, "Online payments are not available right now. Please pay by cash.", "payments_disabled")
    booking = _owned_booking(booking_id, _customer_phone(claims))
    if booking["status"] == "cancelled":
        raise ApiError(400, "This booking was cancelled")

    amount = round2(booking.get("total_amount") or 0)
    if amount <= 0:
        raise ApiError(400, "Nothing to pay for this booking")

    already = ledger.successful_payment(db(), booking_id)
    if already:
        raise ApiError(409, "This booking is already paid", "already_paid")

    method = gateway.normalise_method(body.get("method"))
    if not gateway.is_online(method):
        raise ApiError(400, "Choose an online payment method")

    order = gateway.create_order(
        amount_paise=gateway.to_paise(amount),
        receipt=f"booking_{booking_id[:24]}",
        notes={"booking_id": booking_id, "service": booking.get("service_name", "")},
    )
    payment = one(
        db().table("payments")
        .upsert(
            {
                "booking_id": booking_id,
                "customer_phone": booking.get("customer_phone"),
                "provider": gateway.RAZORPAY,
                "method": method,
                "amount": amount,
                "status": "created",
                "gateway": gateway.RAZORPAY,
                "gateway_order_id": order["order_id"],
            },
            on_conflict="gateway_order_id",
        )
        .select("*")
        .maybe_single()
        .execute()
    )
    if not payment:
        raise ApiError(502, "Could not start the payment", "payment_start_failed")
    return {
        "payment_id": payment["id"],
        "order_id": order["order_id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": order["key_id"],
    }


@router.post("/verify")
def verify(booking_id: str, body: dict, claims: dict = Depends(require_customer)):
    """Confirm a payment and settle the booking.

    Rejects unless Razorpay's signature matches what the server computes from
    `order_id` and `payment_id`, so a forged success callback is inert.
    """
    if not gateway.payments_enabled():
        raise ApiError(503, "Online payments are not available right now", "payments_disabled")
    booking = _owned_booking(booking_id, _customer_phone(claims))

    order_id = body.get("razorpay_order_id") if isinstance(body.get("razorpay_order_id"), str) else ""
    payment_ref = body.get("razorpay_payment_id") if isinstance(body.get("razorpay_payment_id"), str) else ""
    signature = body.get("razorpay_signature") if isinstance(body.get("razorpay_signature"), str) else ""
    if not (order_id and payment_ref and signature):
        raise ApiError(400, "Incomplete payment response", "bad_payment_response")

    if not gateway.verify_payment_signature(order_id, payment_ref, signature):
        raise ApiError(400, "Payment could not be verified. If money left your account, contact support.",
                       "signature_mismatch")

    client = db()
    payment = one(
        client.table("payments")
        .select("*")
        .eq("gateway_order_id", order_id)
        .eq("booking_id", booking_id)
        .maybe_single()
        .execute()
    )
    if not payment:
        raise ApiError(404, "No payment was started for this booking")
    if payment.get("status") == "paid":
        return {"ok": True, "already_paid": True, "booking": _owned_booking(booking_id, _customer_phone(claims))}

    # The order was opened for a specific amount; a tampered client cannot pay
    # less and have it accepted.
    if gateway.to_paise(payment.get("amount") or 0) != gateway.to_paise(booking.get("total_amount") or 0):
        raise ApiError(400, "Payment amount does not match this booking", "amount_mismatch")

    now = _now()
    client.table("payments").update(
        {
            "status": "paid",
            "gateway_payment_id": payment_ref,
            "gateway_signature": signature,
            "captured_at": now,
            "failure_reason": None,
        }
    ).eq("id", payment["id"]).execute()
    client.table("bookings").update(
        {
            "payment_status": "paid",
            "payment_method": payment.get("method") or booking.get("payment_method"),
            "settled_amount": round2(booking.get("total_amount") or 0),
        }
    ).eq("id", booking_id).execute()

    if booking.get("professional_id"):
        notify(
            "provider",
            booking["professional_id"],
            "Payment received",
            f"Rs {round2(booking.get('total_amount') or 0):g} received for the "
            f"{booking.get('service_name')} booking.",
            {"booking_id": booking_id},
        )
    insert_notification(
        booking.get("customer_phone"),
        "payment",
        "Payment Confirmed",
        f"Rs {round2(booking.get('total_amount') or 0):g} received for your "
        f"{booking.get('service_name')} booking.",
        booking_id,
    )
    return {"ok": True, "booking": _owned_booking(booking_id, _customer_phone(claims))}


@router.get("/bookings/{booking_id}")
def booking_payments(booking_id: str, claims: dict = Depends(require_customer)):
    """Every attempt on this booking, so a customer can see a failed one."""
    _owned_booking(booking_id, _customer_phone(claims))
    rows = (
        db().table("payments")
        .select("*")
        .eq("booking_id", booking_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return rows


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------
# Mounted outside the customer guard: Razorpay cannot present a customer JWT, it
# presents an HMAC of the raw body. Kept in this module so all gateway knowledge
# stays in one file, but it carries its own authentication.
webhook = APIRouter()


@webhook.post("/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(default="")):
    """Server-to-server settlement.

    The signature is checked against the raw bytes: re-serialising the parsed JSON
    would change the payload and the HMAC would never match.
    """
    raw = await request.body()
    if not gateway.payments_enabled():
        return {"status": "ignored", "reason": "payments disabled"}
    if not gateway.verify_webhook_signature(raw, x_razorpay_signature):
        raise ApiError(401, "Invalid webhook signature", "bad_webhook_signature")

    try:
        event = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise ApiError(400, "Malformed webhook payload")

    entity = event.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = entity.get("order_id")
    payment_ref = entity.get("id")
    status = entity.get("status")
    if not (order_id and payment_ref):
        return {"status": "ignored", "reason": "no order in payload"}

    if status not in {"captured", "authorized", "failed"}:
        return {"status": "ignored", "reason": f"unhandled status {status}"}

    client = db()
    payment = one(
        client.table("payments").select("*").eq("gateway_order_id", order_id).maybe_single().execute()
    )
    if not payment:
        return {"status": "ignored", "reason": "unknown order"}
    # Already terminal: Razorpay retries webhooks, so this must be idempotent.
    if payment.get("status") == "paid":
        return {"status": "ok", "duplicate": True}

    if status == "failed":
        client.table("payments").update(
            {"status": "failed", "failure_reason": entity.get("error_description") or "Payment failed"}
        ).eq("id", payment["id"]).execute()
        return {"status": "ok", "recorded": "failed"}

    booking = one(
        client.table("bookings").select("*").eq("id", payment["booking_id"]).maybe_single().execute()
    )
    if not booking:
        return {"status": "ignored", "reason": "booking missing"}

    client.table("payments").update(
        {"status": "paid", "gateway_payment_id": payment_ref, "captured_at": _now()}
    ).eq("id", payment["id"]).execute()
    client.table("bookings").update(
        {
            "payment_status": "paid",
            "settled_amount": round2(booking.get("total_amount") or 0),
        }
    ).eq("id", booking["id"]).execute()
    if booking.get("professional_id"):
        notify(
            "provider",
            booking["professional_id"],
            "Payment received",
            f"Rs {round2(booking.get('total_amount') or 0):g} received for the {booking.get('service_name')} booking.",
            {"booking_id": booking["id"]},
        )
    return {"status": "ok"}