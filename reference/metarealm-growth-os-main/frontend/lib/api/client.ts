/**
 * Browser-side mutations — used by client components.
 * Views keep optimistic local state; these calls make it permanent.
 */

import type {
  AgentRunResult,
  AskResult,
  Contact,
  ContentItem,
  ExecutiveBrief,
  FocusTask,
  KnowledgeDocument,
  KnowledgeSyncResult,
  Meeting,
  Opportunity,
  OutreachDraft,
  PromptFile,
  Proposal,
  SettingsPayload,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function send<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT",
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const createOpportunity = (payload: Omit<Opportunity, "id">) =>
  send<Opportunity>("/opportunities", "POST", payload);

export const updateOpportunity = (
  id: string,
  patch: Partial<Omit<Opportunity, "id">>
) => send<Opportunity>(`/opportunities/${id}`, "PATCH", patch);

export const createContact = (payload: Omit<Contact, "id">) =>
  send<Contact>("/contacts", "POST", payload);

export const createMeeting = (payload: Omit<Meeting, "id">) =>
  send<Meeting>("/meetings", "POST", payload);

export const createContentItem = (payload: Omit<ContentItem, "id">) =>
  send<ContentItem>("/content", "POST", payload);

export const updateContentItem = (
  id: string,
  patch: Partial<Omit<ContentItem, "id">>
) => send<ContentItem>(`/content/${id}`, "PATCH", patch);

export const updateFocusTask = (id: string, patch: Partial<Pick<FocusTask, "done">>) =>
  send<FocusTask>(`/dashboard/focus/${id}`, "PATCH", patch);

export const askKnowledge = (question: string) =>
  send<AskResult>("/knowledge/ask", "POST", { question });

export const syncKnowledge = () =>
  send<KnowledgeSyncResult>("/knowledge/sync", "POST", {});

export async function listKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const res = await fetch(`${API_URL}/knowledge/documents`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /knowledge/documents failed with ${res.status}`);
  return res.json() as Promise<KnowledgeDocument[]>;
}

export async function uploadKnowledgeDocument(
  file: File
): Promise<KnowledgeDocument> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/knowledge/documents`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let detail = `Upload failed with ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // no JSON body, keep the status message
    }
    throw new Error(detail);
  }
  return res.json() as Promise<KnowledgeDocument>;
}

export async function deleteKnowledgeDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/knowledge/documents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`DELETE /knowledge/documents/${id} failed with ${res.status}`);
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export const runAgent = (
  name: string,
  payload: {
    topic?: string;
    platform?: string;
    meetingId?: string;
    companyId?: string;
    opportunityId?: string;
    batch?: boolean;
    auto?: boolean;
  } = {}
) => send<AgentRunResult>(`/agents/${name}/run`, "POST", payload);

export const fetchExecutiveBrief = () =>
  getJson<ExecutiveBrief>("/dashboard/brief");

export const listMeetings = () => getJson<Meeting[]>("/meetings");

export const listContentItems = () => getJson<ContentItem[]>("/content");

export const listOutreach = (companyId?: string) =>
  getJson<OutreachDraft[]>(
    `/outreach${companyId ? `?company_id=${companyId}` : ""}`
  );

export const markOutreachSent = (id: string) =>
  send<OutreachDraft>(`/outreach/${id}`, "PATCH", { status: "sent" });

export const listProposals = (opportunityId: string) =>
  getJson<Proposal[]>(`/proposals?opportunity_id=${opportunityId}`);

export const listFocusTasks = () => getJson<FocusTask[]>("/dashboard/focus");

export const getSettingsClient = () => getJson<SettingsPayload>("/settings");

export const saveSetting = (key: string, value: string) =>
  send<{ ok: boolean }>("/settings", "PUT", { key, value });

export const listPrompts = () => getJson<PromptFile[]>("/settings/prompts");

export const savePrompt = (name: string, content: string) =>
  send<PromptFile>(`/settings/prompts/${name}`, "PUT", { content });

export const toggleSaveNews = (id: string) =>
  send<{ id: string; saved: boolean }>(`/news/${id}/save`, "PATCH", {});

export async function deleteNews(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/news/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /news/${id} failed`);
}

export const toggleSaveContent = (id: string) =>
  send<{ id: string; saved: boolean }>(`/content/${id}/save`, "PATCH", {});

export async function deleteContent(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/content/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /content/${id} failed`);
}

export async function deleteCompany(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/companies/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /companies/${id} failed`);
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/contacts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /contacts/${id} failed`);
}

export async function deleteMeeting(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/meetings/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /meetings/${id} failed`);
}

export const createFocusTask = (title: string, priority: string, note?: string) =>
  send<{ id: string; title: string; priority: string }>("/focus", "POST", { title, priority, note });

export const completeFocusTask = (id: string) =>
  send<{ id: string; done: boolean }>(`/focus/${id}/done`, "PATCH", {});

export const noteFocusTask = (id: string, note: string) =>
  send<{ id: string; note: string }>(`/focus/${id}/note`, "PATCH", { note });

export async function deleteFocusTask(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/focus/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /focus/${id} failed`);
}

export async function getDoneTasks() {
  const res = await fetch(`${API_URL}/focus/done`, { cache: "no-store" });
  if (!res.ok) throw new Error("GET /focus/done failed");
  return res.json();
}

export const updateCompany = (id: string, patch: Record<string, unknown>) =>
  send<{ id: string; updated: boolean }>(`/companies/${id}`, "PATCH", patch);

/** Your Hunter.io credit count. One credit returns up to 10 emails. */
export type HunterBudget = {
  keySet: boolean;
  month: string;
  usedThisMonth: number;
  monthlyLimit: number;
  remainingMonth: number;
  usedToday: number;
  remainingToday: number;
  dailyLimit: number;
  emailsPerCompanyPaid: number;
  companiesPerDayPaid: number;
  planHint: string;
};

export async function getHunterCredits(): Promise<HunterBudget> {
  const res = await fetch(`${API_URL}/settings/hunter`, { cache: "no-store" });
  if (!res.ok) throw new Error("GET /settings/hunter failed");
  return res.json() as Promise<HunterBudget>;
}

export const guessCompanyEmails = (
  id: string,
  person: string,
  website?: string
) =>
  send<{
    domain: string | null;
    candidates: string[];
    generic: string[];
    verified?: { email: string; score: number; source: string };
    team?: { email: string; name: string; position: string; score: number }[];
    message?: string | null;
    hunterCreditsSpent?: number;
    hunterBudget?: HunterBudget;
  }>(`/companies/${id}/guess-emails`, "POST", { person, website });

export const findCompanyEmail = (id: string) =>
  send<{
    email: string | null;
    status: string;
    candidates: string[];
    source?: string;
    message?: string;
  }>(`/companies/${id}/find-email`, "POST", {});

export type DiscoverPeopleResult = {
  companyId: string;
  company: string;
  domain: string | null;
  savedCount: number;
  contactEmail: string | null;
  contactLinkedin: string | null;
  contactPerson: string | null;
  reach: {
    email: {
      value: string | null;
      status: string;
      candidates: string[];
      mailto: string | null;
    };
    linkedin: {
      companyUrl: string | null;
      peopleSearchUrl: string;
      label: string;
    };
    x: {
      url: string | null;
      handle: string | null;
      searchUrl: string;
      label: string;
    };
    website: string | null;
    sourceUrl: string | null;
  };
  people: {
    name: string;
    role: string;
    email: string | null;
    linkedin: string | null;
    source: string;
    score: number;
  }[];
  contacts: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    linkedin: string | null;
    notes?: string | null;
  }[];
  message?: string | null;
  hunterCreditsSpent?: number;
  hunterBudget?: HunterBudget;
};

export const discoverCompanyPeople = (
  id: string,
  saveContacts = true,
  maxPeople = 10
) =>
  send<DiscoverPeopleResult>(`/companies/${id}/discover-people`, "POST", {
    save_contacts: saveContacts,
    max_people: maxPeople,
  });

export const cleanCompanyEmail = (id: string) =>
  send<{ id: string; removed: string | null; contactEmail: string | null }>(
    `/companies/${id}/clean-email`,
    "POST",
    {}
  );
