import type { BadgeProps } from '@stocktank/ui';

export function formatMoney(cents: number | null, currency = 'USD'): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

/** Parses a user-typed amount ("1,250.50") into integer cents, or null when blank/invalid. */
export function parseMoneyToCents(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

export const PRICING_LABEL = {
  cpm: 'CPM',
  flat_week: 'Flat / week',
  flat_episode: 'Flat / episode',
  flat_issue: 'Flat / issue',
} as const;

type Variant = NonNullable<BadgeProps['variant']>;

export const CAMPAIGN_STATUS_VARIANT: Record<string, Variant> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'primary',
  rejected: 'danger',
  paused: 'info',
  completed: 'outline',
};

export const REVIEW_STATUS_VARIANT: Record<string, Variant> = {
  draft: 'neutral',
  review: 'warning',
  approved: 'primary',
  rejected: 'danger',
  published: 'primary',
  archived: 'outline',
};

export const ADVERTISER_STATUS_VARIANT: Record<string, Variant> = {
  pending_review: 'warning',
  approved: 'primary',
  suspended: 'danger',
};

export const INQUIRY_STATUS_VARIANT: Record<string, Variant> = {
  new: 'warning',
  contacted: 'info',
  qualified: 'primary',
  proposal_sent: 'primary',
  won: 'solid',
  lost: 'neutral',
  spam: 'danger',
};

export const POLICY_FLAG_LABEL: Record<string, string> = {
  guaranteed_returns: 'Guaranteed returns',
  risk_free_claim: 'Risk-free claim',
  multiplier_hype: 'Multiplier hype (e.g. “100x”)',
  get_rich_claim: 'Get-rich claim',
  return_percentage_claim: 'Return percentage claim',
  price_prediction: 'Price prediction',
  urgency_pressure: 'Urgency / pressure',
  endorsement_claim: 'Implied StockTank endorsement',
};

export const humanize = (s: string) => s.replace(/_/g, ' ');
