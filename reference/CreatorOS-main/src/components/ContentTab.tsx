import React, { useState } from 'react';
import { ContentDraft } from '../types';
import { Cpu, CheckCircle, Send, Sparkles, AlertCircle } from 'lucide-react';

interface ContentTabProps {
  drafts: ContentDraft[];
  onApproveDraft: (id: string) => void;
  onManualGenerate: (prompt: string) => void;
}

export const ContentTab: React.FC<ContentTabProps> = ({
  drafts,
  onApproveDraft,
  onManualGenerate
}) => {
  const [customInput, setCustomInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onManualGenerate(customInput);
    setCustomInput('');
  };

  return (
    <div className="space-y-6">
      {/* Quick repurpose bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-bold text-white font-['Outfit']">Content Agent — Multi-Platform Repurposer</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Paste a video script, podcast transcript, or article link. The Content Agent reads historical performance memory to format native posts.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="e.g. Paste transcript: 'In this video we talk about Minds agent memory namespaces...'"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-purple-600/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Repurpose
          </button>
        </form>
      </div>

      {/* Draft approval grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                  draft.platform === 'twitter'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : draft.platform === 'linkedin'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {draft.platform === 'twitter' ? 'X / Twitter Thread' : draft.platform === 'linkedin' ? 'LinkedIn Post' : 'YT Shorts Script'}
                </span>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  draft.status === 'published'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {draft.status === 'published' ? 'Published' : 'Pending Approval'}
                </span>
              </div>

              {/* Hook Box */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 mb-3">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Memory-Optimized Hook</div>
                <p className="text-xs font-semibold text-amber-300">{draft.hook}</p>
              </div>

              {/* Body Content */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/60 mb-3">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Body Content</div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{draft.body}</p>
              </div>

              {draft.cta && (
                <div className="text-[11px] text-purple-300 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                  <strong className="text-purple-400">CTA:</strong> {draft.cta}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
                <span>Virality Score: <strong className="text-white">{draft.predictedPerformanceScore}%</strong></span>
              </div>

              {draft.status === 'pending_approval' ? (
                <button
                  onClick={() => onApproveDraft(draft.id)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-1.5 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve & Publish
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                  <Send className="w-3.5 h-3.5" />
                  Live on Platform
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
