import { Reveal } from '@stocktank/ui';

import { socialChannels, type SocialChannel } from '../../lib/social';

function BrandIcon({ channel, className }: { channel: SocialChannel; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={channel.icon.path} fill="currentColor" />
    </svg>
  );
}

/** "Follow us" strip for the landing page: every StockTank channel with its official mark. */
export function FollowUs({ variant = 'section' }: { variant?: 'section' | 'compact' }) {
  const channels = socialChannels();
  if (channels.length === 0) return null;

  if (variant === 'compact') {
    return (
      <nav aria-label="Follow StockTank" className="flex flex-wrap items-center gap-2">
        {channels.map((c) => (
          <a
            key={c.key}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${c.name} (${c.handle})`}
            title={`${c.name} · ${c.handle}`}
            className="flex size-9 items-center justify-center rounded-full border border-hairline text-muted transition-[color,border-color,transform] hover:-translate-y-0.5 hover:border-current"
            style={{ ['--brand' as string]: c.color }}
            onMouseEnter={(e) => (e.currentTarget.style.color = c.color)}
            onMouseLeave={(e) => (e.currentTarget.style.color = '')}
          >
            <BrandIcon channel={c} className="size-4" />
          </a>
        ))}
      </nav>
    );
  }

  return (
    <section aria-labelledby="follow-h" className="px-4 py-10 md:px-8">
      <div className="rounded-3xl border border-hairline bg-surface px-6 py-8 md:px-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">FOLLOW US</span>
            <h2 id="follow-h" className="font-display text-3xl font-extrabold tracking-tight md:text-[40px]">
              StockTank, everywhere you are
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted">Live desks, clips and explainers on every platform. Same rules everywhere: information, never investment advice.</p>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" aria-label="Social channels">
          {channels.map((c, i) => (
            <li key={c.key}>
              <Reveal index={i}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-bg/60 px-3 py-5 text-center transition-[transform,border-color,box-shadow] duration-300 ease-out-expo hover:-translate-y-1.5 hover:shadow-raised focus-visible:-translate-y-1.5"
                  style={{ ['--brand' as string]: c.color }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.color)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-raised text-fg transition-[background-color,color,transform] duration-300 group-hover:scale-110 group-hover:bg-[var(--brand)] group-hover:text-white">
                    <BrandIcon channel={c} className="size-7" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-display text-base font-bold">{c.name}</span>
                    <span className="font-mono text-[11px] text-muted">{c.handle}</span>
                  </span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
