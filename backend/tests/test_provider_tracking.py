import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.exceptions import ApiError
from app.routers import customer, provider

PRO_ID = "11111111-1111-1111-1111-111111111111"
OTHER_PRO_ID = "22222222-2222-2222-2222-222222222222"
CUSTOMER = "9999999999"
OTHER_CUSTOMER = "9000000000"
BOOKING_ID = "booking-1"

CUSTOMER_CLAIMS = {"phone": CUSTOMER, "role": "customer"}
PRO_CLAIMS = {"phone": "8888888888", "role": "provider", "professional_id": PRO_ID}


class Res:
    def __init__(self, data):
        self.data = data


class Query:
    """Minimal PostgREST stand-in: filter -> action -> response."""

    def __init__(self, client, table):
        self.client = client
        self.table = table
        self.filters = []
        self.action = "select"
        self.payload = None
        self.single = False

    def select(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def maybe_single(self):
        self.single = True
        return self

    def update(self, patch):
        self.action = "update"
        self.payload = patch
        return self

    def insert(self, row):
        self.action = "insert"
        self.payload = row
        return self

    def upsert(self, payload, on_conflict=None):
        self.action = "upsert"
        self.payload = payload
        self.on_conflict = on_conflict
        return self

    def delete(self):
        self.action = "delete"
        return self

    def _matches(self, rows):
        return [r for r in rows if all(r.get(column) == value for column, value in self.filters)]

    def execute(self):
        rows = self.client.tables.setdefault(self.table, [])
        matched = self._matches(rows)

        if self.action == "delete":
            self.client.deleted.append((self.table, dict(self.filters)))
            self.client.tables[self.table] = [r for r in rows if r not in matched]
            return Res(matched)

        if self.action == "update":
            for row in matched:
                row.update(self.payload)
            return Res(matched)

        if self.action == "insert":
            rows.append(dict(self.payload))
            return Res([self.payload])

        if self.action == "upsert":
            key = "booking_id"
            existing = next((r for r in rows if r.get(key) == self.payload.get(key)), None)
            if existing:
                existing.update(self.payload)
                return Res([existing])
            rows.append(dict(self.payload))
            return Res([self.payload])

        if self.single:
            return Res(matched[0] if matched else None)
        return Res(matched)


class Client:
    def __init__(self, tables):
        self.tables = tables
        self.deleted: list[tuple[str, dict]] = []

    def table(self, name):
        return Query(self, name)


def booking(**overrides):
    row = {
        "id": BOOKING_ID,
        "customer_phone": CUSTOMER,
        "status": "on_the_way",
        "professional_id": PRO_ID,
        "service_name": "Switch Repair",
        "completed_jobs": 0,
    }
    row.update(overrides)
    return row


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    fake = Client(
        {
            "bookings": [booking()],
            "provider_tracking": [],
            "professionals": [{"id": PRO_ID, "completed_jobs": 0}],
            "notifications": [],
        }
    )
    monkeypatch.setattr(provider, "db", lambda: fake)
    monkeypatch.setattr(customer, "db", lambda: fake)
    return fake


# --- provider: publish location -------------------------------------------------


def test_assigned_provider_can_publish_while_on_the_way(client):
    res = provider.publish_location(
        BOOKING_ID, {"latitude": 19.076, "longitude": 72.8777, "accuracy": 12.5}, PRO_CLAIMS
    )

    assert res["ok"] is True
    [row] = client.tables["provider_tracking"]
    assert row["booking_id"] == BOOKING_ID
    assert row["professional_id"] == PRO_ID
    assert row["customer_phone"] == CUSTOMER
    assert row["latitude"] == pytest.approx(19.076)
    assert row["longitude"] == pytest.approx(72.8777)
    assert row["accuracy_m"] == pytest.approx(12.5)


def test_a_new_fix_replaces_the_previous_one(client):
    provider.publish_location(BOOKING_ID, {"latitude": 19.0, "longitude": 72.8}, PRO_CLAIMS)
    provider.publish_location(BOOKING_ID, {"latitude": 19.1, "longitude": 72.9}, PRO_CLAIMS)

    [row] = client.tables["provider_tracking"]
    assert row["latitude"] == pytest.approx(19.1)
    assert row["longitude"] == pytest.approx(72.9)


def test_another_provider_cannot_publish(client):
    client.tables["bookings"] = [booking(professional_id=OTHER_PRO_ID)]

    with pytest.raises(ApiError) as err:
        provider.publish_location(BOOKING_ID, {"latitude": 19.0, "longitude": 72.8}, PRO_CLAIMS)

    assert err.value.status == 404
    assert client.tables["provider_tracking"] == []


def test_publishing_is_refused_before_the_journey_starts(client):
    client.tables["bookings"] = [booking(status="assigned")]

    with pytest.raises(ApiError) as err:
        provider.publish_location(BOOKING_ID, {"latitude": 19.0, "longitude": 72.8}, PRO_CLAIMS)

    assert err.value.status == 409
    assert err.value.code == "tracking_not_active"
    assert client.tables["provider_tracking"] == []


@pytest.mark.parametrize("lat,lng", [(91.0, 72.8), (19.0, 181.0), ("19.0", 72.8)])
def test_invalid_coordinates_are_rejected(client, lat, lng):
    with pytest.raises(ApiError) as err:
        provider.publish_location(BOOKING_ID, {"latitude": lat, "longitude": lng}, PRO_CLAIMS)

    assert err.value.status == 400
    assert client.tables["provider_tracking"] == []


# --- customer: read location ----------------------------------------------------


def test_customer_sees_the_live_position(client):
    provider.publish_location(BOOKING_ID, {"latitude": 19.076, "longitude": 72.8777}, PRO_CLAIMS)

    res = customer.booking_tracking(BOOKING_ID, CUSTOMER_CLAIMS)

    assert res["active"] is True
    assert res["latitude"] == pytest.approx(19.076)
    assert res["longitude"] == pytest.approx(72.8777)
    assert res["updated_at"]


def test_tracking_is_idle_once_the_provider_arrives(client):
    provider.publish_location(BOOKING_ID, {"latitude": 19.076, "longitude": 72.8777}, PRO_CLAIMS)
    client.tables["bookings"] = [booking(status="started")]

    res = customer.booking_tracking(BOOKING_ID, CUSTOMER_CLAIMS)

    assert res == {
        "active": False,
        "latitude": None,
        "longitude": None,
        "accuracy_m": None,
        "updated_at": None,
    }


def test_tracking_is_idle_before_the_first_fix(client):
    res = customer.booking_tracking(BOOKING_ID, CUSTOMER_CLAIMS)

    assert res["active"] is False
    assert res["latitude"] is None


def test_another_customer_cannot_read_the_position(client):
    provider.publish_location(BOOKING_ID, {"latitude": 19.076, "longitude": 72.8777}, PRO_CLAIMS)

    with pytest.raises(ApiError) as err:
        customer.booking_tracking(BOOKING_ID, {"phone": OTHER_CUSTOMER, "role": "customer"})

    assert err.value.status == 404


# --- lifecycle ------------------------------------------------------------------


@pytest.mark.parametrize("status", ["started", "completed", "cancelled"])
def test_moving_past_on_the_way_clears_the_position(client, status):
    provider.publish_location(BOOKING_ID, {"latitude": 19.076, "longitude": 72.8777}, PRO_CLAIMS)

    provider.update_status(BOOKING_ID, {"status": status}, PRO_CLAIMS)

    assert client.tables["provider_tracking"] == []
    assert ("provider_tracking", {"booking_id": BOOKING_ID}) in client.deleted


def test_starting_the_journey_keeps_the_position(client):
    provider.publish_location(BOOKING_ID, {"latitude": 19.076, "longitude": 72.8777}, PRO_CLAIMS)

    provider.update_status(BOOKING_ID, {"status": "on_the_way"}, PRO_CLAIMS)

    assert len(client.tables["provider_tracking"]) == 1
