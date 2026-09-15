"""Relationship Manager — keeps warm relationships warm.

Recipe: look at active partners and warm conversations, read the last
touches and contact notes, then ask the model for up to 3 short human
nudges, each one a task with a personal next step. If the model is not
reachable, it still creates simple check in tasks from the data alone,
so the habit never breaks.
"""

import json
import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import humanize, provider_for
from app.models import Company, Contact, FocusTask, Touch
from app.services.llm import generate, load_prompt, render_prompt

MAX_OPEN_NUDGES = 3

FALLBACK_PROMPT = """From this relationship context, suggest up to 3 short tasks to keep these relationships warm. Simple English, no dashes, no underscores. Each task is one personal next step, named people are better than company names alone. Answer only with a JSON list: [{"title": "...", "context": "..."}]

Relationships:
{context}"""


def run(db: Session, payload: dict) -> dict:
    open_nudges = [
        task
        for task in db.scalars(select(FocusTask)).all()
        if task.id.startswith("task-rm-") and not task.done
    ]
    if len(open_nudges) >= MAX_OPEN_NUDGES:
        return {
            "status": "completed",
            "summary": "Relationship Manager checked in, you already have relationship tasks waiting. Finish those first.",
            "details": {"added": 0},
        }

    companies = db.scalars(
        select(Company).where(Company.status.in_(["active_partner", "in_talks"]))
    ).all()
    lines: list[str] = []
    for company in companies:
        lines.append(
            f"{company.name}, status {company.status}, last touch {company.last_touch or 'unknown'}."
        )
        for touch in db.scalars(
            select(Touch).where(Touch.company_id == company.id)
        ).all()[:2]:
            lines.append(f"  Touch ({touch.when}): {touch.summary}")
        for contact in db.scalars(
            select(Contact).where(Contact.company_id == company.id)
        ).all()[:2]:
            note = f", note: {contact.notes}" if contact.notes else ""
            lines.append(f"  Person: {contact.name}, {contact.role}{note}")

    template = load_prompt("relationship-manager", FALLBACK_PROMPT)
    raw = generate(
        render_prompt(template, context="\n".join(lines)),
        provider=provider_for("relationship-manager"),
    )

    tasks: list[dict] = []
    if raw:
        tasks = _parse_list(raw)
    if not tasks:
        # Model missing or answered badly: simple check ins from data alone.
        for company in companies[:2]:
            tasks.append(
                {
                    "title": f"Check in with {company.name}",
                    "context": f"Last touch, {company.last_touch or 'unknown'}",
                }
            )

    added = 0
    room = MAX_OPEN_NUDGES - len(open_nudges)
    for task in tasks[:room]:
        title = humanize(str(task.get("title", ""))).strip()
        if not title:
            continue
        db.add(
            FocusTask(
                id=f"task-rm-{uuid.uuid4().hex[:8]}",
                title=title,
                context="Relationship Manager: " + humanize(str(task.get("context", ""))).strip(),
                priority="medium",
                done=False,
            )
        )
        added += 1
    db.commit()

    if added == 0:
        return {
            "status": "completed",
            "summary": "Relationship Manager found nothing to nudge right now.",
            "details": {"added": 0},
        }
    return {
        "status": "completed",
        "summary": f"Relationship Manager added {added} warm nudge{'s' if added != 1 else ''} to Today's Focus.",
        "details": {"added": added},
    }


def _parse_list(text: str) -> list[dict]:
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    except Exception:
        pass
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, list):
                return [item for item in parsed if isinstance(item, dict)]
        except Exception:
            return []
    return []
