import {
  BarChart3,
  Bot,
  CircleCheckBig,
  Building2,
  CalendarDays,
  Crosshair,
  LayoutDashboard,
  Library,
  PenSquare,
  Radar,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Single source of truth for app navigation — sidebar, header titles, breadcrumbs. */
export const navigation: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Executive Brief", href: "/executive-brief", icon: Sparkles },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        title: "Market Intelligence",
        href: "/market-intelligence",
        icon: Radar,
      },
      { title: "Opportunities", href: "/opportunities", icon: Crosshair },
    ],
  },
  {
    label: "Relationships",
    items: [
      { title: "Companies", href: "/companies", icon: Building2 },
      { title: "Contacts", href: "/contacts", icon: Users },
      { title: "Meetings", href: "/meetings", icon: CalendarDays },
    ],
  },
  {
    label: "Studio",
    items: [
      { title: "Content Studio", href: "/content", icon: PenSquare },
      { title: "Knowledge Base", href: "/knowledge", icon: Library },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Analytics", href: "/analytics", icon: BarChart3 },
      { title: "AI Team", href: "/team", icon: Bot },
        { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const allNavItems: NavItem[] = navigation.flatMap((group) => group.items);

export function titleForPath(pathname: string): string {
  return (
    allNavItems.find((item) => item.href === pathname)?.title ?? "MetaRealm OS"
  );
}
