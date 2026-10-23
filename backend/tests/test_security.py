import sys
from pathlib import Path

import jwt
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config, security
from app.exceptions import ApiError


def test_signed_session_token_expires_after_twenty_minutes(monkeypatch) -> None:
    issued_at = 1_800_000_000
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setattr(security.time, "time", lambda: issued_at)

    token = security.sign_token("9876543210", "provider", "professional-1")
    claims = jwt.decode(
        token,
        "test-secret",
        algorithms=["HS256"],
        options={"verify_exp": False, "verify_iat": False},
    )

    assert claims["iat"] == issued_at
    assert claims["exp"] == issued_at + 20 * 60
    assert claims["role"] == "provider"
    assert claims["professional_id"] == "professional-1"


def test_legacy_token_without_issued_at_is_rejected(monkeypatch) -> None:
    monkeypatch.setattr(config, "SUPABASE_JWT_SECRET", "test-secret")
    legacy_token = jwt.encode(
        {
            "sub": "9876543210",
            "phone": "9876543210",
            "role": "customer",
            "exp": 4_000_000_000,
        },
        "test-secret",
        algorithm="HS256",
    )

    with pytest.raises(ApiError) as error:
        security.verify_token(legacy_token)

    assert error.value.status == 401
    assert error.value.message == "Invalid or expired token"
