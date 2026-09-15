from __future__ import annotations

import re
import uuid
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Company, Contact, Meeting, OutreachDraft, Proposal, Touch
from app.models.business import Opportunity
from app.schemas import CompanyOut
from app.services.email_finder import (
    guess_emails,
    hunter_domain_search,
)
from app.services.enrich import find_email
from app.services import hunter_budget as hbudget
from app.services.website_finder import find_official_website, root_domain

router = APIRouter(prefix="/companies", tags=["companies"])

LINKEDIN_RE = re.compile(
    r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|in)/[^\s|/]+",
    re.I,
)
X_URL_RE = re.compile(
    r"https?://(?:www\.)?(?:x\.com|twitter\.com)/([A-Za-z0-9_]{1,15})",
    re.I,
)
HANDLE_RE = re.compile(r"(?:^|[\s,;])@([A-Za-z0-9_]{2,15})\b")
# Broken pattern guesses like mr..saleh@ or a@b or double dots
JUNK_EMAIL_RE = re.compile(
    r"(\.\.)|(^[^@]{0,1}@)|(@\.)|(\.@)|(^mr\.\.)|(\s)",
    re.I,
)


def _is_plausible_email(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    email = email.strip().lower()
    if JUNK_EMAIL_RE.search(email):
        return False
    local, _, domain = email.partition("@")
    if len(local) < 2 or "." not in domain:
        return False
    if any(ch in local for ch in " <>\"'"):
        return False
    return True


# Who is worth your time at a brand. Lower number, higher up the list.
# One Hunter credit gives you up to 10 people, this decides who you see first.
_ROLE_WORDS = (
    ("partnership", 0),
    ("sponsor", 0),
    ("brand", 1),
    ("marketing", 1),
    ("esport", 1),
    ("gaming", 1),
    ("communicat", 2),
    ("business development", 2),
    ("growth", 2),
    ("media", 3),
    ("pr ", 3),
    ("commercial", 3),
    ("sales", 4),
    ("product", 6),
    ("engineer", 9),
    ("developer", 9),
    ("support", 9),
    ("recruit", 9),
    ("hr", 9),
)
_SENIOR_WORDS = ("chief", "cmo", "head", "director", "vp", "vice president", "lead", "manager")


def _role_rank(role: str | None, email: str | None = None) -> int:
    """Rank a person so the right ones show first. Small is better."""
    text = (role or "").lower()
    base = 5
    for word, rank in _ROLE_WORDS:
        if word in text:
            base = rank
            break
    if base == 5 and email:
        el = email.lower()
        for word, rank in _ROLE_WORDS:
            if word.strip() in el:
                base = rank
                break
    # A head of marketing beats a marketing assistant.
    if any(w in text for w in _SENIOR_WORDS):
        base -= 1
    return base


def _sort_people(people: list[dict]) -> list[dict]:
    """Best contacts first, by role, then by Hunter confidence."""
    return sorted(
        people,
        key=lambda p: (
            0 if p.get("source") == "deal_signal" else 1,
            _role_rank(p.get("role") or p.get("position"), p.get("email")),
            -(p.get("score") or 0),
            (p.get("name") or ""),
        ),
    )


def _ensure_website(db: Session, company: Company) -> str | None:
    """No website on the card? Go find it, free. Saves it for next time."""
    if company.website:
        return company.website
    try:
        found = find_official_website(company.name)
    except Exception:
        found = None
    if found:
        company.website = found
        db.commit()
    return found


def _hunter_best(
    db: Session, company_name: str, domain: str | None, limit: int
) -> tuple[list[dict], int, str | None]:
    """One credit, best effort. Tries the domain, then the parent domain,
    then the brand name. A search that finds nothing costs nothing, so we
    are allowed a few tries, and we stop the moment one works.
    """
    tried: list[str] = []
    attempts: list[tuple[str | None, str | None, str]] = []
    if domain:
        attempts.append((domain, None, domain))
        parent = root_domain(domain)
        if parent:
            attempts.append((parent, None, parent))
    if company_name:
        attempts.append((None, company_name, f"the name {company_name}"))
        # Logitech G is really Logitech. Try the parent brand, the first
        # word, when the name has more than one. Failed searches are free.
        first = company_name.split()[0] if company_name.split() else ""
        if len(first) >= 4 and first.lower() != company_name.lower():
            attempts.append((None, first, f"the parent brand {first}"))

    for dom, name, label in attempts:
        people, creds = hunter_domain_search(dom, limit=limit, company=name)
        people = [p for p in people if _is_plausible_email(p.get("email"))]
        if people:
            note = f"1 Hunter credit spent, {len(people)} real emails found from {label}. Best fit first."
            return _sort_people(people), creds, note
        tried.append(label)

    where = ", then ".join(tried) if tried else "this company"
    return [], 0, (
        f"Hunter has no public emails. Tried {where}. No credit charged. "
        f"Go LinkedIn on this one, or fix the website on the card."
    )


def _clean_domain(website: str | None) -> str | None:
    if not website:
        return None
    d = website.strip().lower()
    d = re.sub(r"^https?://", "", d)
    d = d.replace("www.", "")
    d = d.split("/", 1)[0].strip()
    return d if d and "." in d else None


def _website_url(website: str | None) -> str | None:
    if not website:
        return None
    w = website.strip()
    if not w:
        return None
    return w if w.startswith("http") else f"https://{w}"


def _extract_socials(*blobs: str | None) -> dict:
    text = " ".join(b for b in blobs if b) or ""
    linkedin = None
    for match in LINKEDIN_RE.findall(text):
        linkedin = match.rstrip(").,;")
        break
    x_url = None
    x_handle = None
    m = X_URL_RE.search(text)
    if m:
        x_handle = m.group(1)
        x_url = f"https://x.com/{x_handle}"
    if not x_handle:
        hm = HANDLE_RE.search(text)
        if hm:
            x_handle = hm.group(1)
            x_url = f"https://x.com/{x_handle}"
    return {"linkedin": linkedin, "xUrl": x_url, "xHandle": x_handle}


def _linkedin_people_search(company_name: str, role_hint: str = "partnerships OR marketing OR sponsorship") -> str:
    q = f"{company_name} {role_hint}"
    return f"https://www.linkedin.com/search/results/people/?keywords={quote_plus(q)}"


def _x_search(company_name: str) -> str:
    q = f"{company_name} (partnership OR sponsor OR gaming OR esports)"
    return f"https://x.com/search?q={quote_plus(q)}&f=live"


@router.get("", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    return db.scalars(select(Company)).all()


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: str, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    from sqlalchemy import delete as sqldelete

    deal_ids = [
        d.id
        for d in db.scalars(
            select(Opportunity).where(Opportunity.company_id == company_id)
        ).all()
    ]
    if deal_ids:
        db.execute(sqldelete(Proposal).where(Proposal.opportunity_id.in_(deal_ids)))
    db.execute(sqldelete(Opportunity).where(Opportunity.company_id == company_id))
    db.execute(sqldelete(Meeting).where(Meeting.company_id == company_id))
    db.execute(sqldelete(OutreachDraft).where(OutreachDraft.company_id == company_id))
    db.execute(sqldelete(Touch).where(Touch.company_id == company_id))
    db.execute(sqldelete(Contact).where(Contact.company_id == company_id))
    db.execute(sqldelete(Company).where(Company.id == company_id))
    db.commit()


class CompanyPatch(BaseModel):
    name: str | None = None
    industry: str | None = None
    status: str | None = None
    location: str | None = None
    website: str | None = None
    reason_to_contact: str | None = None
    details: str | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    contact_linkedin: str | None = None
    source_url: str | None = None


@router.patch("/{company_id}")
def update_company(company_id: str, body: CompanyPatch, db: Session = Depends(get_db)):
    """Edit any company field. You control the details."""
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "contact_email" and value and not _is_plausible_email(value):
            raise HTTPException(status_code=400, detail="That email looks invalid.")
        setattr(company, field, value)
    # Drop junk emails if still stored
    if company.contact_email and not _is_plausible_email(company.contact_email):
        company.contact_email = None
    db.commit()
    return {"id": company.id, "updated": True}


@router.post("/{company_id}/find-email")
def find_company_email(company_id: str, db: Session = Depends(get_db)):
    """Find a contact email for this company, using public legal methods."""
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if not company.website:
        return {
            "status": "none",
            "message": "Add their website first, then I can find an email.",
        }
    result = find_email(company.website, company.contact_person)
    email = result.get("email")
    if email and not _is_plausible_email(email):
        # Prefer next candidate
        for cand in result.get("candidates") or []:
            if _is_plausible_email(cand):
                email = cand
                result["email"] = cand
                break
        else:
            email = None
            result["email"] = None
            result["status"] = "none"
    if email and (not company.contact_email or not _is_plausible_email(company.contact_email)):
        company.contact_email = email
        db.commit()
    return result


class EmailGuessIn(BaseModel):
    person: str = ""
    website: str | None = None
    known_email: str | None = None


@router.post("/{company_id}/guess-emails")
def guess_company_emails(
    company_id: str, body: EmailGuessIn, db: Session = Depends(get_db)
):
    """Find likely work emails. Person optional — domain team search still runs."""
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    person = (body.person or company.contact_person or "").strip()
    # No website anywhere? Find it free before we give up on this company.
    had_website = bool(body.website or company.website)
    website = body.website or company.website or _ensure_website(db, company)
    found_website = bool(website) and not had_website
    result = guess_emails(person or "partnerships team", website=website, known_email=body.known_email)
    # If no real person name, do not pretend personal candidates are useful
    if len(person.split()) < 2:
        result["candidates"] = []
    domain = result.get("domain") or _clean_domain(website)

    # ONE Hunter credit per company, never two. One Domain Search is one
    # credit and it returns up to 10 emails on the free plan. We do not run
    # the named person finder any more, that was a second credit for one
    # email that is almost always inside the 10 anyway.
    spent = 0
    note = None
    if not hbudget.can_spend(db, 1, 0):
        st = hbudget.status(db)
        if not st["keySet"]:
            note = "No Hunter key set. Add it in Settings to find real emails."
        elif st["remainingMonth"] <= 0:
            note = f"No Hunter credits left this month. It resets on the 1st. Used {st['usedThisMonth']} of {st['monthlyLimit']}."
        else:
            note = f"Daily cap reached, {st['usedToday']} of {st['dailyLimit']} credits used today. Raise Max credits per day in Settings if you want more."
    elif not domain and not company.name:
        note = "No website and no company name to search on. Add a website above."
    else:
        paid_limit = hbudget.emails_per_company_paid(db)
        team, creds, note = _hunter_best(db, company.name, domain, paid_limit)
        spent += creds
        if team:
            result["team"] = team
    if found_website:
        note = f"Found their website for you, {website}, and saved it. " + (note or "")
    if spent:
        hbudget.record_spend(db, spent)
    result["hunterCreditsSpent"] = spent
    result["hunterBudget"] = hbudget.status(db)
    result["message"] = note
    result["domain"] = domain
    return result


class DiscoverIn(BaseModel):
    save_contacts: bool = True
    # One credit buys up to 10 emails, so keep all 10. Saving only 3 was
    # throwing away most of what you paid for.
    max_people: int = Field(default=10, ge=1, le=10)
    use_hunter: bool = True


@router.post("/{company_id}/discover-people")
def discover_people(
    company_id: str,
    body: DiscoverIn | None = None,
    db: Session = Depends(get_db),
):
    """Build 2–3 reach paths + related people (email, LinkedIn, X).

    Free website emails always. Hunter only if budget allows and use_hunter.
    Saves at most max_people contacts (default 3).
    """
    body = body or DiscoverIn()
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Clean junk stored email
    if company.contact_email and not _is_plausible_email(company.contact_email):
        company.contact_email = None

    socials = _extract_socials(
        company.reason_to_contact,
        company.details,
        company.contact_linkedin,
        company.source_url,
    )
    if socials["linkedin"] and not company.contact_linkedin:
        company.contact_linkedin = socials["linkedin"]

    # No website on the card is the number one reason this button did nothing.
    # Find it for free instead of asking you to go look it up.
    had_website = bool(company.website)
    if not had_website:
        _ensure_website(db, company)
    found_website = bool(company.website) and not had_website

    domain = _clean_domain(company.website)
    website_url = _website_url(company.website)

    # 1) Public / pattern email (FREE)
    email_status = "none"
    best_email = company.contact_email if _is_plausible_email(company.contact_email) else None
    email_candidates: list[str] = []
    if company.website:
        found = find_email(company.website, company.contact_person)
        for cand in [found.get("email"), *(found.get("candidates") or [])]:
            if cand and _is_plausible_email(cand) and cand not in email_candidates:
                email_candidates.append(cand)
        if not best_email and email_candidates:
            best_email = email_candidates[0]
            email_status = found.get("status") or "likely"
        elif best_email:
            email_status = "found" if found.get("status") == "found" else "saved"
        # Free generics
        g = guess_emails(company.contact_person or "partnerships", website=company.website)
        for cand in g.get("generic") or []:
            if cand not in email_candidates:
                email_candidates.append(cand)

    # 2) Hunter — budget aware, tiny limits
    people: list[dict] = []
    seen_emails: set[str] = set()
    hunter_spent = 0
    if company.contact_person:
        people.append(
            {
                "name": company.contact_person,
                "role": "Signal contact",
                "email": None,
                "linkedin": None,
                "source": "deal_signal",
                "score": 50,
            }
        )

    # ONE Hunter credit, never two. One Domain Search returns up to 10 emails
    # on the free plan, and we keep all of them, best fit first.
    hunter_note = None
    if not body.use_hunter:
        hunter_note = "Free search only, no Hunter credit used."
    elif not hbudget.can_spend(db, 1, 0):
        st = hbudget.status(db)
        if not st["keySet"]:
            hunter_note = "No Hunter key set. Add it in Settings to find real emails. Free guesses and LinkedIn still work."
        elif st["remainingMonth"] <= 0:
            hunter_note = f"No Hunter credits left this month, {st['usedThisMonth']} of {st['monthlyLimit']} used. It resets on the 1st."
        else:
            hunter_note = f"Daily cap reached, {st['usedToday']} of {st['dailyLimit']} credits used today. Raise Max credits per day in Settings."
    elif not domain and not company.name:
        hunter_note = "No website and no company name to search on. Add a website above."
    else:
        paid_limit = hbudget.emails_per_company_paid(db)
        team, creds, hunter_note = _hunter_best(db, company.name, domain, paid_limit)
        hunter_spent += creds
        for t in team:
            em = (t.get("email") or "").lower()
            if em in seen_emails:
                continue
            seen_emails.add(em)
            people.append(
                {
                    "name": (t.get("name") or em.split("@")[0]).strip() or em,
                    "role": (t.get("position") or t.get("role") or "Team contact").strip() or "Team contact",
                    "email": t.get("email"),
                    "linkedin": None,
                    "source": "hunter_domain",
                    "score": t.get("score") or 0,
                }
            )
            if t.get("email") and t["email"] not in email_candidates:
                email_candidates.append(t["email"])

    if found_website:
        hunter_note = (
            f"Found their website for you, {company.website}, and saved it. "
            + (hunter_note or "")
        )

    if hunter_spent:
        hbudget.record_spend(db, hunter_spent)

    # Prefer partnership-ish emails
    def _email_rank(e: str) -> int:
        el = e.lower()
        for i, key in enumerate(
            ("partner", "sponsor", "marketing", "brand", "hello", "contact", "info")
        ):
            if key in el:
                return i
        return 50

    email_candidates = sorted(set(email_candidates), key=_email_rank)
    if not best_email and email_candidates:
        best_email = email_candidates[0]
        email_status = "likely"

    if best_email and (
        not company.contact_email or not _is_plausible_email(company.contact_email)
    ):
        company.contact_email = best_email

    # Best fit first. Partnerships and marketing before engineers and support,
    # senior before junior. The deal signal person always stays on top.
    people = _sort_people(people)[: body.max_people]

    # How-to-contact tip
    how = []
    if best_email:
        how.append(
            f"Email {best_email}: short intro, about them, one MGEX/proof line, ask 15 min."
        )
    if company.contact_linkedin or socials.get("linkedin"):
        how.append("LinkedIn: connect partnerships/marketing, soft note, no hard pitch on connect.")
    else:
        how.append(
            f"LinkedIn nurture: {_linkedin_people_search(company.name)}"
        )
    how.append("If not ready for email, warm on LinkedIn first, then follow up later.")

    # Save as Contact rows
    existing = list(
        db.scalars(select(Contact).where(Contact.company_id == company_id)).all()
    )
    existing_by_email = {
        (c.email or "").lower(): c for c in existing if c.email
    }
    existing_by_name = {c.name.strip().lower(): c for c in existing}
    saved: list[dict] = []
    if body.save_contacts:
        for p in people:
            em = (p.get("email") or "").lower() or None
            name = (p.get("name") or "").strip()
            if not name:
                continue
            row = None
            if em and em in existing_by_email:
                row = existing_by_email[em]
            elif name.lower() in existing_by_name:
                row = existing_by_name[name.lower()]
            if row:
                if em and not row.email:
                    row.email = p.get("email")
                if p.get("role") and (not row.role or row.role == "Team contact"):
                    row.role = p["role"]
                if p.get("linkedin") and not row.linkedin:
                    row.linkedin = p["linkedin"]
            else:
                if len(existing) + len(saved) >= body.max_people:
                    continue
                notes = f"Found via {p.get('source', 'discover')}. " + " ".join(how)[:300]
                row = Contact(
                    id=f"ctc-{uuid.uuid4().hex[:8]}",
                    name=name[:120],
                    role=(p.get("role") or "Contact")[:120],
                    company_id=company.id,
                    company=company.name,
                    email=p.get("email"),
                    linkedin=p.get("linkedin") or socials.get("linkedin"),
                    notes=notes[:500],
                )
                db.add(row)
                existing_by_name[name.lower()] = row
                if em:
                    existing_by_email[em] = row
            saved.append(
                {
                    "id": row.id,
                    "name": row.name,
                    "role": row.role,
                    "email": row.email,
                    "linkedin": row.linkedin,
                }
            )

    # Persist how-to tip once on company
    marker = "How to contact:"
    details = company.details or ""
    if marker not in details:
        company.details = (details + f"\n\n{marker} " + " ".join(how)).strip()[:900]

    db.commit()

    contacts_out = [
        {
            "id": c.id,
            "name": c.name,
            "role": c.role,
            "email": c.email,
            "linkedin": c.linkedin,
            "notes": c.notes,
        }
        for c in db.scalars(select(Contact).where(Contact.company_id == company_id)).all()
    ]

    reach = {
        "email": {
            "value": best_email,
            "status": email_status if best_email else "none",
            "candidates": email_candidates[:5],
            "mailto": f"mailto:{best_email}" if best_email else None,
        },
        "linkedin": {
            "companyUrl": company.contact_linkedin or socials.get("linkedin"),
            "peopleSearchUrl": _linkedin_people_search(company.name),
            "label": "LinkedIn",
        },
        "x": {
            "url": socials.get("xUrl"),
            "handle": socials.get("xHandle"),
            "searchUrl": _x_search(company.name),
            "label": "X / Twitter",
        },
        "website": website_url,
        "sourceUrl": company.source_url,
        "howToContact": how,
    }

    return {
        "companyId": company.id,
        "company": company.name,
        "reach": reach,
        "people": people,
        "contacts": contacts_out,
        "savedCount": len(saved),
        "domain": domain,
        "contactEmail": company.contact_email,
        "contactLinkedin": company.contact_linkedin,
        "contactPerson": company.contact_person,
        "hunterCreditsSpent": hunter_spent,
        "hunterBudget": hbudget.status(db),
        "message": hunter_note,
    }


@router.post("/{company_id}/clean-email")
def clean_company_email(company_id: str, db: Session = Depends(get_db)):
    """Remove junk auto-guessed emails from a company card."""
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    removed = None
    if company.contact_email and not _is_plausible_email(company.contact_email):
        removed = company.contact_email
        company.contact_email = None
        db.commit()
    return {"id": company.id, "removed": removed, "contactEmail": company.contact_email}
