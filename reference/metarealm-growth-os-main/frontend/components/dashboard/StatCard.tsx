import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  delta?: { label: string; direction: "up" | "down" };
}

export function StatCard({ label, value, icon: Icon, hint, delta }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground/60" />
        </div>
        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta.direction === "up" ? "text-success" : "text-destructive"
              )}
            >
              {delta.direction === "up" ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {delta.label}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
