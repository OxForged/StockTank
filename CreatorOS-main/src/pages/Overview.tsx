import React, { useState } from 'react';
import { Send, RefreshCw, Zap, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { Reveal } from '../components/Reveal';
import { OverviewIcon, ConnectionsIcon } from '../components/Icons';
import { DelegationStepper } from '../components/DelegationStepper';

const suggestions = [
  'Grow my YouTube channel',
  'Get more engagement on X',
  'Prepare LinkedIn thought-leadership posts',
];

export const Overview: React.FC = () => {
  const {
    profile,
    opportunities,
    drafts,
    trace,
    connectedCount,
    isExecuting,
    runGoal,
    loadDemoData,
    resetToFresh,
  } = useDashboard();
  const [goalInput, setGoalInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;
    const value = goalInput;
    setGoalInput('');
    await runGoal(value);
  };

  const submitSuggestion = async (text: string) => {
    if (isExecuting) return;
    await runGoal(text);
  };

  const pendingCount = drafts.filter((d) => d.status === 'pending_approval').length;
  const isEmpty = opportunities.length === 0 && drafts.length === 0;

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-center gap-2.5 mb-2">
          <OverviewIcon size={24} className="text-amber" />
          <h1 className="font-display text-2xl text-amber">Overview</h1>
        </div>
        <p className="text-slate-300 text-base max-w-xl leading-relaxed">
          Tell CreatorOS what you're trying to grow. It finds the opportunity, drafts the content,
          and gets it ready for your approval.
        </p>
      </Reveal>

      {/* Onboarding Account Connection Alert for fresh accounts */}
      {connectedCount === 0 && (
        <Reveal delay={40}>
          <div className="bg-amber/10 border border-amber/30 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber/20 text-amber shrink-0">
                <ConnectionsIcon size={22} />
              </div>
              <div>
                <span className="font-semibold text-slate-100 text-sm block">Step 1: Connect your Social Accounts</span>
                <span className="text-slate-300 text-xs font-mono2">Connect LinkedIn, YouTube, Instagram, TikTok, Threads, or X to unlock automatic publishing and memory adaptation.</span>
              </div>
            </div>

            <Link
              to="/dashboard/connections"
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-4 py-2.5 rounded-xl shrink-0 transition-all shadow-sm text-xs"
            >
              <LinkIcon className="w-4 h-4" />
              Connect Accounts Now
            </Link>
          </div>
        </Reveal>
      )}

      <Reveal delay={80}>
        <div className="grid grid-cols-3 border-y border-border2 py-2">
          <div className="px-2 py-5 border-r border-border2">
            <p className="text-3xl font-display font-bold text-slate-100">{opportunities.length}</p>
            <p className="text-slate-300 text-sm font-mono font-medium mt-1">opportunities found</p>
          </div>
          <div className="px-6 py-5 border-r border-border2">
            <p className="text-3xl font-display font-bold text-slate-100">{pendingCount}</p>
            <p className="text-slate-300 text-sm font-mono font-medium mt-1">drafts awaiting approval</p>
          </div>
          <div className="px-6 py-5">
            <p className="text-3xl font-display font-bold text-slate-100">{connectedCount}<span className="text-slate-400 font-normal text-xl">/7</span></p>
            <p className="text-slate-300 text-sm font-mono font-medium mt-1">accounts connected</p>
          </div>
        </div>
      </Reveal>

      {/* Goal Input Card */}
      <Reveal delay={140}>
        <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display text-slate-50">What's your goal today?</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-canvas/60 px-3 py-1.5 rounded-xl border border-border2">
              <Zap className="w-4 h-4 text-amber" />
              <span>Voice: <strong className="text-slate-100 font-semibold">{profile.brandVoice.split(',')[0]}</strong></span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="e.g. 'Help me grow my YouTube channel this week'"
              className="flex-1 bg-canvas border border-border2-strong focus:border-amber/50 rounded-xl px-5 py-3.5 text-base text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={isExecuting}
              className="flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-6 py-3.5 rounded-xl text-xs transition-all disabled:opacity-50 shadow-sm shrink-0"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Working on it…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Start
                </>
              )}
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => submitSuggestion(s)}
                disabled={isExecuting}
                className="text-xs text-slate-300 border border-border2-strong rounded-full px-3.5 py-1.5 hover:text-slate-100 hover:border-white/30 transition-colors disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Live Simplified Progress Stepper directly on Overview */}
      {(isExecuting || trace.length > 0) && (
        <Reveal delay={160}>
          <DelegationStepper steps={trace} drafts={drafts} isExecuting={isExecuting} />
        </Reveal>
      )}

      {isEmpty ? (
        <Reveal delay={180}>
          <p className="text-sm text-slate-400">
            Nothing here yet — that's expected for a new account.{' '}
            <button onClick={loadDemoData} className="text-amber hover:underline font-semibold">
              Load sample data
            </button>{' '}
            if you want to preview sample metrics & connected accounts.
          </p>
        </Reveal>
      ) : (
        <Reveal delay={180}>
          <p className="text-sm text-slate-400">
            Testing with sample data?{' '}
            <button onClick={resetToFresh} className="text-amber hover:underline font-semibold">
              Reset to a fresh account
            </button>
            . This clears local state — it doesn't affect live social posts.
          </p>
        </Reveal>
      )}
    </div>
  );
};
