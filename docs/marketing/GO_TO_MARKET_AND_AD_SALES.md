# StockTank: go-to-market marketing and ad-sales playbook

Status: operating draft (2026-09-17). Everything below is wired to what the product does today; items marked
**[DECIDE]** are business decisions for the owner, and **[MEASURE]** marks numbers we publish only once
analytics has measured them. No audience or performance figures are invented in this document or on the site.

---

## 1. Positioning

- **What we are:** a media network for on-chain stocks and crypto: shows, a live desk, clips, explainers,
  project and company profiles.
- **What we are not:** a broker, exchange, investment adviser or promoter. Every page carries the disclaimer, and
  advertising follows the same rule.
- **Why advertisers buy:** a concentrated audience interested in tokenized markets, placements that are
  disclosed and editor-reviewed (brand-safe for regulated advertisers), and first-party measurement.

## 2. Who we sell to (ideal advertisers)

| Segment | Examples of what they buy | Notes |
|---|---|---|
| Market infrastructure | custody, settlement, transfer agents, oracles | Strong fit for RWA Report, Market Open |
| Regulated platforms | licensed exchanges and brokers in the markets they are licensed for | Compliance notes required on the advertiser |
| Developer and infra tooling | wallets, node providers, analytics tools | Watchlist and project-page placements |
| B2B services | legal, audit, compliance, security firms | Newsletter and show sponsorships |
| Events and education | conferences, courses without earnings claims | Newsletter, house-read audio |

**Not accepted (enforced by editorial review, flagged automatically where possible):**
- Promises of returns, "risk-free" products, price predictions, "100x"-style claims, pressure tactics
- Token sales or presales, unregistered securities offerings, anonymous projects
- Implied StockTank endorsement ("recommended by StockTank")
- Anything an editor judges misleading. Editors can reject with a reason, and sales sees it.

## 3. Inventory and packages

Inventory is the **rate card** in Admin → Advertising → Rate card (11 placements seeded, all unpriced):

| Placement | Surface | Model | Serves today |
|---|---|---|---|
| Homepage presenting sponsor | Web | Flat / week | ✅ |
| Homepage native card | Web | CPM | ✅ |
| Homepage leaderboard | Web | CPM | ✅ |
| Watchlist sidebar card | Web | CPM | ✅ |
| Episode page sponsor | Web | CPM | ✅ |
| Project page sponsor | Web | CPM | ✅ |
| Company page sponsor | Web | CPM | ✅ |
| Newsletter primary sponsor | Newsletter | Flat / issue | Sold and placed manually until newsletter sending ships |
| Podcast pre-roll (host read) | Audio | Flat / episode | Host read; tracked after Milestone 4 |
| Video pre-roll | Video | CPM | After Milestone 3 (media pipeline) |
| Show presenting sponsorship | Audio/web | Flat / episode | Credits + show-page badge |

**Suggested launch packages [DECIDE prices]:**
1. **Launch Partner** (limited to a few advertisers): homepage presenting sponsor for 4 weeks, a native card in
   rotation, newsletter slots and a credit as launch partner. Price: **[DECIDE]**.
2. **Show Sponsor:** presenting sponsorship of one show for a season, with host reads and a show-page badge. Price per
   episode: **[DECIDE]**.
3. **Always-on native:** CPM native cards across home, watchlist, project and company pages. CPM: **[DECIDE]**.

How to set pricing without inventing numbers:
- Start with flat-fee launch packages (no traffic history is needed).
- Move web placements to CPM once analytics reports **[MEASURE]** monthly impressions per placement.
- Publish rates (Rate card → visibility "Public") only when you want them on `/advertise`. Otherwise the
  media kit says "Rates on request".

## 4. Sales process: how it maps to the product

```
/advertise inquiry  →  Admin › Growth › Leads (status: new)
  → contacted → qualified → proposal_sent → won / lost / spam
won:  Admin › Advertising › Advertisers  (create; editor approves the advertiser)
   →  Campaigns (create draft: flight, pricing, budget, caps, placements)
   →  add creatives (policy scanner flags risky copy)
   →  Submit for review
   →  Review queue (editor: acknowledge flags, approve creatives, then campaign)
   →  serving (only if feature flag `advertising` is ON)
   →  Campaign report (impressions, clicks, CTR, estimated spend, daily delivery)
```

Roles:
- **Sales:** advertisers, campaigns, creatives, rate card, leads. Cannot approve.
- **Editor:** approves advertisers, creatives and campaigns. Cannot approve a campaign they created.
- **Admin:** everything except role management, including feature flags and the newsletter audience.

Response standards [DECIDE]: first reply to a new lead within **[DECIDE]** business hours; proposal within
**[DECIDE]** days of qualification.

## 5. Measurement (what we can honestly report)

- **Impression:** counted once per signed token, when at least 50% of the ad is visible for 1 continuous second.
- **Click:** counted when the StockTank tracking link is followed; the redirect only goes to the approved URL.
- **CTR:** clicks divided by impressions. **Estimated spend:** CPM × impressions ÷ 1000, capped at budget, or the
  flat fee for flat pricing.
- **Frequency caps:** per anonymous first-party visitor per day (Redis).
- **Not reported yet:** reach and unique visitors, audience demographics, conversions. Say "not measured"; never
  estimate.

## 6. Marketing plan (audience growth)

### Phase A: pre-launch (now → first 3–5 episodes live)
- Newsletter double opt-in on the homepage, show pages and `/newsletter`. Grow the list before launch.
- Share clips on X, YouTube Shorts and LinkedIn with UTM links, e.g.
  `https://stocktank.[domain]/?utm_source=x&utm_medium=social&utm_campaign=prelaunch-tank-ep1`.
  Attribution is stored with every sign-up and lead.
- Founder and guest outreach: every guest gets a clip pack and a UTM link to share.
- House ads run in empty slots to promote the newsletter and `/advertise`.

### Phase B: launch (first 30 days)
- Launch week: 1 live desk per weekday + The Tank premiere; each segment is cut into approved clips.
- Launch partners announced in the newsletter and on air (disclosed as sponsors).
- Press and partner outreach: crypto/fintech newsletters and podcasts (guest swaps).

### Phase C: growth (30–90 days)
- Weekly explainers for search (SEO pages for projects, companies and shows).
- Recurring formats: RWA Report biweekly, Chain Reaction weekly.
- Switch web placements to CPM pricing once **[MEASURE]** traffic is stable; open always-on native.

### Metrics to track (targets [DECIDE] once baselines exist)
| Area | Metric | Where |
|---|---|---|
| Audience | Confirmed newsletter subscribers, confirmation rate | Admin › Growth › Newsletter |
| Acquisition | Sign-ups and leads by UTM source/campaign | Leads and subscriber attribution columns |
| Sales | Leads by status; win rate; booked value | Leads, Advertising overview |
| Delivery | Impressions, clicks, CTR per campaign and placement | Campaign report |
| Product analytics | DAU/MAU, watch/listen time | PostHog adapter (Milestone 6) |

## 7. Before selling the first campaign: go-live checklist

- [ ] **Rotate the leaked Alchemy key and wallet key** (see `CLAUDE.md`)
- [ ] Production email provider: `EMAIL_PROVIDER=resend`, `EMAIL_PROVIDER_API_KEY`, verified `EMAIL_FROM` domain
- [ ] `SALES_NOTIFY_EMAIL` set so leads reach sales
- [ ] Legal review of Terms, Privacy, Cookie Policy (`st_session`, `st_vid`) and the Advertising disclosure (drafts exist)
- [ ] Advertising insertion order / terms template **[DECIDE, legal]**
- [ ] Rate card prices set; packages decided
- [ ] At least one sales user and one editor user created (Admin › System › Users)
- [ ] Remove DEMO content: do not run `seed:demo` in production
- [ ] Turn on the `advertising` feature flag (Admin › System › Feature flags) only when real or house campaigns are approved
- [ ] Verify an end-to-end test campaign on staging: submit → approve → serve → impression → click → report

## 8. Runbook: launching a campaign (10 steps)

1. Leads → open the lead → status *contacted* → notes.
2. When qualified, Advertisers → **New advertiser** (compliance notes: licences, restrictions).
3. Ask an editor to approve the advertiser.
4. Campaigns → **New campaign**: flight dates, pricing model, rate, budget, optional impression goal and frequency cap, placements.
5. Add creatives: headline (≤90), body (≤280), destination URL, disclosure label.
6. Fix or justify any policy flags shown on the creative.
7. **Submit for review.**
8. Editor: Review queue → acknowledge flags → approve creatives → approve campaign.
9. Confirm the `advertising` flag is on; check the placement on the site, where it shows the disclosure label.
10. Share the campaign report with the advertiser weekly; pause (not delete) if anything needs changing, since edits require re-review.
