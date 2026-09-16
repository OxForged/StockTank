"""Chief of Staff — the boss. Turns everything ready into your daily plan.

Pure rules, no AI. Every morning it looks at what the other employees
prepared and writes your work list in Today's Focus:

1. Send tasks. A deal signal prospect has an intro draft ready, your
   job is to send it. This is where money comes from, so it is high
   priority and comes first.
2. Post tasks. Fresh drafts wait in the Content Studio, your job is to
   approve the best one per platform and post it.
3. Follow up tasks. An outreach was sent days ago with no follow up,
   your job is to nudge.

It assigns, you execute. That is the deal.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Company, ContentItem, FocusTask, OutreachDraft

MAX_NEW_TASKS = 6
FOLLOW_UP_AFTER_DAYS = 5

PLATFORM_LABEL = {"linkedin": "LinkedIn", "x": "X"}


def run(db: Session, payload: dict) -> dict:
    existing_ids = {t.id for t in db.scalars(select(FocusTask)).all()}
    candidates: list[FocusTask] = []

    # 1. Send the intro emails that are ready. Money first.
    for company in db.scalars(
        select(Company).where(Company.last_touch == "Deal signal found")
    ).all():
        draft = db.scalars(
            select(OutreachDraft)
            .where(
                OutreachDraft.company_id == company.id,
                OutreachDraft.status == "draft",
            )
            .order_by(OutreachDraft.created_at.desc())
        ).first()
        if draft:
            candidates.append(
                FocusTask(
                    id=f"task-cos-send-{company.id}",
                    title=f"Send the intro email to {company.name}",
                    context="Chief of Staff: the draft is ready on their company page. Copy it, send it from your inbox, then press Mark as sent.",
                    priority="high",
                    done=False,
                )
            )

    # 2. Post one fresh draft per platform.
    for platform in ("linkedin", "x"):
        item = db.scalars(
            select(ContentItem).where(
                ContentItem.platform == platform,
                ContentItem.status == "awaiting_approval",
                ContentItem.author == "Content Strategist",
            )
        ).first()
        if item:
            candidates.append(
                FocusTask(
                    id=f"task-cos-post-{item.id}",
                    title=f"Approve and post on {PLATFORM_LABEL[platform]}: {item.title}",
                    context="Chief of Staff: open it in the Content Studio, make it yours, post it. Eyes bring deals.",
                    priority="high",
                    done=False,
                )
            )

    # 3. Follow up on outreach that went quiet.
    today = datetime.now()
    for draft in db.scalars(
        select(OutreachDraft).where(OutreachDraft.status == "sent")
    ).all():
        newer = db.scalar(
            select(OutreachDraft).where(
                OutreachDraft.company_id == draft.company_id,
                OutreachDraft.created_at > draft.created_at,
            )
        )
        if newer:
            continue
        try:
            sent_at = datetime.fromisoformat(draft.created_at)
        except Exception:
            continue
        if (today - sent_at).days >= FOLLOW_UP_AFTER_DAYS:
            candidates.append(
                FocusTask(
                    id=f"task-cos-fu-{draft.company_id}",
                    title=f"Send a follow up to {draft.company}",
                    context="Chief of Staff: it has been quiet since your intro. Open their page and press Draft a follow up.",
                    priority="medium",
                    done=False,
                )
            )

    added = 0
    for task in candidates:
        if task.id in existing_ids:
            continue
        db.add(task)
        existing_ids.add(task.id)
        added += 1
        if added >= MAX_NEW_TASKS:
            break
    db.commit()

    if added == 0:
        return {
            "status": "completed",
            "summary": "Chief of Staff checked. Your plan is already set, finish the open tasks in Today's Focus.",
            "details": {"added": 0},
        }
    return {
        "status": "completed",
        "summary": f"Chief of Staff set your plan, {added} task{'s' if added != 1 else ''} in Today's Focus. Do the send tasks first, that is where money comes from.",
        "details": {"added": added},
    }
