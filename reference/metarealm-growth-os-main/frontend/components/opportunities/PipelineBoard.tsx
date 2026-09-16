"use client";

import { OPEN_STAGES } from "@/lib/stages";
import type { Opportunity, OpportunityStage } from "@/types";
import { PipelineColumn } from "./PipelineColumn";

interface PipelineBoardProps {
  deals: Opportunity[];
  onMove: (id: string, stage: OpportunityStage) => void;
  onSelect: (id: string) => void;
}

/** Kanban view over the open stages. Closed deals live in the summary, not on the board. */
export function PipelineBoard({ deals, onMove, onSelect }: PipelineBoardProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {OPEN_STAGES.map((stage) => (
        <PipelineColumn
          key={stage}
          stage={stage}
          deals={deals.filter((deal) => deal.stage === stage)}
          onMove={onMove}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
