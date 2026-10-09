from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query

from .. import ledger
from ..db import db, one
from ..dependencies import require_admin
from ..exceptions import ApiError
from ..links import cheapest_in_category, link_professional_to_category, relink_professional
from ..pricing import compute_split, round2
from ..push import notify

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
        **revenue_summary(client),
    }


@router.get("/notifications")
def admin_notifications(status: str | None = None):
    client = db()
    q = (
        client.table("notifications")
        .select("*")
        .order("created_at", desc=True)
    )
    if status == "unread":
        q = q.eq("read", False)
    elif status == "read":
        q = q.eq("read", True)
    return q.limit(200).execute().data or []


@router.get("/revenue")
def revenue_summary_endpoint(days: int = Query(default=30, le=365)):
    """The number that actually matters: platform fee collected, not GMV.

    GMV includes the professional's own share, so reporting it as "revenue" was
    overstating earnings roughly tenfold. `platform_fee` is what LuckySeva kept.
    """
    return revenue_summary(db())


def revenue_summary(client) -> dict:
    rows = (
        client.table("bookings")
        .select("total_amount, platform_fee, provider_earnings, discount_amount, coupon_code, commission_pct, status, created_at")
        .execute()
    ).data or []

    gmv = round2(sum(float(r.get("total_amount") or 0) for r in rows))
    fee = round2(sum(float(r.get("platform_fee") or 0) for r in rows))
    # Discounts are a cost to the platform when the coupon is funded by us.
    discount = round2(sum(float(r.get("discount_amount") or 0) for r in rows))
    provider_owed = round2(sum(float(r.get("provider_earnings") or 0) for r in rows))
    collected = round2(
        sum(float(r.get("total_amount") or 0) for r in rows if r.get("payment_status") in {"paid", "partially_refunded"})
    )
    refunded = round2(sum(float(r.get("refund_amount") or 0) for r in rows))

    by_day: dict[str, dict] = {}
    for r in rows:
        key = (r.get("created_at") or "")[:10]
        if not key:
            continue
        bucket = by_day.setdefault(key, {"date": key, "gmv": 0.0, "platform_fee": 0.0, "bookings": 0})
        bucket["gmv"] = round2(bucket["gmv"] + float(r.get("total_amount") or 0))
        bucket["platform_fee"] = round2(bucket["platform_fee"] + float(r.get("platform_fee") or 0))
        bucket["bookings"] += 1

    return {
        "gmv": gmv,
        "platform_fee_total": fee,
        "discount_given": discount,
        "provider_owed": provider_owed,
        "collected": collected,
        "refunded": refunded,
        "net_platform_earnings": round2(fee - discount),
        "effective_commission_pct": round2((fee / gmv * 100) if gmv else 0),
        "gst_pct": _float_setting(client, "platform_gst_pct", 18.0),
        "daily": sorted(by_day.values(), key=lambda d: d["date"], reverse=True)[:90],
    }


def _float_setting(client, key: str, fallback: float) -> float:
    row = one(client.table("admin_settings").select("value").eq("key", key).maybe_single().execute())
    try:
        return float(row["value"]) if row and row.get("value") not in (None, "") else fallback
    except (KeyError, TypeError, ValueError):
        return fallback


@router.get("/payouts")
def payouts(status: str | None = None):
    client = db()
    q = client.table("payouts").select("*, professional:professionals(name, phone, bank_upi_id, bank_account)").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    rows = q.limit(200).execute().data or []
    # Join the pro's current balance so the admin can see what is left after this.
    for row in rows:
        pid = row.get("professional_id")
        row["balance"] = ledger.provider_balance(client, pid) if pid else None
    return rows


@router.put("/payouts/{payout_id}")
def settle_payout(payout_id: str, body: dict):
    """Approve, mark paid, or reject a provider payout.

    Marking one paid is what actually moves money and credits the provider's
    settled total, so it demands a reference - a settlement with nothing to trace
    it by is how money goes missing quietly.
    """
    status = body.get("status")
    if status not in {"approved", "completed", "rejected"}:
        raise ApiError(400, "status must be approved, completed or rejected")
    reference = body.get("reference") if isinstance(body.get("reference"), str) else ""
    note = body.get("note") if isinstance(body.get("note"), str) else ""
    if status == "completed" and not reference.strip():
        raise ApiError(400, "Enter the UPI or bank reference for this payout")
    row = ledger.settle_payout(payout_id, status=status, reference=reference.strip(), note=note.strip())
    if row.get("professional_id"):
        messages = {
            "approved": ("Payout approved", "Your payout has been approved and is being sent."),
            "completed": ("Payout paid", f"Rs {float(row.get('amount') or 0):g} has been sent to your account."),
            "rejected": ("Payout rejected", note.strip() or "Your payout request could not be approved."),
        }
        title, body_text = messages[status]
        notify(
            "provider",
            row["professional_id"],
            title,
            body_text,
            {"payout_id": payout_id},
        )
    return row


@router.get("/refunds")
def refunds(status: str | None = None):
    client = db()
    q = client.table("refunds").select("*, booking:bookings(service_name, scheduled_date)").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.limit(200).execute().data or []


@router.put("/refunds/{refund_id}")
def resolve_refund(refund_id: str, body: dict):
    action = body.get("action")
    note = body.get("note") if isinstance(body.get("note"), str) else ""
    refund = one(db().table("refunds").select("*").eq("id", refund_id).maybe_single().execute())
    if not refund:
        raise ApiError(404, "Refund not found")
    if action == "approve":
        return ledger.approve_refund(refund, note=note)
    if action == "reject":
        return ledger.reject_refund(refund_id, note)
    raise ApiError(400, "action must be approve or reject")


@router.get("/disputes")
def disputes(status: str | None = None):
    client = db()
    q = client.table("disputes").select("*").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.limit(200).execute().data or []


@router.get("/payments")
def payments(status: str | None = None):
    client = db()
    q = client.table("payments").select("*, booking:bookings(service_name)").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.limit(200).execute().data or []


@router.get("/push-outbox")
def push_outbox(limit: int = Query(default=50, le=200)):
    client = db()
    res = client.table("push_outbox").select("*").order("created_at", desc=True).limit(limit).execute()
    return res.data or []


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
    pro = one(
        client.table("professionals").select("*").eq("id", professional_id).maybe_single().execute()
    )
    if not pro:
        raise ApiError(404, "Professional not found")
    return pro


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
                "starting_price": float(
                    body.get("starting_price") or cheapest_in_category(body.get("category_slug", "other")) or 99
                ),
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
    professional = res.data[0]
    link_professional_to_category(professional["id"], professional.get("category_slug"))
    client.table("audit_logs").insert({"action": "provider_add", "detail": f"Added provider {name}"}).execute()
    return professional


@router.put("/professionals/{professional_id}")
def update_professional(professional_id: str, body: dict):
    client = db()
    existing = one(client.table("professionals").select("id").eq("id", professional_id).maybe_single().execute())
    if not existing:
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
    if res.data and "category_slug" in patch:
        relink_professional(professional_id, patch["category_slug"])
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
    existing = one(
        client.table("professionals")
        .select("id, name")
        .eq("id", professional_id)
        .maybe_single()
        .execute()
    )
    if not existing:
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
            "detail": f"{decision} KYC for {existing['name']}",
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
                "icon": body.get("icon", "Ellipsis"),
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
    cat = one(client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute())
    if not cat:
        raise ApiError(400, "category_slug must reference an existing category")
    res = (
        client.table("services")
        .insert(
            {
                "category_id": cat["id"],
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
    """Update a platform setting. Every write is audited.

    These keys drive commission, the accept window and refund behaviour, so a
    silent change here is a silent change to what customers and partners are owed.
    """
    key = body.get("key")
    value = body.get("value")
    if not isinstance(key, str):
        raise ApiError(400, "key required")
    numeric = {
        "admin_commission_pct",
        "platform_gst_pct",
        "accept_deadline_minutes",
        "auto_refund_minutes",
        "payout_min_amount",
        "priority_fee",
        "priority_top_n",
    }
    if key in numeric:
        try:
            if float(value) < 0:
                raise ApiError(400, "Value cannot be negative")
        except (TypeError, ValueError):
            raise ApiError(400, f"{key} must be a number")
    if key == "admin_commission_pct":
        if float(value) > 50:
            raise ApiError(400, "Commission cannot exceed 50%")
    client = db()
    res = (
        client.table("admin_settings")
        .upsert({"key": key, "value": value if isinstance(value, str) else ""}, on_conflict="key")
        .select("*")
        .execute()
    )
    if not res.data:
        raise ApiError(400, "Could not save setting")
    client.table("audit_logs").insert(
        {"action": "setting_update", "detail": f"{key} set to {res.data[0]['value']}"}
    ).execute()
    return res.data[0]


# ---------------------------------------------------------------------------
# Commission per category (#5)
# ---------------------------------------------------------------------------
@router.put("/categories/{slug}/commission")
def set_category_commission(slug: str, body: dict):
    """Set the take rate for one trade, or clear it to fall back to the platform default."""
    client = db()
    existing = one(
        client.table("categories").select("id, name, commission_pct").eq("slug", slug).maybe_single().execute()
    )
    if not existing:
        raise ApiError(404, "Category not found")

    patch = {}
    if body.get("commission_pct") is None:
        patch["commission_pct"] = None
    else:
        try:
            pct = float(body["commission_pct"])
        except (TypeError, ValueError):
            raise ApiError(400, "commission_pct must be a number")
        if pct < 0 or pct > 50:
            raise ApiError(400, "Commission must be between 0 and 50 percent")
        patch["commission_pct"] = round2(pct)
    if isinstance(body.get("commission_enabled"), bool):
        patch["commission_enabled"] = body["commission_enabled"]

    res = one(
        client.table("categories").update(patch).eq("id", existing["id"]).select("*").maybe_single().execute()
    )
    client.table("audit_logs").insert(
        {
            "action": "commission_update",
            "detail": f"{existing['name']} commission -> {patch.get('commission_pct', existing['commission_pct'])}%",
        }
    ).execute()
    return res


@router.get("/commission-preview")
def commission_preview(body: dict):
    """What a booking of this size would net, so a rate change can be sanity checked."""
    try:
        amount = float(body.get("amount") or 0)
    except (TypeError, ValueError):
        raise ApiError(400, "amount must be a number")
    try:
        pct = float(body.get("commission_pct"))
    except (TypeError, ValueError):
        raise ApiError(400, "commission_pct must be a number")
    fee, earnings = compute_split(amount, pct)
    return {"amount": round2(amount), "commission_pct": pct, "platform_fee": fee, "provider_earnings": earnings}


# ---------------------------------------------------------------------------
# Coupons (#3)
# ---------------------------------------------------------------------------
@router.get("/coupons")
def list_coupons():
    client = db()
    res = client.table("coupons").select("*").order("created_at", desc=True).execute()
    return res.data or []


@router.post("/coupons", status_code=201)
def create_coupon(body: dict):
    code = body.get("code")
    if not isinstance(code, str) or not code.strip():
        raise ApiError(400, "code required")
    code = code.strip().upper()
    if not code.replace("_", "").isalnum():
        raise ApiError(400, "Code can only contain letters, numbers and underscores")
    discount_type = body.get("discount_type", "percent")
    if discount_type not in {"percent", "flat"}:
        raise ApiError(400, "discount_type must be percent or flat")
    try:
        value = float(body.get("discount_value") or 0)
    except (TypeError, ValueError):
        raise ApiError(400, "discount_value must be a number")
    if value <= 0:
        raise ApiError(400, "discount_value must be greater than zero")
    if discount_type == "percent" and value > 100:
        raise ApiError(400, "A percentage discount cannot exceed 100")
    if discount_type == "flat" and value > 100000:
        raise ApiError(400, "That discount is too large")

    client = db()
    duplicate = one(
        client.table("coupons").select("id").eq("code", code).maybe_single().execute()
    )
    if duplicate:
        raise ApiError(409, f"Coupon {code} already exists")

    slug = body.get("category_slug")
    if slug:
        cat = one(client.table("categories").select("id").eq("slug", slug).maybe_single().execute())
        if not cat:
            raise ApiError(400, "category_slug must reference an existing category")

    row = one(
        client.table("coupons")
        .insert(
            {
                "code": code,
                "description": (body.get("description") if isinstance(body.get("description"), str) else "")[:200],
                "discount_type": discount_type,
                "discount_value": value,
                "min_amount": float(body.get("min_amount") or 0),
                "max_discount": float(body["max_discount"]) if body.get("max_discount") is not None else None,
                "category_slug": slug if isinstance(slug, str) and slug else None,
                "max_per_phone": int(body["max_per_phone"]) if body.get("max_per_phone") is not None else None,
                "first_booking_only": body.get("first_booking_only") is True,
                "usage_limit": int(body["usage_limit"]) if body.get("usage_limit") is not None else None,
                "active": body.get("active") is not False,
            }
        )
        .select("*")
        .maybe_single()
        .execute()
    )
    if not row:
        raise ApiError(400, "Could not create coupon")
    client.table("audit_logs").insert(
        {"action": "coupon_create", "detail": f"{code} ({discount_type} {value})"}
    ).execute()
    return row


@router.put("/coupons/{coupon_id}")
def update_coupon(coupon_id: str, body: dict):
    client = db()
    existing = one(client.table("coupons").select("*").eq("id", coupon_id).maybe_single().execute())
    if not existing:
        raise ApiError(404, "Coupon not found")
    patch = {}
    if isinstance(body.get("description"), str):
        patch["description"] = body["description"][:200]
    if isinstance(body.get("active"), bool):
        patch["active"] = body["active"]
    for key in ("min_amount", "max_discount"):
        if body.get(key) is not None and isinstance(body.get(key), (int, float, str)):
            patch[key] = float(body[key])
    for key in ("max_per_phone", "usage_limit"):
        if body.get(key) is None:
            patch[key] = None
        elif isinstance(body.get(key), (int, float, str)):
            patch[key] = int(float(body[key]))
    if isinstance(body.get("expires_at"), str):
        patch["expires_at"] = body["expires_at"]
    row = one(
        client.table("coupons").update(patch).eq("id", coupon_id).select("*").maybe_single().execute()
    )
    client.table("audit_logs").insert(
        {"action": "coupon_update", "detail": f"{existing['code']}: {patch}"}
    ).execute()
    return row


@router.delete("/coupons/{coupon_id}")
def delete_coupon(coupon_id: str):
    client = db()
    existing = one(client.table("coupons").select("code").eq("id", coupon_id).maybe_single().execute())
    if not existing:
        raise ApiError(404, "Coupon not found")
    client.table("coupons").delete().eq("id", coupon_id).execute()
    client.table("audit_logs").insert(
        {"action": "coupon_delete", "detail": f"Deleted coupon {existing['code']}"}
    ).execute()
    return {"ok": True}


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