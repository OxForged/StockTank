"""Database query layer — all SQL queries in one file, organized by entity.

Every function takes a DatabaseClient as its first parameter and returns plain dicts.
"""

import json
import uuid
from datetime import datetime, timezone

from app.db.client import DatabaseClient


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ── User ─────────────────────────────────────────────────────


async def get_user_by_id(db: DatabaseClient, user_id: str) -> dict | None:
    rows = await db.execute("SELECT * FROM user WHERE id = ?", [user_id])
    if not rows:
        return None
    user = rows[0]
    user["interests"] = json.loads(user["interests"]) if user["interests"] else []
    return user


async def get_user_by_email(db: DatabaseClient, email: str) -> dict | None:
    rows = await db.execute("SELECT * FROM user WHERE email = ?", [email])
    if not rows:
        return None
    user = rows[0]
    user["interests"] = json.loads(user["interests"]) if user["interests"] else []
    return user


async def upsert_user(
    db: DatabaseClient,
    *,
    email: str,
    name: str,
    avatar_url: str,
    provider: str,
    provider_id: str,
) -> dict:
    existing = await get_user_by_email(db, email)
    if existing:
        await db.execute(
            "UPDATE user SET name = ?, avatar_url = ? WHERE id = ?",
            [name, avatar_url, existing["id"]],
        )
        existing["name"] = name
        existing["avatar_url"] = avatar_url
        return existing

    user_id = _new_id()
    now = _utcnow_iso()
    await db.execute(
        """INSERT INTO user (id, name, email, avatar_url, provider, provider_id, interests, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [user_id, name, email, avatar_url, provider, provider_id, "[]", now],
    )
    return {
        "id": user_id,
        "name": name,
        "email": email,
        "avatar_url": avatar_url,
        "provider": provider,
        "provider_id": provider_id,
        "interests": [],
        "created_at": now,
    }


async def list_daily_generation_users(db: DatabaseClient) -> list[dict]:
    """Return all users with daily_generation enabled."""
    rows = await db.execute("SELECT * FROM user WHERE daily_generation = 1")
    for row in rows:
        row["interests"] = json.loads(row["interests"]) if row["interests"] else []
    return rows


async def update_user_interests(db: DatabaseClient, user_id: str, interests: list[str]) -> None:
    await db.execute(
        "UPDATE user SET interests = ? WHERE id = ?",
        [json.dumps(interests), user_id],
    )


# ── Episode ──────────────────────────────────────────────────


async def list_public_episodes(
    db: DatabaseClient, *, limit: int = 20, offset: int = 0
) -> tuple[list[dict], int]:
    count_rows = await db.execute(
        "SELECT COUNT(*) AS cnt FROM episode WHERE is_public = 1"
    )
    total = count_rows[0]["cnt"] if count_rows else 0

    rows = await db.execute(
        """SELECT e.*, u.name AS creator_name
           FROM episode e
           JOIN user u ON e.creator_id = u.id
           WHERE e.is_public = 1
           ORDER BY e.published_at DESC
           LIMIT ? OFFSET ?""",
        [limit, offset],
    )
    return rows, total


async def list_user_episodes(
    db: DatabaseClient, user_id: str, *, limit: int = 20, offset: int = 0
) -> tuple[list[dict], int]:
    count_rows = await db.execute(
        "SELECT COUNT(*) AS cnt FROM episode WHERE creator_id = ?", [user_id]
    )
    total = count_rows[0]["cnt"] if count_rows else 0

    rows = await db.execute(
        """SELECT e.*, u.name AS creator_name
           FROM episode e
           JOIN user u ON e.creator_id = u.id
           WHERE e.creator_id = ?
           ORDER BY e.published_at DESC
           LIMIT ? OFFSET ?""",
        [user_id, limit, offset],
    )
    return rows, total


async def get_episode_detail(db: DatabaseClient, episode_id: str) -> dict | None:
    rows = await db.execute(
        """SELECT e.*, u.name AS creator_name
           FROM episode e
           JOIN user u ON e.creator_id = u.id
           WHERE e.id = ?""",
        [episode_id],
    )
    if not rows:
        return None

    episode = rows[0]

    sources = await db.execute(
        "SELECT * FROM source WHERE episode_id = ?", [episode_id]
    )

    episode["sources"] = sources
    return episode


async def count_user_episodes(
    db: DatabaseClient, user_id: str, *, public_only: bool = False
) -> int:
    if public_only:
        rows = await db.execute(
            "SELECT COUNT(*) AS cnt FROM episode WHERE creator_id = ? AND is_public = 1",
            [user_id],
        )
    else:
        rows = await db.execute(
            "SELECT COUNT(*) AS cnt FROM episode WHERE creator_id = ?", [user_id]
        )
    return rows[0]["cnt"] if rows else 0


# ── Task ─────────────────────────────────────────────────────


async def create_task(
    db: DatabaseClient, *, user_id: str, status: str = "pending", progress: str = ""
) -> dict:
    task_id = _new_id()
    now = _utcnow_iso()
    try:
        await db.execute(
            """INSERT INTO task (id, user_id, status, progress, episode_id, created_at)
               VALUES (?, ?, ?, ?, NULL, ?)""",
            [task_id, user_id, status, progress, now],
        )
    except Exception as exc:
        if "UNIQUE constraint" in str(exc) or "idx_task_one_active_per_user" in str(exc):
            raise ValueError("active task exists") from exc
        raise
    return {
        "id": task_id,
        "user_id": user_id,
        "status": status,
        "progress": progress,
        "episode_id": None,
        "created_at": now,
    }


async def get_task_by_id(db: DatabaseClient, task_id: str) -> dict | None:
    rows = await db.execute("SELECT * FROM task WHERE id = ?", [task_id])
    return rows[0] if rows else None


_TASK_UPDATE_ALLOWED_COLS = frozenset({"status", "progress", "episode_id"})


async def update_task(
    db: DatabaseClient,
    task_id: str,
    *,
    status: str | None = None,
    progress: str | None = None,
    episode_id: str | None = None,
) -> None:
    updates: dict[str, str] = {}
    if status is not None:
        updates["status"] = status
    if progress is not None:
        updates["progress"] = progress
    if episode_id is not None:
        updates["episode_id"] = episode_id
    if not updates:
        return
    for col in updates:
        if col not in _TASK_UPDATE_ALLOWED_COLS:
            raise ValueError(f"Invalid column for task update: {col!r}")
    set_clause = ", ".join(f"{col} = ?" for col in updates)
    params: list[str] = [*updates.values(), task_id]
    sql = f"UPDATE task SET {set_clause} WHERE id = ?"  # noqa: S608 — columns validated against allowlist
    await db.execute(sql, params)


async def get_active_task(db: DatabaseClient, user_id: str) -> dict | None:
    rows = await db.execute(
        "SELECT * FROM task WHERE user_id = ? AND status IN ('pending', 'processing')",
        [user_id],
    )
    return rows[0] if rows else None


# ── Pipeline save (batch) ────────────────────────────────────


async def save_pipeline_result(
    db: DatabaseClient,
    *,
    task_id: str,
    episode: dict,
    sources: list[dict],
    transcript_lines: list[dict],
) -> None:
    """Save a completed pipeline result: episode + sources + transcript + task update.

    Uses batch API for atomicity.
    """
    stmts: list[dict] = []

    # Insert episode
    stmts.append({
        "sql": """INSERT INTO episode (id, title, keywords, cover_url, audio_url, duration, is_public, creator_id, published_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        "params": [
            episode["id"],
            episode["title"],
            episode["keywords"],
            episode["cover_url"],
            episode["audio_url"],
            episode["duration"],
            1 if episode.get("is_public", True) else 0,
            episode["creator_id"],
            episode["published_at"],
        ],
    })

    # Insert sources
    for src in sources:
        stmts.append({
            "sql": "INSERT INTO source (id, episode_id, title, url, source) VALUES (?, ?, ?, ?, ?)",
            "params": [_new_id(), episode["id"], src["title"], src["url"], src["source"]],
        })

    # Insert transcript lines
    for i, line in enumerate(transcript_lines):
        stmts.append({
            "sql": "INSERT INTO transcript_line (id, episode_id, line_order, speaker, text) VALUES (?, ?, ?, ?, ?)",
            "params": [_new_id(), episode["id"], i, line["speaker"], line["text"]],
        })

    # Update task
    stmts.append({
        "sql": "UPDATE task SET status = 'completed', progress = 'done', episode_id = ? WHERE id = ?",
        "params": [episode["id"], task_id],
    })

    await db.batch(stmts)
