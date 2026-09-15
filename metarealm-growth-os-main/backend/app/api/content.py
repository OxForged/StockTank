from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import ContentItem
from app.schemas import ContentItemCreate, ContentItemOut, ContentItemUpdate

router = APIRouter(prefix="/content", tags=["content"])


@router.get("", response_model=list[ContentItemOut])
def list_content(db: Session = Depends(get_db)):
    return db.scalars(select(ContentItem)).all()


@router.post("", response_model=ContentItemOut, status_code=201)
def create_content(payload: ContentItemCreate, db: Session = Depends(get_db)):
    item = ContentItem(id=f"cnt-{uuid4().hex[:8]}", **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ContentItemOut)
def update_content(
    item_id: str, payload: ContentItemUpdate, db: Session = Depends(get_db)
):
    item = db.get(ContentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Content item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}/save")
def toggle_save_content(item_id: str, db: Session = Depends(get_db)):
    item = db.get(ContentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    item.saved = not item.saved
    db.commit()
    return {"id": item.id, "saved": item.saved}


@router.delete("/{item_id}", status_code=204)
def delete_content(item_id: str, db: Session = Depends(get_db)):
    item = db.get(ContentItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    db.delete(item)
    db.commit()
