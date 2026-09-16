"use client";

import { useState } from "react";
import { Check, ListTodo, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import Link from "next/link";
import {
  createFocusTask,
  deleteFocusTask,
  listFocusTasks,
  runAgent,
  updateFocusTask,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { FocusTask, TaskPriority } from "@/types";

const priorityDot: Record<TaskPriority, string> = {
  high: "bg-primary",
  medium: "bg-warning",
  low: "bg-muted-foreground/40",
};

export function TodaysFocus({
  tasks: initialTasks,
  className,
}: {
  tasks: FocusTask[];
  className?: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const doneCount = tasks.filter((t) => t.done).length;

  const addMyTask = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    try {
      const created = await createFocusTask(title, "high");
      setTasks((prev) => [
        { id: created.id, title, context: "You added this task.", priority: "high", done: false } as FocusTask,
        ...prev,
      ]);
    } catch (error) {
      console.error(error);
    }
  };

  const removeTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteFocusTask(id);
    } catch (error) {
      console.error(error);
    }
  };

  const toggle = (id: string) => {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;
    const done = !current.done;
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, done } : task))
    );
    updateFocusTask(id, { done }).catch(console.error);
  };

  const askTheTeam = async () => {
    setAsking(true);
    setNote("Getting your team to work, this takes a moment...");
    try {
      // The full morning chain, ending with the boss building your plan.
      await runAgent("market-intelligence");
      await runAgent("content-strategist", { batch: true });
      await runAgent("opportunity-hunter");
      await runAgent("bd-manager", { auto: true });
      await runAgent("crm-manager");
      await runAgent("relationship-manager");
      const boss = await runAgent("chief-of-staff");
      setTasks(await listFocusTasks());
      setNote(boss.summary);
    } catch (error) {
      console.error(error);
      setNote("Something went wrong. Is the backend running?");
    } finally {
      setAsking(false);
    }
  };

  return (
    <WidgetCard title="Today's Focus" icon={ListTodo} className={className}>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addMyTask();
          }}
          placeholder="Add your own task, press Enter"
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary/60"
        />
        <button
          onClick={addMyTask}
          aria-label="Add task"
          className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <ul className="divide-y divide-border/60">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="group flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <button
              onClick={() => toggle(task.id)}
              aria-pressed={task.done}
              className={cn(
                "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
                task.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:border-primary/60"
              )}
            >
              {task.done && <Check className="size-3" />}
              <span className="sr-only">
                {task.done ? "Mark as not done" : "Mark as done"}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm leading-snug",
                  task.done && "text-muted-foreground line-through"
                )}
              >
                {task.title}
              </p>
              {task.context && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {task.context}
                </p>
              )}
            </div>
            <span
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                priorityDot[task.priority]
              )}
            >
              <span className="sr-only">{task.priority} priority</span>
            </span>
            <button
              onClick={() => removeTask(task.id)}
              aria-label="Delete task"
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-right">
        <Link href="/done" className="text-xs text-primary hover:underline">
          See tasks you finished
        </Link>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {doneCount} of {tasks.length} done
        </p>
        <button
          onClick={askTheTeam}
          disabled={asking}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {asking ? (
            <RefreshCw className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {asking ? "Working…" : "Plan my day"}
        </button>
      </div>
      {note && (
        <p className="mt-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
          {note}
        </p>
      )}
    </WidgetCard>
  );
}
