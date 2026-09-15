from app.schemas.base import CamelModel


class OutreachDraftOut(CamelModel):
    id: str
    company_id: str
    company: str
    contact_name: str | None = None
    kind: str
    subject: str
    body: str
    status: str
    created_at: str


class OutreachUpdate(CamelModel):
    status: str | None = None


class ProposalOut(CamelModel):
    id: str
    opportunity_id: str
    company: str
    title: str
    filename: str
    created_at: str
