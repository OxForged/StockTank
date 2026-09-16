"""Opportunity Hunter — finds sponsor signals and every way to reach them.

What counts as a signal now, wider than before:
- Hard signals: wants gaming creators, launching an esports team, a
  gaming campaign, a sponsorship, a partnership.
- Soft signals: talking to gamers or youth, "are you a gamer", "made
  for the youth", a gaming reference in a brand post. If a brand talks
  to young gamers, we can pitch them.

For every company it keeps EVERYTHING it found to reach them:
- the exact link to what they published,
- a public email if they publish one,
- a LinkedIn page (company or the person who posted),
- the X handle, the person's name, the website.

It never invents a contact. Real links only, from the finds. If nothing
qualifies, it says so honestly instead of making things up.
"""

import json
import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import humanize, provider_for, recent_news
from app.models import Company
from app.services.llm import generate, load_prompt, render_prompt
from app.services.alerts import notify
from app.services.email_finder import guess_emails
from app.services.enrich import find_email
from app.services.search import SearchBudget, search_web, search_x
from app.services.website_finder import find_official_website

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
GENERIC_PREFIXES = (
    "partnership", "partnerships", "contact", "info", "hello", "marketing",
    "media", "press", "sponsor", "sponsors", "bd", "business", "sales", "team",
)

# Search EVERYWHERE for deals, web and X, last month of signals. More
# queries and angles so we bring the maximum number of real leads per day.
WEB_QUERIES = [
    "brand wants gaming content creators OR streamers apply now",
    "company launches esports team OR gaming campaign in MENA or Morocco",
    "brand sponsors esports tournament OR gaming event this month",
    "company enters gaming OR announces gaming marketing push recent",
    "brand ambassador program for gamers OR streamers open",
    "web3 game seeking creators OR esports partners OR ambassadors",
    "new gaming brand OR energy drink OR telecom targeting gamers MENA",
    "company partnership with esports org OR gaming creators announced",
    "brand activation at gaming event Morocco MENA sponsor",
    "startup raises funding for gaming OR esports MENA Morocco",
]
X_QUERIES = [
    "brand looking for gaming creators OR esports partner",
    "company launching esports team OR gaming campaign MENA",
    "we are looking for gaming content creators partnership",
    "brand asks are you a gamer OR made for gamers OR for the youth",
    "applications open gaming creators OR streamers OR esports",
    "web3 game partner OR ambassador OR creator program",
    "sponsor an esports team OR gaming event Morocco MENA",
]


def _name_tokens(name: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", name.lower()) if len(t) > 2]


def _find_contacts(name: str, budget: SearchBudget) -> dict:
    """Search for any public way to reach this company.

    Only keeps a contact if the company name plausibly appears in it, so
    enrichment can never attach a different company's email or page.
    """
    contacts: dict = {"email": None, "linkedin": None, "website": None}
    tokens = _name_tokens(name)
    results = search_web(f"{name} contact partnership LinkedIn", max_results=5, budget=budget)
    for r in results:
        url = r.get("url", "")
        blob = f"{r['title']} {r['snippet']} {url}".lower()
        matches_company = any(t in blob for t in tokens)
        if not matches_company:
            continue
        if not contacts["email"]:
            for match in EMAIL_RE.findall(f"{r['title']} {r['snippet']} {url}"):
                if any(match.split("@")[0].lower().startswith(g) for g in GENERIC_PREFIXES):
                    contacts["email"] = match
                    break
        if not contacts["linkedin"] and "linkedin.com/" in url:
            contacts["linkedin"] = url
        if not contacts["website"] and url and "linkedin.com" not in url and "facebook" not in url:
            contacts["website"] = url
    return contacts


PROMPT = """You read search results and X posts. Find companies that show ANY interest in gaming, esports, or the youth, so Marouane can reach out.

What counts as a signal, be generous:
- They want gaming creators, a team, a campaign, a sponsorship, a partnership.
- OR they talk to gamers or youth, say things like are you a gamer, made for the youth, or make a gaming reference in a brand post. If a brand talks to young gamers, that is a signal.

Rules:
- Only include a company if the finds show a real signal. Skip pure noise.
- Copy the exact source link for what they published. Never invent a link, an email, or a company.
- Copy any handle, person name, or website you see. Leave blank if not shown.
- Skip these known ones: {known}

Finds:
{finds}

Answer with ONLY this JSON list, nothing else. If nothing qualifies, answer [].
[{"name": "...", "industry": "...", "signal": "what they said or did, one short line", "source_url": "the exact link to what they published", "handle": "@handle if shown", "person": "name of who posted if shown", "website": "site if shown"}]"""


def _best_guess_email(person: str, website: str) -> str | None:
    """Free pattern only during hunt. Hunter runs later in Contact Enricher."""
    if not website:
        return None
    guess = guess_emails(person or "partnerships team", website=website)
    cands = guess.get("candidates") or guess.get("generic") or []
    return (cands[0] + " (best guess, verify before sending)") if cands else None


def run(db: Session, payload: dict) -> dict:
    known = {c.name.lower() for c in db.scalars(select(Company)).all()}
    budget = SearchBudget()
    finds: list[str] = []

    for query in WEB_QUERIES:
        for r in search_web(query, max_results=5, budget=budget):
            if r["url"]:
                finds.append(f"- {r['title']} | {r['snippet'][:200]} | link: {r['url']}")
    for query in X_QUERIES:
        for post in search_x(query, max_results=6, budget=budget):
            if post.get("url"):
                finds.append(
                    f"- {post['title']} | {post['snippet'][:200]} | link: {post['url']} | handle: {post.get('handle','')}"
                )

    # TEAMWORK: read the news the News Manager already collected. If a story
    # names a brand doing something in gaming, that is a lead too.
    for item in recent_news(db, limit=15):
        if item.url:
            finds.append(f"- NEWS: {item.title} | from {item.source} | link: {item.url}")

    if not finds:
        return {
            "status": "no_sources",
            "summary": (
                "Search is not reachable. Make sure you started with docker compose up -d --build and give SearXNG 30 seconds. "
                "For live X deal signals add a Grok key in Settings, that is where most gaming deals break."
            ),
            "details": {"added": 0},
        }

    template = load_prompt("opportunity-hunter", PROMPT)
    raw = generate(
        render_prompt(template, known=", ".join(sorted(known)) or "none", finds="\n".join(finds)),
        provider=provider_for("opportunity-hunter"),
    )
    if raw is None:
        return {"status": "llm_unavailable", "summary": "Could not reach the model. Start Ollama and run again."}

    candidates = _parse_list(raw)
    added = 0
    names: list[str] = []
    for c in candidates:
        name = humanize(str(c.get("name", ""))).strip()
        source = str(c.get("source_url", "")).strip()
        # Hard rule kept: no source link, no company. Every lead traceable.
        if not name or name.lower() in known or not source.startswith("http"):
            continue

        signal = humanize(str(c.get("signal", ""))).strip()
        handle = humanize(str(c.get("handle", ""))).strip()
        person = humanize(str(c.get("person", ""))).strip()
        website = str(c.get("website", "")).strip()

        # Enrich with any public contact path we can search up (cap 3 lookups).
        found = _find_contacts(name, budget) if added < 3 else {}
        email = found.get("email")
        linkedin = found.get("linkedin")
        website = website or (found.get("website") or "")

        parts = [f"Signal: {signal}" if signal else "Gaming interest found."]
        parts.append(f"They published: {source}")
        # Every way to reach them, in order of usefulness.
        ways = []
        if email:
            ways.append(f"Email: {email}")
        if linkedin:
            ways.append(f"LinkedIn: {linkedin}")
        if person:
            ways.append(f"Person who posted: {person}")
        if handle:
            ways.append(f"X: {handle}")
        if website:
            ways.append(f"Site: {website}")
        if ways:
            parts.append("Reach them, " + " . ".join(ways) + " .")
        else:
            parts.append("No public contact found, search their name on LinkedIn to find the right person.")

        # Website. Use the one the search actually found, not only the one the
        # model echoed back. This was the bug that left company cards with an
        # empty website, which made Find emails useless later.
        if not website:
            try:
                website = find_official_website(name) or ""
            except Exception:
                website = ""

        # If we have a website but no email yet, try to find one legally,
        # from their public pages, or offer a standard business address.
        auto_email = str(c.get("email", "")).strip()
        auto_website = website
        if not auto_email and auto_website:
            try:
                found = find_email(auto_website, str(c.get("person", "")))
                if found.get("email"):
                    auto_email = found["email"]
            except Exception:
                pass

        db.add(
            Company(
                id=f"com-{uuid.uuid4().hex[:8]}",
                name=name,
                industry=humanize(str(c.get("industry", "Unknown"))),
                status="prospect",
                reason_to_contact=" ".join(parts)[:900],
                last_touch="Deal signal found",
                details=humanize(str(c.get("signal", "")))[:900] or None,
                contact_person=str(c.get("person", "")).strip()[:120] or None,
                contact_email=(auto_email or str(c.get("email", "")).strip())[:200] or None,
                contact_linkedin=str(c.get("linkedin", "")).strip()[:300] or None,
                source_url=str(c.get("source_url", "")).strip()[:400] or None,
                website=website.strip()[:300] or None,
            )
        )
        known.add(name.lower())
        names.append(name)
        added += 1

    db.commit()

    if added == 0:
        return {
            "status": "completed",
            "summary": f"Deals Hunter searched everywhere it could, X, Google, and public LinkedIn, {budget.used} searches, and found no clear new deal signal today. That happens, signals come and go. It will look again next time.",
            "details": {"added": 0, "paidSearches": budget.used, "searchedEverywhere": True},
        }
    # Alert your phone about fresh deal signals, this is hot money.
    if names:
        notify(f"New deal signal, {', '.join(names)}. Open MetaRealm OS to see the source and reach out.")

    return {
        "status": "completed",
        "summary": f"Deals Hunter found {added} {'lead' if added == 1 else 'leads'} from {budget.used} searches across X, Google, and LinkedIn: {', '.join(names)}. Each card shows what they published and every way to reach them.",
        "details": {"added": added, "names": names, "paidSearches": budget.used},
    }


def _parse_list(text: str) -> list[dict]:
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [x for x in parsed if isinstance(x, dict)]
    except Exception:
        pass
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, list):
                return [x for x in parsed if isinstance(x, dict)]
        except Exception:
            return []
    return []
