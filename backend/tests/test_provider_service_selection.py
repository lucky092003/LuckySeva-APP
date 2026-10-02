import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import links
from app.exceptions import ApiError
from app.routers import provider

PRO_ID = "pro-7"
CLAIMS = {"professional_id": PRO_ID}

CATEGORY = {"id": "cat-plumb", "slug": "plumber"}
SERVICES = [
    {"id": "svc-tap", "name": "Tap & Mixer Repair", "starting_price": 99, "category_id": "cat-plumb"},
    {"id": "svc-drain", "name": "Drainage Unclogging", "starting_price": 199, "category_id": "cat-plumb"},
    {"id": "svc-bath", "name": "Bathroom Fittings", "starting_price": 399, "category_id": "cat-plumb"},
]
LINKS = [
    {"id": "pl-1", "professional_id": PRO_ID, "service_id": "svc-tap", "price": 99},
    {"id": "pl-2", "professional_id": PRO_ID, "service_id": "svc-drain", "price": 199},
    {"id": "pl-3", "professional_id": PRO_ID, "service_id": "svc-bath", "price": 399},
]


class FakeQuery:
    """Selects resolve to seeded rows; every write is captured for assertions."""

    def __init__(self, db, table):
        self.db = db
        self.table = table
        self.mode = "select"
        self.payload = None
        self.on_conflict = None
        self.ignore_duplicates = False
        self.filters: dict = {}
        self.in_filters: dict = {}
        self.single = False

    def select(self, *_a, **_k):
        return self

    def insert(self, row):
        self.mode = "insert"
        self.payload = row
        return self

    def upsert(self, row, on_conflict=None, ignore_duplicates=False):
        self.mode = "insert"
        self.payload = row
        self.on_conflict = on_conflict
        self.ignore_duplicates = ignore_duplicates
        return self

    def update(self, patch):
        self.mode = "update"
        self.payload = patch
        return self

    def delete(self):
        self.mode = "delete"
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def in_(self, column, values):
        self.in_filters[column] = list(values)
        return self

    def order(self, *_a, **_k):
        return self

    def maybe_single(self):
        self.single = True
        return self

    def execute(self):
        if self.mode in {"insert", "update"}:
            self.db.writes.append((self.table, self.mode, self.payload))
            if self.mode == "insert":
                self.db.upserts.append(
                    (self.table, self.on_conflict, self.ignore_duplicates)
                )
                rows = self.payload if isinstance(self.payload, list) else [self.payload]
                return type("R", (), {"data": rows})()
            return type("R", (), {"data": [self.payload]})()
        if self.mode == "delete":
            self.db.writes.append((self.table, "delete", self.in_filters.get("id", [])))
            return type("R", (), {"data": []})()
        matched = [
            r
            for r in self.db.rows.get(self.table) or []
            if all(r.get(c) == v for c, v in self.filters.items())
            and all(r.get(c) in vs for c, vs in self.in_filters.items())
        ]
        return type("R", (), {"data": (matched[0] if matched else None) if self.single else matched})()


class FakeDb:
    def __init__(self, rows: dict):
        self.rows = rows
        self.writes: list = []
        self.upserts: list = []

    def table(self, name):
        return FakeQuery(self, name)


def rows(category_slug="plumber", links_rows=None):
    # Fresh dicts every call: a test that seeds an extra trade must not leak it
    # into the next one through the module-level constants.
    return {
        "categories": [dict(CATEGORY)],
        "services": [dict(s) for s in SERVICES],
        "professional_services": [dict(r) for r in (LINKS if links_rows is None else links_rows)],
        "professionals": [{"id": PRO_ID, "category_slug": category_slug}],
    }


def install(monkeypatch: pytest.MonkeyPatch, **kwargs):
    fake = FakeDb(rows(**kwargs))
    monkeypatch.setattr(links, "db", lambda: fake)
    monkeypatch.setattr(provider, "db", lambda: fake)
    return fake


def writes(fake, table, mode):
    return [w for w in fake.writes if w[0] == table and w[1] == mode]


def test_dropping_a_service_deletes_only_that_link(monkeypatch) -> None:
    """The auto-link at signup covers the whole category; opting out must cut one row."""
    fake = install(monkeypatch)
    links.set_professional_services(PRO_ID, "plumber", ["svc-tap"])

    assert writes(fake, "professional_services", "delete") == [
        ("professional_services", "delete", ["pl-2", "pl-3"])
    ]
    assert writes(fake, "professional_services", "insert") == []


def test_adding_a_service_back_inserts_it_at_the_catalogue_price(monkeypatch) -> None:
    fake = install(monkeypatch, links_rows=[])
    links.set_professional_services(PRO_ID, "plumber", ["svc-drain"])

    assert writes(fake, "professional_services", "insert") == [
        (
            "professional_services",
            "insert",
            [{"professional_id": PRO_ID, "service_id": "svc-drain", "price": 199}],
        )
    ]


def test_every_link_insert_is_idempotent_on_the_provider_service_key(monkeypatch) -> None:
    """UNIQUE (professional_id, service_id) would 500 on a double tap without this.

    postgrest only accepts `on_conflict` on upsert, and ignore_duplicates keeps
    it from overwriting a price already on the link.
    """
    fake = install(monkeypatch, links_rows=[])
    links.set_professional_services(PRO_ID, "plumber", ["svc-drain"])
    links.link_professional_to_category(PRO_ID, "plumber")

    assert fake.upserts == [
        ("professional_services", "professional_id,service_id", True)
    ] * 2


def test_keeping_the_current_selection_writes_nothing(monkeypatch) -> None:
    fake = install(monkeypatch)
    result = links.set_professional_services(
        PRO_ID, "plumber", ["svc-tap", "svc-drain", "svc-bath"]
    )

    assert fake.writes == []
    assert result["linked"] == 3


def test_the_floor_price_drops_to_the_cheapest_service_kept(monkeypatch) -> None:
    fake = install(monkeypatch)
    result = links.set_professional_services(PRO_ID, "plumber", ["svc-bath"])

    assert writes(fake, "professionals", "update") == [
        ("professionals", "update", {"starting_price": 399})
    ]
    assert result["starting_price"] == 399


def test_the_floor_price_rises_when_the_cheapest_service_is_dropped(monkeypatch) -> None:
    """Leaving at ₹99 services would keep advertising a "from ₹99" that is gone."""
    fake = install(monkeypatch)
    result = links.set_professional_services(PRO_ID, "plumber", ["svc-drain"])

    assert result["starting_price"] == 199
    assert writes(fake, "professionals", "update")


def test_a_repeated_id_is_not_treated_as_two_services(monkeypatch) -> None:
    fake = install(monkeypatch)
    result = links.set_professional_services(PRO_ID, "plumber", ["svc-tap", "svc-tap"])

    assert result["service_ids"] == ["svc-tap"]
    assert writes(fake, "professional_services", "delete")


def test_resaving_the_same_selection_leaves_a_hand_chosen_price_alone(monkeypatch) -> None:
    """`updateMe({starting_price})` is the provider's own number; don't reset it."""
    fake = install(monkeypatch)

    links.set_professional_services(PRO_ID, "plumber", ["svc-tap", "svc-drain", "svc-bath"])

    assert writes(fake, "professionals", "update") == []


def test_an_empty_selection_is_refused(monkeypatch) -> None:
    """Zero links would hide the professional from every service page."""
    fake = install(monkeypatch)

    with pytest.raises(ApiError) as excinfo:
        links.set_professional_services(PRO_ID, "plumber", [])

    assert excinfo.value.status == 400
    assert fake.writes == []


def test_a_service_from_another_trade_is_refused(monkeypatch) -> None:
    fake = install(monkeypatch)

    with pytest.raises(ApiError) as excinfo:
        links.set_professional_services(PRO_ID, "plumber", ["svc-tap", "svc-ac-service"])

    assert excinfo.value.status == 400
    assert fake.writes == []


def test_a_provider_without_a_category_cannot_select(monkeypatch) -> None:
    install(monkeypatch, category_slug="")

    with pytest.raises(ApiError) as excinfo:
        links.set_professional_services(PRO_ID, "", ["svc-tap"])

    assert excinfo.value.status == 400


def test_a_missing_professional_is_a_404(monkeypatch) -> None:
    install(monkeypatch)

    with pytest.raises(ApiError) as excinfo:
        links.set_professional_services("", "plumber", ["svc-tap"])

    assert excinfo.value.status == 404


# --- choosing your own trade -------------------------------------------------


def test_setting_a_trade_relinks_the_whole_category(monkeypatch) -> None:
    """An empty or 'other' trade has no sub-services to pick, so this is self-serve."""
    fake = install(monkeypatch, category_slug="", links_rows=[])
    result = links.set_professional_trade(PRO_ID, "plumber")

    assert result["category_slug"] == "plumber"
    assert result["linked"] == 3
    assert result["starting_price"] == 99
    assert writes(fake, "professionals", "update") == [
        ("professionals", "update", {"category_slug": "plumber"}),
        ("professionals", "update", {"starting_price": 99}),
    ]
    assert len(writes(fake, "professional_services", "insert")[0][2]) == 3


def test_changing_trade_drops_links_from_the_old_one(monkeypatch) -> None:
    fake = install(
        monkeypatch,
        category_slug="other",
        links_rows=[
            {"id": "pl-9", "professional_id": PRO_ID, "service_id": "svc-ac-1", "price": 500},
            {"id": "pl-8", "professional_id": PRO_ID, "service_id": "svc-tap", "price": 99},
        ],
    )
    links.set_professional_trade(PRO_ID, "plumber")

    assert writes(fake, "professional_services", "delete") == [
        ("professional_services", "delete", ["pl-9"])
    ]
    # svc-tap was already linked, so it is kept rather than re-inserted.
    assert writes(fake, "professional_services", "insert") == [
        (
            "professional_services",
            "insert",
            [
                {"professional_id": PRO_ID, "service_id": "svc-drain", "price": 199},
                {"professional_id": PRO_ID, "service_id": "svc-bath", "price": 399},
            ],
        )
    ]


def test_an_unknown_trade_is_refused(monkeypatch) -> None:
    fake = install(monkeypatch, category_slug="")

    with pytest.raises(ApiError) as excinfo:
        links.set_professional_trade(PRO_ID, "plumbear")

    assert excinfo.value.status == 400
    assert fake.writes == []


def test_a_blank_trade_is_refused(monkeypatch) -> None:
    install(monkeypatch, category_slug="")

    with pytest.raises(ApiError) as excinfo:
        links.set_professional_trade(PRO_ID, "   ")

    assert excinfo.value.status == 400


def test_the_trade_endpoint_trims_what_it_is_given(monkeypatch) -> None:
    install(monkeypatch, category_slug="")
    result = provider.update_trade({"category_slug": " Plumber "}, CLAIMS)

    assert result["category_slug"] == "plumber"


def test_the_trade_endpoint_needs_a_slug(monkeypatch) -> None:
    install(monkeypatch, category_slug="")

    with pytest.raises(ApiError) as excinfo:
        provider.update_trade({"category_slug": 7}, CLAIMS)

    assert excinfo.value.status == 400


def test_the_trade_endpoint_404s_for_a_missing_professional(monkeypatch) -> None:
    install(monkeypatch, category_slug="")
    monkeypatch.setattr(provider, "db", lambda: FakeDb({}))

    with pytest.raises(ApiError) as excinfo:
        provider.update_trade({"category_slug": "plumber"}, CLAIMS)

    assert excinfo.value.status == 404


# --- the endpoints ---------------------------------------------------------


def test_services_endpoint_lists_the_whole_category(monkeypatch) -> None:
    """A provider must see what they can switch on, not just what is on."""
    install(monkeypatch, links_rows=[])
    result = provider.my_services(CLAIMS)

    assert result["category_slug"] == "plumber"
    assert {s["name"] for s in result["services"]} == {
        "Tap & Mixer Repair",
        "Drainage Unclogging",
        "Bathroom Fittings",
    }
    assert [s["offered"] for s in result["services"]] == [False, False, False]


def test_services_endpoint_flags_what_is_already_offered(monkeypatch) -> None:
    install(monkeypatch, links_rows=[LINKS[0]])
    result = provider.my_services(CLAIMS)

    assert [s["offered"] for s in result["services"]] == [True, False, False]


def test_services_endpoint_never_lists_another_trades_services(monkeypatch) -> None:
    """An electrician asking for their sheet must not see plumber work, or vice versa."""
    fake = install(monkeypatch, links_rows=[])
    fake.rows["categories"].append({"id": "cat-elec", "slug": "electrician"})
    fake.rows["services"].append(
        {"id": "svc-wiring", "name": "Full House Wiring", "starting_price": 349, "category_id": "cat-elec"}
    )

    result = provider.my_services(CLAIMS)

    assert result["category_slug"] == "plumber"
    assert "Full House Wiring" not in {s["name"] for s in result["services"]}
    assert {s["name"] for s in result["services"]} == {
        "Tap & Mixer Repair",
        "Drainage Unclogging",
        "Bathroom Fittings",
    }


def test_after_changing_trade_the_sheet_shows_the_new_trade(monkeypatch) -> None:
    """The list follows the trade, so a switch cannot leave the old services ticked."""
    fake = install(monkeypatch)
    fake.rows["categories"].append({"id": "cat-elec", "slug": "electrician"})
    fake.rows["services"].append(
        {"id": "svc-wiring", "name": "Full House Wiring", "starting_price": 349, "category_id": "cat-elec"}
    )

    provider.update_trade({"category_slug": "electrician"}, CLAIMS)
    # The fake records writes instead of applying them, so replay what the trade
    # switch did (new slug, old links deleted, new ones upserted) the way the
    # real rows would see it before reading the sheet back.
    fake.rows["professionals"][0].update(writes(fake, "professionals", "update")[0][2])
    dropped = writes(fake, "professional_services", "delete")[0][2]
    fake.rows["professional_services"] = [
        r for r in fake.rows["professional_services"] if r["id"] not in dropped
    ]
    for _table, _mode, payload in writes(fake, "professional_services", "insert"):
        row = payload[0] if isinstance(payload, list) else payload
        fake.rows["professional_services"].append(row)
    result = provider.my_services(CLAIMS)

    assert result["category_slug"] == "electrician"
    assert {s["name"] for s in result["services"]} == {"Full House Wiring"}
    assert [s["offered"] for s in result["services"]] == [True]


def test_services_endpoint_for_a_provider_without_a_trade(monkeypatch) -> None:
    install(monkeypatch, category_slug="unknown")

    assert provider.my_services(CLAIMS) == {"category_slug": "unknown", "services": []}


def test_saving_requires_a_list_of_ids(monkeypatch) -> None:
    install(monkeypatch)

    with pytest.raises(ApiError) as excinfo:
        provider.update_services({"service_ids": "svc-tap"}, CLAIMS)

    assert excinfo.value.status == 400


def test_saving_rejects_a_non_string_id(monkeypatch) -> None:
    install(monkeypatch)

    with pytest.raises(ApiError) as excinfo:
        provider.update_services({"service_ids": ["svc-tap", 7]}, CLAIMS)

    assert excinfo.value.status == 400


def test_saving_narrows_the_selection(monkeypatch) -> None:
    fake = install(monkeypatch)

    result = provider.update_services({"service_ids": ["svc-tap", "svc-bath"]}, CLAIMS)

    assert result["service_ids"] == ["svc-tap", "svc-bath"]
    assert writes(fake, "professional_services", "delete") == [
        ("professional_services", "delete", ["pl-2"])
    ]