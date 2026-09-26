import re
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends

from ..db import db, one
from ..dependencies import require_provider
from ..exceptions import ApiError

router = APIRouter(dependencies=[Depends(require_provider)])

KYC_DOC_TYPES = {"aadhaar", "pan", "voter", "driving"}


def provider_id(claims: dict) -> str:
    if not claims.get("professional_id"):
        raise ApiError(401, "Provider token missing professional_id")
    return claims["professional_id"]


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


@router.get("/bookings")
def feed(claims: dict = Depends(require_provider)):
    client = db()
    declined = client.table("booking_declines").select("booking_id").eq("professional_id", provider_id(claims)).execute()
    declined_ids = {row["booking_id"] for row in (declined.data or [])}
    bookings = (
        client.table("bookings").select("*").eq("status", "confirmed").order("created_at", desc=True).limit(50).execute()
    )
    feed_rows = []
    for row in bookings.data or []:
        if row.get("professional_id") == provider_id(claims):
            feed_rows.append(row)
        elif row.get("professional_id") is None and row["id"] not in declined_ids:
            feed_rows.append(row)
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
    booking = one(client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute())
    if not booking:
        raise ApiError(404, "Booking not found")
    return booking


@router.post("/bookings/{booking_id}/accept")
def accept(booking_id: str, claims: dict = Depends(require_provider)):
    client = db()
    pro = one(client.table("professionals").select("name").eq("id", provider_id(claims)).maybe_single().execute())
    pro_name = pro.get("name") if pro else None
    booking_row = one(
        client.table("bookings").select("*").eq("id", booking_id).maybe_single().execute()
    )
    if not booking_row:
        raise ApiError(404, "Booking not found")
    row = booking_row
    if row.get("status") != "confirmed":
        raise ApiError(400, f"Booking is already {row.get('status')}")
    next_values = {"status": "assigned"}
    if row.get("professional_id") != provider_id(claims):
        next_values["professional_id"] = provider_id(claims)
        next_values["professional_name"] = pro_name or "Professional"
    res = client.table("bookings").update(next_values).eq("id", booking_id).select("*").execute()
    client.table("notifications").insert(
        {
            "customer_phone": row.get("customer_phone"),
            "type": "provider",
            "title": "Provider Assigned",
            "message": f"{pro_name or 'A professional'} has accepted your {row.get('service_name')} booking.",
            "booking_id": booking_id,
            "read": False,
        }
    ).execute()
    return res.data[0]


@router.post("/bookings/{booking_id}/decline")
def decline(booking_id: str, claims: dict = Depends(require_provider)):
    client = db()
    booking_row = one(
        client.table("bookings").select("professional_id, status").eq("id", booking_id).maybe_single().execute()
    )
    if not booking_row:
        raise ApiError(404, "Booking not found")
    row = booking_row
    client.table("booking_declines").insert(
        {"booking_id": booking_id, "professional_id": provider_id(claims)}
    ).execute()
    if row.get("professional_id") == provider_id(claims):
        if row.get("status") not in {"completed", "cancelled"}:
            client.table("bookings").update(
                {"professional_id": None, "professional_name": "Auto-assign"}
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
    client = db()
    completed = (
        client.table("bookings")
        .select("total_amount, scheduled_date, created_at")
        .eq("professional_id", provider_id(claims))
        .eq("status", "completed")
        .execute()
    )
    rows = completed.data or []
    total = sum(float(r.get("total_amount") or 0) for r in rows)
    by_date: dict[str, float] = {}
    for r in rows:
        key = r.get("scheduled_date") or (r.get("created_at") or "")[:10]
        by_date[key] = by_date.get(key, 0) + float(r.get("total_amount") or 0)
    payouts = (
        client.table("payouts")
        .select("*")
        .eq("professional_id", provider_id(claims))
        .order("created_at", desc=True)
        .execute()
    )
    paid_out = sum(float(p.get("amount") or 0) for p in (payouts.data or []))
    return {
        "total_earnings": total,
        "by_date": by_date,
        "payouts": payouts.data or [],
        "available": total - paid_out,
    }


@router.post("/payouts", status_code=201)
def request_payout(body: dict, claims: dict = Depends(require_provider)):
    try:
        amount = float(body.get("amount"))
    except (TypeError, ValueError):
        raise ApiError(400, "Valid amount required")
    if amount <= 0:
        raise ApiError(400, "Valid amount required")
    client = db()
    res = (
        client.table("payouts")
        .insert({"professional_id": provider_id(claims), "amount": amount, "status": "requested"})
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not request payout")
    return res.data[0]


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