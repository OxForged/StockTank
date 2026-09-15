"""Find a company's official website, free.

Why this exists. A company card with no website is a dead end. The free
email guesser needs a domain, and Hunter needs a domain. So when a card
comes in without one, we go and find it instead of asking you to type it.

How it works, cheapest first:
1. Web search for the official site, free through SearXNG, or Grok when
   your key is set.
2. If search gives nothing, try the obvious domain from the name, like
   logitech.com, and only keep it if the site really answers.

It never costs a Hunter credit. It only reads public pages.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx

from app.services.search import search_web

# Places that are never a company's own site.
NOT_A_WEBSITE = (
    "linkedin.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "tiktok.com",
    "reddit.com",
    "wikipedia.org",
    "crunchbase.com",
    "bloomberg.com",
    "glassdoor.com",
    "indeed.com",
    "medium.com",
    "substack.com",
    "google.com",
    "play.google.com",
    "apps.apple.com",
    "amazon.",
    "pinterest.",
    "yelp.",
    "tripadvisor.",
    "github.com",
    "notion.site",
    "prnewswire.com",
    "businesswire.com",
    "gamesindustry.biz",
    "eventbrite.",
)

# Country and generic endings worth trying for a Moroccan or MENA brand.
TRY_TLDS = (".com", ".ma", ".gg")

_WORD_RE = re.compile(r"[a-z0-9]+")


def _slug(name: str) -> str:
    """Logitech G becomes logitechg. Orange Maroc becomes orangemaroc."""
    words = _WORD_RE.findall((name or "").lower())
    drop = {"inc", "llc", "ltd", "sa", "sarl", "the", "group", "company", "co"}
    words = [w for w in words if w not in drop]
    return "".join(words)


def _domain_of(url: str | None) -> str | None:
    if not url:
        return None
    try:
        host = urlparse(url if "://" in url else f"https://{url}").netloc.lower()
    except Exception:
        return None
    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    if not host or "." not in host:
        return None
    if any(bad in host for bad in NOT_A_WEBSITE):
        return None
    return host


def _answers(domain: str, timeout: float = 6.0) -> bool:
    """Does this domain really serve a site? Cheap check, no credit."""
    for scheme in ("https", "http"):
        try:
            r = httpx.head(
                f"{scheme}://{domain}",
                timeout=timeout,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 MetaRealmBot"},
            )
            if r.status_code < 400:
                return True
            # Some sites refuse HEAD. Try a small GET before giving up.
            r = httpx.get(
                f"{scheme}://{domain}",
                timeout=timeout,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 MetaRealmBot"},
            )
            if r.status_code < 400:
                return True
        except Exception:
            continue
    return False


def _looks_like(name: str, domain: str) -> bool:
    """Does the domain plausibly belong to this company?"""
    slug = _slug(name)
    root = domain.split(".")[0].replace("-", "")
    if not slug or not root:
        return False
    if root in slug or slug in root:
        return True
    # First real word is usually enough, orange in orange.ma
    words = _WORD_RE.findall((name or "").lower())
    return bool(words) and len(words[0]) >= 4 and words[0] in root


def find_official_website(name: str) -> str | None:
    """Best guess at the company's own domain, or None. Never raises."""
    name = (name or "").strip()
    if not name:
        return None

    # 1) Free web search. Cheapest good answer.
    try:
        for result in search_web(f"{name} official website", max_results=6):
            domain = _domain_of(result.get("url"))
            if domain and _looks_like(name, domain):
                return domain
    except Exception:
        pass

    # 2) Obvious domain from the name, only if the site actually answers.
    slug = _slug(name)
    if len(slug) >= 3:
        for tld in TRY_TLDS:
            candidate = f"{slug}{tld}"
            if _answers(candidate):
                return candidate

    return None


def root_domain(domain: str | None) -> str | None:
    """company.co.uk stays, shop.company.com becomes company.com."""
    if not domain:
        return None
    parts = domain.split(".")
    if len(parts) <= 2:
        return None
    if parts[-2] in ("co", "com", "org", "net", "gov", "ac") and len(parts) >= 3:
        keep = 3
    else:
        keep = 2
    root = ".".join(parts[-keep:])
    return root if root != domain else None
