"""Professional <-> service linking.

A professional offers every service in their `category_slug`. Without a
`professional_services` row, the service detail screen has no providers to
show ("No professionals available for this service yet") and the profile's
"Book Now" button stays disabled, so every provider must be linked on
creation and whenever their category changes.

Creation links the whole category, which is a safe default but overstates
what a professional actually does: a plumber who only fixes taps should not
be handed full-house-wiring requests. `set_professional_services` narrows
that default to the services the professional picked for themselves.
"""

from .db import db, one
from .exceptions import ApiError


def link_professional_to_category(professional_id: str, category_slug: str | None) -> int:
    """Link a professional to every service in their category. Returns rows added."""
    if not professional_id or not category_slug:
        return 0
    client = db()
    cat = one(
        client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute()
    )
    if not cat:
        return 0
    services = client.table("services").select("id,starting_price").eq("category_id", cat["id"]).execute()
    rows = (services.data or [])[:]
    if not rows:
        return 0

    existing = {
        r["service_id"]
        for r in (
            client.table("professional_services")
            .select("service_id")
            .eq("professional_id", professional_id)
            .execute()
        ).data
        or []
    }
    missing = [r for r in rows if r["id"] not in existing]
    if not missing:
        return 0

    res = (
        client.table("professional_services")
        .insert(
            [
                {
                    "professional_id": professional_id,
                    "service_id": r["id"],
                    "price": r.get("starting_price") or 0,
                }
                for r in missing
            ],
            # UNIQUE (professional_id, service_id): a re-link must be a no-op, not
            # a 500 on the constraint.
            on_conflict="professional_id,service_id",
        )
        .execute()
    )
    return len(res.data or [])


def cheapest_in_category(category_slug: str | None) -> float:
    """Cheapest service price in a category, or 0.0 if the category is unknown.

    `professionals.starting_price` is a flat "from" floor that several list
    screens render and filter on directly, while the booking itself always bills
    the catalogue price. Seeding a new professional from the catalogue keeps the
    two in step instead of leaving a placeholder that reads as a real quote.
    """
    if not category_slug:
        return 0.0
    client = db()
    cat = one(
        client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute()
    )
    if not cat:
        return 0.0
    prices = [
        float(r["starting_price"] or 0)
        for r in (
            client.table("services").select("starting_price").eq("category_id", cat["id"]).execute()
        ).data
        or []
    ]
    prices = [p for p in prices if p > 0]
    return min(prices) if prices else 0.0


def relink_professional(professional_id: str, category_slug: str | None) -> int:
    """Drop links outside the category, then (re)link the current category."""
    if professional_id and category_slug:
        client = db()
        cat = one(
            client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute()
        )
        if cat:
            keep = {
                s["id"]
                for s in (
                    client.table("services").select("id").eq("category_id", cat["id"]).execute()
                ).data
                or []
            }
            stale = [
                r["id"]
                for r in (
                    client.table("professional_services")
                    .select("id,service_id")
                    .eq("professional_id", professional_id)
                    .execute()
                ).data
                or []
                if r["service_id"] not in keep
            ]
            if stale:
                client.table("professional_services").delete().in_("id", stale).execute()
    return link_professional_to_category(professional_id, category_slug)


def set_professional_services(
    professional_id: str, category_slug: str | None, service_ids: list[str]
) -> dict:
    """Replace a professional's service selection with `service_ids`.

    `service_ids` must be a non-empty subset of their category's services: the
    selection narrows the trade they work in, it does not widen it. Prices on
    kept links are preserved, and `professionals.starting_price` — the "from"
    floor several list screens show — is re-derived from what is left selected.
    """
    if not professional_id:
        raise ApiError(404, "Professional not found")
    # de-duplicate while keeping order, so a doubled id is not a validation error
    wanted = [s for s in dict.fromkeys(service_ids) if s]
    if not wanted:
        raise ApiError(400, "Select at least one service you offer")
    client = db()
    cat = (
        one(client.table("categories").select("id").eq("slug", category_slug).maybe_single().execute())
        if category_slug
        else None
    )
    if not cat:
        raise ApiError(400, "Your category is not set, so services cannot be selected")
    catalog = {
        r["id"]: float(r.get("starting_price") or 0)
        for r in (
            client.table("services")
            .select("id, starting_price")
            .eq("category_id", cat["id"])
            .execute()
        ).data
        or []
    }
    unknown = [s for s in wanted if s not in catalog]
    if unknown:
        raise ApiError(400, "Those services are not part of your category")
    existing = {
        r["service_id"]
        for r in (
            client.table("professional_services")
            .select("service_id")
            .eq("professional_id", professional_id)
            .execute()
        ).data
        or []
    }
    stale = [
        r["id"]
        for r in (
            client.table("professional_services")
            .select("id, service_id")
            .eq("professional_id", professional_id)
            .execute()
        ).data
        or []
        if r["service_id"] not in wanted
    ]
    if stale:
        client.table("professional_services").delete().in_("id", stale).execute()
    missing = [s for s in wanted if s not in existing]
    if missing:
        client.table("professional_services").insert(
            [
                {
                    "professional_id": professional_id,
                    "service_id": sid,
                    "price": catalog.get(sid) or 0,
                }
                for sid in missing
            ],
            on_conflict="professional_id,service_id",
        ).execute()
    floor = min((catalog[s] for s in wanted if catalog[s] > 0), default=0.0)
    # Only re-derive the floor when the selection actually moved: re-saving the
    # same set must not stomp a price the provider set by hand in Pricing.
    if floor and (stale or missing):
        client.table("professionals").update({"starting_price": floor}).eq(
            "id", professional_id
        ).execute()
    return {
        "service_ids": wanted,
        "starting_price": floor,
        "linked": len(wanted),
    }
