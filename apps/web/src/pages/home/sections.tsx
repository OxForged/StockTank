import { Badge, Button, LiveBadge, LogoMark, MediaSkeleton, SectionHeader, Wordmark } from '@stocktank/ui';
import {
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Newspaper,
  Play,
  Radio,
  Scissors,
  Tv,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { MilestoneEmpty } from '../../components/milestone-empty';
import { DISCLAIMER } from '../../lib/nav';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function SeeAll({ to, children = 'See all' }: { to: string; children?: ReactNode }) {
  return (
    <Button asChild variant="link" size="sm">
      <Link to={to}>
        {children}
        <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

function Section({
  id,
  kicker,
  title,
  description,
  to,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  description?: string;
  to?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-6">
      <SectionHeader
        headingId={headingId}
        kicker={kicker}
        title={title}
        description={description}
        action={to ? <SeeAll to={to} /> : undefined}
      />
      {children}
    </section>
  );
}

/** Ghost grid that shows the shape of the coming content without inventing any of it. */
function GhostGrid({ count = 4, className = 'sm:grid-cols-2 lg:grid-cols-4' }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none grid gap-5 opacity-40 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <MediaSkeleton key={i} className="[&_*]:animate-none" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden border-b border-hairline">
      <div aria-hidden="true" className="absolute inset-0 bg-grid-fade" />
      <div
        aria-hidden="true"
        className="absolute -right-32 -top-40 size-[34rem] rounded-full bg-primary/15 blur-[120px] md:-right-10"
      />
      <div className="container-site relative grid gap-10 py-16 md:py-24 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <Badge variant="primary">Media network · Launching</Badge>
          <h1 id="hero-heading" className="sr-only">
            StockTank: on-chain stocks and crypto media network
          </h1>
          <Wordmark tagline size="hero" label="StockTank — On-chain stocks & crypto" />
          <p className="max-w-xl text-base text-muted md:text-lg">
            Shark Tank energy meets financial media for the on-chain economy. Shows, live radio, clips and news on the
            projects, companies and creators building it, all in one network.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Create your account
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/shows">Explore shows</Link>
            </Button>
          </div>
          <p className="max-w-xl text-xs text-faint">{DISCLAIMER}</p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1" aria-label="What StockTank covers">
          {[
            { icon: Tv, title: 'Shows & live radio', text: 'Original programming and live market conversation.' },
            { icon: Boxes, title: 'Projects & companies', text: 'On-chain projects and public companies, in one graph.' },
            { icon: Users, title: 'Creators', text: 'Hosts, guests and independent voices with their own channels.' },
          ].map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-lg border border-hairline bg-surface/80 p-4 shadow-card backdrop-blur"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-hi">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-fg">{title}</p>
                <p className="mt-0.5 text-xs text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Featured show                                                               */
/* -------------------------------------------------------------------------- */

export function FeaturedShowSection() {
  return (
    <Section id="featured-show" kicker="Featured show" title="Tonight on StockTank" to="/shows">
      <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,var(--st-primary-soft),transparent_60%)]" />
        <div className="relative grid gap-8 p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div className="flex flex-col justify-center gap-4">
            <p className="kicker text-primary-hi">Scheduled for Milestone 2 · Content</p>
            <h3 className="font-display text-display-sm font-extrabold text-fg md:text-display-md">
              The first StockTank original premieres with the content launch.
            </h3>
            <p className="max-w-prose text-sm text-muted md:text-base">
              This slot will carry the network&apos;s featured show: artwork, hosts, the latest episode and where to watch or
              listen. Nothing is listed until a real show is published.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <Link to="/shows">Browse the shows page</Link>
              </Button>
            </div>
          </div>
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-hairline-strong bg-raised/40">
            <LogoMark size={72} tone="mono" className="text-faint" />
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Live now                                                                    */
/* -------------------------------------------------------------------------- */

export function LiveNowSection() {
  return (
    <Section id="live-now" kicker="Live now" title="On air" to="/live">
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-raised text-faint">
            <Radio className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <LiveBadge status="offair" />
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-faint">No broadcast</span>
            </div>
            <p className="mt-2 font-display text-lg font-bold text-fg">Nothing is live right now.</p>
            <p className="text-sm text-muted">
              Live radio and streams switch on in Milestone 5. When a station is on air, this rail shows what is playing.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/live">Live schedule</Link>
        </Button>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Latest episodes / clips                                                     */
/* -------------------------------------------------------------------------- */

export function LatestEpisodesSection() {
  return (
    <Section id="latest-episodes" kicker="Latest episodes" title="Fresh from the studio" to="/watch">
      <div className="relative">
        <GhostGrid />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <MilestoneEmpty
            variant="surface"
            size="sm"
            icon={<Play />}
            milestone={2}
            milestoneLabel="Content"
            title="No episodes published yet"
            description="Episodes appear here the moment the first show publishes. Playback lands with the media pipeline in Milestone 3."
            className="w-full max-w-lg"
          />
        </div>
      </div>
    </Section>
  );
}

export function TrendingClipsSection() {
  return (
    <Section id="trending-clips" kicker="Trending clips" title="Moments worth sharing" to="/clips">
      <div className="relative">
        <GhostGrid count={6} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 [&_.aspect-video]:aspect-[9/16]" />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <MilestoneEmpty
            variant="surface"
            size="sm"
            icon={<Scissors />}
            milestone={3}
            milestoneLabel="Media"
            title="Clips arrive with the media pipeline"
            description="Short vertical clips are cut from episodes and live shows. Trending is ranked on real audience data, never seeded."
            className="w-full max-w-lg"
          />
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Projects / companies                                                        */
/* -------------------------------------------------------------------------- */

export function TrendingProjectsSection() {
  return (
    <Section id="trending-projects" kicker="Trending projects" title="On-chain projects" to="/projects">
      <MilestoneEmpty
        icon={<Boxes />}
        milestone={2}
        milestoneLabel="Content"
        title="Project profiles are not live yet"
        description="Token, chain and category profiles with the shows and clips that mention them. No prices or rankings are shown until real data is connected."
      />
    </Section>
  );
}

export function FeaturedCompaniesSection() {
  return (
    <Section id="featured-companies" kicker="Featured companies" title="Public companies" to="/companies">
      <MilestoneEmpty
        icon={<Building2 />}
        milestone={2}
        milestoneLabel="Content"
        title="Company profiles are not live yet"
        description="Listed companies with tickers, sectors and every StockTank conversation about them. Coverage is editorial, not a recommendation."
      />
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Creators / news / upcoming                                                  */
/* -------------------------------------------------------------------------- */

export function CreatorsSection() {
  return (
    <Section id="featured-creators" kicker="Featured creators" title="Voices of the network" to="/creators">
      <MilestoneEmpty
        variant="surface"
        icon={<Users />}
        milestone={2}
        milestoneLabel="Content"
        title="Creators join with the content launch"
        description="Hosts, guests and independent creators get profiles, channels and a feed of their appearances."
        cta
      />
    </Section>
  );
}

export function NewsSection() {
  return (
    <Section id="latest-news" kicker="Latest news" title="Newsroom" to="/news">
      <MilestoneEmpty
        icon={<Newspaper />}
        milestone={2}
        milestoneLabel="Content"
        title="No articles published yet"
        description="Editorial coverage and market conversations. AI-assisted drafts are always reviewed by a human before publishing and labelled as such."
      />
    </Section>
  );
}

export function UpcomingSection() {
  return (
    <Section id="upcoming-shows" kicker="Upcoming shows" title="On the schedule" to="/live">
      <MilestoneEmpty
        icon={<Calendar />}
        milestone={5}
        milestoneLabel="Live"
        title="The schedule is empty"
        description="Scheduled premieres, live tapings and radio slots will appear here with reminders once live programming launches."
      />
    </Section>
  );
}
