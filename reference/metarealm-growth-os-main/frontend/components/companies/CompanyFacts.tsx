import { ExternalLink, Info, Link2, Mail } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { formatMad } from "@/lib/format";
import type { Company } from "@/types";

function hrefForWebsite(website: string): string {
  const w = website.trim();
  if (!w) return "#";
  return w.startsWith("http://") || w.startsWith("https://") ? w : `https://${w}`;
}

function displayHost(website: string): string {
  return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function CompanyFacts({
  company,
  openValueMad,
}: {
  company: Company;
  openValueMad: number;
}) {
  return (
    <WidgetCard title="Details" icon={Info}>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge status={company.status} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Industry</dt>
          <dd className="text-right">{company.industry}</dd>
        </div>
        {company.location && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="text-right">{company.location}</dd>
          </div>
        )}
        {company.website && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Website</dt>
            <dd>
              <a
                href={hrefForWebsite(company.website)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                {displayHost(company.website)}
                <ExternalLink className="size-3" />
              </a>
            </dd>
          </div>
        )}
        {company.contactPerson && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Person</dt>
            <dd className="text-right font-medium">{company.contactPerson}</dd>
          </div>
        )}
        {company.contactEmail && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Email</dt>
            <dd>
              <a
                href={`mailto:${company.contactEmail}`}
                className="inline-flex max-w-[14rem] items-center gap-1 truncate transition-colors hover:text-foreground"
                title={company.contactEmail}
              >
                <Mail className="size-3 shrink-0" />
                <span className="truncate">{company.contactEmail}</span>
              </a>
            </dd>
          </div>
        )}
        {company.contactLinkedin && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">LinkedIn</dt>
            <dd>
              <a
                href={company.contactLinkedin}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <Link2 className="size-3" />
                Open
                <ExternalLink className="size-3" />
              </a>
            </dd>
          </div>
        )}
        {company.lastTouch && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Last touch</dt>
            <dd className="text-right text-muted-foreground">
              {company.lastTouch}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Open pipeline</dt>
          <dd className="font-mono tabular-nums">{formatMad(openValueMad)}</dd>
        </div>
      </dl>
    </WidgetCard>
  );
}
