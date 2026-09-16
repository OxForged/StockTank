<div align="center">

# CreatorOS

### **Autonomous Multi-Agent AI Chief of Staff for Digital Creators**
*Powered by [Minds by Animoca Brands](https://hellominds.ai) & Built for Creative Minds Jam #1*

[![Live Demo](https://img.shields.io/badge/Live_Demo-the--creator--os.vercel.app-00F2FE?style=for-the-badge&logo=vercel&logoColor=white)](https://the-creator-os.vercel.app)
[![Minds SDK](https://img.shields.io/badge/Minds_SDK-v0.1.0--alpha-FF007A?style=for-the-badge&logo=brain&logoColor=white)](https://build.hellominds.ai)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](./LICENSE)

---

[Live Application](https://the-creator-os.vercel.app) • [Minds SDK Integration](#minds-sdk-integration--memory-architecture)

</div>

---

## The Creator Pain Point

Digital creators face a painful trade-off: **Creating vs. Repurposing**.

1. **Repurposing Burnout**: Spending 15+ hours every week manually reformatting raw video scripts, podcast audio, or blog posts into native formats for Instagram, YouTube Shorts, YouTube Video, LinkedIn, and X/Twitter.
2. **Stateless AI Amnesia**: Traditional AI tools forget creator identity, brand voice, target audience, and past post performance the instant a browser tab is refreshed. Creators end up re-typing guidelines over and over again.

---

## The CreatorOS Solution

**CreatorOS** solves creator burnout by introducing a **Minds-Native Autonomous Multi-Agent Network** that acts as a 24/7 AI Chief of Staff.

Unlike traditional chatbots, CreatorOS maintains **long-term persistent memory** across multi-session workflows. When you approve a draft or publish a post, CreatorOS sends reinforcement feedback back into Minds memory—ensuring every future post inherits your proven winning hooks.

```
                  ┌─────────────────────────────────────────┐
                  │          USER HIGH-LEVEL GOAL           │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │       COORDINATOR AGENT (Minds)         │
                  └────────────────────┬────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│  GROWTH AGENT   │           │  CONTENT AGENT  │           │ ANALYTICS AGENT │
│ Real-Time Trend │──────────►│ Native Format   │──────────►│ Persistence     │
│ Signal Discovery│           │ Repurposing     │           │ Feedback Loop   │
└─────────────────┘           └─────────────────┘           └─────────────────┘
                                       │                             │
                                       ▼                             │
                           ┌───────────────────────┐                 │
                           │  HELLOMINDS API SDK   │◄────────────────┘
                           │ Persistent Memory Thread│
                           └───────────────────────┘
```

---

## Specialized Multi-Agent Network

CreatorOS deploys 4 specialized AI agents working synchronously:

### 1. Coordinator Agent (`CoordinatorAgent`)
- **Function**: Decomposes natural language creator goals into structured sub-agent execution plans.
- **Trace Stepper**: Generates transparent, human-readable execution steps (*"Goal Received -> Trend Searched -> Native Draft Generated -> Analytics Recorded"*).

### 2. Growth Agent (`GrowthAgent`)
- **Function**: Scours live social signals (HackerNews, YouTube Trends, Reddit RSS) to discover high-opportunity topics in real time.
- **Dynamic Scoring**: Ranks trends dynamically based on engagement velocity and audience gap score (1–100 scale).

### 3. Content Agent (`ContentAgent`)
- **Function**: Queries persistent Minds Memory to retrieve your brand voice and historical top-performing hook styles.
- **Multi-Platform Outputs**:
  - **Instagram**: High-retention carousel scripts, <=125-char hooks, and visual pointers.
  - **YouTube Shorts**: 30–60 second shootable visual scripts with timed cue splits and spoken audio directions.
  - **YouTube Video**: Proportional chaptered outlines with timestamps and custom CTAs.
  - **LinkedIn & X/Twitter**: Thought leadership formatting, whitespace styling, and thread structure.

### 4. Analytics & Persistence Loop Agent (`AnalyticsAgent`)
- **Function**: Monitors engagement performance and transmits structured reinforcement approval signals (`EVENT TYPE: draft_approved`) directly into Minds API memory threads.
- **Continuous Learning**: Future repurposing sessions automatically adapt hook styles based on recorded historical wins.

---

## Minds SDK Integration & Memory Architecture

CreatorOS is built natively on **Minds by Animoca Brands** (`@animocabrands/minds-client-lib`).

```typescript
import { createMindsClient } from '@animocabrands/minds-client-lib';

// Initialize Minds Client
const client = createMindsClient({ builderApiKey: process.env.MINDS_BUILDER_API_KEY });

// Ensure persistent multi-session conversation thread
await client.ensureConversation('repurpose-main', mindId);

// Send content & retrieve memory-adapted output
await client.sendMessage({ alias: 'repurpose-main', messageText: prompt });
const outcome = await client.waitForReply({ alias: 'repurpose-main', timeoutMs: 90000 });
```

### Dual-Layer Memory Model
1. **Real Minds API Memory Thread**: Structured draft approval signals (`/api/minds/approve.ts`) and repurposing prompts (`/api/minds/repurpose.ts`) are stored in persistent conversation memory on `build.hellominds.ai`.
2. **Device-Level Client Isolation**: Local client state (`creator.profile`, `growth.opportunities`, `content.drafts`, `analytics.performance_history`) is namespaced per user device ID (`usr_device_*`) for zero-latency UI rendering and 100% data privacy.

---

## Key Features

- **Zero Login Blockers**: Instant access with per-device isolated client session memory.
- **Multi-Project Content Planner**: Visual weekly Kanban timeline, monthly grid, and queue list with client project grouping.
- **Zernio Social OAuth Integration**: Direct serverless publishing to connected accounts (Instagram, YouTube, LinkedIn, X/Twitter) via `/api/zernio/`.
- **Minds Memory Inspector**: Real-time inspection modal to view active Minds memory keys and historical memory logs.

---

## Tech Stack

- **Frontend**: React 18, TypeScript 5.5, Vite 5, TailwindCSS, Lucide Icons, Framer Motion.
- **AI Core**: Minds Client Lib (`@animocabrands/minds-client-lib`), HelloMinds Builder API.
- **Serverless API**: Vercel Serverless Functions (`/api/minds/`, `/api/zernio/`).
- **Publishing & Connections**: Zernio Social REST API.

---

## Getting Started Locally

### 1. Clone the Repository
```bash
git clone https://github.com/midexol/CreatorOS.git
cd CreatorOS
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the project root:
```env
MINDS_BUILDER_API_KEY=your_minds_builder_api_key_here
ZERNIO_API_KEY=sk_your_zernio_api_key_here
ZERNIO_PROFILE_ID=your_zernio_profile_id_here
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
Built for digital creators and submitted to <b>Creative Minds Jam #1</b>.
</div>
