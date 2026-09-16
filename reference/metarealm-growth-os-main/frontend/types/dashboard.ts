import type { OpportunityStage } from "./business";

/** Dashboard-specific view models. */

export type TaskPriority = "high" | "medium" | "low";

export interface FocusTask {
  id: string;
  title: string;
  context?: string;
  priority: TaskPriority;
  done: boolean;
}

export type ActivityKind =
  | "opportunity"
  | "meeting"
  | "content"
  | "email"
  | "system";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  text: string;
  time: string;
}

export interface ExecutiveBrief {
  generatedAt: string;
  paragraphs: string[];
  actions: string[];
}

export interface PipelineStageSummary {
  stage: OpportunityStage;
  label: string;
  count: number;
  valueMad: number;
}
