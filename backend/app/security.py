import time
from typing import Optional

import jwt

from . import config
from .exceptions import ApiError

TOKEN_TTL_DAYS = 30


def sign_token(phone: str, role: str, professional_id: Optional[str] = None) -> str:
    payload = {
        "sub": phone,
        "phone": phone,
        "role": role,
        "exp": int(time.time()) + 60 * 60 * 24 * TOKEN_TTL_DAYS,
    }
    if professional_id:
        payload["professional_id"] = professional_id
    return jwt.encode(payload, config.SUPABASE_JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> dict:
    try:
        claims = jwt.decode(token, config.SUPABASE_JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise ApiError(401, f"Invalid token: {e}")
    if not claims.get("phone") or not claims.get("role"):
        raise ApiError(401, "Token missing phone/role")
    return claims