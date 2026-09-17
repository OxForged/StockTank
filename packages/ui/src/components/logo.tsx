import type { HTMLAttributes, SVGProps } from 'react';
import { useId } from 'react';

import { cn } from '../lib/cn.js';

/* -------------------------------------------------------------------------- */
/* LogoMark: hexagonal "S" with rising bars and an arrow.                      */
/* -------------------------------------------------------------------------- */

export interface LogoMarkProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Pixel size (width and height). */
  size?: number;
  /** `brand` = green/white S; `mono` = currentColor; `flat` = solid green tile. */
  tone?: 'brand' | 'mono' | 'flat';
  /** Decorative by default; set a title for standalone use. */
  title?: string;
}

/**
 * The StockTank mark. The upper-left arm of the hexagon is emerald, the lower-right arm is the
 * text colour (white in dark mode, near-black in light mode), and three rising bars with an arrow
 * sit in the negative space.
 */
export function LogoMark({ size = 32, tone = 'brand', title, className, ...props }: LogoMarkProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `st-mark-grad-${uid}`;
  const barsId = `st-mark-bars-${uid}`;
  const green = tone === 'mono' ? 'currentColor' : `url(#${gradId})`;
  const light = tone === 'flat' ? 'var(--st-on-primary)' : tone === 'mono' ? 'currentColor' : 'var(--st-text)';
  const bars = tone === 'flat' ? 'var(--st-on-primary)' : tone === 'mono' ? 'currentColor' : `url(#${barsId})`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0', className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--st-primary-hi)" />
          <stop offset="1" stopColor="var(--st-primary)" />
        </linearGradient>
        <linearGradient id={barsId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--st-primary)" />
          <stop offset="1" stopColor="var(--st-primary-hi)" />
        </linearGradient>
      </defs>
      {tone === 'flat' ? <path d="M50 2 92 26v48L50 98 8 74V26Z" fill={green} /> : null}
      {/* Upper-left arm of the S (green) */}
      <path
        d="M84 22.5 50 3 12 24.8v33.4h11V31.2L50 15.7l28.4 16.3Z"
        fill={tone === 'flat' ? light : green}
      />
      {/* Lower-right arm of the S (text colour) */}
      <path d="M16 77.5 50 97l38-21.8V41.8H77v27L50 84.3 21.6 68Z" fill={light} />
      {/* Rising bars */}
      <rect x="35" y="56" width="8" height="18" rx="1.2" fill={bars} />
      <rect x="46" y="46" width="8" height="28" rx="1.2" fill={bars} />
      <rect x="57" y="36" width="8" height="38" rx="1.2" fill={bars} />
      {/* Arrow head over the tallest bar */}
      <path d="M52 34.5 61 24l9 10.5Z" fill={bars} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Wordmark: STOCK (text colour) + TANK (green), Exo 2 heavy italic.           */
/* -------------------------------------------------------------------------- */

export interface WordmarkProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Show "ON-CHAIN STOCKS & CRYPTO" under the wordmark. */
  tagline?: boolean;
  /** Prepend the LogoMark. */
  mark?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  /** Custom accessible label (defaults to the brand + tagline). */
  label?: string;
}

const wordSize = {
  sm: { text: 'text-[1.125rem]', mark: 22, tag: 'text-[0.5rem] tracking-[0.28em] mt-0.5', gap: 'gap-2' },
  md: { text: 'text-[1.5rem]', mark: 30, tag: 'text-[0.6rem] tracking-[0.3em] mt-1', gap: 'gap-2.5' },
  lg: { text: 'text-[2.25rem]', mark: 44, tag: 'text-[0.72rem] tracking-[0.32em] mt-1.5', gap: 'gap-3' },
  xl: { text: 'text-[3.5rem]', mark: 64, tag: 'text-[0.95rem] tracking-[0.34em] mt-2', gap: 'gap-4' },
  hero: {
    text: 'text-[clamp(3rem,11vw,7.5rem)]',
    mark: 0,
    tag: 'text-[clamp(0.7rem,2vw,1.35rem)] tracking-[0.36em] mt-3',
    gap: 'gap-5',
  },
} as const;

export function Wordmark({ tagline = false, mark = false, size = 'md', label, className, ...props }: WordmarkProps) {
  const s = wordSize[size];
  const aria = label ?? (tagline ? 'StockTank — On-chain stocks & crypto' : 'StockTank');
  return (
    <span
      role="img"
      aria-label={aria}
      className={cn('inline-flex items-center', s.gap, className)}
      {...props}
    >
      {mark && s.mark > 0 ? <LogoMark size={s.mark} /> : null}
      <span className="flex flex-col leading-none" aria-hidden="true">
        <span
          className={cn(
            'relative inline-flex select-none items-baseline font-display font-black italic uppercase leading-[0.9] tracking-[-0.045em]',
            s.text,
          )}
        >
          <span className="text-fg">Stock</span>
          <span className="text-gradient-primary pr-[0.06em]">Tank</span>
          {/* small rising arrow accent, echoing the mark */}
          <svg
            viewBox="0 0 24 24"
            className="absolute -right-[0.05em] -top-[0.32em] h-[0.42em] w-[0.42em] text-primary-hi"
            aria-hidden="true"
          >
            <path d="M3 20 14 9h-5V5h11v11h-4v-5L6 22Z" fill="currentColor" />
          </svg>
        </span>
        {tagline ? (
          <span className={cn('font-sans font-medium uppercase text-muted whitespace-nowrap', s.tag)}>
            On-chain stocks &amp; crypto
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Mark + wordmark lockup, the default masthead logo. */
export function Logo({ size = 'md', ...props }: WordmarkProps) {
  return <Wordmark mark size={size} {...props} />;
}
