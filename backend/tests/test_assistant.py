import asyncio
import base64
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config
from app.exceptions import ApiError
from app.routers import assistant


class FakeInteractions:
    def __init__(self, result, captured):
        self.result = result
        self.captured = captured

    async def create(self, **kwargs):
        self.captured["request"] = kwargs
        return self.result


class FakeGeminiClient:
    def __init__(self, api_key, result, captured):
        captured["api_key"] = api_key
        self.aio = SimpleNamespace(
            interactions=FakeInteractions(result, captured),
            aclose=self._aclose,
        )

    async def _aclose(self):
        return None


def patch_gemini(monkeypatch: pytest.MonkeyPatch, output_text: str, captured: dict) -> None:
    def create_client(api_key):
        return FakeGeminiClient(api_key, SimpleNamespace(output_text=output_text), captured)

    monkeypatch.setattr(assistant.genai, "Client", create_client)


def test_assistant_requires_a_backend_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "AI_API_KEY", "")
    request = assistant.ChatRequest(messages=[assistant.ChatMessage(role="user", content="Hi")])

    with pytest.raises(ApiError) as error:
        asyncio.run(assistant.chat(request, {"role": "customer"}))

    assert error.value.status == 503
    assert error.value.code == "ai_not_configured"


def test_assistant_rejects_admin_role(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "AI_API_KEY", "test-key")
    request = assistant.ChatRequest(messages=[assistant.ChatMessage(role="user", content="Hi")])

    with pytest.raises(ApiError) as error:
        asyncio.run(assistant.chat(request, {"role": "admin"}))

    assert error.value.status == 403


def test_chat_message_has_a_length_limit() -> None:
    with pytest.raises(ValidationError):
        assistant.ChatRequest(messages=[assistant.ChatMessage(role="user", content="x" * 2001)])


@pytest.mark.parametrize(
    ("role", "role_prompt"),
    [("customer", "user is a customer"), ("provider", "user is a service provider")],
)
def test_chat_uses_gemini_interactions_and_role_prompt(
    monkeypatch: pytest.MonkeyPatch, role: str, role_prompt: str
) -> None:
    monkeypatch.setattr(config, "AI_API_KEY", "server-only-test-key")
    monkeypatch.setattr(config, "AI_MODEL", "gemini-test-model")
    captured: dict = {}
    patch_gemini(monkeypatch, "Hello from Lucky", captured)
    request = assistant.ChatRequest(
        messages=[
            assistant.ChatMessage(role="user", content="Can you help?"),
            assistant.ChatMessage(role="assistant", content="Of course."),
        ]
    )

    result = asyncio.run(assistant.chat(request, {"role": role}))

    interaction_request = captured["request"]
    assert result == {"reply": "Hello from Lucky"}
    assert captured["api_key"] == "server-only-test-key"
    assert interaction_request["model"] == "gemini-test-model"
    assert interaction_request["store"] is False
    assert role_prompt in interaction_request["system_instruction"]
    speaker = "Customer" if role == "customer" else "Provider"
    assert f"{speaker}: Can you help?" in interaction_request["input"]
    assert "Lucky: Of course." in interaction_request["input"]


def test_voice_transcription_uses_gemini_inline_audio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "AI_API_KEY", "server-only-test-key")
    monkeypatch.setattr(config, "AI_MODEL", "gemini-test-model")
    captured: dict = {}
    patch_gemini(monkeypatch, "Please help me book a plumber.", captured)

    async def receive():
        return {"type": "http.request", "body": b"fake-audio-data", "more_body": False}

    request = Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/assistant/transcribe",
            "raw_path": b"/assistant/transcribe",
            "query_string": b"",
            "headers": [(b"content-type", b"audio/webm")],
            "client": ("127.0.0.1", 1234),
            "server": ("testserver", 80),
        },
        receive,
    )

    result = asyncio.run(assistant.transcribe(request, {"role": "customer"}))

    audio_part = captured["request"]["input"][1]
    assert result == {"text": "Please help me book a plumber."}
    assert captured["api_key"] == "server-only-test-key"
    assert captured["request"]["model"] == "gemini-test-model"
    assert captured["request"]["store"] is False
    assert audio_part["mime_type"] == "audio/webm"
    assert base64.b64decode(audio_part["data"]) == b"fake-audio-data"
