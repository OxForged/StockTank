"use client";

import { useState } from "react";
import { Check, Copy, Mail, RefreshCw, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { listOutreach, markOutreachSent, runAgent } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { OutreachDraft } from "@/types";

export function CompanyOutreach({
  companyId,
  initialDrafts,
}: {
  companyId: string;
  initialDrafts: OutreachDraft[];
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const hasSent = drafts.some((draft) => draft.status === "sent");

  const refresh = async () => {
    try {
      setDrafts(await listOutreach(companyId));
    } catch (error) {
      console.error(error);
    }
  };

  const draftEmail = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await runAgent("bd-manager", { companyId });
      setNote(result.summary);
      if (result.status === "completed") await refresh();
    } catch (error) {
      console.error(error);
      setNote("Something went wrong. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  const copyDraft = async (draft: OutreachDraft) => {
    try {
      await navigator.clipboard.writeText(
        `Subject: ${draft.subject}\n\n${draft.body}`
      );
      setCopiedId(draft.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (error) {
      console.error(error);
    }
  };

  const markSent = async (id: string) => {
    try {
      await markOutreachSent(id);
      await refresh();
      setNote("Marked as sent. A touch was logged on this company.");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <WidgetCard title="Outreach" icon={Mail}>
      <div className="mb-3 flex flex-col gap-2">
        <Button size="sm" onClick={draftEmail} disabled={busy}>
          {busy ? <RefreshCw className="animate-spin" /> : <Sparkles />}
          {busy
            ? "Writing…"
            : hasSent
              ? "Draft a follow up"
              : "Draft outreach email"}
        </Button>
        {note && (
          <p className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
            {note}
          </p>
        )}
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          No drafts yet. The BD Manager writes them, you send them.
        </p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="rounded-md border border-border/60 bg-card p-3"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Badge variant={draft.kind === "intro" ? "outline" : "secondary"}>
                  {draft.kind === "intro" ? "Intro" : "Follow up"}
                </Badge>
                <Badge variant={draft.status === "sent" ? "success" : "warning"}>
                  {draft.status === "sent" ? "Sent" : "Draft"}
                </Badge>
              </div>
              <p className="text-sm font-medium leading-snug">
                {draft.subject}
              </p>
              {draft.contactName && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  For {draft.contactName}
                </p>
              )}
              <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-foreground/80">
                {draft.body}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => copyDraft(draft)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent",
                    copiedId === draft.id && "border-success/40 text-success"
                  )}
                >
                  {copiedId === draft.id ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copiedId === draft.id ? "Copied" : "Copy"}
                </button>
                {draft.status === "draft" && (
                  <button
                    onClick={() => markSent(draft.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-accent"
                  >
                    <Send className="size-3" />
                    Mark as sent
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
