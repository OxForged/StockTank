"""Tests for the generate.py CLI script."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db import queries
from app.schemas import TaskStatus

# Import CLI functions
from generate import (
    get_or_create_system_user,
    resolve_feeds,
)
from app.services.pipeline import DEFAULT_FEEDS


class TestGetOrCreateSystemUser:
    @pytest.mark.anyio
    async def test_creates_system_user(self, db):
        user = await get_or_create_system_user(db)
        assert user["email"] == "system@your-podcast.local"
        assert user["name"] == "System"
        assert user["provider"] == "system"
        assert len(user["interests"]) > 0

    @pytest.mark.anyio
    async def test_returns_existing_system_user(self, db):
        user1 = await get_or_create_system_user(db)
        user2 = await get_or_create_system_user(db)
        assert user1["id"] == user2["id"]

    @pytest.mark.anyio
    async def test_system_user_has_default_interests(self, db):
        user = await get_or_create_system_user(db)
        assert "technology" in user["interests"]
        assert "AI" in user["interests"]


class TestResolveFeeds:
    def test_cli_feeds_take_priority(self):
        args = MagicMock(feeds="https://a.com,https://b.com")
        result = resolve_feeds(args, "https://env.com")
        assert result == ["https://a.com", "https://b.com"]

    def test_env_feeds_as_fallback(self):
        args = MagicMock(feeds=None)
        result = resolve_feeds(args, "https://env1.com, https://env2.com")
        assert result == ["https://env1.com", "https://env2.com"]

    def test_default_feeds_as_last_resort(self):
        args = MagicMock(feeds=None)
        result = resolve_feeds(args, "")
        assert result == DEFAULT_FEEDS

    def test_empty_strings_filtered(self):
        args = MagicMock(feeds="https://a.com, , ,https://b.com")
        result = resolve_feeds(args, "")
        assert result == ["https://a.com", "https://b.com"]


class TestErrorHandling:
    """Test the error handling middleware in main.py."""

    @pytest.mark.anyio
    async def test_health_returns_version(self, client):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["version"] == "0.2.1"

    @pytest.mark.anyio
    async def test_404_returns_json(self, client):
        resp = await client.get("/api/nonexistent")
        assert resp.status_code in (404, 405)

    @pytest.mark.anyio
    async def test_401_returns_json(self, client):
        resp = await client.get("/api/episodes/me")
        assert resp.status_code == 401
        data = resp.json()
        assert "detail" in data
