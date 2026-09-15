# STOCKTANK — MASTER PRODUCTION BUILD PROMPT

## ROLE

You are the lead architect, senior full-stack engineer, AI systems architect, DevOps engineer, product designer, security engineer, QA engineer, and technical product manager for **StockTank**.

StockTank is a professional media and podcast network focused on:

> **ON-CHAIN STOCKS & CRYPTO PROJECTS**

The product should feel like a combination of:

* Shark Tank
* Bloomberg-style,corporate,meme,desk financial media
* modern podcast/video networks
* crypto-native media
* creator networks
* streaming platforms

Do NOT build a generic podcast website.

Build the foundation for a real media company that can scale from an MVP into:

* web
* iOS
* Android
* live streaming
* podcasting
* video
* short-form clips
* AI personalities
* AI-assisted production
* project/company profiles
* market/project intelligence
* advertising
* creator monetization
* TV/OTT applications
* international distribution

---

# 1. NON-NEGOTIABLE DEVELOPMENT PRINCIPLES

1. Production quality over demo quality.
2. Modular architecture.
3. API-first.
4. TypeScript wherever practical.
5. Strong typing.
6. Secure by default.
7. Mobile-ready from day one.
8. TV-ready API architecture.
9. Accessibility.
10. Responsive design.
11. Automated testing.
12. CI/CD.
13. Dockerized development.
14. Environment variables for secrets.
15. Never hard-code API keys.
16. Never hard-code production URLs.
17. Never fake production functionality.
18. Never use mock data where a real service should exist.
19. Build adapters around external providers.
20. Do not tightly couple StockTank to any one AI, blockchain, media, or cloud provider.

Before implementing anything, inspect the repository and existing code.

Never claim a feature is implemented unless it actually works.

---

# 2. PRIMARY STACK

Use:

Frontend:

* React
* Vite
* TypeScript
* Tailwind CSS
* shadcn/ui
* TanStack Query
* React Router
* Zustand where appropriate

Backend:

* Node.js
* Express
* TypeScript
* Zod
* OpenAPI
* REST API

Database:

* PostgreSQL
* Prisma ORM

Infrastructure:

* Docker
* Docker Compose
* Nginx or Traefik
* Redis

Search:

* Meilisearch

Jobs:

* BullMQ
* Redis

Media:

* FFmpeg
* S3-compatible object storage
* HLS for video streaming

Podcast:

* Castopod integration

Live radio:

* AzuraCast integration

Analytics:

* PostHog or a replaceable analytics adapter

Mobile:

* React Native
* Expo

Monorepo:

* pnpm
* Turborepo

Testing:

* Vitest
* Playwright
* React Testing Library

CI/CD:

* GitHub Actions

---

# 3. MONOREPO

Create:

stocktank/

apps/
web/
admin/
mobile/
tv/

services/
api/
media-worker/
ai-service/
blockchain-service/
search-service/
notification-service/

packages/
ui/
database/
types/
api-client/
auth/
config/
player/
analytics/
ai/
blockchain/

infrastructure/
docker/
nginx/
postgres/
redis/
meilisearch/
castopod/
azuracast/

docs/
architecture/
api/
deployment/
security/
ai/
database/

scripts/

---

# 4. STOCKTANK PRODUCT

Brand:

STOCKTANK

Primary positioning:

ON-CHAIN STOCKS & CRYPTO

Core product areas:

* Home
* Shows
* Live
* Watch
* Listen
* Clips
* News
* Projects
* Companies
* Markets
* Creators
* Search
* Library
* Account

---

# 5. WEB EXPERIENCE

Build a premium media-network interface.

Homepage:

Hero
Featured show
Live now
Latest episodes
Trending clips
Trending projects
Featured companies
Latest market conversations
Featured creators
Latest news
Upcoming shows

Do NOT make it look like a generic SaaS dashboard.

Use a strong editorial hierarchy.

Create dark/light theme support.

Create reusable design tokens.

---

# 6. CORE DATABASE

Create PostgreSQL schema for:

users

profiles

roles

permissions

shows

seasons

episodes

episode_guests

guests

hosts

companies

projects

chains

contracts

topics

categories

episode_projects

episode_companies

clips

videos

audio_assets

media_assets

playlists

playlist_items

articles

news_sources

livestreams

stations

comments

reactions

follows

bookmarks

notifications

subscriptions

advertisers

advertisements

campaigns

impressions

clicks

analytics_events

ai_personalities

ai_sessions

ai_messages

ai_generated_content

content_jobs

social_accounts

distribution_jobs

audit_logs

api_keys

feature_flags

system_settings

---

# 7. PROJECT DATA MODEL

StockTank needs a first-class Project entity.

Project fields should include:

id
name
slug
symbol
description
logo
banner
website
twitter
discord
telegram
chain
contract_address
category
status
launch_date
market_cap
volume
liquidity
verified
created_at
updated_at

Do not assume all projects have tokens.

Support:

* traditional companies
* crypto projects
* protocols
* DAOs
* infrastructure
* RWA projects
* ecosystems
* applications

---

# 8. COMPANY DATA MODEL

Support publicly traded companies.

Fields:

id
name
slug
ticker
exchange
sector
industry
description
logo
website
country
market_data_provider
created_at
updated_at

Never present financial information as guaranteed investment advice.

Use neutral informational language.

---

# 9. MEDIA GRAPH

Every piece of content should be connectable.

Example:

SHOW
→ EPISODE
→ GUEST
→ COMPANY
→ PROJECT
→ TOPIC
→ CLIPS
→ ARTICLES
→ SOCIAL POSTS

Implement relationships in PostgreSQL.

---

# 10. SEARCH

Use Meilisearch.

Index:

shows
episodes
clips
hosts
guests
companies
projects
articles
topics

Implement:

autocomplete

search suggestions

fuzzy matching

filters

categories

recent searches

trending searches

Search results should be grouped:

Shows
Episodes
People
Companies
Projects
Clips
News

---

# 11. PODCAST INFRASTRUCTURE

Integrate Castopod through an adapter.

StockTank should own:

* frontend
* branding
* user experience
* database
* discovery
* search
* analytics
* relationships

Castopod handles podcast infrastructure where appropriate.

Do NOT make the frontend dependent on Castopod's internal database.

Create:

CastopodAdapter

Methods:

createPodcast()

updatePodcast()

publishEpisode()

updateEpisode()

getEpisode()

getPodcast()

getRSSFeed()

---

# 12. LIVE RADIO

Integrate AzuraCast.

Create:

AzuraCastAdapter

Methods:

getStations()

getNowPlaying()

getListeners()

getStationStatus()

getPlaylist()

getRecentTracks()

StockTank should have its own Live UI.

Never expose internal AzuraCast UI to normal users unless explicitly required.

Use the AzuraCast API.

AzuraCast provides REST APIs for station monitoring and management and has a plugin architecture intended for station-specific extensions. Use those integration points instead of unnecessarily modifying its core.

---

# 13. MEDIA PIPELINE

Implement:

UPLOAD
→ VALIDATE
→ OBJECT STORAGE
→ MEDIA JOB
→ FFmpeg
→ TRANSCODE
→ THUMBNAILS
→ HLS
→ CDN
→ DATABASE

Support:

MP4
MOV
MP3
WAV
M4A

Generate:

1080p
720p
audio-only
thumbnail
vertical clip
square clip

Create media processing jobs with BullMQ.

---

# 14. AUTOMATIC CLIPPING

Create AI-assisted clipping.

Input:

long-form video/audio

Output candidates:

30 sec
60 sec
90 sec

Detect:

strong statements
important moments
questions
controversial-but-safe discussion
high-information moments
interesting explanations
humorous moments

Never invent quotes.

Always maintain a link to the source timestamp.

Each generated clip must store:

source_episode_id
start_time
end_time
transcript
confidence
generation_model
review_status

Human approval is required before public publication.

---

# 15. TRANSCRIPTION

Build transcription adapter.

Do not hard-code one provider.

Interface:

TranscriptionProvider

Methods:

transcribe()
detectLanguage()
generateTimestamps()
speakerDiarization()

Store:

transcript
segments
speakers
timestamps
confidence

---

# 16. AI PERSONALITY SYSTEM

Create a complete AI Personality platform.

AI personalities are NOT autonomous financial advisers.

They are media personalities, hosts, researchers, commentators, and assistants.

Create:

AI Personality

Fields:

id
name
slug
avatar
voice
description
personality_prompt
tone
expertise
disclosures
status
created_at

Example personalities:

StockTank Anchor

A professional financial-media host.

Crypto Scout

Explains crypto projects in an educational way.

RWA Analyst

Explains real-world-asset concepts.

Market Morning

Daily market-news personality.

Founder Interviewer

Interviews founders and asks structured questions.

Community Host

Reads approved community content.

---

# 17. AI PERSONALITY ARCHITECTURE

Never put personality prompts directly into frontend code.

Create:

AI Personality Service

Architecture:

User
↓
StockTank API
↓
AI Service
↓
Personality Configuration
↓
RAG
↓
LLM
↓
Safety / Fact Checks
↓
Response

Every AI response should store:

personality_id
model
prompt_version
knowledge_sources
timestamp
response
moderation_status

---

# 18. AI MODEL PROVIDER ABSTRACTION

Create:

LLMProvider

Support provider adapters.

Example:

AnthropicProvider
OpenAIProvider
LocalProvider

Methods:

generateText()
generateStructured()
streamText()
summarize()
classify()
extractEntities()

The application must not depend directly on a single AI vendor.

---

# 19. RAG SYSTEM

Build StockTank RAG.

Knowledge sources:

StockTank articles
approved transcripts
episode transcripts
project profiles
company profiles
official project documentation
approved news sources
internal research
show notes

Pipeline:

SOURCE
↓
INGEST
↓
CLEAN
↓
CHUNK
↓
EMBED
↓
VECTOR STORE
↓
RETRIEVAL
↓
RERANK
↓
LLM
↓
CITATIONS

Do not allow AI personalities to silently fabricate information.

When factual answers are generated, expose source references where appropriate.

---

# 20. AI CONTENT FACTORY

Create an AI production pipeline.

One episode should be capable of producing:

Transcript
Show notes
Summary
SEO title
SEO description
Chapters
Quote candidates
Clip candidates
Short-form scripts
Social posts
Newsletter draft
Article draft
Project mentions
Company mentions
Topics
Tags

Everything must enter a review queue.

AI generates.

Human approves.

Then distribution happens.

---

# 21. AI SOCIAL DISTRIBUTION

Create a distribution service.

Platforms should be adapters.

Examples:

YouTube
X
Instagram
Facebook
TikTok
Podcast RSS

Do not make publishing dependent on one social platform.

Create:

DistributionProvider

Methods:

publishPost()
publishVideo()
publishShort()
publishEpisode()
getStatus()

Track every distribution job.

---

# 22. AI MARKETING ENGINE

Create:

Marketing Intelligence Service

Functions:

content recommendations
headline suggestions
thumbnail concepts
clip ranking
posting-time suggestions
audience segmentation
content performance analysis
SEO recommendations
campaign generation

Do not automatically publish sensitive financial claims.

Human approval is required for financial/market claims.

---

# 23. AI NEWSROOM

Create:

Newsroom

Workflow:

SOURCE
↓
INGEST
↓
DEDUPLICATE
↓
CLASSIFY
↓
EXTRACT ENTITIES
↓
RANK
↓
EDITOR REVIEW
↓
PUBLISH

Track:

source
author
publication date
original URL
entities
topics
confidence
editor approval

Never scrape or republish copyrighted articles wholesale.

Generate original summaries with source attribution.

---

# 24. AI INTERVIEW ASSISTANT

For every guest:

Input:

guest profile
company
project
previous appearances
approved research

Generate:

opening
questions
follow-ups
technical questions
business questions
rapid-fire questions
closing questions

The host must remain in control.

---

# 25. AI VOICE

Create a voice abstraction layer.

VoiceProvider:

generateSpeech()
streamSpeech()
listVoices()

Store:

voice_id
provider
language
style
consent_status

Only use voices with appropriate rights/consent.

Clearly disclose AI-generated hosts where appropriate.

---

# 26. AI AVATARS

Do not tightly couple the platform to a single avatar vendor.

Create:

AvatarProvider

Methods:

createVideo()
generateTalkingHead()
renderScene()

AI avatar content should go through the same editorial review system as normal content.

---

# 27. AI CONTENT REVIEW

Every AI-generated asset has:

draft
review
approved
rejected
published

Never allow unrestricted AI publication of financial claims.

Create moderation rules for:

false claims
fabricated statistics
unsupported investment claims
impersonation
copyright issues
unsafe content
misleading headlines

---

# 28. ADMIN DASHBOARD

Build a complete StockTank Admin.

Navigation:

Dashboard

Content

* Episodes
* Videos
* Clips
* Articles
* Shorts

Network

* Shows
* Hosts
* Guests
* Creators

Entities

* Companies
* Projects
* Tokens
* Chains

AI

* Personalities
* Prompts
* Knowledge
* AI jobs
* Review queue

Distribution

* YouTube
* X
* Instagram
* TikTok
* Facebook
* RSS

Live

* Stations
* Streams
* Now Playing

Analytics

* Audience
* Content
* Projects
* Shows
* Revenue

Advertising

* Advertisers
* Campaigns
* Placements

System

* Users
* Roles
* Permissions
* API keys
* Feature flags
* Audit logs

---

# 29. ADMIN ANALYTICS

Dashboard metrics:

DAU
MAU
watch time
listening time
episode completion
retention
views
unique viewers
downloads
followers
shares
comments
likes
clip performance
show performance
project mentions
search queries
traffic sources

---

# 30. USER SYSTEM

Users can:

create profile
follow shows
follow creators
follow projects
follow companies
bookmark episodes
create playlists
continue listening
continue watching
receive notifications

Do not require wallet connection for basic media consumption.

Wallet integration should be optional.

---

# 31. WALLET / WEB3 LAYER

Create an optional wallet adapter.

Support:

wallet connection
wallet profile
on-chain identity
project ownership badges where appropriate
token/community integrations

Do not make financial or investment promises.

Never imply that holding a token guarantees access, profit, or financial return.

---

# 32. MOBILE APP

React Native + Expo.

Tabs:

Home
Discover
Live
Library
Profile

Features:

audio player
video player
background playback
downloads
playlists
notifications
follows
bookmarks
deep links
search

Use the same StockTank API.

---

# 33. TV / OTT

Create a TV-ready API and application architecture.

Target eventually:

Apple TV
Android TV / Google TV
Fire TV
Roku
Samsung/LG where appropriate

TV navigation:

Home
Live
Shows
Watch
Clips
Projects
Search

Prioritize remote-control navigation.

Large typography.

10-foot UI.

Minimal interaction.

---

# 34. ADVERTISING PLATFORM

Build a first-party advertising system.

Entities:

advertisers
campaigns
creative_assets
placements
impressions
clicks
budgets
flight_dates

Placements:

homepage
episode page
video pre-roll
mid-roll
audio sponsorship
show sponsorship
project pages
newsletter

Track:

impressions
clicks
CTR
completion
campaign revenue

Do not serve inappropriate advertising.

---

# 35. CREATOR PLATFORM

Creators should eventually be able to:

apply
create shows
upload episodes
manage profiles
view analytics
submit clips
manage links
receive approved monetization

Admin controls all publishing permissions.

---

# 36. NOTIFICATIONS

Create notification service.

Channels:

in-app
email
push

Events:

new episode
live now
new clip
followed show
followed creator
followed project
scheduled event

Use provider abstraction.

---

# 37. SECURITY

Implement:

RBAC
rate limiting
CSRF protection where applicable
CORS
secure cookies
JWT/session security
input validation
Zod schemas
SQL injection protection
XSS protection
file validation
upload limits
API authentication
audit logging
secret management

Never log:

passwords
API keys
private keys
session tokens

Wallet private keys must NEVER be stored.

---

# 38. OBSERVABILITY

Implement:

structured logs
error tracking
health checks
metrics
request tracing

Create:

/health
/ready
/version

Track:

API errors
queue failures
media failures
AI failures
distribution failures
database health

---

# 39. BACKUPS

Production backups:

PostgreSQL
object storage
configuration
media metadata

Create documented restore procedures.

Test restores.

Do not consider a backup complete until restoration has been tested.

---

# 40. DEVOPS

Create:

Dockerfiles
docker-compose.dev.yml
docker-compose.test.yml
docker-compose.production.yml

GitHub Actions:

lint
typecheck
unit tests
integration tests
E2E tests
security scanning
build
deploy

Use separate:

development
staging
production

environments.

---

# 41. API DOCUMENTATION

Generate OpenAPI documentation.

Every API endpoint needs:

request schema
response schema
authentication requirements
errors
examples

Version API:

/api/v1

Never break v1 without migration strategy.

---

# 42. TESTING

Minimum:

unit tests
integration tests
API tests
database tests
component tests
E2E tests
mobile smoke tests
media pipeline tests
AI pipeline tests

Critical E2E flows:

signup
login
search
play episode
watch video
follow show
bookmark episode
admin create episode
upload media
transcode media
publish episode
AI generate summary
AI generate clips
approve content
publish distribution
live player
now playing

---

# 43. DESIGN SYSTEM

Create StockTank design system.

Tokens:

colors
spacing
typography
radius
shadows
motion
breakpoints

Components:

Button
Input
Modal
Drawer
Card
MediaCard
EpisodeCard
ShowCard
ProjectCard
CompanyCard
CreatorCard
VideoPlayer
AudioPlayer
LiveBadge
Ticker
Search
Navigation
Sidebar
BottomNav
Table
Chart
Toast
Dialog
Tabs

Everything reusable.

---

# 44. BRAND

Brand:

STOCKTANK

Concept:

Shark Tank energy + financial media + crypto-native culture.

Primary tagline:

ON-CHAIN STOCKS & CRYPTO

Use a strong, premium media identity.

Do not make the design look like a DeFi dashboard.

---

# 45. PERFORMANCE

Targets:

fast initial page load
lazy-loaded media
image optimization
responsive images
CDN
caching
pagination
infinite scrolling where appropriate
database indexes
background jobs

Use Redis for caching and job infrastructure.

Do not cache private data incorrectly.

---

# 46. SEO

Implement:

metadata
OpenGraph
Twitter cards
JSON-LD
canonical URLs
sitemaps
RSS
robots.txt

SEO pages:

shows
episodes
projects
companies
creators
clips
articles

---

# 47. INTERNATIONALIZATION

Prepare architecture for:

English
Spanish
Portuguese
French
Japanese
Korean

Do not translate the whole product initially.

Make the system localization-ready.

---

# 48. LEGAL / COMPLIANCE FOUNDATION

Create pages for:

Terms
Privacy
Cookie Policy
Copyright
DMCA/contact process
AI disclosure
Advertising disclosure
Financial-content disclaimer

Do not present StockTank as a broker, investment adviser, exchange, or financial advisor unless separately reviewed and legally structured for that activity.

Financial content should be informational and appropriately labeled.

---

# 49. MONITORING AI COSTS

Track per AI operation:

provider
model
tokens
estimated cost
latency
success
failure

Admin dashboard:

AI spend today
AI spend this month
cost by personality
cost by feature
cost by model

Create configurable budgets.

---

# 50. FEATURE FLAGS

Implement feature flags for:

AI hosts
AI clips
AI newsroom
wallet
mobile
TV
advertising
creator monetization
live streaming

Do not deploy unfinished features publicly.

---

# 51. ENVIRONMENT VARIABLES

Create .env.example.

Include placeholders for:

DATABASE_URL
REDIS_URL
MEILISEARCH_URL
MEILISEARCH_KEY
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY
CASTOPOD_URL
CASTOPOD_API_KEY
AZURACAST_URL
AZURACAST_API_KEY

AI provider keys

analytics keys

social platform keys

email provider keys

push notification keys

Never commit secrets.

---

# 52. INITIAL SEED DATA

Create seed data for:

5 shows
10 hosts
10 guests
20 projects
20 companies
30 episodes
50 clips
10 articles

Clearly mark all seed data as DEMO DATA.

Do not represent demo projects or financial data as real.

---

# 53. DEVELOPMENT ORDER

Do NOT attempt everything at once.

Implement in milestones.

## Milestone 1

Foundation:

monorepo
Docker
PostgreSQL
Redis
Express
React
authentication
design system

## Milestone 2

Content:

shows
episodes
hosts
guests
projects
companies
search

## Milestone 3

Media:

uploads
S3
FFmpeg
audio
video
HLS
players

## Milestone 4

Podcast:

Castopod adapter
RSS
publishing

## Milestone 5

Live:

AzuraCast adapter
live player
now-playing

## Milestone 6

Admin:

complete CMS
editorial workflow
analytics

## Milestone 7

AI:

AI service
personalities
RAG
transcription
summaries
clips
social generation

## Milestone 8

Distribution:

YouTube
X
Instagram
TikTok
Facebook
RSS

## Milestone 9

Mobile:

iOS
Android

## Milestone 10

TV:

TV application
remote navigation
HLS playback

## Milestone 11

Monetization:

advertising
sponsorships
creator monetization

## Milestone 12

Production:

security
monitoring
backups
load testing
E2E
deployment

---

# 54. GO-TO-MARKET FEATURES

Before declaring V1 production-ready, StockTank must have:

Website
Admin
Podcast publishing
Video publishing
Live streaming
Search
Project pages
Company pages
Creator pages
AI-assisted production
AI personalities
AI clipping
Social distribution
Analytics
Email
Push notifications
Advertising infrastructure
Mobile-ready API
Security
Backups
Monitoring
SEO
Legal pages

---

# 55. AI AGENTS

Create internal AI agents with narrow responsibilities.

Research Agent
→ researches approved sources.

News Agent
→ identifies news candidates.

Transcript Agent
→ cleans transcripts.

Entity Agent
→ identifies companies/projects/topics.

Clip Agent
→ proposes clips.

SEO Agent
→ generates metadata.

Social Agent
→ creates platform-specific drafts.

Editor Agent
→ checks quality.

Host Agent
→ creates show scripts/questions.

Do not give one AI agent unrestricted control over the entire platform.

---

# 56. HUMAN-IN-THE-LOOP

Anything involving:

financial claims
news publication
AI-generated hosts
AI-generated video
social publishing
advertising
sponsorships

must support human approval.

Workflow:

AI DRAFT
↓
EDITOR REVIEW
↓
APPROVED
↓
PUBLISH

---

# 57. FINAL PRODUCT ARCHITECTURE

The final system should resemble:

```
                STOCKTANK
                     │
    ┌────────────────┼────────────────┐
    │                │                │
   WEB             MOBILE            TV
    │                │                │
    └────────────────┼────────────────┘
                     │
              STOCKTANK API
                     │
   ┌─────────┬───────┼────────┬─────────┐
   │         │       │        │         │
Postgres   Redis   Search    Media      AI
   │                         │          │
   │                     FFmpeg       RAG
   │                         │          │
   │                    S3/HLS       LLMs
   │
   ├── Projects
   ├── Companies
   ├── Shows
   ├── Episodes
   ├── Creators
   └── Users
```

External infrastructure:

Castopod → Podcast
AzuraCast → Live
Blockchain adapters → On-chain data
Social adapters → Distribution
Analytics → Product intelligence

---

# 58. CRITICAL CLAUDE CODE BEHAVIOR

Before writing code:

1. Inspect repository.
2. Create architecture document.
3. Identify dependencies.
4. Create implementation plan.
5. Create database schema.
6. Create API specification.
7. Create design system.
8. Then implement milestone 1.

After each milestone:

* run tests
* run typecheck
* run lint
* run build
* verify database migrations
* verify Docker
* verify API
* verify frontend
* fix errors
* document what changed

Never move to the next milestone if the current milestone is broken.

Do not replace working architecture simply because a different technology is trendy.

If a requested technology is incompatible with the current architecture, explain the tradeoff and choose the most maintainable production solution.

---

# 59. FIRST TASK

Start by analyzing the repository.

Do not immediately generate hundreds of files.

First produce:

1. architecture plan
2. repository structure
3. technology decisions
4. database ERD
5. API specification
6. AI architecture
7. media architecture
8. deployment architecture
9. security architecture
10. milestone plan

Then implement Milestone 1.

At every stage, prioritize:

CORRECTNESS
SECURITY
MAINTAINABILITY
PERFORMANCE
USER EXPERIENCE
PRODUCTION READINESS

The goal is not a prototype.

The goal is the foundation of a real company:

view all the folders and treat them as compnets that u can use to form it all into one project. use whats needs so we dont have to build from scratch.

Use Design as direction "C:\Users\Admin\Desktop\PROJECTS\StockTank\stocktankexample.png"

# STOCKTANK

## ON-CHAIN STOCKS & CRYPTO
