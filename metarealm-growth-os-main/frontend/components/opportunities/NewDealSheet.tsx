"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OPEN_STAGES, STAGE_LABELS } from "@/lib/stages";
import type { Company, Opportunity, OpportunityStage } from "@/types";

interface NewDealSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onCreate: (deal: Omit<Opportunity, "id">) => void;
}

const OWNERS = ["Marouane", "Oussama", "Yahya"];

export function NewDealSheet({
  open,
  onOpenChange,
  companies,
  onCreate,
}: NewDealSheetProps) {
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [valueMad, setValueMad] = useState("");
  const [stage, setStage] = useState<OpportunityStage>("lead");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDue, setNextActionDue] = useState("This week");
  const [owner, setOwner] = useState(OWNERS[0]);

  const canSubmit =
    companyId !== "" && title.trim() !== "" && Number(valueMad) > 0;

  const reset = () => {
    setCompanyId("");
    setTitle("");
    setValueMad("");
    setStage("lead");
    setNextAction("");
    setNextActionDue("This week");
    setOwner(OWNERS[0]);
  };

  const submit = () => {
    const company = companies.find((entry) => entry.id === companyId);
    if (!company) return;
    onCreate({
      companyId: company.id,
      company: company.name,
      title: title.trim(),
      valueMad: Number(valueMad),
      stage,
      nextAction: nextAction.trim() || "Define the first step",
      nextActionDue,
      owner,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New opportunity</SheetTitle>
          <SheetDescription>
            Add a deal to the pipeline. Saved straight to your database.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1.5">
          <Label htmlFor="new-company">Company</Label>
          <NativeSelect
            id="new-company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            <option value="">Select a company…</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-title">Deal title</Label>
          <Input
            id="new-title"
            placeholder="e.g. Silver package · 6 months"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-value">Value (MAD)</Label>
            <Input
              id="new-value"
              type="number"
              min="0"
              placeholder="171000"
              value={valueMad}
              onChange={(event) => setValueMad(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-stage">Stage</Label>
            <NativeSelect
              id="new-stage"
              value={stage}
              onChange={(event) =>
                setStage(event.target.value as OpportunityStage)
              }
            >
              {OPEN_STAGES.map((entry) => (
                <option key={entry} value={entry}>
                  {STAGE_LABELS[entry]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-next">Next action</Label>
          <Input
            id="new-next"
            placeholder="What moves this deal forward?"
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-due">Due</Label>
            <Input
              id="new-due"
              value={nextActionDue}
              onChange={(event) => setNextActionDue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-owner">Owner</Label>
            <NativeSelect
              id="new-owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            >
              {OWNERS.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit} onClick={submit}>
            Create deal
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
