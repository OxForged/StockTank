from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import ActivityItem, ExecutiveBrief, FocusTask
from app.schemas import (
    ActivityItemOut,
    ExecutiveBriefOut,
    FocusTaskOut,
    FocusTaskUpdate,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/brief", response_model=ExecutiveBriefOut)
def get_brief(db: Session = Depends(get_db)):
    brief = db.get(ExecutiveBrief, "brief")
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not generated yet")
    return brief


@router.get("/focus", response_model=list[FocusTaskOut])
def list_focus(db: Session = Depends(get_db)):
    return db.scalars(select(FocusTask)).all()


@router.patch("/focus/{task_id}", response_model=FocusTaskOut)
def update_focus(
    task_id: str, payload: FocusTaskUpdate, db: Session = Depends(get_db)
):
    task = db.get(FocusTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.get("/activity", response_model=list[ActivityItemOut])
def list_activity(db: Session = Depends(get_db)):
    return db.scalars(select(ActivityItem)).all()
