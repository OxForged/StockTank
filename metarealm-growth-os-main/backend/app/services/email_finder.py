"""Email finder helpers with optional Hunter, budget-aware.

Free always:
- public website emails
- standard pattern guesses

Paid Hunter Domain Search is one successful search credit and, on Hunter's
Free plan, can return up to 10 email results. We therefore use one full,
well-filtered domain search for a selected company instead of wasting separate
Email Finder calls for each person.
"""

from __future__ import annotations

import re
import subprocess

import httpx

from app.core.config import settings

PATTERNS = [
    "{first}.{last}", "{first}", "{f}{last}", "{first}{last}",
    "{first}_{last}", "{f}.{last}", "{last}", "{first}{l}",
]
GENERIC = ["partnerships", "partnership", "marketing", "sponsors", "sponsor",
           "contact", "hello", "info", "media", "business", "bd"]


def _clean(text: str) -> str:
    return re.sub(r"[^a-z]", "", (text or "").strip().lower())


def domain_from(website: str | None, email: str | None = None) -> str | None:
    if email and "@" in email:
        return email.split("@", 1)[1].strip().lower()
    if website:
        d = re.sub(r"^https?://", "", website.strip().lower())
        d = d.split("/", 1)[0].replace("www.", "")
        return d or None
    return None


def is_plausible_email(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    email = email.strip().lower()
    if ".." in email or " " in email or email.startswith("mr.."):
        return False
    local, _, domain = email.partition("@")
    if len(local) < 2 or "." not in domain:
        return False
    return True


def domain_has_mail(domain: str) -> bool:
    try:
        out = subprocess.run(
            ["nslookup", "-type=mx", domain],
            capture_output=True, text=True, timeout=8,
        ).stdout.lower()
        return "mail exchanger" in out or "mx preference" in out
    except Exception:
        return True


def guess_emails(name: str, website: str | None = None, known_email: str | None = None) -> dict:
    domain = domain_from(website, known_email)
    result = {"domain": domain, "candidates": [], "generic": []}
    if not domain or "." not in domain:
        return result
    if not domain_has_mail(domain):
        return result

    parts = (name or "").strip().split()
    if len(parts) >= 2:
        first = _clean(parts[0])
        last = _clean(parts[-1])
        if first and last:
            fields = {"first": first, "last": last, "f": first[:1], "l": last[:1]}
            seen = set()
            for pat in PATTERNS:
                local = pat.format(**fields)
                addr = f"{local}@{domain}"
                if addr not in seen and is_plausible_email(addr):
                    seen.add(addr)
                    result["candidates"].append(addr)

    result["generic"] = [f"{g}@{domain}" for g in GENERIC[:6]]
    return result


def hunter_find(name: str, domain: str) -> dict | None:
    """1 credit if an email is returned."""
    key = getattr(settings, "HUNTER_API_KEY", "") or ""
    if not key or not domain or not name:
        return None
    parts = name.strip().split()
    if len(parts) < 2:
        return None
    try:
        r = httpx.get(
            "https://api.hunter.io/v2/email-finder",
            params={
                "domain": domain,
                "first_name": parts[0],
                "last_name": parts[-1],
                "api_key": key,
            },
            timeout=20,
        )
        r.raise_for_status()
        data = r.json().get("data", {})
        if data.get("email") and is_plausible_email(data["email"]):
            return {
                "email": data["email"],
                "score": data.get("score", 0),
                "credits": 1,
            }
    except Exception:
        return None
    return None


def hunter_domain_search(
    domain: str | None, limit: int = 10, company: str | None = None
) -> tuple[list[dict], int]:
    """Return up to ten people from one Hunter Domain Search query.

    Hunter documents a successful Domain Search as one search query, while
    Free accounts can receive up to ten results per query.  `credits_spent`
    here means *successful search queries*, not emails returned.

    Pass `company` instead of `domain` to search by brand name. Useful when
    the site you have is a product domain like logitechg.com but the emails
    live on the parent brand. A search that finds nothing costs nothing.
    """
    key = getattr(settings, "HUNTER_API_KEY", "") or ""
    if not key or not (domain or company):
        return [], 0
    limit = max(1, min(10, int(limit)))
    params = {"api_key": key, "limit": limit}
    if domain:
        params["domain"] = domain
    else:
        params["company"] = company
    try:
        r = httpx.get(
            "https://api.hunter.io/v2/domain-search",
            params=params,
            timeout=20,
        )
        r.raise_for_status()
        emails = r.json().get("data", {}).get("emails", []) or []
        people = []
        for e in emails[:limit]:
            addr = e.get("value", "")
            if not is_plausible_email(addr):
                continue
            people.append({
                "email": addr,
                "name": f"{e.get('first_name', '')} {e.get('last_name', '')}".strip(),
                "position": e.get("position", "") or "",
                "score": e.get("confidence", 0),
            })
        # A successful Domain Search is one Hunter search query, independent
        # of how many (up to ten) results the response contains.
        search_credits = 1 if emails else 0
        return people, search_credits
    except Exception:
        return [], 0


# Back-compat wrappers used by older call sites expecting list only
def hunter_domain_search_list(domain: str, limit: int = 1) -> list[dict]:
    people, _ = hunter_domain_search(domain, limit=limit)
    return people


def hunter_verify(email: str) -> dict | None:
    key = getattr(settings, "HUNTER_API_KEY", "") or ""
    if not key or not email:
        return None
    try:
        r = httpx.get(
            "https://api.hunter.io/v2/email-verifier",
            params={"email": email, "api_key": key},
            timeout=20,
        )
        r.raise_for_status()
        data = r.json().get("data", {})
        return {"email": email, "status": data.get("status"), "score": data.get("score", 0), "credits": 1}
    except Exception:
        return None
