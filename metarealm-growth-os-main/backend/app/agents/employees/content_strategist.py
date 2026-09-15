"""Content Strategist, drafts smart specific posts for X and LinkedIn.

Two modes:
1. Single, one post for a chosen platform and topic. The AI draft button.
2. Batch, the morning fill. It reads your per topic counts from Settings,
   for X and LinkedIn each: company, Morocco, MENA, web3, drama. It writes
   exactly that many for each, reacting to real news, and lands them in
   your approval queue.

It reacts to REAL news, names the real game, team, brand. Never generic.
It uses only your real facts, so it cannot invent numbers.
"""

import json
import re
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import humanize, parse_json_object, provider_for
from app.core.config import settings
from app.models import ContentItem, NewsItem
from app.services import rag
from app.services.llm import generate, load_prompt, render_prompt
from app.services.runtime_settings import get_int

VALID_PLATFORMS = {"linkedin", "x"}

# Each topic: the angle for the model, and which news region feeds it.
TOPICS = {
    "company": {
        "label": "about MetaRealm or Lunaris",
        "angle": "share something real and specific about MetaRealm or Lunaris Esports, a result, a creator, a win, a case study number, why brands should work with us, humble and concrete, not bragging",
        "region": None,  # uses our facts, not news
    },
    "morocco": {
        "label": "the Moroccan gaming market",
        "angle": "react to a REAL Moroccan gaming or esports story from the news, name the real thing, give a sharp local take, position us as the Morocco gaming expert. Do NOT talk about MetaRealm, Lunaris, KingSpec, or MGEX results in this post, this one is about the market, not about us",
        "region": "morocco",
    },
    "mena": {
        "label": "the MENA gaming market",
        "angle": "react to a REAL MENA gaming or esports story from the news, name the real event or company, say what it means for brands and the region. Do NOT talk about MetaRealm, Lunaris, KingSpec, or MGEX in this post, this one is about the market, not about us",
        "region": "mena",
    },
    "web3": {
        "label": "web3 gaming",
        "angle": "react to a REAL web3 game or web3 gaming story from the news, name the actual game or project, what it means, NEVER a general slogan like web3 is the future. Do NOT talk about MetaRealm, Lunaris, or our results in this post, this one is about web3 gaming, not about us",
        "region": "web3",
    },
    "drama": {
        "label": "esports drama and big news",
        "angle": "react to a REAL big esports story or drama from the news, a real match, a real player, a real event, give a hot take people want to share. Do NOT talk about MetaRealm, Lunaris, or our results in this post, this one is about the story, not about us",
        "region": "gaming",
    },
}

# X_COMPANY, LI_MOROCCO, etc. Map platform+topic to the settings key.
def _count_key(platform: str, topic: str) -> str:
    prefix = "X" if platform == "x" else "LI"
    return f"{prefix}_{topic.upper()}"


def _facts(db: Session) -> str:
    passages = rag.search(db, "results reach impressions creators tiers achievements", top_k=6)
    if passages:
        return "\n\n".join(p["text"][:500] for p in passages)
    facts = Path(settings.KNOWLEDGE_DIR) / "metarealm-facts.md"
    if facts.exists():
        return facts.read_text(encoding="utf-8")[:3000]
    return ""


def _news_for(db: Session, region: str | None) -> str:
    """News for one region only. No region news means empty, on purpose.

    The old version fell back to ALL news when a region had none. That is
    how a web3 post ended up talking about a Moroccan esports match. Now a
    topic only sees its own news, and if there is none, the batch skips
    that topic honestly instead of writing posts with the wrong label.
    """
    items = db.scalars(select(NewsItem)).all()
    if region:
        items = [n for n in items if n.region == region]
    items = sorted(items, key=lambda x: x.score, reverse=True)[:10]
    if not items:
        return ""
    return "\n".join(f"- {n.title} ({n.source})" for n in items)


def _parse_list(text: str) -> list[dict]:
    try:
        p = json.loads(text)
        if isinstance(p, list):
            return [x for x in p if isinstance(x, dict)]
    except Exception:
        pass
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if m:
        try:
            p = json.loads(m.group(0))
            if isinstance(p, list):
                return [x for x in p if isinstance(x, dict)]
        except Exception:
            return []
    return []


def _recent_titles(db, platform: str, limit: int = 15) -> str:
    """Recent post titles so the model does not repeat itself."""
    items = [
        c for c in db.scalars(select(ContentItem)).all()
        if c.platform == platform and c.author == "Content Strategist"
    ]
    items = items[-limit:]
    if not items:
        return ""
    return "\n".join(f"- {c.title}" for c in items)


def _write_posts(db, platform: str, topic: str, cfg: dict, count: int, facts: str, written: set) -> int:
    """Write `count` posts for one platform+topic. Retries to hit the count.
    `written` holds normalized bodies from this whole run, so the same post
    can never appear twice, even across topics."""
    if count <= 0:
        return 0
    news = _news_for(db, cfg["region"]) if cfg["region"] else ""
    avoid = _recent_titles(db, platform)
    template = load_prompt("content-strategist-batch", BATCH_FALLBACK)
    made = 0
    attempts = 0
    # Ask for the full count. If the model returns fewer, ask again for the rest.
    while made < count and attempts < 3:
        attempts += 1
        need = count - made
        news_block = news or "No fresh news for this topic, use a smart general angle but stay specific."
        if written:
            ideas = "\n".join(f"- {w}" for w in list(written)[-10:])
            news_block += f"\n\nPosts already written today, do NOT repeat these ideas or stories:\n{ideas}"
        if avoid:
            news_block += f"\n\nDo NOT repeat these posts you already wrote:\n{avoid}"
        raw = generate(
            render_prompt(
                template, count=str(need), platform=platform,
                angle=cfg["angle"], sources=facts, news=news_block,
            ),
            provider=provider_for("content-strategist"),
        )
        if raw is None:
            break
        posts = _parse_list(raw)
        if not posts:
            posts = [{"title": f"{topic} {platform}", "body": raw}]
        for post in posts[:need]:
            body = humanize(str(post.get("body", ""))).strip()
            if not body or len(body) < 15:
                continue
            # Never write the same post twice in one run.
            key = body[:80].lower()
            if key in written:
                continue
            written.add(key)
            title = humanize(str(post.get("title") or f"{cfg['label']}"))[:120]
            db.add(ContentItem(
                id=f"cnt-{uuid.uuid4().hex[:8]}",
                title=title, platform=platform, status="awaiting_approval",
                body=body, author="Content Strategist", topic=topic,
            ))
            made += 1
    return made


def _batch(db: Session, payload: dict) -> dict:
    facts = _facts(db)
    if not facts:
        return {"status": "error", "summary": "No facts found. The file knowledge/metarealm-facts.md is missing."}

    # A news topic with no news gets skipped, honestly. No more posts that
    # wear a web3 label but talk about an esports match.
    skipped: list[str] = []
    for topic, cfg in TOPICS.items():
        if cfg["region"] and not _news_for(db, cfg["region"]):
            skipped.append(topic)

    # Read per topic counts from Settings. Payload can override for a test.
    override = payload.get("counts", {})
    made_by = {}
    total = 0
    written: set = set()
    for platform in ("x", "linkedin"):
        for topic, cfg in TOPICS.items():
            if topic in skipped:
                continue
            key = _count_key(platform, topic)
            count = override.get(platform, {}).get(topic)
            if count is None:
                count = get_int(db, key, 2)
            n = _write_posts(db, platform, topic, cfg, count, facts, written)
            if n:
                made_by[f"{platform}:{topic}"] = n
                total += n
    db.commit()

    if total == 0:
        return {"status": "error", "summary": "Could not draft posts this time. Check your counts in Settings are not all zero, and try again."}

    x_total = sum(v for k, v in made_by.items() if k.startswith("x:"))
    li_total = sum(v for k, v in made_by.items() if k.startswith("linkedin:"))
    summary = (
        f"Content Strategist wrote {total} posts, {x_total} for X and "
        f"{li_total} for LinkedIn, each reacting to real news from its own topic. "
        f"All waiting for your approval."
    )
    if skipped:
        summary += (
            f" Skipped {', '.join(skipped)}, no fresh news in "
            f"{'that topic' if len(skipped) == 1 else 'those topics'} today, "
            f"better nothing than a post with the wrong label."
        )
    return {
        "status": "completed",
        "summary": summary,
        "details": {"made": total, "byTopic": made_by, "skippedNoNews": skipped},
    }


def _single(db: Session, payload: dict) -> dict:
    platform = (payload.get("platform") or "x").lower()
    if platform not in VALID_PLATFORMS:
        platform = "x"
    topic = payload.get("topic") or "a smart take on gaming in Morocco or MENA"
    facts = _facts(db)
    news = _news_for(db, None)
    template = load_prompt("content-strategist", SINGLE_FALLBACK)
    raw = generate(
        render_prompt(template, platform=platform, topic=topic, sources=facts, news=news),
        provider=provider_for("content-strategist"),
    )
    if raw is None:
        return {"status": "llm_unavailable", "summary": "Could not reach the model. Check Grok in Settings, or start Ollama."}
    obj = parse_json_object(raw) or {"title": topic[:60], "body": raw}
    body = humanize(str(obj.get("body", ""))).strip()
    if not body:
        return {"status": "error", "summary": "Could not write a post this time. Try again."}
    title = humanize(str(obj.get("title") or topic))[:120]
    item = ContentItem(
        id=f"cnt-{uuid.uuid4().hex[:8]}",
        title=title, platform=platform, status="awaiting_approval",
        body=body, author="Content Strategist",
        topic=str(payload.get("topic_tag") or "general"),
    )
    db.add(item)
    db.commit()
    return {"status": "completed", "summary": f"Content Strategist wrote one {platform} post, waiting for your approval.", "details": {"id": item.id}}


SINGLE_FALLBACK = """Write one {platform} post for a gaming marketing agency in Morocco. Topic: {topic}. Be specific, name the real thing. Simple English, no dashes, no underscores. Answer only with JSON: {"title": "...", "body": "..."}

Our facts:
{sources}

News you can react to:
{news}"""

BATCH_FALLBACK = """Write {count} different {platform} posts for MetaRealm, a gaming marketing agency in Morocco. Angle: {angle}. Be specific, name the real game, team, or brand from the news. Never generic. Simple English, no dashes, no underscores, commas and periods only. Answer only with a JSON list: [{"title": "...", "body": "..."}]

Our facts, use only if it fits:
{sources}

Real news to react to:
{news}"""


def run(db: Session, payload: dict) -> dict:
    if payload.get("batch"):
        return _batch(db, payload)
    return _single(db, payload)
