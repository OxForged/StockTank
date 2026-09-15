"""Database schema — SQLAlchemy Core table definitions.

Used by Alembic for migrations and by LocalSQLiteClient for dev DB init.
Query layer (db/queries.py) still uses hand-written SQL + dicts.
"""

from sqlalchemy import (
    Column,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Table,
    Text,
    text,
)

metadata = MetaData()

user = Table(
    "user",
    metadata,
    Column("id", Text, primary_key=True),
    Column("name", Text, nullable=False),
    Column("email", Text, nullable=False, unique=True),
    Column("avatar_url", Text, nullable=False, server_default=""),
    Column("provider", Text, nullable=False),
    Column("provider_id", Text, nullable=False),
    Column("interests", Text, nullable=False, server_default="[]"),
    Column("daily_generation", Integer, nullable=False, server_default="1"),
    Column("created_at", Text, nullable=False),
    Index("idx_user_email", "email"),
)

episode = Table(
    "episode",
    metadata,
    Column("id", Text, primary_key=True),
    Column("title", Text, nullable=False),
    Column("keywords", Text, nullable=False, server_default="[]"),
    Column("cover_url", Text, nullable=False, server_default=""),
    Column("audio_url", Text, nullable=False, server_default=""),
    Column("duration", Integer, nullable=False, server_default="0"),
    Column("is_public", Integer, nullable=False, server_default="1"),
    Column("creator_id", Text, ForeignKey("user.id"), nullable=False),
    Column("published_at", Text, nullable=False),
    Index("idx_episode_creator", "creator_id"),
    Index("idx_episode_public", "is_public", "published_at"),
)

source = Table(
    "source",
    metadata,
    Column("id", Text, primary_key=True),
    Column("episode_id", Text, ForeignKey("episode.id"), nullable=False),
    Column("title", Text, nullable=False),
    Column("url", Text, nullable=False),
    Column("source", Text, nullable=False),
    Index("idx_source_episode", "episode_id"),
)

transcript_line = Table(
    "transcript_line",
    metadata,
    Column("id", Text, primary_key=True),
    Column("episode_id", Text, ForeignKey("episode.id"), nullable=False),
    Column("line_order", Integer, nullable=False),
    Column("speaker", Text, nullable=False),
    Column("text", Text, nullable=False),
    Index("idx_transcript_episode", "episode_id"),
)

task = Table(
    "task",
    metadata,
    Column("id", Text, primary_key=True),
    Column("user_id", Text, ForeignKey("user.id"), nullable=False),
    Column("status", Text, nullable=False, server_default="pending"),
    Column("progress", Text, nullable=False, server_default=""),
    Column("episode_id", Text, ForeignKey("episode.id"), nullable=True),
    Column("created_at", Text, nullable=False),
    Index("idx_task_user", "user_id"),
    Index(
        "idx_task_one_active_per_user",
        "user_id",
        unique=True,
        sqlite_where=text("status IN ('pending', 'processing')"),
    ),
)
