"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
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
import { runAgent } from "@/lib/api/client";
import type { ContentPlatform } from "@/types";

export function AiDraftSheet({
  open,
  onOpenChange,
  onDrafted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDrafted: () => Promise<void> | void;
}) {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<ContentPlatform>("linkedin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runAgent("content-strategist", {
        topic: topic.trim() || undefined,
        platform,
      });
      if (result.status === "completed") {
        await onDrafted();
        setTopic("");
        onOpenChange(false);
      } else {
        setError(result.summary);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Is the backend running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI draft
          </SheetTitle>
          <SheetDescription>
            The Content Strategist writes a draft using only facts from your
            knowledge base. It lands in the approval queue, nothing publishes
            without you.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1.5">
          <Label htmlFor="ai-topic">Topic (optional)</Label>
          <Input
            id="ai-topic"
            placeholder="e.g. the KingSpec Speed Challenge results"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-platform">Platform</Label>
          <NativeSelect
            id="ai-platform"
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value as ContentPlatform)
            }
          >
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
          </NativeSelect>
        </div>

        {error && (
          <p className="rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
            {error}
          </p>
        )}

        <SheetFooter>
          <Button onClick={submit} disabled={busy}>
            <Sparkles />
            {busy ? "Writing…" : "Write the draft"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
