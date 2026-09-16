import React from 'react';
import { X, Users, Bot, Zap, Cpu, BarChart3, Video, CheckCircle2 } from 'lucide-react';

interface TeamRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamRolesModal: React.FC<TeamRolesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const roles = [
    {
      person: "Person 1 (YOU)",
      title: "Team Lead & Coordinator Agent Architect",
      icon: Bot,
      color: "from-blue-600 to-indigo-600",
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      duties: [
        "Minds Mind setup & cognition credits management",
        "Central Coordinator Agent routing & tool calls",
        "Memory namespace schemas (creator.profile)",
        "System architecture & GitHub repo maintenance"
      ]
    },
    {
      person: "Person 2",
      title: "Growth & Trend Discovery Agent Dev",
      icon: Zap,
      color: "from-amber-500 to-orange-600",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      duties: [
        "Public trend API signals (X, Reddit, Google Trends)",
        "Opportunity scoring engine (1-100 score)",
        "Writes to growth.opportunities memory namespace",
        "Autonomous background trend polling trigger"
      ]
    },
    {
      person: "Person 3",
      title: "Content Repurposing & Generation Dev",
      icon: Cpu,
      color: "from-purple-600 to-indigo-600",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      duties: [
        "Transcript & trend repurposing engine",
        "X Thread, LinkedIn, & YT Shorts native formatting",
        "Reads analytics memory for dynamic hook adaptation",
        "Saves output to content.drafts namespace"
      ]
    },
    {
      person: "Person 4",
      title: "Analytics & Persistence Loop Dev",
      icon: BarChart3,
      color: "from-emerald-600 to-teal-600",
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      duties: [
        "Social publishing API integration (Zernio / webhooks)",
        "Post metrics polling (views, engagement rate)",
        "Writes to analytics.performance_history memory",
        "Closes the multi-session Persistence Feedback Loop"
      ]
    },
    {
      person: "Person 5",
      title: "Frontend Dashboard & Video Demo Lead",
      icon: Video,
      color: "from-rose-600 to-pink-600",
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
      duties: [
        "Creator Dashboard UI (React/Vite)",
        "Real-time visual delegation trace & memory inspector",
        "Scripting, recording & editing the 1.5–2 min demo video",
        "Hackathon pitch presentation & submission"
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-['Outfit']">5-Person Team Role Split</h2>
              <p className="text-xs text-slate-400">CreatorOS Creative Minds Jam #1 Execution Matrix</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.person} className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-3 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${role.badgeColor}`}>
                    {role.person}
                  </span>
                  <div className={`p-1.5 rounded-lg bg-gradient-to-r ${role.color} text-white`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white">{role.title}</h3>

                <ul className="space-y-2 pt-2 border-t border-slate-800/80">
                  {role.duties.map((duty, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>{duty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Got it, Let's Build!
          </button>
        </div>

      </div>
    </div>
  );
};
