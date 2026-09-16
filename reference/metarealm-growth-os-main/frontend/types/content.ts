/** Content studio + market intelligence domain. */

export type ContentPlatform = "linkedin" | "x" | "instagram";

export type ContentStatus =
  | "awaiting_approval"
  | "draft"
  | "scheduled"
  | "published";

export interface ContentItem {
  id: string;
  saved?: boolean;
  topic?: string;
  title: string;
  platform: ContentPlatform;
  status: ContentStatus;
  scheduledFor?: string;
  /** Draft text — full post or opening excerpt during the mock phase. */
  body?: string;
  author?: string;
}

export type NewsRegion = "morocco" | "mena" | "web3" | "gaming";

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  region: NewsRegion;
  publishedAgo: string;
  url?: string | null;
  saved?: boolean;
  topic?: string;
  score?: number;
}
