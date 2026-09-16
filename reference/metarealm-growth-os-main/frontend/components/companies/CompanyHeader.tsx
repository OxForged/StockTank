import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { initials } from "@/lib/format";
import type { Company } from "@/types";

export function CompanyHeader({ company }: { company: Company }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-secondary text-base font-semibold">
        {initials(company.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-2xl font-semibold tracking-tight">
            {company.name}
          </h2>
          <StatusBadge status={company.status} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {company.industry}
          {company.location ? ` · ${company.location}` : ""}
        </p>
      </div>
      {company.website && (
        <a
          href={`https://${company.website}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {company.website}
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}
