"""Push notification delivery through Firebase Cloud Messaging.

Best-effort by design. The in-app `notifications` row is always written, so the
bell is correct even with no push credentials; this module only adds delivery
when FCM is configured. A push that fails is recorded in `push_outbox` as
`failed` and never raises into a booking or accept flow - a customer's payment
must not fail because a partner's phone was off.
"""

import json
import logging

from .config import FCM_CREDENTIALS_JSON, FCM_PROJECT_ID, push_configured
from .db import db

logger = logging.getLogger(__name__)

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"

_sender = None
_sent_once = False


def _get_sender():
    """Lazily build the FCM sender.

    Imported inside the function so a deployment without `firebase-admin`
    installed (CI, the edge cases) still imports this module cleanly.
    """
    global _sender, _sent_once
    if _sent_once:
        return _sender
    _sent_once = True
    if not push_configured():
        logger.info("FCM not configured; push notifications are queued but not delivered.")
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging

        if not firebase_admin._apps:
            try:
                info = json.loads(FCM_CREDENTIALS_JSON)
            except ValueError:
                logger.error("FCM_CREDENTIALS_JSON is not valid JSON; push delivery disabled.")
                return None
            firebase_admin.initialize_app(credentials.Certificate(info))
        _sender = messaging.send
    except ImportError:
        logger.warning("firebase-admin is not installed; push notifications will be queued only.")
        _sender = None
    except Exception as exc:  # pragma: no cover - depends on Google SDK internals
        logger.error("Could not initialise FCM: %s", exc)
        _sender = None
    return _sender


def enqueue(role: str, owner_id: str, title: str, body: str, data: dict | None = None) -> str:
    """Record and attempt a push. Returns the outbox status for the caller."""
    client = db()
    payload = {k: str(v) for k, v in (data or {}).items()}
    try:
        res = client.table("push_outbox").insert(
            {
                "role": role,
                "owner_id": owner_id,
                "title": title,
                "body": body,
                "data": payload,
                "status": "queued",
                "provider": "fcm",
            }
        ).execute()
    except Exception as exc:
        logger.warning("Could not record push for %s/%s: %s", role, owner_id, exc)
        return "failed"

    outbox_id = (res.data or [{}])[0].get("id")
    sender = _get_sender()
    if not sender:
        return "queued"

    tokens = (
        client.table("device_tokens")
        .select("token")
        .eq("role", role)
        .eq("owner_id", owner_id)
        .execute()
    ).data or []
    if not tokens:
        _mark(outbox_id, "no_tokens")
        return "no_tokens"

    from firebase_admin import messaging

    message = messaging.MulticastMessage(
        tokens=[t["token"] for t in tokens if t.get("token")],
        notification=messaging.Notification(title=title, body=body),
        data=payload,
        android=messaging.AndroidConfig(priority="high"),
    )
    try:
        result = sender(message)
        _mark(outbox_id, "sent", f"{getattr(result, 'success_count', 0)}/{len(tokens)}")
        return "sent"
    except Exception as exc:
        logger.warning("FCM send failed for %s/%s: %s", role, owner_id, exc)
        _mark(outbox_id, "failed", str(exc)[:300])
        return "failed"


def notify(role: str, owner_id: str, title: str, body: str, data: dict | None = None) -> None:
    """Fire-and-forget wrapper for call sites that must not care about delivery."""
    try:
        enqueue(role, owner_id, title, body, data)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("push notification dropped for %s/%s: %s", role, owner_id, exc)


def notify_new_request(professional_ids: list[str], service_name: str, distance_km: float | None) -> None:
    """Tell a professional a new job landed in their field (#25).

    Only professionals who are actively accepting jobs are pinged, so switching
    off the availability toggle really does stop the interruptions.
    """
    if not professional_ids:
        return
    client = db()
    rows = (
        client.table("professionals")
        .select("id")
        .in_("id", professional_ids)
        .eq("accepting_jobs", True)
        .execute()
    ).data or []
    for row in rows:
        where = f" {distance_km:.1f} km away" if isinstance(distance_km, (int, float)) else ""
        notify(
            "provider",
            row["id"],
            "New request nearby",
            f"{service_name}{where} - tap to accept before it expires.",
            {"type": "new_request"},
        )


def _mark(outbox_id: str | None, status: str, error: str = "") -> None:
    if not outbox_id:
        return
    try:
        db().table("push_outbox").update({"status": status, "error": error}).eq("id", outbox_id).execute()
    except Exception as exc:
        logger.warning("Could not update push_outbox %s: %s", outbox_id, exc)


def is_configured() -> bool:
    return push_configured() and bool(FCM_PROJECT_ID)