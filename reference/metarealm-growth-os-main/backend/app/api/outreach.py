import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import now_label
from app.core.db import get_db
from app.models import Company, OutreachDraft, Touch
from app.schemas import OutreachDraftOut, OutreachUpdate

router = APIRouter(prefix="/outreach", tags=["outreach"])


@router.get("", response_model=list[OutreachDraftOut])
def list_outreach(company_id: str | None = None, db: Session = Depends(get_db)):
    query = select(OutreachDraft).order_by(OutreachDraft.created_at.desc())
    if company_id:
        query = query.where(OutreachDraft.company_id == company_id)
    return db.scalars(query).all()


@router.patch("/{draft_id}", response_model=OutreachDraftOut)
def update_outreach(
    draft_id: str, payload: OutreachUpdate, db: Session = Depends(get_db)
):
    draft = db.get(OutreachDraft, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if payload.status == "sent" and draft.status != "sent":
        draft.status = "sent"
        # Sending an email is a real touch. Log it and update the company.
        db.add(
            Touch(
                id=f"tch-{uuid.uuid4().hex[:8]}",
                company_id=draft.company_id,
                kind="email",
                summary=f"Outreach sent, {draft.subject}",
                when="Just now",
            )
        )
        company = db.get(Company, draft.company_id)
        if company:
            company.last_touch = f"Outreach sent · {now_label()}"
    elif payload.status:
        draft.status = payload.status

    db.commit()
    db.refresh(draft)
    return draft
