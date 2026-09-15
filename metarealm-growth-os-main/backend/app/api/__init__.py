from fastapi import APIRouter

from app.api import (
    agents,
    companies,
    outreach,
    proposals,
    settings as settings_router,
    knowledge,
    contacts,
    content,
    dashboard,
    meetings,
    news,
    digest,
    analytics,
    focus,
    opportunities,
    touches,
)

api_router = APIRouter()
api_router.include_router(companies.router)
api_router.include_router(contacts.router)
api_router.include_router(opportunities.router)
api_router.include_router(touches.router)
api_router.include_router(meetings.router)
api_router.include_router(content.router)
api_router.include_router(news.router)
api_router.include_router(digest.router)
api_router.include_router(focus.router)
api_router.include_router(analytics.router)
api_router.include_router(knowledge.router)
api_router.include_router(agents.router)
api_router.include_router(outreach.router)
api_router.include_router(proposals.router)
api_router.include_router(settings_router.router)
api_router.include_router(dashboard.router)
