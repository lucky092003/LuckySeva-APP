import asyncio
import json
import sys
from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import config
from app.exceptions import ApiError
from app.routers import assistant


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
def test_chat_uses_the_role_prompt_and_keeps_api_key_server_side(
    monkeypatch: pytest.MonkeyPatch, role: str, role_prompt: str
) -> None:
    monkeypatch.setattr(config, "AI_API_KEY", "server-only-test-key")
    monkeypatch.setattr(config, "AI_BASE_URL", "https://ai.example.test/v1")
    monkeypatch.setattr(config, "AI_MODEL", "test-model")
    captured: dict = {}
    actual_async_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        captured["authorization"] = request.headers.get("authorization")
        captured["payload"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": "Hello from Lucky"}}]})

    def mock_client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return actual_async_client(*args, **kwargs)

    monkeypatch.setattr(assistant.httpx, "AsyncClient", mock_client)
    request = assistant.ChatRequest(messages=[assistant.ChatMessage(role="user", content="Can you help?")])

    result = asyncio.run(assistant.chat(request, {"role": role}))

    assert result == {"reply": "Hello from Lucky"}
    assert captured["authorization"] == "Bearer server-only-test-key"
    assert captured["payload"]["model"] == "test-model"
    assert role_prompt in captured["payload"]["messages"][0]["content"]


def test_voice_transcription_uses_backend_key_and_returns_text(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "AI_API_KEY", "server-only-test-key")
    monkeypatch.setattr(config, "AI_BASE_URL", "https://ai.example.test/v1")
    monkeypatch.setattr(config, "AI_TRANSCRIPTION_MODEL", "test-transcribe-model")
    captured: dict = {}
    actual_async_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        captured["authorization"] = request.headers.get("authorization")
        captured["content_type"] = request.headers.get("content-type", "")
        captured["body"] = request.read()
        return httpx.Response(200, json={"text": "Please help me book a plumber."})

    def mock_client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return actual_async_client(*args, **kwargs)

    monkeypatch.setattr(assistant.httpx, "AsyncClient", mock_client)

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

    assert result == {"text": "Please help me book a plumber."}
    assert captured["authorization"] == "Bearer server-only-test-key"
    assert "test-transcribe-model" in captured["body"].decode("latin-1")
    assert b"fake-audio-data" in captured["body"]
