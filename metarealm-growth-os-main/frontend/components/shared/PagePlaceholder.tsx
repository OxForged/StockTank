import type { LucideIcon } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  milestone?: string;
}

/** Reserved space for modules scheduled in later milestones. */
export function PagePlaceholder({
  title,
  description,
  icon: Icon,
  milestone,
}: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
        {Icon && (
          <div className="grid size-10 place-items-center rounded-lg bg-secondary">
            <Icon className="size-5 text-muted-foreground" />
          </div>
        )}
        <p className="text-sm font-medium">Module not built yet</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          This space is reserved in the architecture.{" "}
          {milestone ? `Planned for ${milestone}.` : "It arrives in an upcoming milestone."}
        </p>
      </div>
    </div>
  );
}
