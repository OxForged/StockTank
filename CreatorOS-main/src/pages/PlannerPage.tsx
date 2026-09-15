import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, Clock, Edit2, Trash2, X, Calendar, Link as LinkIcon, RefreshCcw, FolderPlus, Send, LayoutGrid, CalendarRange, List } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from '../components/Reveal';
import { CalendarIcon, XIcon, LinkedInIcon, YouTubeIcon, InstagramIcon, TikTokIcon, ThreadsIcon, ConnectionsIcon } from '../components/Icons';
import { Platform } from '../types';
import { useDashboard } from '../context/DashboardContext';
import { publishPost } from '../lib/zernio';

interface Project {
  id: string;
  name: string;
  clientName: string;
}

interface ScheduledPost {
  id: string;
  projectId: string;
  platform: Platform;
  date: number; // day of month 1-31
  time: string;
  title: string;
  body?: string;
  status: 'scheduled' | 'published' | 'draft';
}

const DEFAULT_PROJECT: Project = {
  id: 'proj_main',
  name: 'Personal Creator Brand',
  clientName: 'Main Account',
};

const DEMO_SCHEDULED_POSTS: ScheduledPost[] = [
  { id: 'sch_1', projectId: 'proj_main', platform: 'twitter', date: 26, time: '14:00', title: 'Why persistent AI memory changes creator workflows', body: 'Stateless LLMs forget your context on refresh. Multi-session Minds memory keeps state.', status: 'scheduled' },
  { id: 'sch_2', projectId: 'proj_main', platform: 'linkedin', date: 27, time: '10:30', title: '5 metric-backed lessons from 500 creator posts', body: 'whitespace formatting + contrarian hook = 42% higher click rate.', status: 'scheduled' },
  { id: 'sch_3', projectId: 'proj_main', platform: 'youtube_shorts', date: 28, time: '18:00', title: 'Repurposing 1-hour audio into 10 shorts in 30 seconds', body: '[VISUAL: Quick cuts]\n[AUDIO: Tech synth]\n1. Transcribe\n2. Score hooks', status: 'draft' },
];

const PLATFORM_CONFIG: Record<Platform, { name: string; icon: React.ReactNode; color: string; border: string; bg: string }> = {
  twitter: { name: 'X', icon: <XIcon size={12} className="text-white" />, color: 'text-white', border: 'border-white/20', bg: 'bg-white/5' },
  linkedin: { name: 'LinkedIn', icon: <LinkedInIcon size={12} className="text-[#0A66C2]" />, color: 'text-[#0A66C2]', border: 'border-[#0A66C2]/30', bg: 'bg-[#0A66C2]/10' },
  youtube_shorts: { name: 'Shorts', icon: <YouTubeIcon size={12} className="text-[#FF0000]" />, color: 'text-[#FF0000]', border: 'border-[#FF0000]/30', bg: 'bg-[#FF0000]/10' },
  youtube_longform: { name: 'YouTube', icon: <YouTubeIcon size={12} className="text-[#FF0000]" />, color: 'text-[#FF0000]', border: 'border-[#FF0000]/30', bg: 'bg-[#FF0000]/10' },
  instagram: { name: 'Instagram', icon: <InstagramIcon size={12} className="text-[#E4405F]" />, color: 'text-[#E4405F]', border: 'border-[#E4405F]/30', bg: 'bg-[#E4405F]/10' },
  tiktok: { name: 'TikTok', icon: <TikTokIcon size={12} className="text-[#00F2FE]" />, color: 'text-[#00F2FE]', border: 'border-[#00F2FE]/30', bg: 'bg-[#00F2FE]/10' },
  threads: { name: 'Threads', icon: <ThreadsIcon size={12} className="text-slate-200" />, color: 'text-slate-200', border: 'border-slate-400/30', bg: 'bg-white/5' },
};

export const PlannerPage: React.FC = () => {
  const { user, scheduleDraftBackend, connectedCount, platforms, pushNotification } = useDashboard();
  const userId = user?.id || 'guest';

  // Projects State (Per User)
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(`creator_os_projects_${userId}`);
      return saved ? JSON.parse(saved) : [DEFAULT_PROJECT];
    } catch {
      return [DEFAULT_PROJECT];
    }
  });

  useEffect(() => {
    localStorage.setItem(`creator_os_projects_${userId}`, JSON.stringify(projects));
  }, [projects, userId]);

  // Scheduled Posts State (Per User — 100% Dynamic)
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(() => {
    try {
      const saved = localStorage.getItem(`creator_os_scheduled_posts_${userId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(`creator_os_scheduled_posts_${userId}`, JSON.stringify(scheduledPosts));
  }, [scheduledPosts, userId]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'list'>('weekly');
  const [isPlanning, setIsPlanning] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Modal / Drawer State for Create & Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);

  // Project Creation Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formPlatform, setFormPlatform] = useState<Platform>('twitter');
  const [formProjectId, setFormProjectId] = useState<string>(projects[0]?.id || 'proj_main');
  const [formDate, setFormDate] = useState<number>(26);
  const [formTime, setFormTime] = useState<string>('14:00');
  const [formStatus, setFormStatus] = useState<'scheduled' | 'published' | 'draft'>('scheduled');

  const filteredPosts = selectedProjectId === 'all'
    ? scheduledPosts
    : scheduledPosts.filter((p) => p.projectId === selectedProjectId);

  const openCreateModal = (dayDate: number = 26) => {
    setEditingPost(null);
    setFormTitle('');
    setFormBody('');
    setFormPlatform('twitter');
    setFormProjectId(selectedProjectId === 'all' ? (projects[0]?.id || 'proj_main') : selectedProjectId);
    setFormDate(dayDate);
    setFormTime('14:00');
    setFormStatus('scheduled');
    setIsModalOpen(true);
  };

  const openEditModal = (post: ScheduledPost) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormBody(post.body || '');
    setFormPlatform(post.platform);
    setFormProjectId(post.projectId);
    setFormDate(post.date);
    setFormTime(post.time);
    setFormStatus(post.status);
    setIsModalOpen(true);
  };

  const handleAutoPostNow = async (post: ScheduledPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPublishingId(post.id);

    const platStatus = platforms.find((p) => p.id === post.platform);
    // A simulated/local connection uses a synthetic `conn_*` id — there's no
    // real Zernio account behind it, so don't attempt a live publish call.
    const isLiveAccount = !!platStatus?.accountId && !platStatus.accountId.startsWith('conn_');

    try {
      if (isLiveAccount) {
        await publishPost(`${post.title}\n\n${post.body || ''}`, post.platform, platStatus!.accountId);
        pushNotification(`Published live to ${post.platform}`);
      } else {
        pushNotification(`Marked as published (simulated — no live ${post.platform} account connected)`);
      }

      setScheduledPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: 'published' } : p))
      );
      if (editingPost && editingPost.id === post.id) {
        setFormStatus('published');
      }
    } catch (err: any) {
      // Live publish genuinely failed — don't mark it published.
      pushNotification(`Failed to publish to ${post.platform}: ${err?.message || 'unknown error'}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingPost) {
      setScheduledPosts((prev) =>
        prev.map((p) =>
          p.id === editingPost.id
            ? {
                ...p,
                title: formTitle,
                body: formBody,
                platform: formPlatform,
                projectId: formProjectId,
                date: formDate,
                time: formTime,
                status: formStatus,
              }
            : p
        )
      );
    } else {
      const newPost: ScheduledPost = {
        id: `sch_${Date.now()}`,
        projectId: formProjectId,
        platform: formPlatform,
        date: formDate,
        time: formTime,
        title: formTitle,
        body: formBody,
        status: formStatus,
      };
      setScheduledPosts((prev) => [...prev, newPost]);

      const isoDate = new Date(2026, 7, formDate, parseInt(formTime.split(':')[0] || '14'), 0).toISOString();
      await scheduleDraftBackend(`${formTitle}\n\n${formBody}`, formPlatform, isoDate);
    }

    setIsModalOpen(false);
  };

  const handleDeletePost = (id: string) => {
    setScheduledPosts((prev) => prev.filter((p) => p.id !== id));
    setIsModalOpen(false);
  };

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name: newProjectName.trim(),
      clientName: newProjectName.trim(),
    };
    setProjects((prev) => [...prev, newProj]);
    setNewProjectName('');
    setIsProjectModalOpen(false);
  };

  const handleLoadDemoSchedule = () => {
    setScheduledPosts(DEMO_SCHEDULED_POSTS);
  };

  const handleAiPlan = () => {
    setIsPlanning(true);
    setTimeout(() => {
      const newPost: ScheduledPost = {
        id: `sch_${Date.now()}`,
        projectId: selectedProjectId === 'all' ? (projects[0]?.id || 'proj_main') : selectedProjectId,
        platform: 'twitter',
        date: 31,
        time: '15:00',
        title: 'Minds AI 7-Day Planned Content Batch',
        body: 'Auto-planned content calendar batch.',
        status: 'scheduled',
      };
      setScheduledPosts((prev) => [...prev, newPost]);
      setIsPlanning(false);
    }, 1000);
  };

  const daysOfWeek = [
    { num: 25, label: 'Mon' },
    { num: 26, label: 'Tue (Today)' },
    { num: 27, label: 'Wed' },
    { num: 28, label: 'Thu' },
    { num: 29, label: 'Fri' },
    { num: 30, label: 'Sat' },
    { num: 31, label: 'Sun' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <Reveal>
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border2 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 rounded-xl bg-amber/10 border border-amber/25 text-amber">
                <CalendarIcon size={20} />
              </div>
              <h1 className="font-display text-2xl text-amber">Content Planner & Visual Schedule</h1>
            </div>
            <p className="text-slate-400 text-sm max-w-xl">
              Organize multi-channel content, split projects per client, schedule manually, and auto-post seamlessly via Zernio API.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => openCreateModal(26)}
              className="flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Schedule Post
            </button>
            <button
              onClick={handleAiPlan}
              disabled={isPlanning}
              className="flex items-center gap-2 border border-amber/40 bg-amber/10 hover:bg-amber/20 text-amber font-medium px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm disabled:opacity-50"
            >
              {isPlanning ? 'Generating Plan…' : '7-Day AI Plan'}
            </button>
          </div>
        </div>
      </Reveal>

      {/* Control Bar: Projects Switcher & View Switcher */}
      <Reveal delay={50}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-panel/30 border border-border2 p-3.5 rounded-2xl backdrop-blur-xl">
          {/* Projects Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-500 mr-1">Brand Projects:</span>
            <button
              onClick={() => setSelectedProjectId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedProjectId === 'all'
                  ? 'bg-amber text-[#08090A] font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-border2'
              }`}
            >
              All Channels ({scheduledPosts.length})
            </button>

            {projects.map((proj) => {
              const count = scheduledPosts.filter((p) => p.projectId === proj.id).length;
              const isSel = selectedProjectId === proj.id;
              return (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    isSel
                      ? 'border-amber text-amber bg-amber/10 shadow-sm'
                      : 'border-border2 text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  {proj.name} ({count})
                </button>
              );
            })}

            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-amber border border-dashed border-border2 hover:border-amber/40 px-3 py-1.5 rounded-xl transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New Project
            </button>
          </div>

          {/* View Switcher: Weekly, Monthly, List */}
          <div className="flex items-center gap-1 bg-canvas/60 p-1 border border-border2 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'weekly' ? 'bg-amber/20 text-amber border border-amber/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Weekly Timeline
            </button>

            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'monthly' ? 'bg-amber/20 text-amber border border-amber/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Monthly Grid
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'list' ? 'bg-amber/20 text-amber border border-amber/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List Queue
            </button>
          </div>
        </div>
      </Reveal>

      {/* Creative Empty State for Clean Accounts */}
      {scheduledPosts.length === 0 ? (
        <Reveal delay={100}>
          <div className="bg-panel/40 border border-border2 p-12 rounded-2xl text-center space-y-5 max-w-xl mx-auto my-8 backdrop-blur-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber/10 border border-amber/25 flex items-center justify-center mx-auto text-amber shadow-sm">
              <ConnectionsIcon size={28} />
            </div>
            <div>
              <h3 className="font-display text-xl text-slate-100 mb-1.5">Your Content Calendar is Clean</h3>
              <p className="text-xs text-slate-400 font-mono2 leading-relaxed">
                {connectedCount === 0
                  ? 'Connect your social media accounts or schedule your first post manually to populate your visual content timeline.'
                  : 'Click "+ Schedule Post" above to organize your upcoming posts across social channels.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => openCreateModal(26)}
                className="inline-flex items-center gap-2 bg-amber hover:bg-amber-soft text-[#08090A] font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Schedule First Post
              </button>
              <Link
                to="/dashboard/connections"
                className="inline-flex items-center gap-2 border border-border2 hover:bg-white/5 text-slate-300 font-medium px-4 py-2.5 rounded-xl text-xs transition-all"
              >
                <LinkIcon className="w-4 h-4" />
                Connect Accounts
              </Link>
              <button
                onClick={handleLoadDemoSchedule}
                className="inline-flex items-center gap-2 border border-border2 hover:bg-white/5 text-slate-300 font-medium px-4 py-2.5 rounded-xl text-xs transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Load Sample Schedule
              </button>
            </div>
          </div>
        </Reveal>
      ) : (
        <>
          {/* VIEW MODE 1: Weekly Kanban Timeline */}
          {viewMode === 'weekly' && (
            <Reveal delay={100}>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3.5">
                {daysOfWeek.map((day) => {
                  const dayPosts = filteredPosts.filter((p) => p.date === day.num);
                  const isToday = day.num === 26;

                  return (
                    <div
                      key={day.num}
                      className={`min-h-[380px] p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
                        isToday
                          ? 'bg-amber/[0.04] border-amber/40 shadow-sm'
                          : 'bg-panel/40 border-border2'
                      }`}
                    >
                      {/* Day Column Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-border2">
                        <div>
                          <span className={`text-xs font-mono font-bold block ${isToday ? 'text-amber' : 'text-slate-300'}`}>
                            Aug {day.num}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono2">{day.label}</span>
                        </div>

                        <button
                          onClick={() => openCreateModal(day.num)}
                          className="p-1 rounded-lg border border-border2 text-slate-400 hover:text-amber hover:border-amber/40 transition-colors"
                          title="Schedule post on this date"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Post Cards Queue */}
                      <div className="space-y-3 flex-1 mt-3">
                        {dayPosts.map((post) => {
                          const pConfig = PLATFORM_CONFIG[post.platform];
                          const proj = projects.find((pr) => pr.id === post.projectId);
                          const isPubing = publishingId === post.id;

                          return (
                            <div
                              key={post.id}
                              onClick={() => openEditModal(post)}
                              className="p-3.5 rounded-xl bg-canvas/80 border border-border2 text-xs space-y-2 hover:border-amber/50 hover:bg-canvas transition-all cursor-pointer group shadow-sm relative overflow-hidden"
                            >
                              {/* Platform Badge & Time */}
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`inline-flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-md text-[10px] border ${pConfig.border} ${pConfig.bg} ${pConfig.color}`}>
                                  {pConfig.icon}
                                  {pConfig.name}
                                </span>
                                <span className="font-mono text-slate-400 text-[11px]">{post.time}</span>
                              </div>

                              {/* Title / Hook */}
                              <p className="text-xs font-medium text-slate-100 line-clamp-2 leading-snug group-hover:text-amber transition-colors">
                                {post.title}
                              </p>

                              {/* Project Tag & Status Pill */}
                              <div className="flex items-center justify-between pt-1 border-t border-border2/60 text-[10px]">
                                <span className="text-slate-500 font-mono truncate max-w-[90px]">
                                  {proj?.name || 'Main Brand'}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  {post.status !== 'published' && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleAutoPostNow(post, e)}
                                      disabled={isPubing}
                                      className="p-1 rounded-md text-amber hover:bg-amber/20 transition-all opacity-0 group-hover:opacity-100"
                                      title="Auto-Post Now via Zernio API"
                                    >
                                      {isPubing ? (
                                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Send className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}

                                  {post.status === 'published' ? (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald2 font-mono bg-emerald2/10 px-1.5 py-0.5 rounded-md border border-emerald2/20">
                                      <CheckCircle className="w-3 h-3" /> Live
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[10px] text-amber font-mono bg-amber/10 px-1.5 py-0.5 rounded-md border border-amber/20">
                                      <Clock className="w-3 h-3" /> Sched
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {dayPosts.length === 0 && (
                          <button
                            onClick={() => openCreateModal(day.num)}
                            className="w-full text-xs text-slate-600 hover:text-slate-400 font-mono2 text-center py-10 transition-colors border border-dashed border-border2/50 rounded-xl hover:border-slate-500"
                          >
                            + Add post
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          )}

          {/* VIEW MODE 2: Monthly Grid */}
          {viewMode === 'monthly' && (
            <Reveal delay={100}>
              <div className="bg-panel/40 border border-border2 rounded-2xl p-4 backdrop-blur-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-border2 pb-2">
                  <span>August 2026 Grid Overview</span>
                  <span>{filteredPosts.length} posts scheduled</span>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono text-slate-500 py-1">
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {[...Array(31)].map((_, idx) => {
                    const dayNum = idx + 1;
                    const dayPosts = filteredPosts.filter((p) => p.date === dayNum);
                    const isToday = dayNum === 26;

                    return (
                      <div
                        key={dayNum}
                        onClick={() => openCreateModal(dayNum)}
                        className={`min-h-[70px] p-2 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                          isToday ? 'bg-amber/10 border-amber/50' : 'bg-canvas/50 border-border2 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className={isToday ? 'text-amber font-bold' : 'text-slate-400'}>{dayNum}</span>
                          {dayPosts.length > 0 && (
                            <span className="text-[10px] bg-amber/20 text-amber px-1.5 py-0.2 rounded-full font-bold">
                              {dayPosts.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {dayPosts.slice(0, 2).map((p) => (
                            <div key={p.id} className="text-[9px] truncate bg-white/5 px-1 py-0.5 rounded text-slate-300">
                              {p.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          )}

          {/* VIEW MODE 3: List Queue */}
          {viewMode === 'list' && (
            <Reveal delay={100}>
              <div className="bg-panel/40 border border-border2 rounded-2xl backdrop-blur-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-200">
                  <thead className="bg-canvas/80 text-[11px] font-mono text-slate-400 border-b border-border2">
                    <tr>
                      <th className="px-4 py-3">Scheduled Date</th>
                      <th className="px-4 py-3">Platform</th>
                      <th className="px-4 py-3">Post Hook / Copy</th>
                      <th className="px-4 py-3">Brand Project</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border2">
                    {filteredPosts.map((post) => {
                      const pConfig = PLATFORM_CONFIG[post.platform];
                      const proj = projects.find((pr) => pr.id === post.projectId);
                      const isPubing = publishingId === post.id;

                      return (
                        <tr key={post.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5 font-mono text-slate-300">
                            Aug {post.date}, 2026 @ {post.time}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-md text-[10px] border ${pConfig.border} ${pConfig.bg} ${pConfig.color}`}>
                              {pConfig.icon}
                              {pConfig.name}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 max-w-xs font-medium text-slate-100 truncate">
                            {post.title}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-400 text-xs">
                            {proj?.name || 'Main Brand'}
                          </td>
                          <td className="px-4 py-3.5">
                            {post.status === 'published' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald2 font-mono bg-emerald2/10 px-2 py-0.5 rounded-md border border-emerald2/20">
                                <CheckCircle className="w-3 h-3" /> Live
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber font-mono bg-amber/10 px-2 py-0.5 rounded-md border border-amber/20">
                                <Clock className="w-3 h-3" /> Scheduled
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-2">
                            {post.status !== 'published' && (
                              <button
                                onClick={() => handleAutoPostNow(post)}
                                disabled={isPubing}
                                className="inline-flex items-center gap-1 text-xs text-amber border border-amber/30 bg-amber/10 hover:bg-amber/20 px-2.5 py-1 rounded-lg transition-all"
                              >
                                {isPubing ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                Auto-Post Now
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(post)}
                              className="text-slate-400 hover:text-slate-100 transition-colors p-1"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
          )}
        </>
      )}

      {/* Add New Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm bg-[#0F172A] border border-border2 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-border2 pb-3">
              <h2 className="text-sm font-display text-slate-50 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber" />
                Add New Project / Client
              </h2>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddProject} className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Client: TechPulse"
                  className="w-full bg-canvas border border-border2 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber/50"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="text-xs text-slate-400 px-3 py-1.5 rounded-lg border border-border2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber hover:bg-amber-soft text-[#08090A] font-semibold text-xs px-4 py-1.5 rounded-lg"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule & Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#0B0F19] border border-border2 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-border2 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber" />
                <h2 className="text-base font-display text-slate-50">
                  {editingPost ? 'Edit Scheduled Post' : 'Schedule New Post'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePost} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Post Title / Hook</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. 5 metric-backed lessons for creators"
                  className="w-full bg-canvas border border-border2 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber/50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Content Copy / Body</label>
                <textarea
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Enter full post copy, hashtags, or visual cue instructions..."
                  className="w-full bg-canvas border border-border2 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber/50 font-mono2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Target Platform</label>
                  <select
                    value={formPlatform}
                    onChange={(e) => setFormPlatform(e.target.value as Platform)}
                    className="w-full bg-canvas border border-border2 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none font-medium"
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

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Project / Brand</label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full bg-canvas border border-border2 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none font-medium"
                  >
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Day of Month</label>
                  <select
                    value={formDate}
                    onChange={(e) => setFormDate(Number(e.target.value))}
                    className="w-full bg-canvas border border-border2 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none"
                  >
                    {[25, 26, 27, 28, 29, 30, 31].map((d) => (
                      <option key={d} value={d}>
                        Aug {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Schedule Time</label>
                  <input
                    type="text"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    placeholder="14:00"
                    className="w-full bg-canvas border border-border2 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none font-mono2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-canvas border border-border2 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border2">
                {editingPost ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeletePost(editingPost.id)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Post
                    </button>
                    {editingPost.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handleAutoPostNow(editingPost)}
                        className="flex items-center gap-1.5 border border-emerald2/40 bg-emerald2/10 text-emerald2 hover:bg-emerald2/20 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Auto-Post Now
                      </button>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-100 px-4 py-2 rounded-xl border border-border2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-amber hover:bg-amber-soft text-[#08090A] font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm"
                  >
                    {editingPost ? 'Save Changes' : 'Schedule Post'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
