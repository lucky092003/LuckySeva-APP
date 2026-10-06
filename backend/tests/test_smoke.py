import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app

EXPECTED_PREFIXES = ("/auth", "/catalog", "/customer", "/provider", "/admin")


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_openapi_schema_generates() -> None:
    schema = app.openapi()
    assert schema["info"]["title"] == "LuckySeva API"


def test_all_router_prefixes_are_mounted() -> None:
    paths = app.openapi()["paths"]
    for prefix in EXPECTED_PREFIXES:
        assert any(path.startswith(prefix) for path in paths), f"no routes under {prefix}"


def test_protected_routers_reject_anonymous_requests(client: TestClient) -> None:
    for prefix in ("/customer", "/provider", "/admin"):
        response = client.get(f"{prefix}/bookings")
        assert response.status_code in (401, 403), f"{prefix} allowed an unauthenticated call"


def test_unknown_route_returns_404(client: TestClient) -> None:
    assert client.get("/definitely-not-a-route").status_code == 404


def test_docs_enabled_follows_environment() -> None:
    """Swagger is on for local dev, off in production, overridable either way.

    config is read at import time, so the flag is exercised by reloading the
    module with a controlled environment. The env is restored (and the module
    reloaded back) in `finally` so no other test sees a stale value.
    """
    from app import config

    keys = ("RENDER", "ENV", "API_DOCS_ENABLED")
    saved = {k: os.environ.get(k) for k in keys}
    try:
        for k in keys:
            os.environ.pop(k, None)
        importlib.reload(config)
        assert config.DOCS_ENABLED is True, "dev default should expose /docs"

        os.environ["RENDER"] = "true"
        importlib.reload(config)
        assert config.DOCS_ENABLED is False, "Render should hide /docs"

        os.environ["RENDER"] = "false"
        os.environ["ENV"] = "production"
        importlib.reload(config)
        assert config.DOCS_ENABLED is False, "ENV=production should hide /docs"

        os.environ["API_DOCS_ENABLED"] = "true"
        importlib.reload(config)
        assert config.DOCS_ENABLED is True, "explicit API_DOCS_ENABLED=true must win"
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        importlib.reload(config)
