import { type VariantProps } from "class-variance-authority";
import { Badge, badgeVariants } from "@/components/ui/badge";
import type { ContentStatus } from "@/types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const statusMeta: Record<ContentStatus, { label: string; variant: BadgeVariant }> = {
  awaiting_approval: { label: "Approval", variant: "warning" },
  draft: { label: "Draft", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "info" },
  published: { label: "Published", variant: "success" },
};

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const meta = statusMeta[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
