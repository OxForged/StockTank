/** Core business domain — mirrors the future FastAPI/Pydantic schemas. */

export type OpportunityStage =
  | "lead"
  | "contacted"
  | "meeting"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface Opportunity {
  id: string;
  /** Relational link to Company — becomes a foreign key in the database. */
  companyId: string;
  /** Denormalized display name, exactly as the future API will return it. */
  company: string;
  title: string;
  valueMad: number;
  stage: OpportunityStage;
  nextAction: string;
  /** Human label during the mock phase; becomes an ISO date with the backend. */
  nextActionDue: string;
  owner: string;
}

export type CompanyStatus =
  | "prospect"
  | "in_talks"
  | "active_partner"
  | "past_partner";

export interface Company {
  id: string;
  name: string;
  industry: string;
  status: CompanyStatus;
  location?: string;
  website?: string;
  reasonToContact?: string;
  lastTouch?: string;
  details?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactLinkedin?: string;
  sourceUrl?: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  companyId: string;
  company: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  lastTouch?: string;
  notes?: string;
}

export type TouchKind = "email" | "call" | "meeting" | "event" | "note";

/** A logged interaction with a company — the raw material of relationships. */
export interface Touch {
  id: string;
  companyId: string;
  kind: TouchKind;
  summary: string;
  /** Human label during the mock phase; becomes an ISO date with the backend. */
  when: string;
}

export type MeetingKind = "video" | "in_person" | "call";

export type MeetingStatus = "upcoming" | "completed";

export interface Meeting {
  id: string;
  startsAt?: string;
  title: string;
  companyId?: string;
  company?: string;
  /** Human label during the mock phase, e.g. "Today · 14:00". */
  when: string;
  durationMin: number;
  kind: MeetingKind;
  status: MeetingStatus;
  agenda?: string;
  attendees?: string[];
  /** Prep-brief slot — written by the Meeting Assistant from Milestone 6. */
  prep?: string;
  /** Post-meeting notes, for completed meetings. */
  notes?: string;
}
