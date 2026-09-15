export type Platform =
  | 'twitter'
  | 'linkedin'
  | 'youtube_shorts'
  | 'youtube_longform'
  | 'instagram'
  | 'tiktok'
  | 'threads';

export interface CreatorProfile {
  name: string;
  niche: string;
  brandVoice: string;
  targetAudience: string;
  cognitionCredits: number;
}

export interface TrendOpportunity {
  id: string;
  topic: string;
  source: string;
  opportunityScore: number; // 1-100
  angle: string;
  category: 'Tech' | 'AI' | 'Creator Economy' | 'Web3';
  timestamp: string;
}

export interface ContentDraft {
  id: string;
  opportunityId?: string;
  originalInput?: string;
  platform: Platform;
  hook: string;
  body: string;
  cta?: string;
  status: 'draft' | 'pending_approval' | 'published';
  createdAt: string;
  predictedPerformanceScore: number;
}

export interface PerformanceMetric {
  postId: string;
  platform: Platform;
  hookStyle: string;
  views: number;
  engagementRate: number;
  insight: string;
  timestamp: string;
}

export interface DelegationStep {
  id: string;
  timestamp: string;
  agentName: 'Coordinator' | 'Growth Agent' | 'Content Agent' | 'Analytics Agent';
  action: string;
  details: string;
  status: 'pending' | 'active' | 'completed';
}

export type TabType = 'overview' | 'trends' | 'repurpose' | 'analytics' | 'memory' | 'team';
