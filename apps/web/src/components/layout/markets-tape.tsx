const TAPE = ['TOKENIZED EQ', 'RWA INDEX', 'BTC', 'ETH', 'SOL', 'STABLES'] as const;

/**
 * MARKETS ticker tape (Concept B). No market data provider is connected yet, so value cells show a loading
 * shimmer and the strip says so. Never render made-up prices here.
 */
export function MarketsTape() {
  return (
    <section
      aria-label="Markets ticker"
      className="flex h-14 items-center gap-2.5 overflow-hidden border-b border-hairline bg-surface px-4 transition-colors md:px-8"
    >
      <span className="shrink-0 font-mono text-[11px] font-bold tracking-[0.14em] text-primary-hi">MARKETS</span>
      <ul className="flex min-w-0 items-center gap-2.5 overflow-x-auto scrollbar-none" aria-hidden="true">
        {TAPE.map((label, i) => (
          <li key={label} className="flex h-8 shrink-0 items-center gap-2.5 rounded-md border border-hairline px-3.5">
            <span className="font-mono text-xs font-bold">{label}</span>
            <span className="shimmer h-2.5 w-14 animate-hy-shimmer rounded-xs" style={{ animationDelay: `${i * 0.15}s` }} />
          </li>
        ))}
      </ul>
      <p className="ml-auto hidden shrink-0 text-xs text-muted xl:block">Market data provider connects at launch</p>
      <span className="sr-only">Market data provider connects at launch. No prices are shown yet.</span>
    </section>
  );
}
