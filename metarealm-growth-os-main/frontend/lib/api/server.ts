/**
 * Server-side data access — used by pages (React Server Components).
 * This file replaced lib/mock imports in Milestone 4: the swap the
 * architecture was designed for. Components were untouched.
 */

import type {
  ActivityItem,
  KnowledgeDocument,
  Company,
  Contact,
  ContentItem,
  ExecutiveBrief,
  FocusTask,
  Meeting,
  NewsItem,
  Opportunity,
  OutreachDraft,
  SettingsPayload,
  Touch,
} from "@/types";

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET ${path} failed with ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const getCompanies = () => fetchJson<Company[]>("/companies");

export async function getCompany(id: string): Promise<Company | null> {
  const res = await fetch(`${API_URL}/companies/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /companies/${id} failed with ${res.status}`);
  return res.json() as Promise<Company>;
}

export const getOpportunities = (companyId?: string) =>
  fetchJson<Opportunity[]>(
    `/opportunities${companyId ? `?company_id=${companyId}` : ""}`
  );

export const getContacts = (companyId?: string) =>
  fetchJson<Contact[]>(`/contacts${companyId ? `?company_id=${companyId}` : ""}`);

export const getTouches = (companyId?: string) =>
  fetchJson<Touch[]>(`/touches${companyId ? `?company_id=${companyId}` : ""}`);

export const getMeetings = () => fetchJson<Meeting[]>("/meetings");

export const getContentItems = () => fetchJson<ContentItem[]>("/content");

export const getNews = () => fetchJson<NewsItem[]>("/news");

export const getExecutiveBrief = () =>
  fetchJson<ExecutiveBrief>("/dashboard/brief");

export const getFocusTasks = () => fetchJson<FocusTask[]>("/dashboard/focus");

export const getActivity = () => fetchJson<ActivityItem[]>("/dashboard/activity");

export const getKnowledgeDocuments = () =>
  fetchJson<KnowledgeDocument[]>("/knowledge/documents");

export const getOutreach = (companyId?: string) =>
  fetchJson<OutreachDraft[]>(
    `/outreach${companyId ? `?company_id=${companyId}` : ""}`
  );

export const getSettings = () => fetchJson<SettingsPayload>("/settings");
