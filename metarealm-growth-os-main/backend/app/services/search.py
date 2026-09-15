"""Web search — free by default, paid power when you add a key.

Order of preference for a normal web search:
1. SearXNG, your own free search engine (zero cost).
2. Perplexity, cited real-time web news, if a key is set.
3. Tavily free tier, if a key is set.

X/Twitter is a separate capability. Only Grok (xAI) can read live X,
so search_x() uses Grok when a key is set, and returns nothing
otherwise, honestly, rather than pretending.

Every paid call is counted against MAX_PAID_SEARCHES_PER_RUN so a bug
can never run up the bill.
"""

import json

import httpx

from app.core.config import settings


LAST_GROK_RAW = ""


class SearchBudget:
    """Counts paid searches within a single agent run."""

    def __init__(self) -> None:
        self.used = 0

    def allow(self) -> bool:
        if self.used >= settings.MAX_PAID_SEARCHES_PER_RUN:
            return False
        self.used += 1
        return True


def _grok_responses(system: str, user: str, tools: list[dict], timeout: int = 120):
    """Call xAI's current Responses API with server side search tools.

    xAI retired the old live search in 2026, the old endpoint now returns
    410 Gone. This is the new way: POST /v1/responses with tools like
    x_search and web_search. Returns (text, citation_urls).
    """
    r = httpx.post(
        "https://api.x.ai/v1/responses",
        headers={
            "Authorization": f"Bearer {settings.XAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": settings.XAI_MODEL,
            "input": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "tools": tools,
        },
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json()
    text = ""
    cites: list[str] = []
    for item in data.get("output", []) or []:
        if item.get("type") == "message":
            for part in item.get("content", []) or []:
                if part.get("type") == "output_text":
                    text += part.get("text", "")
                    for ann in part.get("annotations", []) or []:
                        u = ann.get("url") or ann.get("uri")
                        if u:
                            cites.append(u)
    if not text and isinstance(data.get("output_text"), str):
        text = data["output_text"]
    for u in data.get("citations", []) or []:
        if isinstance(u, str):
            cites.append(u)
        elif isinstance(u, dict) and u.get("url"):
            cites.append(u["url"])
    return text, cites


def _grok_news_pipeline(text: str, cites: list, max_results: int) -> list[dict]:
    """Turn Grok's reply into clean stories: lines, then JSON, then citations."""
    items = _parse_lines(text)
    if not items:
        for it in _extract_json_list(text):
            items.append({
                "title": it.get("title", ""), "url": it.get("url", ""),
                "handle": it.get("handle", ""), "source": it.get("source", ""),
            })
    if not items and cites:
        lines = [l.strip("-*# 0123456789.").strip() for l in text.splitlines()]
        lines = [l for l in lines if len(l) > 20 and "|||" not in l]
        for i, line in enumerate(lines):
            items.append({
                "title": line, "url": cites[i] if i < len(cites) else "",
                "handle": "", "source": "grok",
            })
    out = []
    for it in items:
        title = (it.get("title") or "").strip()
        if len(title) < 12:
            continue
        out.append({
            "title": title,
            "url": (it.get("url") or "").strip(),
            "snippet": it.get("snippet", ""),
            "handle": (it.get("handle") or "").strip(),
            "source": (it.get("source") or "").strip() or "grok",
        })
    return out[:max_results] if max_results else out


NEWS_SYSTEM = (
    "You are a gaming news researcher. Search for REAL news from the last 7 "
    "days only about the topic, nothing older. Reply with one story per line "
    "in exactly this format and NOTHING else:\n"
    "HEADLINE ||| LINK ||| SOURCE\n"
    "HEADLINE is a specific real news headline in plain words. LINK is the "
    "direct url to the post or article, never a homepage. SOURCE is the X "
    "handle like @name, or the outlet name. Give 8 to 12 stories if they "
    "exist. If truly nothing recent exists, reply with exactly NOTHING."
)

def _search_grok_web(query: str, max_results: int) -> list[dict]:
    """Web and news via Grok's new Agent Tools API, last 7 days only."""
    global LAST_GROK_RAW
    from datetime import datetime
    try:
        sysmsg = NEWS_SYSTEM + f" Today is {datetime.now():%Y-%m-%d}."
        text, cites = _grok_responses(sysmsg, query, [{"type": "web_search"}])
        LAST_GROK_RAW = (text or "(empty reply)")[:400]
        return _grok_news_pipeline(text, cites, max_results)
    except httpx.HTTPStatusError as e:
        LAST_GROK_RAW = f"ERROR {e.response.status_code}: {e.response.text[:300]}"
        return []
    except Exception as e:
        LAST_GROK_RAW = f"ERROR: {type(e).__name__}: {str(e)[:200]}"
        return []

def search_web(
    query: str, max_results: int = 5, budget: SearchBudget | None = None,
    news_only: bool = False,
) -> list[dict]:
    """Web search. Grok first when set for clean recent news, else SearXNG.

    If news_only is True and Grok is connected, we return ONLY Grok results,
    never SearXNG. SearXNG brings homepage links with no real news, which is
    worse than fewer results. So for news we do not fall back to it.
    """
    if settings.XAI_API_KEY and (budget is None or budget.allow()):
        grok = _search_grok_web(query, max_results)
        if grok:
            return grok
        if news_only:
            # Grok is the news brain. No junk SearXNG fallback for news.
            return []
    results = _search_searxng(query, max_results)
    if results:
        return results
    if settings.PERPLEXITY_API_KEY and (budget is None or budget.allow()):
        results = _search_perplexity(query, max_results)
        if results:
            return results
    if settings.TAVILY_API_KEY and (budget is None or budget.allow()):
        return _search_tavily(query, max_results)
    return []


def search_x(
    query: str, max_results: int = 8, budget: SearchBudget | None = None
) -> list[dict]:
    """Search live X/Twitter. Only Grok can do this. Returns [] without a key."""
    if not settings.XAI_API_KEY:
        return []
    if budget is not None and not budget.allow():
        return []
    return _search_grok_x(query, max_results)


def provider_status() -> dict:
    """What is switched on right now, for the Settings page to show."""
    return {
        "searxng": True,  # always attempted
        "grok_x": bool(settings.XAI_API_KEY),
        "perplexity": bool(settings.PERPLEXITY_API_KEY),
        "tavily": bool(settings.TAVILY_API_KEY),
    }


def _search_searxng(query: str, max_results: int) -> list[dict]:
    try:
        response = httpx.get(
            f"{settings.SEARXNG_URL}/search",
            params={"q": query, "format": "json"},
            timeout=20,
        )
        response.raise_for_status()
        items = response.json().get("results", [])[:max_results]
        return [
            {
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "snippet": item.get("content", ""),
                "source": "searxng",
            }
            for item in items
        ]
    except Exception:
        return []


def _search_perplexity(query: str, max_results: int) -> list[dict]:
    try:
        response = httpx.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.PERPLEXITY_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a research helper. Answer briefly and list your web sources.",
                    },
                    {"role": "user", "content": query},
                ],
            },
            timeout=40,
        )
        response.raise_for_status()
        data = response.json()
        answer = data["choices"][0]["message"]["content"]
        citations = data.get("citations", []) or data.get("search_results", [])
        results = [{"title": query, "url": "", "snippet": answer, "source": "perplexity"}]
        for cite in citations[:max_results]:
            if isinstance(cite, str):
                results.append({"title": cite, "url": cite, "snippet": "", "source": "perplexity"})
            elif isinstance(cite, dict):
                results.append(
                    {
                        "title": cite.get("title", cite.get("url", "")),
                        "url": cite.get("url", ""),
                        "snippet": cite.get("snippet", ""),
                        "source": "perplexity",
                    }
                )
        return results
    except Exception:
        return []


# Last raw Grok reply, truncated, so we can see WHY parsing failed.
LAST_GROK_RAW = {"text": ""}


def _parse_lines(content: str) -> list[dict]:
    """Parse TITLE ||| URL ||| SOURCE lines. Far more reliable than JSON
    when live search is on, models follow line formats better."""
    items = []
    for line in content.splitlines():
        line = line.strip().lstrip("-*0123456789. ").strip()
        if "|||" not in line:
            continue
        parts = [p.strip() for p in line.split("|||")]
        if len(parts) < 2 or len(parts[0]) < 12:
            continue
        items.append({
            "title": parts[0],
            "url": parts[1] if parts[1].startswith("http") else "",
            "source": parts[2] if len(parts) > 2 else "",
            "handle": parts[2] if len(parts) > 2 and parts[2].startswith("@") else "",
            "snippet": "",
        })
    return items


def _seven_days_ago() -> str:
    """ISO date 7 days back, so search only returns the last week."""
    from datetime import datetime, timedelta

    return (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")


def _search_grok_x(query: str, max_results: int) -> list[dict]:
    """X plus web plus news via Grok's new Agent Tools API, last 7 days."""
    global LAST_GROK_RAW
    from datetime import datetime
    try:
        sysmsg = NEWS_SYSTEM + f" Today is {datetime.now():%Y-%m-%d}. Search X first, it is where gaming news breaks."
        text, cites = _grok_responses(
            sysmsg, query, [{"type": "x_search"}, {"type": "web_search"}]
        )
        LAST_GROK_RAW = (text or "(empty reply)")[:400]
        return _grok_news_pipeline(text, cites, max_results)
    except httpx.HTTPStatusError as e:
        LAST_GROK_RAW = f"ERROR {e.response.status_code}: {e.response.text[:300]}"
        return []
    except Exception as e:
        LAST_GROK_RAW = f"ERROR: {type(e).__name__}: {str(e)[:200]}"
        return []

def _search_tavily(query: str, max_results: int) -> list[dict]:
    try:
        response = httpx.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.TAVILY_API_KEY,
                "query": query,
                "max_results": max_results,
            },
            timeout=20,
        )
        response.raise_for_status()
        items = response.json().get("results", [])[:max_results]
        return [
            {
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "snippet": item.get("content", ""),
                "source": "tavily",
            }
            for item in items
        ]
    except Exception:
        return []


def _extract_json_list(text: str) -> list[dict]:
    import re

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
