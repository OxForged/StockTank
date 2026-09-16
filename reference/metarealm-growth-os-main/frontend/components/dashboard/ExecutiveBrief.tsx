import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ExecutiveBrief as ExecutiveBriefData } from "@/types";

/** The signature module: a morning intelligence briefing, not a stats dump. */
export function ExecutiveBrief({ brief }: { brief: ExecutiveBriefData }) {
  return (
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
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          Generated {brief.generatedAt} · mock data
        </span>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-foreground/90">
          {brief.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Do next
          </p>
          <ul className="flex flex-wrap gap-2">
            {brief.actions.map((action) => (
              <li key={action}>
                <Link
                  href="/executive-brief"
                  className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-secondary"
                >
                  <ArrowRight className="size-3 text-primary" />
                  {action}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
