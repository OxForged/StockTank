"""DatabaseClient protocol and factory functions."""

import logging
from typing import Protocol

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_db_client: "DatabaseClient | None" = None


class DatabaseClient(Protocol):
    """Protocol shared by D1Client and LocalSQLiteClient."""

    async def execute(self, sql: str, params: list | None = None) -> list[dict]: ...
    async def batch(self, statements: list[dict]) -> list[list[dict]]: ...
    async def aclose(self) -> None: ...


def create_db_client(settings: "Settings | None" = None) -> DatabaseClient:
    """Create a new DB client based on DATABASE_BACKEND setting.

    Used by CLI scripts and background tasks that need their own client.
    """
    s = settings or get_settings()
    if s.database_backend == "d1":
        from app.services.d1 import get_d1_client
        return get_d1_client(s)
    from app.services.local_sqlite import LocalSQLiteClient
    return LocalSQLiteClient()


def init_db() -> DatabaseClient:
    """Initialize the shared DB client. Call once from FastAPI lifespan."""
    global _db_client
    if _db_client is None:
        s = get_settings()
        _db_client = create_db_client(s)
        logger.info("Using %s database", s.database_backend)
    return _db_client


def get_db() -> DatabaseClient:
    """FastAPI dependency — returns the shared DB client."""
    if _db_client is None:
        raise RuntimeError("Database not initialized. Call init_db() in lifespan first.")
    return _db_client
