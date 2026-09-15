import { CreatorProfile, TrendOpportunity, ContentDraft, PerformanceMetric, DelegationStep } from '../types';

/**
 * Minds Memory Store Architecture Notice:
 * ---------------------------------------
 * CreatorOS utilizes a dual-layer memory persistence architecture:
 * 1. REAL MINDS API: Draft approval feedback signals and transcript repurposing queries
 *    transmit directly to persistent conversation threads hosted on Minds (build.hellominds.ai)
 *    via @animocabrands/minds-client-lib (/api/minds/approve.ts and /api/minds/repurpose.ts).
 * 2. STRUCTURED CLIENT NAMESPACES: Local client-side state (creator.profile, growth.opportunities,
 *    content.drafts, analytics.performance_history) is namespaced per user device ID and persisted
 *    via browser localStorage for zero-latency UI rendering and offline fallback.
 */

export const DEMO_SEED = {
  opportunities: [
    {
      id: "opp_1",
      topic: "Autonomous AI Agent Memory & Multi-Session State",
      source: "YouTube Creator Trends & Instagram Tech",
      opportunityScore: 96,
      angle: "Why persistent memory is the boundary separating chatbot toys from true production agents",
      category: "AI",
      timestamp: "10 mins ago"
    },
    {
      id: "opp_2",
      topic: "Creator Economy Monetization via Tokenized Communities",
      source: "Instagram Reels & Animoca Pulse",
      opportunityScore: 88,
      angle: "How creators are replacing traditional Patreon subscriptions with autonomous agent rewards",
      category: "Creator Economy",
      timestamp: "45 mins ago"
    },
    {
      id: "opp_3",
      topic: "Repurposing Long-form Audio to Micro-Video Scripts",
      source: "YouTube Shorts Analytics",
      opportunityScore: 82,
      angle: "3-step workflow to turn a 60-min podcast into 10 viral short-form hooks automatically",
      category: "Tech",
      timestamp: "2 hours ago"
    }
  ] as TrendOpportunity[],
  drafts: [
    {
      id: "draft_1",
      opportunityId: "opp_1",
      platform: "instagram" as const,
      hook: "AI agents without memory are glorified search bars.",
      body: "Here is how persistent multi-session state changes everything for AI builders in 2026:\n\n1. Single-session LLMs forget your context the second you refresh.\n2. Autonomous memory namespaces allow agents to write past performance back into state.\n3. Content agents learn what hook styles perform 35% better and adapt autonomously.",
      cta: "What memory architecture are you using for your agents?",
      status: "pending_approval" as const,
      createdAt: "Just now",
      predictedPerformanceScore: 94
    },
    {
      id: "draft_2",
      opportunityId: "opp_1",
      platform: "youtube_shorts" as const,
      hook: "The biggest bottleneck in AI agent deployment isn't model intelligence—it's memory continuity.",
      body: "[VISUAL: Split screen showing stateless vs persistent agent memory]\n[AUDIO: Fast-paced synth beat]\n\nOver the last month, we tested multi-agent delegation across 500 creator posts.\n\nThe single biggest performance multiplier? Persistence.\n\nWhen your AI Chief of Staff writes engagement analytics back into its own memory store, every future post inherits historical insights.",
      cta: "Subscribe for more AI creator workflows!",
      status: "pending_approval" as const,
      createdAt: "15 mins ago",
      predictedPerformanceScore: 91
    },
    {
      id: "draft_3",
      opportunityId: "opp_3",
      platform: "youtube_longform" as const,
      hook: "Stop manually cutting 1-hour podcast videos!",
      body: "In this full tutorial, we break down how CreatorOS repurposes long-form audio in 30 seconds:\n1. Transcribe audio transcript\n2. Extract top 5 virality-scored hooks\n3. Generate timed caption scripts with visual cues automatically.",
      cta: "Check the description link to try CreatorOS!",
      status: "published" as const,
      createdAt: "1 hour ago",
      predictedPerformanceScore: 88
    }
  ] as ContentDraft[],
  performanceHistory: [
    {
      postId: "post_101",
      platform: "instagram" as const,
      hookStyle: "Contrarian Carousel Hook",
      views: 34500,
      engagementRate: 9.4,
      insight: "Contrarian carousel hooks performed +36% higher than generic questions. Retained in memory.",
      timestamp: "Yesterday"
    },
    {
      postId: "post_102",
      platform: "youtube_shorts" as const,
      hookStyle: "3-Second Visual Problem Hook",
      views: 58200,
      engagementRate: 11.2,
      insight: "Visual split-screen cues increased 30s completion rate by 34%.",
      timestamp: "2 days ago"
    },
    {
      postId: "post_103",
      platform: "youtube_longform" as const,
      hookStyle: "Case Study & Numbers",
      views: 19400,
      engagementRate: 8.8,
      insight: "Timestamped chapter breakdowns boosted subscriber conversion by 42%.",
      timestamp: "3 days ago"
    }
  ] as PerformanceMetric[],
  delegationTrace: [
    {
      id: "step_1",
      timestamp: "11:58:10",
      agentName: "Coordinator" as const,
      action: "Goal Received",
      details: 'Objective: "Scale tech audience engagement on YouTube & Instagram using AI trend signals."',
      status: "completed" as const
    },
    {
      id: "step_2",
      timestamp: "11:58:12",
      agentName: "Growth Agent" as const,
      action: "Search Trends",
      details: "Polled YouTube Creator Trends & Instagram Tech. Found 'Autonomous AI Agent Memory' (Score: 96/100). Written to growth.opportunities memory.",
      status: "completed" as const
    },
    {
      id: "step_3",
      timestamp: "11:58:15",
      agentName: "Content Agent" as const,
      action: "Read Memory & Generate Drafts",
      details: "Fetched analytics.performance_history: Contrarian hook style selected based on +36% historical engagement boost. Saved to content.drafts.",
      status: "completed" as const
    },
    {
      id: "step_4",
      timestamp: "11:58:18",
      agentName: "Analytics Agent" as const,
      action: "Persistence Feedback Verification",
      details: "Monitoring post metrics. Ready to write new engagement deltas into Minds memory.",
      status: "active" as const
    }
  ] as DelegationStep[],
};

export class MindsMemoryStore {
  private currentUserId: string = 'default';

  private profile: CreatorProfile = {
    name: "Creator",
    niche: "Tech & AI",
    brandVoice: "Informative, high-signal, punchy",
    targetAudience: "Tech Enthusiasts & Video Builders",
    cognitionCredits: 1000
  };

  private opportunities: TrendOpportunity[] = [];
  private drafts: ContentDraft[] = [];
  private performanceHistory: PerformanceMetric[] = [];
  private delegationTrace: DelegationStep[] = [];

  constructor() {
    this.loadFromStorage('default');
  }

  public setUserId(userId: string) {
    if (this.currentUserId !== userId) {
      this.currentUserId = userId;
      this.loadFromStorage(userId);
    }
  }

  private loadFromStorage(userId: string) {
    const key = `creator_os_minds_memory_${userId}`;
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.profile = parsed.profile || this.profile;
        this.opportunities = parsed.opportunities || [];
        this.drafts = parsed.drafts || [];
        this.performanceHistory = parsed.performanceHistory || [];
        this.delegationTrace = parsed.delegationTrace || [];
      } catch (e) {
        console.error("Failed to parse saved Minds memory", e);
        this.resetStateToEmpty();
      }
    } else {
      // Clean slate for new account
      this.resetStateToEmpty();
    }
  }

  private resetStateToEmpty() {
    this.opportunities = [];
    this.drafts = [];
    this.performanceHistory = [];
    this.delegationTrace = [];
  }

  public saveToStorage() {
    const key = `creator_os_minds_memory_${this.currentUserId}`;
    localStorage.setItem(key, JSON.stringify({
      profile: this.profile,
      opportunities: this.opportunities,
      drafts: this.drafts,
      performanceHistory: this.performanceHistory,
      delegationTrace: this.delegationTrace
    }));
  }

  // Getters
  public getProfile() { return this.profile; }
  public getOpportunities() { return this.opportunities; }
  public getDrafts() { return this.drafts; }
  public getPerformanceHistory() { return this.performanceHistory; }
  public getDelegationTrace() { return this.delegationTrace; }

  // Mutations
  public addOpportunity(opp: TrendOpportunity) {
    this.opportunities.unshift(opp);
    this.saveToStorage();
  }

  public addDraft(draft: ContentDraft) {
    this.drafts.unshift(draft);
    this.saveToStorage();
  }

  public updateDraftStatus(id: string, status: ContentDraft['status']) {
    const draft = this.drafts.find(d => d.id === id);
    if (draft) {
      draft.status = status;
      this.saveToStorage();
    }
  }

  public addMetric(metric: PerformanceMetric) {
    this.performanceHistory.unshift(metric);
    this.saveToStorage();
  }

  public addTraceStep(step: DelegationStep) {
    this.delegationTrace.push(step);
    this.saveToStorage();
  }

  public loadDemoData() {
    this.opportunities = [...DEMO_SEED.opportunities];
    this.drafts = [...DEMO_SEED.drafts];
    this.performanceHistory = [...DEMO_SEED.performanceHistory];
    this.delegationTrace = [...DEMO_SEED.delegationTrace];
    this.saveToStorage();
  }

  public resetToFresh() {
    this.resetStateToEmpty();
    this.saveToStorage();
  }
}

export const mindsStore = new MindsMemoryStore();
