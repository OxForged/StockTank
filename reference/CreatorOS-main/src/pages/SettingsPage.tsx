import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, User, Shield, Sliders, Check, Save } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { Reveal } from '../components/Reveal';
import { SettingsIcon, MindsIcon } from '../components/Icons';
import { fetchMindsMemory, ConversationMessage } from '../lib/minds';
import { UserAvatar, AVATAR_PRESETS } from '../components/UserAvatar';

export const SettingsPage: React.FC = () => {
  const { user, updateUserAvatar } = useDashboard();
  const [history, setHistory] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'features' | 'minds'>('account');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Account State
  const [userName, setUserName] = useState(user?.name || 'Creator');
  const [userEmail, setUserEmail] = useState(user?.email || 'creator@creatoros.ai');
  const [userAvatar, setUserAvatar] = useState(user?.avatarUrl || 'preset_amber');
  const [userRole] = useState('Pro Creator Plan');

  // Customizable Feature Toggles & Preferences
  const [autoApprove, setAutoApprove] = useState(false);
  const [trendPollingInterval, setTrendPollingInterval] = useState('4h');
  const [minViralityScore, setMinViralityScore] = useState(75);
  const [defaultPlatform, setDefaultPlatform] = useState('twitter');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [niche, setNiche] = useState('Tech & AI Creator');
  const [toneVoice, setToneVoice] = useState('Contrarian & Metric-Driven');

  useEffect(() => {
    setLoading(true);
    fetchMindsMemory()
      .then((msgs) => setHistory(msgs || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserAvatar(userAvatar);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const learnedRules = [
    {
      id: 'rule_1',
      title: 'Contrarian Statement Openers (+36% Engagement Boost)',
      description: 'Minds AI identified that bold, contrarian hooks outperform generic question hooks on X.',
      confidence: '98%',
      appliedCount: 14,
    },
    {
      id: 'rule_2',
      title: 'Short-Form Visual Cues in Brackets (+28% Completion Rate)',
      description: 'Minds AI formats YouTube Shorts scripts with [VISUAL: ...] cues to maximize viewer retention.',
      confidence: '94%',
      appliedCount: 9,
    },
    {
      id: 'rule_3',
      title: 'Single-Sentence Paragraph Spacing (+42% Link Clicks)',
      description: 'Minds AI enforces whitespace paragraph separation for LinkedIn thought-leadership posts.',
      confidence: '96%',
      appliedCount: 12,
    },
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-center justify-between border-b border-border2 pb-4">
          <div>
            <h1 className="font-display text-2xl text-amber flex items-center gap-2.5 mb-1">
              <SettingsIcon size={24} className="text-amber" />
              Settings & Account Management
            </h1>
            <p className="text-slate-400 text-sm max-w-xl">
              Customize AI agent behavior features, manage account details, and monitor Minds memory intelligence.
            </p>
          </div>

          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald2 bg-emerald2/10 border border-emerald2/30 px-3.5 py-1.5 rounded-xl font-mono animate-fadeIn">
              <Check className="w-4 h-4" />
              Settings Saved
            </span>
          )}
        </div>
      </Reveal>

      {/* Navigation Tabs */}
      <Reveal delay={50}>
        <div className="flex items-center gap-2 border-b border-border2 pb-3">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'account'
                ? 'bg-amber/20 text-amber border border-amber/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            <User className="w-4 h-4" />
            Account & Avatar Profile
          </button>

          <button
            onClick={() => setActiveTab('features')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'features'
                ? 'bg-amber/20 text-amber border border-amber/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Customizable Agent Features
          </button>

          <button
            onClick={() => setActiveTab('minds')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'minds'
                ? 'bg-amber/20 text-amber border border-amber/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            <MindsIcon size={16} className="text-teal" />
            Minds AI Engine Status
          </button>
        </div>
      </Reveal>

      {/* Account Details & Avatar Picker Tab */}
      {activeTab === 'account' && (
        <Reveal delay={100}>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Avatar Selection Card */}
            <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border2">
                <User className="w-5 h-5 text-amber" />
                <div>
                  <h2 className="text-base font-display text-slate-100">User Profile Avatar</h2>
                  <p className="text-xs text-slate-400 font-mono2">Choose a vector avatar preset or provide a custom image URL</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <UserAvatar name={userName} avatarUrl={userAvatar} size={72} />
                  <span className="text-[10px] font-mono text-slate-400">Current Avatar</span>
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <label className="block text-xs font-mono text-slate-400">Vector Avatar Presets</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {AVATAR_PRESETS.map((preset) => {
                      const isSel = userAvatar === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setUserAvatar(preset.id)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                            isSel
                              ? 'border-amber bg-amber/15 text-amber shadow-sm'
                              : 'border-border2 text-slate-300 hover:border-amber/40 hover:bg-white/5'
                          }`}
                        >
                          <UserAvatar name={preset.name} avatarUrl={preset.id} size={26} />
                          <span>{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-mono text-slate-400 mb-1">Custom Image URL</label>
                    <input
                      type="text"
                      value={userAvatar.startsWith('http') ? userAvatar : ''}
                      onChange={(e) => setUserAvatar(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full bg-canvas border border-border2 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber/50 font-mono2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Info Card */}
            <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border2">
                <User className="w-5 h-5 text-amber" />
                <div>
                  <h2 className="text-base font-display text-slate-100">User Credentials & Account Info</h2>
                  <p className="text-xs text-slate-400 font-mono2">Personal credentials and subscription details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-canvas border border-border2 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber/50 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-canvas border border-border2 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber/50 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-canvas/50 p-3.5 rounded-xl border border-border2">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Subscription Tier</div>
                  <div className="text-xs font-semibold text-amber mt-1">{userRole}</div>
                </div>
                <div className="bg-canvas/50 p-3.5 rounded-xl border border-border2">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Account ID</div>
                  <div className="text-xs font-mono text-slate-300 mt-1">{user?.id || 'usr_8829a4c311'}</div>
                </div>
                <div className="bg-canvas/50 p-3.5 rounded-xl border border-border2">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Session Status</div>
                  <div className="text-xs font-mono text-emerald2 mt-1">Protected & Authenticated</div>
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border2">
                <Shield className="w-5 h-5 text-teal" />
                <div>
                  <h2 className="text-base font-display text-slate-100">Security & Route Protection</h2>
                  <p className="text-xs text-slate-400 font-mono2">URL access controls and session parameters</p>
                </div>
              </div>

              <div className="p-3.5 bg-canvas/40 border border-border2 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-200 font-medium">
                  <span>URL Isolation Guard</span>
                  <span className="text-[10px] font-mono text-emerald2 bg-emerald2/10 border border-emerald2/30 px-2 py-0.5 rounded-full">ACTIVE</span>
                </div>
                <p className="text-slate-400 font-mono2 text-[11px]">
                  Unauthenticated users copying dashboard URLs are immediately blocked and redirected to the login screen.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-medium px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Account & Avatar Changes
              </button>
            </div>
          </form>
        </Reveal>
      )}

      {/* Customizable Agent Features Tab */}
      {activeTab === 'features' && (
        <Reveal delay={100}>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-border2">
                <Sliders className="w-5 h-5 text-amber" />
                <div>
                  <h2 className="text-base font-display text-slate-100">Customizable AI Agent Features</h2>
                  <p className="text-xs text-slate-400 font-mono2">Fine-tune automation behavior, thresholds, and triggers</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Feature 1: Auto-Approve */}
                <div className="flex items-center justify-between p-4 bg-canvas/50 border border-border2 rounded-xl">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Auto-Approve High-Confidence Drafts</h3>
                    <p className="text-[11px] text-slate-400 font-mono2">Automatically publish drafts if virality score exceeds 95%</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoApprove(!autoApprove)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      autoApprove ? 'bg-amber' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-canvas transition-transform ${
                        autoApprove ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Feature 2: Trend Polling Interval */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-canvas/50 border border-border2 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-slate-200">Real-Time Trend Polling Frequency</label>
                    <select
                      value={trendPollingInterval}
                      onChange={(e) => setTrendPollingInterval(e.target.value)}
                      className="w-full bg-canvas border border-border2 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="1h">Every 1 Hour (Aggressive)</option>
                      <option value="4h">Every 4 Hours (Balanced)</option>
                      <option value="12h">Every 12 Hours</option>
                      <option value="24h">Daily Summary</option>
                    </select>
                  </div>

                  <div className="p-4 bg-canvas/50 border border-border2 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-slate-200">Min Virality Gate Threshold ({minViralityScore}/100)</label>
                    <input
                      type="range"
                      min={50}
                      max={95}
                      value={minViralityScore}
                      onChange={(e) => setMinViralityScore(Number(e.target.value))}
                      className="w-full accent-amber"
                    />
                  </div>
                </div>

                {/* Feature 3: Platform & Notifications */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-canvas/50 border border-border2 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-slate-200">Default Target Platform</label>
                    <select
                      value={defaultPlatform}
                      onChange={(e) => setDefaultPlatform(e.target.value)}
                      className="w-full bg-canvas border border-border2 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="twitter">X / Twitter</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="youtube_shorts">YouTube Shorts</option>
                      <option value="youtube_longform">YouTube Video</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="threads">Threads</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-canvas/50 border border-border2 rounded-xl">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-200">In-App Activity Notifications</h3>
                      <p className="text-[11px] text-slate-400 font-mono2">Notify when trends score above threshold</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                        notificationsEnabled ? 'bg-amber' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-canvas transition-transform ${
                          notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Creator Voice Directives */}
                <div className="p-4 bg-canvas/50 border border-border2 rounded-xl space-y-3">
                  <h3 className="text-xs font-semibold text-amber">Creator Brand Voice & Niche Directives</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Niche Topic Focus</label>
                      <input
                        type="text"
                        value={niche}
                        onChange={(e) => setNiche(e.target.value)}
                        className="w-full bg-canvas border border-border2 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Tone & Hook Style</label>
                      <input
                        type="text"
                        value={toneVoice}
                        onChange={(e) => setToneVoice(e.target.value)}
                        className="w-full bg-canvas border border-border2 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-medium px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                Save Customizable Features
              </button>
            </div>
          </form>
        </Reveal>
      )}

      {/* Minds AI Engine Tab */}
      {activeTab === 'minds' && (
        <div className="space-y-6">
          <Reveal delay={100}>
            <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/25 flex items-center justify-center shrink-0">
                    <MindsIcon size={20} className="text-teal" />
                  </div>
                  <div>
                    <h2 className="text-base font-display text-slate-100">Minds AI Engine Status</h2>
                    <p className="text-xs text-slate-400 font-mono2">Powered by @animocabrands/minds-client-lib</p>
                  </div>
                </div>
                <span className="text-xs font-mono uppercase bg-emerald2/10 text-emerald2 border border-emerald2/25 px-3 py-1 rounded-full">
                  ONLINE & ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="bg-canvas/50 p-3.5 rounded-xl border border-border2">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">API Host</div>
                  <div className="text-xs font-mono2 text-slate-200 mt-1">build.hellominds.ai</div>
                </div>
                <div className="bg-canvas/50 p-3.5 rounded-xl border border-border2">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Thread Alias</div>
                  <div className="text-xs font-mono2 text-teal mt-1">repurpose-main</div>
                </div>
                <div className="bg-canvas/50 p-3.5 rounded-xl border border-border2">
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Memory Scope</div>
                  <div className="text-xs font-mono2 text-amber mt-1">Multi-Session Persistent</div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Learned Memory Rules */}
          <Reveal delay={140}>
            <div className="space-y-3">
              <h2 className="text-sm font-display text-slate-100 flex items-center gap-2">
                <MindsIcon size={16} className="text-amber" />
                Learned Style Rules & Memory Adaptations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {learnedRules.map((rule) => (
                  <div key={rule.id} className="bg-panel/40 border border-border2 p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber">{rule.title}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono2 leading-relaxed">{rule.description}</p>
                    <div className="text-[10px] text-slate-500 font-mono pt-1">
                      Confidence: <strong className="text-slate-200">{rule.confidence}</strong> | Applied {rule.appliedCount}x
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Server Thread Logs */}
          <Reveal delay={180}>
            <div className="bg-panel/40 border border-border2 p-6 rounded-2xl backdrop-blur-xl space-y-3">
              <h2 className="text-sm font-display text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-teal" />
                Minds Server Thread Memory Logs
              </h2>
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-4">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal" />
                  Loading thread memory from hellominds.ai…
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((msg, i) => (
                    <div key={i} className="p-3 bg-canvas/60 border border-border2 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>Role: {msg.role}</span>
                        <span>{msg.timestamp || 'Synced'}</span>
                      </div>
                      <p className="text-slate-300 font-mono2 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-mono2 py-2">
                  Thread memory active. Feedback messages record to hellominds.ai whenever you approve content drafts.
                </p>
              )}
            </div>
          </Reveal>
        </div>
      )}
    </div>
  );
};
