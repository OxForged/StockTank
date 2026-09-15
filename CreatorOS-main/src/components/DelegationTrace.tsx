import React from 'react';
import { DelegationStep } from '../types';
import { Bot, CheckCircle2, Clock } from 'lucide-react';

interface DelegationTraceProps {
  steps: DelegationStep[];
}

const agentColor: Record<DelegationStep['agentName'], string> = {
  Coordinator: '#F2F1EC',
  'Growth Agent': '#39C6D6',
  'Content Agent': '#E8A339',
  'Analytics Agent': '#37C48A',
};

export const DelegationTrace: React.FC<DelegationTraceProps> = ({ steps }) => {
  return (
    <div className="bg-panel/40 border border-border2 rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5 border border-border2 text-slate-200">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display text-slate-50">Delegation trace</h3>
            <p className="text-xs text-slate-400">Watch each agent hand off work, in order</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald2 font-mono bg-emerald2/10 border border-emerald2/25 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald2 animate-pulse" />
          Live
        </span>
      </div>

      <div className="relative border-l-2 border-border2 ml-4 space-y-6 pl-6">
        {steps.map((step, idx) => {
          const color = agentColor[step.agentName];
          return (
            <div key={step.id || idx} className="relative group">
              <div
                className="absolute -left-[31px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  background: step.status === 'completed' ? `${color}1A` : `${color}26`,
                  borderColor: color,
                  color,
                }}
              >
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                )}
              </div>

              <div className="bg-canvas/40 border border-border2 hover:border-white/20 p-4 rounded-xl transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded-md border"
                      style={{ background: `${color}1A`, color, borderColor: `${color}40` }}
                    >
                      {step.agentName}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">{step.action}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono2">{step.timestamp}</span>
                </div>
                <p className="text-xs text-slate-300 font-mono2 leading-relaxed bg-canvas/60 p-2.5 rounded-lg border border-border2">
                  {step.details}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
