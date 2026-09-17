import { Button, EmptyState, Skeleton } from '@stocktank/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Library, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { api } from '../lib/api';
import { useMe } from '../lib/auth';
import { LIBRARY_QUERY_KEY, useLibrary } from '../lib/library';
import { useDocumentTitle } from '../lib/seo';
import { useWatchlist } from '../stores/watchlist';

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`lib-${title}`} className="flex flex-col gap-3">
      <h2 id={`lib-${title}`} className="font-mono text-xs tracking-[0.16em] text-primary-hi">
        {title.toUpperCase()} · {count}
      </h2>
      {children}
    </section>
  );
}

/** The viewer's library: follows and bookmarks (README §30). Signed-out visitors see what is saved on the device. */
export function LibraryPage() {
  useDocumentTitle('Library');
  const { user, isLoading } = useMe();
  const library = useLibrary(Boolean(user));
  const qc = useQueryClient();
  const deviceIds = useWatchlist((s) => s.ids);
  const toggle = useWatchlist((s) => s.toggle);
  const removeBookmark = useMutation({
    mutationFn: (episodeId: string) => api.me.removeBookmark(episodeId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY }),
  });

  return (
    <>
      <header className="relative overflow-hidden border-b border-hairline px-4 py-10 md:px-8 md:py-12">
        <div aria-hidden="true" className="bg-desk-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex flex-col gap-3">
          <span className="font-mono text-xs tracking-[0.16em] text-primary-hi">YOUR STOCKTANK</span>
          <h1 className="font-display text-4xl font-black italic tracking-tight md:text-6xl">Library</h1>
          <p className="max-w-2xl text-muted">Shows, projects and companies you follow, and episodes you saved.</p>
        </div>
      </header>

      <div className="flex flex-col gap-10 px-4 py-8 md:px-8">
        {isLoading || (user && library.isPending) ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : !user ? (
          <EmptyState
            variant="surface"
            icon={<Library aria-hidden="true" />}
            title="Sign in to keep your library everywhere"
            description={
              deviceIds.length > 0
                ? `You have ${deviceIds.length} item${deviceIds.length === 1 ? '' : 's'} saved on this device. They move to your account when you sign in.`
                : 'Follow shows, projects and companies and bookmark episodes. It is free and no wallet is needed.'
            }
            action={
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/signup">Join free</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/login" state={{ from: '/library' }}>
                    Sign in
                  </Link>
                </Button>
              </div>
            }
          />
        ) : library.isError ? (
          <p role="alert" className="text-danger">
            Your library could not be loaded.
          </p>
        ) : library.data ? (
          <>
            <Section title="Shows" count={library.data.shows.length}>
              {library.data.shows.length === 0 ? (
                <p className="text-sm text-muted">
                  Not following any shows. <Link to="/shows" className="text-primary-hi underline">Browse shows</Link>
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {library.data.shows.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-4">
                      <Link to={`/shows/${s.slug}`} className="font-display text-lg font-bold hover:underline">
                        {s.title}
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => toggle(`show:${s.id}`)}>
                        Unfollow
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Watchlist" count={library.data.projects.length + library.data.companies.length}>
              {library.data.projects.length + library.data.companies.length === 0 ? (
                <p className="text-sm text-muted">Star projects and companies to add them here.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ...library.data.projects.map((p) => ({ key: `project:${p.id}`, name: p.name, to: `/projects/${p.slug}`, kind: 'Project' })),
                    ...library.data.companies.map((c) => ({ key: `company:${c.id}`, name: c.name, to: `/companies/${c.slug}`, kind: 'Company' })),
                  ].map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-4">
                      <span>
                        <span className="block font-mono text-[11px] tracking-[0.1em] text-muted">{item.kind.toUpperCase()}</span>
                        <Link to={item.to} className="font-semibold hover:underline">
                          {item.name}
                        </Link>
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => toggle(item.key)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Saved episodes" count={library.data.bookmarks.length}>
              {library.data.bookmarks.length === 0 ? (
                <EmptyState icon={<Bookmark aria-hidden="true" />} title="No saved episodes" description="Use Save on an episode to keep it here." />
              ) : (
                <ul className="flex flex-col gap-3">
                  {library.data.bookmarks.map((b) => (
                    <li key={b.id} className="flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-mono text-[11px] tracking-[0.1em] text-primary-hi">{b.show.title.toUpperCase()}</span>
                        <Link to={`/shows/${b.show.slug}/${b.slug}`} className="truncate font-display text-lg font-bold hover:underline">
                          {b.title}
                        </Link>
                      </span>
                      <Button size="icon" variant="ghost" aria-label={`Remove ${b.title} from saved episodes`} onClick={() => removeBookmark.mutate(b.id)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        ) : null}
      </div>
    </>
  );
}
