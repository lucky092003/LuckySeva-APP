import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers import catalog

# Koramangala, Bengaluru — the reference point for the fixtures below.
HOME_LAT, HOME_LNG = 12.9716, 77.5946


def pro(name: str, lat: float | None, lng: float | None, rating: float) -> dict:
    return {
        "id": name,
        "name": name,
        "category_slug": "electrician",
        "rating": rating,
        "distance_km": 1,
        "latitude": lat,
        "longitude": lng,
    }


class FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        return type("Res", (), {"data": self.rows})()


class FakeClient:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return FakeQuery(self.rows)


@pytest.fixture()
def fake_pros(monkeypatch: pytest.MonkeyPatch):
    def install(rows):
        monkeypatch.setattr(catalog, "db", lambda: FakeClient(rows))

    return install


def test_haversine_matches_known_city_distance() -> None:
    km = catalog._haversine_km(12.9716, 77.5946, 12.9352, 77.6245)
    assert 4.0 < km < 7.0


def test_haversine_is_zero_for_identical_points() -> None:
    assert catalog._haversine_km(HOME_LAT, HOME_LNG, HOME_LAT, HOME_LNG) == pytest.approx(0.0)


def test_nearby_keeps_only_closest_within_radius(fake_pros) -> None:
    fake_pros(
        [
            pro("near", 12.9800, 77.6000, 4.0),          # ~1 km
            pro("mid", 13.0350, 77.6200, 5.0),           # ~7 km
            pro("edge", 13.0900, 77.6500, 4.9),          # ~13 km
            pro("far", 14.0000, 78.0000, 5.0),           # ~160 km, outside 30 km
        ]
    )
    result = catalog._nearby_professionals("electrician", HOME_LAT, HOME_LNG, 30.0, 5)
    assert [p["name"] for p in result] == ["near", "mid", "edge"]
    assert all(p["distance_km"] <= 30.0 for p in result)


def test_nearby_returns_at_most_the_requested_limit(fake_pros) -> None:
    fake_pros([pro(f"p{i}", 12.9716 + i * 0.001, 77.5946, 4.0) for i in range(12)])
    assert len(catalog._nearby_professionals("electrician", HOME_LAT, HOME_LNG, 30.0, 5)) == 5


def test_nearby_breaks_distance_ties_on_rating(fake_pros) -> None:
    fake_pros(
        [
            pro("low", 12.9800, 77.6000, 3.0),
            pro("high", 12.9800, 77.6000, 4.9),
        ]
    )
    result = catalog._nearby_professionals("electrician", HOME_LAT, HOME_LNG, 30.0, 5)
    assert [p["name"] for p in result] == ["high", "low"]


def test_nearby_ignores_professionals_without_coordinates(fake_pros) -> None:
    fake_pros([pro("mystery", None, None, 5.0), pro("near", 12.9800, 77.6000, 4.0)])
    result = catalog._nearby_professionals("electrician", HOME_LAT, HOME_LNG, 30.0, 5)
    assert [p["name"] for p in result] == ["near"]


def test_nearby_falls_back_to_rating_order_without_customer_coords(fake_pros) -> None:
    fake_pros([pro("a", None, None, 4.0), pro("b", None, None, 4.9)])
    result = catalog._nearby_professionals("electrician", None, None, 30.0, 5)
    assert len(result) == 2


def test_nearby_is_empty_without_a_category(fake_pros) -> None:
    fake_pros([pro("a", 12.98, 77.60, 4.0)])
    assert catalog._nearby_professionals(None, HOME_LAT, HOME_LNG, 30.0, 5) == []


def test_with_distance_replaces_the_stored_distance_column() -> None:
    rows = [pro("far-away", 14.0000, 78.0000, 4.0), pro("unknown", None, None, 4.0)]
    result = catalog._with_distance(rows, HOME_LAT, HOME_LNG)
    assert result[0]["distance_km"] > 100
    # No coordinates to compute from: the stored value is kept as-is.
    assert result[1]["distance_km"] == rows[1]["distance_km"]
    # originals are untouched
    assert rows[0]["distance_km"] == 1


def test_as_float_tolerates_junk() -> None:
    assert catalog._as_float(None) is None
    assert catalog._as_float("") is None
    assert catalog._as_float("n/a") is None
    assert catalog._as_float("4.5") == 4.5
