import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config, links, otp
from app.routers import auth as auth_router

PHONE = "9876543210"


class FakeQuery:
    """Minimal stand-in: selects resolve to nothing, writes are captured."""

    def __init__(self, db, table):
        self.db = db
        self.table = table
        self.mode = "select"
        self.payload: dict | None = None

    def select(self, *_a, **_k):
        self.mode = "select"
        return self

    def upsert(self, row, **_k):
        self.mode = "upsert"
        self.payload = row
        return self

    def insert(self, row):
        self.mode = "insert"
        self.payload = row
        return self

    def eq(self, *_a, **_k):
        return self

    def maybe_single(self):
        self.mode = "maybe_single"
        return self

    def __getattr__(self, _name):
        return lambda *a, **k: self

    def execute(self):
        if self.mode == "insert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            self.db.written.append((self.table, self.payload))
            with_ids = [{**r, "id": f"{self.table}-id"} for r in rows]
            return type("R", (), {"data": with_ids})()
        if self.mode == "upsert":
            self.db.upserted.append((self.table, self.payload))
            return type("R", (), {"data": [self.payload]})()
        return type("R", (), {"data": None})()


class FakeDb:
    def __init__(self):
        self.written: list = []
        self.upserted: list = []

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture(autouse=True)
def clean_store(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "test-secret")
    otp.reset()
    monkeypatch.setattr(otp, "OTP_BYPASS", False)
    yield
    otp.reset()


def install(monkeypatch: pytest.MonkeyPatch) -> FakeDb:
    fake = FakeDb()
    monkeypatch.setattr(auth_router, "db", lambda: fake)
    monkeypatch.setattr(links, "db", lambda: FakeDb())
    return fake


def test_customer_insert_never_writes_null_into_not_null_columns(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch)
    profile = auth_router.find_or_create_customer_profile(PHONE, {"name": "Asha"})
    table, row = fake.written[0]
    assert table == "profiles"
    assert row["phone"] == PHONE
    assert row["email"] == ""
    assert row["location"] == ""
    assert profile["name"] == "Asha"


def test_customer_insert_keeps_the_values_it_was_given(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch)
    auth_router.find_or_create_customer_profile(
        PHONE, {"name": "Asha", "email": "asha@example.com", "location": "Pune"}
    )
    _, row = fake.written[0]
    assert row["email"] == "asha@example.com"
    assert row["location"] == "Pune"


def test_customer_insert_falls_back_to_a_name(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch)
    auth_router.find_or_create_customer_profile(PHONE, {})
    _, row = fake.written[0]
    assert row["name"] == "User 3210"


def test_customer_verify_writes_a_profile_row(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch)
    code = otp.issue_code(PHONE, "customer")
    result = auth_router.verify_otp({"phone": PHONE, "code": code, "role": "customer"})

    assert result["role"] == "customer"
    assert result["access_token"]
    table, row = fake.written[0]
    assert table == "profiles"
    assert row["phone"] == PHONE
    assert row["email"] == "" and row["location"] == ""


def test_provider_verify_upserts_a_profile_row_without_nulls(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = install(monkeypatch)
    code = otp.issue_code(PHONE, "provider")
    result = auth_router.verify_otp(
        {"phone": PHONE, "code": code, "role": "provider", "name": "Ravi", "profession": "Plumber"}
    )

    assert result["role"] == "provider"
    assert result["professional_id"]
    table, row = fake.upserted[0]
    assert table == "profiles"
    assert row["role"] == "provider"
    assert row["email"] == ""
    assert row["location"] == ""
    assert row["name"] == "Ravi"