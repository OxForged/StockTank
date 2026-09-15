import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp, PenLine, BarChart3, Network, Users, Handshake } from 'lucide-react';
import { Nav } from '../components/Nav';
import { OrbitMark } from '../components/OrbitMark';
import { HeroBackground } from '../components/HeroBackground';
import { ReelBackground } from '../components/ReelBackground';
import { DelegationTrace } from '../components/DelegationTrace';
import { Reveal } from '../components/Reveal';
import { DelegationStep } from '../types';

const exampleTrace: DelegationStep[] = [
  { id: '1', timestamp: 'now', agentName: 'Coordinator', action: 'Objective received', details: 'Goal: grow my audience', status: 'completed' },
  { id: '2', timestamp: 'now', agentName: 'Growth Agent', action: 'Trends scored', details: '3 opportunities found', status: 'completed' },
  { id: '3', timestamp: 'now', agentName: 'Content Agent', action: 'Drafts generated', details: '3 platform-native drafts ready', status: 'completed' },
  { id: '4', timestamp: 'now', agentName: 'Analytics Agent', action: 'Prediction ready', details: 'Predicts hook #1 as the winner', status: 'active' },
];

const liveAgents = [
  { name: 'Coordinator', role: 'Holds your goal and routes work to the right agent', icon: Network, color: '#F2F1EC' },
  { name: 'Growth agent', role: 'Finds trending topics worth posting about', icon: TrendingUp, color: '#39C6D6' },
  { name: 'Content agent', role: 'Drafts a platform-native post from the opportunity', icon: PenLine, color: '#E8A339' },
  { name: 'Analytics agent', role: 'Learns from what worked, feeds the next draft', icon: BarChart3, color: '#37C48A' },
];

const roadmapAgents = [
  { name: 'Community agent', role: 'Reads your comments and DMs and flags what people want', icon: Users },
  { name: 'Brand agent', role: 'Finds and evaluates sponsorship opportunities for you', icon: Handshake },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber border border-amber/25 bg-amber/[0.06] rounded-full px-3.5 py-1.5">
      {children}
    </span>
  );
}

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-slate-100 font-body">
      <HeroBackground />
      <Nav />

      {/* Hero */}
      <section className="relative h-[88vh] min-h-[600px] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed animate-kenburns"
          style={{ backgroundImage: 'url(/images/hero-bg.png)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(100deg, rgba(8,9,10,0.88) 0%, rgba(8,9,10,0.62) 38%, rgba(8,9,10,0.22) 65%, rgba(8,9,10,0.15) 100%)' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-canvas/70" />

        <div className="relative h-full max-w-6xl mx-auto px-6 flex items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 border border-white/15 bg-canvas/30 backdrop-blur-sm rounded-full px-3 py-1 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-amber" />
              Your AI chief of staff
            </div>
            <h1 className="font-display text-6xl md:text-7xl leading-[1.02] tracking-tight mb-6" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.4)' }}>
              An AI chief
              <br />
              of staff for{' '}
              <span className="italic font-normal text-amber">creators</span>.
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed mb-10 max-w-md" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
              State a goal. A team of specialized agents finds the opportunity, drafts the content,
              and gets it ready for your approval — before anything goes live.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 bg-amber text-[#08090A] font-semibold px-6 py-3.5 rounded-xl hover:bg-amber-soft transition-all shadow-sm text-sm"
              >
                Open CreatorOS Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#how-it-works" className="inline-flex items-center gap-2 text-slate-100/90 hover:text-slate-100 transition-colors px-2 py-3 text-sm">
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Problem statement */}
      <section className="min-h-screen flex items-center">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center w-full">
          <Reveal>
            <Eyebrow>THE PROBLEM</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl leading-snug mt-6 mb-5">
              Every creator has the same two problems:
              <span className="text-slate-400"> burnout from repurposing, and missed timing on trends.</span>
            </h2>
            <p className="text-slate-400 leading-relaxed max-w-xl mx-auto text-sm">
              CreatorOS finds what's worth posting about, drafts it in your voice, and gets sharper
              every time you approve or skip a post — so you spend less time guessing.
            </p>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Eyebrow>HOW IT WORKS</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mt-6 mb-4">
              One goal. A full agent trace.
            </h2>
            <p className="text-slate-400 text-sm">
              An example run below. In the real dashboard, this happens with your own goal, for real.
            </p>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <DelegationTrace steps={exampleTrace} />
        </Reveal>
      </section>

      {/* Agents grid */}
      <section id="agents" className="max-w-6xl mx-auto px-6 py-24 border-t border-border2">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <Eyebrow>THE TEAM</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mt-6">
              Four agents, live today.
            </h2>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-4">
          {liveAgents.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <Reveal key={agent.name} delay={i * 90}>
                <div className="rounded-xl border border-border2 bg-panel/40 backdrop-blur-md p-6 hover:bg-panel/60 transition-colors h-full">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: `${agent.color}1A`, color: agent.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-display text-lg mb-1.5">{agent.name}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{agent.role}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Bottom of page */}
      <div className="relative">
        <ReelBackground opacity={0.3} />

        <section className="max-w-6xl mx-auto px-6 py-24">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <Eyebrow>WHAT'S NEXT</Eyebrow>
              <h2 className="font-display text-3xl md:text-4xl tracking-tight mt-6 mb-4">
                Here's what's live. Here's what's next.
              </h2>
              <p className="text-slate-400 text-sm">Two more agents are on the way.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4">
            {roadmapAgents.map((agent, i) => {
              const Icon = agent.icon;
              return (
                <Reveal key={agent.name} delay={i * 90}>
                  <div className="rounded-xl border border-dashed border-border2-strong bg-canvas/50 backdrop-blur-md p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5">
                        <Icon className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 border border-border2-strong rounded-full px-2 py-0.5">
                        SOON
                      </span>
                    </div>
                    <h3 className="font-display text-lg mb-1.5 text-slate-300">{agent.name}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{agent.role}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        <footer className="bg-canvas/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <OrbitMark size={22} animate={false} />
              <span className="font-display text-sm">
                Creator<span className="text-amber font-semibold">OS</span>
              </span>
            </div>
            <p className="text-slate-500 text-xs font-mono2">Your AI chief of staff</p>
          </div>
        </footer>
      </div>
    </div>
  );
};
