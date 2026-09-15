"""Shared helpers for every AI employee.

The runtime is small on purpose. Each employee follows the same recipe:
1. read real data from the database
2. build one clear prompt
3. ask the model once
4. clean the text and save the result

No agent framework is needed for that recipe. LangGraph joins in
Milestone 7, when agents start doing multi step research loops
(search, read, decide, search again). The employee contract below
will not change when that happens.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import ActivityItem, AgentRun


def now_label() -> str:
    """Current time as HH:MM in the founder's timezone."""
    try:
        return datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%H:%M")
    except Exception:
        return datetime.now().strftime("%H:%M")


def now_iso() -> str:
    try:
        return datetime.now(ZoneInfo(settings.TIMEZONE)).isoformat(timespec="seconds")
    except Exception:
        return datetime.now().isoformat(timespec="seconds")


# Which paid brain each agent prefers when its key is set. This is the
# routing strategy: the right AI for each job, decided in code.
#  grok  -> live X, best for news and finding deal signals
#  anthropic -> best for human writing and careful judgement
# You chose Grok for everything, it is cheap and reads live X. Every
# agent that thinks uses Grok when the key is set. CRM Manager and Chief
# of Staff use no AI at all, they are pure rules.
BEST_BRAIN = {
    "market-intelligence": "grok",
    "opportunity-hunter": "grok",
    "research-analyst": "grok",
    "content-strategist": "grok",
    "bd-manager": "grok",
    "proposal-builder": "grok",
    "executive-assistant": "grok",
    "meeting-assistant": "grok",
    "relationship-manager": "grok",
}


def provider_for(agent_name: str) -> str | None:
    """Which brain does this employee use?

    Employees listed in PREMIUM_AGENTS use the paid Anthropic API when a
    key is set. Everyone else uses the default provider (free Ollama).
    Returning None means "use the default".
    """
    premium = {name.strip() for name in settings.PREMIUM_AGENTS.split(",") if name.strip()}

    # Manual override always wins: if you listed this agent in PREMIUM_AGENTS
    # and set a Claude key, it uses Claude.
    if agent_name in premium and settings.ANTHROPIC_API_KEY:
        return "anthropic"

    # Otherwise, smart routing: give each agent its best brain automatically
    # when that key is available. News and deal hunting prefer Grok for its
    # live X reading. Writing and judgement prefer Claude. If the preferred
    # key is not set, fall through to free Ollama.
    best = BEST_BRAIN.get(agent_name)
    if best == "anthropic" and settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if best == "grok" and settings.XAI_API_KEY:
        return "grok"
    return None


def humanize(text: str) -> str:
    """Enforce the house style in code, not just in the prompt.

    No underscores. No dash punctuation. Commas and periods only.
    This runs on every text an employee writes, so even if the model
    slips, the output stays clean.
    """
    text = text.replace("_", " ")
    text = re.sub(r"\s*[—–·]\s*", ", ", text)
    text = text.replace("-", " ")
    text = re.sub(r"\s+-\s+", ", ", text)
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r"\s+([,.])", r"\1", text)
    return text.strip()


def format_mad(value: int) -> str:
    if value >= 1_000_000:
        millions = f"{value / 1_000_000:.2f}".rstrip("0").rstrip(".")
        return f"{millions}M MAD"
    if value >= 1_000:
        return f"{round(value / 1_000)}K MAD"
    return f"{value} MAD"


def parse_json_object(text: str) -> dict | None:
    """Small local models sometimes wrap JSON in extra words.
    Try the whole text first, then the first {...} block inside it."""
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def log_run(
    db: Session,
    agent: str,
    status: str,
    summary: str,
    details: dict | None = None,
) -> None:
    """Every run is recorded, and successful work shows up in the
    dashboard activity feed so you can see your employees working."""
    db.add(
        AgentRun(
            id=f"run-{uuid.uuid4().hex[:10]}",
            agent=agent,
            status=status,
            summary=summary,
            details=details,
            created_at=now_iso(),
        )
    )
    if status == "completed":
        db.add(
            ActivityItem(
                id=f"act-{uuid.uuid4().hex[:8]}",
                kind="system",
                text=summary,
                time=now_label(),
            )
        )
    db.commit()


def recent_news(db, region: str | None = None, limit: int = 12) -> list:
    """Shared team memory: the news the News Manager collected, best first.

    Morocco scores highest, then MENA, then web3, then drama, so the top
    of this list is always the most useful for Moroccan gaming content and
    deals. Any agent can call this to build on the News Manager's work.
    """
    from sqlalchemy import select

    from app.models import NewsItem

    items = db.scalars(select(NewsItem)).all()
    if region:
        items = [n for n in items if n.region == region] or items
    return sorted(items, key=lambda x: x.score, reverse=True)[:limit]
