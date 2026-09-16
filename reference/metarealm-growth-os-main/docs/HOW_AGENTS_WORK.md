# How your AI employees work, in plain words

This explains what actually happens when an agent runs, so you can read the code in Cursor and follow along. No hard words.

## What happens when the morning brief writes itself

1. At 07:00, n8n calls a web address: POST http://api:8000/agents/executive-assistant/run. You can call the same address yourself with the Regenerate button.
2. FastAPI receives that call in `backend/app/api/agents.py` and passes it to the registry.
3. The registry (`backend/app/agents/registry.py`) finds the right employee and runs it.
4. The employee (`backend/app/agents/employees/executive_assistant.py`) reads your real data from the database: open deals, meetings today, posts waiting, news, tasks. It turns all of that into plain sentences. This part is normal code, no AI.
5. It loads its instructions from `prompts/executive-assistant.md` and puts the sentences inside. You can edit that file any time, no restart needed.
6. It sends the whole thing to the model once. Ollama on your PC by default.
7. The answer comes back as JSON. The code cleans it (no dashes, no underscores, simple text) and saves it in the `executive_brief` table.
8. Your dashboard already reads that table, so the new brief just appears.

Every run is also saved in the `agent_runs` table, and successful work shows up in the dashboard activity feed.

## The other two employees

The Content Strategist does the same recipe, but step 4 is a knowledge base search, so it can only use facts from your own documents. Its result becomes a draft in the Content Studio waiting for your approval.

The Meeting Assistant does the same recipe for one meeting: company, open deals, last touches, contacts, plus knowledge passages. Its result is saved on the meeting as the prep brief.

## The two brains, and how to pay only where it matters

Every employee asks `backend/app/services/llm.py` for text. That file has a switch:

- `LLM_PROVIDER=ollama` in `backend/.env`, free, runs on your PC. This is the default.
- Put an employee name in `PREMIUM_AGENTS` (for example `PREMIUM_AGENTS=content-strategist`) and add your `ANTHROPIC_API_KEY`, and only that employee uses the paid Claude API. Everything else stays free.
- `LLM_PROVIDER=stub` is for testing only. It returns a fixed sentence so you can check the plumbing without any model.

## The writing style is enforced twice

Once in the prompt files (simple English, short sentences, commas and periods only), and once in code: `humanize()` in `backend/app/agents/runtime.py` removes dashes and underscores from every text an employee writes, even if the model slips.

## Reading order in Cursor

1. `backend/app/agents/registry.py` (the list of employees, 60 lines)
2. `backend/app/agents/employees/executive_assistant.py` (one full recipe)
3. `prompts/executive-assistant.md` (the instructions it follows)
4. `backend/app/agents/runtime.py` (the shared helpers)

A good Cursor habit: select any block, press Ctrl K or open chat, and ask "explain this to me simply, I am new to coding". The comments in these files were written to be read.

## One lesson from building this

The first version crashed with a strange error about "paragraphs". The cause: Python's `.format()` treats every `{...}` in a text as a variable, and our prompt files contain JSON examples with braces. The fix is `render_prompt()` in `llm.py`, which fills placeholders by simple replacement. The lesson: never run `.format()` on text a human will edit.

## Milestone 7, three more employees, and one loop

Three new employees joined: Market Intelligence, Research Analyst, and Opportunity Hunter. The first and third do the same simple recipe as before, read data or search results, ask the model once, save the result. Nothing new to learn there.

The Research Analyst is different, it loops. Read `backend/app/agents/employees/research_analyst.py` slowly, this is the one built with LangGraph.

Think of it like a small flow chart with three boxes:

1. Search box, run one web search, add what it finds to a pile of notes.
2. Decide box, ask the model one question, do these notes have enough facts. Yes means go write the report. No means go get a better search first.
3. Write box, turn all the notes into one short report with sources, then save that report as a file in knowledge, and index it, so every other employee can use those facts too.

The loop can repeat up to 3 times, so it never runs forever even if the model keeps saying no.

Why not build the other employees this way too. They do not need to loop, one prompt already gives them everything, and looping would only make them slower for no benefit. Use the simple recipe until an employee genuinely needs to go back and forth, then reach for LangGraph.

## Free search, turned on separately

Market Intelligence, Research Analyst, and Opportunity Hunter all need to search the internet. That runs on SearXNG, your own private search engine, completely free, but it only starts when you ask for it:

```
docker compose -f docker\\docker-compose.yml --profile agents up -d
```

Without that command, these three employees still run and still answer, but honestly, they will tell you search is not running instead of pretending to find something. That honesty is on purpose, an agent that fakes results is worse than one that says it could not check.

## Milestone 8, the money team, all ten employees now

Four more employees joined, and these are the ones closest to money.

The BD Manager writes outreach emails. Open any company and press Draft outreach email. It reads everything you know about them, plus proof numbers from the knowledge base, and writes one short email. It never sends anything. You copy it, you send it from your own email, then you press Mark as sent. That last click matters: it logs a real touch on the company, so the whole system knows the conversation started. Run it again later and it writes a follow up instead of a new intro, automatically.

The Proposal Builder turns a deal into a Word document. Open a deal on the pipeline board and press Generate proposal document. It writes the sections with the model, then builds a clean .docx file with your deal value and proof numbers, saved in uploads/proposals. Click to download, read it, fix what you want in Word, send it.

The CRM Manager uses no AI at all, on purpose. Hygiene questions are yes or no questions, and simple rules answer them faster and the same way every time. It looks for prospects never contacted, warm companies going quiet, meetings without prep, and contacts missing an email. Each problem becomes a task in Today's Focus with a fixed id, so ticking one off keeps it gone.

The Relationship Manager keeps good relationships from going cold. It reads your partners, the last touches, and the people notes, then suggests up to 3 small human steps, message this person, congratulate that one, confirm a date. It stops at 3 open nudges so it never floods your list.

The Ask the team for tasks button on the dashboard runs the last two together.

## Two fixes that came from real use

The news was full of politics because Moroccan outlets have no gaming only feed. Now every feed has a keyword filter, French and English, and only gaming stories pass. Send {"reset": true} to the market intelligence agent once to clear the old general stories.

Knowledge sync could die in the middle and the browser showed Failed to fetch. Now every file is handled alone, one broken file cannot kill the sync, embeddings run in small batches, and the answer lists exactly which files worked and which failed.

## Milestone 9, the self filling morning and paid power on a switch

The last milestone makes the morning fill itself and lets you add paid power without touching code.

Search now has layers, like the writing brain does. Free SearXNG is always tried first, zero cost. In Settings you can paste keys to add more:
- A Grok key from xAI turns on live X search. This is the big one for you. A lot of gaming and web3 deals, and news about EWC, ENC, Edawry and more, break on X first, and only Grok can read live X. A daily scan costs a few dollars a month. There is a hard cap in the code, MAX PAID SEARCHES PER RUN, so a bug can never run up your bill.
- A Perplexity key adds cited news from the open web.

The honest truth about LinkedIn and Instagram: no cheap, safe tool can search them automatically, they block it and ban accounts that try. So the plan is smart instead. The Opportunity Hunter finds companies on X and the open web, and every company it adds keeps the source, the post link and the handle or website, right there on the card. You click the source, you open their LinkedIn yourself, and the BD Manager writes the message for you to send as a real human. That is how deals actually close on LinkedIn, a person reaching out, not a robot.

Fill my morning, on the Content Studio, makes 6 tweets, 6 LinkedIn posts, and 3 Instagram ideas in one press, from your stats plus the morning news. All land in the approval queue. Nothing publishes without you. The 07:00 routine now does all of it while you sleep, news, brief, content, meeting preps, hygiene, relationship nudges, and new prospects.

Settings also lets you edit every prompt and choose which employees use the paid Claude brain, all without touching a file.

## Backups

scripts/backup-db.ps1 saves a timestamped copy of your whole database and keeps the last 14. Run it any time, or add it to Windows Task Scheduler to run daily. Your business data is then safe even if Docker breaks.

## Round of fixes from real use

Upload of a big PDF. The deck is 4.3 MB and that is fine, the limit is now 25 MB with a clear message if a file is bigger. If an upload still fails on your machine, it is almost always the API restarting. Make sure you rebuilt with up -d --build so the reload only watches code, not the knowledge folder.

News, Morocco and MENA first. Stories are now scored. Moroccan news ranks highest, then MENA, then big global drama that makes good content, kicked from a world cup, a team winning it again, a shock upset. Only the top 20 are kept, old ones are deleted automatically, but anything you press the bookmark on is saved forever and never deleted. You can also delete any story yourself with the trash button. For the best Moroccan and drama news, add a Grok key, most of it breaks on X first.

Find new prospects finds nothing. Two reasons this happened. One, SearXNG was not running, it only starts with docker compose --profile agents up -d. Two, even so, the button now always works: if no search is running, the Opportunity Hunter asks the model to suggest real Moroccan and MENA brands that fit, so you always get leads. Each one says whether it came from a live source or is a model idea to check yourself. For live deal signals with source posts, run SearXNG or add a Grok key.
