"""Meeting Assistant — fills the prep brief slot on meetings.

Recipe: for one meeting (or every upcoming meeting without a brief),
gather the company, its open deals, the last touches, the contacts and
a few knowledge passages, then ask the model for one short plain text
brief and save it on the meeting. The Meetings page shows it instantly.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import format_mad, humanize, provider_for
from app.models import Contact, Meeting, Opportunity, Touch
from app.services import rag
from app.services.llm import generate, load_prompt, render_prompt

OPEN_STAGES = ["lead", "contacted", "meeting", "proposal", "negotiation"]

FALLBACK_PROMPT = """Write one meeting prep brief of 80 to 140 words in plain text. Simple English, no dashes, no underscores, no bullet points.

Meeting context:
{context}"""


def _context_for(db: Session, meeting: Meeting) -> str:
    lines = [
        f"Meeting: {meeting.title}, {meeting.when}, {meeting.duration_min} minutes, type {meeting.kind}."
    ]
    if meeting.agenda:
        lines.append(f"Agenda: {meeting.agenda}.")
    if meeting.attendees:
        lines.append(f"Attendees: {', '.join(meeting.attendees)}.")

    if meeting.company_id:
        deals = db.scalars(
            select(Opportunity).where(
                Opportunity.company_id == meeting.company_id,
                Opportunity.stage.in_(OPEN_STAGES),
            )
        ).all()
        for deal in deals:
            lines.append(
                f"Open deal: {deal.title}, {format_mad(deal.value_mad)}, "
                f"stage {deal.stage}, next step: {deal.next_action}."
            )
        touches = db.scalars(
            select(Touch).where(Touch.company_id == meeting.company_id)
        ).all()
        for touch in touches[:4]:
            lines.append(f"Recent touch ({touch.when}): {touch.summary}.")
        contacts = db.scalars(
            select(Contact).where(Contact.company_id == meeting.company_id)
        ).all()
        for contact in contacts[:3]:
            note = f", note: {contact.notes}" if contact.notes else ""
            lines.append(f"Contact: {contact.name}, {contact.role}{note}.")

    query = f"{meeting.company or meeting.title} results numbers proof"
    for passage in rag.search(db, query, top_k=3):
        source = passage["document_title"] + (
            f" page {passage['page']}" if passage["page"] else ""
        )
        lines.append(f"Knowledge ({source}): {passage['text'][:400]}")

    return "\n".join(lines)


def run(db: Session, payload: dict) -> dict:
    meeting_id = payload.get("meeting_id")

    if meeting_id:
        meeting = db.get(Meeting, meeting_id)
        if meeting is None:
            return {"status": "error", "summary": "Meeting not found."}
        targets = [meeting]
    else:
        targets = [
            m
            for m in db.scalars(
                select(Meeting).where(Meeting.status == "upcoming")
            ).all()
            if not m.prep
        ]
        if not targets:
            return {
                "status": "completed",
                "summary": "Meeting Assistant checked: every upcoming meeting already has a prep brief.",
                "details": {"generated": 0},
            }

    template = load_prompt("meeting-assistant", FALLBACK_PROMPT)
    generated = 0
    last_prep: str | None = None

    for meeting in targets:
        raw = generate(
            render_prompt(template, context=_context_for(db, meeting)),
            provider=provider_for("meeting-assistant"),
        )
        if raw is None:
            if generated == 0:
                return {
                    "status": "llm_unavailable",
                    "summary": "Could not reach the model. Start Ollama and run again.",
                }
            break
        meeting.prep = humanize(raw)
        last_prep = meeting.prep
        generated += 1

    db.commit()

    details: dict = {"generated": generated}
    if meeting_id and last_prep:
        details["meetingId"] = meeting_id
        details["prep"] = last_prep

    plural = "brief" if generated == 1 else "briefs"
    return {
        "status": "completed",
        "summary": f"Meeting Assistant prepared {generated} {plural}.",
        "details": details,
    }
