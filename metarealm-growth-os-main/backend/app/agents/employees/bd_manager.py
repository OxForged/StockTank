"""BD Manager — writes outreach emails that fill the pipeline.

Recipe: for one company, gather everything we know (status, reason to
contact, contacts, past touches, open deals) plus proof numbers from
the knowledge base, then ask the model for one email as JSON. If an
outreach was already sent to this company, it automatically writes a
follow up instead of a fresh intro. Drafts are saved, never sent by
the machine. You read, you copy, you send.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import (
    format_mad,
    humanize,
    now_iso,
    parse_json_object,
    provider_for,
)
from app.models import Company, Contact, OutreachDraft, Touch
from app.models.business import Opportunity
from app.services import rag
from app.services.llm import generate, load_prompt, render_prompt

OPEN_STAGES = ["lead", "contacted", "meeting", "proposal", "negotiation"]

FALLBACK_PROMPT = """Write one short business email in simple English. No dashes, no underscores, commas and periods only. Answer only with JSON: {"subject": "...", "body": "..."}

Mode: {mode}

Company context:
{context}

Proof material:
{sources}"""


def run(db: Session, payload: dict) -> dict:
    if payload.get("auto"):
        return _auto(db)
    company_id = payload.get("company_id")
    if not company_id:
        return {"status": "error", "summary": "Tell the BD Manager which company to write to."}
    company = db.get(Company, company_id)
    if company is None:
        return {"status": "error", "summary": "Company not found."}

    contacts = db.scalars(
        select(Contact).where(Contact.company_id == company.id)
    ).all()
    best_contact = next((c for c in contacts if c.email), contacts[0] if contacts else None)

    sent_before = db.scalars(
        select(OutreachDraft).where(
            OutreachDraft.company_id == company.id,
            OutreachDraft.status == "sent",
        )
    ).all()
    mode = payload.get("kind") or ("follow_up" if sent_before else "intro")

    lines = [
        f"Company: {company.name}, industry {company.industry}, status {company.status}."
    ]
    # Founder playbook — what Marouane taught the OS
    try:
        from app.models import Setting
        play = db.get(Setting, "BD_PLAYBOOK")
        if play and (play.value or "").strip():
            lines.append(f"Founder playbook (follow this): {play.value.strip()[:800]}")
    except Exception:
        pass
    if company.reason_to_contact:
        lines.append(f"Why contact them now: {company.reason_to_contact}")
    if company.contact_email:
        lines.append(f"Best email on file: {company.contact_email}.")
    if company.contact_linkedin:
        lines.append(f"LinkedIn: {company.contact_linkedin}.")
    if best_contact:
        note = f", note: {best_contact.notes}" if best_contact.notes else ""
        lines.append(f"Write to: {best_contact.name}, {best_contact.role}{note}.")
    for touch in db.scalars(
        select(Touch).where(Touch.company_id == company.id)
    ).all()[:4]:
        lines.append(f"Past touch ({touch.when}): {touch.summary}.")
    for deal in db.scalars(
        select(Opportunity).where(
            Opportunity.company_id == company.id,
            Opportunity.stage.in_(OPEN_STAGES),
        )
    ).all():
        lines.append(
            f"Open deal: {deal.title}, {format_mad(deal.value_mad)}, stage {deal.stage}."
        )
    if mode == "follow_up" and sent_before:
        last = sent_before[-1]
        lines.append(f"Already sent before, subject was: {last.subject}.")
        lines.append(f"That email said: {last.body[:300]}")

    sources = "\n\n".join(
        f"(From {p['document_title']}"
        + (f", page {p['page']}" if p["page"] else "")
        + f"): {p['text'][:400]}"
        for p in rag.search(db, f"{company.industry} sponsorship results proof numbers", top_k=3)
    ) or "No knowledge passages found."

    template = load_prompt("bd-manager", FALLBACK_PROMPT)
    raw = generate(
        render_prompt(template, mode=mode.replace("_", " "), context="\n".join(lines), sources=sources),
        provider=provider_for("bd-manager"),
    )
    if raw is None:
        return {
            "status": "llm_unavailable",
            "summary": "Could not reach the model. Start Ollama and run again.",
        }

    parsed = parse_json_object(raw)
    if parsed and parsed.get("body"):
        subject = humanize(str(parsed.get("subject") or f"Quick idea for {company.name}"))[:150]
        body = humanize(str(parsed["body"]))
    else:
        subject = humanize(f"Quick idea for {company.name}")[:150]
        body = humanize(raw)

    draft = OutreachDraft(
        id=f"out-{uuid.uuid4().hex[:8]}",
        company_id=company.id,
        company=company.name,
        contact_name=best_contact.name if best_contact else None,
        kind=mode,
        subject=subject,
        body=body,
        status="draft",
        created_at=now_iso(),
    )
    db.add(draft)
    db.commit()

    kind_word = "a follow up" if mode == "follow_up" else "an intro email"
    return {
        "status": "completed",
        "summary": f"BD Manager drafted {kind_word} for {company.name}: {subject}.",
        "details": {"draftId": draft.id, "kind": mode, "subject": subject},
    }


def _auto(db: Session) -> dict:
    """Draft intros for every fresh deal signal that has no draft yet."""
    prospects = db.scalars(
        select(Company).where(Company.last_touch == "Deal signal found")
    ).all()
    drafted: list[str] = []
    for company in prospects:
        has_draft = db.scalar(
            select(OutreachDraft).where(OutreachDraft.company_id == company.id)
        )
        if has_draft:
            continue
        result = run(db, {"company_id": company.id})
        if result.get("status") == "completed":
            drafted.append(company.name)
        if len(drafted) >= 3:
            break
    if not drafted:
        return {
            "status": "completed",
            "summary": "BD Manager checked, every deal signal already has a draft ready.",
            "details": {"drafted": 0},
        }
    return {
        "status": "completed",
        "summary": f"BD Manager wrote {len(drafted)} intro draft{'s' if len(drafted) != 1 else ''}: {', '.join(drafted)}. Each is waiting on the company page.",
        "details": {"drafted": len(drafted), "names": drafted},
    }
