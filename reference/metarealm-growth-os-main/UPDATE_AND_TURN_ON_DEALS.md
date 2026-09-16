# How to update, and how to turn on deal hunting

## Update your machine
1. Replace these folders from the zip: backend, frontend, knowledge, prompts, docs.
2. Rebuild everything:
   docker compose -f docker\docker-compose.yml up -d --build
3. Frontend:
   cd frontend
   npm install
   npm run dev

## Turn ON deal hunting and better news (this is the missing piece)
The Opportunity Hunter and live news need search running. Free option:
   docker compose -f docker\docker-compose.yml --profile agents up -d
This starts SearXNG, your own free search engine. Give it 30 seconds.
Now Find new prospects will actually search and find companies with a
real deal signal and a source link.

## For the best Moroccan, MENA, and web3 news, and the best deals
Add a Grok key from xAI in Settings. Live X is where Moroccan gaming
news and brand deal signals break first. It costs a few dollars a month
and there is a hard cap so it can never overspend. Without it you still
get free news, just less of it.

## What changed in this build
- Upload the same file twice, no more IntegrityError. Fixed for good.
- Content is now smart. It reacts to the news, covers web3, talks about
  the Moroccan and MENA market, and only mentions our own numbers when
  they fit. Not a wall of MetaRealm posts anymore.
- News message is honest. It tells you the real total in your list, not
  a confusing nothing new when you already have stories loaded.
- New AI Team page in the sidebar explains all 10 employees, what each
  does, how to use it, and what it cannot do. None can touch your accounts.
- Opportunity Hunter never invents companies. Real signal with a source,
  or an honest empty result.
