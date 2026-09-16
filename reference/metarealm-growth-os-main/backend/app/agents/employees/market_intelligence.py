"""News Manager, powered by Grok, last 7 days only, no repeats.

How it works now:
- Grok reads live X and the web for real news from the last 7 days.
- It skips anything older, and anything with no real link.
- It never repeats a story you already have, checks by title AND url.
- Old stories in your list past 7 days get cleared out automatically,
  unless you saved them by hand.
- Every story shows where it came from, the X handle or the outlet.

Your quotas from Settings decide how many per region. Send {"reset":
true} once to wipe the list and start clean.
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.agents.runtime import humanize, now_iso
from app.services.alerts import notify
from app.services.rss import FEEDS, fetch_feed, passes_filter
from app.services.runtime_settings import get_int
from app.services.search import SearchBudget, search_web, search_x

# Smart, specific search prompts per region. Grok reads these against live
# X and the web. They ask for real, dated, sourced news, not vague topics.
X_QUERIES = {
    "morocco": [
        "Morocco gaming esports news this week tournaments teams sponsors Edawry MGE Lunaris",
        "Moroccan gamers streamers content creators gaming brands news recent",
    ],
    "mena": [
        "MENA gaming esports news this week Saudi EWC Gamers8 Qiddiya UAE Qatar Egypt",
        "Middle East esports investment tournament sponsorship deal recent",
    ],
    "web3": [
        "new web3 game blockchain game launch this week real project names funding",
        "web3 gaming crypto gaming play to earn news partnerships airdrops recent",
    ],
    "gaming": [
        "biggest esports news this week world cup major upset signing ban record",
    ],
}
WEB_QUERIES = {
    "morocco": ["Morocco gaming esports news last 7 days"],
    "mena": ["MENA Saudi esports gaming news last 7 days"],
    "web3": ["web3 gaming blockchain game news last 7 days"],
    "gaming": ["biggest gaming esports news this week"],
}

DRAMA_WORDS = [
    "world cup", "champion", "wins", "beats", "upset", "banned", "kicked",
    "disqualified", "controversy", "scandal", "record", "signs", "final",
    "shock", "retires", "t1", "faker", "million", "acquires", "invests", "launch",
]
REGION_BASE = {"morocco": 100, "mena": 70, "web3": 60, "gaming": 30}


def _score(region: str, title: str) -> int:
    score = REGION_BASE.get(region, 10)
    low = title.lower()
    score += sum(8 for w in DRAMA_WORDS if w in low)
    for w in ["morocco", "maroc", "casablanca", "rabat", "edawry", "mge", "lunaris"]:
        if w in low:
            score += 25
    return score


def _is_junk_link(url: str) -> bool:
    """A homepage or category page, not a real story. Reject it."""
    if not url or not url.startswith("http"):
        return True
    # Strip scheme and domain, look at the path.
    tail = url.split("//", 1)[-1]
    parts = tail.split("/", 1)
    path = parts[1] if len(parts) > 1 else ""
    path = path.strip("/")
    # No path, or a short one word path like "gaming" or "news", is a
    # section page, not an article. Real articles have a long slug.
    if not path:
        return True
    if len(path) < 15 and "-" not in path and "_" not in path:
        return True
    return False


def _is_junk_title(title: str) -> bool:
    """A title that is just a url, a domain, or a category word."""
    low = title.lower().strip()
    if low.startswith("http") or low.startswith("www."):
        return True
    if "." in low and " " not in low:  # looks like a bare domain
        return True
    # Single category word, not a headline.
    if low in {"gaming", "news", "esports", "web3", "home", "latest"}:
        return True
    return False


def _add(db, seen_titles, seen_urls, region, title, url, source):
    title = humanize(title).strip()
    if not title or len(title) < 12:
        return 0
    # Reject homepage links and junk titles. We want real news, not sections.
    if _is_junk_link(url) or _is_junk_title(title):
        return 0
    # Hard dedup: skip if we have this title or this url already.
    key = title.lower()
    if key in seen_titles:
        return 0
    if url and url in seen_urls:
        return 0
    db.add(NewsItem(
        id=f"news-{uuid.uuid4().hex[:8]}", title=title, source=source,
        region=region, published_ago="Just now", url=url or None,
        saved=False, score=_score(region, title), created_at=now_iso(),
    ))
    seen_titles.add(key)
    if url:
        seen_urls.add(url)
    return 1


def run(db: Session, payload: dict) -> dict:
    if payload.get("reset"):
        db.execute(delete(NewsItem))
        db.commit()

    QUOTAS = {
        "morocco": payload.get("morocco") or get_int(db, "NEWS_MOROCCO", 5),
        "mena": payload.get("mena") or get_int(db, "NEWS_MENA", 8),
        "web3": payload.get("web3") or get_int(db, "NEWS_WEB3", 7),
        "gaming": payload.get("drama") or get_int(db, "NEWS_DRAMA", 3),
    }

    # Clear stories older than 7 days first, unless saved. Keeps it fresh.
    cutoff = datetime.now() - timedelta(days=7)
    for item in db.scalars(select(NewsItem)).all():
        if item.saved:
            continue
        try:
            made = datetime.fromisoformat(item.created_at) if item.created_at else None
        except Exception:
            made = None
        if made and made < cutoff:
            db.delete(item)
    db.commit()

    existing = db.scalars(select(NewsItem)).all()
    seen_titles = {i.title.lower() for i in existing}
    seen_urls = {i.url for i in existing if i.url}
    budget = SearchBudget()
    added_by_region: dict[str, int] = {}

    for region, quota in QUOTAS.items():
        got = 0
        # Your number in Settings is the number. Not one more.
        if quota <= 0:
            added_by_region[region] = 0
            continue
        # One strong Grok search per query. It now searches X, web, and news
        # together, so it finds real stories from all sources in one call.
        for query in X_QUERIES.get(region, []):
            if got >= quota:
                break
            for post in search_x(query, max_results=quota + 3, budget=budget):
                if got >= quota:
                    break
                handle = post.get("handle", "")
                if handle:
                    src = handle if handle.startswith("@") else f"@{handle}"
                else:
                    src = post.get("source", "web")
                got += _add(db, seen_titles, seen_urls, region, post["title"], post["url"], src)
        # Web top up if the main search fell short.
        if got < quota:
            for query in WEB_QUERIES.get(region, []):
                for r in search_web(query, max_results=quota, budget=budget, news_only=True):
                    if got >= quota:
                        break
                    got += _add(db, seen_titles, seen_urls, region, r["title"], r["url"], r.get("source", "web"))
        # RSS backstop, free gaming feeds, junk filtered, so the list is
        # never empty even if Grok has a bad day. Real headlines only.
        if got < quota:
            for feed in FEEDS.get(region, []):
                if got >= quota:
                    break
                for entry in fetch_feed(feed["url"]):
                    if got >= quota:
                        break
                    if passes_filter(entry["title"], feed["filter"]):
                        got += _add(db, seen_titles, seen_urls, region, entry["title"], entry["link"], entry["source"] or "RSS")
        added_by_region[region] = got

    db.commit()

    # Keep exactly your number per region, plus anything you saved by hand.
    # Before this kept quota plus 2, which is why you saw 7 Morocco when
    # you asked for 5. Your setting is now the real cap.
    KEEP = dict(QUOTAS)
    all_items = db.scalars(select(NewsItem)).all()
    saved = [i for i in all_items if i.saved]
    for region, cap in KEEP.items():
        unsaved = sorted(
            [i for i in all_items if i.region == region and not i.saved],
            key=lambda x: x.score, reverse=True,
        )
        for item in unsaved[cap:]:
            db.delete(item)
    db.commit()

    # Alert on the single biggest fresh story if it is strong.
    fresh = sorted(
        [i for i in db.scalars(select(NewsItem)).all() if i.published_ago == "Just now"],
        key=lambda x: x.score, reverse=True,
    )
    if fresh and fresh[0].score >= 120:
        notify(f"Big gaming news, {fresh[0].title}. Good for content. Open MetaRealm OS.")

    total = len(db.scalars(select(NewsItem)).all())
    added_total = sum(added_by_region.values())
    parts = ", ".join(f"{added_by_region.get(r, 0)} {r}" for r in QUOTAS)

    if not settings_has_grok():
        note = " Tip, connect Grok in Settings for live X news, that is where the best gaming news breaks."
    else:
        note = ""

    if added_total == 0:
        from app.services.search import LAST_GROK_RAW
        debug = LAST_GROK_RAW.get("text", "")
        return {
            "status": "completed",
            "summary": f"News Manager searched X, the web, news sites, and feeds for the last 7 days but found nothing new to add. You have {total} in the list.{note}",
            "details": {"added": 0, "total": total, "saved": len(saved), "grokSaid": debug[:300]},
        }
    return {
        "status": "completed",
        "summary": f"News Manager brought fresh news from the last 7 days, {parts}. You now have {total}, best on top, no repeats. Saved stories stay.",
        "details": {"added": added_total, "byRegion": added_by_region, "total": total, "saved": len(saved), "paidSearches": budget.used},
    }


def settings_has_grok() -> bool:
    from app.core.config import settings
    return bool(settings.XAI_API_KEY)


from app.models import NewsItem  # noqa: E402  (kept at end to avoid cycle in some setups)
