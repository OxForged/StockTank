"""Find PUBLICLY listed contact info for a company, the honest way.

This does one simple thing: fetch the company's own website pages that
companies publish exactly so people can contact them (contact, about,
partnerships pages) and pull any email addresses they list there, plus
their social links. The same way you put partnership@lunarisesports.com
on your own deck for sponsors to find.

It never guesses an email. Found on their page, or not shown at all.
"""

import re

import httpx

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
SOCIAL_RE = re.compile(
    r"https?://(?:www\.)?(?:linkedin\.com/company/[\w-]+|x\.com/\w+|twitter\.com/\w+|instagram\.com/[\w.]+)"
)
SKIP_EMAILS = ("noreply", "no-reply", "example.", "sentry", "wixpress", ".png", ".jpg")
CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/partnerships", "/fr/contact"]


def find_public_contacts(website: str, timeout: float = 8.0) -> dict:
    """Return {"emails": [...], "socials": [...]} found on their public site."""
    if not website:
        return {"emails": [], "socials": []}
    base = website.rstrip("/")
    if not base.startswith("http"):
        base = "https://" + base

    emails: set[str] = set()
    socials: set[str] = set()
    for path in CONTACT_PATHS:
        if len(emails) >= 3:
            break
        try:
            response = httpx.get(
                base + path, timeout=timeout, follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (MetaRealm OS contact lookup)"},
            )
            if response.status_code != 200:
                continue
            text = response.text[:200_000]
            for email in EMAIL_RE.findall(text):
                lowered = email.lower()
                if not any(bad in lowered for bad in SKIP_EMAILS):
                    emails.add(lowered)
            for social in SOCIAL_RE.findall(text):
                socials.add(social)
        except Exception:
            continue
    return {"emails": sorted(emails)[:3], "socials": sorted(socials)[:4]}
