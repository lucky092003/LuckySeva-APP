"""Admin mutation guards: deletes must not lie, tokens must not leak internals."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.exceptions import ApiError  # noqa: E402
from app.routers import admin as admin_router  # noqa: E402
from app.security import verify_token  # noqa: E402


class FakeQuery:
    def __init__(self, db, table):
        self.db = db
        self.table = table
        self.mode = "select"
        self.payload = None
        self.filters: dict = {}

    def select(self, *_a, **_k):
        if self.mode not in ("insert", "update", "delete"):
            self.mode = "select"
        return self

    def delete(self):
        self.mode = "delete"
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def maybe_single(self):
        self.mode = "maybe_single"
        return self

    def insert(self, row):
        self.mode = "insert"
        self.payload = row
        return self

    def execute(self):
        if self.mode == "insert":
            self.db.written.append((self.table, self.payload))
            return type("R", (), {"data": [self.payload]})()
        if self.mode == "delete":
            self.db.deleted.append((self.table, dict(self.filters)))
            return type("R", (), {"data": []})()
        rows = self.db.rows.get(self.table) or []
        matched = [r for r in rows if all(r.get(c) == v for c, v in self.filters.items())]
        if self.mode == "maybe_single":
            return type("R", (), {"data": matched[0] if matched else None})()
        return type("R", (), {"data": matched})()


class FakeDb:
    def __init__(self, rows: dict | None = None):
        self.written: list = []
        self.deleted: list = []
        self.rows = rows or {}

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture()
def fake_db(monkeypatch: pytest.MonkeyPatch):
    fake = FakeDb()
    monkeypatch.setattr(admin_router, "db", lambda: fake)
    return fake


def test_delete_professional_404s_when_missing(fake_db: FakeDb) -> None:
    fake_db.rows["professionals"] = []
    with pytest.raises(ApiError) as err:
        admin_router.delete_professional("no-such-id")
    assert err.value.status == 404
    # and nothing was actually deleted or audited
    assert fake_db.deleted == []
    assert fake_db.written == []


def test_delete_professional_deletes_and_audits_when_present(fake_db: FakeDb) -> None:
    fake_db.rows["professionals"] = [{"id": "pro-1", "name": "Ravi"}]
    out = admin_router.delete_professional("pro-1")
    assert out == {"ok": True}
    assert fake_db.deleted == [("professionals", {"id": "pro-1"})]
    assert fake_db.written[0][0] == "audit_logs"
    assert "Ravi" in fake_db.written[0][1]["detail"]


def test_verify_token_gives_a_clean_message_not_pyjwt_internals(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.config.SUPABASE_JWT_SECRET", "test-secret")
    with pytest.raises(ApiError) as err:
        verify_token("not-a-token-parts")
    assert err.value.status == 401
    assert "not-a-token" not in err.value.message
    assert err.value.message == "Invalid or expired token"


def test_verify_token_past_expiry_is_rejected_cleanly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.config.SUPABASE_JWT_SECRET", "test-secret")
    expired = __import__("jwt").encode(
        {"sub": "9970000000", "phone": "9970000000", "role": "customer", "exp": 1},
        "test-secret",
        algorithm="HS256",
    )
    with pytest.raises(ApiError) as err:
        verify_token(expired)
    assert err.value.status == 401
    assert err.value.message == "Invalid or expired token"
