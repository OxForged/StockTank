"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  RefreshCw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { StageBadge } from "@/components/shared/StageBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { listProposals, runAgent } from "@/lib/api/client";
import { formatMad } from "@/lib/format";
import { OPEN_STAGES, STAGE_LABELS, isOpenStage } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { Opportunity, OpportunityStage, Proposal } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface DealDetailSheetProps {
  deal: Opportunity | null;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, patch: Partial<Opportunity>) => void;
  onCloseDeal: (id: string, outcome: "closed_won" | "closed_lost") => void;
}

export function DealDetailSheet({
  deal,
  onOpenChange,
  onUpdate,
  onCloseDeal,
}: DealDetailSheetProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setProposals([]);
    setNote(null);
    if (deal) {
      listProposals(deal.id).then(setProposals).catch(console.error);
    }
  }, [deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateProposal = async () => {
    if (!deal) return;
    setGenerating(true);
    setNote(null);
    try {
      const result = await runAgent("proposal-builder", {
        opportunityId: deal.id,
      });
      setNote(result.summary);
      if (result.status === "completed") {
        setProposals(await listProposals(deal.id));
      }
    } catch (error) {
      console.error(error);
      setNote("Something went wrong. Is the backend running?");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Sheet open={deal !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {deal && (
          <>
            <SheetHeader>
              <SheetTitle>{deal.company}</SheetTitle>
              <SheetDescription>{deal.title}</SheetDescription>
            </SheetHeader>

            <div className="flex items-center justify-between">
              <StageBadge stage={deal.stage} />
              <span className="font-mono text-lg font-semibold tabular-nums">
                {formatMad(deal.valueMad)}
              </span>
            </div>

            {isOpenStage(deal.stage) && (
              <div className="space-y-1.5">
                <Label htmlFor="deal-stage">Stage</Label>
                <NativeSelect
                  id="deal-stage"
                  value={deal.stage}
                  onChange={(event) =>
                    onUpdate(deal.id, {
                      stage: event.target.value as OpportunityStage,
                    })
                  }
                >
                  {OPEN_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_LABELS[stage]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="deal-next">Next action</Label>
              <Input
                id="deal-next"
                value={deal.nextAction}
                onChange={(event) =>
                  onUpdate(deal.id, { nextAction: event.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-due">Due</Label>
                <Input
                  id="deal-due"
                  value={deal.nextActionDue}
                  onChange={(event) =>
                    onUpdate(deal.id, { nextActionDue: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deal-owner">Owner</Label>
                <NativeSelect
                  id="deal-owner"
                  value={deal.owner}
                  onChange={(event) =>
                    onUpdate(deal.id, { owner: event.target.value })
                  }
                >
                  <option>Marouane</option>
                  <option>Oussama</option>
                  <option>Yahya</option>
                </NativeSelect>
              </div>
            </div>

            <Link
              href={`/companies/${deal.companyId}`}
              className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Open company profile
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>

            <Separator />

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Proposals
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={generateProposal}
                disabled={generating}
                className="mb-2 w-full"
              >
                {generating ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {generating ? "Writing…" : "Generate proposal document"}
              </Button>
              {note && (
                <p className="mb-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
                  {note}
                </p>
              )}
              {proposals.length > 0 && (
                <ul className="space-y-1.5">
                  {proposals.map((proposal) => (
                    <li key={proposal.id}>
                      <a
                        href={`${API_URL}/uploads/proposals/${proposal.filename}`}
                        className="group flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 transition-colors hover:border-primary/40"
                      >
                        <FileText className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {proposal.title}
                          </span>
                          <span className="block truncate text-[10px] text-muted-foreground">
                            Word document, click to download
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isOpenStage(deal.stage) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-success/40 text-success hover:bg-success/10 hover:text-success"
                    onClick={() => onCloseDeal(deal.id, "closed_won")}
                  >
                    <Trophy />
                    Mark won
                  </Button>
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onCloseDeal(deal.id, "closed_lost")}
                  >
                    <XCircle />
                    Mark lost
                  </Button>
                </div>
              </>
            )}

            <SheetFooter>
              <p className="text-[11px] text-muted-foreground">
                Edits save automatically to your database.
              </p>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
