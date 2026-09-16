import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { DelegationStepper } from '../components/DelegationStepper';
import { Reveal } from '../components/Reveal';
import { CoordinatorIcon } from '../components/Icons';

export const CoordinatorPage: React.FC = () => {
  const { trace, drafts, isExecuting } = useDashboard();

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-center gap-2.5 mb-2">
          <CoordinatorIcon size={24} className="text-amber" />
          <h1 className="font-display text-2xl text-amber">Coordinator agent</h1>
        </div>
        <p className="text-slate-300 text-sm md:text-base max-w-2xl leading-relaxed">
          Holds your goal and calls each agent in order, so you can see exactly how it got to a
          finished draft — not just the end result.
        </p>
      </Reveal>
      <Reveal delay={100}>
        <DelegationStepper steps={trace} drafts={drafts} isExecuting={isExecuting} />
      </Reveal>
    </div>
  );
};
