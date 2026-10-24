import logging
import time
from typing import Optional

import jwt

from . import config
from .exceptions import ApiError

logger = logging.getLogger(__name__)

TOKEN_TTL_SECONDS = 20 * 60


def sign_token(phone: str, role: str, professional_id: Optional[str] = None) -> str:
    issued_at = int(time.time())
    payload = {
        "sub": phone,
        "phone": phone,
        "role": role,
        "iat": issued_at,
        "exp": issued_at + TOKEN_TTL_SECONDS,
    }
    if professional_id:
        payload["professional_id"] = professional_id
    return jwt.encode(payload, config.SUPABASE_JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> dict:
    # The token itself is untrusted input: PyJWT's exception messages embed
    # fragments of what was submitted (and the algorithm state), so they are
    # for the log, never the response.
    try:
        claims = jwt.decode(token, config.SUPABASE_JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        logger.warning("token rejected: %s", e)
        raise ApiError(401, "Invalid or expired token")
    # Tokens issued before the 20-minute session policy did not carry `iat`.
    # Reject those legacy 30-day tokens so the new expiry takes effect after
    # deployment instead of leaving existing sessions valid for weeks.
    if "iat" not in claims:
        raise ApiError(401, "Invalid or expired token")
    if not claims.get("phone") or not claims.get("role"):
        raise ApiError(401, "Token missing phone/role")
    return claims
