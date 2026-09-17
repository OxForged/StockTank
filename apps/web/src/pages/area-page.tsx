import { Button, cn } from '@stocktank/ui';
import {
  Boxes,
  Building2,
  Compass,
  Headphones,
  Library,
  Newspaper,
  Play,
  Radio,
  Scissors,
  TrendingUp,
  Tv,
  Users,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router';

import { MilestoneEmpty } from '../components/milestone-empty';
import { PageHeader } from '../components/page-header';
import { useDocumentTitle } from '../lib/seo';

interface AreaConfig {
  kicker: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  milestone?: number;
  milestoneLabel?: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Optional extra content under the empty state (e.g. the standing disclaimer). */
  note?: ReactNode;
  cta?: boolean;
}

export const AREAS = {
  shows: {
    kicker: 'Shows',
    title: 'Original programming',
    description: 'Every StockTank show in one place: formats, hosts, seasons and where to watch or listen.',
    icon: Tv,
    milestone: 2,
    milestoneLabel: 'Content',
    emptyTitle: 'No shows published yet',
    emptyDescription: 'Shows are created in the StockTank admin and appear here the moment the first one is published.',
    cta: true,
  },
  live: {
    kicker: 'Live',
    title: 'Live radio & streams',
    description: 'Stations, live streams and what is playing right now.',
    icon: Radio,
    milestone: 5,
    milestoneLabel: 'Live',
    emptyTitle: 'Nothing is on air',
    emptyDescription: 'Live radio (AzuraCast) and streaming arrive in Milestone 5, with a now-playing rail and schedule.',
  },
  watch: {
    kicker: 'Watch',
    title: 'Video',
    description: 'Full episodes, interviews and specials.',
    icon: Play,
    milestone: 3,
    milestoneLabel: 'Media',
    emptyTitle: 'No videos available yet',
    emptyDescription: 'Uploads, transcoding and the HLS video player ship in Milestone 3. Episodes list here once published.',
  },
  listen: {
    kicker: 'Listen',
    title: 'Podcasts & audio',
    description: 'Audio episodes and podcast feeds for every show.',
    icon: Headphones,
    milestone: 4,
    milestoneLabel: 'Podcast',
    emptyTitle: 'No audio available yet',
    emptyDescription: 'Podcast publishing and RSS feeds ship in Milestone 4. Subscribe links will appear here for each show.',
  },
  clips: {
    kicker: 'Clips',
    title: 'Clips',
    description: 'Short moments from episodes and live shows.',
    icon: Scissors,
    milestone: 3,
    milestoneLabel: 'Media',
    emptyTitle: 'No clips yet',
    emptyDescription: 'Clips are cut from real episodes once the media pipeline lands. AI-assisted clipping follows in Milestone 7, always reviewed by a person.',
  },
  news: {
    kicker: 'News',
    title: 'Newsroom',
    description: 'Editorial coverage of the on-chain economy.',
    icon: Newspaper,
    milestone: 2,
    milestoneLabel: 'Content',
    emptyTitle: 'No articles published yet',
    emptyDescription: 'Articles are written and reviewed in the admin. AI-assisted drafts are labelled and human-approved before they reach this page.',
  },
  projects: {
    kicker: 'Projects',
    title: 'On-chain projects',
    description: 'Protocols, tokens and the conversations about them.',
    icon: Boxes,
    milestone: 2,
    milestoneLabel: 'Content',
    emptyTitle: 'No project profiles yet',
    emptyDescription: 'Profiles link a project to its chain, tokens and every episode or clip that discussed it. No market data is shown until a data provider is connected.',
  },
  companies: {
    kicker: 'Companies',
    title: 'Public companies',
    description: 'Listed companies covered on the network.',
    icon: Building2,
    milestone: 2,
    milestoneLabel: 'Content',
    emptyTitle: 'No company profiles yet',
    emptyDescription: 'Tickers, sectors and StockTank coverage per company. Coverage is editorial, never a recommendation.',
  },
  markets: {
    kicker: 'Markets',
    title: 'Markets',
    description: 'Market context for the shows: what moved and why it came up on air.',
    icon: TrendingUp,
    emptyTitle: 'Market data connects in a later release',
    emptyDescription: 'StockTank will show market context from a licensed data provider with clear attribution. Until then this page intentionally shows no prices.',
  },
  creators: {
    kicker: 'Creators',
    title: 'Creators',
    description: 'Hosts, guests and independent creators on the network.',
    icon: Users,
    milestone: 2,
    milestoneLabel: 'Content',
    emptyTitle: 'No creator profiles yet',
    emptyDescription: 'Creators get a profile, channel and appearance feed. Creator tools and monetization follow in later milestones.',
    cta: true,
  },
  search: {
    kicker: 'Discover',
    title: 'Search',
    description: 'Find shows, episodes, clips, projects, companies and creators.',
    icon: Compass,
    milestone: 2,
    milestoneLabel: 'Content',
    emptyTitle: 'Search opens with the content launch',
    emptyDescription: 'Full-text search across the media graph ships with Milestone 2. Until then there is nothing to search.',
  },
  library: {
    kicker: 'Library',
    title: 'Your library',
    description: 'Saved shows, watch-later and listening history.',
    icon: Library,
    milestone: 2,
    milestoneLabel: 'Content',
    emptyTitle: 'Your library is empty',
    emptyDescription: 'Follow shows and save episodes once content is live. Sign in so your library follows you across web, mobile and TV.',
    cta: true,
  },
} satisfies Record<string, AreaConfig>;

export type AreaKey = keyof typeof AREAS;

export function AreaPage({ area }: { area: AreaKey }) {
  const cfg: AreaConfig = AREAS[area];
  const Icon = cfg.icon;
  useDocumentTitle(cfg.title);
  return (
    <>
      <PageHeader kicker={cfg.kicker} title={cfg.title} description={cfg.description} />
      <div className={cn('container-site py-10 md:py-14')}>
        <MilestoneEmpty
          variant="surface"
          size="lg"
          icon={<Icon />}
          milestone={cfg.milestone}
          milestoneLabel={cfg.milestoneLabel}
          title={cfg.emptyTitle}
          description={cfg.emptyDescription}
          cta={cfg.cta}
          extraAction={
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Back to home</Link>
            </Button>
          }
        />
        {cfg.note}
      </div>
    </>
  );
}
