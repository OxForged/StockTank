import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronUp, ArrowRight, Sparkles } from 'lucide-react';
import { DelegationStep, ContentDraft } from '../types';

interface DelegationStepperProps {
  steps: DelegationStep[];
  drafts: ContentDraft[];
  isExecuting?: boolean;
  onGoToOverview?: () => void;
}

// Plain human status translator map
const plainStepTitle: Record<DelegationStep['agentName'], string> = {
  Coordinator: 'Understood your goal',
  'Growth Agent': 'Found trends & opportunities worth posting about',
  'Content Agent': 'Wrote your multi-platform drafts',
  'Analytics Agent': 'Learned from past virality & finalized hooks',
};

const plainStepSubtitle: Record<DelegationStep['agentName'], string> = {
  Coordinator: 'Analyzed your niche and growth targets',
  'Growth Agent': 'Scored viral topics across X, Reddit, and YouTube',
  'Content Agent': 'Formatted native posts with memory-optimized hooks',
  'Analytics Agent': 'Adapted tone and virality score based on memory',
};

export const DelegationStepper: React.FC<DelegationStepperProps> = ({
  steps,
  drafts,
  isExecuting = false,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const pendingDrafts = drafts.filter((d) => d.status === 'pending_approval');
  const hasSteps = steps.length > 0;

  if (!hasSteps && !isExecuting) {
    return (
      <div className="bg-panel/40 border border-border2 p-8 rounded-2xl text-center space-y-4 backdrop-blur-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber/10 border border-amber/25 flex items-center justify-center mx-auto text-amber">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto">
          <h3 className="font-display text-lg text-slate-100 mb-1.5">Nothing's happening yet</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Head to Overview and tell CreatorOS what you want, and you'll see your agents work here.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm"
          >
            ← Head to Overview
          </Link>
        </div>
      </div>
    );
  }

  // Define 4 standard human steps
  const stepperItems = [
    {
      agentName: 'Coordinator' as const,
      title: 'Understood your goal',
      desc: steps.find((s) => s.agentName === 'Coordinator')?.details || 'Analyzed your niche and growth targets',
      done: steps.some((s) => s.agentName === 'Coordinator' && s.status === 'completed') || steps.length > 0,
      active: isExecuting && steps.length === 0,
    },
    {
      agentName: 'Growth Agent' as const,
      title: 'Found 3 things worth posting about',
      desc: steps.find((s) => s.agentName === 'Growth Agent')?.details || 'Scored viral topics across X, Reddit & YouTube',
      done: steps.some((s) => s.agentName === 'Growth Agent' && s.status === 'completed') || steps.length >= 2,
      active: isExecuting && steps.length === 1,
    },
    {
      agentName: 'Content Agent' as const,
      title: 'Wrote your multi-platform drafts',
      desc: steps.find((s) => s.agentName === 'Content Agent')?.details || 'Formatted native posts with memory-optimized hooks',
      done: steps.some((s) => s.agentName === 'Content Agent' && s.status === 'completed') || steps.length >= 3,
      active: isExecuting && steps.length === 2,
    },
    {
      agentName: 'Analytics Agent' as const,
      title: 'Learned from past post virality',
      desc: steps.find((s) => s.agentName === 'Analytics Agent')?.details || 'Adapted tone and virality score based on memory',
      done: steps.some((s) => s.agentName === 'Analytics Agent') || steps.length >= 4,
      active: isExecuting && steps.length === 3,
    },
  ];

  return (
    <div className="bg-panel/40 border border-border2 rounded-2xl p-6 backdrop-blur-xl space-y-6">
      <div className="flex items-center justify-between border-b border-border2 pb-4">
        <div>
          <h3 className="text-lg font-display text-slate-50 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber" />
            Agent Progress
          </h3>
          <p className="text-xs text-slate-300 font-mono2">
            {isExecuting ? 'CreatorOS is working on your goal…' : 'Goal execution complete'}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald2 font-mono bg-emerald2/10 border border-emerald2/25 px-3 py-1 rounded-full font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald2 animate-pulse" />
          {isExecuting ? 'Working' : 'Ready'}
        </span>
      </div>

      {/* Vertical 4-Step Stepper */}
      <div className="space-y-4 pl-2">
        {stepperItems.map((item, index) => {
          const isFinished = item.done;
          const isActive = item.active;

          return (
            <div key={index} className="flex items-start gap-3.5 group">
              <div className="relative flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    isFinished
                      ? 'bg-emerald2/20 border-2 border-emerald2 text-emerald2'
                      : isActive
                      ? 'bg-amber/20 border-2 border-amber text-amber animate-pulse'
                      : 'bg-white/5 border border-border2 text-slate-500'
                  }`}
                >
                  {isFinished ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-mono font-bold">{index + 1}</span>
                  )}
                </div>
                {index < stepperItems.length - 1 && (
                  <div
                    className={`w-0.5 h-8 my-1 ${
                      isFinished ? 'bg-emerald2/40' : 'bg-border2'
                    }`}
                  />
                )}
              </div>

              <div className="flex-1 bg-canvas/40 border border-border2 p-3.5 rounded-xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-100">
                    {item.title} {isFinished && <span className="text-emerald2 ml-1">✓</span>}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {plainStepTitle[item.agentName] ? item.agentName : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                  {plainStepSubtitle[item.agentName]}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actionable Next Step CTA */}
      {drafts.length > 0 && !isExecuting && (
        <div className="bg-amber/10 border border-amber/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
          <div>
            <span className="font-semibold text-slate-100 text-sm block">
              {pendingDrafts.length > 0
                ? `${pendingDrafts.length} drafts are ready to review`
                : `${drafts.length} drafts generated and ready`}
            </span>
            <span className="text-xs text-slate-300 font-mono2">
              Review memory-optimized hooks and approve for publishing.
            </span>
          </div>

          <Link
            to="/dashboard/content"
            className="flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm shrink-0 whitespace-nowrap"
          >
            <span>Review Drafts</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Collapsible Technical Detail Toggle */}
      {steps.length > 0 && (
        <div className="pt-2 border-t border-border2">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors font-mono font-medium py-1"
          >
            <span>See exactly how this happened (Technical Trace Log)</span>
            {showTechnicalDetails ? <ChevronUp className="w-4 h-4 text-amber" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showTechnicalDetails && (
            <div className="mt-3 space-y-2.5 animate-fadeIn">
              {steps.map((step, idx) => (
                <div key={step.id || idx} className="bg-canvas/80 border border-border2 p-3 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-amber">{step.agentName}</span>
                    <span className="font-mono2 text-[10px] text-slate-400">{step.timestamp}</span>
                  </div>
                  <p className="text-xs font-mono2 text-slate-300 bg-black/40 p-2 rounded border border-border2">
                    {step.details}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
