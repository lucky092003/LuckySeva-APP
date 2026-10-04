import re
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends

from .. import ledger
from ..db import db, one
from ..dependencies import require_provider
from ..events import insert_notification, now_iso, sweep_expired_requests
from ..exceptions import ApiError
from ..links import set_professional_services, set_professional_trade
from ..pricing import round2

router = APIRouter(dependencies=[Depends(require_provider)])

KYC_DOC_TYPES = {"aadhaar", "pan", "voter", "driving"}


def provider_id(claims: dict) -> str:
    if not claims.get("professional_id"):
        raise ApiError(401, "Provider token missing professional_id")
    return claims["professional_id"]


def _fresh_deadline(client) -> str:
    from ..events import new_accept_deadline

    return new_accept_deadline(client)


def _phone_visible(row: dict, claims: dict) -> bool:
    """Customer contact is released only once this professional owns the job.

    The `confirmed` feed is shared by every provider in the radius, so handing
    out the number there lets any provider farm leads instead of taking jobs.
    """
    return row.get("professional_id") == provider_id(claims) or row.get("status") != "confirmed"


def _hide_phone(row: dict, claims: dict) -> dict:
    if _phone_visible(row, claims):
        return row
    return {**row, "customer_phone": ""}


def _unembed(row: dict) -> dict:
    """Drop the `service:services(...)` join the field filter needed."""
    return {k: v for k, v in row.items() if k != "service"}


def _category_services(client, category_id: str) -> list[dict]:
    """Every service in a trade, so the picker shows what can be switched on.

    Same `order("name")` the customer-facing service list uses, so a provider
    scans the same labels a customer will.
    """
    res = (
        client.table("services")
        .select("*")
        .eq("category_id", category_id)
        .order("name")
        .execute()
    )
    return res.data or []


def _field_filter(client, claims: dict):
    """Predicate: is this request work the caller actually takes?

    Radius alone is far too wide: every provider in town saw an electrician's
    booking, an AC booking, a beauty booking — all of it. A request belongs to
    the professionals who offer that exact service, which `links.py` seeds as
    the whole category and `PUT /provider/services` then narrows to the
    provider's own selection. Bookings the customer created for this
    professional in person are always theirs.
    """
    pid = provider_id(claims)
    pro = one(client.table("professionals").select("category_slug").eq("id", pid).maybe_single().execute())
    slug = (pro or {}).get("category_slug") or ""
    linked = (
        client.table("professional_services")
        .select("service_id")
        .eq("professional_id", pid)
        .execute()
    )
    service_ids = {r.get("service_id") for r in (linked.data or []) if r.get("service_id")}
    if service_ids:
        # The selection is authoritative: turning a service off must stop its
        # requests arriving, even though the category still matches.
        def in_my_field(row: dict) -> bool:
            if row.get("professional_id") == pid:
                return True
            return bool(row.get("service_id")) and row["service_id"] in service_ids

        return in_my_field

    slug_by_category = {
        c["id"]: c["slug"]
        for c in (client.table("categories").select("id, slug").execute().data or [])
        if c.get("id")
    }
    # No links at all (legacy row): fall back to the trade so they still get work.
    # No category either means nothing to match on — show the feed, not a void.
    if not slug:
        return lambda row: True

    def in_my_category(row: dict) -> bool:
        if row.get("professional_id") == pid:
            return True
        category_id = (row.get("service") or {}).get("category_id")
        return bool(category_id) and slug_by_category.get(category_id) == slug

    return in_my_category


@router.get("/me")
def me(claims: dict = Depends(require_provider)):
    client = db()
    professional = one(
        client.table("professionals").select("*").eq("id", provider_id(claims)).maybe_single().execute()
    )
    if not professional:
        raise ApiError(404, "Professional profile not found")
    services = (
        client.table("professional_services")
        .select("*, service:services(*)")
        .eq("professional_id", provider_id(claims))
        .execute()
    )
    return {"professional": professional, "services": services.data or []}


@router.put("/me")
def update_me(body: dict, claims: dict = Depends(require_provider)):
    patch = {}
    if body.get("status") in {"available", "busy"}:
        patch["status"] = body["status"]
    if isinstance(body.get("starting_price"), (int, float, str)):
        patch["starting_price"] = float(body["starting_price"] or 0)
    if isinstance(body.get("service_radius_km"), (int, float, str)):
        patch["service_radius_km"] = int(float(body["service_radius_km"] or 0))
    if isinstance(body.get("bio"), str):
        patch["bio"] = body["bio"]
    if isinstance(body.get("service_area"), str):
        patch["service_area"] = body["service_area"]
    if isinstance(body.get("latitude"), (int, float)):
        patch["latitude"] = body["latitude"]
    if isinstance(body.get("longitude"), (int, float)):
        patch["longitude"] = body["longitude"]
    if isinstance(body.get("name"), str) and body["name"].strip():
        patch["name"] = body["name"].strip()
    if not patch:
        raise ApiError(400, "Nothing to update")
    client = db()
    res = client.table("professionals").update(patch).eq("id", provider_id(claims)).select("*").execute()
    if not res.data:
        raise ApiError(404, "Professional not found")
    return res.data[0]


@router.get("/services")
def my_services(claims: dict = Depends(require_provider)):
    """The provider's whole category, flagged with what they currently offer."""
    client = db()
    pro = one(
        client.table("professionals")
        .select("id, category_slug")
        .eq("id", provider_id(claims))
        .maybe_single()
        .execute()
    )
    if not pro:
        raise ApiError(404, "Professional profile not found")
    slug = pro.get("category_slug") or ""
    cat = one(client.table("categories").select("id").eq("slug", slug).maybe_single().execute())
    services = _category_services(client, cat["id"]) if cat else []
    offered = {
        r.get("service_id")
        for r in (
            client.table("professional_services")
            .select("service_id")
            .eq("professional_id", pro["id"])
            .execute()
        ).data
        or []
    }
    return {
        "category_slug": pro.get("category_slug") or "",
        "services": [{**s, "offered": s["id"] in offered} for s in (services or [])],
    }


@router.put("/trade")
def update_trade(body: dict, claims: dict = Depends(require_provider)):
    """Let a professional set their own trade, so the picker is never admin-gated."""
    slug = body.get("category_slug")
    if not isinstance(slug, str):
        raise ApiError(400, "category_slug must be a string")
    pro = one(
        db()
        .table("professionals")
        .select("id")
        .eq("id", provider_id(claims))
        .maybe_single()
        .execute()
    )
    if not pro:
        raise ApiError(404, "Professional not found")
    return set_professional_trade(pro["id"], slug)


@router.put("/services")
def update_services(body: dict, claims: dict = Depends(require_provider)):
    """Narrow the auto-linked whole category down to what the provider offers."""
    raw = body.get("service_ids")
    if not isinstance(raw, list) or any(not isinstance(s, str) for s in raw):
        raise ApiError(400, "service_ids must be a list of service ids")
    pro = one(
        db()
        .table("professionals")
        .select("id, category_slug")
        .eq("id", provider_id(claims))
        .maybe_single()
        .execute()
    )
    if not pro:
        raise ApiError(404, "Professional profile not found")
    return set_professional_services(pro["id"], pro.get("category_slug"), raw)


@router.put("/kyc")
def submit_kyc(body: dict, claims: dict = Depends(require_provider)):
    client = db()
    existing = one(
        client.table("professionals")
        .select("id, kyc_status")
        .eq("id", provider_id(claims))
        .maybe_single()
        .execute()
    )
    if not existing:
        raise ApiError(404, "Professional not found")
    doc_type = body.get("doc_type")
    doc_number = body.get("doc_number")
    if not isinstance(doc_type, str) or doc_type not in KYC_DOC_TYPES:
        raise ApiError(400, "doc_type must be one of aadhaar, pan, voter, driving")
    if not isinstance(doc_number, str) or not re.search(r"[A-Za-z0-9]{6,}", doc_number):
        raise ApiError(400, "Valid document number required (min 6 characters)")
    res = (
        client.table("professionals")
        .update(
            {
                "kyc_status": "pending",
                "kyc_doc_type": doc_type,
                "kyc_doc_number": doc_number.strip().upper(),
                "kyc_review_note": None,
                "kyc_submitted_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", provider_id(claims))
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not submit KYC")
    return res.data[0]


@router.put("/availability")
def set_availability(body: dict, claims: dict = Depends(require_provider)):
    """The on/off switch that decides whether new requests reach this provider.

    Separate from the legacy `status` field because `status` only drives how the
    profile is *labelled*. This one actually gates the feed and rejects accepts,
    so a provider who switches off genuinely stops being interrupted.
    """
    if body.get("accepting_jobs") is not None:
        accepting = body["accepting_jobs"]
        if not isinstance(accepting, bool):
            raise ApiError(400, "accepting_jobs must be true or false")
    else:
        accepting = not bool(body.get("value"))
    res = (
        db().table("professionals")
        .update({"accepting_jobs": accepting, "last_seen_at": now_iso()})
        .eq("id", provider_id(claims))
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(404, "Professional not found")
    return res.data[0]


@router.post("/heartbeat")
def heartbeat(claims: dict = Depends(require_provider)):
    """Stamped by the provider app on load and on every feed poll.

    Drives the "Active now" badge and is the liveness signal for pushing a new
    job, so a provider who closed the app is not pinged for a request they will
    only see hours later.
    """
    res = (
        db().table("professionals")
        .update({"last_seen_at": now_iso()})
        .eq("id", provider_id(claims))
        .select("id, last_seen_at")
        .execute()
    )
    if not res.data:
        raise ApiError(404, "Professional not found")
    return res.data[0]


@router.post("/device-token")
def register_device_token(body: dict, claims: dict = Depends(require_provider)):
    token = body.get("token")
    if not isinstance(token, str) or len(token.strip()) < 20:
        raise ApiError(400, "A valid push token is required")
    platform = body.get("platform") if isinstance(body.get("platform"), str) else "web"
    res = (
        db().table("device_tokens")
        .upsert(
            {
                "role": "provider",
                "owner_id": provider_id(claims),
                "token": token.strip(),
                "platform": platform,
                "last_seen_at": now_iso(),
            },
            on_conflict="token",
        )
        .execute()
    )
    return {"registered": bool(res.data is not None)}


@router.put("/payout-account")
def set_payout_account(body: dict, claims: dict = Depends(require_provider)):
    """Where settlements should be sent. Recorded for admin to verify."""
    patch = {}
    upi = body.get("upi_id")
    bank = body.get("bank_account")
    if isinstance(upi, str):
        if upi.strip() and "@" not in upi.strip():
            raise ApiError(400, "That does not look like a UPI ID (it needs an @)")
        patch["bank_upi_id"] = upi.strip() or None
    if isinstance(bank, str):
        patch["bank_account"] = bank.strip() or None
    if not patch:
        raise ApiError(400, "Nothing to update")
    res = (
        db().table("professionals")
        .update(patch)
        .eq("id", provider_id(claims))
        .select("id, bank_upi_id, bank_account")
        .execute()
    )
    if not res.data:
        raise ApiError(404, "Professional not found")
    return res.data[0]


@router.get("/bookings")
def feed(claims: dict = Depends(require_provider)):
    client = db()
    # Lapse anything that timed out before deciding what this provider can see,
    # so an expired request never shows as accept-able and then 400s on accept.
    sweep_expired_requests(client)

    declined = client.table("booking_declines").select("booking_id").eq("professional_id", provider_id(claims)).execute()
    declined_ids = {row["booking_id"] for row in (declined.data or [])}
    in_my_field = _field_filter(client, claims)
    bookings = (
        client.table("bookings")
        .select("*, service:services(category_id)")
        .eq("status", "confirmed")
    )
    if hasattr(bookings, "is_"):
        bookings = bookings.is_("accept_expired_at", None)
    bookings = (
        bookings.order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    feed_rows = []
    for row in bookings.data or []:
        if row.get("professional_id") == provider_id(claims):
            feed_rows.append(_hide_phone(_unembed(row), claims))
        elif row.get("professional_id") is None and row["id"] not in declined_ids and in_my_field(row):
            feed_rows.append(_hide_phone(_unembed(row), claims))
    return feed_rows[:30]


@router.get("/bookings/mine")
def my_bookings(claims: dict = Depends(require_provider)):
    client = db()
    res = (
        client.table("bookings")
        .select("*")
        .eq("professional_id", provider_id(claims))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/bookings/{booking_id}")
def booking(booking_id: str, claims: dict = Depends(require_provider)):
    client = db()
    row = one(
        client.table("bookings")
        .select("*, service:services(category_id)")
        .eq("id", booking_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise ApiError(404, "Booking not found")
    # 404, not 403: a provider outside this field should not learn the booking exists.
    if row.get("professional_id") != provider_id(claims) and not _field_filter(client, claims)(row):
        raise ApiError(404, "Booking not found")
    return _hide_phone(_unembed(row), claims)


@router.post("/bookings/{booking_id}/accept")
def accept(booking_id: str, claims: dict = Depends(require_provider)):
    client = db()
    pid = provider_id(claims)
    pro = one(
        client.table("professionals")
        .select("name, accepting_jobs")
        .eq("id", pid)
        .maybe_single()
        .execute()
    )
    if not pro:
        raise ApiError(404, "Professional profile not found")
    if pro.get("accepting_jobs") is not True:
        raise ApiError(400, "Turn on 'Accept new requests' to take this job", "provider_offline")

    booking_row = one(
        client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute()
    )
    if not booking_row:
        raise ApiError(404, "Booking not found")
    row = booking_row

    # Already gone by the time the button was pressed: tell the truth rather than
    # handing out work the customer has been told has lapsed.
    if row.get("accept_expired_at"):
        raise ApiError(410, "This request has expired and is no longer available", "request_expired")
    if row.get("status") != "confirmed":
        raise ApiError(400, f"Booking is already {row.get('status')}")

    pro_name = pro.get("name")
    next_values = {"status": "assigned"}
    if row.get("professional_id") != pid:
        next_values["professional_id"] = pid
        next_values["professional_name"] = pro_name or "Professional"
    # Claiming it is the answer; stop the expiry sweep from lapsing it later.
    next_values["accept_expired_at"] = row.get("accept_expired_at") or None
    res = client.table("bookings").update(next_values).eq("id", booking_id).select("*").execute()
    if not res.data:
        # Lost the race: another provider accepted between our read and write.
        raise ApiError(409, "Someone else took this job", "already_taken")
    client.table("professionals").update({"last_seen_at": now_iso()}).eq("id", pid).execute()
    insert_notification(
        row.get("customer_phone"),
        "provider",
        "Provider Assigned",
        f"{pro_name or 'A professional'} has accepted your {row.get('service_name')} booking.",
        booking_id,
    )
    return res.data[0]


@router.post("/bookings/{booking_id}/decline")
def decline(booking_id: str, claims: dict = Depends(require_provider)):
    client = db()
    booking_row = one(
        client.table("bookings").select("professional_id, status, decline_count").eq("id", booking_id).maybe_single().execute()
    )
    if not booking_row:
        raise ApiError(404, "Booking not found")
    row = booking_row
    # Declining twice would double-count and wrongly report "3 declined" for one
    # provider, so make the insert idempotent on the pair.
    client.table("booking_declines").upsert(
        {"booking_id": booking_id, "professional_id": provider_id(claims)}, on_conflict="booking_id,professional_id"
    ).execute()
    if row.get("professional_id") != provider_id(claims):
        client.table("bookings").update(
            {"decline_count": int(row.get("decline_count") or 0) + 1}
        ).eq("id", booking_id).execute()
    if row.get("professional_id") == provider_id(claims):
        if row.get("status") not in {"completed", "cancelled"}:
            client.table("bookings").update(
                {
                    "professional_id": None,
                    "professional_name": "Auto-assign",
                    "status": "confirmed",
                    # Released back to the pool with a fresh window.
                    "accept_deadline": _fresh_deadline(client),
                    "accept_expired_at": None,
                }
            ).eq("id", booking_id).execute()
    return {"ok": True}


@router.put("/bookings/{booking_id}/status")
def update_status(booking_id: str, body: dict, claims: dict = Depends(require_provider)):
    VALID = {"assigned", "on_the_way", "started", "completed", "cancelled"}
    status = body.get("status")
    if status not in VALID:
        raise ApiError(400, f"status must be one of {', '.join(sorted(VALID))}")
    client = db()
    booking_row = one(
        client.table("bookings")
        .select("professional_id, status, customer_phone, service_name")
        .eq("id", booking_id)
        .maybe_single()
        .execute()
    )
    if not booking_row:
        raise ApiError(404, "Booking not found")
    if booking_row.get("professional_id") != provider_id(claims):
        raise ApiError(403, "Not your booking")
    res = client.table("bookings").update({"status": status}).eq("id", booking_id).select("*").execute()
    if status == "completed":
        pro = one(
            client.table("professionals")
            .select("completed_jobs")
            .eq("id", provider_id(claims))
            .maybe_single()
            .execute()
        )
        jobs = int(pro.get("completed_jobs") or 0) if pro else 0
        client.table("professionals").update({"completed_jobs": jobs + 1}).eq(
            "id", provider_id(claims)
        ).execute()
    customer_phone = booking_row.get("customer_phone")
    if status == "on_the_way" and customer_phone:
        client.table("notifications").insert(
            {
                "customer_phone": customer_phone,
                "type": "provider",
                "title": "Provider On The Way",
                "message": "Your service provider is on the way to your location.",
                "booking_id": booking_id,
                "read": False,
            }
        ).execute()
    if status == "completed" and customer_phone:
        client.table("notifications").insert(
            {
                "customer_phone": customer_phone,
                "type": "review",
                "title": "Service Completed",
                "message": "Your service is complete. Please leave a review.",
                "booking_id": booking_id,
                "read": False,
            }
        ).execute()
    return res.data[0]


@router.get("/earnings")
def earnings(claims: dict = Depends(require_provider)):
    """What this professional has earned, and how much of it is withdrawable.

    Figures are `provider_earnings` (the total less the platform's commission),
    not `total_amount`, so a professional is never shown money that belongs to
    the platform.
    """
    client = db()
    pid = provider_id(claims)
    completed = (
        client.table("bookings")
        .select("provider_earnings, total_amount, scheduled_date, created_at, service_name")
        .eq("professional_id", pid)
        .eq("status", "completed")
        .execute()
    )
    rows = completed.data or []

    def net(row: dict) -> float:
        value = row.get("provider_earnings")
        return float(value) if value is not None else float(row.get("total_amount") or 0)

    total = round2(sum(net(r) for r in rows))
    by_date: dict[str, float] = {}
    for r in rows:
        key = r.get("scheduled_date") or (r.get("created_at") or "")[:10]
        by_date[key] = round2(by_date.get(key, 0) + net(r))
    payouts = (
        client.table("payouts")
        .select("*")
        .eq("professional_id", pid)
        .order("created_at", desc=True)
        .execute()
    )
    balance = ledger.provider_balance(client, pid)
    return {
        "total_earnings": total,
        "by_date": by_date,
        "payouts": payouts.data or [],
        "available": balance["available"],
        "on_hold": balance["on_hold"],
        "settled": balance["settled"],
        "payout_minimum": balance["payout_minimum"],
        "gross_earnings": round2(sum(float(r.get("total_amount") or 0) for r in rows)),
    }


@router.get("/earnings/daily")
def earnings_daily(claims: dict = Depends(require_provider)):
    """Per-day net earnings for the provider's chart."""
    client = db()
    rows = (
        client.table("bookings")
        .select("scheduled_date, created_at, provider_earnings, total_amount")
        .eq("professional_id", provider_id(claims))
        .eq("status", "completed")
        .execute()
    ).data or []
    by_date: dict[str, float] = {}
    for r in rows:
        key = r.get("scheduled_date") or (r.get("created_at") or "")[:10]
        value = r.get("provider_earnings")
        net = float(value) if value is not None else float(r.get("total_amount") or 0)
        by_date[key] = round2(by_date.get(key, 0) + net)
    return [
        {"date": k, "amount": v}
        for k, v in sorted(by_date.items(), reverse=True)[:30]
    ]


@router.get("/payouts")
def payouts(claims: dict = Depends(require_provider)):
    client = db()
    res = (
        client.table("payouts")
        .select("*")
        .eq("professional_id", provider_id(claims))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/payouts", status_code=201)
def request_payout(body: dict, claims: dict = Depends(require_provider)):
    try:
        amount = float(body.get("amount"))
    except (TypeError, ValueError):
        raise ApiError(400, "Valid amount required")
    if amount <= 0:
        raise ApiError(400, "Valid amount required")
    return ledger.create_payout(db(), provider_id(claims), amount)


@router.post("/payouts/{payout_id}/cancel")
def cancel_payout(payout_id: str, claims: dict = Depends(require_provider)):
    """Withdraw a request that has not been paid out yet."""
    client = db()
    existing = one(
        client.table("payouts").select("*").eq("id", payout_id).maybe_single().execute()
    )
    if not existing:
        raise ApiError(404, "Payout not found")
    if existing.get("professional_id") != provider_id(claims):
        raise ApiError(403, "Not your payout")
    if existing.get("status") != "requested":
        raise ApiError(400, f"Payout is already {existing.get('status')}")
    return ledger.settle_payout(payout_id, status="cancelled", note="Cancelled by provider")


@router.get("/dashboard")
def dashboard(claims: dict = Depends(require_provider)):
    client = db()
    mine = client.table("bookings").select("status, total_amount, created_at").eq("professional_id", provider_id(claims)).execute()
    rows = mine.data or []
    active = sum(1 for r in rows if r.get("status") in {"assigned", "on_the_way", "started"})
    completed = [r for r in rows if r.get("status") == "completed"]
    today = date.today().isoformat()
    today_earnings = sum(
        float(r.get("total_amount") or 0) for r in completed if (r.get("created_at") or "")[:10] == today
    )
    total_earnings = sum(float(r.get("total_amount") or 0) for r in completed)
    return {
        "active": active,
        "completed_jobs": len(completed),
        "today_earnings": today_earnings,
        "total_earnings": total_earnings,
    }