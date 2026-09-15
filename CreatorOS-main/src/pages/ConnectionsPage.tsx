import React from 'react';
import { ArrowUpRight, AlertTriangle } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { Reveal } from '../components/Reveal';
import { ConnectionsIcon, XIcon, LinkedInIcon, YouTubeIcon, InstagramIcon, TikTokIcon, ThreadsIcon } from '../components/Icons';
import { Platform } from '../types';

const statusMeta = {
  connected: { dot: 'bg-emerald2', label: 'Connected' },
  connecting: { dot: 'bg-amber animate-pulse', label: 'Redirecting…' },
  disconnected: { dot: 'bg-slate-500', label: 'Not connected' },
};

const PlatformLogo: React.FC<{ platformId: Platform }> = ({ platformId }) => {
  if (platformId === 'twitter') return <XIcon size={16} className="text-white" />;
  if (platformId === 'linkedin') return <LinkedInIcon size={16} className="text-[#0A66C2]" />;
  if (platformId === 'instagram') return <InstagramIcon size={16} className="text-[#E4405F]" />;
  if (platformId === 'tiktok') return <TikTokIcon size={16} className="text-[#00F2FE]" />;
  if (platformId === 'threads') return <ThreadsIcon size={16} className="text-slate-200" />;
  return <YouTubeIcon size={16} className="text-[#FF0000]" />;
};

export const ConnectionsPage: React.FC = () => {
  const { platforms, connectedCount, connectPlatform, disconnectPlatform, zernioConfigured } = useDashboard();

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-2xl text-amber flex items-center gap-2.5">
            <ConnectionsIcon size={22} className="text-amber" />
            Connections
          </h1>
          <span className="text-xs font-mono2 text-slate-400">{connectedCount} connected</span>
        </div>
        <p className="text-slate-400 text-sm max-w-xl">
          Connect your LinkedIn, YouTube, Instagram, TikTok, Threads, and X channels. Free platforms connect instantly with $0 API fees.
        </p>
      </Reveal>

      {zernioConfigured === false && (
        <Reveal>
          <div className="flex items-start gap-3 bg-amber/10 border border-amber/25 rounded-xl p-4">
            <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
            <p className="text-xs text-amber/90 leading-relaxed">
              Real connections aren't set up yet. Add <code className="font-mono2">ZERNIO_API_KEY</code> and{' '}
              <code className="font-mono2">ZERNIO_PROFILE_ID</code> to your local <code className="font-mono2">.env</code> file to enable live OAuth posting.
            </p>
          </div>
        </Reveal>
      )}

      <div className="border-t border-border2">
        {platforms.map((p, i) => {
          const meta = statusMeta[p.status];
          return (
            <Reveal key={p.id} delay={i * 50}>
              <div className="flex items-center justify-between py-4 border-b border-border2">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-border2 flex items-center justify-center shrink-0">
                    <PlatformLogo platformId={p.id} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-100">{p.name}</p>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {p.id !== 'twitter' ? (
                        <span className="text-[9px] font-mono uppercase bg-emerald2/10 text-emerald2 border border-emerald2/20 px-1.5 py-0.5 rounded">
                          $0 Free
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono uppercase bg-amber/10 text-amber border border-amber/20 px-1.5 py-0.5 rounded">
                          Paid API
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono2 mt-0.5">{meta.label}</p>
                  </div>
                </div>
                {p.status === 'connected' && (
                  <button
                    onClick={() => disconnectPlatform(p.id)}
                    className="text-xs font-medium text-slate-300 border border-border2-strong px-3.5 py-1.5 rounded-lg hover:text-slate-50 hover:bg-white/[0.05] transition-colors"
                  >
                    Disconnect
                  </button>
                )}
                {p.status === 'disconnected' && (
                  <button
                    onClick={() => connectPlatform(p.id)}
                    className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-[#08090A] px-4 py-1.5 rounded-lg hover:bg-white transition-colors shadow-sm"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Connect
                  </button>
                )}
                {p.status === 'connecting' && (
                  <span className="text-xs font-mono2 text-slate-500 px-3.5 py-1.5">Redirecting…</span>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
};
