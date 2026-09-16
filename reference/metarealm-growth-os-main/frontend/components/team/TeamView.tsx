"use client";

import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentInfo } from "@/types";

export function TeamView({ agents }: { agents: AgentInfo[] }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          These are your ten AI employees. Every one of them writes or finds
          things for you to review. Not one of them can post, send, or log into
          your accounts. You always stay in control, you press send.
        </p>
      </div>

      {agents.map((agent) => (
        <Card key={agent.name}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px]">{agent.title}</CardTitle>
              {agent.lastRun && (
                <Badge variant="outline" className="text-[10px]">
                  last run {agent.lastRun.status}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {agent.guide ? (
              <>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    Does
                  </span>
                  <p className="flex-1 text-sm">{agent.guide.does}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Use
                  </span>
                  <p className="flex-1 text-sm text-muted-foreground">
                    {agent.guide.use}
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-md bg-secondary/30 px-2.5 py-2">
                  <X className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <p className="flex-1 text-xs text-muted-foreground">
                    {agent.guide.cannot}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{agent.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
