# MetaRealm OS, your gaming deal and content machine

Complete project. Replace your whole old folder with this one.

## What it does
Press one button, Plan my day. Your AI team then, in order:
1. Cleans up yesterday, deletes done tasks, keeps unfinished ones on top.
2. Gets real gaming news from the last 7 days, X, web, and news sites.
3. Hunts brands that want gaming deals, with every contact it can find.
4. Drafts your outreach emails, ready to send.
5. Writes your LinkedIn and X posts, the exact number per topic you set.
6. Chases warm deals going quiet, follow up before they cool.
7. Checks your pipeline and relationships.
8. Hands you your task list for the day.

Nothing posts or sends by itself. The team prepares, you press send.

## Install, full replace
1. Move your old folder aside. Put this one in its place.
2. Start the backend, database, and search together:
   docker compose -f docker\docker-compose.yml up -d --build
   Wait one minute.
3. Start the frontend:
   cd frontend
   npm install
   npm run dev
4. Open http://localhost:3000

## Connect Grok, this makes it smart
1. Get a key at https://docs.x.ai
2. In the xAI console, Settings, Data Sharing, turn on free credits, up to
   175 dollars a month, so your first months are free. Set a spending cap.
3. In the app, Settings, paste the key. Press Test Grok now to confirm.

## Connect Hunter.io, real emails for your best deals, free
1. Sign up free at https://hunter.io, no credit card. You get 50 credits a
   month, that is about 25 find plus verify contacts, forever free.
2. Copy your API key from hunter.io, Settings, API.
3. In the app, Settings, paste it in the Hunter.io field.
How it works, the smart way, so 50 credits last:
- Every lead gets a free email guess from public patterns, no credit used.
- On a company page, press Find likely emails. With Hunter set, it also
  finds the REAL verified email and the brand's marketing contacts, one
  credit, spent only when you choose to, on the deals you actually want.
- Without Hunter, you still get the free smart guesses. Never blocked.

## Set your daily numbers
Settings controls everything, all editable:
- News per region, Morocco, MENA, web3, drama.
- Posts per platform per topic, X and LinkedIn each have company, Morocco,
  MENA, web3, drama. Set any to 0 on a day you do not want it.
- Follow up days, phone alerts with Telegram, Hunter key.

## Every day
Open the app, press Plan my day, wait a minute. Work your task list. Do
the send tasks first, that is the money.

## Hosting, my honest advice
Keep it local, it is free and private. For your phone while out, install
Tailscale free on your PC and phone, a private tunnel only your devices
can reach. A paid server only makes sense later, and then we add a login
first. For now, local plus Tailscale, zero cost, everything works.

## Guides in the docs folder
How each agent works, the team, calendar and alerts, and how everything
was built and fixed.
