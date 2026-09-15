import { cn } from "@/lib/utils";
import type { ContentPlatform } from "@/types";

const platformMeta: Record<ContentPlatform, { label: string; className: string }> = {
  linkedin: { label: "in", className: "bg-[#0a66c2]/20 text-[#6ab1f7]" },
  x: { label: "X", className: "bg-foreground/10 text-foreground" },
  instagram: { label: "IG", className: "bg-[#e1306c]/15 text-[#f472a5]" },
};

export function PlatformChip({
  platform,
  className,
}: {
  platform: ContentPlatform;
  className?: string;
}) {
  const meta = platformMeta[platform];
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md text-[11px] font-bold",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
