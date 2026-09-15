from typing import Literal

from app.schemas.base import CamelModel

ContentPlatform = Literal["linkedin", "x", "instagram"]
ContentStatus = Literal["awaiting_approval", "draft", "scheduled", "published"]
NewsRegion = Literal["morocco", "mena", "web3", "gaming"]


class ContentItemBase(CamelModel):
    title: str
    platform: ContentPlatform
    status: ContentStatus
    scheduled_for: str | None = None
    body: str | None = None
    author: str | None = None


class ContentItemCreate(ContentItemBase):
    pass


class ContentItemUpdate(CamelModel):
    title: str | None = None
    platform: ContentPlatform | None = None
    status: ContentStatus | None = None
    scheduled_for: str | None = None
    body: str | None = None
    author: str | None = None


class ContentItemOut(ContentItemBase):
    topic: str = "general"
    id: str


class NewsItemOut(CamelModel):
    id: str
    title: str
    source: str
    region: NewsRegion
    published_ago: str
    url: str | None = None
    saved: bool = False
    score: int = 0
