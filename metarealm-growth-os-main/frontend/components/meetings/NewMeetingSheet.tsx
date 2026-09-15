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
import type { Company, Meeting, MeetingKind } from "@/types";

export function NewMeetingSheet({
  open,
  onOpenChange,
  companies,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onCreate: (meeting: Omit<Meeting, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [when, setWhen] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [kind, setKind] = useState<MeetingKind>("video");
  const [agenda, setAgenda] = useState("");

  const canSubmit =
    title.trim() !== "" && when.trim() !== "" && Number(durationMin) > 0;

  const reset = () => {
    setTitle("");
    setCompanyId("");
    setWhen("");
    setDurationMin("30");
    setKind("video");
    setAgenda("");
  };

  const submit = () => {
    const company = companies.find((entry) => entry.id === companyId);
    onCreate({
      title: title.trim(),
      companyId: company?.id,
      company: company?.name,
      when: when.trim(),
      startsAt: startsAt || undefined,
      durationMin: Number(durationMin),
      kind,
      status: "upcoming",
      agenda: agenda.trim() || undefined,
      attendees: ["Marouane"],
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New meeting</SheetTitle>
          <SheetDescription>
            Saved straight to your database.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1.5">
          <Label htmlFor="meet-title">Title</Label>
          <Input
            id="meet-title"
            placeholder="e.g. Oppo one-pager walkthrough"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meet-company">Company (optional)</Label>
          <NativeSelect
            id="meet-company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            <option value="">Internal / none</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="meet-when">When, in your words</Label>
            <Input
              id="meet-when"
              placeholder="Thu · 16:00"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meet-starts">Exact date and time, for your calendar</Label>
            <Input
              id="meet-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meet-duration">Duration (min)</Label>
            <Input
              id="meet-duration"
              type="number"
              min="5"
              value={durationMin}
              onChange={(event) => setDurationMin(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meet-kind">Type</Label>
          <NativeSelect
            id="meet-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as MeetingKind)}
          >
            <option value="video">Video call</option>
            <option value="in_person">In person</option>
            <option value="call">Phone call</option>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meet-agenda">Agenda</Label>
          <Textarea
            id="meet-agenda"
            placeholder="What is this meeting for?"
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
          />
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit} onClick={submit}>
            Add meeting
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
