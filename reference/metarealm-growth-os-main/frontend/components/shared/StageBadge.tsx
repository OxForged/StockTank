import { type VariantProps } from "class-variance-authority";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { STAGE_LABELS } from "@/lib/stages";
import type { OpportunityStage } from "@/types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const stageVariant: Record<OpportunityStage, BadgeVariant> = {
  lead: "outline",
  contacted: "secondary",
  meeting: "info",
  proposal: "warning",
  negotiation: "soft",
  closed_won: "success",
  closed_lost: "destructive",
};

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  return <Badge variant={stageVariant[stage]}>{STAGE_LABELS[stage]}</Badge>;
}
