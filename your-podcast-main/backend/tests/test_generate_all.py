"""Tests for the generate_all.py batch generation script."""

import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import Settings
from app.db import queries
from app.schemas import TaskStatus


def _test_settings(**overrides) -> Settings:
    defaults = dict(
        cloudflare_account_id="test",
        cloudflare_api_token="test",
        d1_database_id="test",
        session_secret="test",
        gemini_api_key="fake-gemini",
        zhipu_api_key="fake-zhipu",
        r2_account_id="fake-account",
        r2_access_key_id="fake-key",
        r2_secret_access_key="fake-secret",
        r2_bucket_name="fake-bucket",
        r2_public_url="https://cdn.example.com",
        tts_provider="inworld",
        inworld_api_key="fake-inworld",
    )
    defaults.update(overrides)
    return Settings(**defaults)


async def _make_user(db, *, interests=None, daily_generation=1, email=None) -> dict:
    email = email or f"user-{uuid.uuid4().hex[:8]}@test.com"
    user = await queries.upsert_user(
        db,
        email=email,
        name="Test User",
        avatar_url="",
        provider="google",
        provider_id=uuid.uuid4().hex,
    )
    if interests:
        await queries.update_user_interests(db, user["id"], interests)
        user["interests"] = interests
    if daily_generation != 1:
        await db.execute(
            "UPDATE user SET daily_generation = ? WHERE id = ?",
            [daily_generation, user["id"]],
        )
    return user


# ── Query tests ──────────────────────────────────────────────


class TestListDailyGenerationUsers:
    @pytest.mark.anyio
    async def test_returns_users_with_daily_generation_enabled(self, db):
        await _make_user(db, interests=["AI"], daily_generation=1)
        await _make_user(db, interests=["Gaming"], daily_generation=1)

        users = await queries.list_daily_generation_users(db)
        assert len(users) == 2

    @pytest.mark.anyio
    async def test_excludes_users_with_daily_generation_disabled(self, db):
        await _make_user(db, interests=["AI"], daily_generation=1)
        await _make_user(db, interests=["Gaming"], daily_generation=0)

        users = await queries.list_daily_generation_users(db)
        assert len(users) == 1
        assert users[0]["interests"] == ["AI"]

    @pytest.mark.anyio
    async def test_returns_empty_when_no_users(self, db):
        users = await queries.list_daily_generation_users(db)
        assert users == []

    @pytest.mark.anyio
    async def test_deserializes_interests(self, db):
        await _make_user(db, interests=["AI", "Science"], daily_generation=1)

        users = await queries.list_daily_generation_users(db)
        assert users[0]["interests"] == ["AI", "Science"]

    @pytest.mark.anyio
    async def test_empty_interests_deserialized_as_empty_list(self, db):
        await _make_user(db, daily_generation=1)

        users = await queries.list_daily_generation_users(db)
        assert users[0]["interests"] == []


class TestDailyGenerationDefault:
    @pytest.mark.anyio
    async def test_new_user_defaults_to_enabled(self, db):
        user = await queries.upsert_user(
            db,
            email="new@test.com",
            name="New User",
            avatar_url="",
            provider="google",
            provider_id="abc",
        )
        rows = await db.execute(
            "SELECT daily_generation FROM user WHERE id = ?", [user["id"]]
        )
        assert rows[0]["daily_generation"] == 1


# ── generate_all script tests ───────────────────────────────


class TestGenerateAll:
    def _pipeline_patches(self, episode_result=None):
        """Return context managers that mock the full pipeline."""
        articles = [{"title": "Test", "url": "https://x.com/1", "summary": "s", "source": "Feed", "published": ""}]
        script_lines = [{"speaker": "Alex", "text": "Hello"}, {"speaker": "Jordan", "text": "Hi"}]

        if episode_result is None:
            episode_result = {
                "id": str(uuid.uuid4()),
                "title": "Test Episode",
                "keywords": '["AI"]',
                "cover_url": "",
                "audio_url": "https://cdn.example.com/ep.mp3",
                "duration": 120,
                "is_public": True,
                "creator_id": "will-be-set",
                "published_at": "2026-03-07T00:00:00+00:00",
            }

        mock_pipeline = AsyncMock(return_value=episode_result)
        return mock_pipeline

    @pytest.mark.anyio
    async def test_generates_for_enabled_users(self, db):
        user1 = await _make_user(db, interests=["AI"], daily_generation=1)
        user2 = await _make_user(db, interests=["Gaming"], daily_generation=1)
        await _make_user(db, interests=["Sports"], daily_generation=0)

        mock_pipeline = self._pipeline_patches()
        settings = _test_settings()

        with (
            patch("generate_all.get_settings", return_value=settings),
            patch("generate_all.create_db_client", return_value=db),
            patch("generate_all.run_pipeline", mock_pipeline),
            patch.object(db, "aclose", new_callable=AsyncMock),
        ):
            from generate_all import async_main
            await async_main()

        assert mock_pipeline.call_count == 2

    @pytest.mark.anyio
    async def test_skips_user_with_active_task(self, db):
        user = await _make_user(db, interests=["AI"], daily_generation=1)
        await queries.create_task(db, user_id=user["id"], status="processing", progress="tts")

        mock_pipeline = self._pipeline_patches()
        settings = _test_settings()

        with (
            patch("generate_all.get_settings", return_value=settings),
            patch("generate_all.create_db_client", return_value=db),
            patch("generate_all.run_pipeline", mock_pipeline),
            patch.object(db, "aclose", new_callable=AsyncMock),
        ):
            from generate_all import async_main
            await async_main()

        mock_pipeline.assert_not_called()

    @pytest.mark.anyio
    async def test_uses_default_interests_when_empty(self, db):
        await _make_user(db, daily_generation=1)  # no interests

        mock_pipeline = self._pipeline_patches()
        settings = _test_settings()

        with (
            patch("generate_all.get_settings", return_value=settings),
            patch("generate_all.create_db_client", return_value=db),
            patch("generate_all.run_pipeline", mock_pipeline),
            patch.object(db, "aclose", new_callable=AsyncMock),
        ):
            from generate_all import async_main
            await async_main()

        call_kwargs = mock_pipeline.call_args[1]
        assert call_kwargs["keywords"] == ["technology", "internet", "AI", "programming"]

    @pytest.mark.anyio
    async def test_uses_user_interests_as_keywords(self, db):
        await _make_user(db, interests=["Tennis", "Gaming"], daily_generation=1)

        mock_pipeline = self._pipeline_patches()
        settings = _test_settings()

        with (
            patch("generate_all.get_settings", return_value=settings),
            patch("generate_all.create_db_client", return_value=db),
            patch("generate_all.run_pipeline", mock_pipeline),
            patch.object(db, "aclose", new_callable=AsyncMock),
        ):
            from generate_all import async_main
            await async_main()

        call_kwargs = mock_pipeline.call_args[1]
        assert call_kwargs["keywords"] == ["Tennis", "Gaming"]

    @pytest.mark.anyio
    async def test_random_voice_overrides_applied(self, db):
        await _make_user(db, interests=["AI"], daily_generation=1)

        mock_pipeline = self._pipeline_patches()
        settings = _test_settings()

        with (
            patch("generate_all.get_settings", return_value=settings),
            patch("generate_all.create_db_client", return_value=db),
            patch("generate_all.run_pipeline", mock_pipeline),
            patch.object(db, "aclose", new_callable=AsyncMock),
        ):
            from generate_all import async_main
            await async_main()

        call_kwargs = mock_pipeline.call_args[1]
        used_settings = call_kwargs["settings"]
        from generate_all import INWORLD_VOICES_MALE, INWORLD_VOICES_FEMALE
        assert used_settings.inworld_tts_voice_male in INWORLD_VOICES_MALE
        assert used_settings.inworld_tts_voice_female in INWORLD_VOICES_FEMALE

    @pytest.mark.anyio
    async def test_continues_on_pipeline_failure(self, db):
        await _make_user(db, interests=["AI"], daily_generation=1)
        await _make_user(db, interests=["Gaming"], daily_generation=1)

        call_count = 0

        async def mock_pipeline_side_effect(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("boom")
            return {
                "id": str(uuid.uuid4()),
                "title": "OK",
                "keywords": "[]",
                "cover_url": "",
                "audio_url": "https://cdn.example.com/ep.mp3",
                "duration": 60,
                "is_public": True,
                "creator_id": kwargs["user"]["id"],
                "published_at": "2026-03-07T00:00:00+00:00",
            }

        mock_pipeline = AsyncMock(side_effect=mock_pipeline_side_effect)
        settings = _test_settings()

        with (
            patch("generate_all.get_settings", return_value=settings),
            patch("generate_all.create_db_client", return_value=db),
            patch("generate_all.run_pipeline", mock_pipeline),
            patch.object(db, "aclose", new_callable=AsyncMock),
        ):
            from generate_all import async_main
            await async_main()

        # Both users were attempted despite first one failing
        assert mock_pipeline.call_count == 2

    @pytest.mark.anyio
    async def test_no_users_does_nothing(self, db):
        mock_pipeline = self._pipeline_patches()
        settings = _test_settings()

        with (
            patch("generate_all.get_settings", return_value=settings),
            patch("generate_all.create_db_client", return_value=db),
            patch("generate_all.run_pipeline", mock_pipeline),
            patch.object(db, "aclose", new_callable=AsyncMock),
        ):
            from generate_all import async_main
            await async_main()

        mock_pipeline.assert_not_called()
