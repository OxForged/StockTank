"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { noteFocusTask } from "@/lib/api/client";

interface DoneTask {
  id: string;
  title: string;
  priority: string;
  note: string | null;
  doneAt: string | null;
  source: string;
}

export function DoneView({ tasks }: { tasks: DoneTask[] }) {
  const [items, setItems] = useState(tasks);

  const saveNote = async (id: string, note: string) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, note } : t)));
    try {
      await noteFocusTask(id, note);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Tasks you finished</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your wins. Add a note to remember what happened, what they said, what
          is next.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing finished yet. Complete a task and it shows up here.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-start gap-3 py-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.doneAt && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      finished {task.doneAt.slice(0, 10)}
                      {task.source === "you" ? " . your task" : ""}
                    </p>
                  )}
                  <textarea
                    defaultValue={task.note ?? ""}
                    placeholder="Add a note about this..."
                    onBlur={(e) => saveNote(task.id, e.target.value)}
                    className="mt-2 w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/60"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
