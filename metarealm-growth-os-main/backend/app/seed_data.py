"""Starter dataset — the same data the frontend mock layer shipped with.

After Milestone 4 this is the single source; frontend/lib/mock is retired.
"""

COMPANIES = [
    {"id": "com-kingspec", "name": "KingSpec", "industry": "Hardware · Storage", "status": "active_partner", "location": "Shenzhen, China", "website": "kingspec.com", "last_touch": "Renewal call · Today"},
    {"id": "com-atk", "name": "ATK Gear", "industry": "Gaming peripherals", "status": "active_partner", "location": "MENA", "last_touch": "Activation scoping · Last week"},
    {"id": "com-gkoi", "name": "GKOI", "industry": "Gaming retail", "status": "active_partner", "location": "Morocco", "last_touch": "Pricing call · 2 days ago"},
    {"id": "com-inwi", "name": "Inwi", "industry": "Telecom", "status": "in_talks", "location": "Casablanca, Morocco", "website": "inwi.ma", "last_touch": "Reply received · 5 days ago"},
    {"id": "com-redbull", "name": "Red Bull Maroc", "industry": "Energy drinks", "status": "in_talks", "location": "Casablanca, Morocco", "last_touch": "Proposal opened · Yesterday"},
    {"id": "com-cih", "name": "CIH Bank", "industry": "Banking", "status": "in_talks", "location": "Casablanca, Morocco", "last_touch": "Research note · 4 days ago"},
    {"id": "com-orange", "name": "Orange Maroc", "industry": "Telecom", "status": "prospect", "location": "Rabat, Morocco", "reason_to_contact": "Launched a gaming data bundle last week — natural esports fit", "last_touch": "Never contacted"},
    {"id": "com-oppo", "name": "Oppo Maroc", "industry": "Consumer electronics", "status": "prospect", "location": "Casablanca, Morocco", "reason_to_contact": "Sponsoring youth music festivals — gaming is the adjacent move", "last_touch": "Met at MGEX · 3 weeks ago"},
    {"id": "com-monster", "name": "Monster Energy MENA", "industry": "Energy drinks", "status": "prospect", "location": "Dubai, UAE", "reason_to_contact": "Active in esports regionally, no Morocco activation yet", "last_touch": "Never contacted"},
    {"id": "com-sidiali", "name": "Sidi Ali", "industry": "FMCG · Beverages", "status": "prospect", "location": "Morocco", "reason_to_contact": "Running a youth TikTok campaign — community angle to pitch", "last_touch": "Cold email · 2 months ago"},
    {"id": "com-maroctel", "name": "Maroc Telecom", "industry": "Telecom", "status": "prospect", "location": "Rabat, Morocco", "reason_to_contact": "Historic esports cup sponsor — cycle restarts soon", "last_touch": "Never contacted"},
    {"id": "com-logitech", "name": "Logitech MENA", "industry": "Gaming peripherals", "status": "prospect", "location": "Dubai, UAE", "reason_to_contact": "Expanding MENA esports program beyond the Gulf", "last_touch": "Intro email · This week"},
    {"id": "com-yassir", "name": "Yassir", "industry": "Super app · Mobility", "status": "prospect", "location": "Maghreb", "reason_to_contact": "Youth acquisition push across Maghreb markets", "last_touch": "Never contacted"},
    {"id": "com-ultrapc", "name": "Ultra PC", "industry": "PC retail", "status": "past_partner", "location": "Casablanca, Morocco", "last_touch": "Lost co-brand deal · Last month"},
]

CONTACTS = [
    {"id": "ctc-chen", "name": "Chen Wei", "role": "Partnerships Manager", "company_id": "com-kingspec", "company": "KingSpec", "email": "chen.wei@kingspec.com", "last_touch": "Renewal call · Today", "notes": "Decision maker for MENA sponsorships. Responds fast on email."},
    {"id": "ctc-salma", "name": "Salma Bennani", "role": "Brand & Sponsoring Lead", "company_id": "com-inwi", "company": "Inwi", "email": "s.bennani@inwi.ma", "linkedin": "linkedin.com/in/salma-bennani", "last_touch": "Reply received · 5 days ago", "notes": "Met at MGEX. Driving the esports expansion internally."},
    {"id": "ctc-youssef", "name": "Youssef El Amrani", "role": "Marketing Director", "company_id": "com-gkoi", "company": "GKOI", "email": "youssef@gkoi.ma", "phone": "+212 6 61 00 00 00", "last_touch": "Pricing call · 2 days ago"},
    {"id": "ctc-rania", "name": "Rania Alaoui", "role": "Brand Manager", "company_id": "com-redbull", "company": "Red Bull Maroc", "email": "rania.alaoui@redbull.com", "last_touch": "Proposal opened · Yesterday", "notes": "Interested in the Content House — waiting on internal budget."},
    {"id": "ctc-karim", "name": "Karim Haddad", "role": "Regional Sales Manager", "company_id": "com-atk", "company": "ATK Gear", "email": "karim@atkgear.com", "last_touch": "Scoping meeting · Last week"},
    {"id": "ctc-imane", "name": "Imane Berrada", "role": "Digital Marketing Lead", "company_id": "com-cih", "company": "CIH Bank", "linkedin": "linkedin.com/in/imane-berrada", "last_touch": "Not contacted yet", "notes": "Runs the youth-banking campaign — the entry point for the pilot."},
    {"id": "ctc-mehdi", "name": "Mehdi Ouazzani", "role": "Sponsorship Department", "company_id": "com-maroctel", "company": "Maroc Telecom", "last_touch": "Not contacted yet"},
    {"id": "ctc-fatimazahra", "name": "Fatima-Zahra Idrissi", "role": "Communications Manager", "company_id": "com-oppo", "company": "Oppo Maroc", "email": "fz.idrissi@oppo.com", "last_touch": "Met at MGEX · 3 weeks ago", "notes": "Asked for a one-pager on creator campaigns."},
    {"id": "ctc-omar", "name": "Omar Tazi", "role": "Events & Partnerships", "company_id": "com-sidiali", "company": "Sidi Ali", "email": "o.tazi@oulmes.ma", "last_touch": "Cold email · 2 months ago"},
    {"id": "ctc-layla", "name": "Layla Mansouri", "role": "MENA Esports Program", "company_id": "com-logitech", "company": "Logitech MENA", "email": "lmansouri@logitech.com", "linkedin": "linkedin.com/in/layla-mansouri", "last_touch": "Intro email · This week"},
    {"id": "ctc-adam", "name": "Adam Benjelloun", "role": "Founder", "company_id": "com-ultrapc", "company": "Ultra PC", "phone": "+212 6 62 00 00 00", "last_touch": "Passed on co-brand · Last month"},
]

OPPORTUNITIES = [
    {"id": "opp-kingspec-gold", "company_id": "com-kingspec", "company": "KingSpec", "title": "Gold renewal · 12 months", "value_mad": 372000, "stage": "negotiation", "next_action": "Send updated Gold deck before the 14:00 call", "next_action_due": "Today", "owner": "Marouane"},
    {"id": "opp-inwi-title", "company_id": "com-inwi", "company": "Inwi", "title": "Title Partner · 6 months", "value_mad": 330000, "stage": "meeting", "next_action": "Intro meeting — bring the news-angle brief", "next_action_due": "Tomorrow · 10:30", "owner": "Marouane"},
    {"id": "opp-cih-pilot", "company_id": "com-cih", "company": "CIH Bank", "title": "Youth banking × esports pilot", "value_mad": 180000, "stage": "lead", "next_action": "Identify the right marketing contact", "next_action_due": "This week", "owner": "Oussama"},
    {"id": "opp-gkoi-silver", "company_id": "com-gkoi", "company": "GKOI", "title": "Silver upsell · 6 months", "value_mad": 171000, "stage": "proposal", "next_action": "Pricing questions call", "next_action_due": "Fri · 12:00", "owner": "Marouane"},
    {"id": "opp-redbull-house", "company_id": "com-redbull", "company": "Red Bull Maroc", "title": "Content House Q4 sponsor", "value_mad": 138000, "stage": "proposal", "next_action": "Follow up — proposal opened twice, no reply", "next_action_due": "Tomorrow", "owner": "Oussama"},
    {"id": "opp-atk-bom", "company_id": "com-atk", "company": "ATK Gear", "title": "Battle of Morocco activation", "value_mad": 95000, "stage": "contacted", "next_action": "Share the event one-pager", "next_action_due": "This week", "owner": "Yahya"},
    {"id": "opp-mt-cup", "company_id": "com-maroctel", "company": "Maroc Telecom", "title": "Esports cup partnership", "value_mad": 90000, "stage": "lead", "next_action": "Map the sponsorship department", "next_action_due": "This month", "owner": "Yahya"},
    {"id": "opp-logitech-gear", "company_id": "com-logitech", "company": "Logitech MENA", "title": "Gear partnership · Lunaris rosters", "value_mad": 60000, "stage": "contacted", "next_action": "Awaiting reply to intro email", "next_action_due": "This week", "owner": "Oussama"},
    {"id": "opp-kingspec-mgex", "company_id": "com-kingspec", "company": "KingSpec", "title": "MGEX 2026 activation", "value_mad": 55000, "stage": "closed_won", "next_action": "Delivered — recap report sent", "next_action_due": "Done", "owner": "Marouane"},
    {"id": "opp-atk-mge", "company_id": "com-atk", "company": "ATK Gear", "title": "MGE 2026 jersey placement", "value_mad": 78000, "stage": "closed_won", "next_action": "Delivered — renewal conversation in Q1", "next_action_due": "Done", "owner": "Marouane"},
    {"id": "opp-ultrapc-bom", "company_id": "com-ultrapc", "company": "Ultra PC", "title": "Battle of Morocco booth co-brand", "value_mad": 40000, "stage": "closed_lost", "next_action": "Lost on budget — revisit for Ramadan Cups", "next_action_due": "Q2 2027", "owner": "Yahya"},
]

TOUCHES = [
    {"id": "tch-kingspec-1", "company_id": "com-kingspec", "kind": "meeting", "summary": "Renewal call — terms agreed pending the updated deck", "when": "Today"},
    {"id": "tch-kingspec-2", "company_id": "com-kingspec", "kind": "email", "summary": "Sent MGEX 2026 recap report (12.8M impressions)", "when": "Last week"},
    {"id": "tch-inwi-1", "company_id": "com-inwi", "kind": "email", "summary": "Intro email — replied, meeting booked for tomorrow", "when": "5 days ago"},
    {"id": "tch-inwi-2", "company_id": "com-inwi", "kind": "event", "summary": "Met marketing lead at the MGEX booth", "when": "3 weeks ago"},
    {"id": "tch-redbull-1", "company_id": "com-redbull", "kind": "note", "summary": "Proposal opened twice, no reply yet — follow up tomorrow", "when": "Yesterday"},
    {"id": "tch-redbull-2", "company_id": "com-redbull", "kind": "email", "summary": "Sent Content House Q4 proposal", "when": "1 week ago"},
    {"id": "tch-gkoi-1", "company_id": "com-gkoi", "kind": "call", "summary": "Pricing questions — wants the 6-month split", "when": "2 days ago"},
    {"id": "tch-atk-1", "company_id": "com-atk", "kind": "meeting", "summary": "Battle of Morocco activation scoping", "when": "Last week"},
    {"id": "tch-cih-1", "company_id": "com-cih", "kind": "note", "summary": "Flagged via their youth-banking campaign coverage", "when": "4 days ago"},
    {"id": "tch-oppo-1", "company_id": "com-oppo", "kind": "event", "summary": "Short intro at MGEX — asked for a one-pager", "when": "3 weeks ago"},
    {"id": "tch-sidiali-1", "company_id": "com-sidiali", "kind": "email", "summary": "Cold email — no reply", "when": "2 months ago"},
    {"id": "tch-logitech-1", "company_id": "com-logitech", "kind": "email", "summary": "Intro email sent via MENA marketing contact", "when": "This week"},
    {"id": "tch-ultrapc-1", "company_id": "com-ultrapc", "kind": "call", "summary": "Passed on the co-brand — budget went to hardware promos", "when": "Last month"},
]

MEETINGS = [
    {"id": "meet-kingspec", "title": "KingSpec renewal call", "company_id": "com-kingspec", "company": "KingSpec", "when": "Today · 14:00", "duration_min": 45, "kind": "video", "status": "upcoming", "agenda": "Renewal terms + 2027 calendar", "attendees": ["Marouane", "Chen Wei"], "prep": "Renewal on the table: Gold, 12 months, 372K MAD. Chen agreed terms pending the updated deck — send it before the call. Push for a 2027 calendar commitment; the MGEX case study (12.8M impressions, 25.6% VTR on the Speed Challenge) is the proof point."},
    {"id": "meet-inwi", "title": "Inwi × MetaRealm intro", "company_id": "com-inwi", "company": "Inwi", "when": "Tomorrow · 10:30", "duration_min": 60, "kind": "in_person", "status": "upcoming", "agenda": "Title Partner scope, Casablanca HQ", "attendees": ["Marouane", "Oussama", "Salma Bennani"]},
    {"id": "meet-mgex", "title": "MGEX organizers debrief", "when": "Thu · 11:00", "duration_min": 30, "kind": "video", "status": "upcoming", "agenda": "2026 recap numbers + 2027 slots", "attendees": ["Marouane", "Yahya"]},
    {"id": "meet-creators", "title": "Creator network weekly sync", "when": "Fri · 09:30", "duration_min": 30, "kind": "video", "status": "upcoming", "attendees": ["Marouane", "Oussama", "Yahya"]},
    {"id": "meet-gc", "title": "GC roster Q1 planning", "when": "Fri · 15:00", "duration_min": 45, "kind": "video", "status": "upcoming", "agenda": "EMEA Cash Cups dates + Al Majd prep", "attendees": ["Marouane", "Yahya"]},
    {"id": "meet-mgex-wrap", "title": "MGEX 2026 wrap-up", "when": "Last week · Fri", "duration_min": 45, "kind": "video", "status": "completed", "notes": "Final numbers confirmed: 12.8M impressions, 80K visitors over the campaign. Organizers open to a bigger 2027 booth — follow up in the Thursday debrief.", "attendees": ["Marouane", "Yahya"]},
    {"id": "meet-kingspec-debrief", "title": "KingSpec MGEX debrief", "company_id": "com-kingspec", "company": "KingSpec", "when": "2 weeks ago", "duration_min": 30, "kind": "video", "status": "completed", "notes": "Very happy with the Speed Challenge (25.6% view-through). Opened the Gold renewal conversation on the spot.", "attendees": ["Marouane", "Chen Wei"]},
    {"id": "meet-redbull-intro", "title": "Red Bull Maroc intro call", "company_id": "com-redbull", "company": "Red Bull Maroc", "when": "3 weeks ago", "duration_min": 30, "kind": "call", "status": "completed", "notes": "Interested in the Content House for Q4. Asked for a proposal — sent the following day.", "attendees": ["Oussama", "Rania Alaoui"]},
]

CONTENT_ITEMS = [
    {"id": "cnt-mgex-case", "title": "Case study: 12.8M impressions in one month around one event", "platform": "linkedin", "status": "awaiting_approval", "scheduled_for": "Tue · 09:00", "author": "Content Strategist (sample)", "body": "12.8M impressions in one month. One event. Zero paid media.\n\nHere is exactly how the MGEX 2026 campaign stacked up — 6.1M creator views from 8 creators, 960 stories and 133 reels, 6.66M organic UGC views, 104.8K live stream views, 80K visitors on the ground.\n\nThe full breakdown, sponsor by sponsor, in the post."},
    {"id": "cnt-ugc-thread", "title": "Thread: 12 fan reels vs 133 creator reels", "platform": "x", "status": "awaiting_approval", "scheduled_for": "Wed · 18:00", "author": "Content Strategist (sample)", "body": "133 creator reels got us 6.1M views.\n12 fan reels got us 6.66M.\n\nRead that again — then build for UGC. Thread on what actually made fans post:"},
    {"id": "cnt-radio", "title": "Esports just got a mainstream microphone in Morocco", "platform": "linkedin", "status": "awaiting_approval", "scheduled_for": "Thu · 09:00", "author": "Content Strategist (sample)", "body": "Esports just got a mainstream microphone in Morocco.\n\nIn the last 30 days, Lunaris creators were live on Radio 2M and Hit Radio — reels and interviews carrying sponsor mentions into channels that still reach whole families every day."},
    {"id": "cnt-mge-recap", "title": "MGE 2026 results recap — reel caption", "platform": "instagram", "status": "draft", "author": "Marouane", "body": "3rd of 443 teams — Fortnite finals.\n4th of 1,104 — FC26.\nTop 5 — Valorant Playins.\n\nMGE 2026, done. On to the next one. 🌙"},
    {"id": "cnt-house-teaser", "title": "Content House Vol. 2 — teaser reel caption", "platform": "instagram", "status": "scheduled", "scheduled_for": "Sat · 12:00", "author": "Marouane", "body": "6 creators. 4 days. One house.\nVol. 2 loading… 🎬"},
    {"id": "cnt-kingspec-recap", "title": "KingSpec × Lunaris: what 25.6% view-through actually looks like", "platform": "linkedin", "status": "published", "scheduled_for": "Last Tue · 09:00", "author": "Marouane", "body": "Most sponsor videos get skipped. This one kept a quarter of its audience to the end."},
    {"id": "cnt-gc-announce", "title": "Lunaris GC locks Top 16 in EMEA Cash Cup #4", "platform": "x", "status": "published", "scheduled_for": "Last Thu · 20:00", "author": "Yahya", "body": "Top 16 in EMEA. Against Europe's best. Lunaris GC keeps climbing. 🌙"},
]

NEWS_ITEMS = [
    {"id": "news-mge-2027", "title": "MGE announces 2027 dates and an expanded format", "source": "Le Matin", "region": "morocco", "published_ago": "3h"},
    {"id": "news-inwi", "title": "Inwi extends its esports sponsorship program", "source": "TelQuel", "region": "morocco", "published_ago": "6h"},
    {"id": "news-hitradio", "title": "Hit Radio adds a weekly gaming segment", "source": "Hit Radio", "region": "morocco", "published_ago": "1d"},
    {"id": "news-savvy", "title": "Savvy Games Group announces a new MENA publishing fund", "source": "Reuters", "region": "mena", "published_ago": "5h"},
    {"id": "news-qiddiya", "title": "Qiddiya esports district reveals venue partners", "source": "Arab News", "region": "mena", "published_ago": "1d"},
    {"id": "news-immutable", "title": "Immutable and a major studio announce a mobile title", "source": "The Block", "region": "web3", "published_ago": "8h"},
    {"id": "news-ygg", "title": "YGG rethinks its regional guild strategy", "source": "Decrypt", "region": "web3", "published_ago": "1d"},
]

FOCUS_TASKS = [
    {"id": "task-kingspec-deck", "title": "Send KingSpec the updated Gold renewal deck", "context": "Blocks today's 14:00 call", "priority": "high", "done": False},
    {"id": "task-inwi-brief", "title": "Prepare the Inwi meeting brief", "context": "Include their sponsorship-expansion news as an opener", "priority": "high", "done": False},
    {"id": "task-approve-mgex", "title": "Approve the MGEX case-study post", "context": "Scheduled Tue 09:00 — approve before 18:00", "priority": "medium", "done": False},
    {"id": "task-redbull-follow", "title": "Follow up with Red Bull Maroc", "context": "Proposal opened twice, no reply in 5 days", "priority": "medium", "done": False},
    {"id": "task-gc-calendar", "title": "Review the GC roster Q1 calendar", "context": "EMEA Cash Cups dates land this week", "priority": "low", "done": True},
]

ACTIVITY_ITEMS = [
    {"id": "act-1", "kind": "opportunity", "text": "Proposal sent to GKOI — Silver upsell, 171K MAD", "time": "2h ago"},
    {"id": "act-2", "kind": "meeting", "text": "Meeting notes logged: MGEX debrief prep", "time": "5h ago"},
    {"id": "act-3", "kind": "email", "text": "Red Bull Maroc opened the Content House proposal", "time": "1d ago"},
    {"id": "act-4", "kind": "system", "text": "New company tracked: Oppo Maroc", "time": "1d ago"},
    {"id": "act-5", "kind": "content", "text": "Approved: KingSpec recap reel", "time": "2d ago"},
]

BRIEF = {
    "id": "brief",
    "generated_at": "07:12",
    "paragraphs": [
        "Pipeline stands at 1.44M MAD across 8 open opportunities. The week's hinge is KingSpec: a renewal decision is expected after today's 14:00 call, and the updated Gold deck is still unsent — the highest-leverage task on the board.",
        "Tomorrow's Inwi intro is the largest deal in play (330K MAD, Title Partner scope). Their esports sponsorship expansion in this morning's news is a ready-made talking point; a one-page brief is queued in Today's Focus.",
        "Three posts are waiting for approval, including the MGEX case study scheduled for Tuesday 09:00 — approving before 18:00 keeps the slot.",
    ],
    "actions": [
        "Send KingSpec the updated deck before the 14:00 call",
        "Prep the Inwi meeting brief with the news angle",
        "Approve Tuesday's MGEX case-study post",
    ],
}
