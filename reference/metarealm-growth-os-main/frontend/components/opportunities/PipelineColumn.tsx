"use client";

import { useState } from "react";
import { formatMad } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { Opportunity, OpportunityStage } from "@/types";
import { DealCard } from "./DealCard";

interface PipelineColumnProps {
  stage: OpportunityStage;
  deals: Opportunity[];
  onMove: (id: string, stage: OpportunityStage) => void;
  onSelect: (id: string) => void;
}

export function PipelineColumn({
  stage,
  deals,
  onMove,
  onSelect,
}: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const total = deals.reduce((sum, deal) => sum + deal.valueMad, 0);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const id = event.dataTransfer.getData("text/plain");
        if (id) onMove(id, stage);
      }}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg border border-border/60 bg-card/40 transition-colors",
        isOver && "border-primary/50 bg-primary/[0.04]"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {STAGE_LABELS[stage]}
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] tabular-nums">
            {deals.length}
          </span>
        </p>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatMad(total)}
        </span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onMove={onMove}
            onSelect={onSelect}
          />
        ))}
        {deals.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 p-3 text-center text-[11px] text-muted-foreground">
            Drop a deal here
          </div>
        )}
      </div>
    </div>
  );
}
