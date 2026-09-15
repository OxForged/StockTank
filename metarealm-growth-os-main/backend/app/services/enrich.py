"""Email enrichment, the safe and legal way.

Inspired by the good part of lead tools like Scout, but ONLY the methods
that are public and legal, no scraping of private profiles, no login
cookies, no proxies. For a founder building a real reputation, staying
clean matters.

How it finds a contact email for a company:
1. Read their public website, and its /contact and /about pages, for any
   email they already publish. This is the best source, a real address.
2. If none, check the domain has a mail server (public DNS MX record).
3. Then offer the standard business addresses like contact@ and
   partnerships@, which most companies use, as good candidates to try.

It never claims a guessed email is verified. Published emails are marked
found, guessed ones are marked as a likely address to try.
"""

import re
import socket

import httpx

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
JUNK_EMAIL = ("example.com", "sentry", "wixpress", "godaddy", ".png", ".jpg", "@2x")


def _clean_domain(website: str) -> str:
    d = website.strip().lower()
    d = d.replace("https://", "").replace("http://", "").replace("www.", "")
    return d.split("/")[0].strip()


def _emails_from_page(url: str) -> list[str]:
    try:
        r = httpx.get(url, timeout=12, follow_redirects=True,
                      headers={"User-Agent": "Mozilla/5.0 MetaRealmBot"})
        if r.status_code != 200:
            return []
        found = EMAIL_RE.findall(r.text)
        return [e for e in set(found) if not any(j in e.lower() for j in JUNK_EMAIL)]
    except Exception:
        return []


def _has_mail_server(domain: str) -> bool:
    try:
        import dns.resolver
        answers = dns.resolver.resolve(domain, "MX")
        return len(list(answers)) > 0
    except ImportError:
        try:
            socket.gethostbyname(domain)
            return True
        except Exception:
            return False
    except Exception:
        return False


def find_email(website: str, person: str | None = None) -> dict:
    """Return the best contact email we can find, legally and publicly.

    Returns {"email": str|None, "status": "found"|"likely"|"none",
             "candidates": [..], "source": str}.
    """
    if not website:
        return {"email": None, "status": "none", "candidates": [], "source": ""}
    domain = _clean_domain(website)
    if not domain or "." not in domain:
        return {"email": None, "status": "none", "candidates": [], "source": ""}

    # 1. Real published emails from their public pages, best source.
    for path in ("", "/contact", "/contact-us", "/about", "/about-us"):
        url = f"https://{domain}{path}"
        emails = _emails_from_page(url)
        if emails:
            # Prefer a partnerships or contact style address if present.
            emails.sort(key=lambda e: (
                0 if any(k in e.lower() for k in ("partner", "marketing", "contact", "hello", "info")) else 1
            ))
            return {"email": emails[0], "status": "found",
                    "candidates": emails[:5], "source": url}

    # 2. No published email. If the domain takes mail, offer standard ones.
    if _has_mail_server(domain):
        cands = [f"contact@{domain}", f"partnerships@{domain}",
                 f"hello@{domain}", f"info@{domain}", f"marketing@{domain}"]
        if person and " " in person.strip():
            parts = person.lower().split()
            cands.insert(0, f"{parts[0]}.{parts[-1]}@{domain}")
        return {"email": cands[0], "status": "likely",
                "candidates": cands[:5], "source": "standard business address"}

    return {"email": None, "status": "none", "candidates": [], "source": ""}
