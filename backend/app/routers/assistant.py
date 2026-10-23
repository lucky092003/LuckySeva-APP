"""Role-aware, OpenAI-compatible chat assistant for customers and providers."""

import logging
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from .. import config
from ..dependencies import get_claims
from ..exceptions import ApiError

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_MESSAGES = 16
MAX_AUDIO_BYTES = 8 * 1024 * 1024

COMMON_INSTRUCTIONS = """You are LuckySeva's helpful home-services assistant.
Reply in the language used by the user, including Hindi or Hinglish. Keep answers
clear, friendly, and concise. Never ask for passwords, OTPs, UPI PINs, card
details, or other secrets. You cannot view or change a user's live bookings,
payments, refunds, or account; do not claim that you performed an action. Guide
the user to the relevant screen instead. Do not invent service prices, provider
availability, or account-specific facts. If unsure, say so."""

ROLE_INSTRUCTIONS = {
    "customer": """The user is a customer. Help them understand services, booking,
addresses, tracking, payments, cancellations, and support. For actions, explain
where they can do it in the LuckySeva app rather than pretending to do it.""",
    "provider": """The user is a service provider. Help with incoming requests,
booking workflow, location sharing, service availability, profile, and earnings.
Do not accept/decline jobs or change provider/account data; direct them to the
relevant Partner app screen.""",
}


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)


@router.post("/chat")
async def chat(body: ChatRequest, claims: dict = Depends(get_claims)):
    role = claims.get("role")
    if role not in ROLE_INSTRUCTIONS:
        raise ApiError(403, "The assistant is available to customers and providers only.")
    if not config.AI_API_KEY:
        raise ApiError(
            503,
            "The AI assistant is not configured yet. Add AI_API_KEY to the backend environment.",
            "ai_not_configured",
        )

    messages = [
        {"role": "system", "content": f"{COMMON_INSTRUCTIONS}\n\n{ROLE_INSTRUCTIONS[role]}"},
        *[{"role": message.role, "content": message.content.strip()} for message in body.messages[-MAX_MESSAGES:]],
    ]
    if any(not message["content"] for message in messages[1:]):
        raise ApiError(422, "Messages cannot be empty.")

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=10.0)) as client:
            response = await client.post(
                f"{config.AI_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {config.AI_API_KEY}"},
                json={"model": config.AI_MODEL, "messages": messages, "max_tokens": 500, "temperature": 0.4},
            )
    except httpx.TimeoutException as exc:
        logger.warning("AI assistant request timed out: %s", type(exc).__name__)
        raise ApiError(504, "The assistant took too long to respond. Please try again.", "ai_timeout") from exc
    except httpx.HTTPError as exc:
        logger.warning("AI assistant request failed: %s", type(exc).__name__)
        raise ApiError(502, "The assistant is temporarily unavailable. Please try again.", "ai_unavailable") from exc

    if response.is_error:
        logger.warning("AI assistant upstream returned HTTP %s", response.status_code)
        if response.status_code == 429:
            raise ApiError(503, "The assistant is busy right now. Please try again shortly.", "ai_rate_limited")
        raise ApiError(502, "The assistant is temporarily unavailable. Please try again.", "ai_unavailable")

    try:
        payload = response.json()
        reply = payload["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        logger.warning("AI assistant returned an unexpected response shape")
        raise ApiError(502, "The assistant returned an unreadable response. Please try again.", "ai_bad_response") from exc

    if not isinstance(reply, str) or not reply.strip():
        raise ApiError(502, "The assistant returned an empty response. Please try again.", "ai_empty_response")
    return {"reply": reply.strip()}


@router.post("/transcribe")
async def transcribe(request: Request, claims: dict = Depends(get_claims)):
    """Transcribe a short voice note without ever exposing the AI key to clients."""
    if claims.get("role") not in ROLE_INSTRUCTIONS:
        raise ApiError(403, "Voice assistant is available to customers and providers only.")
    if not config.AI_API_KEY:
        raise ApiError(
            503,
            "The AI assistant is not configured yet. Add AI_API_KEY to the backend environment.",
            "ai_not_configured",
        )

    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if not content_type.startswith("audio/"):
        raise ApiError(415, "Please record an audio message and try again.", "audio_type_invalid")

    audio = bytearray()
    async for chunk in request.stream():
        audio.extend(chunk)
        if len(audio) > MAX_AUDIO_BYTES:
            raise ApiError(413, "Voice messages must be 8 MB or smaller.", "audio_too_large")
    if not audio:
        raise ApiError(400, "The voice recording was empty. Please try again.", "audio_empty")

    extension = {
        "audio/mp4": "mp4",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/webm": "webm",
    }.get(content_type, "webm")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = await client.post(
                f"{config.AI_BASE_URL}/audio/transcriptions",
                headers={"Authorization": f"Bearer {config.AI_API_KEY}"},
                data={"model": config.AI_TRANSCRIPTION_MODEL},
                files={"file": (f"voice.{extension}", bytes(audio), content_type)},
            )
    except httpx.TimeoutException as exc:
        logger.warning("AI voice transcription timed out")
        raise ApiError(504, "Voice transcription took too long. Please try again.", "ai_timeout") from exc
    except httpx.HTTPError as exc:
        logger.warning("AI voice transcription request failed: %s", type(exc).__name__)
        raise ApiError(502, "Voice transcription is temporarily unavailable.", "ai_unavailable") from exc

    if response.is_error:
        logger.warning("AI transcription upstream returned HTTP %s", response.status_code)
        if response.status_code == 429:
            raise ApiError(503, "Voice service is busy right now. Please try again shortly.", "ai_rate_limited")
        raise ApiError(502, "Voice transcription is temporarily unavailable.", "ai_unavailable")
    try:
        text = response.json().get("text")
    except (ValueError, AttributeError) as exc:
        logger.warning("AI transcription returned an unexpected response shape")
        raise ApiError(502, "Voice transcription returned an unreadable response.", "ai_bad_response") from exc
    if not isinstance(text, str) or not text.strip():
        raise ApiError(502, "No speech was detected. Please try again.", "ai_no_speech")
    return {"text": text.strip()}
