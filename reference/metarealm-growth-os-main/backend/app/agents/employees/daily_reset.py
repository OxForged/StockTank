"""Daily Reset, keeps your workspace clean like you asked.

Runs at the start of each day, before the team works:
- Finished tasks from yesterday, deleted.
- Unfinished tasks, bumped to high priority so they nag you today.
- Content drafts you did not save or schedule, deleted, so the queue
  never piles up. Saved or scheduled content stays.

Pure rules, no AI. You told me what you wanted, this does exactly that.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ContentItem, FocusTask


def run(db: Session, payload: dict) -> dict:
    # 1. Tasks: delete done ones, raise the rest to high priority.
    done_deleted = 0
    bumped = 0
    for task in db.scalars(select(FocusTask)).all():
        if task.done:
            # Keep your finished tasks as your win history. Only clear the
            # agent generated done ones, so the archive stays meaningful.
            if getattr(task, "source", "agent") != "you":
                db.delete(task)
                done_deleted += 1
        elif task.priority != "high":
            task.priority = "high"
            bumped += 1

    # 2. Content: delete drafts that are not saved and not scheduled.
    #    Saved, scheduled, and published content is kept.
    content_deleted = 0
    for item in db.scalars(select(ContentItem)).all():
        keep = item.saved or item.status in ("scheduled", "published")
        if not keep and item.status == "awaiting_approval":
            db.delete(item)
            content_deleted += 1

    db.commit()

    bits = []
    if done_deleted:
        bits.append(f"cleared {done_deleted} finished task{'s' if done_deleted != 1 else ''}")
    if bumped:
        bits.append(f"raised {bumped} unfinished to high priority")
    if content_deleted:
        bits.append(f"removed {content_deleted} old unsaved draft{'s' if content_deleted != 1 else ''}")
    summary = "Daily Reset, " + (", ".join(bits) if bits else "nothing to clean, all tidy") + "."
    return {
        "status": "completed",
        "summary": summary,
        "details": {"doneDeleted": done_deleted, "bumped": bumped, "contentDeleted": content_deleted},
    }
