"use client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import { useState } from "react";
import { Bell, Check, Key, MessageSquare, Search, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { saveSetting, savePrompt } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { PromptFile, SettingsPayload } from "@/types";

const KEY_FIELDS = [
  { key: "XAI_API_KEY", label: "xAI (Grok) key", hint: "Live X/Twitter search for gaming and web3 deals. About $5/month for a daily scan. Get it at docs.x.ai." },
  { key: "PERPLEXITY_API_KEY", label: "Perplexity key", hint: "Cited real-time news from the open web. Optional." },
  { key: "ANTHROPIC_API_KEY", label: "Claude key", hint: "Best writing quality for the employees you choose below." },
  { key: "TAVILY_API_KEY", label: "Tavily key", hint: "Free-tier web search backup. Optional." },
];

export function SettingsView({
  initial,
  initialPrompts,
}: {
  initial: SettingsPayload;
  initialPrompts: PromptFile[];
}) {
  const [data, setData] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const premiumEntry = data.settings.PREMIUM_AGENTS;
  const [premium, setPremium] = useState<string[]>(
    (premiumEntry && !premiumEntry.secret ? premiumEntry.value : "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const [prompts, setPrompts] = useState(initialPrompts);
  const [selectedPrompt, setSelectedPrompt] = useState(initialPrompts[0]?.name ?? "");
  const [promptBody, setPromptBody] = useState(initialPrompts[0]?.content ?? "");
  const [saved, setSaved] = useState<string | null>(null);

  const newsKeys = [
    { key: "NEWS_MOROCCO", label: "Morocco news", def: "5" },
    { key: "NEWS_MENA", label: "MENA news", def: "8" },
    { key: "NEWS_WEB3", label: "Web3 gaming news", def: "7" },
    { key: "NEWS_DRAMA", label: "World drama news", def: "3" },
  ];
  const xKeys = [
    { key: "X_COMPANY", label: "About company", def: "2" },
    { key: "X_MOROCCO", label: "Morocco market", def: "2" },
    { key: "X_MENA", label: "MENA market", def: "2" },
    { key: "X_WEB3", label: "Web3 gaming", def: "2" },
    { key: "X_DRAMA", label: "Esports drama", def: "2" },
  ];
  const liKeys = [
    { key: "LI_COMPANY", label: "About company", def: "2" },
    { key: "LI_MOROCCO", label: "Morocco market", def: "2" },
    { key: "LI_MENA", label: "MENA market", def: "2" },
    { key: "LI_WEB3", label: "Web3 gaming", def: "2" },
    { key: "LI_DRAMA", label: "Esports drama", def: "2" },
  ];
  const targetKeys = [...newsKeys, ...xKeys, ...liKeys];
  const readTarget = (key: string, def: string) => {
    const e = data.settings[key];
    return e && !e.secret ? e.value || def : def;
  };
  const [targets, setTargets] = useState<Record<string, string>>(() => {
    const t: Record<string, string> = {};
    targetKeys.forEach(({ key, def }) => (t[key] = readTarget(key, def)));
    return t;
  });

  const [grokTest, setGrokTest] = useState<string | null>(null);
  const [testingGrok, setTestingGrok] = useState(false);

  const testGrok = async () => {
    setTestingGrok(true);
    setGrokTest(null);
    try {
      const res = await fetch(`${API_URL}/settings/test-grok`, { method: "POST" });
      const data = await res.json();
      setGrokTest(data.message);
    } catch {
      setGrokTest("Could not reach the backend. Is it running?");
    } finally {
      setTestingGrok(false);
    }
  };

  const saveTarget = async (key: string, value: string) => {
    setTargets((prev) => ({ ...prev, [key]: value }));
    await saveSetting(key, value);
    flash("Daily target saved");
  };

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2000);
  };

  const saveKey = async (key: string) => {
    const value = drafts[key] ?? "";
    if (!value) return;
    await saveSetting(key, value);
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: { set: true, secret: true } },
      search: {
        ...prev.search,
        grok_x: key === "XAI_API_KEY" ? true : prev.search.grok_x,
        perplexity: key === "PERPLEXITY_API_KEY" ? true : prev.search.perplexity,
        tavily: key === "TAVILY_API_KEY" ? true : prev.search.tavily,
      },
    }));
    setDrafts((prev) => ({ ...prev, [key]: "" }));
    flash(`${key} saved`);
  };

  const togglePremium = async (name: string) => {
    const next = premium.includes(name)
      ? premium.filter((n) => n !== name)
      : [...premium, name];
    setPremium(next);
    await saveSetting("PREMIUM_AGENTS", next.join(","));
    flash("Premium employees updated");
  };

  const pickPrompt = (name: string) => {
    setSelectedPrompt(name);
    setPromptBody(prompts.find((p) => p.name === name)?.content ?? "");
  };

  const savePromptBody = async () => {
    const updated = await savePrompt(selectedPrompt, promptBody);
    setPrompts((prev) => prev.map((p) => (p.name === selectedPrompt ? updated : p)));
    flash(`${selectedPrompt} prompt saved`);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {saved && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success shadow-lg">
          <Check className="size-3.5" />
          {saved}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <Search className="size-4 text-primary" />
            Search power
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ProviderChip label="SearXNG (free)" on={data.search.searxng} />
            <ProviderChip label="Grok live X" on={data.search.grok_x} />
            <ProviderChip label="Perplexity news" on={data.search.perplexity} />
            <ProviderChip label="Tavily" on={data.search.tavily} />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            SearXNG is always free and tried first. Add a Grok key to search
            live X for gaming and web3 deals. Every paid run is capped so a bug
            can never run up your bill.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <Sparkles className="size-4 text-primary" />
            Test your Grok connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Runs one small live search and tells you exactly what happened. Use
            this after pasting your key, or any time news looks empty.
          </p>
          <Button size="sm" onClick={testGrok} disabled={testingGrok}>
            {testingGrok ? "Testing..." : "Test Grok now"}
          </Button>
          {grokTest && (
            <p className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs">
              {grokTest}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <Bell className="size-4 text-primary" />
            Phone alerts and follow up
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Get a message on your phone when a hot deal or big news lands. Free
            with Telegram. Make a bot with BotFather, paste the token and your
            chat id. Leave blank to skip.
          </p>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Telegram bot token</Label>
              <Input
                type="password"
                placeholder="from BotFather"
                defaultValue=""
                onBlur={(e) => e.target.value && saveSetting("TELEGRAM_BOT_TOKEN", e.target.value).then(() => flash("Alert settings saved"))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telegram chat id</Label>
              <Input
                placeholder="your chat id"
                defaultValue={(() => { const e = data.settings.TELEGRAM_CHAT_ID; return e && !e.secret ? e.value : ""; })()}
                onBlur={(e) => saveSetting("TELEGRAM_CHAT_ID", e.target.value).then(() => flash("Alert settings saved"))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Follow up after how many quiet days</Label>
              <Input
                type="number"
                min={1}
                max={60}
                defaultValue={(() => { const e = data.settings.FOLLOWUP_DAYS; return e && !e.secret ? e.value : "7"; })()}
                onBlur={(e) => saveSetting("FOLLOWUP_DAYS", e.target.value).then(() => flash("Follow up days saved"))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hunter.io key, finds real work emails</Label>
              <Input
                type="password"
                placeholder="free tier ~50 credits/month from hunter.io"
                defaultValue=""
                onBlur={(e) => e.target.value && saveSetting("HUNTER_API_KEY", e.target.value).then(() => flash("Hunter key saved"))}
              />
              <p className="text-[11px] text-muted-foreground">
                Free path always runs (website + patterns). Hunter is spent only
                on your hottest leads so 50 credits last the month.
              </p>
            </div>
            {data.hunter && (
              <div className="rounded-md border border-border/60 bg-secondary/30 p-3 space-y-2">
                <p className="text-xs font-semibold">
                  Hunter budget: {data.hunter.usedThisMonth}/{data.hunter.monthlyLimit} month
                  {" · "}
                  {data.hunter.usedToday}/{data.hunter.dailyLimit} today
                  {" · "}
                  {data.hunter.remainingMonth} left this month
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {data.hunter.planHint}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["HUNTER_MONTHLY_CREDITS", "Monthly credits", String(data.hunter.monthlyLimit)],
                      ["HUNTER_DAILY_CREDITS", "Max credits/day", String(data.hunter.dailyLimit)],
                      ["HUNTER_EMAILS_PER_COMPANY", "Paid emails/company", String(data.hunter.emailsPerCompanyPaid)],
                      ["HUNTER_COMPANIES_PER_DAY", "Paid companies/day", String(data.hunter.companiesPerDayPaid)],
                    ] as const
                  ).map(([key, label, def]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[10px]">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={500}
                        defaultValue={(() => {
                          const e = data.settings[key];
                          return e && !e.secret ? e.value || def : def;
                        })()}
                        onBlur={(e) =>
                          saveSetting(key, e.target.value).then(() =>
                            flash("Hunter budget saved — refresh page to update counter")
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Math tip: 50 credits ÷ 22 work days ≈ 2/day. With 1 paid email
                  per hot company and 2 companies/day you cover ~40–44 best BD
                  targets/month. Everyone else gets free email + LinkedIn nurture.
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">BD playbook — teach the OS</Label>
              <Textarea
                placeholder="Ex: Only Morocco/MENA brands. Never pitch banks in Ramadan. Prefer LinkedIn before email for corporates. Gold package default 35k MAD..."
                defaultValue={(() => {
                  const e = data.settings.BD_PLAYBOOK;
                  return e && !e.secret ? e.value : "";
                })()}
                rows={4}
                onBlur={(e) =>
                  saveSetting("BD_PLAYBOOK", e.target.value).then(() =>
                    flash("Playbook saved — the OS will keep this")
                  )
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Anything you teach here is remembered (ICP, tone, who not to
                contact, packages). Keep adding as you learn.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <Target className="size-4 text-primary" />
            Daily targets, you decide how much
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            You control every number. Set how many news stories per region, and
            how many posts per platform per topic. Set any to 0 on days you do
            not want it. Fewer numbers means a cheaper Grok bill. Deals always
            find the max possible, no limit.
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">News per region</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {newsKeys.map(({ key, label, def }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" min={0} max={30} value={targets[key] ?? def}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [key]: e.target.value }))}
                    onBlur={(e) => saveTarget(key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">X posts per topic</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {xKeys.map(({ key, label, def }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" min={0} max={20} value={targets[key] ?? def}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [key]: e.target.value }))}
                    onBlur={(e) => saveTarget(key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">LinkedIn posts per topic</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {liKeys.map(({ key, label, def }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" min={0} max={20} value={targets[key] ?? def}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [key]: e.target.value }))}
                    onBlur={(e) => saveTarget(key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <Key className="size-4 text-primary" />
            API keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {KEY_FIELDS.map((field) => {
            const entry = data.settings[field.key];
            const isSet = entry && entry.secret && entry.set;
            return (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{field.label}</Label>
                  {isSet && <Badge variant="success">Set</Badge>}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={isSet ? "Saved. Paste a new key to replace." : "Paste your key"}
                    value={drafts[field.key] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() => saveKey(field.key)}
                    disabled={!drafts[field.key]}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{field.hint}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <Sparkles className="size-4 text-primary" />
            Which employees use the paid Claude brain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Everyone else stays on free local Ollama. Best value: the ones that
            write things clients read.
          </p>
          <div className="flex flex-wrap gap-2">
            {data.agentNames.map((name) => (
              <button
                key={name}
                onClick={() => togglePremium(name)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                  premium.includes(name)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[13px]">
            <MessageSquare className="size-4 text-primary" />
            Edit how employees write
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NativeSelect value={selectedPrompt} onChange={(e) => pickPrompt(e.target.value)}>
            {prompts.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
          <Textarea
            className="min-h-64 font-mono text-xs"
            value={promptBody}
            onChange={(e) => setPromptBody(e.target.value)}
          />
          <Button onClick={savePromptBody}>Save prompt</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
        on ? "border-success/30 bg-success/10 text-success" : "border-border text-muted-foreground"
      )}
    >
      <span className={cn("size-1.5 rounded-full", on ? "bg-success" : "bg-muted-foreground/40")} />
      {label}
    </span>
  );
}
