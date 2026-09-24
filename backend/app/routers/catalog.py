from fastapi import APIRouter, Query

from ..db import db
from ..exceptions import ApiError

router = APIRouter()


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
    cat = client.table("categories").select("*").eq("slug", slug).maybe_single().execute()
    if not cat.data:
        raise ApiError(404, "Category not found")
    services = client.table("services").select("*").eq("category_id", cat.data["id"]).execute()
    return {"category": cat.data, "services": services.data or []}


@router.get("/categories/{slug}/services")
def category_services(slug: str):
    client = db()
    cat = client.table("categories").select("id").eq("slug", slug).maybe_single().execute()
    if not cat.data:
        raise ApiError(404, "Category not found")
    services = (
        client.table("services").select("*").eq("category_id", cat.data["id"]).order("name").execute()
    )
    return services.data or []


@router.get("/services")
def services(category_slug: str | None = None):
    client = db()
    if category_slug:
        cat = client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute()
        if not cat.data:
            raise ApiError(404, "Category not found")
        res = (
            client.table("services")
            .select("*")
            .eq("category_id", cat.data["id"])
            .order("name")
            .execute()
        )
        return res.data or []
    res = client.table("services").select("*").order("name").execute()
    return res.data or []


@router.get("/services/{service_id}")
def service(service_id: str):
    client = db()
    svc = (
        client.table("services")
        .select("*, category:categories(*)")
        .eq("id", service_id)
        .maybe_single()
        .execute()
    )
    if not svc.data:
        raise ApiError(404, "Service not found")
    providers = (
        client.table("professional_services")
        .select("professional:professionals(*)")
        .eq("service_id", service_id)
        .execute()
    )
    return {
        "service": svc.data,
        "providers": [row.get("professional") for row in (providers.data or []) if row.get("professional")],
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
    pro = (
        client.table("professionals").select("*").eq("id", professional_id).maybe_single().execute()
    )
    if not pro.data:
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
        "professional": pro.data,
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