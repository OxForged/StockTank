"""Content studio + market intelligence tables."""

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ContentItem(Base):
    __tablename__ = "content_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    saved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Which topic this post is about: company, morocco, mena, web3, drama.
    topic: Mapped[str] = mapped_column(String, nullable=False, default="general")
    title: Mapped[str] = mapped_column(String, nullable=False)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    scheduled_for: Mapped[str | None] = mapped_column(String, nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(String, nullable=True)


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    region: Mapped[str] = mapped_column(String, nullable=False)
    published_ago: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    # saved = you clicked keep, so cleanup never deletes it.
    saved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Which topic this post is about: company, morocco, mena, web3, drama.
    topic: Mapped[str] = mapped_column(String, nullable=False, default="general")
    # score = how interesting, Morocco and MENA and drama rank higher.
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String, nullable=False, default="")
