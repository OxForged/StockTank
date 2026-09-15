import React, { useState } from 'react';
import { TrendOpportunity, Platform } from '../types';
import { Zap, TrendingUp, Sparkles, PlusCircle } from 'lucide-react';

interface GrowthTabProps {
  opportunities: TrendOpportunity[];
  onTriggerTrendScan: () => void;
  onGenerateDraft: (opp: TrendOpportunity, platform: Platform) => void;
}

export const GrowthTab: React.FC<GrowthTabProps> = ({
  opportunities,
  onTriggerTrendScan,
  onGenerateDraft
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('twitter');

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white font-['Outfit']">Growth Agent — Trend Signal Discovery</h2>
          </div>
          <p className="text-xs text-slate-400">
            Autonomously polls X public signals, Reddit subreddits, and Google Trends. Scores topics 1–100 for virality and niche fit.
          </p>
        </div>

        <button
          onClick={onTriggerTrendScan}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 text-xs transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-4 h-4" />
          Poll Fresh Trends
        </button>
      </div>

      {/* Opportunities list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 p-5 rounded-2xl flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-amber-500/5 group"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {opp.category}
                </span>
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">{opp.opportunityScore}/100</span>
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                {opp.topic}
              </h3>

              <p className="text-xs text-slate-300 mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                <strong className="text-amber-400 font-medium">Recommended Angle:</strong> {opp.angle}
              </p>
            </div>

            <div>
              <div className="text-[10px] text-slate-500 mb-3 flex items-center justify-between">
                <span>Source: {opp.source}</span>
                <span>{opp.timestamp}</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
                  className="bg-slate-950 text-xs text-slate-300 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="twitter">X / Twitter</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="youtube_shorts">YT Shorts</option>
                </select>

                <button
                  onClick={() => onGenerateDraft(opp, selectedPlatform)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-all shadow-md shadow-blue-600/20"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Repurpose
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
