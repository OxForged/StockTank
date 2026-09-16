"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("avatar_url", sa.Text, nullable=False, server_default=""),
        sa.Column("provider", sa.Text, nullable=False),
        sa.Column("provider_id", sa.Text, nullable=False),
        sa.Column("interests", sa.Text, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.Text, nullable=False),
    )
    op.create_index("idx_user_email", "user", ["email"])

    op.create_table(
        "episode",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("cover_url", sa.Text, nullable=False, server_default=""),
        sa.Column("audio_url", sa.Text, nullable=False, server_default=""),
        sa.Column("duration", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_public", sa.Integer, nullable=False, server_default="1"),
        sa.Column(
            "creator_id", sa.Text, sa.ForeignKey("user.id"), nullable=False
        ),
        sa.Column("published_at", sa.Text, nullable=False),
    )
    op.create_index("idx_episode_creator", "episode", ["creator_id"])
    op.create_index(
        "idx_episode_public", "episode", ["is_public", "published_at"]
    )

    op.create_table(
        "source",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column(
            "episode_id", sa.Text, sa.ForeignKey("episode.id"), nullable=False
        ),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("source", sa.Text, nullable=False),
    )
    op.create_index("idx_source_episode", "source", ["episode_id"])

    op.create_table(
        "transcript_line",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column(
            "episode_id", sa.Text, sa.ForeignKey("episode.id"), nullable=False
        ),
        sa.Column("line_order", sa.Integer, nullable=False),
        sa.Column("speaker", sa.Text, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
    )
    op.create_index(
        "idx_transcript_episode", "transcript_line", ["episode_id"]
    )

    op.create_table(
        "task",
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column(
            "user_id", sa.Text, sa.ForeignKey("user.id"), nullable=False
        ),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("progress", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "episode_id", sa.Text, sa.ForeignKey("episode.id"), nullable=True
        ),
        sa.Column("created_at", sa.Text, nullable=False),
    )
    op.create_index("idx_task_user", "task", ["user_id"])

    # Partial unique index — not supported by Alembic ops, use raw SQL
    op.execute(
        """CREATE UNIQUE INDEX idx_task_one_active_per_user
           ON task(user_id)
           WHERE status IN ('pending', 'processing')"""
    )


def downgrade() -> None:
    op.drop_table("transcript_line")
    op.drop_table("source")
    op.drop_table("task")
    op.drop_table("episode")
    op.drop_table("user")
