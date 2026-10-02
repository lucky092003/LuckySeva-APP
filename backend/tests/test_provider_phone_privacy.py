import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.routers import provider

PRO_ID = "pro-me"
OTHER_ID = "pro-other"
PHONE = "9876543210"


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
    def __init__(self, tables: dict):
        self._tables = tables

    def table(self, name):
        return Query(self._tables.get(name))


def booking_row(**overrides) -> dict:
    row = {
        "id": "bk-1",
        "status": "confirmed",
        "professional_id": None,
        "customer_name": "Asha Rao",
        "customer_phone": PHONE,
        "customer_address": "12 MG Road, Bengaluru",
        "service_name": "AC Repair",
    }
    row.update(overrides)
    return row


@pytest.fixture()
def claims() -> dict:
    return {"professional_id": PRO_ID}


def install(monkeypatch: pytest.MonkeyPatch, bookings, declines=None) -> None:
    client = TablesClient({"bookings": bookings, "booking_declines": declines or []})
    monkeypatch.setattr(provider, "db", lambda: client)


def test_phone_is_hidden_while_the_request_is_open(claims) -> None:
    assert provider._hide_phone(booking_row(), claims)["customer_phone"] == ""


def test_address_survives_redaction(claims) -> None:
    """Only the number is withheld — the provider still needs to price the job."""
    row = provider._hide_phone(booking_row(), claims)
    assert row["customer_address"] == "12 MG Road, Bengaluru"
    assert row["customer_name"] == "Asha Rao"


def test_phone_is_hidden_from_another_professional(claims) -> None:
    row = booking_row(professional_id=OTHER_ID)
    assert provider._hide_phone(row, claims)["customer_phone"] == ""


def test_phone_is_shown_to_the_accepting_professional(claims) -> None:
    row = booking_row(status="assigned", professional_id=PRO_ID)
    assert provider._hide_phone(row, claims)["customer_phone"] == PHONE


def test_redaction_does_not_mutate_the_source_row(claims) -> None:
    source = booking_row()
    provider._hide_phone(source, claims)
    assert source["customer_phone"] == PHONE


def test_feed_withholds_the_number_on_open_requests(monkeypatch, claims) -> None:
    install(monkeypatch, [booking_row()])
    assert provider.feed(claims)[0]["customer_phone"] == ""


def test_feed_skips_jobs_assigned_to_another_professional(monkeypatch, claims) -> None:
    """The open feed only carries unclaimed work, so it never leaks a rival's job."""
    install(monkeypatch, [booking_row(status="assigned", professional_id=OTHER_ID)])
    assert provider.feed(claims) == []


def test_feed_reveals_the_number_on_a_booking_already_claimed_by_me(
    monkeypatch, claims
) -> None:
    install(monkeypatch, [booking_row(professional_id=PRO_ID)])
    assert provider.feed(claims)[0]["customer_phone"] == PHONE


def test_feed_reveals_the_number_once_accepted(monkeypatch, claims) -> None:
    install(monkeypatch, [booking_row(status="assigned", professional_id=PRO_ID)])
    assert provider.feed(claims)[0]["customer_phone"] == PHONE


def test_feed_still_lists_the_request_it_stripped(monkeypatch, claims) -> None:
    install(monkeypatch, [booking_row()])
    assert len(provider.feed(claims)) == 1


def test_booking_detail_withholds_the_number_before_accepting(monkeypatch, claims) -> None:
    install(monkeypatch, booking_row())
    assert provider.booking("bk-1", claims)["customer_phone"] == ""


def test_booking_detail_reveals_the_number_after_accepting(monkeypatch, claims) -> None:
    install(monkeypatch, booking_row(status="assigned", professional_id=PRO_ID))
    assert provider.booking("bk-1", claims)["customer_phone"] == PHONE