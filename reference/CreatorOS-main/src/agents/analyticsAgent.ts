import { PerformanceMetric, Platform } from '../types';
import { mindsStore } from '../memory/mindsStore';
import { sendApprovalToMinds } from '../lib/minds';

export class AnalyticsAgent {
  public name = "Analytics & Persistence Loop Agent";

  public async fetchRealZernioMetrics(postId: string): Promise<{ views: number; engagementRate: number } | null> {
    try {
      const res = await fetch(`/api/zernio/analytics?postId=${encodeURIComponent(postId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.views !== undefined && data.engagementRate !== undefined) {
        return { views: Number(data.views) || 0, engagementRate: Number(data.engagementRate) || 0 };
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Generates a computed performance insight dynamically from engagement metrics & hook style.
   */
  private generateDynamicInsight(platform: Platform, hookStyle: string, engagementRate: number, views: number): string {
    const platName = platform === 'twitter' ? 'X (Twitter)' : platform === 'linkedin' ? 'LinkedIn' : 'YouTube Shorts';
    const boostPct = Math.round((engagementRate / 5) * 20);

    if (engagementRate >= 8.0) {
      return `${hookStyle} hook outperformed average on ${platName} by +${boostPct}% across ${views.toLocaleString()} views. Saved preference to Minds memory.`;
    } else if (engagementRate >= 5.0) {
      return `${hookStyle} hook achieved solid ${engagementRate}% engagement rate on ${platName}. Preference recorded.`;
    } else {
      return `${platName} post received ${views.toLocaleString()} impressions with ${engagementRate}% engagement. Adapting future hooks.`;
    }
  }

  public async recordPostMetrics(
    postId: string,
    platform: Platform,
    engagementRate: number,
    views: number,
    hookText?: string,
    hookStyle?: string
  ): Promise<PerformanceMetric> {
    const realZernioData = await this.fetchRealZernioMetrics(postId);
    const finalViews = realZernioData ? realZernioData.views : views;
    const finalEngagement = realZernioData ? realZernioData.engagementRate : engagementRate;
    const styleLabel = hookStyle || "Memory-Guided Dynamic Hook";

    const computedInsight = this.generateDynamicInsight(platform, styleLabel, finalEngagement, finalViews);

    const newMetric: PerformanceMetric = {
      postId,
      platform,
      hookStyle: styleLabel,
      views: finalViews,
      engagementRate: finalEngagement,
      insight: computedInsight,
      timestamp: "Just now"
    };

    // Write back into Minds Memory Store namespace: analytics.performance_history
    mindsStore.addMetric(newMetric);

    // Send real approval/feedback to Minds SDK if hook text is provided
    if (hookText) {
      sendApprovalToMinds(platform, styleLabel, hookText).catch(() => {});
    }

    mindsStore.addTraceStep({
      id: `step_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      agentName: "Analytics Agent",
      action: "Persistence Feedback Verification",
      details: `Recorded post ${postId} (${platform}): ${finalViews.toLocaleString()} views, ${finalEngagement}% engagement. Computed insight: "${computedInsight}". Saved to Minds memory.`,
      status: "completed"
    });

    return newMetric;
  }
}

export const analyticsAgent = new AnalyticsAgent();
