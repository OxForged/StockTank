from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import NewsItem
from app.schemas import NewsItemOut

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=list[NewsItemOut])
def list_news(db: Session = Depends(get_db)):
    return db.scalars(select(NewsItem)).all()


@router.patch("/{news_id}/save")
def toggle_save(news_id: str, db: Session = Depends(get_db)):
    from app.models import NewsItem as _NI
    item = db.get(_NI, news_id)
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="News not found")
    item.saved = not item.saved
    db.commit()
    return {"id": item.id, "saved": item.saved}


@router.delete("/{news_id}", status_code=204)
def delete_news(news_id: str, db: Session = Depends(get_db)):
    from app.models import NewsItem as _NI
    item = db.get(_NI, news_id)
    if item:
        db.delete(item)
        db.commit()
