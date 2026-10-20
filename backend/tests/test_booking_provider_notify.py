"""`POST /customer/bookings` must tell the provider side, both ways round.

The request can go out to the whole field (broadcast) or to one pre-picked
professional (assigned). Either way the provider has to learn about it through
their bell - a booking nobody told the field about is invisible until the feed
happens to be polled. What is guarded here is the *routing*: the router calls
the right notifier with the right recipient. Delivery of the bell row itself
(push + insert) belongs to `events.notify_new_request` / `events.notify_provider`.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers import customer  # noqa: E402

SERVICE_ID = "svc-1"
CLAIMS = {"phone": "9999999999"}


class Query:
    """Fixed-data PostgREST stand-in: every read answers with the canned row."""

    def __init__(self, data):
        self._data = data

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def maybe_single(self):
        return self

    def insert(self, *_a, **_k):
        return self

    def execute(self):
        return type("Res", (), {"data": self._data, "count": 0})()


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


@pytest.fixture()
def create(monkeypatch: pytest.MonkeyPatch):
    """`create_booking` against a canned DB, with every notifier stubbed.

    The stubs are recorded rather than executed so the assertions stay about
    routing; the tables that feed pricing (services, categories, settings) are
    real canned rows because the booking must still be priced to be created.
    """
    calls: dict = {"field": None, "assigned": None, "customer": None}

    def _create(body: dict, *, professional_services=None, tables: dict | None = None):
        client = TablesClient(
            {
                "profiles": {"name": "Asha", "phone": "9999999999"},
                "services": {
                    "id": SERVICE_ID,
                    "name": "Switch Repair",
                    "starting_price": 149,
                    "category_id": "cat-1",
                },
                "categories": None,
                "professionals": None,
                "admin_settings": None,
                "addresses": None,
                "coupons": None,
                "notifications": None,
                "professional_services": professional_services,
                **(tables or {}),
            }
        )
        monkeypatch.setattr(customer, "db", lambda: client)
        monkeypatch.setattr(
            customer, "insert_notification", lambda *a, **k: calls.__setitem__("customer", a)
        )
        monkeypatch.setattr(
            customer,
            "notify_new_request",
            lambda ids, name, km, bid: calls.__setitem__(
                "field", {"ids": ids, "service_name": name, "distance_km": km, "booking_id": bid}
            ),
        )
        monkeypatch.setattr(
            customer,
            "notify_provider",
            lambda pid, type_, title, message, bid=None, data=None: calls.__setitem__(
                "assigned", {"professional_id": pid, "title": title, "booking_id": bid}
            ),
        )
        return customer.create_booking(body, CLAIMS)

    return _create, calls


def test_broadcast_request_is_fanned_out_to_the_field(create) -> None:
    _create, calls = create
    _create(
        base_body(),
        professional_services=[{"professional_id": "pro-1"}, {"professional_id": "pro-2"}],
    )

    assert calls["field"] == {
        "ids": ["pro-1", "pro-2"],
        "service_name": "Switch Repair",
        "distance_km": None,
        "booking_id": "booking-1",
    }
    # Nobody was pre-picked, so no single professional should be pinged twice.
    assert calls["assigned"] is None


def test_pre_picked_professional_gets_the_assignment_notification(create) -> None:
    _create, calls = create
    _create(
        base_body(professional_id="pro-9"),
        tables={"professionals": {"id": "pro-9", "name": "Ravi"}},
    )

    assert calls["assigned"] == {
        "professional_id": "pro-9",
        "title": "New booking assigned to you",
        "booking_id": "booking-1",
    }
    # A directed booking must not also be broadcast to everyone else.
    assert calls["field"] is None


def test_customer_still_gets_the_confirmation_alongside(create) -> None:
    """The provider ping must not replace the customer's own confirmation."""
    _create, calls = create
    _create(base_body(professional_id="pro-9"), tables={"professionals": {"id": "pro-9", "name": "Ravi"}})

    phone, type_, title, _message, booking_id = calls["customer"]
    assert (phone, type_, booking_id) == ("9999999999", "booking", "booking-1")
    assert "confirmed" in title.lower()
