from typing import Literal

from app.schemas.base import CamelModel

OpportunityStage = Literal[
    "lead",
    "contacted",
    "meeting",
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
]
CompanyStatus = Literal["prospect", "in_talks", "active_partner", "past_partner"]
TouchKind = Literal["email", "call", "meeting", "event", "note"]
MeetingKind = Literal["video", "in_person", "call"]
MeetingStatus = Literal["upcoming", "completed"]


class CompanyOut(CamelModel):
    id: str
    details: str | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    contact_linkedin: str | None = None
    source_url: str | None = None
    name: str
    industry: str
    status: CompanyStatus
    location: str | None = None
    website: str | None = None
    reason_to_contact: str | None = None
    last_touch: str | None = None


class ContactBase(CamelModel):
    name: str
    role: str
    company_id: str
    company: str
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    last_touch: str | None = None
    notes: str | None = None


class ContactCreate(ContactBase):
    pass


class ContactOut(ContactBase):
    id: str


class OpportunityBase(CamelModel):
    company_id: str
    company: str
    title: str
    value_mad: int
    stage: OpportunityStage
    next_action: str
    next_action_due: str
    owner: str


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(CamelModel):
    company_id: str | None = None
    company: str | None = None
    title: str | None = None
    value_mad: int | None = None
    stage: OpportunityStage | None = None
    next_action: str | None = None
    next_action_due: str | None = None
    owner: str | None = None


class OpportunityOut(OpportunityBase):
    id: str


class TouchOut(CamelModel):
    id: str
    company_id: str
    kind: TouchKind
    summary: str
    when: str


class MeetingBase(CamelModel):
    title: str
    company_id: str | None = None
    company: str | None = None
    when: str
    duration_min: int
    kind: MeetingKind
    status: MeetingStatus
    agenda: str | None = None
    attendees: list[str] | None = None
    prep: str | None = None
    notes: str | None = None


class MeetingCreate(MeetingBase):
    starts_at: str | None = None


class MeetingOut(MeetingBase):
    id: str
    starts_at: str | None = None
