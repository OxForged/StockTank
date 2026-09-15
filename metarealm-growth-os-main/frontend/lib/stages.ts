import type { OpportunityStage } from "@/types";

/** Single source of truth for pipeline stages — order, labels, open/closed. */

export const STAGE_ORDER: OpportunityStage[] = [
  "lead",
  "contacted",
  "meeting",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];

export const OPEN_STAGES: OpportunityStage[] = [
  "lead",
  "contacted",
  "meeting",
  "proposal",
  "negotiation",
];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  meeting: "Meeting",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Won",
  closed_lost: "Lost",
};

export function isOpenStage(stage: OpportunityStage): boolean {
  return OPEN_STAGES.includes(stage);
}

/** Next open stage to the right, or the same stage if already at the end. */
export function nextStage(stage: OpportunityStage): OpportunityStage {
  const index = OPEN_STAGES.indexOf(stage);
  if (index === -1) return stage;
  return OPEN_STAGES[index + 1] ?? stage;
}

/** Previous open stage to the left, or the same stage if already at the start. */
export function prevStage(stage: OpportunityStage): OpportunityStage {
  const index = OPEN_STAGES.indexOf(stage);
  if (index <= 0) return stage;
  return OPEN_STAGES[index - 1];
}
