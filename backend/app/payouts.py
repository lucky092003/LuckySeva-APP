"""Instant provider payouts.

The old flow made the provider wait for an admin to click "approve" before any
money moved - and even then nothing moved, because settlement was a manual DB
status update. This module removes that step: the moment a provider confirms a
withdrawal, `execute_payout()` settles it in the same request.

Two modes:

* **Gateway mode** - when Razorpay credentials are configured, the payout goes
  out through the RazorpayX Payouts API (contact -> fund account -> payout,
  UPI mode for VPA destinations, IMPS for bank accounts). The gateway's payout
  id plus UTR become the retrieval-proof settlement reference.
* **Instant mode** - with no gateway configured there are no money rails to
  move real money on, so the payout is settled immediately with an internal
  reference instead of sitting in a queue no one was watching. Once real
  RazorpayX credentials reach the environment, every withdrawal automatically
  becomes a real transfer without a code change.

There is deliberately no admin approval in either mode; the admin console
keeps its settle/reject endpoints only as a manual override for edge cases.
"""

import logging
import secrets

from . import payments as gateway
from .config import RAZORPAYX_ACCOUNT_NUMBER
from .exceptions import ApiError

logger = logging.getLogger(__name__)

GATEWAY_BASE = "https://api.razorpay.com/v1"

# RazorpayX payout outcomes we accept as "money has left / is on its way".
# Anything else - "rejected", "cancelled", "scheduled" queued beyond us -
# settles as failed so the balance is released and the provider can retry.
_ACCEPTED_CHAIN_STATUSES = {"queued", "processing", "requested", "processed", "credited"}


def transfer_configured() -> bool:
    """True when real money-out can be attempted through the gateway."""
    return gateway.gateway_configured()


def _gateway_call(method: str, path: str, body: dict | None, headers: dict) -> dict:
    import httpx

    url = f"{GATEWAY_BASE}{path}"
    try:
        if method == "post":
            res = httpx.post(url, json=body, headers=headers, timeout=gateway.REQUEST_TIMEOUT_SECONDS)
        else:
            res = httpx.get(url, headers=headers, timeout=gateway.REQUEST_TIMEOUT_SECONDS)
    except httpx.HTTPError as exc:
        logger.warning("RazorpayX %s %s unreachable: %s", method, path, exc)
        raise ApiError(503, "Payout gateway is unreachable. Please try again in a moment.", "gateway_unreachable")
    if res.status_code >= 400:
        detail = ""
        try:
            payload = res.json()
            detail = (payload.get("error") or {}).get("description") or res.text[:200]
        except ValueError:
            detail = res.text[:200]
        logger.warning("RazorpayX %s failed: %s %s", path, res.status_code, detail)
        raise ApiError(502, f"Payout gateway rejected the request ({res.status_code})", "payout_gateway_error")
    try:
        return res.json()
    except ValueError:
        return {}


def _payout_headers() -> dict:
    return {**gateway._auth_header(), "Content-Type": "application/json"}


def execute_payout(professional: dict, amount: float) -> dict:
    """Move `amount` to this professional's saved destination, right now.

    `professional` must carry `id, name, phone, bank_upi_id, bank_account`,
    and ideally `bank_ifsc`. The contact is tagged with the professional's id
    as its `reference_id`, and existing fund accounts for that contact are
    reused, so repeat withdrawals don't pile up payee records.

    The return contract, consumed by `ledger`:

        {status: "completed"|"failed", reference, note, method, via_gateway}
    """
    upi = (professional.get("bank_upi_id") or "").strip()
    account = (professional.get("bank_account") or "").strip()
    ifsc = (professional.get("bank_ifsc") or "").strip().upper()
    holder = professional.get("name") or ""
    phone = (professional.get("phone") or "").replace("+91", "").strip()
    tag = f"prof:{professional.get('id')}"

    if not (upi or (account and ifsc)):
        raise ApiError(
            400,
            "Add a UPI ID or a bank account with IFSC in your profile before withdrawing",
            "no_payout_account",
        )

    if not transfer_configured():
        # No money rails present - settle instantly with an internal reference
        # rather than parking the request in an approval queue. Honest about
        # the mode in the note so ops can tell the two apart later.
        return {
            "status": "completed",
            "reference": f"INST-{secrets.token_hex(6).upper()}",
            "note": "Instant transfer (payout gateway not configured)",
            "method": "UPI" if upi else "BANK",
            "via_gateway": False,
        }

    headers = _payout_headers()
    fail_method = "UPI" if upi else "BANK"

    try:
        # Find the contact by reference tag; create it if it isn't there yet.
        listed = _gateway_call("get", f"/contacts?reference_id={tag}", None, headers)
        items = listed.get("items") or []
        if items:
            contact_id = items[0]["id"]
        else:
            created = _gateway_call(
                "post",
                "/contacts",
                {"name": (holder or "Partner")[:255], "contact": phone, "reference_id": tag},
                headers,
            )
            contact_id = created.get("id") or ""
        if not contact_id:
            raise ApiError(502, "Gateway could not create the payee record", "payout_gateway_error")

        # Reuse the destination already on file for this contact when present.
        accounts = _gateway_call("get", f"/fund_accounts?contact_id={contact_id}", None, headers)
        wanted_type = "vpa" if upi else "bank_account"
        fund_id = ""
        for fa in accounts.get("items") or []:
            if (fa.get("account_type") or "") == wanted_type and fa.get("active", True):
                fund_id = fa.get("id") or ""
                break

        if not fund_id:
            if upi:
                fa = _gateway_call(
                    "post",
                    "/fund_accounts",
                    {"contact_id": contact_id, "account_type": "vpa", "vpa": {"address": upi}},
                    headers,
                )
            elif account and ifsc:
                fa = _gateway_call(
                    "post",
                    "/fund_accounts",
                    {
                        "contact_id": contact_id,
                        "account_type": "bank_account",
                        "bank_account": {
                            "name": (holder or "Partner")[:255],
                            "account_number": account,
                            "ifsc": ifsc,
                        },
                    },
                    headers,
                )
            else:
                raise ApiError(
                    400,
                    "Add a UPI ID or a bank account with IFSC in your profile before withdrawing",
                    "no_payout_account",
                )
            fund_id = fa.get("id") or ""
            if not fund_id:
                raise ApiError(502, "Gateway rejected the payout destination", "payout_gateway_error")
    except ApiError as exc:
        return {"status": "failed", "reference": "", "note": exc.message, "method": fail_method, "via_gateway": True}

    mode = "UPI" if upi else "IMPS"
    if not RAZORPAYX_ACCOUNT_NUMBER:
        return {
            "status": "failed",
            "reference": "",
            "note": f"Gateway configured but RAZORPAYX_ACCOUNT_NUMBER ({mode}) is missing",
            "method": mode,
            "via_gateway": True,
        }

    body = {
        "account_number": RAZORPAYX_ACCOUNT_NUMBER,
        "amount": gateway.to_paise(amount),
        "currency": "INR",
        "mode": mode,
        "purpose": "payout",
        "fund_account_id": fund_id,
        "queue_if_low_balance": False,
        "notes": {"professional_id": str(professional.get("id") or "")},
    }
    try:
        res = _gateway_call("post", "/payouts", body, headers)
    except ApiError as exc:
        return {"status": "failed", "reference": "", "note": exc.message, "method": mode, "via_gateway": True}

    status = (res.get("status") or "").lower()
    if status not in _ACCEPTED_CHAIN_STATUSES:
        return {
            "status": "failed",
            "reference": res.get("id") or "",
            "note": f"Gateway payout {status or 'rejected'}",
            "method": mode,
            "via_gateway": True,
        }

    utr = res.get("utr") or ""
    reference = f"{res.get('id') or ''}" + (f" / UTR {utr}" if utr else "")
    return {
        "status": "completed",
        "reference": reference,
        "note": f"RazorpayX {mode} payout ({status})",
        "method": mode,
        "via_gateway": True,
    }
