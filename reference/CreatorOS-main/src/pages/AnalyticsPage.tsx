import React from 'react';
import { Link } from 'react-router-dom';
import { Link as LinkIcon, RefreshCcw } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { Reveal } from '../components/Reveal';
import { AnalyticsIcon, XIcon, LinkedInIcon, YouTubeIcon, ConnectionsIcon } from '../components/Icons';
import { Platform } from '../types';

const PlatformMetricLogo: React.FC<{ platformId: Platform }> = ({ platformId }) => {
  if (platformId === 'twitter') return <XIcon size={14} className="text-white inline mr-1.5" />;
  if (platformId === 'linkedin') return <LinkedInIcon size={14} className="text-[#0A66C2] inline mr-1.5" />;
  return <YouTubeIcon size={14} className="text-[#FF0000] inline mr-1.5" />;
};

export const AnalyticsPage: React.FC = () => {
  const { metrics, loadDemoData, connectedCount } = useDashboard();

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2.5 mb-2">
            <AnalyticsIcon size={24} className="text-amber" />
            <h1 className="text-2xl font-display text-amber">Analytics agent</h1>
          </div>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-5 max-w-2xl">
            After a post goes live, this checks how it performed and uses that to make your next
            draft's hook even better — so CreatorOS gets sharper the more you use it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-canvas/60 p-4 rounded-xl border border-border2">
              <div className="text-xs text-slate-300 uppercase font-mono font-semibold">Avg engagement</div>
              <div className="text-xl md:text-2xl font-display font-bold text-emerald2 mt-1">
                {metrics.length > 0 ? '9.7% (+36%)' : '0.0%'}
              </div>
            </div>
            <div className="bg-canvas/60 p-4 rounded-xl border border-border2">
              <div className="text-xs text-slate-300 uppercase font-mono font-semibold">Learning status</div>
              <div className="text-xl md:text-2xl font-display font-bold text-teal mt-1">
                {connectedCount > 0 ? 'Active' : 'Awaiting Connection'}
              </div>
            </div>
            <div className="bg-canvas/60 p-4 rounded-xl border border-border2">
              <div className="text-xs text-slate-300 uppercase font-mono font-semibold">Recent adaptation</div>
              <div className="text-xl md:text-2xl font-display font-bold text-amber mt-1">
                {metrics.length > 0 ? 'Contrarian + visual' : 'None yet'}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="flex items-center justify-between pt-2">
          <h2 className="font-display text-lg text-slate-100 flex items-center gap-2">
            <AnalyticsIcon size={20} className="text-emerald2" />
            Recent Post Performance History
          </h2>
        </div>
      </Reveal>

      {metrics.length === 0 ? (
        <Reveal delay={150}>
          <div className="bg-panel/40 border border-border2 p-10 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-6 backdrop-blur-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber/10 border border-amber/25 flex items-center justify-center mx-auto text-amber">
              <ConnectionsIcon size={24} />
            </div>
            <div>
              <h3 className="font-display text-lg text-slate-100 mb-1">No Performance History Yet</h3>
              <p className="text-sm text-slate-300 font-mono2 leading-relaxed">
                Connect your social platforms and publish drafts to enable AI memory learning.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/dashboard/connections"
                className="inline-flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm"
              >
                <LinkIcon className="w-4 h-4" />
                Connect Platforms
              </Link>
              <button
                onClick={loadDemoData}
                className="inline-flex items-center gap-2 border border-border2 hover:bg-white/5 text-slate-200 font-medium px-4 py-2.5 rounded-xl text-xs transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Load Sample Data
              </button>
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="border-t border-border2">
          {metrics.map((metric, i) => (
            <Reveal key={metric.postId + i} delay={i * 70}>
              <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 px-2 py-5 border-b border-border2 items-center">
                <div>
                  <span className="inline-flex items-center text-xs font-mono uppercase px-3 py-1 rounded-lg bg-white/5 text-slate-200 border border-border2 font-semibold">
                    <PlatformMetricLogo platformId={metric.platform} />
                    {metric.platform}
                  </span>
                  <p className="text-xs text-slate-400 mt-1 font-mono2">{metric.timestamp}</p>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-100">{metric.hookStyle}</div>
                  <p className="text-sm text-emerald2 leading-relaxed mt-1">
                    {metric.insight}
                  </p>
                </div>

                <div className="flex items-center gap-6 shrink-0 text-right">
                  <div>
                    <div className="text-xs text-slate-400 font-mono">Views</div>
                    <div className="text-sm font-bold text-slate-100">{metric.views.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-mono">Engagement</div>
                    <div className="text-sm font-bold text-emerald2">{metric.engagementRate}%</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
};
