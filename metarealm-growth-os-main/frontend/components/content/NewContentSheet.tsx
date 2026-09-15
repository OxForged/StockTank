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
import { Textarea } from "@/components/ui/textarea";
import type { ContentItem, ContentPlatform } from "@/types";

export function NewContentSheet({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (item: Omit<ContentItem, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<ContentPlatform>("linkedin");
  const [scheduledFor, setScheduledFor] = useState("");
  const [body, setBody] = useState("");

  const canSubmit = title.trim() !== "";

  const reset = () => {
    setTitle("");
    setPlatform("linkedin");
    setScheduledFor("");
    setBody("");
  };

  const submit = () => {
    onCreate({
      title: title.trim(),
      platform,
      status: "draft",
      scheduledFor: scheduledFor.trim() || undefined,
      body: body.trim() || undefined,
      author: "Marouane",
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New draft</SheetTitle>
          <SheetDescription>
            Saved to your database. The Content Strategist starts writing
            these in Milestone 6.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cnt-title">Title</Label>
          <Input
            id="cnt-title"
            placeholder="Working title for the post"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cnt-platform">Platform</Label>
            <NativeSelect
              id="cnt-platform"
              value={platform}
              onChange={(event) =>
                setPlatform(event.target.value as ContentPlatform)
              }
            >
              <option value="linkedin">LinkedIn</option>
              <option value="x">X</option>
              <option value="instagram">Instagram</option>
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnt-slot">Slot (optional)</Label>
            <Input
              id="cnt-slot"
              placeholder="Tue · 09:00"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cnt-body">Draft text</Label>
          <Textarea
            id="cnt-body"
            className="min-h-32"
            placeholder="Hook first. Numbers early."
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit} onClick={submit}>
            Save draft
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
