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

    def execute(self):
        data = self._data
        if getattr(self, "_single", False):
            data = data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else None)
        elif getattr(self, "_patch", None) and isinstance(data, list) and data:
            data = [{**data[0], **self._patch}]
        return type("Res", (), {"data": data})()


class Client:
    def __init__(self, existing):
        self.existing = existing

    def table(self, name):
        assert name == "bookings"
        return Query([self.existing])


@pytest.fixture()
def env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(customer, "notify", lambda *a, **k: None)
    monkeypatch.setattr(customer, "insert_notification", lambda *a, **k: None)
    row = {
        "id": "booking-1",
        "customer_phone": "9999999999",
        "status": "confirmed",
        "scheduled_date": (date.today() + timedelta(days=3)).isoformat(),
        "scheduled_time": "10:00 AM",
        "professional_id": None,
        "service_name": "Switch Repair",
    }
    client = Client(row)
    monkeypatch.setattr(customer, "db", lambda: client)
    return client.existing, lambda body: customer.reschedule_booking("booking-1", body, {"phone": "9999999999"})


def test_happy_path_moves_the_booking(env) -> None:
    row, reschedule = env
    future = (date.today() + timedelta(days=5)).isoformat()
    updated = reschedule({"scheduled_date": future, "scheduled_time": "2:00 PM"})
    assert updated["scheduled_date"] == future
    assert updated["scheduled_time"] == "2:00 PM"


def test_past_date_is_rejected(env) -> None:
    _, reschedule = env
    with pytest.raises(ApiError) as err:
        reschedule({"scheduled_date": "2020-01-01", "scheduled_time": "10:00 AM"})
    assert "past" in str(err.value)


def test_same_schedule_is_rejected(env) -> None:
    row, reschedule = env
    with pytest.raises(ApiError) as err:
        reschedule({"scheduled_date": row["scheduled_date"], "scheduled_time": row["scheduled_time"]})
    assert "already scheduled" in str(err.value)


@pytest.mark.parametrize("status", ["on_the_way", "started", "completed", "cancelled"])
def test_late_statuses_cannot_be_rescheduled(env, status: str) -> None:
    row, reschedule = env
    row["status"] = status
    with pytest.raises(ApiError):
        reschedule({"scheduled_date": (date.today() + timedelta(days=9)).isoformat(), "scheduled_time": "3:00 PM"})


def test_blank_time_is_rejected(env) -> None:
    _, reschedule = env
    with pytest.raises(ApiError):
        reschedule({"scheduled_date": (date.today() + timedelta(days=5)).isoformat(), "scheduled_time": "  "})


def test_malformed_date_is_rejected(env) -> None:
    _, reschedule = env
    with pytest.raises(ApiError) as err:
        reschedule({"scheduled_date": "next friday", "scheduled_time": "10:00 AM"})
    assert "scheduled_date" in str(err.value)
