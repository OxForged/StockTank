"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  Radar,
  Users,
} from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import {
  createContact,
  discoverCompanyPeople,
  getHunterCredits,
  type DiscoverPeopleResult,
  type HunterBudget,
} from "@/lib/api/client";
import type { Company, Contact } from "@/types";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

export function ReachPanel({
  company,
  initialContacts = [],
}: {
  company: Company;
  initialContacts?: Contact[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverPeopleResult | null>(null);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [credits, setCredits] = useState<HunterBudget | null>(null);
  const router = useRouter();

  // Show the credit count before you click, not after you paid.
  useEffect(() => {
    let alive = true;
    getHunterCredits()
      .then((c) => {
        if (alive) setCredits(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const runDiscover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await discoverCompanyPeople(company.id, true, 10);
      setResult(res);
      if (res.hunterBudget) setCredits(res.hunterBudget);
      // Map API contacts into Contact shape for local list
      setContacts(
        (res.contacts || []).map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          companyId: company.id,
          company: company.name,
          email: c.email ?? undefined,
          linkedin: c.linkedin ?? undefined,
          notes: c.notes ?? undefined,
        }))
      );
      // The backend may have found and saved the website. Pull the card fresh
      // so you see it without reloading the page yourself.
      if (!company.website && res.reach?.website) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discover failed");
    } finally {
      setLoading(false);
    }
  }, [company.id, company.name, company.website, router]);

  const reach = result?.reach;
  const emailValue = reach?.email.value || company.contactEmail || null;
  const linkedinUrl =
    reach?.linkedin.companyUrl || company.contactLinkedin || null;
  const liSearch =
    reach?.linkedin.peopleSearchUrl ||
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      `${company.name} partnerships OR marketing OR sponsorship`
    )}`;
  const xUrl = reach?.x.url || null;
  const xSearch =
    reach?.x.searchUrl ||
    `https://x.com/search?q=${encodeURIComponent(
      `${company.name} (partnership OR sponsor OR gaming)`
    )}&f=live`;

  const paths = [
    {
      key: "email",
      title: "1 · Email",
      subtitle: emailValue
        ? `${emailValue}${reach?.email.status ? ` · ${reach.email.status}` : ""}`
        : company.website
          ? "No email yet — press Find people"
          : "Add a website first",
      href: emailValue ? `mailto:${emailValue}` : undefined,
      icon: Mail,
      ready: Boolean(emailValue),
    },
    {
      key: "linkedin",
      title: "2 · LinkedIn",
      subtitle: linkedinUrl
        ? "Company page + people search"
        : "People search for partnerships / marketing",
      href: linkedinUrl || liSearch,
      secondaryHref: linkedinUrl ? liSearch : undefined,
      secondaryLabel: "Find people",
      icon: Link2,
      ready: true,
    },
    {
      key: "x",
      title: "3 · X / Twitter",
      subtitle: xUrl
        ? `@${reach?.x.handle || "brand"}`
        : "Search recent posts about this brand",
      href: xUrl || xSearch,
      icon: XIcon,
      ready: true,
    },
  ] as const;

  const people = result?.people ?? [];

  const savePerson = async (p: DiscoverPeopleResult["people"][number]) => {
    const key = p.email || p.name;
    setSavingId(key);
    try {
      const created = await createContact({
        name: p.name,
        role: p.role || "Contact",
        companyId: company.id,
        company: company.name,
        email: p.email ?? undefined,
        linkedin: p.linkedin ?? company.contactLinkedin ?? undefined,
        notes: `Saved from discover · ${p.source}`,
      });
      setContacts((prev) => {
        if (prev.some((c) => c.id === created.id || (c.email && c.email === created.email))) {
          return prev;
        }
        return [...prev, created];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save contact");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <WidgetCard title="Reach them, 3 ways" icon={Radar}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Email, LinkedIn, and X. Pick a path and engage. Find people and emails
          pulls public team contacts and saves them here.
        </p>
        <p className="text-[11px] text-muted-foreground">
          With Hunter connected, that button costs 1 credit, and that one credit
          returns up to 10 emails from this company. Plan my day never spends a
          credit, it only makes free guesses. You choose who is worth a credit.
        </p>

        {credits && (
          <div className="rounded-md border border-border/60 bg-secondary/20 px-2.5 py-2">
            {credits.keySet ? (
              <>
                <p className="text-[11px] font-medium">
                  Hunter credits, {credits.remainingMonth} of{" "}
                  {credits.monthlyLimit} left this month
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${
                        credits.monthlyLimit > 0
                          ? Math.round(
                              (credits.remainingMonth / credits.monthlyLimit) *
                                100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  That is up to{" "}
                  {credits.remainingMonth * credits.emailsPerCompanyPaid} emails
                  left. Today, {credits.remainingToday} of {credits.dailyLimit}{" "}
                  still available.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No Hunter key yet. Free guesses and LinkedIn still work. Add the
                key in Settings for real emails.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-2">
          {paths.map((path) => {
            const Icon = path.icon;
            return (
              <div
                key={path.key}
                className={`rounded-lg border p-3 ${
                  path.ready
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/60 bg-secondary/20"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-background">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{path.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {path.subtitle}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {path.href ? (
                        <a
                          href={path.href}
                          target={path.key === "email" ? undefined : "_blank"}
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Open
                          <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                      {"secondaryHref" in path && path.secondaryHref ? (
                        <a
                          href={path.secondaryHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-accent"
                        >
                          {path.secondaryLabel}
                          <Users className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {company.sourceUrl && (
          <a
            href={company.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open the deal signal they published
            <ExternalLink className="size-3" />
          </a>
        )}

        <button
          type="button"
          onClick={runDiscover}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Finding people and emails…
            </>
          ) : (
            <>
              <Users className="size-3.5" />
              Find people and emails
            </>
          )}
        </button>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {result && (
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {result.savedCount > 0
                ? `Saved ${result.savedCount} contact${result.savedCount === 1 ? "" : "s"}.`
                : "Nothing new was saved."}
              {result.domain
                ? ` Domain, ${result.domain}.`
                : " No website on this company, add one above to unlock email find."}
            </p>
            {result.message && (
              <p className="text-[11px] font-medium text-primary">
                {result.message}
              </p>
            )}
          </div>
        )}

        {people.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              Related people at this company
            </p>
            <ul className="divide-y divide-border/60 rounded-md border border-border/60">
              {people.map((p) => (
                <li
                  key={`${p.name}-${p.email || "x"}`}
                  className="flex items-center gap-2 px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.role}
                      {p.email ? ` · ${p.email}` : ""}
                    </p>
                  </div>
                  {p.email && (
                    <a
                      href={`mailto:${p.email}`}
                      className="grid size-7 place-items-center rounded-md hover:bg-accent"
                      title="Email"
                    >
                      <Mail className="size-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={savingId === (p.email || p.name)}
                    onClick={() => savePerson(p)}
                    className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-accent disabled:opacity-50"
                  >
                    Save
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {contacts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">
              Saved contacts ({contacts.length})
            </p>
            <ul className="space-y-1">
              {contacts.slice(0, 6).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate font-medium">
                    {c.name}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {c.role}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-primary hover:underline"
                      >
                        mail
                      </a>
                    )}
                    {c.linkedin && (
                      <a
                        href={c.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        LI
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
