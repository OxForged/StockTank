from typing import Literal

from app.schemas.base import CamelModel

TaskPriority = Literal["high", "medium", "low"]
ActivityKind = Literal["opportunity", "meeting", "content", "email", "system"]


class FocusTaskOut(CamelModel):
    id: str
    title: str
    context: str | None = None
    priority: TaskPriority
    done: bool


class FocusTaskUpdate(CamelModel):
    done: bool | None = None
    title: str | None = None
    context: str | None = None
    priority: TaskPriority | None = None


class ActivityItemOut(CamelModel):
    id: str
    kind: ActivityKind
    text: str
    time: str


class ExecutiveBriefOut(CamelModel):
    generated_at: str
    paragraphs: list[str]
    actions: list[str]
