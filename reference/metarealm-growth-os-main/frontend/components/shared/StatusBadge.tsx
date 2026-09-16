import { type VariantProps } from "class-variance-authority";
import { Badge, badgeVariants } from "@/components/ui/badge";
import type { CompanyStatus } from "@/types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const statusMeta: Record<CompanyStatus, { label: string; variant: BadgeVariant }> = {
  prospect: { label: "Prospect", variant: "outline" },
  in_talks: { label: "In talks", variant: "info" },
  active_partner: { label: "Active partner", variant: "success" },
  past_partner: { label: "Past partner", variant: "secondary" },
};

export function StatusBadge({ status }: { status: CompanyStatus }) {
  const meta = statusMeta[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
