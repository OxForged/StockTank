import sqlite3

import pytest
from httpx import ASGITransport, AsyncClient

from app.auth import create_session_cookie, SESSION_COOKIE_NAME
from app.config import Settings
from app.db import get_db
from app.db.tables import metadata
from app.services.d1 import D1Client


class FakeD1Client(D1Client):
    """D1Client backed by in-memory SQLite for testing."""

    def __init__(self):
        # Skip parent __init__ — we don't need Cloudflare credentials
        self._conn = sqlite3.connect(":memory:")
        self._conn.row_factory = sqlite3.Row
        # Use SQLAlchemy metadata to create tables (single source of truth)
        from sqlalchemy import create_engine
        engine = create_engine("sqlite://", creator=lambda: self._conn)
        metadata.create_all(engine)
        self._conn.commit()

    async def execute(self, sql: str, params: list | None = None) -> list[dict]:
        cursor = self._conn.execute(sql, params or [])
        self._conn.commit()
        if cursor.description:
            return [dict(row) for row in cursor.fetchall()]
        return []

    async def batch(self, statements: list[dict]) -> list[list[dict]]:
        results = []
        for stmt in statements:
            cursor = self._conn.execute(stmt["sql"], stmt.get("params", []))
            if cursor.description:
                results.append([dict(row) for row in cursor.fetchall()])
            else:
                results.append([])
        self._conn.commit()
        return results


# ── Test settings (no .env needed) ──────────────────────────────

_test_settings = Settings(
    cloudflare_account_id="test",
    cloudflare_api_token="test",
    d1_database_id="test",
    database_backend="sqlite",
    session_secret="test-secret-key",
    frontend_url="http://localhost:3000",
)


def _get_test_settings() -> Settings:
    return _test_settings


# ── Database fixture ────────────────────────────────────────────

@pytest.fixture()
def db():
    return FakeD1Client()


# ── App / client fixtures ──────────────────────────────────────

@pytest.fixture()
async def client(db):
    from app.config import get_settings
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_settings] = _get_test_settings

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


# ── Data fixtures ──────────────────────────────────────────────

@pytest.fixture()
async def test_user(db):
    from app.db import queries

    user = await queries.upsert_user(
        db,
        email="test@example.com",
        name="Test User",
        avatar_url="https://example.com/avatar.png",
        provider="google",
        provider_id="12345",
    )
    await queries.update_user_interests(db, user["id"], ["AI", "Python"])
    user["interests"] = ["AI", "Python"]
    return user


@pytest.fixture()
def auth_cookie(test_user) -> str:
    return create_session_cookie(test_user["id"], _test_settings)


@pytest.fixture()
async def authenticated_client(client, auth_cookie):
    client.cookies.set(SESSION_COOKIE_NAME, auth_cookie)
    return client
