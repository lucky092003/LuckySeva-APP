import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import one
from app.main import app
from app.routers import catalog


class EmptyResultClient:
    """Stands in for the Supabase client when a query matches zero rows.

    postgrest's maybe_single().execute() returns None for zero rows, so every
    chained call must hand back this stub and execute() must return None.
    """

    def table(self, name):
        return self

    def __getattr__(self, name):
        return lambda *args, **kwargs: self

    def execute(self):
        return None


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def empty_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(catalog, "db", lambda: EmptyResultClient())


def test_one_returns_none_for_zero_rows() -> None:
    assert one(None) is None


def test_one_unwraps_single_response() -> None:
    assert one(SimpleNamespace(data={"id": "abc"})) == {"id": "abc"}


def test_one_preserves_falsy_payloads() -> None:
    assert one(SimpleNamespace(data=None)) is None
    assert one(SimpleNamespace(data=[])) == []


@pytest.mark.parametrize(
    "path",
    [
        "/catalog/categories/no-such-category",
        "/catalog/categories/no-such-category/services",
        "/catalog/services/00000000-0000-0000-0000-000000000000",
        "/catalog/professionals/00000000-0000-0000-0000-000000000000",
    ],
)
def test_missing_catalog_rows_return_404_not_500(
    client: TestClient, empty_supabase: None, path: str
) -> None:
    """Regression: `x.data` on a zero-row maybe_single() raised AttributeError -> 500."""
    response = client.get(path)
    assert response.status_code == 404, f"{path} returned {response.status_code}: {response.text}"


def test_no_router_reads_data_off_a_maybe_single_result() -> None:
    """Static guard so the None-vs-response contract cannot silently regress."""
    routers = Path(__file__).resolve().parent.parent / "app" / "routers"
    offenders: list[str] = []
    for path in routers.glob("*.py"):
        lines = path.read_text(encoding="utf-8").splitlines()
        for index, line in enumerate(lines):
            if "maybe_single()" not in line:
                continue
            for probe in lines[index : index + 4]:
                if probe.lstrip().startswith("return one(") or "= one(" in probe:
                    break
                if ".data" in probe:
                    offenders.append(f"{path.name}:{index + 1} {probe.strip()}")
    assert not offenders, "reads .data off a maybe_single() result:\n" + "\n".join(offenders)


def test_every_router_imports_the_none_safe_helper() -> None:
    routers = Path(__file__).resolve().parent.parent / "app" / "routers"
    for name in ("admin", "auth", "catalog", "customer", "provider"):
        source = (routers / f"{name}.py").read_text(encoding="utf-8")
        assert "from ..db import db, one" in source, f"{name}.py does not import one()"
