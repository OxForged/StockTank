"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createOpportunity, updateOpportunity } from "@/lib/api/client";
import { formatMad } from "@/lib/format";
import { isOpenStage } from "@/lib/stages";
import type { Company, Opportunity, OpportunityStage } from "@/types";
import { DealDetailSheet } from "./DealDetailSheet";
import { NewDealSheet } from "./NewDealSheet";
import { PipelineBoard } from "./PipelineBoard";

/**
 * Owns pipeline state for the session and persists every change through
 * the API: optimistic local update first, then the PATCH/POST behind it.
 */
export function OpportunitiesView({
  initialDeals,
  companies,
}: {
  initialDeals: Opportunity[];
  companies: Company[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const openDeals = useMemo(
    () => deals.filter((deal) => isOpenStage(deal.stage)),
    [deals]
  );
  const wonDeals = deals.filter((deal) => deal.stage === "closed_won");
  const lostCount = deals.filter((deal) => deal.stage === "closed_lost").length;
  const openTotal = openDeals.reduce((sum, deal) => sum + deal.valueMad, 0);
  const wonTotal = wonDeals.reduce((sum, deal) => sum + deal.valueMad, 0);

  const selectedDeal = deals.find((deal) => deal.id === selectedId) ?? null;

  const moveStage = (id: string, stage: OpportunityStage) => {
    setDeals((prev) =>
      prev.map((deal) => (deal.id === id ? { ...deal, stage } : deal))
    );
    updateOpportunity(id, { stage }).catch(console.error);
  };

  const updateDeal = (id: string, patch: Partial<Opportunity>) => {
    setDeals((prev) =>
      prev.map((deal) => (deal.id === id ? { ...deal, ...patch } : deal))
    );
    updateOpportunity(id, patch).catch(console.error);
  };

  const closeDeal = (id: string, outcome: "closed_won" | "closed_lost") => {
    moveStage(id, outcome);
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Open pipeline</p>
            <p className="font-mono text-xl font-semibold tabular-nums">
              {formatMad(openTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Open deals</p>
            <p className="font-mono text-xl font-semibold tabular-nums">
              {openDeals.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Closed this year</p>
            <p className="font-mono text-xl font-semibold tabular-nums">
              {formatMad(wonTotal)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                won · {wonDeals.length} deals, {lostCount} lost
              </span>
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus />
          New deal
        </Button>
      </div>

      <PipelineBoard
        deals={openDeals}
        onMove={moveStage}
        onSelect={setSelectedId}
      />

      <p className="text-[11px] text-muted-foreground">
        Drag cards between stages, use the arrows on a card, or open a deal to
        edit it. Every change saves to your database.
      </p>

      <DealDetailSheet
        deal={selectedDeal}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onUpdate={updateDeal}
        onCloseDeal={closeDeal}
      />
      <NewDealSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        companies={companies}
        onCreate={async (draft) => {
          try {
            const created = await createOpportunity(draft);
            setDeals((prev) => [created, ...prev]);
          } catch (error) {
            console.error(error);
          }
        }}
      />
    </div>
  );
}
