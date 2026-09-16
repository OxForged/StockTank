from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Touch
from app.schemas import TouchOut

router = APIRouter(prefix="/touches", tags=["touches"])


@router.get("", response_model=list[TouchOut])
def list_touches(company_id: str | None = None, db: Session = Depends(get_db)):
    query = select(Touch)
    if company_id:
        query = query.where(Touch.company_id == company_id)
    return db.scalars(query).all()
