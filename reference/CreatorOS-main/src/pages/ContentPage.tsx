import React, { useState } from 'react';
import { CheckCircle, Send, AlertCircle, Link as LinkIcon, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { Reveal } from '../components/Reveal';
import { ContentIcon, XIcon, LinkedInIcon, YouTubeIcon, ConnectionsIcon } from '../components/Icons';
import { Platform } from '../types';

const platformLabel: Record<string, string> = {
  twitter: 'X / Twitter thread',
  linkedin: 'LinkedIn post',
  youtube_shorts: 'YT Shorts script',
  youtube_longform: 'YouTube Longform Video',
};

const PlatformBadgeLogo: React.FC<{ platformId: Platform }> = ({ platformId }) => {
  if (platformId === 'twitter') return <XIcon size={14} className="text-white inline mr-1.5" />;
  if (platformId === 'linkedin') return <LinkedInIcon size={14} className="text-[#0A66C2] inline mr-1.5" />;
  return <YouTubeIcon size={14} className="text-[#FF0000] inline mr-1.5" />;
};

export const ContentPage: React.FC = () => {
  const { drafts, approveDraft, manualGenerate, loadDemoData, connectedCount } = useDashboard();
  const [customInput, setCustomInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    const value = customInput;
    setCustomInput('');
    await manualGenerate(value);
  };

  const pendingCount = drafts.filter((d) => d.status === 'pending_approval').length;

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2.5 mb-3">
            <ContentIcon size={24} className="text-amber" />
            <h1 className="text-2xl font-display text-amber">Content agent</h1>
          </div>
          <p className="text-sm md:text-base text-slate-300 mb-4 max-w-xl leading-relaxed">
            Paste a video script, transcript, or article link. The Content agent reads performance
            memory to adapt hook styles before formatting native posts.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="e.g. Paste transcript: 'In this video we talk about Minds agent memory namespaces...'"
              className="flex-1 bg-canvas border border-border2-strong focus:border-amber/50 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-5 py-3 rounded-xl text-xs transition-all shadow-sm shrink-0"
            >
              Repurpose
            </button>
          </form>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="flex items-center justify-between pt-2">
          <h2 className="font-display text-lg text-slate-50">Drafts awaiting approval</h2>
          <span className="text-xs font-mono font-semibold text-slate-300 bg-white/5 px-2.5 py-1 rounded-md border border-border2">{pendingCount} pending</span>
        </div>
      </Reveal>

      {drafts.length === 0 ? (
        <Reveal delay={150}>
          <div className="bg-panel/40 border border-border2 p-10 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-6 backdrop-blur-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber/10 border border-amber/25 flex items-center justify-center mx-auto text-amber">
              <ConnectionsIcon size={24} />
            </div>
            <div>
              <h3 className="font-display text-lg text-slate-100 mb-1">No Content Drafts Yet</h3>
              <p className="text-sm text-slate-300 font-mono2 leading-relaxed">
                {connectedCount === 0
                  ? 'Connect your social media accounts or paste a transcript above to start generating memory-optimized drafts.'
                  : 'Paste a video transcript or topic above to let your Content Agent format native drafts.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                to="/dashboard/connections"
                className="inline-flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm"
              >
                <LinkIcon className="w-4 h-4" />
                Connect Social Accounts
              </Link>
              <button
                onClick={loadDemoData}
                className="inline-flex items-center gap-2 border border-border2 hover:bg-white/5 text-slate-200 font-medium px-4 py-2.5 rounded-xl text-xs transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Load Sample Demo Data
              </button>
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="border-t border-border2">
          {drafts.map((draft, i) => (
            <Reveal key={draft.id} delay={i * 70}>
              <div className="grid md:grid-cols-[1fr_auto] gap-6 px-2 py-6 border-b border-border2 items-start">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center text-xs font-mono uppercase px-3 py-1 rounded-lg bg-teal/10 text-teal border border-teal/25 font-semibold">
                      <PlatformBadgeLogo platformId={draft.platform} />
                      {platformLabel[draft.platform]}
                    </span>
                    <span
                      className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
                        draft.status === 'published'
                          ? 'bg-emerald2/10 text-emerald2 border-emerald2/25 font-semibold'
                          : 'bg-amber/10 text-amber border-amber/25 font-semibold'
                      }`}
                    >
                      {draft.status === 'published' ? 'Published' : 'Pending approval'}
                    </span>
                  </div>

                  <div className="bg-canvas/60 p-4 rounded-xl border border-border2">
                    <div className="text-xs uppercase font-mono text-slate-300 font-semibold mb-1">Memory-optimized hook</div>
                    <p className="text-sm md:text-base font-semibold text-amber leading-snug">{draft.hook}</p>
                  </div>

                  <div className="bg-canvas/40 p-4 rounded-xl border border-border2">
                    <div className="text-xs uppercase font-mono text-slate-300 font-semibold mb-1">Full Content Body</div>
                    <p className="text-sm text-slate-100 whitespace-pre-wrap font-mono2 leading-relaxed">{draft.body}</p>
                  </div>

                  {draft.cta && (
                    <div className="text-xs text-slate-200 bg-white/[0.04] p-3 rounded-lg border border-border2">
                      <strong className="text-slate-100 font-semibold">CTA:</strong> {draft.cta}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap bg-canvas/60 px-3 py-1.5 rounded-lg border border-border2">
                    <AlertCircle className="w-4 h-4 text-teal" />
                    <span>Virality Score: <strong className="text-slate-100 font-bold">{draft.predictedPerformanceScore}%</strong></span>
                  </div>

                  {draft.status === 'pending_approval' ? (
                    <button
                      onClick={() => approveDraft(draft.id)}
                      className="flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] text-xs font-semibold py-2.5 px-4.5 rounded-xl transition-all whitespace-nowrap shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve & publish
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-emerald2 font-semibold whitespace-nowrap bg-emerald2/10 px-3 py-1.5 rounded-xl border border-emerald2/30">
                      <Send className="w-4 h-4" />
                      Live on platform
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
};
