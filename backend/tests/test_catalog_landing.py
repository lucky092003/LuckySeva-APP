import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers import catalog

TABLES = {
    "categories": [
        {"id": "c1", "slug": "electrician", "name": "Electrician", "description": "Wiring", "sort_order": 1},
        {"id": "c2", "slug": "plumber", "name": "Plumber", "description": "Pipes", "sort_order": 2},
    ],
    "services": [
        {"category_id": "c1", "starting_price": 799, "popular": False},
        {"category_id": "c1", "starting_price": 149, "popular": True},
        {"category_id": "c2", "starting_price": 99, "popular": False},
    ],
    "reviews": [
        {"rating": 5, "customer_name": "priya sharma", "professional_id": "p1", "created_at": "2026-01-02",
         "comment": "Arrived on time and the price on the app was the final price."},
        {"rating": 4, "customer_name": "Rahul", "professional_id": "p1", "created_at": "2026-01-01",
         "comment": "ok"},
    ],
    "professionals": [
        {"id": "p1", "category_slug": "electrician", "service_area": "Koramangala, bengaluru"},
        {"id": "p2", "category_slug": "plumber", "service_area": "Indiranagar, Bengaluru"},
    ],
    "bookings": [{"id": "b1", "status": "completed"}],
}


class Query:
    def __init__(self, table):
        self.table = table
        self.count_mode = False
        self.min_rating = None

    def select(self, *_a, count=None, head=False, **_k):
        self.count_mode = bool(count)
        return self

    def eq(self, column, value):
        self.rows = [r for r in self.rows if r.get(column) == value]
        return self

    def gte(self, column, value):
        self.rows = [r for r in self.rows if r.get(column, 0) >= value]
        return self

    def in_(self, column, values):
        self.rows = [r for r in self.rows if r.get(column) in values]
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    @property
    def rows(self):
        return self._rows

    @rows.setter
    def rows(self, value):
        self._rows = value

    def execute(self):
        return type("Res", (), {"data": self._rows, "count": len(self._rows)})()


class Client:
    def table(self, name):
        q = Query(name)
        q.rows = list(TABLES[name])
        return q


@pytest.fixture(autouse=True)
def _fake_db(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(catalog, "db", lambda: Client())
    catalog._landing_cache.update(at=0.0, data=None)


def test_landing_aggregates_real_numbers() -> None:
    data = catalog.landing()
    assert data["stats"]["services"] == 3
    assert data["stats"]["categories"] == 2
    assert data["stats"]["completed_bookings"] == 1
    assert data["stats"]["rating_avg"] == 4.5
    assert data["stats"]["reviews"] == 2
    assert data["cities"] == ["Bengaluru"]


def test_landing_prices_use_cheapest_service_per_category() -> None:
    by_slug = {c["slug"]: c for c in catalog.landing()["categories"]}
    assert by_slug["electrician"]["starting_price"] == 149
    assert by_slug["electrician"]["popular"] is True
    assert by_slug["plumber"]["popular"] is False


def test_landing_testimonials_are_anonymised_and_substantial() -> None:
    items = catalog.landing()["testimonials"]
    assert [t["name"] for t in items] == ["Priya S."]
    assert items[0]["service"] == "Electrician"
