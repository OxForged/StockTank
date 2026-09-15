"""Seed the database with starter data.

Run manually with:  python -m app.seed
Also runs automatically on startup when the database is empty
(settings.AUTO_SEED, on by default).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import seed_data
from app.core.db import Base, SessionLocal, engine
from app.models import (
    ActivityItem,
    Company,
    Contact,
    ContentItem,
    ExecutiveBrief,
    FocusTask,
    Meeting,
    NewsItem,
    Opportunity,
    Touch,
)


def _insert_all(db: Session) -> None:
    # Companies first — everything else points at them.
    db.add_all([Company(**row) for row in seed_data.COMPANIES])
    db.add_all([Contact(**row) for row in seed_data.CONTACTS])
    db.add_all([Opportunity(**row) for row in seed_data.OPPORTUNITIES])
    db.add_all([Touch(**row) for row in seed_data.TOUCHES])
    db.add_all([Meeting(**row) for row in seed_data.MEETINGS])
    db.add_all([ContentItem(**row) for row in seed_data.CONTENT_ITEMS])
    db.add_all([NewsItem(**row) for row in seed_data.NEWS_ITEMS])
    db.add_all([FocusTask(**row) for row in seed_data.FOCUS_TASKS])
    db.add_all([ActivityItem(**row) for row in seed_data.ACTIVITY_ITEMS])
    db.add(ExecutiveBrief(**seed_data.BRIEF))


def seed_if_empty() -> bool:
    """Insert starter data if the companies table is empty."""
    with SessionLocal() as db:
        if db.scalar(select(Company.id).limit(1)):
            return False
        _insert_all(db)
        db.commit()
        return True


def main() -> None:
    Base.metadata.create_all(bind=engine)
    created = seed_if_empty()
    print("Seeded starter data." if created else "Database already has data — skipped.")


if __name__ == "__main__":
    main()
