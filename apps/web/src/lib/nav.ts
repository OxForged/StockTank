import {
  Boxes,
  Building2,
  Compass,
  Headphones,
  House,
  Library,
  Megaphone,
  Newspaper,
  Play,
  Radio,
  Scissors,
  TrendingUp,
  Tv,
  UserRound,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: typeof House;
  /** Which milestone in README §53 delivers the content behind this area. */
  milestone?: number;
}

/** Left rail (desktop), from the Hybrid A + B design. */
export const RAIL_NAV: readonly NavItem[] = [
  { label: 'Home', to: '/', icon: House },
  { label: 'Markets', to: '/markets', icon: TrendingUp },
  { label: 'Live', to: '/live', icon: Radio },
  { label: 'Shows', to: '/shows', icon: Tv },
  { label: 'Clips', to: '/clips', icon: Scissors, milestone: 3 },
  { label: 'Projects', to: '/projects', icon: Boxes },
  { label: 'Companies', to: '/companies', icon: Building2 },
  { label: 'Library', to: '/library', icon: Library, milestone: 2 },
];

/** Every public area (mobile drawer, footer). */
export const PRIMARY_NAV: readonly NavItem[] = [
  ...RAIL_NAV,
  { label: 'Watch', to: '/watch', icon: Play, milestone: 3 },
  { label: 'Listen', to: '/listen', icon: Headphones, milestone: 4 },
  { label: 'News', to: '/news', icon: Newspaper, milestone: 2 },
  { label: 'Creators', to: '/creators', icon: Users, milestone: 2 },
  { label: 'Advertise', to: '/advertise', icon: Megaphone },
];

export const BOTTOM_NAV: readonly NavItem[] = [
  { label: 'Home', to: '/', icon: House },
  { label: 'Discover', to: '/search', icon: Compass },
  { label: 'Live', to: '/live', icon: Radio },
  { label: 'Library', to: '/library', icon: Library },
  { label: 'Account', to: '/account', icon: UserRound },
];

export const LEGAL_NAV = [
  { label: 'Terms', to: '/legal/terms' },
  { label: 'Privacy', to: '/legal/privacy' },
  { label: 'Cookies', to: '/legal/cookies' },
  { label: 'Copyright', to: '/legal/copyright' },
  { label: 'DMCA', to: '/legal/dmca' },
  { label: 'AI disclosure', to: '/legal/ai-disclosure' },
  { label: 'Advertising disclosure', to: '/legal/advertising-disclosure' },
  { label: 'Financial disclaimer', to: '/legal/financial-disclaimer' },
] as const;

export const DISCLAIMER =
  'StockTank is a media company. Content is for information and entertainment only and is not financial or investment advice.';

/** Section name shown after the wordmark in the top bar ("STOCKTANK / Shows"). */
export function sectionFor(pathname: string): string {
  if (pathname === '/') return 'Home';
  const match = PRIMARY_NAV.find((n) => n.to !== '/' && (pathname === n.to || pathname.startsWith(`${n.to}/`)));
  if (match) return match.label;
  if (pathname.startsWith('/search')) return 'Search';
  if (pathname.startsWith('/newsletter')) return 'Newsletter';
  if (pathname.startsWith('/legal')) return 'Legal';
  if (pathname.startsWith('/account')) return 'Account';
  return 'StockTank';
}
