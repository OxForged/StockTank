"""CRM Manager — keeps the pipeline honest.

This employee uses NO model, on purpose. Hygiene checks are yes or no
questions and rules answer them faster, cheaper, and the same way
every time. Not everything needs AI, and knowing when not to use it
is part of good engineering.

Each problem it finds becomes a task in Today's Focus. Tasks get a
stable id per problem, so ticking one off means it will not come back
on the next run unless the problem itself comes back.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Company, Contact, FocusTask, Meeting

MAX_NEW_TASKS = 5


def run(db: Session, payload: dict) -> dict:
    existing_ids = {task.id for task in db.scalars(select(FocusTask)).all()}
    candidates: list[FocusTask] = []

    # 1. Prospects with a reason to contact but never contacted.
    for company in db.scalars(
        select(Company).where(Company.status == "prospect")
    ).all():
        if company.reason_to_contact and (company.last_touch or "").startswith("Never"):
            candidates.append(
                FocusTask(
                    id=f"task-crm-reach-{company.id}",
                    title=f"Reach out to {company.name}",
                    context=f"CRM Manager: {company.reason_to_contact}",
                    priority="medium",
                    done=False,
                )
            )

    # 2. Warm companies going quiet.
    for company in db.scalars(
        select(Company).where(Company.status.in_(["in_talks", "active_partner"]))
    ).all():
        touch = (company.last_touch or "").lower()
        if "month" in touch or "week" in touch:
            candidates.append(
                FocusTask(
                    id=f"task-crm-quiet-{company.id}",
                    title=f"Check in with {company.name}",
                    context=f"CRM Manager: last touch was {company.last_touch}",
                    priority="medium",
                    done=False,
                )
            )

    # 3. Upcoming meetings without a prep brief.
    for meeting in db.scalars(
        select(Meeting).where(Meeting.status == "upcoming")
    ).all():
        if not meeting.prep:
            candidates.append(
                FocusTask(
                    id=f"task-crm-prep-{meeting.id}",
                    title=f"Generate prep for {meeting.title}",
                    context="CRM Manager: open the meeting and press Generate prep brief",
                    priority="low",
                    done=False,
                )
            )

    # 4. Key contacts with no email on file.
    for contact in db.scalars(select(Contact)).all():
        if contact.email:
            continue
        company = db.get(Company, contact.company_id)
        if company and company.status in ("in_talks", "active_partner"):
            candidates.append(
                FocusTask(
                    id=f"task-crm-email-{contact.id}",
                    title=f"Get an email for {contact.name} at {contact.company}",
                    context="CRM Manager: no email on file for a warm relationship",
                    priority="low",
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

    checked = len(candidates)
    if added == 0:
        return {
            "status": "completed",
            "summary": f"CRM Manager checked the pipeline, {checked} known issue{'s' if checked != 1 else ''}, nothing new to flag.",
            "details": {"found": checked, "added": 0},
        }
    return {
        "status": "completed",
        "summary": f"CRM Manager flagged {added} new task{'s' if added != 1 else ''} in Today's Focus.",
        "details": {"found": checked, "added": added},
    }
