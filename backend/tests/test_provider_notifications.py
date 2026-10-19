import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.events as events  # noqa: E402
from app.exceptions import ApiError  # noqa: E402
from app.routers import provider  # noqa: E402

PRO_ID = "pro-1"
OTHER_ID = "pro-2"
CLAIMS = {"phone": "8888888888", "role": "provider", "professional_id": PRO_ID}


class Query:
    """Minimal PostgREST stand-in: records filters and mutates rows in place.

    Mutating the same dicts the fixture holds is deliberate - the "another
    professional's row was left alone" assertions read the stored table after
    the call.
    """

    def __init__(self, client, name):
        self.client = client
        self.name = name
        self._filters = []
        self._patch = None
        self._single = False

    def select(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self._filters.append((column, value))
        return self

    def in_(self, column, values):
        self._filters.append((column, list(values)))
        return self

    def maybe_single(self):
        self._single = True
        return self

    def update(self, patch):
        self._patch = patch
        return self

    def insert(self, row):
        self.client.inserted.append((self.name, row))
        self.client.log.append("insert")
        return self

    def _matches(self, row: dict) -> bool:
        for column, value in self._filters:
            if isinstance(value, list):
                if row.get(column) not in value:
                    return False
            elif row.get(column) != value:
                return False
        return True

    def execute(self):
        rows = [r for r in self.client.tables.get(self.name, []) if self._matches(r)]
        if self._patch is not None:
            for row in rows:
                row.update(self._patch)
        if self._single:
            data = rows[0] if rows else None
        else:
            data = rows
        return type("Res", (), {"data": data})()


class Client:
    def __init__(self, tables: dict | None = None):
        self.tables = tables or {}
        self.inserted: list[tuple[str, dict]] = []
        self.log: list[str] = []

    def table(self, name):
        return Query(self, name)


def notification(professional_id=None, customer_phone=None, read=False, **extra) -> dict:
    return {
        "id": extra.pop("id", "n-1"),
        "professional_id": professional_id,
        "customer_phone": customer_phone,
        "type": "booking",
        "title": "A title",
        "message": "A message",
        "booking_id": None,
        "read": read,
        "created_at": "2026-10-19T00:00:00+00:00",
        **extra,
    }


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Client:
    fake = Client({"notifications": [], "professionals": []})
    monkeypatch.setattr(provider, "db", lambda: fake)
    monkeypatch.setattr(events, "db", lambda: fake)
    return fake


def test_list_returns_only_this_professionals_rows(client: Client) -> None:
    client.tables["notifications"] = [
        notification(PRO_ID, id="n-mine"),
        notification(OTHER_ID, id="n-theirs"),
        notification(None, customer_phone="9999999999", id="n-customer"),
    ]
    rows = provider.notifications(CLAIMS)
    assert [r["id"] for r in rows] == ["n-mine"]


def test_mark_read_updates_own_row(client: Client) -> None:
    client.tables["notifications"] = [notification(PRO_ID, id="n-mine")]
    row = provider.mark_notification_read("n-mine", CLAIMS)
    assert row["read"] is True


def test_mark_read_refuses_another_professionals_row(client: Client) -> None:
    client.tables["notifications"] = [notification(OTHER_ID, id="n-theirs")]
    with pytest.raises(ApiError) as err:
        provider.mark_notification_read("n-theirs", CLAIMS)
    assert err.value.status == 404
    assert client.tables["notifications"][0]["read"] is False


def test_read_all_only_touches_own_unread_rows(client: Client) -> None:
    client.tables["notifications"] = [
        notification(PRO_ID, id="n-1"),
        notification(PRO_ID, id="n-2", read=True),
        notification(OTHER_ID, id="n-3"),
    ]
    result = provider.mark_all_notifications_read(CLAIMS)
    assert result == {"ok": True, "updated": 1}
    read_by_id = {r["id"]: r["read"] for r in client.tables["notifications"]}
    assert read_by_id == {"n-1": True, "n-2": True, "n-3": False}


def test_notify_provider_writes_the_bell_row_then_pushes(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    pushes = []

    def fake_notify(role, owner_id, title, body, data=None):
        client.log.append("push")
        pushes.append({"role": role, "owner_id": owner_id, "data": data})

    monkeypatch.setattr(events.push, "notify", fake_notify)
    events.notify_provider(PRO_ID, "payment", "Payment received", "Rs 500 received", "b-1")

    # Row first, push second: a push must never outrun its bell entry.
    assert client.log == ["insert", "push"]
    table, row = client.inserted[0]
    assert table == "notifications"
    assert row["professional_id"] == PRO_ID
    assert "customer_phone" not in row
    assert row["booking_id"] == "b-1"
    assert row["read"] is False
    assert pushes == [
        {"role": "provider", "owner_id": PRO_ID, "data": {"type": "payment", "booking_id": "b-1"}}
    ]


def test_notify_provider_without_a_professional_does_nothing(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    pushes = []
    monkeypatch.setattr(events.push, "notify", lambda *a, **k: pushes.append(a))
    events.notify_provider(None, "booking", "Title", "Message")
    assert client.log == []
    assert pushes == []


def test_new_request_pings_only_accepting_professionals(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    client.tables["professionals"] = [
        {"id": PRO_ID, "accepting_jobs": True},
        {"id": OTHER_ID, "accepting_jobs": False},
    ]
    pushes = []
    monkeypatch.setattr(
        events.push,
        "notify",
        lambda role, owner_id, title, body, data=None: pushes.append((owner_id, data)),
    )
    events.notify_new_request([PRO_ID, OTHER_ID], "Switch Repair", 2.5, "b-9")

    assert [row["professional_id"] for _, row in client.inserted] == [PRO_ID]
    assert pushes == [(PRO_ID, {"type": "new_request", "booking_id": "b-9"})]
