import {
  Boxes,
  Building2,
  Compass,
  Headphones,
  House,
  Library,
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

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Home', to: '/', icon: House },
  { label: 'Shows', to: '/shows', icon: Tv, milestone: 2 },
  { label: 'Live', to: '/live', icon: Radio, milestone: 5 },
  { label: 'Watch', to: '/watch', icon: Play, milestone: 3 },
  { label: 'Listen', to: '/listen', icon: Headphones, milestone: 4 },
  { label: 'Clips', to: '/clips', icon: Scissors, milestone: 3 },
  { label: 'News', to: '/news', icon: Newspaper, milestone: 2 },
  { label: 'Projects', to: '/projects', icon: Boxes, milestone: 2 },
  { label: 'Companies', to: '/companies', icon: Building2, milestone: 2 },
  { label: 'Markets', to: '/markets', icon: TrendingUp },
  { label: 'Creators', to: '/creators', icon: Users, milestone: 2 },
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
