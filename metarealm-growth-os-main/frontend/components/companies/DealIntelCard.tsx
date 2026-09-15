"use client";

import { useEffect, useState } from "react";
import { ExternalLink, PencilLine, Search } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import {
  findCompanyEmail,
  getHunterCredits,
  guessCompanyEmails,
  updateCompany,
  type HunterBudget,
} from "@/lib/api/client";
import type { Company } from "@/types";

const FIELDS: { key: keyof Company & string; label: string; area?: boolean }[] = [
  { key: "reasonToContact", label: "Why contact now", area: true },
  { key: "details", label: "Details, the signal and your notes", area: true },
  { key: "contactPerson", label: "Contact person" },
  { key: "contactEmail", label: "Email" },
  { key: "contactLinkedin", label: "LinkedIn URL" },
  { key: "website", label: "Website" },
];

export function DealIntelCard({ company }: { company: Company }) {
  const [saved, setSaved] = useState(false);
  const [finding, setFinding] = useState(false);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [verified, setVerified] = useState<string | null>(null);
  const [team, setTeam] = useState<
    { email: string; name: string; position: string }[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);
  const [credits, setCredits] = useState<HunterBudget | null>(null);

  // Know the cost before you click, not after.
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

  const save = async (key: string, value: string) => {
    const snake = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    try {
      await updateCompany(company.id, { [snake]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (error) {
      console.error(error);
      setMessage("Could not save — check the value.");
    }
  };

  const findEmails = async () => {
    setFinding(true);
    setGuesses([]);
    setVerified(null);
    setTeam([]);
    setMessage(null);
    try {
      // Domain-level find always runs when a website exists
      if (company.website) {
        const found = await findCompanyEmail(company.id);
        if (found.email) {
          setGuesses((prev) =>
            Array.from(new Set([found.email!, ...(found.candidates ?? []), ...prev]))
          );
        } else if (found.message) {
          setMessage(found.message);
        }
      }

      const person =
        company.contactPerson?.trim() ||
        (team[0]?.name ?? "Partnerships Team");
      const res = await guessCompanyEmails(
        company.id,
        company.contactPerson?.trim() || person,
        company.website
      );
      setGuesses((prev) =>
        Array.from(
          new Set([
            ...prev,
            ...(res.candidates ?? []),
            ...(res.generic ?? []),
          ])
        ).slice(0, 8)
      );
      setVerified(res.verified?.email ?? null);
      setTeam(res.team ?? []);
      if (res.hunterBudget) setCredits(res.hunterBudget);
      // The backend now says exactly what happened and why. Trust it.
      if (res.message) {
        setMessage(res.message);
      } else if (!company.website) {
        setMessage("Add their website above, then try again.");
      } else if (!(res.team?.length || res.candidates?.length || res.generic?.length)) {
        setMessage("No public emails found. Use LinkedIn or X from Reach them.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Email lookup failed. Is the API running?");
    } finally {
      setFinding(false);
    }
  };

  return (
    <WidgetCard title="Deal intel, edit anything" icon={PencilLine}>
      <div className="space-y-3">
        {FIELDS.map(({ key, label, area }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            {area ? (
              <textarea
                defaultValue={(company[key] as string) ?? ""}
                onBlur={(e) => save(key, e.target.value)}
                rows={3}
                placeholder="Write anything, it saves when you click away."
                className="w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60"
              />
            ) : (
              <input
                defaultValue={(company[key] as string) ?? ""}
                onBlur={(e) => save(key, e.target.value)}
                placeholder="Add it if you find it"
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/60"
              />
            )}
          </div>
        ))}

        <div className="rounded-lg border border-border/60 p-3">
          <button
            type="button"
            onClick={findEmails}
            disabled={finding}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            <Search className="size-3.5" />
            {finding
              ? "Looking…"
              : company.contactPerson
                ? "Find emails for this contact and team"
                : "Find team emails"}
          </button>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Costs 1 Hunter credit. That one credit returns up to 10 emails from
            this company. Plan my day never spends a credit, only this button
            does, so you choose the companies worth paying for.
          </p>
          {credits && (
            <p className="mt-1 text-[11px] font-medium">
              {credits.keySet
                ? `Credits, ${credits.remainingMonth} of ${credits.monthlyLimit} left this month, ${credits.remainingToday} of ${credits.dailyLimit} left today.`
                : "No Hunter key yet. Add it in Settings. Free guesses still work."}
            </p>
          )}
          {!company.contactPerson && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Person name optional. With a website, we still pull brand and team
              addresses.
            </p>
          )}
          {message && (
            <p className="mt-1 text-[11px] text-muted-foreground">{message}</p>
          )}
          {verified && (
            <button
              type="button"
              onClick={() => save("contactEmail", verified)}
              className="mt-2 block w-full truncate rounded bg-primary/10 px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/20"
              title="Hunter verified, click to save"
            >
              {verified} (Hunter verified)
            </button>
          )}
          {team.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">
                Public contacts at this brand — click to save as company email:
              </p>
              {team.map((t) => (
                <button
                  type="button"
                  key={t.email}
                  onClick={() => save("contactEmail", t.email)}
                  className="block w-full truncate rounded bg-secondary/50 px-2 py-1 text-left text-xs hover:bg-secondary"
                  title="Click to save"
                >
                  {t.name ? `${t.name} · ` : ""}
                  {t.email}
                  {t.position ? ` · ${t.position}` : ""}
                </button>
              ))}
            </div>
          )}
          {guesses.length > 0 && (
            <div className="mt-2 space-y-1">
              {guesses.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => save("contactEmail", g)}
                  className="block w-full truncate rounded bg-secondary/50 px-2 py-1 text-left text-xs hover:bg-secondary"
                  title="Click to save as the contact email"
                >
                  {g}
                </button>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Click one to save. Prefer Hunter-verified when you have it.
              </p>
            </div>
          )}
        </div>

        {company.sourceUrl && (
          <a
            href={company.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            Open what they published
            <ExternalLink className="size-3" />
          </a>
        )}
        {saved && <p className="text-xs text-primary">Saved.</p>}
      </div>
    </WidgetCard>
  );
}
