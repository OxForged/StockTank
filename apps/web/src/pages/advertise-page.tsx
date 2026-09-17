import { ApiClientError } from '@stocktank/api-client';
import { advertisingInquiryRequestSchema, type AdvertisingInquiryRequest, type BudgetRange, type MediaKitPlacement, type PlacementKey } from '@stocktank/types';
import { Badge, Button, FormField, Input, Skeleton, Textarea, cn } from '@stocktank/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, Eye, Headphones, Mail, Scale, ShieldCheck, Tv, Video } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { api } from '../lib/api';
import { getAttribution } from '../lib/attribution';
import { validate, type FieldErrors } from '../lib/forms';
import { useDocumentTitle } from '../lib/seo';

const SURFACE_ICON = { web: Tv, newsletter: Mail, audio: Headphones, video: Video } as const;
const SURFACE_LABEL = { web: 'Web', newsletter: 'Newsletter', audio: 'Audio', video: 'Video' } as const;
const PRICING_LABEL = { cpm: 'per 1,000 impressions', flat_week: 'per week', flat_episode: 'per episode', flat_issue: 'per issue' } as const;

const BUDGETS: Array<{ value: BudgetRange; label: string }> = [
  { value: 'under_5k', label: 'Under $5k' },
  { value: 'from_5k_to_25k', label: '$5k–$25k' },
  { value: 'from_25k_to_100k', label: '$25k–$100k' },
  { value: 'over_100k', label: 'Over $100k' },
  { value: 'undisclosed', label: 'Prefer not to say' },
];

const STANDARDS = [
  { icon: Eye, title: 'Always disclosed', body: 'Every paid placement is labelled Sponsored, Paid partnership, Presented by or Advertisement. Host reads are disclosed on air.' },
  { icon: ShieldCheck, title: 'Editor-reviewed', body: 'Sales cannot publish ads. An editor reviews every advertiser, campaign and creative before it runs, and can reject or pause it.' },
  { icon: Scale, title: 'No unsupported financial claims', body: 'We do not run ads promising returns, “risk-free” yields, price predictions or implied StockTank endorsement. Copy is scanned and flagged for review.' },
  { icon: BadgeCheck, title: 'Editorial independence', body: 'Sponsors never influence coverage, questions or verdicts. Sponsorships of a show are credited, not written into it.' },
];

function formatRate(p: MediaKitPlacement): string {
  if (p.rateCents === null) return 'Rates on request';
  const amount = new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.rateCents / 100);
  return `${amount} ${PRICING_LABEL[p.pricingModel]}`;
}

function PlacementCard({ placement, selected, onToggle }: { placement: MediaKitPlacement; selected: boolean; onToggle: () => void }) {
  const Icon = SURFACE_ICON[placement.surface];
  return (
    <li className={cn('flex flex-col gap-3 rounded-2xl border bg-surface p-5 transition-colors', selected ? 'border-primary' : 'border-hairline')}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-primary-hi">
          <Icon className="size-4" aria-hidden="true" />
          {SURFACE_LABEL[placement.surface].toUpperCase()}
        </span>
        <span className="font-mono text-[11px] text-muted">{formatRate(placement)}</span>
      </div>
      <h3 className="font-display text-lg font-bold">{placement.name}</h3>
      <p className="text-sm text-muted">{placement.description}</p>
      <p className="rounded-lg bg-raised p-3 text-xs text-muted">
        <span className="font-semibold text-fg">Specs.</span> {placement.specs}
      </p>
      <label className="mt-auto flex items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 accent-[var(--st-primary)]" />
        Interested in this placement
      </label>
    </li>
  );
}

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 429) return 'Too many inquiries from this network. Please try again later or email us.';
    if (err.code === 'VALIDATION_FAILED') return 'Please check the highlighted fields.';
    if (err.status === 0) return 'Network error. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

/** Advertise with StockTank: media kit (from the rate card) + inbound lead form. */
export function AdvertisePage() {
  useDocumentTitle('Advertise');
  const kit = useQuery({ queryKey: ['media-kit'], queryFn: () => api.ads.mediaKit() });
  const [selected, setSelected] = useState<PlacementKey[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submit = useMutation({ mutationFn: (input: AdvertisingInquiryRequest) => api.marketing.submitInquiry(input) });

  const toggle = (key: PlacementKey) => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const data = new FormData(e.currentTarget);
    const { utm, referrer } = getAttribution();
    const website = String(data.get('website') ?? '').trim();
    const input = {
      company: String(data.get('company') ?? ''),
      contactName: String(data.get('contactName') ?? ''),
      email: String(data.get('email') ?? '').trim(),
      ...(website ? { website: /^https?:\/\//i.test(website) ? website : `https://${website}` } : {}),
      budgetRange: String(data.get('budgetRange') ?? ''),
      placementKeys: selected,
      message: String(data.get('message') ?? ''),
      consent: data.get('consent') === 'on',
      ...(data.get('companyFax') ? { companyFax: String(data.get('companyFax')) } : {}),
      ...(utm ? { utm } : {}),
      ...(referrer ? { referrer } : {}),
    };
    const result = validate(advertisingInquiryRequestSchema, input);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    submit.mutate(result.data, { onError: (err) => setFormError(describeError(err)) });
  }

  return (
    <>
      <header className="relative overflow-hidden border-b border-hairline px-4 py-12 md:px-8 md:py-16">
        <div aria-hidden="true" className="bg-desk-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">ADVERTISE WITH STOCKTANK</span>
            <h1 className="font-display text-5xl font-black italic leading-[0.98] tracking-tight md:text-7xl">
              Put your brand in front of on-chain markets.
            </h1>
            <p className="max-w-2xl text-lg text-muted">
              Sponsor shows, the live desk, the newsletter and clips across a media network built for tokenized stocks and
              crypto. Every placement is disclosed, editor-reviewed and measured with first-party tracking.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="#inquiry">Talk to sales</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#formats">See formats</a>
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['Formats', kit.data ? String(kit.data.placements.length) : '—'],
              ['Surfaces', 'Web · Audio · Video · Email'],
              ['Measurement', 'Viewable impressions & clicks'],
              ['Review', 'Human approval on every ad'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-hairline bg-surface/80 p-4">
                <dt className="font-mono text-[11px] tracking-[0.12em] text-muted">{k!.toUpperCase()}</dt>
                <dd className="mt-1 font-display text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <section aria-labelledby="formats-h" id="formats" className="flex scroll-mt-40 flex-col gap-6 px-4 py-12 md:px-8">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">MEDIA KIT</span>
          <h2 id="formats-h" className="font-display text-3xl font-extrabold md:text-4xl">
            Formats
          </h2>
          <p className="max-w-3xl text-muted">
            Audience figures are published here once measured by our analytics; we do not quote numbers we cannot verify.
            Tick the formats you are interested in and they are added to your inquiry.
          </p>
          {kit.data && !kit.data.advertisingLive ? (
            <Badge variant="mono" className="self-start">
              BOOKING NOW FOR LAUNCH
            </Badge>
          ) : null}
        </div>
        {kit.isError ? (
          <p role="alert" className="text-sm text-danger">
            The media kit could not be loaded. You can still send an inquiry below.
          </p>
        ) : null}
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kit.isPending
            ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
            : (kit.data?.placements ?? []).map((p) => (
                <PlacementCard key={p.key} placement={p} selected={selected.includes(p.key)} onToggle={() => toggle(p.key)} />
              ))}
        </ul>
      </section>

      <section aria-labelledby="standards-h" className="border-y border-hairline bg-surface/50 px-4 py-12 md:px-8">
        <h2 id="standards-h" className="font-display text-3xl font-extrabold md:text-4xl">
          Advertising standards
        </h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STANDARDS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface p-5">
              <Icon className="size-6 text-primary-hi" aria-hidden="true" />
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Full policy: <Link to="/legal/advertising-disclosure" className="underline hover:text-fg">Advertising disclosure</Link>.
        </p>
      </section>

      <section aria-labelledby="inquiry-h" id="inquiry" className="grid scroll-mt-40 gap-10 px-4 py-12 md:px-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">TALK TO SALES</span>
          <h2 id="inquiry-h" className="font-display text-3xl font-extrabold md:text-4xl">
            Start a campaign
          </h2>
          <p className="text-muted">
            Tell us about your brand and goals. A member of the sales team replies with availability, rates and the review
            timeline. Selected formats: {selected.length === 0 ? 'none yet' : selected.length}.
          </p>
        </div>

        {submit.isSuccess ? (
          <div role="status" className="flex items-start gap-3 self-start rounded-2xl border border-primary/40 bg-primary-soft p-6">
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary-hi" aria-hidden="true" />
            <div>
              <p className="font-display text-xl font-bold">Thanks, we have your inquiry.</p>
              <p className="mt-1 text-sm text-muted">The sales team will reply by email. Nothing runs until an editor approves it.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-2xl border border-hairline bg-surface p-6 sm:grid-cols-2">
            {formError ? (
              <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger sm:col-span-2">
                {formError}
              </p>
            ) : null}
            <FormField label="Company" htmlFor="inq-company" error={errors.company} required>
              {({ id, describedBy, invalid }) => <Input id={id} name="company" autoComplete="organization" aria-describedby={describedBy} invalid={invalid} required />}
            </FormField>
            <FormField label="Your name" htmlFor="inq-name" error={errors.contactName} required>
              {({ id, describedBy, invalid }) => <Input id={id} name="contactName" autoComplete="name" aria-describedby={describedBy} invalid={invalid} required />}
            </FormField>
            <FormField label="Work email" htmlFor="inq-email" error={errors.email} required>
              {({ id, describedBy, invalid }) => <Input id={id} name="email" type="email" autoComplete="email" aria-describedby={describedBy} invalid={invalid} required />}
            </FormField>
            <FormField label="Website" htmlFor="inq-website" error={errors.website}>
              {({ id, describedBy, invalid }) => <Input id={id} name="website" inputMode="url" placeholder="example.com" aria-describedby={describedBy} invalid={invalid} />}
            </FormField>
            <FormField label="Budget" htmlFor="inq-budget" error={errors.budgetRange} required className="sm:col-span-2">
              {({ id, describedBy, invalid }) => (
                <select
                  id={id}
                  name="budgetRange"
                  defaultValue=""
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  className="h-11 rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none"
                >
                  <option value="" disabled>
                    Select a range
                  </option>
                  {BUDGETS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Goals and timing" htmlFor="inq-message" error={errors.message} required className="sm:col-span-2">
              {({ id, describedBy, invalid }) => (
                <Textarea id={id} name="message" rows={5} placeholder="What are you launching, who do you want to reach, and when?" aria-describedby={describedBy} invalid={invalid} required />
              )}
            </FormField>
            <input type="text" name="companyFax" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />
            <label className="flex items-start gap-2.5 text-sm text-muted sm:col-span-2">
              <input name="consent" type="checkbox" className="mt-0.5 size-4 accent-[var(--st-primary)]" aria-invalid={Boolean(errors.consent)} />
              <span>
                StockTank may contact me about advertising. See the <Link to="/legal/privacy" className="underline hover:text-fg">privacy policy</Link>.
                {errors.consent ? <span className="mt-1 block text-danger">Please confirm so we can reply.</span> : null}
              </span>
            </label>
            <Button type="submit" size="lg" loading={submit.isPending} className="sm:col-span-2">
              Send inquiry
            </Button>
          </form>
        )}
      </section>
    </>
  );
}
