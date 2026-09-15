import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RotateCcw, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { OrbitMark } from './OrbitMark';
import { UserProfileSidebar } from './ui/menu';
import { useDashboard } from '../context/DashboardContext';
import {
  OverviewIcon,
  CoordinatorIcon,
  GrowthIcon,
  ContentIcon,
  CalendarIcon,
  AnalyticsIcon,
  ConnectionsIcon,
  SettingsIcon,
} from './Icons';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
  const { user, resetToFresh } = useDashboard();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('creator_os_sidebar_collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('creator_os_sidebar_collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    if (onMobileClose) onMobileClose();
  }, [location.pathname]);

  const userProfile = {
    name: user?.name || 'Creator',
    email: user?.email || 'creator@creatoros.ai',
    avatarUrl: user?.avatarUrl || 'preset_amber',
  };

  const navItems = [
    {
      label: 'Overview',
      href: '/dashboard',
      icon: <OverviewIcon size={16} />,
      isActive: location.pathname === '/dashboard',
      onClick: () => navigate('/dashboard'),
    },
    {
      label: 'Coordinator',
      href: '/dashboard/coordinator',
      icon: <CoordinatorIcon size={16} />,
      isActive: location.pathname === '/dashboard/coordinator',
      onClick: () => navigate('/dashboard/coordinator'),
    },
    {
      label: 'Growth agent',
      href: '/dashboard/growth',
      icon: <GrowthIcon size={16} />,
      isActive: location.pathname === '/dashboard/growth',
      onClick: () => navigate('/dashboard/growth'),
    },
    {
      label: 'Content agent',
      href: '/dashboard/content',
      icon: <ContentIcon size={16} />,
      isActive: location.pathname === '/dashboard/content',
      onClick: () => navigate('/dashboard/content'),
    },
    {
      label: 'Content Planner',
      href: '/dashboard/planner',
      icon: <CalendarIcon size={16} />,
      isActive: location.pathname === '/dashboard/planner',
      onClick: () => navigate('/dashboard/planner'),
    },
    {
      label: 'Analytics agent',
      href: '/dashboard/analytics',
      icon: <AnalyticsIcon size={16} />,
      isActive: location.pathname === '/dashboard/analytics',
      onClick: () => navigate('/dashboard/analytics'),
    },
    {
      label: 'Connections',
      href: '/dashboard/connections',
      icon: <ConnectionsIcon size={16} />,
      isActive: location.pathname === '/dashboard/connections',
      onClick: () => navigate('/dashboard/connections'),
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: <SettingsIcon size={16} />,
      isActive: location.pathname === '/dashboard/settings',
      onClick: () => navigate('/dashboard/settings'),
      isSeparator: true,
    },
  ];

  const logoutItem = {
    label: 'Reset Session',
    icon: <RotateCcw size={16} />,
    onClick: () => {
      resetToFresh();
    },
  };

  const sidebarContent = (
    <UserProfileSidebar
      user={userProfile}
      navItems={navItems}
      logoutItem={logoutItem}
      isCollapsed={mobileOpen ? false : isCollapsed}
      className="flex-1 max-w-full bg-transparent border-none p-0 shadow-none"
    />
  );

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside
        className={`hidden md:flex relative shrink-0 border-r border-border2 h-screen sticky top-0 flex-col bg-panel/60 backdrop-blur-md overflow-hidden p-2.5 space-y-2.5 transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-52'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border2 pb-2.5 px-1.5">
          <Link
            to="/"
            className={`flex items-center gap-2 hover:bg-white/[0.03] transition-colors rounded-xl p-1 ${
              isCollapsed && 'justify-center w-full'
            }`}
            title={isCollapsed ? 'CreatorOS' : undefined}
          >
            <OrbitMark size={24} animate={false} />
            {!isCollapsed && (
              <span className="font-display text-xs">
                Creator<span className="text-amber font-semibold">OS</span>
              </span>
            )}
          </Link>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg text-slate-400 hover:text-amber hover:bg-white/5 transition-colors shrink-0"
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {sidebarContent}
      </aside>

      {/* Mobile Overlay Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fadeIn"
            onClick={onMobileClose}
          />

          {/* Slide-out Drawer */}
          <div className="relative w-64 max-w-[80vw] bg-[#0B0F19] border-r border-border2 h-full p-4 flex flex-col z-10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border2 pb-3">
              <Link to="/" className="flex items-center gap-2" onClick={onMobileClose}>
                <OrbitMark size={24} animate={false} />
                <span className="font-display text-sm text-slate-100">
                  Creator<span className="text-amber font-semibold">OS</span>
                </span>
              </Link>
              <button
                onClick={onMobileClose}
                className="p-1.5 rounded-lg border border-border2 text-slate-400 hover:text-slate-100 hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
