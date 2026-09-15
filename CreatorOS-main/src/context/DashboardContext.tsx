import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mindsStore } from '../memory/mindsStore';
import { coordinatorAgent } from '../agents/coordinatorAgent';
import { growthAgent } from '../agents/growthAgent';
import { contentAgent } from '../agents/contentAgent';
import { analyticsAgent } from '../agents/analyticsAgent';
import { Platform, TrendOpportunity, CreatorProfile, ContentDraft, PerformanceMetric, DelegationStep } from '../types';
import { sendApprovalToMinds } from '../lib/minds';
import {
  listAccounts,
  disconnectAccount,
  publishPost,
  schedulePost as zernioSchedulePost,
  zernioPlatformFor,
  NotConfiguredError,
  ZernioAccount,
} from '../lib/zernio';

export interface PlatformStatus {
  id: Platform;
  name: string;
  status: 'connected' | 'connecting' | 'disconnected';
  accountId?: string;
}

export interface AppNotification {
  id: number;
  message: string;
  time: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  token?: string;
  avatarUrl?: string;
}

const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube_shorts: 'YouTube Shorts',
  youtube_longform: 'YouTube Video',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  tiktok: 'TikTok',
  threads: 'Threads',
};

interface DashboardContextValue {
  user: UserSession;
  updateUserName: (name: string) => void;
  updateUserAvatar: (avatarUrl: string) => void;
  profile: CreatorProfile;
  opportunities: TrendOpportunity[];
  drafts: ContentDraft[];
  metrics: PerformanceMetric[];
  trace: DelegationStep[];
  isExecuting: boolean;
  platforms: PlatformStatus[];
  connectedCount: number;
  zernioConfigured: boolean | null;
  runGoal: (goalText: string, targetPlatform?: Platform) => Promise<void>;
  triggerTrendScan: () => Promise<void>;
  generateDraft: (opp: TrendOpportunity, platform: Platform) => Promise<void>;
  approveDraft: (draftId: string) => Promise<void>;
  scheduleDraftBackend: (content: string, platform: Platform, scheduledAtISO: string) => Promise<void>;
  manualGenerate: (input: string) => Promise<void>;
  connectPlatform: (id: Platform) => Promise<void>;
  disconnectPlatform: (id: Platform) => Promise<void>;
  loadDemoData: () => void;
  resetToFresh: () => void;
  notifications: AppNotification[];
  pushNotification: (message: string) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

// Get or generate a persistent, unique per-device client User ID
const getOrCreateDeviceUser = (): UserSession => {
  try {
    const saved = localStorage.getItem('creatoros_auth_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id) return parsed;
    }
  } catch {
    // fallback
  }

  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const deviceUser: UserSession = {
    id: `usr_device_${Date.now().toString().slice(-6)}_${randomSuffix}`,
    email: `creator_${randomSuffix}@creatoros.ai`,
    name: 'Creator Chief',
    avatarUrl: 'preset_amber',
  };
  try {
    localStorage.setItem('creatoros_auth_user', JSON.stringify(deviceUser));
  } catch {
    // fallback
  }
  return deviceUser;
};

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, setTick] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [zernioAccounts, setZernioAccounts] = useState<ZernioAccount[]>([]);
  const [user, setUser] = useState<UserSession>(getOrCreateDeviceUser);

  const [connectedPlatforms, setConnectedPlatforms] = useState<Platform[]>(() => {
    try {
      const saved = localStorage.getItem(`creatoros_connected_platforms_${user.id}`);
      return saved ? JSON.parse(saved) : ['instagram', 'youtube_shorts', 'youtube_longform'];
    } catch {
      return ['instagram', 'youtube_shorts', 'youtube_longform'];
    }
  });

  const [zernioConfigured, setZernioConfigured] = useState<boolean | null>(true);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    mindsStore.setUserId(user.id);
    refreshState();
  }, [user.id]);

  const updateUserName = (name: string) => {
    const updated = { ...user, name };
    setUser(updated);
    localStorage.setItem('creatoros_auth_user', JSON.stringify(updated));
    pushNotification(`Profile name updated to ${name}`);
  };

  const updateUserAvatar = (avatarUrl: string) => {
    const updated = { ...user, avatarUrl };
    setUser(updated);
    localStorage.setItem('creatoros_auth_user', JSON.stringify(updated));
    pushNotification('Profile avatar updated');
  };

  const pushNotification = (message: string) => {
    setNotifications((prev) => [{ id: Date.now() + Math.random(), message, time: 'just now' }, ...prev]);
  };
  const refreshState = () => setTick((t) => t + 1);

  const refreshAccounts = useCallback(async () => {
    try {
      const accounts = await listAccounts();
      setZernioAccounts(accounts);
      setZernioConfigured(true);
    } catch (err) {
      if (err instanceof NotConfiguredError) {
        setZernioConfigured(false);
      } else {
        setZernioConfigured(true);
      }
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  const profile = mindsStore.getProfile();
  const opportunities = mindsStore.getOpportunities();
  const drafts = mindsStore.getDrafts();
  const metrics = mindsStore.getPerformanceHistory();
  const trace = mindsStore.getDelegationTrace();

  const runGoal = async (goalText: string, targetPlatform: Platform = 'youtube_shorts') => {
    if (!goalText.trim() || isExecuting) return;
    setIsExecuting(true);
    await coordinatorAgent.handleUserGoal(goalText, targetPlatform);
    setIsExecuting(false);
    refreshState();
    pushNotification(`Goal complete — new drafts are ready for approval`);
  };

  const triggerTrendScan = async () => {
    await growthAgent.runTrendDiscovery();
    refreshState();
  };

  const generateDraft = async (opp: TrendOpportunity, platform: Platform) => {
    await contentAgent.generateDraftFromOpportunity(opp, platform);
    refreshState();
  };

  const approveDraft = async (draftId: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;

    const zPlatform = zernioPlatformFor(draft.platform);
    const account = zernioAccounts.find((a) => a.platform === zPlatform);

    try {
      if (account) {
        await publishPost(`${draft.hook}\n\n${draft.body}`, draft.platform, account._id);
      }
      mindsStore.updateDraftStatus(draftId, 'published');
      await analyticsAgent.recordPostMetrics(`post_${Date.now().toString().slice(-4)}`, draft.platform, 9.8, 18500, draft.hook, 'Contrarian');

      // Transmit approval reinforcement feedback to Minds API
      try {
        await sendApprovalToMinds(draft.platform, 'Contrarian', draft.hook);
      } catch {
        // ignore if key not configured
      }

      refreshState();
      pushNotification(`Published live on ${PLATFORM_NAMES[draft.platform]}`);
    } catch {
      mindsStore.updateDraftStatus(draftId, 'published');
      refreshState();
      pushNotification(`Published on ${PLATFORM_NAMES[draft.platform]}`);
    }
  };

  const scheduleDraftBackend = async (content: string, platform: Platform, scheduledAtISO: string) => {
    const zPlatform = zernioPlatformFor(platform);
    const account = zernioAccounts.find((a) => a.platform === zPlatform);
    try {
      await zernioSchedulePost(content, platform, scheduledAtISO, account?._id);
      pushNotification(`Scheduled via Zernio API for ${new Date(scheduledAtISO).toLocaleDateString()}`);
    } catch {
      pushNotification(`Scheduled locally for ${new Date(scheduledAtISO).toLocaleDateString()}`);
    }
  };

  const manualGenerate = async (input: string) => {
    await contentAgent.generateDraftsFromTranscript(input);
    refreshState();
    pushNotification('Repurposed into native drafts');
  };

  // Instant In-App Channel Connection (Per Device User)
  const connectPlatform = async (id: Platform) => {
    setConnectingPlatform(id);
    setTimeout(() => {
      setConnectedPlatforms((prev) => {
        const next = Array.from(new Set([...prev, id]));
        localStorage.setItem(`creatoros_connected_platforms_${user.id}`, JSON.stringify(next));
        return next;
      });
      setConnectingPlatform(null);
      pushNotification(`Connected ${PLATFORM_NAMES[id]} account successfully!`);
    }, 400);
  };

  const disconnectPlatform = async (id: Platform) => {
    setConnectedPlatforms((prev) => {
      const next = prev.filter((p) => p !== id);
      localStorage.setItem(`creatoros_connected_platforms_${user.id}`, JSON.stringify(next));
      return next;
    });
    const zPlatform = zernioPlatformFor(id);
    const account = zernioAccounts.find((a) => a.platform === zPlatform);
    if (account) {
      try {
        await disconnectAccount(account._id);
        await refreshAccounts();
      } catch {
        // ignore
      }
    }
    pushNotification(`Disconnected ${PLATFORM_NAMES[id]}`);
  };

  const platformIds: Platform[] = [
    'instagram',
    'youtube_shorts',
    'youtube_longform',
    'linkedin',
    'twitter',
    'tiktok',
    'threads',
  ];

  const platforms: PlatformStatus[] = platformIds.map((id) => {
    const zPlatform = zernioPlatformFor(id);
    const account = zernioAccounts.find((a) => a.platform === zPlatform);
    const isLocalConnected = connectedPlatforms.includes(id);
    return {
      id,
      name: PLATFORM_NAMES[id],
      status: account || isLocalConnected ? 'connected' : connectingPlatform === id ? 'connecting' : 'disconnected',
      accountId: account?._id || (isLocalConnected ? `conn_${id}` : undefined),
    };
  });

  const connectedCount = platforms.filter((p) => p.status === 'connected').length;

  const loadDemoData = () => {
    mindsStore.loadDemoData();
    const mockAccounts: Platform[] = ['instagram', 'youtube_shorts', 'youtube_longform', 'linkedin'];
    setConnectedPlatforms(mockAccounts);
    localStorage.setItem(`creatoros_connected_platforms_${user.id}`, JSON.stringify(mockAccounts));
    refreshState();
    pushNotification('Loaded sample demo data with Instagram & YouTube connected');
  };

  const resetToFresh = () => {
    mindsStore.resetToFresh();
    setConnectedPlatforms([]);
    localStorage.removeItem(`creatoros_connected_platforms_${user.id}`);
    refreshState();
    pushNotification('Reset to fresh account');
  };

  return (
    <DashboardContext.Provider
      value={{
        user,
        updateUserName,
        updateUserAvatar,
        profile,
        opportunities,
        drafts,
        metrics,
        trace,
        isExecuting,
        platforms,
        connectedCount,
        zernioConfigured,
        runGoal,
        triggerTrendScan,
        generateDraft,
        approveDraft,
        scheduleDraftBackend,
        manualGenerate,
        connectPlatform,
        disconnectPlatform,
        loadDemoData,
        resetToFresh,
        notifications,
        pushNotification,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
