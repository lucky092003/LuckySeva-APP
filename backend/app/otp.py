"""Phone OTP issuing and verification.

The flow is deliberately split into two calls so the client cannot skip the step
that actually sends a code:

1. ``POST /auth/request-otp`` -> ``issue_code`` generates, hashes and hands back a code.
2. ``POST /auth/verify-otp``   -> ``consume_code`` checks the submitted code against it.

Codes are never stored in plaintext: only a PBKDF2-HMAC-SHA256 hash with a random
per-code salt. Every ``consume_code`` call is rate limited three ways: expiry,
a hard attempt cap, and single use.

State lives in this process, so codes do not survive a restart and only work on
the instance that issued them. Set ``OTP_BYPASS=true`` (dev only) to accept any code.
"""

import hmac
import logging
import secrets
import threading
import time
from dataclasses import dataclass
from hashlib import pbkdf2_hmac

from .config import (
    OTP_BYPASS,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_SECONDS,
)
from .exceptions import ApiError

logger = logging.getLogger(__name__)

OTP_LENGTH = 6
OTP_ALPHABET = "0123456789"
PBKDF2_ITERATIONS = 200_000


@dataclass
class _Entry:
    salt: bytes
    code_hash: str
    issued_at: float
    expires_at: float
    attempts: int = 0
    consumed: bool = False


_codes: dict[tuple[str, str], _Entry] = {}
_lock = threading.Lock()


def _now() -> float:
    return time.monotonic()


def _is_code_format(code) -> bool:
    return isinstance(code, str) and len(code) == OTP_LENGTH and code.isdigit()


def generate_code() -> str:
    """Cryptographically secure 6-digit code."""
    return "".join(secrets.choice(OTP_ALPHABET) for _ in range(OTP_LENGTH))


def _hash(code: str, salt: bytes) -> str:
    return pbkdf2_hmac("sha256", code.encode("utf-8"), salt, PBKDF2_ITERATIONS).hex()


def reset() -> None:
    """Drop every pending code (used by tests)."""
    with _lock:
        _codes.clear()


def issue_code(phone: str, role: str) -> str:
    """Generate, store and return the plaintext code for delivery.

    Raises :class:`ApiError` when the previous code for this phone is still
    inside the resend cooldown.
    """
    key = (phone, role)
    code = generate_code()
    salt = secrets.token_hex(16)
    now = _now()
    entry = _Entry(
        salt=salt.encode("utf-8"),
        code_hash=_hash(code, salt.encode("utf-8")),
        issued_at=now,
        expires_at=now + OTP_TTL_SECONDS,
    )
    with _lock:
        previous = _codes.get(key)
        if previous and not previous.consumed:
            elapsed = now - previous.issued_at
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
                wait = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed) + 1
                raise ApiError(429, f"Please wait {wait}s before requesting another code.")
        _codes[key] = entry

    _purge_expired()
    if OTP_BYPASS:
        logger.warning("OTP_BYPASS active - issued code for +91%s/%s is ignored", phone, role)
    return code


def consume_code(phone: str, role: str, code) -> None:
    """Raise :class:`ApiError` unless ``code`` is the live, unused, unexpired OTP."""
    if not _is_code_format(code):
        raise ApiError(400, f"OTP must be a {OTP_LENGTH}-digit code")

    if OTP_BYPASS:
        logger.warning("OTP_BYPASS active - accepted any code for +91%s/%s", phone, role)
        with _lock:
            _codes.pop((phone, role), None)
        return

    key = (phone, role)
    now = _now()
    with _lock:
        entry = _codes.get(key)
        if entry is None:
            raise ApiError(400, "Request a new OTP.")
        if entry.consumed:
            raise ApiError(400, "This code has already been used. Request a new OTP.")
        if now >= entry.expires_at:
            _codes.pop(key, None)
            raise ApiError(410, "This code has expired. Request a new OTP.")
        if not hmac.compare_digest(entry.code_hash, _hash(code, entry.salt)):
            entry.attempts += 1
            left = OTP_MAX_ATTEMPTS - entry.attempts
            if left <= 0:
                _codes.pop(key, None)
                raise ApiError(429, "Too many incorrect attempts. Request a new OTP.")
            raise ApiError(403, f"Incorrect OTP. {left} attempt(s) left.")
        entry.consumed = True


def _purge_expired() -> None:
    now = _now()
    with _lock:
        for key, entry in list(_codes.items()):
            if entry.consumed or now >= entry.expires_at:
                _codes.pop(key, None)