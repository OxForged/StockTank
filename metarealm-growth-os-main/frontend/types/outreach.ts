/** Outreach and proposals — mirrors backend/app/schemas/outreach.py. */

export interface OutreachDraft {
  id: string;
  companyId: string;
  company: string;
  contactName?: string | null;
  kind: "intro" | "follow_up";
  subject: string;
  body: string;
  status: "draft" | "sent";
  createdAt: string;
}

export interface Proposal {
  id: string;
  opportunityId: string;
  company: string;
  title: string;
  filename: string;
  createdAt: string;
}
