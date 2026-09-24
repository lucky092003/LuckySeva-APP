from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query

from ..db import db
from ..dependencies import require_admin
from ..exceptions import ApiError

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/stats")
def stats():
    client = db()
    bookings = (
        client.table("bookings").select("*", count="exact", head=True).execute()
    )
    customers = (
        client.table("profiles").select("*", count="exact", head=True).eq("role", "customer").execute()
    )
    providers = client.table("professionals").select("*", count="exact", head=True).execute()
    reviews = client.table("reviews").select("*", count="exact", head=True).execute()

    today = date.today().isoformat()
    today_rows = (
        client.table("bookings")
        .select("total_amount")
        .gte("created_at", today)
        .execute()
    )
    revenue = sum(float(r.get("total_amount") or 0) for r in (today_rows.data or []))
    recent = (
        client.table("bookings").select("*").order("created_at", desc=True).limit(10).execute()
    )
    return {
        "bookings": bookings.count or 0,
        "customers": customers.count or 0,
        "providers": providers.count or 0,
        "reviews": reviews.count or 0,
        "today_revenue": revenue,
        "recent_bookings": recent.data or [],
    }


@router.get("/bookings")
def bookings(status: str | None = None):
    client = db()
    q = client.table("bookings").select("*").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    res = q.limit(100).execute()
    return res.data or []


@router.get("/professionals")
def professionals():
    client = db()
    res = client.table("professionals").select("*").order("created_at", desc=True).execute()
    return res.data or []


@router.get("/professionals/{professional_id}")
def professional(professional_id: str):
    client = db()
    res = (
        client.table("professionals").select("*").eq("id", professional_id).maybe_single().execute()
    )
    if not res.data:
        raise ApiError(404, "Professional not found")
    return res.data


@router.post("/professionals", status_code=201)
def create_professional(body: dict):
    name = body.get("name")
    if not isinstance(name, str):
        raise ApiError(400, "name required")
    client = db()
    res = (
        client.table("professionals")
        .insert(
            {
                "name": name,
                "category_slug": body.get("category_slug", "other"),
                "skills": body.get("skills") if isinstance(body.get("skills"), list) else [name],
                "experience_years": int(body.get("experience_years") or 1),
                "rating": float(body.get("rating") or 0),
                "reviews_count": int(body.get("reviews_count") or 0),
                "completed_jobs": int(body.get("completed_jobs") or 0),
                "starting_price": float(body.get("starting_price") or 99),
                "avatar_url": body.get("avatar_url", ""),
                "distance_km": float(body.get("distance_km") or 1),
                "status": "busy" if body.get("status") == "busy" else "available",
                "bio": body.get("bio", ""),
                "service_area": body.get("service_area", ""),
                "service_radius_km": int(body.get("service_radius_km") or 60),
                "phone": body.get("phone"),
                "email": body.get("email"),
                "latitude": body.get("latitude") if isinstance(body.get("latitude"), (int, float)) else None,
                "longitude": body.get("longitude") if isinstance(body.get("longitude"), (int, float)) else None,
            }
        )
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create professional")
    client.table("audit_logs").insert({"action": "provider_add", "detail": f"Added provider {name}"}).execute()
    return res.data[0]


@router.put("/professionals/{professional_id}")
def update_professional(professional_id: str, body: dict):
    client = db()
    existing = client.table("professionals").select("id").eq("id", professional_id).maybe_single().execute()
    if not existing.data:
        raise ApiError(404, "Professional not found")
    patch = {}
    str_fields = ["name", "category_slug", "avatar_url", "bio", "service_area", "status", "phone", "email"]
    for k in str_fields:
        if isinstance(body.get(k), str):
            patch[k] = body[k]
    if isinstance(body.get("skills"), list):
        patch["skills"] = body["skills"]
    num_fields = [
        "experience_years",
        "rating",
        "starting_price",
        "distance_km",
        "service_radius_km",
        "reviews_count",
        "completed_jobs",
    ]
    for k in num_fields:
        if isinstance(body.get(k), (int, float)):
            patch[k] = body[k]
    res = client.table("professionals").update(patch).eq("id", professional_id).select("*").execute()
    return res.data[0]


@router.delete("/professionals/{professional_id}")
def delete_professional(professional_id: str):
    client = db()
    client.table("professionals").delete().eq("id", professional_id).execute()
    client.table("audit_logs").insert(
        {"action": "provider_delete", "detail": f"Deleted provider {professional_id}"}
    ).execute()
    return {"ok": True}


@router.put("/kyc/{professional_id}")
def review_kyc(professional_id: str, body: dict):
    decision = body.get("decision")
    if decision not in {"approved", "rejected"}:
        raise ApiError(400, "decision must be approved or rejected")
    client = db()
    existing = (
        client.table("professionals")
        .select("id, name")
        .eq("id", professional_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise ApiError(404, "Professional not found")
    note = body.get("note")
    res = (
        client.table("professionals")
        .update(
            {
                "kyc_status": decision,
                "kyc_review_note": note if isinstance(note, str) and note.strip() else None,
                "kyc_reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", professional_id)
        .select("*")
        .execute()
    )
    client.table("audit_logs").insert(
        {
            "action": "provider_kyc",
            "detail": f"{decision} KYC for {existing.data['name']}",
        }
    ).execute()
    return res.data[0]


@router.get("/categories")
def categories():
    client = db()
    res = client.table("categories").select("*").order("sort_order").execute()
    return res.data or []


@router.post("/categories", status_code=201)
def create_category(body: dict):
    name = body.get("name")
    slug = body.get("slug")
    if not isinstance(name, str) or not isinstance(slug, str):
        raise ApiError(400, "name and slug required")
    client = db()
    res = (
        client.table("categories")
        .insert(
            {
                "name": name,
                "slug": slug,
                "icon": body.get("icon", "MoreHorizontal"),
                "color": body.get("color", "#64748b"),
                "description": body.get("description", ""),
                "sort_order": int(body.get("sort_order") or 0),
            }
        )
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create category")
    return res.data[0]


@router.get("/services")
def services():
    client = db()
    res = client.table("services").select("*").order("name").execute()
    return res.data or []


@router.post("/services", status_code=201)
def create_service(body: dict):
    client = db()
    category_slug = body.get("category_slug", "")
    cat = client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute()
    if not cat.data:
        raise ApiError(400, "category_slug must reference an existing category")
    res = (
        client.table("services")
        .insert(
            {
                "category_id": cat.data["id"],
                "name": body.get("name", "New service"),
                "description": body.get("description", ""),
                "starting_price": float(body.get("starting_price") or 0),
                "estimated_duration": body.get("estimated_duration", ""),
                "popular": body.get("popular") is True,
            }
        )
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create service")
    client.table("audit_logs").insert(
        {"action": "service_add", "detail": f"Added service {res.data[0]['name']}"}
    ).execute()
    return res.data[0]


@router.put("/services/{service_id}")
def update_service(service_id: str, body: dict):
    client = db()
    patch = {}
    for k in ("name", "description", "estimated_duration"):
        if isinstance(body.get(k), str):
            patch[k] = body[k]
    if isinstance(body.get("starting_price"), (int, float)):
        patch["starting_price"] = body["starting_price"]
    if isinstance(body.get("popular"), bool):
        patch["popular"] = body["popular"]
    res = client.table("services").update(patch).eq("id", service_id).select("*").execute()
    if not res.data:
        raise ApiError(404, "Service not found")
    return res.data[0]


@router.delete("/services/{service_id}")
def delete_service(service_id: str):
    client = db()
    client.table("services").delete().eq("id", service_id).execute()
    return {"ok": True}


@router.get("/settings")
def settings():
    client = db()
    res = client.table("admin_settings").select("*").execute()
    return {row["key"]: row["value"] for row in (res.data or [])}


@router.post("/settings")
def set_setting(body: dict):
    key = body.get("key")
    value = body.get("value")
    if not isinstance(key, str):
        raise ApiError(400, "key required")
    client = db()
    res = (
        client.table("admin_settings")
        .upsert({"key": key, "value": value if isinstance(value, str) else ""}, on_conflict="key")
        .select("*")
        .execute()
    )
    return res.data[0]


@router.get("/audit-logs")
def audit_logs(limit: int = Query(default=50, le=200)):
    client = db()
    res = (
        client.table("audit_logs").select("*").order("created_at", desc=True).limit(limit).execute()
    )
    return res.data or []


@router.post("/audit-logs", status_code=201)
def create_audit_log(body: dict):
    action = body.get("action")
    if not isinstance(action, str) or not action.strip():
        raise ApiError(400, "action required")
    client = db()
    res = (
        client.table("audit_logs")
        .insert({"action": action.strip(), "detail": body.get("detail") if isinstance(body.get("detail"), str) else ""})
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not create audit log")
    return res.data[0]