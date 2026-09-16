"use client";

import { useState } from "react";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchExecutiveBrief, runAgent } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { ExecutiveBrief } from "@/types";

export function ExecutiveBriefView({
  initialBrief,
}: {
  initialBrief: ExecutiveBrief;
}) {
  const [brief, setBrief] = useState(initialBrief);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const regenerate = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await runAgent("executive-assistant");
      if (result.status === "completed") {
        setBrief(await fetchExecutiveBrief());
      }
      setNote(result.summary);
    } catch (error) {
      console.error(error);
      setNote("Something went wrong. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card className="relative overflow-hidden border-l-2 border-l-primary">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent"
        />
        <CardHeader className="relative flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-[13px] font-medium">
            <span className="grid size-6 place-items-center rounded-md bg-primary/15">
              <Sparkles className="size-3.5 text-primary" />
            </span>
            AI Executive Brief
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Generated {brief.generatedAt}
            </span>
            <Button size="sm" onClick={regenerate} disabled={busy}>
              <RefreshCw className={cn(busy && "animate-spin")} />
              {busy ? "Writing…" : "Regenerate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-5">
          <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
            {brief.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <Separator />
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Do next
            </p>
            <ol className="space-y-2">
              {brief.actions.map((action, index) => (
                <li key={action} className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 font-mono text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-sm">{action}</span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      {note && (
        <p className="flex items-start gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          <ArrowRight className="mt-0.5 size-3 shrink-0 text-primary" />
          {note}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        This brief is written by the Executive Assistant from your live
        pipeline, meetings, approvals and news. It runs every morning at 07:00
        once you import docker/n8n-workflows/morning-routine.json into n8n.
        The voice lives in prompts/executive-assistant.md, edit that file to
        change how it writes.
      </p>
    </div>
  );
}
