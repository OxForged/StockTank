"use client";

import { useState } from "react";
import { CornerDownLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { AskResult } from "@/types";

const SUGGESTIONS = [
  "What were the MGEX 2026 combined impressions?",
  "Title Partner package price per month?",
  "What is the creator network combined reach?",
];

export function AskPanel({
  onAsk,
  asking,
  result,
}: {
  onAsk: (question: string) => void;
  asking: boolean;
  result: AskResult | null;
}) {
  const [question, setQuestion] = useState("");

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || asking) return;
    setQuestion(trimmed);
    onAsk(trimmed);
  };

  return (
    <Card className="relative overflow-hidden border-l-2 border-l-primary">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent"
      />
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-2 text-[13px] font-medium">
          <span className="grid size-6 place-items-center rounded-md bg-primary/15">
            <Sparkles className="size-3.5 text-primary" />
          </span>
          Ask the knowledge base
        </CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. What were the MGEX numbers?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit(question);
            }}
          />
          <Button
            onClick={() => submit(question)}
            disabled={asking || question.trim() === ""}
          >
            <CornerDownLeft />
            {asking ? "Searching…" : "Ask"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => submit(suggestion)}
              disabled={asking}
              className="rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-secondary disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {result && (
          <>
            <Separator />
            {result.answer ? (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Answer
                </p>
                <p className="whitespace-pre-line rounded-md border border-border/60 bg-secondary/30 p-3 text-sm leading-relaxed">
                  {result.answer}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Synthesized by your local model from the sources below.
                </p>
              </div>
            ) : result.passages.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Local model offline — showing the best matching passages
                instead. Start Ollama for synthesized answers.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No matches in the knowledge base for that question.
              </p>
            )}

            {result.passages.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Sources
                </p>
                {result.passages.map((passage, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-border/60 bg-card p-3"
                  >
                    <p className="mb-1.5 flex items-center gap-2 text-xs font-medium">
                      {passage.documentTitle}
                      {passage.page && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                          p.{passage.page}
                        </span>
                      )}
                    </p>
                    <p className="line-clamp-5 whitespace-pre-line text-xs leading-relaxed text-foreground/80">
                      {passage.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
