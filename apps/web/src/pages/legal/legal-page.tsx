import { Badge } from '@stocktank/ui';
import { NavLink, useParams } from 'react-router';

import { PageHeader } from '../../components/page-header';
import { DISCLAIMER, LEGAL_NAV } from '../../lib/nav';
import { useDocumentTitle } from '../../lib/seo';
import { NotFoundPage } from '../not-found-page';
import { LEGAL_DOCS, type LegalSlug } from './legal-content';

const DRAFT_NOTICE = 'Draft — pending legal review';

export function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const doc = slug && slug in LEGAL_DOCS ? LEGAL_DOCS[slug as LegalSlug] : null;
  useDocumentTitle(doc?.title);
  if (!doc) return <NotFoundPage />;

  return (
    <>
      <PageHeader
        kicker="Legal"
        title={doc.title}
        description={doc.summary}
        action={<Badge variant="warning">{DRAFT_NOTICE}</Badge>}
      />
      <div className="container-site grid gap-10 py-10 md:grid-cols-[14rem_1fr] md:py-14">
        <nav aria-label="Legal documents" className="md:sticky md:top-32 md:self-start">
          <ul className="flex gap-2 overflow-x-auto scrollbar-none md:flex-col md:gap-0.5">
            {LEGAL_NAV.map((item) => (
              <li key={item.to} className="shrink-0">
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block whitespace-nowrap rounded-sm px-3 py-1.5 text-sm transition-colors ${
                      isActive ? 'bg-raised font-semibold text-fg' : 'text-muted hover:text-fg'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-prose">
          <p className="mb-8 rounded-md border border-warning/30 bg-warning-soft p-4 text-sm text-fg">
            <strong className="font-semibold">{DRAFT_NOTICE}.</strong> This page is a structural placeholder. The final
            wording will be prepared and approved by counsel before launch and this notice will be removed. Nothing here is
            a binding statement of terms.
          </p>
          {doc.sections.map((section) => (
            <section key={section.heading} className="mb-8">
              <h2 className="mb-2 font-display text-xl font-bold text-fg">{section.heading}</h2>
              <p className="text-sm leading-relaxed text-muted md:text-base">{section.body}</p>
            </section>
          ))}
          <section className="mb-8 border-t border-hairline pt-6">
            <h2 className="mb-2 font-display text-xl font-bold text-fg">Standing disclaimer</h2>
            <p className="text-sm leading-relaxed text-muted md:text-base">{DISCLAIMER}</p>
          </section>
          <p className="text-xs text-faint">Last updated: not yet published.</p>
        </article>
      </div>
    </>
  );
}
