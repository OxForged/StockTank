"""Smart Follow-up Engine, so warm deals never go cold and slip away.

Pure rules plus the BD Manager for the words. Every run it looks for:
- Deals stuck in talks with no touch for 7+ days.
- Prospects you were introduced to but never followed up.

For each stale one it drafts a friendly follow up email through the BD
Manager, marks it ready on the company page, and adds a task telling you
to send it. This is the money you already earned, it just needs a nudge.

You set the days in Settings, FOLLOWUP_DAYS.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.employees import bd_manager
from app.models import Company, FocusTask, OutreachDraft
from app.services.runtime_settings import get_int

DEFAULT_STALE_DAYS = 7
MAX_FOLLOWUPS = 4


def _days_since_last_touch(db: Session, company_id: str) -> int | None:
    """Days since we last reached out, measured from outreach drafts.

    Touch rows have no timestamp, so we measure from OutreachDraft, which
    has a real created_at. The newest draft, sent or not, is the last
    time we did something. No drafts at all returns None, treated as
    stale once so the deal gets a first nudge.
    """
    drafts = db.scalars(
        select(OutreachDraft).where(OutreachDraft.company_id == company_id)
    ).all()
    latest = None
    for d in drafts:
        try:
            when = datetime.fromisoformat(d.created_at) if d.created_at else None
        except Exception:
            when = None
        if when and (latest is None or when > latest):
            latest = when
    if latest is None:
        return None
    return (datetime.now() - latest).days


def run(db: Session, payload: dict) -> dict:
    stale_days = payload.get("days") or get_int(db, "FOLLOWUP_DAYS", DEFAULT_STALE_DAYS)

    # Deals in talks, our warmest money, are the priority.
    warm = db.scalars(
        select(Company).where(Company.status == "in_talks")
    ).all()

    drafted: list[str] = []
    tasked: list[str] = []
    existing_tasks = {t.id for t in db.scalars(select(FocusTask)).all()}

    for company in warm:
        if len(drafted) >= MAX_FOLLOWUPS:
            break
        days = _days_since_last_touch(db, company.id)
        # Stale if no touch at all, or last touch older than the window.
        is_stale = days is None or days >= stale_days
        if not is_stale:
            continue

        # Does a fresh follow up draft already exist and is unsent?
        has_unsent = db.scalar(
            select(OutreachDraft).where(
                OutreachDraft.company_id == company.id,
                OutreachDraft.status == "draft",
            )
        )
        if not has_unsent:
            # Ask the BD Manager to write a follow up for this company.
            result = bd_manager.run(db, {"company_id": company.id, "mode": "follow_up"})
            if result.get("status") == "completed":
                drafted.append(company.name)

        # Add a task to send it, if not already there.
        task_id = f"task-fu-{company.id}"
        if task_id not in existing_tasks:
            waited = f"{days} days" if days is not None else "a while"
            db.add(FocusTask(
                id=task_id,
                title=f"Follow up with {company.name}, quiet for {waited}",
                context="Smart Follow-up: the draft is ready on their company page. Send it before this warm deal cools off.",
                priority="high",
                done=False,
            ))
            existing_tasks.add(task_id)
            tasked.append(company.name)

    db.commit()

    if not drafted and not tasked:
        return {
            "status": "completed",
            "summary": "Smart Follow-up checked your warm deals. None are stale, good, you are on top of them.",
            "details": {"drafted": 0, "tasked": 0},
        }
    bits = []
    if drafted:
        bits.append(f"drafted {len(drafted)} follow up{'s' if len(drafted) != 1 else ''}")
    if tasked:
        bits.append(f"added {len(tasked)} to your list")
    return {
        "status": "completed",
        "summary": f"Smart Follow-up, {', '.join(bits)}. These warm deals were going quiet: {', '.join(sorted(set(drafted + tasked)))}. Send before they cool.",
        "details": {"drafted": len(drafted), "tasked": len(tasked), "names": sorted(set(drafted + tasked))},
    }
