/** AI employee domain — mirrors backend/app/schemas/agents.py. */

export type AgentStatus = "completed" | "llm_unavailable" | "error";

export interface AgentRunResult {
  agent: string;
  status: AgentStatus;
  summary: string;
  details?: Record<string, unknown> | null;
}

export interface AgentLastRun {
  status: string;
  summary: string;
  createdAt: string;
}

export interface AgentGuide {
  does: string;
  use: string;
  cannot: string;
}

export interface AgentInfo {
  name: string;
  title: string;
  description: string;
  guide?: AgentGuide | null;
  lastRun?: AgentLastRun | null;
}
