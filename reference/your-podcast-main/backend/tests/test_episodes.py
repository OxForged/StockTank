import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.db import queries


async def _make_episode(
    db,
    creator: dict,
    *,
    title: str = "Test Episode",
    keywords: list[str] | None = None,
    is_public: bool = True,
    published_at: datetime | None = None,
) -> dict:
    ep_id = str(uuid.uuid4())
    pub = (published_at or datetime.now(timezone.utc)).isoformat()
    kw = json.dumps(keywords or [])
    await db.execute(
        """INSERT INTO episode (id, title, keywords, cover_url, audio_url, duration, is_public, creator_id, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [ep_id, title, kw, "", "https://r2.example.com/test.mp3",
         300, 1 if is_public else 0, creator["id"], pub],
    )
    return {"id": ep_id, "title": title, "keywords": kw, "is_public": is_public, "published_at": pub, "creator_id": creator["id"]}


async def _make_source(db, episode: dict) -> dict:
    src_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO source (id, episode_id, title, url, source) VALUES (?, ?, ?, ?, ?)",
        [src_id, episode["id"], "Source Article", "https://example.com/article", "TechFeed"],
    )
    return {"id": src_id}


async def _make_transcript(db, episode: dict) -> dict:
    line_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO transcript_line (id, episode_id, line_order, speaker, text) VALUES (?, ?, ?, ?, ?)",
        [line_id, episode["id"], 0, "Alex", "Hello world"],
    )
    return {"id": line_id}


# -- GET /api/episodes (public list) --


@pytest.mark.anyio
async def test_list_episodes_empty(client):
    resp = await client.get("/api/episodes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["episodes"] == []
    assert data["total"] == 0


@pytest.mark.anyio
async def test_list_episodes_public_only(client, db, test_user):
    await _make_episode(db, test_user, title="Public", is_public=True)
    await _make_episode(db, test_user, title="Private", is_public=False)

    resp = await client.get("/api/episodes")
    data = resp.json()
    assert data["total"] == 1
    assert data["episodes"][0]["title"] == "Public"


@pytest.mark.anyio
async def test_list_episodes_newest_first(client, db, test_user):
    now = datetime.now(timezone.utc)
    await _make_episode(db, test_user, title="Old", published_at=now - timedelta(days=2))
    await _make_episode(db, test_user, title="New", published_at=now)

    resp = await client.get("/api/episodes")
    titles = [e["title"] for e in resp.json()["episodes"]]
    assert titles == ["New", "Old"]


@pytest.mark.anyio
async def test_list_episodes_pagination(client, db, test_user):
    for i in range(5):
        await _make_episode(db, test_user, title=f"Ep {i}")

    resp = await client.get("/api/episodes?limit=2&offset=0")
    data = resp.json()
    assert len(data["episodes"]) == 2
    assert data["total"] == 5

    resp = await client.get("/api/episodes?limit=2&offset=4")
    data = resp.json()
    assert len(data["episodes"]) == 1


@pytest.mark.anyio
async def test_list_episodes_keywords_returned_as_list(client, db, test_user):
    await _make_episode(db, test_user, keywords=["AI", "Tech"])

    resp = await client.get("/api/episodes")
    ep = resp.json()["episodes"][0]
    assert ep["keywords"] == ["AI", "Tech"]


@pytest.mark.anyio
async def test_list_episodes_empty_keywords(client, db, test_user):
    await _make_episode(db, test_user, keywords=[])

    resp = await client.get("/api/episodes")
    ep = resp.json()["episodes"][0]
    assert ep["keywords"] == []


@pytest.mark.anyio
async def test_list_episodes_malformed_keywords_fallback(client, db, test_user):
    """Malformed keywords JSON in DB gracefully returns empty list."""
    ep_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO episode (id, title, keywords, cover_url, audio_url, duration, is_public, creator_id, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [ep_id, "Bad Keywords", "not-valid-json", "", "", 100, 1, test_user["id"], now],
    )

    resp = await client.get("/api/episodes")
    ep = resp.json()["episodes"][0]
    assert ep["keywords"] == []


# -- GET /api/episodes/me --


@pytest.mark.anyio
async def test_my_episodes_unauthenticated(client):
    resp = await client.get("/api/episodes/me")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_my_episodes_includes_private(authenticated_client, db, test_user):
    await _make_episode(db, test_user, title="Public", is_public=True)
    await _make_episode(db, test_user, title="Private", is_public=False)

    resp = await authenticated_client.get("/api/episodes/me")
    data = resp.json()
    assert data["total"] == 2
    titles = {e["title"] for e in data["episodes"]}
    assert titles == {"Public", "Private"}


@pytest.mark.anyio
async def test_my_episodes_keywords(authenticated_client, db, test_user):
    await _make_episode(db, test_user, keywords=["Python", "Rust"])

    resp = await authenticated_client.get("/api/episodes/me")
    ep = resp.json()["episodes"][0]
    assert ep["keywords"] == ["Python", "Rust"]


# -- GET /api/episodes/{id} --


@pytest.mark.anyio
async def test_get_episode_not_found(client):
    resp = await client.get(f"/api/episodes/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_get_public_episode(client, db, test_user):
    ep = await _make_episode(db, test_user, title="Public EP", keywords=["AI"])
    await _make_source(db, ep)
    await _make_transcript(db, ep)

    resp = await client.get(f"/api/episodes/{ep['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Public EP"
    assert data["keywords"] == ["AI"]
    assert len(data["sources"]) == 1


@pytest.mark.anyio
async def test_get_episode_detail_keywords(client, db, test_user):
    ep = await _make_episode(db, test_user, keywords=["Gaming", "VR"])

    resp = await client.get(f"/api/episodes/{ep['id']}")
    assert resp.status_code == 200
    assert resp.json()["keywords"] == ["Gaming", "VR"]


@pytest.mark.anyio
async def test_get_episode_detail_malformed_keywords(client, db, test_user):
    """Malformed keywords in detail endpoint returns empty list."""
    ep_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO episode (id, title, keywords, cover_url, audio_url, duration, is_public, creator_id, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [ep_id, "Bad", "broken", "", "", 100, 1, test_user["id"], now],
    )

    resp = await client.get(f"/api/episodes/{ep_id}")
    assert resp.json()["keywords"] == []


@pytest.mark.anyio
async def test_private_episode_404_for_unauthenticated(client, db, test_user):
    ep = await _make_episode(db, test_user, is_public=False)
    resp = await client.get(f"/api/episodes/{ep['id']}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_private_episode_404_for_non_owner(client, db, test_user, auth_cookie):
    ep = await _make_episode(db, test_user, is_public=False)

    other_user = await queries.upsert_user(
        db,
        email="other@example.com",
        name="Other",
        avatar_url="",
        provider="google",
        provider_id="99999",
    )

    from app.auth import create_session_cookie, SESSION_COOKIE_NAME
    from tests.conftest import _test_settings

    other_cookie = create_session_cookie(other_user["id"], _test_settings)
    client.cookies.set(SESSION_COOKIE_NAME, other_cookie)

    resp = await client.get(f"/api/episodes/{ep['id']}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_private_episode_200_for_owner(authenticated_client, db, test_user):
    ep = await _make_episode(db, test_user, is_public=False, title="My Secret EP")
    resp = await authenticated_client.get(f"/api/episodes/{ep['id']}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "My Secret EP"


@pytest.mark.anyio
async def test_episode_default_keywords(client, db, test_user):
    """Episode with no keywords set uses default empty array."""
    ep = await _make_episode(db, test_user)
    resp = await client.get(f"/api/episodes/{ep['id']}")
    assert resp.json()["keywords"] == []
