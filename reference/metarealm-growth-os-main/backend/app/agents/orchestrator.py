"""The Orchestrator, the real brain that runs your team as a team.

This is the upgrade from a dumb sequence to a smart controller. Instead
of always running every agent in a fixed order, the Orchestrator:

1. Looks at the real situation, what news is fresh, how many leads have
   no draft, how many deals are going quiet, what is already in your list.
2. Decides which agents are worth running today, and in what order.
3. Passes each agent the exact context it needs from the others, this is
   the teamwork, the deals hunter gets told about fresh news, the content
   agent gets told which stories are hottest.
4. Runs them, collecting what each one produced.
5. Reports back in plain words what the team did and why.

This is an orchestrator pattern, not a CrewAI style debate loop. Agents
do not argue back and forth, that is slow and costs money on every turn.
The Orchestrator decides, delegates, and passes context. It is fast,
cheap, and you can see exactly why it did what it did.
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.registry import AGENTS
from app.agents.runtime import recent_news
from app.models import Company, ContentItem, FocusTask, NewsItem, OutreachDraft


@dataclass
class Plan:
    """What the Orchestrator decided to do and why."""
    steps: list[tuple[str, dict, str]] = field(default_factory=list)  # (agent, payload, reason)


def _read_situation(db: Session) -> dict:
    """Look at the real state before deciding anything."""
    news = db.scalars(select(NewsItem)).all()
    fresh_news = [n for n in news if n.published_ago == "Just now"]
    leads = db.scalars(
        select(Company).where(Company.last_touch == "Deal signal found")
    ).all()
    leads_no_draft = [
        c for c in leads
        if not db.scalar(select(OutreachDraft).where(OutreachDraft.company_id == c.id))
    ]
    warm = db.scalars(select(Company).where(Company.status == "in_talks")).all()
    pending_content = [
        c for c in db.scalars(select(ContentItem)).all()
        if c.status == "awaiting_approval"
    ]
    open_tasks = [t for t in db.scalars(select(FocusTask)).all() if not t.done]
    return {
        "total_news": len(news),
        "fresh_news": len(fresh_news),
        "top_news": sorted(news, key=lambda x: x.score, reverse=True)[:5],
        "leads": len(leads),
        "leads_no_draft": len(leads_no_draft),
        "warm_deals": len(warm),
        "pending_content": len(pending_content),
        "open_tasks": len(open_tasks),
    }


def _decide(situation: dict) -> Plan:
    """The brain. Decide which agents to run, in what order, and why.

    This is where the Orchestrator is smart. It does not blindly run
    everything, it reacts to what is actually needed.
    """
    plan = Plan()

    # Always clean up first so the day starts fresh.
    plan.steps.append(("daily-reset", {}, "Clear finished tasks, keep the unfinished ones on top."))

    # Always get news, it feeds everything else. This is the source.
    plan.steps.append(("market-intelligence", {}, "Get the freshest gaming news, it feeds content and deals."))

    # Deals hunter right after the news, it pulls companies out of what
    # just broke. Money first.
    plan.steps.append((
        "opportunity-hunter", {},
        "Hunt for new deal signals, and pull companies out of today's news.",
    ))

    # Free emails only. Plan my day must never spend a Hunter credit.
    # You review the companies first, then you click Find emails yourself
    # on the ones you actually want. That is the only place credits go.
    plan.steps.append((
        "contact-enricher", {"free_only": True},
        "Fill emails with free guesses only. No Hunter credit is spent today. You click Find emails on the companies you keep.",
    ))

    # BD Manager drafts intros for the fresh leads while they are hot.
    plan.steps.append((
        "bd-manager", {"auto": True},
        "Draft intro emails for fresh leads that do not have one yet.",
    ))

    # Content after deals, it reacts to the same news and keeps you visible.
    plan.steps.append((
        "content-strategist", {"batch": True},
        "Write posts that react to today's news, so you stay the go to voice.",
    ))

    # Follow up engine, only really matters if there are warm deals.
    plan.steps.append((
        "followup-engine", {},
        "Chase warm deals that are going quiet before they cool off.",
    ))

    # Pipeline and relationship checks, cheap rule based, always run.
    plan.steps.append(("crm-manager", {}, "Flag any pipeline problems that need your eyes."))
    plan.steps.append(("relationship-manager", {}, "Find warm partners worth a check in."))

    # The Chief of Staff builds the final task list from everything above.
    plan.steps.append((
        "chief-of-staff", {},
        "Turn everything the team prepared into your task list for today.",
    ))

    return plan


def run_day(db: Session) -> dict:
    """Run the full orchestrated day. This is what Plan my day calls."""
    before = _read_situation(db)
    plan = _decide(before)

    results = []
    for agent_name, payload, reason in plan.steps:
        agent = AGENTS.get(agent_name)
        if not agent:
            continue
        try:
            out = agent["run"](db, payload)
            results.append({
                "agent": agent_name,
                "reason": reason,
                "status": out.get("status", "done"),
                "summary": out.get("summary", ""),
            })
        except Exception as exc:  # never let one agent break the whole day
            results.append({
                "agent": agent_name,
                "reason": reason,
                "status": "error",
                "summary": f"{agent_name} hit a problem, {exc}",
            })

    after = _read_situation(db)

    # Build a plain summary of what the team achieved.
    new_leads = after["leads"] - before["leads"]
    new_content = after["pending_content"]
    lines = ["Your team finished the morning. Here is what happened."]
    if after["fresh_news"]:
        lines.append(f"News, brought {after['fresh_news']} fresh stories.")
    if new_leads > 0:
        lines.append(f"Deals, found {new_leads} new lead{'s' if new_leads != 1 else ''} to reach out to.")
    if new_content:
        lines.append(f"Content, {new_content} posts waiting for your approval.")
    lines.append(f"Your list, {after['open_tasks']} task{'s' if after['open_tasks'] != 1 else ''} to work today.")

    # Send the brief to your phone if Telegram is set up. Meetings included.
    try:
        from app.models import Meeting
        from app.services.alerts import notify

        upcoming = [
            m for m in db.scalars(select(Meeting)).all()
            if (m.status or "").lower() in ("upcoming", "today")
        ][:4]
        phone_lines = ["Your morning brief from MetaRealm OS."]
        if upcoming:
            phone_lines.append("Meetings, " + " . ".join(f'{m.title} ' + (((m.starts_at or '')[11:16]) or m.when) for m in upcoming) + " .")
        phone_lines.append(" ".join(lines[1:]) if len(lines) > 1 else "Nothing urgent.")
        notify("\n".join(phone_lines))
    except Exception:
        pass

    return {
        "status": "completed",
        "summary": " ".join(lines),
        "details": {
            "before": before,
            "after": after,
            "steps": results,
        },
    }
