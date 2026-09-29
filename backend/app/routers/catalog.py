import math

from fastapi import APIRouter, Query

from ..db import db, one
from ..exceptions import ApiError

router = APIRouter()

EARTH_RADIUS_KM = 6371.0
DEFAULT_NEARBY_RADIUS_KM = 30.0
DEFAULT_NEARBY_LIMIT = 5
NEARBY_SCAN_LIMIT = 200


def _haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    to_rad = math.radians
    d_lat = to_rad(b_lat - a_lat)
    d_lng = to_rad(b_lng - a_lng)
    a = math.sin(d_lat / 2) ** 2 + math.cos(to_rad(a_lat)) * math.cos(to_rad(b_lat)) * math.sin(d_lng / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))


def _as_float(value) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _rating_of(pro: dict) -> float:
    return _as_float(pro.get("rating")) or 0.0


def _with_distance(pros: list[dict], latitude: float, longitude: float) -> list[dict]:
    """Override the stored `distance_km` with the real great-circle distance."""
    out: list[dict] = []
    for pro in pros:
        pro_lat = _as_float(pro.get("latitude"))
        pro_lng = _as_float(pro.get("longitude"))
        if pro_lat is None or pro_lng is None:
            out.append({**pro, "distance_km": _as_float(pro.get("distance_km")) or 0.0})
        else:
            out.append({**pro, "distance_km": round(_haversine_km(latitude, longitude, pro_lat, pro_lng), 1)})
    return out


def _nearby_professionals(
    category_slug: str | None,
    latitude: float | None,
    longitude: float | None,
    radius_km: float,
    limit: int,
) -> list[dict]:
    """Best `limit` professionals of a category, closest first when coords are known."""
    if not category_slug:
        return []
    client = db()
    res = (
        client.table("professionals")
        .select("*")
        .eq("category_slug", category_slug)
        .order("rating", desc=True)
        .limit(NEARBY_SCAN_LIMIT)
        .execute()
    )
    rows = res.data or []

    if latitude is None or longitude is None:
        return [{**r, "distance_km": _as_float(r.get("distance_km")) or 0.0} for r in rows[:limit]]

    nearby: list[dict] = []
    for row in rows:
        pro_lat = _as_float(row.get("latitude"))
        pro_lng = _as_float(row.get("longitude"))
        if pro_lat is None or pro_lng is None:
            continue
        km = _haversine_km(latitude, longitude, pro_lat, pro_lng)
        if km > radius_km:
            continue
        nearby.append({**row, "distance_km": round(km, 1)})

    nearby.sort(key=lambda r: (r["distance_km"], -_rating_of(r)))
    return nearby[:limit]


@router.get("")
def home():
    client = db()
    categories = client.table("categories").select("*").order("sort_order").execute()
    professionals = (
        client.table("professionals").select("*").order("rating", desc=True).limit(6).execute()
    )
    popular = client.table("services").select("*").eq("popular", True).limit(8).execute()
    return {
        "categories": categories.data or [],
        "professionals": professionals.data or [],
        "popular": popular.data or [],
    }


@router.get("/categories")
def categories():
    client = db()
    res = client.table("categories").select("*").order("sort_order").execute()
    return res.data or []


@router.get("/categories/{slug}")
def category(slug: str):
    client = db()
    cat = one(client.table("categories").select("*").eq("slug", slug).maybe_single().execute())
    if not cat:
        raise ApiError(404, "Category not found")
    services = client.table("services").select("*").eq("category_id", cat["id"]).execute()
    return {"category": cat, "services": services.data or []}


@router.get("/categories/{slug}/services")
def category_services(slug: str):
    client = db()
    cat = one(client.table("categories").select("id").eq("slug", slug).maybe_single().execute())
    if not cat:
        raise ApiError(404, "Category not found")
    services = (
        client.table("services").select("*").eq("category_id", cat["id"]).order("name").execute()
    )
    return services.data or []


@router.get("/services")
def services(category_slug: str | None = None):
    client = db()
    if category_slug:
        cat = one(client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute())
        if not cat:
            raise ApiError(404, "Category not found")
        res = (
            client.table("services")
            .select("*")
            .eq("category_id", cat["id"])
            .order("name")
            .execute()
        )
        return res.data or []
    res = client.table("services").select("*").order("name").execute()
    return res.data or []


@router.get("/services/{service_id}")
def service(
    service_id: str,
    latitude: float | None = None,
    longitude: float | None = None,
    radius_km: float = Query(default=DEFAULT_NEARBY_RADIUS_KM, gt=0, le=500),
    limit: int = Query(default=DEFAULT_NEARBY_LIMIT, ge=1, le=20),
):
    client = db()
    svc = one(
        client.table("services")
        .select("*, category:categories(*)")
        .eq("id", service_id)
        .maybe_single()
        .execute()
    )
    if not svc:
        raise ApiError(404, "Service not found")
    providers = (
        client.table("professional_services")
        .select("professional:professionals(*)")
        .eq("service_id", service_id)
        .execute()
    )
    category = svc.get("category") or {}
    category_slug = category.get("slug")
    if not category_slug:
        cat_row = one(
            client.table("categories").select("slug").eq("id", svc["category_id"]).maybe_single().execute()
        )
        category_slug = (cat_row or {}).get("slug")
    has_coords = latitude is not None and longitude is not None
    nearby = _nearby_professionals(
        category_slug,
        latitude if has_coords else None,
        longitude if has_coords else None,
        radius_km,
        limit,
    )
    linked = [row.get("professional") for row in (providers.data or []) if row.get("professional")]
    if has_coords:
        linked = _with_distance(linked, latitude, longitude)
    return {
        "service": svc,
        "providers": linked,
        "nearby": nearby,
        "nearby_radius_km": radius_km,
        "nearby_category_slug": category_slug,
    }


@router.get("/professionals")
def professionals(
    category_slug: str | None = None,
    query: str | None = None,
    limit: int = Query(default=50, le=100),
):
    client = db()
    q = client.table("professionals").select("*")
    if category_slug and category_slug != "all":
        q = q.eq("category_slug", category_slug)
    if query:
        q = q.or_(f"name.ilike.%{query}%,bio.ilike.%{query}%,service_area.ilike.%{query}%")
    res = q.order("rating", desc=True).limit(limit).execute()
    return res.data or []


@router.get("/professionals/{professional_id}")
def professional(professional_id: str):
    client = db()
    pro = one(
        client.table("professionals").select("*").eq("id", professional_id).maybe_single().execute()
    )
    if not pro:
        raise ApiError(404, "Professional not found")
    services = (
        client.table("professional_services")
        .select("*, service:services(*)")
        .eq("professional_id", professional_id)
        .execute()
    )
    reviews = (
        client.table("reviews")
        .select("*")
        .eq("professional_id", professional_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {
        "professional": pro,
        "services": services.data or [],
        "reviews": reviews.data or [],
    }


@router.get("/reviews/{professional_id}")
def reviews(professional_id: str):
    client = db()
    res = (
        client.table("reviews")
        .select("*")
        .eq("professional_id", professional_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/search")
def search(q: str = ""):
    q = q.strip()
    if not q:
        raise ApiError(400, "Query parameter q required")
    client = db()
    professionals = (
        client.table("professionals")
        .select("*")
        .or_(f"skills.cs.{{{q}}},name.ilike.%{q}%,bio.ilike.%{q}%")
        .limit(10)
        .execute()
    )
    services = (
        client.table("services")
        .select("*")
        .or_(f"name.ilike.%{q}%,description.ilike.%{q}%")
        .limit(10)
        .execute()
    )
    return {
        "professionals": professionals.data or [],
        "services": services.data or [],
    }