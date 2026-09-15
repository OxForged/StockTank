import { CheckCircle2 } from "lucide-react";
import { ContentStatusBadge } from "@/components/shared/ContentStatusBadge";
import { PlatformChip } from "@/components/shared/PlatformChip";
import { WidgetCard } from "@/components/shared/WidgetCard";
import type { ContentItem } from "@/types";

export function ContentApprovalWidget({
  items,
  className,
}: {
  items: ContentItem[];
  className?: string;
}) {
  return (
    <WidgetCard
      title="Content waiting approval"
      icon={CheckCircle2}
      action={{ label: "Studio", href: "/content" }}
      className={className}
    >
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          Nothing waiting — the queue is clear.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <PlatformChip platform={item.platform} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm leading-snug">{item.title}</p>
                {item.scheduledFor && (
                  <p className="text-[11px] text-muted-foreground">
                    Scheduled {item.scheduledFor}
                  </p>
                )}
              </div>
              <ContentStatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
