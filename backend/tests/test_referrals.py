"""Referral endpoints: code assignment, claim guards and coupon issuance.

The endpoints are exercised through the FastAPI router functions directly with
a FakeDb — the same approach as test_auth_profiles.py — because the actual
guards (own-code, already-claimed, unknown code) live in handler code, not in
the database.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.events as events  # noqa: E402
from app.exceptions import ApiError  # noqa: E402
from app.routers import customer as customer_router  # noqa: E402

REFERRER = "9811100000"
REFEREE = "9822200000"


class FakeQuery:
    """Selects filter seeded rows; writes are recorded and given an id."""

    def __init__(self, db, table):
        self.db = db
        self.table = table
        self.mode = "select"
        self.payloads: list = []
        self.filters: dict = {}

    def select(self, *_a, **_k):
        # A write ends with .select() to return the affected rows; only a bare
        # query's leading .select() decides SELECT mode.
        if self.mode in (None, "select"):
            self.mode = "select"
        return self

    def insert(self, row):
        self.mode = "insert"
        self.payloads.append(row)
        return self

    def update(self, row):
        self.mode = "update"
        self.payloads.append(row)
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def maybe_single(self):
        self.mode = "maybe_single"
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, _n):
        return self

    def execute(self):
        if self.mode == "insert":
            self.db.written.append((self.table, dict(self.filters), self.payloads[-1]))
            return type("R", (), {"data": [self.payloads[-1]]})()
        if self.mode == "update":
            self.db.updated.append((self.table, dict(self.filters), self.payloads[-1]))
            merged = {**self.payloads[-1], **self.filters}
            return type("R", (), {"data": [merged]})()
        rows = self.db.rows.get(self.table) or []
        matched = [r for r in rows if all(r.get(c) == v for c, v in self.filters.items())]
        if self.mode == "maybe_single":
            return type("R", (), {"data": matched[0] if matched else None})()
        return type("R", (), {"data": matched})()


class FakeDb:
    def __init__(self, rows: dict | None = None):
        self.written: list = []
        self.updated: list = []
        self.rows = rows or {}

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture()
def fake_db(monkeypatch: pytest.MonkeyPatch):
    fake = FakeDb()
    monkeypatch.setattr(customer_router, "db", lambda: fake)
    monkeypatch.setattr(events, "db", lambda: FakeDb())
    return fake


def _caller(phone: str) -> dict:
    return {"phone": phone, "role": "customer"}


def test_me_assigns_and_stamps_a_code_the_first_time(fake_db: FakeDb) -> None:
    fake_db.rows["profiles"] = [{"phone": REFERRER, "referral_code": None}]
    out = customer_router.referral_me(_caller(REFERRER))
    assert out["code"] and out["code"].startswith("LS")
    # the stamped code was written back to profiles
    table, filters, row = fake_db.updated[0]
    assert table == "profiles" and filters == {"phone": REFERRER}
    assert row["referral_code"] == out["code"]


def test_me_keeps_an_existing_code(fake_db: FakeDb) -> None:
    fake_db.rows["profiles"] = [{"phone": REFERRER, "referral_code": "LSABCD23"}]
    out = customer_router.referral_me(_caller(REFERRER))
    assert out["code"] == "LSABCD23"
    assert fake_db.updated == []


def test_me_counts_invited_friends(fake_db: FakeDb) -> None:
    fake_db.rows["profiles"] = [{"phone": REFERRER, "referral_code": "LSABCD23"}]
    fake_db.rows["referrals"] = [
        {"id": "r1", "referrer_phone": REFERRER, "referee_phone": "x"},
        {"id": "r2", "referrer_phone": REFERRER, "referee_phone": "y"},
    ]
    out = customer_router.referral_me(_caller(REFERRER))
    assert out["invited"] == 2
    assert out["earned"] == 200.0


def test_claim_issues_both_coupons_and_wires_the_pair(fake_db: FakeDb) -> None:
    fake_db.rows["profiles"] = [
        {"phone": REFERRER, "name": "Asha", "referral_code": "LSABCD23"},
    ]
    out = customer_router.referral_claim({"code": "lsabcd23"}, _caller(REFEREE))

    assert out["ok"] is True
    inserted = [(t, row) for t, _, row in fake_db.written]
    coupons = [row for t, row in inserted if t == "coupons"]
    referrals = [row for t, row in inserted if t == "referrals"]
    assert len(coupons) == 2
    # referee reward is first-booking only, referrer reward is not
    kinds = sorted(c["first_booking_only"] for c in coupons)
    assert kinds == [False, True]
    assert all(c["discount_value"] == 100.0 for c in coupons)
    assert referrals == [
        {
            "referrer_phone": REFERRER,
            "referee_phone": REFEREE,
            "code": "LSABCD23",
            "status": "rewarded",
            "referrer_coupon_code": fake_db.written[1][2]["code"],
            "referee_coupon_code": fake_db.written[0][2]["code"],
        }
    ]
    # the code is matched case-insensitively
    assert referrals[0]["code"] == "LSABCD23"


def test_claim_rejects_an_unknown_code(fake_db: FakeDb) -> None:
    fake_db.rows["profiles"] = [{"phone": REFERRER, "referral_code": "LSABCD23"}]
    with pytest.raises(ApiError) as err:
        customer_router.referral_claim({"code": "LSNOPE99"}, _caller(REFEREE))
    assert err.value.status == 404


def test_claim_rejects_ones_own_code(fake_db: FakeDb) -> None:
    fake_db.rows["profiles"] = [{"phone": REFERRER, "referral_code": "LSABCD23"}]
    with pytest.raises(ApiError) as err:
        customer_router.referral_claim({"code": "LSABCD23"}, _caller(REFERRER))
    assert err.value.status == 400
    assert "own" in err.value.message


def test_claim_is_one_time_per_account(fake_db: FakeDb) -> None:
    fake_db.rows["profiles"] = [
        {"phone": REFERRER, "name": "Asha", "referral_code": "LSABCD23"},
        {"phone": "9833300000", "name": "B", "referral_code": "LSWXYZ89"},
    ]
    fake_db.rows["referrals"] = [
        {"id": "r1", "referee_phone": REFEREE, "referrer_phone": REFERRER},
    ]
    with pytest.raises(ApiError) as err:
        customer_router.referral_claim({"code": "LSWXYZ89"}, _caller(REFEREE))
    assert err.value.status == 400
    assert "already" in err.value.message


def test_claim_requires_a_code(fake_db: FakeDb) -> None:
    with pytest.raises(ApiError) as err:
        customer_router.referral_claim({}, _caller(REFEREE))
    assert err.value.status == 400
