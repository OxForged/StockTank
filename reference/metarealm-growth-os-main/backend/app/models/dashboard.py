"""Dashboard tables — focus tasks, activity feed, and the executive brief."""

from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class FocusTask(Base):
    __tablename__ = "focus_tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String, nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Your own note on the task, add anything.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "you" if you wrote it, else the agent name. Lets us keep your tasks safe.
    source: Mapped[str] = mapped_column(String, nullable=False, default="agent")
    created_at: Mapped[str] = mapped_column(String, nullable=False, default="")
    done_at: Mapped[str | None] = mapped_column(String, nullable=True)


class ActivityItem(Base):
    __tablename__ = "activity_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)


class ExecutiveBrief(Base):
    """Single-row table for now; the Executive Assistant rewrites it in M6."""

    __tablename__ = "executive_brief"

    id: Mapped[str] = mapped_column(String, primary_key=True, default="brief")
    generated_at: Mapped[str] = mapped_column(String, nullable=False)
    paragraphs: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    actions: Mapped[list[str]] = mapped_column(JSON, nullable=False)
