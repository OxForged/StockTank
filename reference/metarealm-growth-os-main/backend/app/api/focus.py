"""Focus tasks: your daily list. You can add your own, note them, finish
them, and see the ones you completed."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.runtime import now_iso
from app.core.db import get_db
from app.models import FocusTask

router = APIRouter(prefix="/focus", tags=["focus"])


class TaskIn(BaseModel):
    title: str
    priority: str = "medium"
    note: str | None = None


class NoteIn(BaseModel):
    note: str


@router.post("")
def create_task(body: TaskIn, db: Session = Depends(get_db)):
    task = FocusTask(
        id=f"task-you-{uuid.uuid4().hex[:8]}",
        title=body.title.strip(),
        context="You added this task.",
        priority=body.priority if body.priority in ("high", "medium", "low") else "medium",
        done=False,
        note=body.note,
        source="you",
        created_at=now_iso(),
    )
    db.add(task)
    db.commit()
    return {"id": task.id, "title": task.title, "priority": task.priority}


@router.patch("/{task_id}/done")
def complete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(FocusTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.done = not task.done
    task.done_at = now_iso() if task.done else None
    db.commit()
    return {"id": task.id, "done": task.done}


@router.patch("/{task_id}/note")
def add_note(task_id: str, body: NoteIn, db: Session = Depends(get_db)):
    task = db.get(FocusTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.note = body.note
    db.commit()
    return {"id": task.id, "note": task.note}


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.get(FocusTask, task_id)
    if task:
        db.delete(task)
        db.commit()


@router.get("/done")
def done_tasks(db: Session = Depends(get_db)):
    """The tasks you finished, your win history."""
    tasks = [t for t in db.scalars(select(FocusTask)).all() if t.done]
    tasks.sort(key=lambda t: t.done_at or "", reverse=True)
    return [
        {
            "id": t.id, "title": t.title, "priority": t.priority,
            "note": t.note, "doneAt": t.done_at, "source": t.source,
        }
        for t in tasks
    ]
