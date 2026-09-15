"""Daily digest, a plain summary you can read or email yourself."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Company, ContentItem, FocusTask, NewsItem

router = APIRouter(prefix="/digest", tags=["digest"])


@router.get("")
def get_digest(db: Session = Depends(get_db)):
    """Build today's digest from what the team prepared."""
    tasks = [t for t in db.scalars(select(FocusTask)).all() if not t.done]
    high = [t for t in tasks if t.priority == "high"]
    fresh_leads = db.scalars(
        select(Company).where(Company.last_touch == "Deal signal found")
    ).all()
    top_news = sorted(
        db.scalars(select(NewsItem)).all(), key=lambda x: x.score, reverse=True
    )[:5]
    ready_posts = [
        c for c in db.scalars(select(ContentItem)).all()
        if c.status == "awaiting_approval"
    ]

    lines = ["MetaRealm OS, your daily brief.", ""]
    if high:
        lines.append(f"Do first, {len(high)} high priority task{'s' if len(high) != 1 else ''}:")
        for t in high[:5]:
            lines.append(f"  - {t.title}")
        lines.append("")
    if fresh_leads:
        lines.append(f"New deal signals, {len(fresh_leads)}:")
        for c in fresh_leads[:5]:
            lines.append(f"  - {c.name}, {c.industry}")
        lines.append("")
    if ready_posts:
        lines.append(f"Posts waiting for approval, {len(ready_posts)}.")
        lines.append("")
    if top_news:
        lines.append("Top news to react to:")
        for n in top_news:
            lines.append(f"  - {n.title}")

    text = "\n".join(lines)
    return {
        "text": text,
        "counts": {
            "highTasks": len(high),
            "leads": len(fresh_leads),
            "postsWaiting": len(ready_posts),
            "news": len(top_news),
        },
    }
