"""Contact Enricher, free emails always, Hunter only when you ask for it.

Runs inside Plan my day AFTER the opportunity hunter.

Money rule, this is the important one:
Plan my day is FREE ONLY. It never spends a Hunter credit. The orchestrator
passes free_only True, and free is also the default here, so nothing can
spend by accident. You review the companies, delete the ones you do not
want, then you press Find emails on a company page yourself. That click is
the only place a Hunter credit is ever spent.

Strategy:
1. For every new or incomplete prospect, FREE website emails plus generic
   patterns. Unlimited, costs nothing.
2. Save usable reach paths, email plus LinkedIn plus X search.
3. If no email, create a LinkedIn nurture task, warm connect, not cold spam.
4. Paid path, only when a caller passes free_only False on purpose. One
   Hunter Domain Search is one credit and returns up to 10 contacts on the
   Free plan.

Also writes short "how to contact" tips on the company details.
"""

from __future__ import annotations

import re
import uuid
from urllib.parse import quote_plus

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Company, Contact, FocusTask
from app.services.email_finder import (
    domain_from,
    guess_emails,
    hunter_domain_search,
    hunter_find,
    is_plausible_email,
)
from app.services.enrich import find_email
from app.services import hunter_budget as budget

LINKEDIN_RE = re.compile(
    r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|in)/[^\s|/]+",
    re.I,
)


def _extract_linkedin(*blobs: str | None) -> str | None:
    text = " ".join(b for b in blobs if b) or ""
    m = LINKEDIN_RE.search(text)
    return m.group(0).rstrip(").,;") if m else None


def _li_people_search(name: str) -> str:
    return (
        "https://www.linkedin.com/search/results/people/?keywords="
        + quote_plus(f"{name} partnerships OR marketing OR sponsorship OR brand")
    )


def _how_to_contact(email: str | None, linkedin: str | None, has_people: bool) -> str:
    bits = []
    if email:
        bits.append(
            f"Email first: write a short intro (5–7 lines), subject about THEM, "
            f"one proof line (MGEX / reach), one clear ask for 15 min. To: {email}."
        )
    if linkedin:
        bits.append(
            "LinkedIn second: open company page, connect with partnerships/marketing, "
            "same angle in a shorter note. Do not pitch hard on connect."
        )
    else:
        bits.append(
            "LinkedIn nurture: search partnerships/marketing at this brand, connect, "
            "comment once on a post, then message after they accept."
        )
    if not email and not has_people:
        bits.append(
            "No solid email yet — stay on LinkedIn/X this week, add website if missing, "
            "retry Find people later when Hunter budget allows."
        )
    bits.append("Never blast 10 people at once. One best contact, then a second if silent 5–7 days.")
    return " ".join(bits)


def _score_company(c: Company) -> int:
    """Higher = better use of a rare Hunter credit."""
    score = 0
    if c.last_touch == "Deal signal found":
        score += 50
    if c.status == "prospect":
        score += 20
    if c.status == "in_talks":
        score += 40
    if c.website:
        score += 15
    if c.source_url:
        score += 10
    if c.contact_person:
        score += 10
    # Already has a good email? deprioritize paid spend
    if c.contact_email and is_plausible_email(c.contact_email):
        score -= 80
    if not c.website:
        score -= 30
    # Prefer MENA / gaming-ish industries lightly
    ind = (c.industry or "").lower()
    for w in ("gaming", "esports", "telecom", "sport", "media", "fmcg", "bank"):
        if w in ind:
            score += 8
    return score


def _upsert_contact(
    db: Session,
    company: Company,
    name: str,
    role: str,
    email: str | None,
    linkedin: str | None,
    note: str,
) -> Contact | None:
    name = (name or "").strip()
    if not name and email:
        name = email.split("@")[0]
    if not name:
        return None
    existing = list(
        db.scalars(select(Contact).where(Contact.company_id == company.id)).all()
    )
    row = None
    if email:
        for c in existing:
            if (c.email or "").lower() == email.lower():
                row = c
                break
    if row is None:
        for c in existing:
            if c.name.strip().lower() == name.lower():
                row = c
                break
    if row is None:
        # Keep a complete first Domain Search (up to 10 results) for this company.
        if len(existing) >= 10:
            return None
        row = Contact(
            id=f"ctc-{uuid.uuid4().hex[:8]}",
            name=name[:120],
            role=(role or "Contact")[:120],
            company_id=company.id,
            company=company.name,
            email=email,
            linkedin=linkedin,
            notes=note[:500],
        )
        db.add(row)
    else:
        if email and not row.email:
            row.email = email
        if linkedin and not row.linkedin:
            row.linkedin = linkedin
        if role and (not row.role or row.role == "Contact"):
            row.role = role[:120]
    return row


def _free_enrich(db: Session, company: Company) -> dict:
    """Unlimited free path. Never touches Hunter."""
    out = {"email": None, "status": "none", "linkedin": None, "people": 0}
    li = company.contact_linkedin or _extract_linkedin(
        company.reason_to_contact, company.details, company.source_url
    )
    if li and not company.contact_linkedin:
        company.contact_linkedin = li
    out["linkedin"] = company.contact_linkedin

    if company.contact_email and is_plausible_email(company.contact_email):
        out["email"] = company.contact_email
        out["status"] = "saved"
    elif company.website:
        found = find_email(company.website, company.contact_person)
        email = found.get("email")
        if email and is_plausible_email(email):
            company.contact_email = email
            out["email"] = email
            out["status"] = found.get("status") or "found"
        else:
            # generic free candidates — store best generic if nothing else
            guess = guess_emails(
                company.contact_person or "partnerships team",
                website=company.website,
            )
            generics = guess.get("generic") or []
            # Prefer partnerships@ over info@
            pick = None
            for g in generics:
                if any(k in g for k in ("partner", "sponsor", "marketing")):
                    pick = g
                    break
            pick = pick or (generics[0] if generics else None)
            if pick:
                company.contact_email = pick
                out["email"] = pick
                out["status"] = "likely"

    # Signal person as LinkedIn-first contact even without email
    if company.contact_person:
        _upsert_contact(
            db,
            company,
            company.contact_person,
            "Signal contact",
            company.contact_email if out["status"] in ("found", "saved", "verified") else None,
            company.contact_linkedin,
            "From deal signal — verify before sending",
        )
        out["people"] = 1

    tip = _how_to_contact(out["email"], out["linkedin"], out["people"] > 0)
    # Keep existing details; append tip once
    marker = "How to contact:"
    details = company.details or ""
    if marker not in details:
        company.details = (details + f"\n\n{marker} {tip}").strip()[:900]

    return out


def _paid_enrich(db: Session, company: Company, already_today: int) -> tuple[dict, int]:
    """Spend minimal Hunter credits. Returns (result, credits_spent)."""
    spent = 0
    domain = domain_from(company.website)
    if not domain:
        return {"email": company.contact_email, "people": []}, 0

    per = budget.emails_per_company_paid(db)
    people: list[dict] = []

    # Prefer named person finder (1 credit) if we have a real name
    person = (company.contact_person or "").strip()
    if (
        len(person.split()) >= 2
        and budget.can_spend(db, 1, already_today + spent)
    ):
        hit = hunter_find(person, domain)
        if hit and hit.get("email"):
            spent += hit.get("credits") or 1
            people.append({
                "name": person,
                "role": "Signal contact",
                "email": hit["email"],
                "score": hit.get("score") or 90,
            })
            company.contact_email = hit["email"]

    # If still need emails and budget allows, domain search with tiny limit
    need = per - len(people)
    if need > 0 and budget.can_spend(db, need, already_today + spent):
        found, creds = hunter_domain_search(domain, limit=need)
        spent += creds
        for p in found:
            if any((x.get("email") or "").lower() == p["email"].lower() for x in people):
                continue
            people.append({
                "name": p.get("name") or p["email"].split("@")[0],
                "role": p.get("position") or "Team contact",
                "email": p["email"],
                "score": p.get("score") or 0,
            })
        if not company.contact_email and people:
            company.contact_email = people[0]["email"]

    for p in people[:3]:
        _upsert_contact(
            db,
            company,
            p["name"],
            p["role"],
            p.get("email"),
            company.contact_linkedin,
            "Hunter paid find — high confidence, still personalize",
        )

    return {"email": company.contact_email, "people": people}, spent


def run(db: Session, payload: dict) -> dict:
    # Free is the default. A caller must ask for the paid path on purpose.
    # This is what stops Plan my day from touching your Hunter credits.
    free_only = bool((payload or {}).get("free_only", True))
    # 1) Free enrich all prospects missing pieces
    companies = list(db.scalars(select(Company)).all())
    targets = [
        c for c in companies
        if c.status in ("prospect", "in_talks")
        or c.last_touch == "Deal signal found"
    ]
    free_done = 0
    for c in targets:
        needs = (
            not c.contact_email
            or not is_plausible_email(c.contact_email)
            or not c.contact_linkedin
        )
        if needs or c.last_touch == "Deal signal found":
            _free_enrich(db, c)
            free_done += 1
    db.commit()

    credits_today = 0
    paid_companies = 0
    paid_names: list[str] = []
    linkedin_tasks = 0

    if not free_only:
        # 2) Rank for paid Hunter
        ranked = sorted(targets, key=_score_company, reverse=True)
        max_cos = budget.max_companies_paid_per_day(db)
        for c in ranked:
            if paid_companies >= max_cos:
                break
            if credits_today >= budget.daily_limit(db):
                break
            if not budget.can_spend(db, 1, credits_today):
                break
            # Skip if free path already gave a solid found email from website
            if c.contact_email and is_plausible_email(c.contact_email):
                # still allow paid if email is only a generic guess
                if not any(
                    c.contact_email.lower().startswith(p)
                    for p in ("contact@", "info@", "hello@", "partnerships@", "marketing@")
                ):
                    continue
            if not c.website:
                continue
            result, spent = _paid_enrich(db, c, credits_today)
            if spent > 0:
                budget.record_spend(db, spent)
                credits_today += spent
                paid_companies += 1
                paid_names.append(c.name)

    # 3) LinkedIn nurture tasks for hot leads still weak on email
    existing_tasks = {t.id for t in db.scalars(select(FocusTask)).all()}
    for c in sorted(targets, key=_score_company, reverse=True)[:8]:
        weak_email = not c.contact_email or not is_plausible_email(c.contact_email)
        generic = c.contact_email and any(
            c.contact_email.lower().startswith(p)
            for p in ("contact@", "info@", "hello@")
        )
        if not (weak_email or generic):
            continue
        if c.last_touch != "Deal signal found" and c.status != "in_talks":
            continue
        task_id = f"task-li-nurture-{c.id}"
        if task_id in existing_tasks:
            continue
        li = c.contact_linkedin or _li_people_search(c.name)
        db.add(
            FocusTask(
                id=task_id,
                title=f"LinkedIn nurture: {c.name}",
                context=(
                    f"Contact Enricher: no strong personal email yet. "
                    f"Open LinkedIn, find partnerships/marketing, connect warm. "
                    f"Link: {li}"
                ),
                priority="medium",
                done=False,
            )
        )
        linkedin_tasks += 1
        if linkedin_tasks >= 3:
            break

    db.commit()
    st = budget.status(db)

    parts = [
        f"Contact Enricher filled {free_done} companies with free email guesses",
    ]
    if free_only:
        parts.append(
            "no Hunter credit spent, that is on purpose. Review the companies, "
            "delete the ones you do not want, then press Find emails on a "
            "company page. One credit there returns up to 10 emails"
        )
    elif paid_companies:
        parts.append(
            f"spent {credits_today} Hunter credit(s) on {paid_companies} hot lead(s): "
            + ", ".join(paid_names)
        )
    else:
        parts.append("no Hunter credits spent (free path enough or budget protected)")
    if linkedin_tasks:
        parts.append(f"added {linkedin_tasks} LinkedIn nurture task(s)")
    parts.append(
        f"Hunter month {st['usedThisMonth']}/{st['monthlyLimit']} used, "
        f"{st['remainingMonth']} left"
    )

    return {
        "status": "completed",
        "summary": ". ".join(parts) + ".",
        "details": {
            "freeEnriched": free_done,
            "paidCompanies": paid_companies,
            "creditsSpentToday": credits_today,
            "linkedinTasks": linkedin_tasks,
            "hunter": st,
            "paidNames": paid_names,
        },
    }
