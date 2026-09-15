"""Import every model so Base.metadata (and Alembic autogenerate) sees them."""

from app.models.agents import AgentRun
from app.models.business import Company, Contact, Meeting, Opportunity, Touch
from app.models.content import ContentItem, NewsItem
from app.models.dashboard import ActivityItem, ExecutiveBrief, FocusTask
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.models.outreach import OutreachDraft, Proposal
from app.models.settings import Setting

__all__ = [
    "AgentRun",
    "Company",
    "Contact",
    "Opportunity",
    "Touch",
    "Meeting",
    "ContentItem",
    "NewsItem",
    "FocusTask",
    "ActivityItem",
    "ExecutiveBrief",
    "KnowledgeDocument",
    "KnowledgeChunk",
    "OutreachDraft",
    "Proposal",
    "Setting",
]
