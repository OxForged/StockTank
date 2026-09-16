"""Executive Assistant — writes the real morning brief.

Recipe: read the pipeline, meetings, approvals, news and tasks from the
database, describe them in plain lines, ask the model for 2 or 3
paragraphs plus 3 actions as JSON, then save it where the dashboard
already reads the brief. The dashboard component does not change at all.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import (
    format_mad,
    humanize,
    now_label,
    parse_json_object,
    provider_for,
)
from app.models import (
    ContentItem,
    ExecutiveBrief,
    FocusTask,
    Meeting,
    NewsItem,
    Opportunity,
)
from app.services.llm import generate, load_prompt, render_prompt

OPEN_STAGES = ["lead", "contacted", "meeting", "proposal", "negotiation"]

FALLBACK_PROMPT = """Write a short morning brief from this context. Simple English. Answer only with JSON: {{"paragraphs": ["..."], "actions": ["...", "...", "..."]}}

Time: {time}

Context:
{context}"""


def _build_context(db: Session) -> tuple[str, list[str]]:
    """Turn database rows into plain sentences the model can use.
    Also returns fallback actions in case the model output is unusable."""
    lines: list[str] = []

    deals = db.scalars(
        select(Opportunity).where(Opportunity.stage.in_(OPEN_STAGES))
    ).all()
    deals.sort(key=lambda deal: deal.value_mad, reverse=True)
    total = sum(deal.value_mad for deal in deals)
    lines.append(
        f"Open pipeline: {format_mad(total)} across {len(deals)} deals."
    )
    for deal in deals[:6]:
        lines.append(
            f"Deal: {deal.company}, {deal.title}, {format_mad(deal.value_mad)}, "
            f"stage {deal.stage}, next step: {deal.next_action}, due {deal.next_action_due}."
        )

    meetings = db.scalars(
        select(Meeting).where(Meeting.status == "upcoming")
    ).all()
    soon = [m for m in meetings if m.when.startswith(("Today", "Tomorrow"))]
    for meeting in soon:
        agenda = f", about: {meeting.agenda}" if meeting.agenda else ""
        lines.append(f"Meeting {meeting.when}: {meeting.title}{agenda}.")

    awaiting = db.scalars(
        select(ContentItem).where(ContentItem.status == "awaiting_approval")
    ).all()
    if awaiting:
        titles = "; ".join(item.title for item in awaiting[:3])
        lines.append(
            f"Posts waiting for approval: {len(awaiting)}. Titles: {titles}."
        )

    news = db.scalars(select(NewsItem)).all()
    for item in news[:3]:
        lines.append(f"News ({item.source}, {item.published_ago}): {item.title}.")

    tasks = db.scalars(
        select(FocusTask).where(FocusTask.done == False)  # noqa: E712
    ).all()
    fallback_actions = [task.title for task in tasks[:3]]
    for task in tasks[:5]:
        context = f" ({task.context})" if task.context else ""
        lines.append(f"Open task, priority {task.priority}: {task.title}{context}.")

    return "\n".join(lines), fallback_actions


def run(db: Session, payload: dict) -> dict:
    context, fallback_actions = _build_context(db)
    time_label = now_label()

    template = load_prompt("executive-assistant", FALLBACK_PROMPT)
    raw = generate(
        render_prompt(template, time=time_label, context=context),
        provider=provider_for("executive-assistant"),
    )
    if raw is None:
        return {
            "status": "llm_unavailable",
            "summary": "Could not reach the model. Start Ollama and run again.",
        }

    parsed = parse_json_object(raw)
    if (
        parsed
        and isinstance(parsed.get("paragraphs"), list)
        and isinstance(parsed.get("actions"), list)
        and parsed["paragraphs"]
    ):
        paragraphs = [humanize(str(p)) for p in parsed["paragraphs"][:4]]
        actions = [humanize(str(a)) for a in parsed["actions"][:3]]
    else:
        # The model answered but not in JSON. Keep the text, derive actions.
        paragraphs = [humanize(raw)]
        actions = fallback_actions or ["Review the pipeline board"]

    brief = db.get(ExecutiveBrief, "brief")
    if brief is None:
        brief = ExecutiveBrief(id="brief")
        db.add(brief)
    brief.generated_at = time_label
    brief.paragraphs = paragraphs
    brief.actions = actions
    db.commit()

    return {
        "status": "completed",
        "summary": f"Executive Assistant wrote the morning brief at {time_label}.",
        "details": {"generatedAt": time_label, "paragraphs": len(paragraphs)},
    }
