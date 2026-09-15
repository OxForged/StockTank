import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, RotateCcw } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { OrbitMark } from './components/OrbitMark';
import { AmbientBackground } from './components/AmbientBackground';
import { NotificationBell } from './components/NotificationBell';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Overview } from './pages/Overview';
import { CoordinatorPage } from './pages/CoordinatorPage';
import { GrowthPage } from './pages/GrowthPage';
import { ContentPage } from './pages/ContentPage';
import { PlannerPage } from './pages/PlannerPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  OverviewIcon,
  GrowthIcon,
  ContentIcon,
  CalendarIcon,
  SettingsIcon,
} from './components/Icons';

function DashboardShell() {
  const { notifications, user, resetToFresh } = useDashboard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const mobileTabs = [
    { label: 'Overview', path: '/dashboard', icon: <OverviewIcon size={18} /> },
    { label: 'Growth', path: '/dashboard/growth', icon: <GrowthIcon size={18} /> },
    { label: 'Content', path: '/dashboard/content', icon: <ContentIcon size={18} /> },
    { label: 'Planner', path: '/dashboard/planner', icon: <CalendarIcon size={18} /> },
    { label: 'Settings', path: '/dashboard/settings', icon: <SettingsIcon size={18} /> },
  ];

  return (
    <div className="min-h-screen text-slate-100 flex relative font-body bg-[#08090A]">
      <AmbientBackground />

      {/* Sidebar (Desktop / Tablet Collapsible + Mobile Slide-Out Drawer) */}
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Bar (Mobile + Tablet + Desktop Responsive) */}
        <div className="sticky top-0 bg-panel/80 backdrop-blur-md z-30 flex items-center justify-between px-3.5 sm:px-6 md:px-8 py-3 border-b border-border2">
          <div className="flex items-center gap-2.5">
            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl border border-border2 text-slate-300 hover:text-amber hover:border-amber/40 bg-white/5 transition-colors"
              aria-label="Open mobile menu"
            >
              <Menu size={18} />
            </button>

            {/* Mobile Brand Mark */}
            <Link to="/" className="md:hidden flex items-center gap-1.5 mr-1">
              <OrbitMark size={20} animate={false} />
              <span className="font-display text-xs text-slate-100">
                Creator<span className="text-amber font-semibold">OS</span>
              </span>
            </Link>

            {/* Account Badge */}
            <div className="hidden xs:flex items-center gap-2">
              <span className="text-[11px] font-mono2 text-slate-400">Account:</span>
              <span className="text-[11px] font-semibold text-amber bg-amber/10 px-2.5 py-0.5 rounded-full border border-amber/20 truncate max-w-[140px] sm:max-w-none">
                {user?.name || 'Creator Chief'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell notifications={notifications} />

            <button
              onClick={resetToFresh}
              className="text-[11px] sm:text-xs text-slate-400 hover:text-slate-100 px-2.5 py-1.5 rounded-xl border border-border2 hover:bg-white/[0.05] transition-colors font-mono2 flex items-center gap-1.5"
              title="Reset state to clean slate"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset Session</span>
            </button>
          </div>
        </div>

        {/* Dashboard Main Page Area */}
        <div className="relative w-full max-w-[1600px] mx-auto px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8 bg-panel/60 backdrop-blur-lg min-h-[calc(100vh-4rem)] flex-1 pb-24 md:pb-8">
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(36,52,58,0) 0%, rgba(36,52,58,0.4) 100%)' }}
          />
          <div className="relative">
            <Routes>
              <Route index element={<Overview />} />
              <Route path="coordinator" element={<CoordinatorPage />} />
              <Route path="growth" element={<GrowthPage />} />
              <Route path="content" element={<ContentPage />} />
              <Route path="planner" element={<PlannerPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="connections" element={<ConnectionsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </div>

        {/* Mobile Bottom Quick Navigation Bar (< md screens) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/95 backdrop-blur-xl border-t border-border2 px-2 py-1.5 flex items-center justify-around">
          {mobileTabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                  isActive ? 'text-amber bg-amber/10 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-mono mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <DashboardShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </DashboardProvider>
    </BrowserRouter>
  );
}
