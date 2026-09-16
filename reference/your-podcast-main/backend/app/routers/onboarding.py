from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator

from app.auth import get_current_user
from app.db import DatabaseClient, get_db
from app.db import queries
from app.services.news import get_available_categories

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

# Maps each RSS category (from rss_sources.json) into a UI group.
# Keys = group names shown in the mind-map UI.
# Values = list of RSS category names (must match rss_sources.json keys exactly).
CATEGORY_GROUPS: dict[str, list[str]] = {
    "Tech": ["Android", "Apple", "Tech", "News"],
    "Dev": ["Android Development", "iOS Development", "Programming", "Web Development", "UI - UX"],
    "Entertainment": ["Movies", "Television", "Gaming", "Music", "Funny"],
    "Sports": ["Sports", "Football", "Cricket", "Tennis"],
    "Business": ["Business & Economy", "Startups", "Personal finance"],
    "Lifestyle": ["Beauty", "Fashion", "Food", "Travel", "DIY", "Interior design", "Cars", "Books"],
    "Knowledge": ["Science", "Space", "History", "Architecture", "Photography"],
}


@router.get("/categories")
async def get_categories():
    """Return RSS categories grouped for the onboarding mind-map UI.

    Only categories that actually exist in rss_sources.json are returned.
    """
    available = set(get_available_categories())
    groups = [
        {
            "group": group,
            "categories": [c for c in cats if c in available],
        }
        for group, cats in CATEGORY_GROUPS.items()
    ]
    # Drop groups with no valid categories
    groups = [g for g in groups if g["categories"]]
    return {"groups": groups}


class InterestsBody(BaseModel):
    interests: list[str]

    @field_validator("interests", mode="before")
    @classmethod
    def clean_and_validate(cls, v: list[str]) -> list[str]:
        cleaned = [item[:50].strip() for item in v if isinstance(item, str) and item.strip()]
        if not cleaned:
            raise ValueError("At least 1 interest is required")
        if len(cleaned) > 10:
            raise ValueError("At most 10 interests allowed")
        return cleaned


@router.post("/interests")
async def set_interests(
    body: InterestsBody,
    current_user: dict = Depends(get_current_user),
    db: DatabaseClient = Depends(get_db),
):
    await queries.update_user_interests(db, current_user["id"], body.interests)
    return {"interests": body.interests}


@router.get("/interests")
async def get_interests(current_user: dict = Depends(get_current_user)):
    return {"interests": current_user["interests"]}
