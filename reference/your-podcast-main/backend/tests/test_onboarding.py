import pytest


# ── Auth guard ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_set_interests_unauthenticated(client):
    resp = await client.post("/api/onboarding/interests", json={"interests": ["AI"]})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_get_interests_unauthenticated(client):
    resp = await client.get("/api/onboarding/interests")
    assert resp.status_code == 401


# ── Validation ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_set_interests_empty_list(authenticated_client):
    resp = await authenticated_client.post(
        "/api/onboarding/interests", json={"interests": []}
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_set_interests_too_many(authenticated_client):
    resp = await authenticated_client.post(
        "/api/onboarding/interests",
        json={"interests": [f"topic-{i}" for i in range(11)]},
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_set_interests_whitespace_only(authenticated_client):
    resp = await authenticated_client.post(
        "/api/onboarding/interests", json={"interests": ["  ", "\t", ""]}
    )
    assert resp.status_code == 422


# ── Happy path ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_set_and_get_interests(authenticated_client):
    resp = await authenticated_client.post(
        "/api/onboarding/interests", json={"interests": ["AI", "Rust", "Web3"]}
    )
    assert resp.status_code == 200
    assert resp.json()["interests"] == ["AI", "Rust", "Web3"]

    resp = await authenticated_client.get("/api/onboarding/interests")
    assert resp.status_code == 200
    assert resp.json()["interests"] == ["AI", "Rust", "Web3"]


@pytest.mark.anyio
async def test_set_interests_trims_whitespace(authenticated_client):
    resp = await authenticated_client.post(
        "/api/onboarding/interests", json={"interests": ["  AI  ", "Rust  "]}
    )
    assert resp.status_code == 200
    assert resp.json()["interests"] == ["AI", "Rust"]
