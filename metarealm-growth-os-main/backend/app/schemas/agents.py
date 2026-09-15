from app.schemas.base import CamelModel


class AgentLastRunOut(CamelModel):
    status: str
    summary: str
    created_at: str


class AgentGuideOut(CamelModel):
    does: str
    use: str
    cannot: str


class AgentInfoOut(CamelModel):
    name: str
    title: str
    description: str
    guide: AgentGuideOut | None = None
    last_run: AgentLastRunOut | None = None


class AgentRunRequest(CamelModel):
    topic: str | None = None
    platform: str | None = None
    meeting_id: str | None = None
    company_id: str | None = None
    opportunity_id: str | None = None
    batch: bool | None = None
    reset: bool | None = None
    auto: bool | None = None


class AgentRunOut(CamelModel):
    agent: str
    status: str
    summary: str
    details: dict | None = None
