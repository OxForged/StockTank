import { Building2 } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { initials } from "@/lib/format";
import type { Company } from "@/types";

export function CompanyWidget({
  companies,
  className,
}: {
  companies: Company[];
  className?: string;
}) {
  return (
    <WidgetCard
      title="Companies to contact"
      icon={Building2}
      action={{ label: "All companies", href: "/companies" }}
      className={className}
    >
      <ul className="divide-y divide-border/60">
        {companies.map((company) => (
          <li
            key={company.id}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold">
              {initials(company.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{company.name}</p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {company.lastTouch}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {company.industry}
              </p>
              {company.reasonToContact && (
                <p className="mt-1 text-xs leading-snug text-foreground/75">
                  {company.reasonToContact}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
