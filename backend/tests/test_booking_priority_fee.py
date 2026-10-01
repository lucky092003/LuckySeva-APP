import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers import catalog, customer

HOME_LAT, HOME_LNG = 12.9716, 77.5946
SERVICE_ID = "svc-1"
PRO_ID = "pro-top"


class Query:
    """Chainable no-op query builder returning one canned result set."""

    def __init__(self, data):
        self._data = data

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return type("Res", (), {"data": self._data})()


class TablesClient:
    """Fake client resolving each table to its own canned result.

    Values are stored in the shape postgrest actually returns: a single dict
    (or None) for `maybe_single()` lookups, a list for multi-row scans.
    """

    def __init__(self, tables: dict, settings: dict | None = None):
        self._tables = tables
        self._settings = settings or {}

    def table(self, name):
        if name == "admin_settings":
            key = next(iter(self._settings), None)
            value = None if key is None else {"key": key, "value": self._settings[key]}
            return Query(value)
        return Query(self._tables.get(name))


def pro(name, lat=None, lng=None, rating=4.0):
    return {
        "id": name,
        "name": name,
        "category_slug": "electrician",
        "rating": rating,
        "distance_km": 1,
        "latitude": lat,
        "longitude": lng,
    }


@pytest.fixture()
def fake_rank(monkeypatch: pytest.MonkeyPatch):
    """Replace the professionals scan that `_nearby_professionals` performs."""

    def install(rows):
        monkeypatch.setattr(catalog, "db", lambda: TablesClient({"professionals": rows}))

    return install


def priority_client(rows, settings=None):
    return TablesClient(
        {
            "services": {"id": SERVICE_ID, "category_id": "cat-1"},
            "categories": {"id": "cat-1", "slug": "electrician"},
            "professionals": rows,
        },
        settings,
    )


def test_setting_float_falls_back_when_missing() -> None:
    assert customer._setting_float(TablesClient({}), "priority_fee", 99.0) == 99.0


def test_setting_float_falls_back_when_the_row_is_absent() -> None:
    """A zero-row maybe_single() returns None, so `.data` would have raised.

    Regression: before the None-safe `one()` this was an AttributeError that
    escaped the except clause and turned every booking into a 500.
    """
    client = TablesClient({"admin_settings": None})
    assert customer._setting_float(client, "priority_fee", 99.0) == 99.0


def test_setting_float_ignores_junk_values() -> None:
    assert customer._setting_float(TablesClient({}, {"priority_fee": "abc"}), "priority_fee", 99.0) == 99.0
    assert customer._setting_float(TablesClient({}, {"priority_fee": ""}), "priority_fee", 99.0) == 99.0


def test_setting_float_reads_a_configured_value() -> None:
    client = TablesClient({}, {"priority_fee": "149"})
    assert customer._setting_float(client, "priority_fee", 99.0) == 149.0


def test_top_n_pick_is_priority(fake_rank) -> None:
    fake_rank([pro(PRO_ID, 12.98, 77.60, 4.9)])
    client = priority_client([])
    assert customer._is_priority_pick(client, SERVICE_ID, PRO_ID, 5, HOME_LAT, HOME_LNG) is True


def test_pick_outside_top_n_is_not_priority(fake_rank) -> None:
    # Six equally-close pros; only the first five make the cut.
    fake_rank([pro(f"pro-{i}", 12.98, 77.60, 4.9) for i in range(6)])
    client = priority_client([])
    assert customer._is_priority_pick(client, SERVICE_ID, "pro-5", 5, HOME_LAT, HOME_LNG) is False


def test_out_of_radius_professional_is_not_priority(fake_rank) -> None:
    # Highly rated but ~160 km away: the picker would never have shown this one.
    fake_rank([pro(PRO_ID, 14.0, 78.0, 5.0)])
    client = priority_client([])
    assert customer._is_priority_pick(client, SERVICE_ID, PRO_ID, 5, HOME_LAT, HOME_LNG) is False


def test_priority_uses_distance_order_not_rating(fake_rank) -> None:
    """The picker ranks nearby pros by distance, so rating must not decide it.

    With six nearby pros, `pro-5` is the sixth closest and outside the top five
    despite rating highest of all. Ranking by rating instead would wrongly
    charge the customer for a professional they could not even see.
    """
    fake_rank([pro(f"pro-{i}", 12.98 + i * 0.01, 77.60, 4.0 + i * 0.1) for i in range(6)])
    client = priority_client([])
    assert customer._is_priority_pick(client, SERVICE_ID, "pro-5", 5, HOME_LAT, HOME_LNG) is False


def test_top_n_cutoff_is_configurable(fake_rank) -> None:
    fake_rank([pro(f"pro-{i}", 12.98 + i * 0.01, 77.60, 4.0) for i in range(6)])
    client = priority_client([])
    assert customer._is_priority_pick(client, SERVICE_ID, "pro-5", 6, HOME_LAT, HOME_LNG) is True


def test_missing_service_is_not_priority(fake_rank) -> None:
    fake_rank([pro(PRO_ID, 12.98, 77.60, 4.9)])
    client = TablesClient(
        {"services": None, "categories": {"id": "cat-1", "slug": "electrician"}}
    )
    assert customer._is_priority_pick(client, SERVICE_ID, PRO_ID, 5, HOME_LAT, HOME_LNG) is False


def test_missing_category_is_not_priority(fake_rank) -> None:
    fake_rank([pro(PRO_ID, 12.98, 77.60, 4.9)])
    client = TablesClient(
        {"services": {"id": SERVICE_ID, "category_id": "cat-1"}, "categories": None}
    )
    assert customer._is_priority_pick(client, SERVICE_ID, PRO_ID, 5, HOME_LAT, HOME_LNG) is False
