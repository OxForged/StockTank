import type { HomeResponse } from '@stocktank/types';
import { Skeleton } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';

import { AdSlot } from '../../components/ads/ad-slot';
import { LiveDesk } from '../../components/desk/live-desk';
import { NewsletterSignup } from '../../components/marketing/newsletter-signup';
import { api } from '../../lib/api';
import { useDocumentTitle } from '../../lib/seo';
import { FeaturedHero } from './hero';
import { MarketsSection } from './markets-section';
import { DemoNotice, LatestSection, LineupSection, RundownSection, WatchlistPanel } from './sections';

function hasDemo(home: HomeResponse): boolean {
  return [
    ...home.featuredShows,
    ...home.latestEpisodes,
    ...home.projects,
    ...home.companies,
    ...home.rundown,
  ].some((item) => item.isDemo);
}

/** Hybrid A + B homepage: editorial hero + live desk, latest + watchlist, rundown, lineup, newsletter. */
export function HomePage() {
  useDocumentTitle();
  const { data: home, isPending, isError, refetch } = useQuery({ queryKey: ['home'], queryFn: () => api.content.home() });

  const nextBroadcast = home?.rundown.find((r) => r.status === 'scheduled') ?? null;

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">StockTank: on-chain stocks and crypto media network</h1>

      {home && hasDemo(home) ? <DemoNotice /> : null}

      <section aria-label="Featured and live" className="relative overflow-hidden border-b border-hairline">
        <div aria-hidden="true" className="bg-desk-grid pointer-events-none absolute inset-0 opacity-50 [[data-theme=light]_&]:opacity-25" />
        <div className="relative grid gap-8 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:py-11 xl:gap-10">
          {isPending ? (
            <>
              <div className="flex flex-col gap-5">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
              <Skeleton className="min-h-[420px] rounded-[22px]" />
            </>
          ) : (
            <>
              <FeaturedHero shows={home?.featuredShows ?? []} liveShowSlug={home?.live?.show?.slug ?? null} />
              <LiveDesk live={home?.live ?? null} next={nextBroadcast} />
            </>
          )}
        </div>
      </section>

      {isError ? (
        <div role="alert" className="mx-4 mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4 text-sm md:mx-8">
          We could not load the latest content.
          <button type="button" onClick={() => refetch()} className="font-semibold underline">
            Try again
          </button>
        </div>
      ) : null}

      <div className="px-4 pt-6 md:px-8">
        <AdSlot placement="home_presenting_sponsor" variant="strip" />
      </div>

      <div className="grid gap-7 px-4 pb-6 pt-10 md:px-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <LatestSection home={home} loading={isPending} />
          <AdSlot placement="home_native_feed" variant="card" />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <WatchlistPanel projects={home?.projects ?? []} companies={home?.companies ?? []} loading={isPending} />
          <AdSlot placement="watchlist_sidebar" variant="sidebar" />
        </div>
      </div>

      <MarketsSection />

      <RundownSection rundown={home?.rundown ?? []} loading={isPending} />

      <div className="px-4 py-4 md:px-8">
        <AdSlot placement="home_leaderboard" variant="leaderboard" />
      </div>

      <LineupSection shows={home?.featuredShows ?? []} loading={isPending} />

      <div className="px-4 pb-4 md:px-8">
        <NewsletterSignup source="homepage" />
      </div>
    </div>
  );
}
