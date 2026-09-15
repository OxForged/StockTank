from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Proposal
from app.schemas import ProposalOut

router = APIRouter(prefix="/proposals", tags=["proposals"])


@router.get("", response_model=list[ProposalOut])
def list_proposals(
    opportunity_id: str | None = None, db: Session = Depends(get_db)
):
    query = select(Proposal).order_by(Proposal.created_at.desc())
    if opportunity_id:
        query = query.where(Proposal.opportunity_id == opportunity_id)
    return db.scalars(query).all()
