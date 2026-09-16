"""Core business tables — mirror of frontend/types/business.ts.

Stage/status/kind values are plain strings validated at the API edge by
Pydantic Literals: portable across SQLite and Postgres, painless to evolve.
"""

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    website: Mapped[str | None] = mapped_column(String, nullable=True)
    reason_to_contact: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_touch: Mapped[str | None] = mapped_column(String, nullable=True)
    # Rich deal intel, all editable by you in the app.
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_linkedin: Mapped[str | None] = mapped_column(String, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id"), nullable=False
    )
    company: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String, nullable=True)
    last_touch: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id"), nullable=False
    )
    company: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    value_mad: Mapped[int] = mapped_column(Integer, nullable=False)
    stage: Mapped[str] = mapped_column(String, nullable=False)
    next_action: Mapped[str] = mapped_column(Text, nullable=False)
    next_action_due: Mapped[str] = mapped_column(String, nullable=False)
    owner: Mapped[str] = mapped_column(String, nullable=False)


class Touch(Base):
    __tablename__ = "touches"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    # Column named when_label because WHEN is a SQL keyword; the API still
    # exposes it as "when" to match the frontend contract.
    when: Mapped[str] = mapped_column("when_label", String, nullable=False)


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    company_id: Mapped[str | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True
    )
    company: Mapped[str | None] = mapped_column(String, nullable=True)
    when: Mapped[str] = mapped_column("when_label", String, nullable=False)
    # Real start time, ISO format, used to build the calendar file.
    starts_at: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    agenda: Mapped[str | None] = mapped_column(Text, nullable=True)
    attendees: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    prep: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
