import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import links
from app.links import link_professional_to_category, relink_professional


class FakeQuery:
    def __init__(self, db, table):
        self.db = db
        self.table = table
        self.filters: dict = {}
        self.mode = "select"
        self.insert_rows: list = []
        self.delete_ids: list = []

    # --- query building -------------------------------------------------
    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def in_(self, col, vals):
        self.filters[f"in:{col}"] = list(vals)
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        self.mode = "maybe_single"
        return self

    def insert(self, rows):
        self.mode = "insert"
        self.insert_rows = rows if isinstance(rows, list) else [rows]
        return self

    def upsert(self, rows, on_conflict=None, ignore_duplicates=False):
        self.mode = "insert"
        self.insert_rows = rows if isinstance(rows, list) else [rows]
        self.on_conflict = on_conflict
        self.ignore_duplicates = ignore_duplicates
        return self

    def delete(self):
        self.mode = "delete"
        return self

    # --- execution ------------------------------------------------------
    def execute(self):
        rows = self.db.data.get(self.table, [])
        if self.mode == "insert":
            self.db.data.setdefault("professional_services", []).extend(self.insert_rows)
            return type("R", (), {"data": self.insert_rows})()
        if self.mode == "delete":
            ids = set(self.delete_ids or self.filters.get("in:id", []))
            keep = [r for r in self.db.data.get(self.table, []) if r["id"] not in ids]
            self.db.data[self.table] = keep
            return type("R", (), {"data": keep})()
        out = list(rows)
        for col, val in self.filters.items():
            if col.startswith("in:"):
                out = [r for r in out if r.get(col[3:]) in val]
            else:
                out = [r for r in out if r.get(col) == val]
        return type("R", (), {"data": (out[0] if out else None) if self.mode == "maybe_single" else out})()

    def __getattr__(self, name):
        return lambda *a, **k: self


class FakeDb:
    def __init__(self, data):
        self.data = data
        self.last: FakeQuery | None = None

    def table(self, name):
        self.last = FakeQuery(self, name)
        return self.last


def install(monkeypatch: pytest.MonkeyPatch, data: dict) -> FakeDb:
    fake = FakeDb(data)
    monkeypatch.setattr(links, "db", lambda: fake)
    return fake


BASE = {
    "categories": [{"id": "c-plumber", "slug": "plumber"}],
    "services": [
        {"id": "s-tap", "category_id": "c-plumber", "starting_price": 99},
        {"id": "s-drain", "category_id": "c-plumber", "starting_price": 149},
    ],
    "professionals": [{"id": "p1", "category_slug": "plumber"}],
    "professional_services": [],
}


def test_creates_one_link_per_category_service(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, {k: list(v) for k, v in BASE.items()})
    assert link_professional_to_category("p1", "plumber") == 2


def test_link_rows_carry_the_service_starting_price(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch, {k: list(v) for k, v in BASE.items()})
    link_professional_to_category("p1", "plumber")
    prices = sorted(r["price"] for r in fake.data["professional_services"])
    assert prices == [99, 149]


def test_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch, {k: list(v) for k, v in BASE.items()})
    assert link_professional_to_category("p1", "plumber") == 2
    assert link_professional_to_category("p1", "plumber") == 0
    assert len(fake.data["professional_services"]) == 2


def test_unknown_category_is_a_no_op(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch, {k: list(v) for k, v in BASE.items()})
    assert link_professional_to_category("p1", "does-not-exist") == 0
    assert fake.data["professional_services"] == []


def test_missing_arguments_are_a_no_op(monkeypatch: pytest.MonkeyPatch) -> None:
    install(monkeypatch, {k: list(v) for k, v in BASE.items()})
    assert link_professional_to_category("", "plumber") == 0
    assert link_professional_to_category("p1", None) == 0


def test_relink_drops_links_outside_the_category(monkeypatch: pytest.MonkeyPatch) -> None:
    data = {
        "categories": [{"id": "c-plumber", "slug": "plumber"}],
        "services": [
            {"id": "s-tap", "category_id": "c-plumber", "starting_price": 99},
            {"id": "s-paint", "category_id": "c-paint", "starting_price": 500},
        ],
        "professionals": [{"id": "p1", "category_slug": "plumber"}],
        "professional_services": [{"id": "old", "professional_id": "p1", "service_id": "s-paint", "price": 500}],
    }
    fake = install(monkeypatch, data)
    relink_professional("p1", "plumber")
    remaining = fake.data["professional_services"]
    assert [r["service_id"] for r in remaining] == ["s-tap"]
