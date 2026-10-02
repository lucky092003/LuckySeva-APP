import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.exceptions import ApiError
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


# --- Field routing -------------------------------------------------------
# A request belongs to professionals of that trade only, not every provider in
# the radius.

ELEC_CAT = {"id": "cat-elec", "slug": "electrician"}
PLUMB_CAT = {"id": "cat-plumb", "slug": "plumber"}
ELEC_SERVICE = {"id": "svc-elec-1", "category_id": "cat-elec"}
ELEC_SERVICE_2 = {"id": "svc-elec-2", "category_id": "cat-elec"}
PLUMB_SERVICE = {"id": "svc-plumb-1", "category_id": "cat-plumb"}


def electrician_client(bookings, category_slug="electrician", service_ids=("svc-elec-1",)):
    return TablesClient(
        {
            "bookings": bookings,
            "booking_declines": [],
            "professionals": {"id": PRO_ID, "category_slug": category_slug},
            "professional_services": [{"service_id": s} for s in service_ids],
            "categories": [ELEC_CAT, PLUMB_CAT],
        }
    )


def request_for(service, **overrides):
    return booking_row(service_id=service["id"], service=service, **overrides)


@pytest.fixture()
def electrician(monkeypatch: pytest.MonkeyPatch):
    def install(bookings, **kwargs):
        client = electrician_client(bookings, **kwargs)
        monkeypatch.setattr(provider, "db", lambda: client)

    return install


def test_request_in_my_field_reaches_me(electrician, claims) -> None:
    electrician([request_for(ELEC_SERVICE)])
    assert len(provider.feed(claims)) == 1


def test_request_from_another_field_never_reaches_me(electrician, claims) -> None:
    electrician([request_for(PLUMB_SERVICE)])
    assert provider.feed(claims) == []


def test_a_bookings_service_row_is_stripped_from_the_response(electrician, claims) -> None:
    electrician([request_for(ELEC_SERVICE)])
    assert "service" not in provider.feed(claims)[0]


def test_an_explicitly_booked_provider_gets_any_field(electrician, claims) -> None:
    """The customer picked this professional, so the trade check must not apply."""
    electrician([request_for(PLUMB_SERVICE, professional_id=PRO_ID)])
    assert len(provider.feed(claims)) == 1


def test_a_deselected_service_in_my_category_stops_reaching_me(
    electrician, claims
) -> None:
    """Turning a service off must bite, even though the trade still matches."""
    electrician([request_for(ELEC_SERVICE_2)], service_ids=("svc-elec-1",))
    assert provider.feed(claims) == []


def test_a_service_kept_in_my_selection_still_reaches_me(electrician, claims) -> None:
    electrician([request_for(ELEC_SERVICE_2)], service_ids=("svc-elec-1", "svc-elec-2"))
    assert len(provider.feed(claims)) == 1


def test_a_provider_with_no_links_falls_back_to_their_trade(
    monkeypatch, claims
) -> None:
    """Legacy row: nothing selected yet, so the whole category is still theirs."""
    monkeypatch.setattr(provider, "db", lambda: electrician_client(
        [request_for(PLUMB_SERVICE)], service_ids=()
    ))
    assert provider.feed(claims) == []


def test_a_request_with_no_service_left_is_hidden(electrician, claims) -> None:
    """`service_id` is ON DELETE SET NULL, so a deleted service leaves no field."""
    electrician([booking_row(service_id=None, service=None)])
    assert provider.feed(claims) == []


def test_a_provider_with_no_field_at_all_still_sees_the_feed(
    monkeypatch, claims
) -> None:
    monkeypatch.setattr(provider, "db", lambda: TablesClient({
        "bookings": [request_for(PLUMB_SERVICE)],
        "booking_declines": [],
        "professionals": None,
        "professional_services": [],
        "categories": [ELEC_CAT, PLUMB_CAT],
    }))
    assert len(provider.feed(claims)) == 1


def test_booking_detail_of_another_field_is_not_found(monkeypatch, claims) -> None:
    monkeypatch.setattr(
        provider, "db", lambda: electrician_client(request_for(PLUMB_SERVICE))
    )
    with pytest.raises(ApiError) as exc:
        provider.booking("bk-1", claims)
    assert exc.value.status == 404


def test_booking_detail_of_my_field_is_returned(monkeypatch, claims) -> None:
    monkeypatch.setattr(
        provider, "db", lambda: electrician_client(request_for(ELEC_SERVICE))
    )
    assert provider.booking("bk-1", claims)["customer_phone"] == ""