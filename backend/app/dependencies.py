from typing import Optional

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .exceptions import ApiError
from .security import verify_token

_bearer = HTTPBearer(auto_error=False)


def get_claims(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> dict:
    if not creds or not creds.credentials:
        raise ApiError(401, "Missing Authorization header (Bearer <token>)")
    return verify_token(creds.credentials)


def require_role(role: str):
    def checker(claims: dict = Depends(get_claims)) -> dict:
        if claims.get("role") != role:
            raise ApiError(403, f"{role.capitalize()} token required")
        return claims

    return checker


require_customer = require_role("customer")
require_provider = require_role("provider")
require_admin = require_role("admin")


def bearer(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:]
    return None