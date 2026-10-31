"""Role-aware Gemini Interactions API for customer/provider chat and voice."""

import base64
import logging
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, Request
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from .. import config
from ..dependencies import get_claims
from ..exceptions import ApiError

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_MESSAGES = 16
MAX_AUDIO_BYTES = 8 * 1024 * 1024
AI_TIMEOUT_SECONDS = 40
SUPPORTED_AUDIO_MIME_TYPES = {
    "audio/aac",
    "audio/aiff",
    "audio/alaw",
    "audio/flac",
    "audio/l16",
    "audio/m4a",
    "audio/mp3",
    "audio/mpeg",
    "audio/mulaw",
    "audio/ogg",
    "audio/opus",
    "audio/wav",
    "audio/webm",
}
AUDIO_MIME_ALIASES = {"audio/mp4": "audio/m4a", "audio/x-wav": "audio/wav"}

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


def _require_supported_role(claims: dict) -> str:
    role = claims.get("role")
    if role not in ROLE_INSTRUCTIONS:
        raise ApiError(403, "The assistant is available to customers and providers only.")
    return role


def _require_api_key() -> str:
    if not config.AI_API_KEY:
        raise ApiError(
            503,
            "The AI assistant is not configured yet. Add AI_API_KEY to the backend environment.",
            "ai_not_configured",
        )
    return config.AI_API_KEY


def _normalize_audio_mime_type(content_type: str) -> str | None:
    """Return a Gemini-supported audio MIME type, dropping browser codec parameters."""
    mime_type = content_type.split(";", 1)[0].strip().lower()
    mime_type = AUDIO_MIME_ALIASES.get(mime_type, mime_type)
    return mime_type if mime_type in SUPPORTED_AUDIO_MIME_TYPES else None


async def _create_interaction(**kwargs):
    """Call Gemini without persisting chat content in Google's interaction store."""
    client = genai.Client(api_key=_require_api_key())
    try:
        return await client.aio.interactions.create(
            model=config.AI_MODEL,
            store=False,
            timeout=AI_TIMEOUT_SECONDS,
            **kwargs,
        )
    finally:
        await client.aio.aclose()


def _upstream_error(exc: Exception, operation: str) -> ApiError:
    logger.warning("Gemini %s request failed: %s", operation, type(exc).__name__)
    upstream_code = getattr(exc, "code", None)
    if upstream_code == 429 or upstream_code == "RESOURCE_EXHAUSTED":
        return ApiError(503, "Lucky is busy right now. Please try again shortly.", "ai_rate_limited")
    if isinstance(exc, (TimeoutError, httpx.TimeoutException)):
        return ApiError(504, "Lucky took too long to respond. Please try again.", "ai_timeout")
    return ApiError(502, "Lucky is temporarily unavailable. Please try again.", "ai_unavailable")


@router.post("/chat")
async def chat(body: ChatRequest, claims: dict = Depends(get_claims)):
    role = _require_supported_role(claims)
    _require_api_key()

    # Use a stateless transcript as one user input. This avoids retaining user
    # chats at the provider and avoids dropping Gemini's internal interaction steps.
    speaker = "Customer" if role == "customer" else "Provider"
    transcript = "\n".join(
        f"{speaker if message.role == 'user' else 'Lucky'}: {message.content.strip()}"
        for message in body.messages
    )
    if any(not message.content.strip() for message in body.messages):
        raise ApiError(422, "Messages cannot be empty.")

    try:
        interaction = await _create_interaction(
            input=transcript,
            system_instruction=f"{COMMON_INSTRUCTIONS}\n\n{ROLE_INSTRUCTIONS[role]}",
            # Gemini 3.8 Flash rejects deprecated sampling controls such as
            # temperature; keep only the supported output limit.
            generation_config=types.GenerationConfig(max_output_tokens=500),
        )
    except Exception as exc:
        raise _upstream_error(exc, "chat") from exc

    reply = interaction.output_text
    if not isinstance(reply, str) or not reply.strip():
        raise ApiError(502, "Lucky returned an empty response. Please try again.", "ai_empty_response")
    return {"reply": reply.strip()}


@router.post("/transcribe")
async def transcribe(request: Request, claims: dict = Depends(get_claims)):
    """Transcribe a short raw audio recording through Gemini Interactions."""
    _require_supported_role(claims)
    _require_api_key()

    mime_type = _normalize_audio_mime_type(request.headers.get("content-type", ""))
    if mime_type is None:
        raise ApiError(415, "Please record an audio message and try again.", "audio_type_invalid")

    audio = bytearray()
    async for chunk in request.stream():
        audio.extend(chunk)
        if len(audio) > MAX_AUDIO_BYTES:
            raise ApiError(413, "Voice messages must be 8 MB or smaller.", "audio_too_large")
    if not audio:
        raise ApiError(400, "The voice recording was empty. Please try again.", "audio_empty")

    audio_input = [
        {"type": "text", "text": "Generate a transcript of the speech. Return only the words spoken."},
        {
            "type": "audio",
            "data": base64.b64encode(audio).decode("ascii"),
            "mime_type": mime_type,
        },
    ]
    try:
        interaction = await _create_interaction(input=audio_input)
    except Exception as exc:
        raise _upstream_error(exc, "voice transcription") from exc

    text = interaction.output_text
    if not isinstance(text, str) or not text.strip():
        raise ApiError(502, "No speech was detected. Please try again.", "ai_no_speech")
    return {"text": text.strip()}
