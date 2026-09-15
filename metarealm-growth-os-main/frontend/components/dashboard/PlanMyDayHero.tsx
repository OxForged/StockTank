"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function PlanMyDayHero() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const planMyDay = async () => {
    setRunning(true);
    setDone(null);
    setStep("Your team is working, the Orchestrator is running the day...");
    try {
      // One call, the Orchestrator on the backend decides and runs everything.
      const res = await fetch(`${API_URL}/agents/plan-my-day`, { method: "POST" });
      if (!res.ok) throw new Error("plan failed");
      const data = await res.json();
      setDone(data.summary);
      setStep(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      setDone("Something went wrong. Is the backend running, and Grok set in Settings?");
    } finally {
      setRunning(false);
      setStep(null);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ready to work?</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your team gets the news, writes your posts, hunts deals, and hands
            you today&apos;s task list. One press.
          </p>
        </div>
        <button
          onClick={planMyDay}
          disabled={running}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90 disabled:opacity-70"
        >
          {running ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {running ? "Working..." : "Plan my day"}
        </button>
      </div>

      {step && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin text-primary" />
          {step}
        </div>
      )}
      {done && !step && (
        <div className="mt-3 rounded-lg bg-background/50 px-3 py-2 text-xs text-foreground">
          {done} Scroll down to Today&apos;s Focus to see your tasks.
        </div>
      )}
    </div>
  );
}
