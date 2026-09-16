from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from app.auth import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    create_session_cookie,
    get_current_user,
)
from app.config import Settings, get_settings
from app.db import DatabaseClient, get_db
from app.db import queries

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth = OAuth()


def _register_oauth(settings: Settings) -> None:
    """Register OAuth providers lazily (called on first use)."""
    if "google" not in oauth._clients:
        oauth.register(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )


def _set_session_cookie(response: Response, user: dict, settings: Settings) -> None:
    token = create_session_cookie(user["id"], settings)
    is_http = settings.frontend_url.startswith("http://")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=not is_http,
    )


# ── Google OAuth ──────────────────────────────────────────────


@router.get("/google")
async def google_login(request: Request, settings: Settings = Depends(get_settings)):
    _register_oauth(settings)
    redirect_uri = f"{settings.frontend_url}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: DatabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    _register_oauth(settings)
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo", {})

    if not userinfo.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google email is not verified")
    email = userinfo.get("email")
    sub = userinfo.get("sub")
    if not email or not sub:
        raise HTTPException(status_code=400, detail="Missing email or sub from Google")

    user = await queries.upsert_user(
        db,
        email=email,
        name=userinfo.get("name", ""),
        avatar_url=userinfo.get("picture", ""),
        provider="google",
        provider_id=str(sub),
    )

    response = RedirectResponse(url=settings.frontend_url)
    _set_session_cookie(response, user, settings)
    return response


# ── User endpoints ────────────────────────────────────────────


@router.get("/me")
async def me(
    current_user: dict = Depends(get_current_user),
    db: DatabaseClient = Depends(get_db),
):
    public_count = await queries.count_user_episodes(db, current_user["id"], public_only=True)
    total_count = await queries.count_user_episodes(db, current_user["id"])

    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "interests": current_user["interests"],
        "created_at": current_user["created_at"],
        "stats": {
            "total_episodes": total_count,
            "public_episodes": public_count,
        },
    }


# ── Dev-only login (bypasses OAuth for local testing) ─────────
@router.post("/dev-login")
async def dev_login(
    response: Response,
    db: DatabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Log in as the seed user without OAuth. Only available in development."""
    if not settings.is_dev:
        raise HTTPException(status_code=404, detail="Not found")

    user = await queries.get_user_by_email(db, "seed@your-podcast.local")
    if not user:
        raise HTTPException(status_code=400, detail="Seed user not found. Run: python seed.py")

    _set_session_cookie(response, user, settings)
    return {"ok": True, "user": user["name"], "email": user["email"]}


@router.post("/logout")
async def logout(settings: Settings = Depends(get_settings)):
    is_http = settings.frontend_url.startswith("http://")
    response = Response(content='{"ok": true}', media_type="application/json")
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite="lax",
        secure=not is_http,
    )
    return response
