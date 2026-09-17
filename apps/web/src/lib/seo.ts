import { useEffect } from 'react';
import { useLocation } from 'react-router';

const BASE_TITLE = 'StockTank';
const DEFAULT_DESCRIPTION =
  'StockTank is a media network covering on-chain stocks and crypto: shows, a live desk, clips and explainers. Information and entertainment only, not financial advice.';

export interface SeoOptions {
  title?: string;
  description?: string | null;
  /** Path on the site, e.g. "/shows/the-tank". Defaults to the current location. */
  path?: string;
  image?: string | null;
  type?: 'website' | 'article' | 'video.episode' | 'profile';
  /** schema.org JSON-LD object(s) describing the page (§46). */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  noindex?: boolean;
  /** RSS/podcast feed advertised with <link rel="alternate">, so podcast apps and readers can discover it. */
  feedUrl?: string | null;
  feedTitle?: string;
}

function setMeta(attr: 'name' | 'property', key: string, content: string | null | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

const trimDescription = (d: string) => (d.length > 200 ? `${d.slice(0, 197).trimEnd()}…` : d);

/**
 * Client-side metadata for the SPA: title, description, canonical, OpenGraph, Twitter card and JSON-LD.
 * Crawlers that render JavaScript read these; server-side rendering or prerendering is the production follow-up.
 */
export function useSeo(options: SeoOptions = {}): void {
  const { title, description, path, image, type = 'website', jsonLd, noindex, feedUrl, feedTitle } = options;
  const { pathname } = useLocation();
  const canonicalPath = path ?? pathname;
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const fullTitle = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — On-chain stocks & crypto`;
    const desc = trimDescription(description?.trim() || DEFAULT_DESCRIPTION);
    const url = `${window.location.origin}${canonicalPath}`;
    const imageUrl = image ? new URL(image, window.location.origin).toString() : `${window.location.origin}/og-default.svg`;

    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex,nofollow' : null);
    setCanonical(url);
    setMeta('property', 'og:title', title ?? fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:image', imageUrl);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title ?? fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', imageUrl);

    let feed = document.head.querySelector<HTMLLinkElement>('link[rel="alternate"][data-page-feed]');
    if (feedUrl) {
      if (!feed) {
        feed = document.createElement('link');
        feed.rel = 'alternate';
        feed.type = 'application/rss+xml';
        feed.dataset.pageFeed = '';
        document.head.appendChild(feed);
      }
      feed.href = feedUrl;
      feed.title = feedTitle ?? fullTitle;
    } else {
      feed?.remove();
    }

    let script = document.getElementById('page-jsonld') as HTMLScriptElement | null;
    if (jsonLdText) {
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'page-jsonld';
        document.head.appendChild(script);
      }
      script.textContent = jsonLdText;
    } else {
      script?.remove();
    }
  }, [title, description, canonicalPath, image, type, jsonLdText, noindex, feedUrl, feedTitle]);
}

/** Backwards-compatible title-only helper. */
export function useDocumentTitle(title?: string): void {
  useSeo({ title });
}

export const ORGANIZATION_LD = {
  '@type': 'NewsMediaOrganization',
  name: 'StockTank',
  slogan: 'On-chain stocks & crypto',
};
