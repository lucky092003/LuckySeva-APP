import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.exceptions import ApiError
from app.routers import customer


class Query:
    def __init__(self, data):
        self._data = data

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def neq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        self._single = True
        return self

    def update(self, patch):
        self._patch = patch
        return self

    def delete(self):
        self._delete = True
        return self

    def execute(self):
        data = self._data
        if getattr(self, "_delete", False):
            data = []
        elif getattr(self, "_single", False):
            data = data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else None)
        elif getattr(self, "_patch", None) and isinstance(data, list) and data:
            data = [{**data[0], **self._patch}]
        return type("Res", (), {"data": data})()


class Client:
    def __init__(self, existing):
        self.existing = existing
        self.cleared_tracking = []

    def table(self, name):
        if name == "bookings":
            return Query([self.existing])
        if name == "provider_tracking":
            tracking = Query([])
            original_execute = tracking.execute

            def execute():
                self.cleared_tracking.append(name)
                return original_execute()

            tracking.execute = execute
            return tracking
        raise AssertionError(f"unexpected table {name}")


@pytest.fixture()
def env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(customer, "notify_provider", lambda *a, **k: None)
    monkeypatch.setattr(customer, "insert_notification", lambda *a, **k: None)
    monkeypatch.setattr(customer.ledger, "successful_payment", lambda *a, **k: None)
    row = {
        "id": "booking-1",
        "customer_phone": "9999999999",
        "status": "confirmed",
        "scheduled_date": (date.today() + timedelta(days=3)).isoformat(),
        "scheduled_time": "10:00 AM",
        "professional_id": "pro-1",
        "service_name": "Switch Repair",
        "payment_status": "unpaid",
        "total_amount": 500.0,
    }
    client = Client(row)
    monkeypatch.setattr(customer, "db", lambda: client)
    return client, row, lambda: customer.cancel_booking("booking-1", None, {"phone": "9999999999"})


def test_confirmed_booking_can_be_cancelled(env) -> None:
    _, _, cancel = env
    updated = cancel()
    assert updated["status"] == "cancelled"


def test_assigned_booking_can_be_cancelled(env) -> None:
    _, row, cancel = env
    row["status"] = "assigned"
    updated = cancel()
    assert updated["status"] == "cancelled"


@pytest.mark.parametrize("status", ["on_the_way", "started"])
def test_journey_started_booking_cannot_be_cancelled(env, status: str) -> None:
    """The frontend hides Cancel for these statuses; the backend must agree.

    The card used to offer Cancel for an ongoing booking and the API rejected
    it with a 400, so the two sides had to be pinned to the same rule.
    """
    _, row, cancel = env
    row["status"] = status
    with pytest.raises(ApiError) as err:
        cancel()
    assert "already started" in str(err.value)


@pytest.mark.parametrize("status", ["completed", "cancelled"])
def test_closed_booking_cannot_be_cancelled(env, status: str) -> None:
    _, row, cancel = env
    row["status"] = status
    with pytest.raises(ApiError):
        cancel()


def test_cancel_clears_the_live_position(env) -> None:
    client, _, cancel = env
    cancel()
    assert client.cleared_tracking == ["provider_tracking"]
