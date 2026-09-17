import { useDocumentTitle } from '../../lib/seo';
import {
  CreatorsSection,
  FeaturedCompaniesSection,
  FeaturedShowSection,
  HeroSection,
  LatestEpisodesSection,
  LiveNowSection,
  NewsSection,
  TrendingClipsSection,
  TrendingProjectsSection,
  UpcomingSection,
} from './sections';

/**
 * Editorial homepage per README §5. Content APIs arrive in Milestone 2, so every section renders
 * a designed, honest empty state instead of fabricated shows, prices or tickers.
 */
export function HomePage() {
  useDocumentTitle();
  return (
    <>
      <HeroSection />
      <div className="container-site flex flex-col gap-section py-section">
        <FeaturedShowSection />
        <LiveNowSection />
        <LatestEpisodesSection />
        <TrendingClipsSection />
        <div className="grid gap-section lg:grid-cols-2 lg:gap-8">
          <TrendingProjectsSection />
          <FeaturedCompaniesSection />
        </div>
        <CreatorsSection />
        <NewsSection />
        <UpcomingSection />
      </div>
    </>
  );
}
