import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import otp
from app.exceptions import ApiError
from app.main import app
from app.routers import auth

PHONE = "9876543210"


@pytest.fixture(autouse=True)
def clean_store(monkeypatch: pytest.MonkeyPatch) -> None:
    otp.reset()
    monkeypatch.setattr(otp, "OTP_BYPASS", False)
    yield
    otp.reset()


def test_generate_code_is_six_digits() -> None:
    for _ in range(20):
        code = otp.generate_code()
        assert len(code) == 6
        assert code.isdigit()


def test_codes_are_not_stored_in_plaintext() -> None:
    code = otp.issue_code(PHONE, "customer")
    entry = otp._codes[(PHONE, "customer")]
    assert code not in entry.code_hash
    assert code not in str(entry)


def test_issued_code_verifies() -> None:
    code = otp.issue_code(PHONE, "customer")
    otp.consume_code(PHONE, "customer", code)


def test_a_random_code_is_not_accepted() -> None:
    otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError) as excinfo:
        otp.consume_code(PHONE, "customer", "000000")
    assert excinfo.value.status == 403
    assert "attempt" in excinfo.value.message


def test_wrong_code_keeps_the_right_one_usable() -> None:
    code = otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError):
        otp.consume_code(PHONE, "customer", "111111" if code != "111111" else "222222")
    otp.consume_code(PHONE, "customer", code)


def test_code_is_single_use() -> None:
    code = otp.issue_code(PHONE, "customer")
    otp.consume_code(PHONE, "customer", code)
    with pytest.raises(ApiError) as excinfo:
        otp.consume_code(PHONE, "customer", code)
    assert excinfo.value.status == 400
    assert "already been used" in excinfo.value.message


def test_verify_without_a_code_asks_for_a_new_one() -> None:
    with pytest.raises(ApiError) as excinfo:
        otp.consume_code(PHONE, "customer", "123456")
    assert excinfo.value.status == 400
    assert "Request a new OTP" in excinfo.value.message


def test_code_for_another_phone_is_rejected() -> None:
    code = otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError) as excinfo:
        otp.consume_code("9000000000", "customer", code)
    assert excinfo.value.status == 400
    otp.consume_code(PHONE, "customer", code)


def test_code_for_another_role_is_rejected() -> None:
    code = otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError):
        otp.consume_code(PHONE, "provider", code)


def test_expired_code_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(otp, "OTP_TTL_SECONDS", 300)
    code = otp.issue_code(PHONE, "customer")
    monkeypatch.setattr(otp, "OTP_TTL_SECONDS", 0)
    monkeypatch.setattr(otp, "_now", lambda: 1e9)
    with pytest.raises(ApiError) as excinfo:
        otp.consume_code(PHONE, "customer", code)
    assert excinfo.value.status == 410
    assert "expired" in excinfo.value.message


def test_attempts_are_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(otp, "OTP_MAX_ATTEMPTS", 2)
    otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError):
        otp.consume_code(PHONE, "customer", "000000")
    with pytest.raises(ApiError) as excinfo:
        otp.consume_code(PHONE, "customer", "000000")
    assert excinfo.value.status == 429
    assert "Too many incorrect attempts" in excinfo.value.message
    assert (PHONE, "customer") not in otp._codes


def test_resend_inside_the_cooldown_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(otp, "OTP_RESEND_COOLDOWN_SECONDS", 30)
    otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError) as excinfo:
        otp.issue_code(PHONE, "customer")
    assert excinfo.value.status == 429
    assert "Please wait" in excinfo.value.message


def test_resend_after_the_cooldown_issues_a_new_code(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(otp, "OTP_RESEND_COOLDOWN_SECONDS", 30)
    first = otp.issue_code(PHONE, "customer")
    base = otp._now()
    monkeypatch.setattr(otp, "_now", lambda: base + 31)
    second = otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError):
        otp.consume_code(PHONE, "customer", first)
    otp.consume_code(PHONE, "customer", second)


def test_bypass_accepts_any_code(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(otp, "OTP_BYPASS", True)
    otp.consume_code(PHONE, "customer", "000000")
    with pytest.raises(ApiError):
        otp.consume_code(PHONE, "customer", "abcdef")


def test_malformed_code_is_rejected() -> None:
    otp.issue_code(PHONE, "customer")
    with pytest.raises(ApiError) as excinfo:
        otp.consume_code(PHONE, "customer", "12345a")
    assert excinfo.value.status == 400


# --- routes -------------------------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_request_otp_returns_a_random_code_when_debug_is_on(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth, "OTP_DEBUG", True)
    response = client.post("/auth/request-otp", json={"phone": PHONE, "role": "customer"})
    assert response.status_code == 200
    body = response.json()
    assert body["sent"] is True
    assert body["role"] == "customer"
    assert body["resend_after"] == 30
    assert body["expires_in"] == 300
    assert len(body["debug_code"]) == 6 and body["debug_code"].isdigit()
    otp.consume_code(PHONE, "customer", body["debug_code"])


def test_request_otp_hides_the_code_when_debug_is_off(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(auth, "OTP_DEBUG", False)
    body = client.post("/auth/request-otp", json={"phone": PHONE}).json()
    assert "debug_code" not in body


def test_request_otp_normalises_the_number(client: TestClient) -> None:
    body = client.post("/auth/request-otp", json={"phone": f"+91 {PHONE}"}).json()
    assert body["role"] == "customer"
    assert (PHONE, "customer") in otp._codes


def test_request_otp_rejects_a_bad_number(client: TestClient) -> None:
    response = client.post("/auth/request-otp", json={"phone": "1234"})
    assert response.status_code == 400
    assert "10 digits" in response.json()["error"]


def test_request_otp_rejects_the_admin_role(client: TestClient) -> None:
    body = client.post("/auth/request-otp", json={"phone": PHONE, "role": "admin"}).json()
    assert body["role"] == "customer"


def test_verify_otp_refuses_a_code_that_was_never_issued(client: TestClient) -> None:
    response = client.post("/auth/verify-otp", json={"phone": PHONE, "code": "123456"})
    assert response.status_code == 400
    assert response.json()["error"] == "Request a new OTP."