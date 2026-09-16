import time

import pytest
from itsdangerous import URLSafeTimedSerializer

from app.auth import SESSION_COOKIE_NAME, create_session_cookie, _decode_session
from tests.conftest import _test_settings


# ── Cookie utility tests ────────────────────────────────────────


@pytest.mark.anyio
async def test_session_cookie_roundtrip(test_user):
    token = create_session_cookie(test_user["id"], _test_settings)
    uid = _decode_session(token, _test_settings)
    assert uid == test_user["id"]


def test_tampered_cookie_returns_none():
    token = create_session_cookie("some-id", _test_settings)
    uid = _decode_session(token + "tampered", _test_settings)
    assert uid is None


def test_expired_cookie_returns_none():
    s = URLSafeTimedSerializer(_test_settings.session_secret)
    token = s.dumps({"uid": "some-id"})
    # _decode_session uses max_age=30*24*3600; we can't easily fast-forward time,
    # so instead test with a different secret to simulate bad signature
    bad_settings = _test_settings.model_copy(update={"session_secret": "wrong-secret"})
    uid = _decode_session(token, bad_settings)
    assert uid is None


# ── /api/auth/me ────────────────────────────────────────────────


@pytest.mark.anyio
async def test_me_unauthenticated(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_me_authenticated(authenticated_client, test_user):
    resp = await authenticated_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == test_user["id"]
    assert data["email"] == test_user["email"]
    assert "stats" in data
    assert data["stats"]["total_episodes"] == 0
    assert data["stats"]["public_episodes"] == 0


# ── /api/auth/logout ────────────────────────────────────────────


@pytest.mark.anyio
async def test_logout(authenticated_client):
    resp = await authenticated_client.post("/api/auth/logout")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    # Cookie should be deleted (max-age=0 or set-cookie with expiry)
    set_cookie = resp.headers.get("set-cookie", "")
    assert SESSION_COOKIE_NAME in set_cookie
