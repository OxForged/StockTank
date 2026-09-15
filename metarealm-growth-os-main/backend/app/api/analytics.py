"""Analytics, the real numbers from your own data.

Pipeline conversion, content performance, relationship health. No AI,
pure counting, always accurate, always free.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Company, ContentItem, FocusTask, NewsItem
from app.models.business import Opportunity

router = APIRouter(prefix="/analytics", tags=["analytics"])

STAGE_ORDER = ["prospect", "contacted", "in_talks", "proposal", "won", "lost"]


@router.get("")
def get_analytics(db: Session = Depends(get_db)):
    # Pipeline, deals by stage with value.
    deals = db.scalars(select(Opportunity)).all()
    by_stage: dict[str, dict] = {}
    for d in deals:
        row = by_stage.setdefault(d.stage, {"count": 0, "valueMad": 0})
        row["count"] += 1
        row["valueMad"] += d.value_mad or 0
    pipeline = [
        {"stage": s, **by_stage[s]} for s in STAGE_ORDER if s in by_stage
    ] + [
        {"stage": s, **v} for s, v in by_stage.items() if s not in STAGE_ORDER
    ]
    total_value = sum(d.value_mad or 0 for d in deals)
    won_value = sum(d.value_mad or 0 for d in deals if d.stage == "won")

    # Relationships, companies by status.
    companies = db.scalars(select(Company)).all()
    by_status: dict[str, int] = {}
    for c in companies:
        by_status[c.status] = by_status.get(c.status, 0) + 1

    # Content, by status, platform, topic.
    content = db.scalars(select(ContentItem)).all()
    content_status: dict[str, int] = {}
    content_topic: dict[str, int] = {}
    content_platform: dict[str, int] = {}
    for c in content:
        content_status[c.status] = content_status.get(c.status, 0) + 1
        t = getattr(c, "topic", "general") or "general"
        content_topic[t] = content_topic.get(t, 0) + 1
        content_platform[c.platform] = content_platform.get(c.platform, 0) + 1

    # Work, tasks done and open.
    tasks = db.scalars(select(FocusTask)).all()
    done = len([t for t in tasks if t.done])
    open_tasks = len(tasks) - done

    news_total = len(db.scalars(select(NewsItem)).all())

    return {
        "pipeline": {
            "stages": pipeline,
            "totalValueMad": total_value,
            "wonValueMad": won_value,
            "dealCount": len(deals),
        },
        "relationships": {"byStatus": by_status, "companyCount": len(companies)},
        "content": {
            "byStatus": content_status,
            "byTopic": content_topic,
            "byPlatform": content_platform,
            "total": len(content),
        },
        "work": {"tasksDone": done, "tasksOpen": open_tasks},
        "news": {"total": news_total},
    }
