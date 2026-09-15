"""Tests for Phase 6: POST /api/generate and GET /api/tasks/{task_id}."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.db import queries
from app.schemas import TaskStatus


# All generate endpoint tests patch _run_in_background to avoid real D1 calls
# from background tasks (which create their own D1Client via get_d1_client).
_BG_PATCH = "app.routers.generate._run_in_background"


# ── POST /api/generate ────────────────────────────────────────


@pytest.mark.anyio
async def test_generate_unauthenticated(client):
    resp = await client.post("/api/generate")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_generate_returns_202(authenticated_client):
    with patch(_BG_PATCH, new_callable=AsyncMock):
        resp = await authenticated_client.post("/api/generate", json={})
    assert resp.status_code == 202
    data = resp.json()
    assert "task_id" in data
    assert data["status"] == "pending"
    assert data["message"] == "Podcast generation started"


@pytest.mark.anyio
async def test_generate_creates_task_in_db(authenticated_client, db, test_user):
    with patch(_BG_PATCH, new_callable=AsyncMock):
        resp = await authenticated_client.post("/api/generate", json={})
    assert resp.status_code == 202
    task_id = resp.json()["task_id"]

    task = await queries.get_task_by_id(db, task_id)
    assert task is not None
    assert task["user_id"] == test_user["id"]
    assert task["status"] == TaskStatus.pending
    assert task["progress"] == "queued"


@pytest.mark.anyio
async def test_generate_one_active_task_per_user(authenticated_client, db, test_user):
    # Create an active task
    await queries.create_task(
        db, user_id=test_user["id"], status=TaskStatus.processing, progress="running"
    )

    resp = await authenticated_client.post("/api/generate", json={})
    assert resp.status_code == 409
    assert "active task" in resp.json()["detail"]


@pytest.mark.anyio
async def test_generate_allows_after_completed_task(authenticated_client, db, test_user):
    # Completed task should not block
    await queries.create_task(
        db, user_id=test_user["id"], status=TaskStatus.completed, progress="done"
    )

    with patch(_BG_PATCH, new_callable=AsyncMock):
        resp = await authenticated_client.post("/api/generate", json={})
    assert resp.status_code == 202


@pytest.mark.anyio
async def test_generate_allows_after_failed_task(authenticated_client, db, test_user):
    await queries.create_task(
        db, user_id=test_user["id"], status=TaskStatus.failed, progress="error"
    )

    with patch(_BG_PATCH, new_callable=AsyncMock):
        resp = await authenticated_client.post("/api/generate", json={})
    assert resp.status_code == 202


@pytest.mark.anyio
async def test_generate_custom_feeds(authenticated_client):
    with patch(_BG_PATCH, new_callable=AsyncMock):
        resp = await authenticated_client.post(
            "/api/generate",
            json={"feeds": ["https://example.com/feed1", "https://example.com/feed2"]},
        )
    assert resp.status_code == 202


@pytest.mark.anyio
async def test_generate_custom_date(authenticated_client):
    with patch(_BG_PATCH, new_callable=AsyncMock):
        resp = await authenticated_client.post(
            "/api/generate",
            json={"date": "2026-03-01"},
        )
    assert resp.status_code == 202


# ── GET /api/tasks/{task_id} ──────────────────────────────────


@pytest.mark.anyio
async def test_get_task_unauthenticated(client, db, test_user):
    task = await queries.create_task(
        db, user_id=test_user["id"], status=TaskStatus.pending, progress="queued"
    )

    resp = await client.get(f"/api/tasks/{task['id']}")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_get_task_success(authenticated_client, db, test_user):
    task = await queries.create_task(
        db, user_id=test_user["id"], status=TaskStatus.processing, progress="fetching_rss"
    )

    resp = await authenticated_client.get(f"/api/tasks/{task['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["task_id"] == task["id"]
    assert data["status"] == "processing"
    assert data["progress"] == "fetching_rss"
    assert data["episode_id"] is None


@pytest.mark.anyio
async def test_get_task_completed_with_episode(authenticated_client, db, test_user):
    ep_id = str(uuid.uuid4())
    task = await queries.create_task(
        db, user_id=test_user["id"], status=TaskStatus.completed, progress="done"
    )
    await queries.update_task(db, task["id"], episode_id=ep_id)

    resp = await authenticated_client.get(f"/api/tasks/{task['id']}")
    data = resp.json()
    assert data["status"] == "completed"
    assert data["episode_id"] == ep_id


@pytest.mark.anyio
async def test_get_task_not_found(authenticated_client):
    resp = await authenticated_client.get(f"/api/tasks/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_get_task_wrong_owner(authenticated_client, db):
    # Create task owned by a different user
    other_user = await queries.upsert_user(
        db,
        email="other@example.com",
        name="Other",
        avatar_url="",
        provider="google",
        provider_id="99999",
    )

    task = await queries.create_task(
        db, user_id=other_user["id"], status=TaskStatus.pending, progress="queued"
    )

    resp = await authenticated_client.get(f"/api/tasks/{task['id']}")
    assert resp.status_code == 404
