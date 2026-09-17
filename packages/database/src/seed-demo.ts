/**
 * DEMO content seed (§52): 5 shows, 10 hosts, 10 guests, 20 projects, 20 companies, 30 episodes,
 * 50 clips, 10 articles and today's live rundown. Every row is flagged `isDemo` and the UI labels it.
 * All names are fictional; no market data is seeded. Re-running replaces previous demo rows only.
 *
 *   pnpm --filter @stocktank/database seed:demo
 */
import path from 'node:path';
import { config } from 'dotenv';
import { createPrismaClient } from './index.js';

config({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Refusing to seed demo content in production (set ALLOW_DEMO_SEED=true to override)');
}
const prisma = createPrismaClient(url);

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const SHOWS = [
  { title: 'The Tank', tagline: 'Founders pitch on-chain projects to a panel that asks the hard questions.', description: 'Builders bring on-chain projects to the Tank for an unscripted grilling on product, token design and traction. Hard questions, no promotion.' },
  { title: 'Market Open', tagline: 'The weekday briefing on tokenized markets and crypto.', description: 'A daily briefing on tokenized equities, real-world assets and crypto: what moved, what is next and what it means. Informational, never advice.' },
  { title: 'Chain Reaction', tagline: 'A sourced roundtable on protocols, policy and hype.', description: 'Protocol founders, analysts and skeptics at one table. Every claim sourced, every clip linked to its timestamp.' },
  { title: 'RWA Report', tagline: 'Real-world assets on-chain, from treasuries to real estate.', description: 'How real-world assets move on-chain: custody, settlement, regulation and the plumbing underneath.' },
  { title: 'Founder Floor', tagline: 'Long-form conversations with the people building it.', description: 'Unhurried interviews with founders and operators about what they are building and why.' },
];

const EPISODE_TITLES: Record<string, string[]> = {
  'The Tank': [
    'Can a treasury protocol survive a bear market?',
    'The one-slide tokenomics test',
    'Pitch: a settlement layer for tokenized funds',
    'Why the panel passed on a yield app',
    'Pitch: compliance tooling for on-chain brokers',
    'What founders get wrong about token unlocks',
  ],
  'Market Open': [
    'Tokenized equities: what actually settles on-chain',
    'Stablecoin flows, explained in five minutes',
    'How to read an on-chain fund disclosure',
    'Custody, clearing and the T+0 question',
    'The week in tokenized markets',
    'What an oracle does, and what it cannot do',
  ],
  'Chain Reaction': [
    'Restaking, explained without the jargon',
    'Are app-chains worth the complexity?',
    'Where the yield really comes from',
    'Governance attacks and how DAOs defend',
    'Bridges: the risk everyone underprices',
    'Layer 2 fees after the next upgrade',
  ],
  'RWA Report': [
    'Inside a tokenized T-bill fund',
    'Why custody still matters on-chain',
    'Tokenized real estate: promise and problems',
    'Private credit on-chain, step by step',
    'Transfer agents in a tokenized world',
    'What regulators ask RWA issuers',
  ],
  'Founder Floor': [
    'Building exchange infrastructure from zero',
    'Hiring engineers for a regulated crypto company',
    'From trading desk to protocol founder',
    'Shipping wallets people actually use',
    'Running a DAO like an operating company',
    'The long road to a banking partner',
  ],
};

const CLIP_TITLES = [
  'The question every founder dodges', 'Why custody still matters', 'Where the yield really comes from', 'The one-slide tokenomics test',
  'What settlement really means', 'The bridge risk nobody prices', 'A fair launch, defined', 'How an oracle fails',
  'Unlock schedules in one minute', 'Why the panel said no', 'The compliance question', 'What T+0 changes',
  'The governance attack playbook', 'Reading a fund disclosure', 'Stablecoins are plumbing', 'The hiring mistake',
];

const PEOPLE_HOSTS = ['Jordan Vale', 'Priya Nair', 'Marcus Holt', 'Elena Brandt', 'Sam Okafor', 'Lena Ruiz', 'Theo Marsh', 'Aiko Tanaka', 'Noah Pierce', 'Grace Mensah'];
const PEOPLE_GUESTS = [
  ['Rafael Costa', 'Founder, Harbor Protocol'], ['Mira Solberg', 'COO, Tidewater Treasury'], ['Dev Anand', 'CTO, Keelnet'],
  ['Hannah Weiss', 'Researcher'], ['Kofi Boateng', 'Founder, Beacon Pay'], ['Isla Moreau', 'Partner, fund administrator'],
  ['Ben Carter', 'Head of Markets, Quay Markets'], ['Yuki Sato', 'Protocol engineer'], ['Omar Haddad', 'Compliance lead'],
  ['Clara Nguyen', 'Founder, Northwind'],
] as const;

const CHAINS = [
  { name: 'Ethereum', chainId: 1, explorer: 'https://etherscan.io' },
  { name: 'Base', chainId: 8453, explorer: 'https://basescan.org' },
  { name: 'Arbitrum One', chainId: 42161, explorer: 'https://arbiscan.io' },
  { name: 'Polygon', chainId: 137, explorer: 'https://polygonscan.com' },
  { name: 'Solana', chainId: null, explorer: 'https://explorer.solana.com' },
];

const PROJECTS: Array<[string, 'crypto_project' | 'protocol' | 'dao' | 'infrastructure' | 'rwa' | 'ecosystem' | 'application', string | null]> = [
  ['Harbor Protocol', 'protocol', 'Ethereum'], ['Lumen DAO', 'dao', 'Base'], ['Keelnet', 'infrastructure', null], ['Tidewater Treasury', 'rwa', 'Ethereum'],
  ['Beacon Pay', 'application', 'Solana'], ['Northwind', 'ecosystem', 'Base'], ['Quay Markets', 'rwa', 'Solana'], ['Strand Oracle', 'infrastructure', null],
  ['Meridian Vaults', 'protocol', 'Arbitrum One'], ['Ashgrove Credit', 'rwa', 'Polygon'], ['Kestrel Wallet', 'application', 'Ethereum'], ['Fathom Bridge', 'infrastructure', null],
  ['Copperline DAO', 'dao', 'Arbitrum One'], ['Saltmarsh', 'crypto_project', 'Base'], ['Orchard Index', 'protocol', 'Ethereum'], ['Pylon Settlement', 'infrastructure', 'Ethereum'],
  ['Wren Identity', 'application', 'Polygon'], ['Granite Estates', 'rwa', 'Polygon'], ['Tessellate', 'ecosystem', 'Solana'], ['Lanternfish', 'crypto_project', 'Arbitrum One'],
];

/** Fictional companies on the fictional DEMO exchange, so synthetic prices are never mistaken for real tickers. */
const COMPANIES: Array<[name: string, sector: string, country: string, ticker: string, meme: boolean]> = [
  ['Meridian Robotics', 'Industrials', 'US', 'MRDX', false], ['Atlas Grid Energy', 'Utilities', 'Canada', 'AGRD', false], ['Vela Biosystems', 'Healthcare', 'UK', 'VELB', false], ['Orbital Logistics', 'Transport', 'Singapore', 'ORBL', false],
  ['Cinder Semiconductor', 'Technology', 'US', 'CNDR', false], ['Fjord Payments', 'Financials', 'Norway', 'FJRD', false], ['Solace Foods', 'Consumer', 'Brazil', 'SOLF', false], ['Pinnacle Media Group', 'Communications', 'Japan', 'PNMG', false],
  ['Harrow Materials', 'Materials', 'Australia', 'HRWM', false], ['Brightwater Health', 'Healthcare', 'US', 'BWTH', false], ['Keystone Rail', 'Transport', 'Germany', 'KYRL', false], ['Lumina Retail', 'Consumer', 'France', 'LUMR', false],
  ['Northgate Insurance', 'Financials', 'UK', 'NGIN', false], ['Sierra Cloudworks', 'Technology', 'US', 'SRCW', false], ['Tidal Power', 'Utilities', 'Denmark', 'TDLP', false], ['Oakridge Pharma', 'Healthcare', 'Switzerland', 'OKRP', false],
  ['Vantage Aerospace', 'Industrials', 'US', 'VNTA', false], ['Coral Telecom', 'Communications', 'Mexico', 'CRLT', false], ['Summit Agriculture', 'Consumer', 'Kenya', 'SMAG', false], ['Ironbark Mining', 'Materials', 'Canada', 'IRBK', false],
  // Fictional meme-stock style names for the Meme Stock Radar preview.
  ['Squeeze Motors', 'Consumer', 'US', 'SQZM', true], ['Diamond Hands Media', 'Communications', 'US', 'DHND', true], ['Rocket Retail Co', 'Consumer', 'US', 'RKTR', true],
  ['Tendie Foods', 'Consumer', 'US', 'TNDY', true], ['Ape Arcade Games', 'Technology', 'US', 'APEG', true], ['Moonwalk Biotech', 'Healthcare', 'US', 'MNWK', true],
  ['Hodl Cinemas', 'Communications', 'US', 'HODL', true], ['Yolo Airlines', 'Transport', 'US', 'YOLO', true],
];

const ARTICLES = [
  ['How on-chain stock settlement works', 'Explainer: what changes, and what does not, when an equity settles on a blockchain.'],
  ['Reading a token unlock schedule', 'Guide: the columns that matter and the questions to ask.'],
  ['What makes an asset “real-world”?', 'Primer: custody, legal wrappers and redemption rights.'],
  ['Terms you heard on this week’s shows', 'Glossary: plain-language definitions from StockTank episodes.'],
  ['Oracles, explained', 'Explainer: how off-chain data reaches smart contracts and where it can fail.'],
  ['Stablecoins as payment rails', 'Explainer: reserves, attestations and redemption.'],
  ['A beginner’s guide to DAOs', 'Primer: proposals, voting and treasury controls.'],
  ['Bridges and their risks', 'Explainer: the main bridge designs and their trust assumptions.'],
  ['What a transfer agent does', 'Primer: the record-keeper behind every security, tokenized or not.'],
  ['How we label sponsored content', 'StockTank: our disclosure and review rules for advertising.'],
] as const;

async function clearDemo() {
  await prisma.livestream.deleteMany({ where: { isDemo: true } });
  await prisma.clip.deleteMany({ where: { isDemo: true } });
  await prisma.article.deleteMany({ where: { isDemo: true } });
  await prisma.episode.deleteMany({ where: { isDemo: true } });
  await prisma.show.deleteMany({ where: { isDemo: true } });
  await prisma.host.deleteMany({ where: { isDemo: true } });
  await prisma.guest.deleteMany({ where: { isDemo: true } });
  await prisma.project.deleteMany({ where: { isDemo: true } });
  await prisma.company.deleteMany({ where: { isDemo: true } });
}

async function main() {
  await clearDemo();

  const chainIds = new Map<string, string>();
  for (const c of CHAINS) {
    const row = await prisma.chain.upsert({
      where: { slug: slug(c.name) },
      update: {},
      create: { slug: slug(c.name), name: c.name, chainId: c.chainId, explorer: c.explorer },
    });
    chainIds.set(c.name, row.id);
  }

  const hosts = await Promise.all(
    PEOPLE_HOSTS.map((name) =>
      prisma.host.create({ data: { slug: `demo-${slug(name)}`, name, bio: 'DEMO host profile.', isDemo: true } }),
    ),
  );
  const guests = await Promise.all(
    PEOPLE_GUESTS.map(([name, title]) =>
      prisma.guest.create({ data: { slug: `demo-${slug(name)}`, name, title, bio: 'DEMO guest profile.', isDemo: true } }),
    ),
  );

  const projects = [];
  for (const [name, kind, chain] of PROJECTS) {
    projects.push(
      await prisma.project.create({
        data: {
          name,
          slug: slug(name),
          kind,
          description: `${name} is a fictional DEMO project used to preview StockTank project pages.`,
          chainId: chain ? chainIds.get(chain) : null,
          status: 'published',
          isDemo: true,
        },
      }),
    );
  }

  const companies = [];
  for (const [name, sector, country, ticker, meme] of COMPANIES) {
    companies.push(
      await prisma.company.create({
        data: {
          name,
          slug: slug(name),
          sector,
          country,
          ticker,
          exchange: 'DEMO',
          memeStock: meme,
          marketDataProvider: 'demo',
          description: `${name} is a fictional DEMO company on a fictional exchange, used to preview StockTank stock pages. Its prices are synthetic.`,
          status: 'published',
          isDemo: true,
        },
      }),
    );
  }

  const now = Date.now();
  const episodes = [];
  let episodeIndex = 0;
  const shows = [];
  for (const [showIndex, s] of SHOWS.entries()) {
    const show = await prisma.show.create({
      data: {
        slug: slug(s.title),
        title: s.title,
        tagline: s.tagline,
        description: s.description,
        status: 'published',
        isDemo: true,
        hosts: { create: [{ hostId: hosts[showIndex * 2]!.id }, { hostId: hosts[showIndex * 2 + 1]!.id }] },
      },
    });
    shows.push(show);
    for (const [n, title] of (EPISODE_TITLES[s.title] ?? []).entries()) {
      const publishedAt = new Date(now - (episodeIndex * 26 + showIndex * 3) * 60 * 60 * 1000);
      const episode = await prisma.episode.create({
        data: {
          showId: show.id,
          slug: slug(title),
          number: 6 - n,
          title,
          summary: `DEMO episode of ${s.title}. ${s.tagline}`,
          durationSeconds: 20 * 60 + ((episodeIndex * 7) % 40) * 60,
          status: 'published',
          publishedAt,
          isDemo: true,
          hosts: { create: [{ hostId: hosts[showIndex * 2]!.id }] },
          guests: { create: [{ guestId: guests[episodeIndex % guests.length]!.id, role: 'Guest' }] },
          projects: { create: [{ projectId: projects[episodeIndex % projects.length]!.id }] },
          companies: { create: [{ companyId: companies[episodeIndex % companies.length]!.id }] },
        },
      });
      episodes.push(episode);
      episodeIndex++;
    }
  }

  for (let i = 0; i < 50; i++) {
    const episode = episodes[i % episodes.length]!;
    const start = 60 + ((i * 137) % 1500);
    const length = [30, 45, 60, 75, 90][i % 5]!;
    await prisma.clip.create({
      data: {
        sourceEpisodeId: episode.id,
        title: CLIP_TITLES[i % CLIP_TITLES.length]!,
        startTime: start,
        endTime: start + length,
        transcript: null,
        // Human-approved demo clips; AI-generated clips start as drafts (§14).
        reviewStatus: 'published',
        isDemo: true,
      },
    });
  }

  for (const [i, [title, summary]] of ARTICLES.entries()) {
    await prisma.article.create({
      data: {
        slug: slug(title),
        title,
        summary,
        author: 'StockTank Newsroom (DEMO)',
        status: 'published',
        publishedAt: new Date(now - i * 30 * 60 * 60 * 1000),
        isDemo: true,
      },
    });
  }

  const hour = 60 * 60 * 1000;
  const rundown = [
    { show: 'Market Open', status: 'live' as const, offset: -0.5 * hour, segments: ['Pre-market: what moved overnight', 'Tokenized equities: settlement explained', 'RWA desk: treasury funds on-chain', 'Founder call: a live pitch preview', 'Wrap: what to watch this week'] },
    { show: 'The Tank', status: 'scheduled' as const, offset: 2 * hour, segments: ['Opening pitch', 'Panel questions', 'Deliberation', 'Verdict'] },
    { show: 'Chain Reaction', status: 'scheduled' as const, offset: 5 * hour, segments: ['Headlines', 'Roundtable', 'Listener questions'] },
    { show: 'RWA Report', status: 'scheduled' as const, offset: 8 * hour, segments: ['Market structure', 'Issuer interview', 'Regulatory notes'] },
  ];
  for (const r of rundown) {
    const show = shows.find((s) => s.title === r.show)!;
    await prisma.livestream.create({
      data: {
        showId: show.id,
        title: `${r.show} (DEMO broadcast)`,
        status: r.status,
        scheduledStart: new Date(now + r.offset),
        scheduledEnd: new Date(now + r.offset + hour),
        startedAt: r.status === 'live' ? new Date(now + r.offset) : null,
        streamUrl: null,
        isDemo: true,
        segments: { create: r.segments.map((title, position) => ({ position, title })) },
      },
    });
  }

  const counts = {
    shows: shows.length,
    hosts: hosts.length,
    guests: guests.length,
    projects: projects.length,
    companies: companies.length,
    episodes: episodes.length,
    clips: 50,
    articles: ARTICLES.length,
    livestreams: rundown.length,
  };
  console.log('DEMO content seeded:', counts);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
