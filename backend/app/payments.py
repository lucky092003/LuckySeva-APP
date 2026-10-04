"""Razorpay integration: order creation, signature verification, refunds.

Deliberately *optional*. With no `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in the
environment every entry point reports the gateway as unconfigured and the caller
falls back to the cash flow, so a fresh checkout (and CI) runs without payment
credentials and without pretending money was taken.

The rule that matters: the client is never trusted to say a payment succeeded.
`verify_payment_signature` recomputes Razorpay's HMAC from the secret, so a
tampered `payment_id` cannot mark a booking paid.
"""

import hashlib
import hmac
import logging

from .config import (
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    is_payments_enabled,
)
from .exceptions import ApiError

logger = logging.getLogger(__name__)

API_BASE = "https://api.razorpay.com/v1"

CASH = "cash"
RAZORPAY = "razorpay"

VALID_METHODS = {"upi", "card", "netbanking", "wallet", "emi", "cash"}

# Methods that must go through a gateway. Anything else settles offline.
ONLINE_METHODS = VALID_METHODS - {CASH}

REQUEST_TIMEOUT_SECONDS = 15.0


def gateway_configured() -> bool:
    return bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)


def payments_enabled() -> bool:
    """True when the platform should actually attempt a real charge."""
    return is_payments_enabled() and gateway_configured()


def to_paise(amount: float) -> int:
    """Razorpay takes paise, and must never be handed a float with a fraction."""
    return int(round(float(amount or 0) * 100))


def from_paise(paise) -> float:
    return round(float(paise or 0) / 100.0, 2) + 0.0


def normalise_method(method) -> str:
    if isinstance(method, str) and method.strip().lower() in VALID_METHODS:
        return method.strip().lower()
    return CASH


def is_online(method: str) -> bool:
    return method in ONLINE_METHODS


def _auth_header() -> dict:
    import base64

    raw = f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}".encode()
    return {"Authorization": f"Basic {base64.b64encode(raw).decode()}"}


def _post(path: str, body: dict) -> dict:
    import httpx

    url = f"{API_BASE}{path}"
    try:
        res = httpx.post(url, json=body, headers={**_auth_header(), "Content-Type": "application/json"},
                         timeout=REQUEST_TIMEOUT_SECONDS)
    except httpx.HTTPError as exc:
        # A gateway timeout must not read as "payment failed" to the customer:
        # it is genuinely unknown, so say so rather than guessing.
        logger.warning("Razorpay %s unreachable: %s", path, exc)
        raise ApiError(503, "Payment gateway is unreachable. Please try again in a moment.", "gateway_unreachable")
    if res.status_code >= 400:
        detail = ""
        try:
            detail = (res.json().get("error") or {}).get("description") or res.text[:200]
        except ValueError:
            detail = res.text[:200]
        logger.warning("Razorpay %s failed: %s %s", path, res.status_code, detail)
        raise ApiError(502, f"Payment gateway rejected the request ({res.status_code})", "gateway_error")
    return res.json()


def create_order(*, amount_paise: int, receipt: str, notes: dict | None = None) -> dict:
    """Open a Razorpay order and return the id plus the public key id."""
    if amount_paise <= 0:
        raise ApiError(400, "Payment amount must be greater than zero")
    body = {"amount": amount_paise, "currency": "INR", "receipt": receipt}
    if notes:
        body["notes"] = {k: str(v)[:255] for k, v in notes.items()}
    data = _post("/orders", body)
    return {
        "order_id": data.get("id"),
        "amount": from_paise(data.get("amount", amount_paise)),
        "currency": data.get("currency", "INR"),
        "key_id": RAZORPAY_KEY_ID,
    }


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Recompute Razorpay's checkout signature over `order_id|payment_id`."""
    if not (order_id and payment_id and signature):
        return False
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Verify the `X-Razorpay-Signature` header on a webhook.

    This one uses the webhook secret rather than the API key secret; when no
    webhook secret is configured the webhook is refused rather than accepted
    blind, since an unsigned webhook can be replayed to mark bookings paid.
    """
    if not (RAZORPAY_WEBHOOK_SECRET and signature):
        return False
    expected = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode(),
        raw_body or b"",
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def refund_payment(gateway_payment_id: str, amount: float) -> dict:
    """Refund all or part of a captured payment."""
    if not gateway_payment_id:
        raise ApiError(400, "This payment has no gateway reference to refund")
    paise = to_paise(amount)
    if paise <= 0:
        raise ApiError(400, "Refund amount must be greater than zero")
    return _post(f"/payments/{gateway_payment_id}/refund", {"amount": paise})


def fetch_payment(gateway_payment_id: str) -> dict:
    import httpx

    try:
        res = httpx.get(
            f"{API_BASE}/payments/{gateway_payment_id}",
            headers=_auth_header(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        logger.warning("Razorpay fetch_payment %s failed: %s", gateway_payment_id, exc)
        return {}
    if res.status_code >= 400:
        return {}
    try:
        return res.json()
    except ValueError:
        return {}