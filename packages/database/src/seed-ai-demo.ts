/**
 * DEMO AI show: an "AI Desk" show hosted by two AI personalities, with one draft-free published episode shell.
 * Media is attached separately through the normal upload pipeline. Everything is labeled DEMO and disclosed as AI.
 */
import 'dotenv/config';
import { createPrismaClient } from './index.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(url);

const DISCLOSURE = 'AI personality: scripts are AI-generated and reviewed by StockTank editors; the voice is synthetic. Informational only, not investment advice.';

const personalities = [
  {
    slug: 'stocktank-anchor',
    name: 'StockTank Anchor',
    description: 'A professional financial-media host who frames the story and keeps the discussion grounded.',
    tone: 'calm, clear, neutral',
    expertise: ['markets news', 'show hosting'],
    prompt:
      'You are StockTank Anchor, a professional financial-media host. Introduce topics, ask clarifying questions and summarise. Never give investment advice, price predictions or return promises. Only state facts supported by the provided sources and say when something is not covered.',
    voiceId: 'windows:Microsoft David Desktop',
  },
  {
    slug: 'rwa-analyst',
    name: 'RWA Analyst',
    description: 'Explains real-world-asset and tokenization concepts in plain language, including the risks.',
    tone: 'precise, educational',
    expertise: ['tokenization', 'real-world assets', 'market structure'],
    prompt:
      'You are RWA Analyst, an educational explainer of real-world-asset tokenization. Explain mechanisms and risks plainly with sources. Never recommend products, never predict prices or yields, and never invent statistics.',
    voiceId: 'windows:Microsoft Zira Desktop',
  },
];

async function main() {
  const hostIds: string[] = [];
  for (const p of personalities) {
    const host = await prisma.host.upsert({
      where: { slug: p.slug },
      update: { name: p.name, bio: p.description, isAi: true, isDemo: true },
      create: { slug: p.slug, name: p.name, bio: p.description, isAi: true, isDemo: true },
    });
    hostIds.push(host.id);
    const personality = await prisma.aiPersonality.upsert({
      where: { slug: p.slug },
      update: { name: p.name, description: p.description, tone: p.tone, expertise: p.expertise, disclosures: DISCLOSURE, hostId: host.id, voiceId: p.voiceId, status: 'published', isDemo: true },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        tone: p.tone,
        expertise: p.expertise,
        disclosures: DISCLOSURE,
        personalityPrompt: p.prompt,
        voiceId: p.voiceId,
        hostId: host.id,
        status: 'published',
        isDemo: true,
        promptVersions: { create: { version: 1, content: p.prompt, note: 'Initial demo prompt' } },
      },
    });
    console.log(`personality ${personality.slug}`);
  }

  const show = await prisma.show.upsert({
    where: { slug: 'ai-desk' },
    update: {},
    create: {
      slug: 'ai-desk',
      title: 'AI Desk',
      tagline: 'Market explainers hosted by StockTank’s AI personalities.',
      description:
        'AI Desk is hosted by disclosed AI personalities. Scripts are AI-generated and reviewed before publishing; voices are synthetic. Informational and educational only, never investment advice.',
      status: 'published',
      isDemo: true,
      podcastEnabled: true,
      podcastCategory: 'Business',
      podcastSubcategory: 'Investing',
      podcastAuthor: 'StockTank AI Desk',
      hosts: { create: hostIds.map((hostId) => ({ hostId })) },
    },
  });

  const description = [
    'StockTank Anchor and RWA Analyst explain tokenized treasuries: what they are, why they exist, and the risks to check.',
    'How this episode was made (DEMO): the script was written by an AI assistant during development, both voices use the built-in Windows speech engine, and the video was rendered with FFmpeg. It was not produced by the StockTank AI pipeline, which requires provider keys.',
    'Informational only. Not investment advice.',
  ].join('\n\n');
  const episode = await prisma.episode.upsert({
    where: { showId_slug: { showId: show.id, slug: 'what-is-a-tokenized-treasury' } },
    update: { description },
    create: {
      showId: show.id,
      slug: 'what-is-a-tokenized-treasury',
      title: 'What is a tokenized treasury?',
      number: 1,
      summary: 'Two AI personalities explain tokenized treasuries, why they exist, and the risks to understand.',
      description,
      status: 'published',
      publishedAt: new Date(),
      isDemo: true,
      hosts: { create: hostIds.map((hostId) => ({ hostId })) },
    },
  });
  console.log(`episode ${episode.id} show ${show.slug}`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
