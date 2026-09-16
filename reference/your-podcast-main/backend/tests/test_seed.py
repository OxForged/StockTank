"""Tests for the seed.py script."""

import pytest

from app.db import queries
from seed import SAMPLE_EPISODES, SYSTEM_EMAIL, clear, seed


class TestSeed:
    @pytest.mark.anyio
    async def test_seed_creates_episodes(self, db):
        await seed(db)
        episodes = await db.execute("SELECT * FROM episode")
        assert len(episodes) == len(SAMPLE_EPISODES)

    @pytest.mark.anyio
    async def test_seed_creates_user(self, db):
        await seed(db)
        user = await queries.get_user_by_email(db, SYSTEM_EMAIL)
        assert user is not None
        assert user["name"] == "Yifan"

    @pytest.mark.anyio
    async def test_seed_creates_sources(self, db):
        await seed(db)
        sources = await db.execute("SELECT * FROM source")
        expected = sum(len(ep["sources"]) for ep in SAMPLE_EPISODES)
        assert len(sources) == expected

    @pytest.mark.anyio
    async def test_seed_creates_transcript_lines(self, db):
        await seed(db)
        lines = await db.execute("SELECT * FROM transcript_line")
        expected = sum(len(ep["transcript"]) for ep in SAMPLE_EPISODES)
        assert len(lines) == expected

    @pytest.mark.anyio
    async def test_seed_idempotent_user(self, db):
        """Running seed twice doesn't create duplicate users."""
        await seed(db)
        await seed(db)
        users = await db.execute(
            "SELECT * FROM user WHERE email = ?", [SYSTEM_EMAIL]
        )
        assert len(users) == 1

    @pytest.mark.anyio
    async def test_clear_removes_all_seed_data(self, db):
        await seed(db)
        await clear(db)
        assert await db.execute("SELECT * FROM episode") == []
        assert await db.execute("SELECT * FROM source") == []
        assert await db.execute("SELECT * FROM transcript_line") == []
        user = await queries.get_user_by_email(db, SYSTEM_EMAIL)
        assert user is None

    @pytest.mark.anyio
    async def test_clear_on_empty_db(self, db):
        """clear() doesn't fail when there's no seed data."""
        await clear(db)  # should not raise
