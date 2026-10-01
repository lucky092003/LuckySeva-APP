import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

if not SUPABASE_JWT_SECRET:
    # Tokens are signed with an empty key otherwise, and PyJWT raises an opaque
    # "HMAC key must not be empty" 500 on every login instead of this warning.
    logger.warning(
        "SUPABASE_JWT_SECRET is not set - every login will fail. Add it to backend/.env "
        "(Supabase -> Project Settings -> API -> JWT Secret)."
    )


def _flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "300"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "30"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))

# Dev only. OTP_DEBUG returns the generated code in the request-otp response so the
# app can show it on screen while no SMS provider is wired up.
OTP_DEBUG = _flag("OTP_DEBUG")

# Dev only escape hatch: accept any well-formed code and skip OTP checks entirely.
OTP_BYPASS = _flag("OTP_BYPASS")


def require_env(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise EnvironmentError(
            f"Missing required env var: {name}. Copy backend/.env.example to backend/.env and fill from Supabase dashboard."
        )
    return value