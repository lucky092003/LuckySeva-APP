import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.exceptions import ApiError
from app.routers import customer

SERVICE_ID = "svc-1"


class Query:
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

    def insert(self, *_a, **_k):
        return self

    def execute(self):
        return type("Res", (), {"data": self._data})()


class TablesClient:
    def __init__(self, tables: dict):
        self._tables = tables
        self.inserted: list[dict] = []

    def table(self, name):
        if name == "bookings":
            client = self

            class Inserting(Query):
                def insert(self, row):
                    client.inserted.append(row)
                    return self

            return Inserting([{"id": "booking-1"}])
        return Query(self._tables.get(name))


@pytest.fixture()
def booking_client(monkeypatch: pytest.MonkeyPatch):
    """A client with no professional, so the priority path stays out of the way."""

    def run(body: dict):
        client = TablesClient(
            {
                "profiles": {"name": "Asha", "phone": "9999999999"},
                "services": {"id": SERVICE_ID, "name": "Switch Repair", "starting_price": 149},
                "professionals": None,
                "admin_settings": None,
                "addresses": None,
                "notifications": None,
            }
        )
        monkeypatch.setattr(customer, "db", lambda: client)
        customer.create_booking(body, {"phone": "9999999999"})
        return client.inserted[0]

    return run


def base_body(**overrides) -> dict:
    body = {
        "customer_name": "Asha",
        "customer_address": "12 MG Road, Bengaluru",
        "service_id": SERVICE_ID,
        "scheduled_date": "2026-10-05",
        "scheduled_time": "10:00 AM",
    }
    body.update(overrides)
    return body


def test_valid_schedule_is_stored(booking_client) -> None:
    row = booking_client(base_body())
    assert row["scheduled_date"] == "2026-10-05"
    assert row["scheduled_time"] == "10:00 AM"


def test_missing_date_is_rejected(booking_client) -> None:
    """`scheduled_date` is NOT NULL, so an empty string used to reach Postgres.

    Regression: the driver raised 22P02, nothing catches it (only ApiError has a
    handler) and the customer got a bare 500 that the client swallowed.
    """
    body = base_body()
    body.pop("scheduled_date")
    with pytest.raises(ApiError) as err:
        booking_client(body)
    assert "scheduled_date" in str(err.value)


@pytest.mark.parametrize("bad", ["", "next friday", "05-10-2026", "2026-13-45", 20261005, None])
def test_malformed_date_is_rejected(booking_client, bad) -> None:
    with pytest.raises(ApiError) as err:
        booking_client(base_body(scheduled_date=bad))
    assert "scheduled_date" in str(err.value)


@pytest.mark.parametrize("bad", ["", "   ", None, 1000])
def test_missing_or_blank_time_is_rejected(booking_client, bad) -> None:
    with pytest.raises(ApiError) as err:
        booking_client(base_body(scheduled_time=bad))
    assert "scheduled_time" in str(err.value)


def test_time_is_trimmed_before_storage(booking_client) -> None:
    assert booking_client(base_body(scheduled_time="  10:00 AM "))["scheduled_time"] == "10:00 AM"


def test_price_is_still_recomputed_not_taken_from_the_body(booking_client) -> None:
    """Guards the money path against a regression while touching this handler."""
    row = booking_client(base_body(base_price=1, total_amount=1, visit_fee=0))
    assert row["base_price"] == 149
    assert row["total_amount"] == 149