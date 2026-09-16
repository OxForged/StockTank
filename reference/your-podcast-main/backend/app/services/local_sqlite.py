"""Local SQLite client for development — same interface as D1Client."""

import logging
import os

import aiosqlite
from sqlalchemy import create_engine

from app.db.tables import metadata

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "local.db")


class LocalSQLiteClient:
    """Drop-in replacement for D1Client using local SQLite via aiosqlite."""

    def __init__(self, db_path: str = DB_PATH) -> None:
        self._db_path = os.path.abspath(db_path)
        self._conn: aiosqlite.Connection | None = None

    async def _get_conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            need_init = not os.path.exists(self._db_path)
            self._conn = await aiosqlite.connect(self._db_path)
            self._conn.row_factory = aiosqlite.Row
            await self._conn.execute("PRAGMA journal_mode=WAL")
            await self._conn.execute("PRAGMA foreign_keys=ON")
            if need_init:
                logger.info("Initializing local SQLite database at %s", self._db_path)
                engine = create_engine(f"sqlite:///{self._db_path}")
                metadata.create_all(engine)
                engine.dispose()
                logger.info("Local database schema created.")
        return self._conn

    async def execute(self, sql: str, params: list | None = None) -> list[dict]:
        conn = await self._get_conn()
        cursor = await conn.execute(sql, params or [])
        rows = await cursor.fetchall()
        # Only commit for write operations
        if not sql.strip().upper().startswith(("SELECT", "PRAGMA")):
            await conn.commit()
        return [dict(row) for row in rows]

    async def batch(self, statements: list[dict]) -> list[list[dict]]:
        conn = await self._get_conn()
        all_results: list[list[dict]] = []
        for stmt in statements:
            cursor = await conn.execute(stmt["sql"], stmt.get("params", []))
            rows = await cursor.fetchall()
            all_results.append([dict(row) for row in rows])
        await conn.commit()
        return all_results

    async def aclose(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None
