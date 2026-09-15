from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Opportunity
from app.schemas import OpportunityCreate, OpportunityOut, OpportunityUpdate

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("", response_model=list[OpportunityOut])
def list_opportunities(
    company_id: str | None = None, db: Session = Depends(get_db)
):
    query = select(Opportunity)
    if company_id:
        query = query.where(Opportunity.company_id == company_id)
    return db.scalars(query).all()


@router.post("", response_model=OpportunityOut, status_code=201)
def create_opportunity(
    payload: OpportunityCreate, db: Session = Depends(get_db)
):
    opportunity = Opportunity(
        id=f"opp-{uuid4().hex[:8]}", **payload.model_dump()
    )
    db.add(opportunity)
    db.commit()
    db.refresh(opportunity)
    return opportunity


@router.patch("/{opportunity_id}", response_model=OpportunityOut)
def update_opportunity(
    opportunity_id: str,
    payload: OpportunityUpdate,
    db: Session = Depends(get_db),
):
    opportunity = db.get(Opportunity, opportunity_id)
    if not opportunity:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(opportunity, field, value)
    db.commit()
    db.refresh(opportunity)
    return opportunity
