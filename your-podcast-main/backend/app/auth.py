from fastapi import Cookie, Depends, HTTPException, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import Settings, get_settings
from app.db import DatabaseClient, get_db
from app.db import queries

SESSION_COOKIE_NAME = "podcast_session"
SESSION_MAX_AGE = 30 * 24 * 3600  # 30 days


def _get_serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret)


def create_session_cookie(user_id: str, settings: Settings) -> str:
    s = _get_serializer(settings)
    return s.dumps({"uid": user_id})


def _decode_session(token: str, settings: Settings) -> str | None:
    s = _get_serializer(settings)
    try:
        data = s.loads(token, max_age=SESSION_MAX_AGE)
        return data.get("uid")
    except (BadSignature, SignatureExpired):
        return None


async def get_current_user(
    db: DatabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
    session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict:
    if not session_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = _decode_session(session_cookie, settings)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    user = await queries.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(
    db: DatabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
    session_cookie: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict | None:
    if not session_cookie:
        return None
    user_id = _decode_session(session_cookie, settings)
    if not user_id:
        return None
    return await queries.get_user_by_id(db, user_id)
