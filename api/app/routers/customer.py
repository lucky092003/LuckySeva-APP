from fastapi import APIRouter, Depends

from ..db import db
from ..dependencies import require_customer
from ..exceptions import ApiError

router = APIRouter(dependencies=[Depends(require_customer)])


def customer_phone(claims: dict) -> str:
    return claims["phone"]


@router.get("/profile")
def profile(claims: dict = Depends(require_customer)):
    client = db()
    res = client.table("profiles").select("*").eq("phone", customer_phone(claims)).maybe_single().execute()
    return res.data


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
    existing = (
        client.table("addresses")
        .select("*")
        .eq("id", address_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing.data:
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
    existing = (
        client.table("addresses")
        .select("is_default")
        .eq("id", address_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise ApiError(404, "Address not found")
    client.table("addresses").delete().eq("id", address_id).execute()
    if existing.data.get("is_default"):
        _ = (
            client.table("addresses")
            .select("id")
            .eq("customer_phone", customer_phone(claims))
            .limit(1)
            .execute()
        )
    return {"ok": True}


@router.get("/bookings")
def bookings(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("bookings")
        .select("*")
        .eq("customer_phone", customer_phone(claims))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/bookings/{booking_id}")
def booking(booking_id: str, claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise ApiError(404, "Booking not found")
    return res.data


@router.post("/bookings", status_code=201)
def create_booking(body: dict, claims: dict = Depends(require_customer)):
    client = db()
    profile = client.table("profiles").select("*").eq("phone", customer_phone(claims)).maybe_single().execute()
    service_id = body.get("service_id") if isinstance(body.get("service_id"), str) else None
    base = 0.0
    service_name = body.get("service_name", "")
    if service_id:
        svc = client.table("services").select("*").eq("id", service_id).maybe_single().execute()
        if svc.data:
            base = float(svc.data.get("starting_price") or 0)
            service_name = svc.data.get("name", service_name)

    professional_id = body.get("professional_id") if isinstance(body.get("professional_id"), str) else None
    professional_name = body.get("professional_name")
    if professional_id:
        pro = client.table("professionals").select("name").eq("id", professional_id).maybe_single().execute()
        if pro.data and pro.data.get("name"):
            professional_name = pro.data["name"]

    visit_fee = float(body.get("visit_fee") or 0)
    total = float(body.get("total_amount") or 0) or base + visit_fee
    name = profile.data.get("name") if profile.data else customer_phone(claims)

    res = (
        client.table("bookings")
        .insert(
            {
                "customer_name": name,
                "customer_phone": customer_phone(claims),
                "customer_address": body.get("customer_address", ""),
                "service_id": service_id,
                "service_name": service_name,
                "professional_id": professional_id,
                "professional_name": professional_name if isinstance(professional_name, str) else "Auto-assign",
                "scheduled_date": body.get("scheduled_date", ""),
                "scheduled_time": body.get("scheduled_time", ""),
                "notes": body.get("notes", ""),
                "base_price": base,
                "visit_fee": visit_fee,
                "total_amount": total,
                "payment_method": body.get("payment_method", "cash"),
                "status": "confirmed",
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
    client.table("notifications").insert(
        {
            "customer_phone": customer_phone(claims),
            "type": "booking",
            "title": "Booking confirmed",
            "message": f"Your {service_name} booking has been placed.",
            "booking_id": booking_row["id"],
            "read": False,
        }
    ).execute()
    return booking_row


@router.put("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, claims: dict = Depends(require_customer)):
    client = db()
    existing = (
        client.table("bookings")
        .select("status")
        .eq("id", booking_id)
        .eq("customer_phone", customer_phone(claims))
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise ApiError(404, "Booking not found")
    if existing.data["status"] == "completed":
        raise ApiError(400, "Completed bookings cannot be cancelled")
    res = (
        client.table("bookings")
        .update({"status": "cancelled"})
        .eq("id", booking_id)
        .select("*")
        .execute()
    )
    return res.data[0]


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
    existing = (
        client.table("favourites")
        .select("id")
        .eq("customer_phone", customer_phone(claims))
        .eq("professional_id", professional_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
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


@router.get("/reviews")
def my_reviews(claims: dict = Depends(require_customer)):
    client = db()
    res = (
        client.table("reviews")
        .select("*")
        .eq("customer_name", customer_phone(claims))
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("/reviews", status_code=201)
def add_review(body: dict, claims: dict = Depends(require_customer)):
    professional_id = body.get("professional_id")
    if not isinstance(professional_id, str):
        raise ApiError(400, "professional_id required")
    rating = int(body.get("rating") or 5)
    rating = max(1, min(5, rating))
    client = db()
    profile = client.table("profiles").select("name").eq("phone", customer_phone(claims)).maybe_single().execute()
    name = profile.data.get("name") if profile.data else customer_phone(claims)
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
    pro = client.table("professionals").select("rating, reviews_count").eq("id", professional_id).maybe_single().execute()
    if pro.data:
        old_count = int(pro.data.get("reviews_count") or 0)
        old_rating = float(pro.data.get("rating") or 0)
        new_count = old_count + 1
        new_rating = round(((old_rating * old_count) + rating) / new_count, 1) if new_count else rating
        client.table("professionals").update({"rating": new_rating, "reviews_count": new_count}).eq(
            "id", professional_id
        ).execute()
    return res.data[0]