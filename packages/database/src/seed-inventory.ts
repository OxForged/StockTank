import type { PrismaClient } from './generated/prisma/client.js';

type PlacementSeed = {
  key: string;
  name: string;
  description: string;
  surface: 'web' | 'newsletter' | 'audio' | 'video';
  format:
    | 'sponsor_banner'
    | 'native_card'
    | 'leaderboard'
    | 'sidebar_card'
    | 'audio_read'
    | 'video_preroll'
    | 'show_sponsorship'
    | 'newsletter_slot';
  specs: string;
  pricingModel: 'cpm' | 'flat_week' | 'flat_episode' | 'flat_issue';
  maxActiveCampaigns: number;
};

/**
 * Sellable inventory (§34). Unpriced by default: sales sets rates in the admin rate card.
 * Re-running the seed refreshes copy and specs but never overwrites rates, visibility or activation.
 */
export const PLACEMENTS: readonly PlacementSeed[] = [
  {
    key: 'home_presenting_sponsor',
    name: 'Homepage presenting sponsor',
    description: 'Sole sponsor mark beside the live desk at the top of the homepage.',
    surface: 'web',
    format: 'sponsor_banner',
    specs: 'Logo (SVG or transparent PNG), headline up to 90 characters, CTA up to 24 characters, destination URL.',
    pricingModel: 'flat_week',
    maxActiveCampaigns: 1,
  },
  {
    key: 'home_native_feed',
    name: 'Homepage native card',
    description: 'A clearly labelled sponsored card inside the "Latest on StockTank" grid.',
    surface: 'web',
    format: 'native_card',
    specs: 'Headline up to 90 characters, body up to 280 characters, 16:9 image (1200×675), alt text, CTA up to 24 characters.',
    pricingModel: 'cpm',
    maxActiveCampaigns: 4,
  },
  {
    key: 'home_leaderboard',
    name: 'Homepage leaderboard',
    description: 'Full-width unit between the rundown and the show lineup.',
    surface: 'web',
    format: 'leaderboard',
    specs: 'Image 970×90 (desktop) and 320×100 (mobile), alt text, destination URL.',
    pricingModel: 'cpm',
    maxActiveCampaigns: 3,
  },
  {
    key: 'watchlist_sidebar',
    name: 'Watchlist sidebar card',
    description: 'Sponsored card under the Projects / Companies watchlist.',
    surface: 'web',
    format: 'sidebar_card',
    specs: 'Headline up to 90 characters, body up to 140 characters, square image (600×600), alt text.',
    pricingModel: 'cpm',
    maxActiveCampaigns: 3,
  },
  {
    key: 'episode_page',
    name: 'Episode page sponsor',
    description: 'Sponsored card on episode pages, next to the player and show notes.',
    surface: 'web',
    format: 'sidebar_card',
    specs: 'Headline up to 90 characters, body up to 140 characters, square image (600×600), alt text.',
    pricingModel: 'cpm',
    maxActiveCampaigns: 3,
  },
  {
    key: 'project_page',
    name: 'Project page sponsor',
    description: 'Sponsored card on project profile pages. Never placed on the sponsor’s own competitors’ pages without consent.',
    surface: 'web',
    format: 'native_card',
    specs: 'Headline up to 90 characters, body up to 280 characters, 16:9 image (1200×675), alt text.',
    pricingModel: 'cpm',
    maxActiveCampaigns: 3,
  },
  {
    key: 'company_page',
    name: 'Company page sponsor',
    description: 'Sponsored card on public-company profile pages.',
    surface: 'web',
    format: 'native_card',
    specs: 'Headline up to 90 characters, body up to 280 characters, 16:9 image (1200×675), alt text.',
    pricingModel: 'cpm',
    maxActiveCampaigns: 3,
  },
  {
    key: 'newsletter_primary',
    name: 'Newsletter primary sponsor',
    description: 'The single sponsor slot in each StockTank newsletter issue.',
    surface: 'newsletter',
    format: 'newsletter_slot',
    specs: 'Headline up to 90 characters, 2–3 sentences of copy, image 600×300, one link. Delivered 5 business days before send.',
    pricingModel: 'flat_issue',
    maxActiveCampaigns: 1,
  },
  {
    key: 'audio_preroll',
    name: 'Podcast pre-roll (host read)',
    description: 'A host-read message before the episode begins. Scripts are approved by editorial.',
    surface: 'audio',
    format: 'audio_read',
    specs: '30–60 second script with talking points. No performance or return claims. Disclosed as sponsored on air.',
    pricingModel: 'flat_episode',
    maxActiveCampaigns: 1,
  },
  {
    key: 'video_preroll',
    name: 'Video pre-roll',
    description: 'A skippable pre-roll before long-form video episodes.',
    surface: 'video',
    format: 'video_preroll',
    specs: 'MP4, 1920×1080, 6–15 seconds, burned-in or sidecar captions required, loudness −16 LUFS.',
    pricingModel: 'cpm',
    maxActiveCampaigns: 3,
  },
  {
    key: 'show_sponsorship',
    name: 'Show presenting sponsorship',
    description: 'Presenting sponsor of one StockTank show: opening mention, show-page badge and newsletter credit.',
    surface: 'audio',
    format: 'show_sponsorship',
    specs: 'Brand name and 1-line descriptor, logo, destination URL. Sponsors never influence editorial content.',
    pricingModel: 'flat_episode',
    maxActiveCampaigns: 1,
  },
];

const FAR_FUTURE_YEARS = 5;

/** Seeds placements and StockTank's own (house) campaigns. House ads fill empty slots; paid campaigns always win. */
export async function seedAdInventory(prisma: PrismaClient, publicWebUrl: string): Promise<void> {
  for (const [index, p] of PLACEMENTS.entries()) {
    await prisma.adPlacement.upsert({
      where: { key: p.key },
      update: { name: p.name, description: p.description, specs: p.specs, surface: p.surface, format: p.format },
      create: { ...p, sortOrder: index * 10 },
    });
  }

  const house = await prisma.advertiser.upsert({
    where: { slug: 'stocktank-house' },
    update: {},
    create: {
      name: 'StockTank',
      slug: 'stocktank-house',
      website: publicWebUrl,
      industry: 'Media',
      status: 'approved',
      isHouse: true,
      complianceNotes: 'House advertiser for StockTank self-promotion.',
    },
  });

  const web = publicWebUrl.replace(/\/$/, '');
  const houseCampaigns = [
    {
      name: 'House: newsletter sign-ups',
      objective: 'Grow the confirmed newsletter audience.',
      placements: ['home_native_feed', 'watchlist_sidebar', 'episode_page', 'project_page', 'company_page'],
      creative: {
        kind: 'native' as const,
        headline: 'The StockTank briefing, in your inbox',
        body: 'Shows, clips and explainers on tokenized markets and crypto. Informational, never advice.',
        ctaLabel: 'Subscribe',
        clickUrl: `${web}/newsletter`,
      },
    },
    {
      name: 'House: advertise with StockTank',
      objective: 'Generate advertising inquiries.',
      placements: ['home_presenting_sponsor', 'home_leaderboard'],
      creative: {
        kind: 'native' as const,
        headline: 'Put your brand in front of on-chain markets',
        body: 'Sponsorships across shows, the live desk, the newsletter and clips. Every placement is disclosed and editor-reviewed.',
        ctaLabel: 'Media kit',
        clickUrl: `${web}/advertise`,
      },
    },
  ];

  for (const hc of houseCampaigns) {
    const existing = await prisma.campaign.findFirst({ where: { advertiserId: house.id, name: hc.name }, select: { id: true } });
    if (existing) continue;
    const placements = await prisma.adPlacement.findMany({ where: { key: { in: hc.placements } }, select: { id: true } });
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setUTCFullYear(endsAt.getUTCFullYear() + FAR_FUTURE_YEARS);
    await prisma.campaign.create({
      data: {
        advertiserId: house.id,
        name: hc.name,
        objective: hc.objective,
        status: 'approved',
        startsAt: now,
        endsAt,
        pricingModel: 'flat_week',
        rateCents: 0,
        budgetCents: 0,
        weight: 1,
        reviewedAt: now,
        placements: { create: placements.map((p) => ({ placementId: p.id })) },
        creatives: {
          create: {
            ...hc.creative,
            disclosureLabel: 'Advertisement',
            reviewStatus: 'approved',
            reviewedAt: now,
            policyFlags: [],
          },
        },
      },
    });
  }
}
