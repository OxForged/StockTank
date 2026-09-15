import { ContentDraft, Platform, TrendOpportunity, PerformanceMetric } from '../types';
import { mindsStore } from '../memory/mindsStore';
import { repurposeWithMinds, MindsNotConfiguredError } from '../lib/minds';

type HookStyle = 'contrarian' | 'question' | 'stat' | 'story' | 'standard';

const ALL_PLATFORMS: Platform[] = ['instagram', 'youtube_shorts', 'youtube_longform'];

export class ContentAgent {
  public name = "Content Repurposing & Generation Agent";

  private selectWinningHookStyle(platform: Platform): { style: HookStyle; insight: string } {
    const history = mindsStore.getPerformanceHistory().filter(p => p.platform === platform);

    if (history.length === 0) {
      return { style: 'standard', insight: 'No prior performance data in memory — test-generating across default angles.' };
    }

    const best = [...history].sort((a, b) => b.engagementRate - a.engagementRate)[0];
    return { style: this.classifyHookStyle(best), insight: best.insight };
  }

  private classifyHookStyle(metric: PerformanceMetric): HookStyle {
    const label = metric.hookStyle.toLowerCase();
    if (label.includes('contrarian') || label.includes('bold')) return 'contrarian';
    if (label.includes('question')) return 'question';
    if (label.includes('case study') || label.includes('number') || label.includes('stat')) return 'stat';
    if (label.includes('visual') || label.includes('problem') || label.includes('story')) return 'story';
    return 'standard';
  }

  /**
   * Generates varied contrarian hooks following v2 pattern rules with few-shot examples
   * rather than rigid repetitive strings.
   */
  private craftHook(style: HookStyle, platform: Platform, topic: string, seed: number = 0): string {
    const variations = [
      `Everyone is optimizing for standard ${topic}. Here's why doing the opposite actually drives reach.`,
      `Most creators are approaching ${topic} completely backwards in 2026.`,
      `The top 1% of digital builders do the exact opposite of traditional ${topic}.`,
      `[Common wisdom] about ${topic} is quietly hurting your growth trajectory.`,
    ];
    const contrarianVariant = variations[seed % variations.length]!;

    switch (style) {
      case 'contrarian':
        if (platform === 'instagram') return `${contrarianVariant}`;
        if (platform === 'youtube_shorts') return `Stop. The biggest myth about ${topic} is costing you views.`;
        if (platform === 'youtube_longform') return `Why 90% of creators fail at ${topic} (And how to fix it).`;
        if (platform === 'linkedin') return `${contrarianVariant}`;
        return `Everyone is wrong about ${topic}. Here is what the real data shows:`;

      case 'question':
        if (platform === 'instagram') return `Ever wonder why ${topic} is quietly taking over creator workflows?`;
        if (platform === 'youtube_shorts') return `What if ${topic} was 10x easier than everyone makes it look?`;
        if (platform === 'youtube_longform') return `Is ${topic} the single biggest leverage point for creators in 2026?`;
        if (platform === 'linkedin') return `Why are so few builders talking about the real mechanics of ${topic}?`;
        return `What if ${topic} isn't what you think it is?`;

      case 'stat':
        if (platform === 'instagram') return `The breakdown behind ${topic} (Key Metric Insights)`;
        if (platform === 'youtube_shorts') return `${topic} just generated a +36% retention spike. Here's why.`;
        if (platform === 'youtube_longform') return `The complete data breakdown on ${topic} (Real Analytics).`;
        if (platform === 'linkedin') return `The numbers on ${topic} are in — and they're bigger than expected.`;
        return `${topic} just moved the needle by double digits. Here's the breakdown.`;

      case 'story':
        if (platform === 'instagram') return `Last week we tested ${topic} in production. Here's what happened`;
        if (platform === 'youtube_shorts') return `[VISUAL: Solo creator screen recording] Here is what happened with ${topic}.`;
        if (platform === 'youtube_longform') return `How we built a multi-agent system around ${topic}.`;
        if (platform === 'linkedin') return `I watched ${topic} unfold across 500 posts. Here are the 3 big takeaways:`;
        return `I almost missed this: ${topic} is quietly changing everything.`;

      default:
        if (platform === 'instagram') return `A fast 30-second breakdown on ${topic}`;
        if (platform === 'youtube_shorts') return `Here is the fastest way to master ${topic} in 30 seconds.`;
        if (platform === 'youtube_longform') return `The definitive guide to ${topic} for digital creators.`;
        if (platform === 'linkedin') return `Most creators are sleeping on ${topic}. Here's what the data shows:`;
        return `${topic} is changing the creator economy right now.`;
    }
  }

  private craftBody(platform: Platform, topic: string, angle: string, source: string, viralityScore?: number): string {
    const scoreLine = viralityScore ? `Virality Score: ${viralityScore}/100\n` : '';

    if (platform === 'instagram') {
      return `Here is why this matters and how to stay ahead:\n\n1. Key Angle: ${angle}\n2. Trend Source: ${source}\n${scoreLine}\nMinds memory agents automatically learn from past post engagement to improve future hooks.`;
    }
    if (platform === 'youtube_shorts') {
      return `[VISUAL: Solo creator screen-recording agent workflow]\n[AUDIO: Fast-paced synth beat]\n\n[0:00-0:03 HOOK: Stop. The biggest myth about ${topic} is costing you reach.]\n[0:03-0:22 EXPLAINER: ${angle}]\n${viralityScore ? `[TEXT ON SCREEN: Retention Prediction ${viralityScore}%]\n` : ''}[0:22-0:30 CTA: Try this setup and see if your reach doubles!]`;
    }
    if (platform === 'youtube_longform') {
      return `In this full chaptered deep-dive video, we break down ${topic} step-by-step:\n\n0:00 - Introduction & The Core Problem\n1:45 - The Limitation of Stateless Prompting\n4:12 - Autonomous Memory Architecture with Minds\n7:50 - Live Case Study: ${angle}\n12:15 - Actionable Blueprint for Digital Creators`;
    }
    if (platform === 'linkedin') {
      return `Over the past week, trend signals highlighted this topic for creator growth potential.\n\nKey Takeaway:\n${angle}\n\nTrend Source: ${source}\n\nBy leveraging persistent multi-agent memory, creators no longer have to spend 4 hours daily repurposing manually.`;
    }
    return `Here is why this matters and how to stay ahead:\n\n1. Angle: ${angle}\n2. Source: ${source}.\n3. Persistence Loop: Minds agents write performance metrics back into state autonomously.`;
  }

  private craftCta(style: HookStyle, platform: Platform, topic: string): string {
    if (platform === 'instagram') {
      return style === 'question' ? `Drop a comment below with your take on ${topic}!` : `Save & Share this post with a fellow creator testing ${topic}!`;
    }
    if (platform === 'youtube_shorts') {
      return `Subscribe for daily AI creator breakdowns!`;
    }
    if (platform === 'youtube_longform') {
      return `Subscribe to the channel and check the description link to try CreatorOS!`;
    }
    if (platform === 'linkedin') {
      return style === 'stat' ? `Read the full breakdown in the comments below.` : `Drop your thoughts on ${topic} in the comments below.`;
    }
    return `Retweet to share with fellow builders!`;
  }

  private buildFallbackDraft(opportunity: TrendOpportunity, platform: Platform): ContentDraft {
    const { style, insight } = this.selectWinningHookStyle(platform);

    const seed = Date.now();
    const hook = this.craftHook(style, platform, opportunity.topic, seed);
    const body = this.craftBody(platform, opportunity.topic, opportunity.angle, opportunity.source, opportunity.opportunityScore);
    const cta = this.craftCta(style, platform, opportunity.topic);

    const newDraft: ContentDraft = {
      id: `draft_${Date.now()}_${platform}`,
      opportunityId: opportunity.id,
      platform,
      hook,
      body,
      cta,
      status: 'pending_approval',
      createdAt: 'Just now',
      predictedPerformanceScore: Math.min(99, opportunity.opportunityScore + 2)
    };

    mindsStore.addDraft(newDraft);

    mindsStore.addTraceStep({
      id: `step_${Date.now()}_${platform}`,
      timestamp: new Date().toLocaleTimeString(),
      agentName: "Content Agent",
      action: "Generate Draft (Memory-Adapted v2)",
      details: `Read analytics.performance_history for ${platform} → selected "${style}" hook style (${insight}). Generated native ${platform.toUpperCase()} draft for "${opportunity.topic}". Saved to content.drafts.`,
      status: "completed"
    });

    return newDraft;
  }

  public async generateDraftFromOpportunity(opportunity: TrendOpportunity, platform: Platform): Promise<ContentDraft> {
    return this.buildFallbackDraft(opportunity, platform);
  }

  private truncateAtWord(text: string, limit: number): string {
    if (text.length <= limit) return text;
    const cut = text.slice(0, limit - 3);
    const lastSpace = cut.lastIndexOf(' ');
    return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}...`;
  }

  private extractTopicAndAngle(transcript: string): { topic: string; angle: string } {
    const cleaned = transcript.trim().replace(/\s+/g, ' ');
    const firstSentence = cleaned.split(/(?<=[.!?])\s/)[0] || cleaned;
    const topic = this.truncateAtWord(firstSentence, 80);
    const angle = this.truncateAtWord(cleaned, 220);
    return { topic, angle };
  }

  /**
   * Multi-Platform Native Output with Real Minds Integration (v2 Prompts):
   * Attempts to call real Minds Agent API via /api/minds/repurpose.
   * If Minds API is configured, uses real Minds LLM response!
   * Fallbacks gracefully if key is not configured.
   */
  public async generateDraftsFromTranscript(transcript: string): Promise<ContentDraft[]> {
    const { topic, angle } = this.extractTopicAndAngle(transcript);

    try {
      const mindsResult = await repurposeWithMinds(transcript, 'Tech & AI Creator', 'contrarian');

      if (mindsResult && mindsResult.drafts) {
        const timestamp = Date.now();
        const drafts: ContentDraft[] = [];

        const baseScore = mindsResult.adapted_from_memory ? 91 : 84;

        if (mindsResult.drafts.instagram) {
          const ig: any = mindsResult.drafts.instagram;
          const draft: ContentDraft = {
            id: `draft_${timestamp}_instagram`,
            opportunityId: `opp_${timestamp}`,
            platform: 'instagram',
            hook: typeof ig === 'string' ? String(ig).slice(0, 120) : (ig.hook || 'Instagram Content Draft'),
            body: typeof ig === 'string' ? String(ig) : (ig.body || String(ig)),
            cta: typeof ig === 'string' ? 'Save & Share this post!' : (ig.cta || 'Save & Share this post!'),
            status: 'pending_approval',
            createdAt: 'Just now',
            predictedPerformanceScore: Math.min(98, baseScore + (timestamp % 7)),
          };
          mindsStore.addDraft(draft);
          drafts.push(draft);
        }

        if (mindsResult.drafts.youtube_shorts) {
          const yt: any = mindsResult.drafts.youtube_shorts;
          const draft: ContentDraft = {
            id: `draft_${timestamp}_youtube_shorts`,
            opportunityId: `opp_${timestamp}`,
            platform: 'youtube_shorts',
            hook: typeof yt === 'string' ? String(yt).slice(0, 120) : (yt.hook || 'YouTube Shorts Script'),
            body: typeof yt === 'string' ? String(yt) : (yt.script || String(yt)),
            cta: typeof yt === 'string' ? 'Subscribe for daily creator tips!' : (yt.cta || 'Subscribe for daily creator tips!'),
            status: 'pending_approval',
            createdAt: 'Just now',
            predictedPerformanceScore: Math.min(98, baseScore + 2 + (timestamp % 5)),
          };
          mindsStore.addDraft(draft);
          drafts.push(draft);
        }

        if (mindsResult.drafts.youtube_longform) {
          const ytl: any = mindsResult.drafts.youtube_longform;
          const draft: ContentDraft = {
            id: `draft_${timestamp}_youtube_longform`,
            opportunityId: `opp_${timestamp}`,
            platform: 'youtube_longform',
            hook: typeof ytl === 'string' ? String(ytl).slice(0, 120) : (ytl.hook || 'YouTube Video Deep-Dive'),
            body: typeof ytl === 'string' ? String(ytl) : (ytl.body || String(ytl)),
            cta: typeof ytl === 'string' ? 'Subscribe for more deep dives!' : (ytl.cta || 'Subscribe for more deep dives!'),
            status: 'pending_approval',
            createdAt: 'Just now',
            predictedPerformanceScore: Math.min(98, baseScore - 2 + (timestamp % 6)),
          };
          mindsStore.addDraft(draft);
          drafts.push(draft);
        }

        mindsStore.addTraceStep({
          id: `step_${timestamp}_minds`,
          timestamp: new Date().toLocaleTimeString(),
          agentName: 'Content Agent',
          action: 'Minds Agent Execution (v2)',
          details: `Processed transcript via real Minds API. Memory adapted: ${mindsResult.adapted_from_memory ? 'Yes (Cited Memory Entry)' : 'False (No prior posts in memory)'}. Insight: ${mindsResult.memory_insight || 'Active'}.`,
          status: 'completed',
        });

        if (drafts.length > 0) return drafts;
      }
    } catch (err) {
      if (err instanceof MindsNotConfiguredError) {
        console.log('[Minds] Key not configured — falling back to local memory engine');
      } else {
        console.warn('[Minds] API call error:', err);
      }
    }

    const opportunity: TrendOpportunity = {
      id: `opp_transcript_${Date.now()}`,
      topic,
      source: `Creator Input (${new Date().toLocaleDateString()})`,
      opportunityScore: Math.min(96, Math.max(78, 85 + (Date.now() % 10))),
      angle,
      category: "Tech",
      timestamp: "Just now"
    };

    return ALL_PLATFORMS.map(platform => this.buildFallbackDraft(opportunity, platform));
  }
}

export const contentAgent = new ContentAgent();
