import { LogoMark, Wordmark } from '@stocktank/ui';
import { Link } from 'react-router';

import { DISCLAIMER, LEGAL_NAV, PRIMARY_NAV } from '../../lib/nav';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-section border-t border-hairline bg-surface/40">
      <div className="container-site grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr] lg:py-16">
        <div className="flex flex-col gap-4">
          <Wordmark mark tagline size="md" />
          <p className="max-w-md text-sm text-muted">
            A media network for the on-chain economy: shows, live radio, clips, news and the projects, companies
            and creators shaping it.
          </p>
          <p className="max-w-md rounded-md border border-hairline bg-surface p-3 text-xs leading-relaxed text-muted">
            <strong className="font-semibold text-fg">Disclaimer.</strong> {DISCLAIMER}
          </p>
        </div>

        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className="kicker mb-4 text-primary-hi">
            Explore
          </h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {PRIMARY_NAV.filter((n) => n.to !== '/').map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-muted hover:text-fg hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-legal">
          <h2 id="footer-legal" className="kicker mb-4 text-primary-hi">
            Legal
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {LEGAL_NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-muted hover:text-fg hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-hairline">
        <div className="container-site flex flex-col gap-3 py-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <LogoMark size={16} tone="mono" className="text-faint" />
            &copy; {year} StockTank. All rights reserved.
          </p>
          <p className="font-mono uppercase tracking-[0.18em]">On-chain stocks &amp; crypto</p>
        </div>
      </div>
    </footer>
  );
}
