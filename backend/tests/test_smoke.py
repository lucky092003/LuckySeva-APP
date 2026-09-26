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
