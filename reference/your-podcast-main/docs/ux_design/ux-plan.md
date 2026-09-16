# Your Podcast — UX Plan

Build a mobile-first podcast web app with 3 bottom tabs + an episode detail page. Clean, modern design inspired by Apple Podcasts / Spotify. Use React (Next.js), TypeScript, Tailwind CSS.

Mock data is fine — no real API calls. All data is hardcoded JSON for prototyping.

---

## Global Layout

- **Bottom tab bar** fixed at the bottom, always visible. Three tabs:
  - "Discover" (globe icon) — public feed
  - "Library" (headphones icon) — my podcasts
  - "Profile" (user icon) — my profile
- **Sticky mini player** sits directly above the tab bar. Only appears after user taps play on any episode. Shows: small cover art, episode title (truncated), play/pause button. Tapping the mini player opens the Episode Detail page.
- Color scheme: dark background (#0a0a0a), white text, accent color for active tab and play buttons (#6366f1 indigo or similar).
- All pages are vertically scrollable.

---

## Page 1: Discover (Public Feed)

Route: `/`

A vertical scrolling list of episode cards. This is the landing page.

### Episode Card

Each card is full-width, horizontal layout:

```
┌─────────────────────────────────────────────────┐
│ ┌────────┐                                      │
│ │        │  Title (bold, 1 line, truncate)       │
│ │ Cover  │  Author Name                          │
│ │ Image  │  Mar 1, 2026 · 6 min                  │
│ │ (1:1)  │                                       │
│ │        │                        [ ▶ ] (circle) │
│ └────────┘                                      │
└─────────────────────────────────────────────────┘
```

- **Cover image**: square, rounded corners (8px), left-aligned, ~80x80px on mobile
- **Title**: bold, single line, ellipsis overflow
- **Author**: secondary text, gray, single line
- **Date + duration**: tertiary text, lighter gray. Format: "Mar 1, 2026 · 6 min"
- **Play button**: circle button on the right side, vertically centered. Tapping plays/pauses the episode and shows the mini player. Does not navigate away.
- **Card tap** (anywhere except play button): navigates to Episode Detail page.
- Cards have subtle dividers or slight spacing between them.
- No header/title needed at the top — the tab name is enough context.
- At the bottom: a "Load More" button or infinite scroll.

### Mock Data (5-6 episodes)

Use Chinese titles and descriptions to match the product:
- "科技早报 — 2026年3月1日", author "Albert", 6 min
- "AI 周报 第9期", author "Dave", 12 min
- "Apple Vision Pro 2 深度解析", author "Albert", 8 min
- "创业者访谈：从零到一", author "Sarah", 15 min
- "芯片战争最新动态", author "Dave", 5 min

Cover images: use placeholder colored squares or https://placehold.co/200x200 with different colors per episode.

---

## Page 2: Library (My Podcasts)

Route: `/library`

Identical card layout and structure as Discover. The only differences:

1. **"+ New Episode" button** at the top of the page, full-width, styled as a dashed-border card or a prominent button. For now just shows an alert/toast "Coming soon" on tap.
2. **Cards show a visibility badge**: small "Public" or "Private" tag next to the date line.
3. **No author name** on cards (all episodes are the user's own).
4. Fewer mock episodes (2-3).

### When not logged in

Replace the entire page content with a centered login prompt:

```
┌──────────────────────────────┐
│                              │
│     🎙️                       │
│                              │
│  Log in to create and manage │
│  your podcasts               │
│                              │
│  [ Continue with Google ]    │
│  [ Continue with GitHub ]    │
│                              │
└──────────────────────────────┘
```

Buttons are full-width, rounded, with provider icons. For prototype, just toggle a mock logged-in state.

---

## Page 3: Profile

Route: `/profile`

### When logged in

Simple, clean profile page:

```
┌──────────────────────────────────────┐
│                                      │
│           [ Avatar circle ]          │
│            Albert Liu                │
│         albert@example.com           │
│                                      │
├──────────────────────────────────────┤
│                                      │
│   ┌──────┐  ┌──────┐  ┌──────┐     │
│   │  12  │  │   8  │  │   4  │     │
│   │Total │  │Public│  │Priv. │     │
│   └──────┘  └──────┘  └──────┘     │
│                                      │
├──────────────────────────────────────┤
│                                      │
│  Connected Account                 → │
│  ─────────────────────────────────── │
│  Appearance                        → │
│  ─────────────────────────────────── │
│  About                             → │
│  ─────────────────────────────────── │
│                                      │
│  [ Log Out ]  (red text, centered)   │
│                                      │
└──────────────────────────────────────┘
```

- **Avatar**: circular, 80px, from OAuth or placeholder initials
- **Name + email**: centered below avatar
- **Stats row**: three boxes in a row showing Total / Public / Private episode counts
- **Settings list**: iOS-style grouped list with chevrons. Items are non-functional for now (just placeholder rows).
- **Log out button**: red text, centered at the bottom. For prototype, toggles back to logged-out state.

### When not logged in

Same login prompt as Library page.

---

## Page 4: Episode Detail

Route: `/episode/{id}`

Full-screen player page, inspired by Spotify / Apple Podcasts "Now Playing" screen.

### Layout

```
┌──────────────────────────────────────┐
│  [ ← ] (back button, top-left)      │
│                                      │
│                                      │
│        ┌──────────────────┐          │
│        │                  │          │
│        │                  │          │
│        │   Cover Image    │          │
│        │   (large, 1:1)   │          │
│        │                  │          │
│        │                  │          │
│        └──────────────────┘          │
│                                      │
│  Title (bold, large, 2 lines max)    │
│  Author Name                         │
│                                      │
│  ──────────●───────────── 2:30/6:00  │
│                                      │
│      [ ◀◀ 15s ]  [ ▶ ❚❚ ]  [ 15s ▶▶]│
│                                      │
│                                      │
│  ── Sources ──────────────────────── │
│                                      │
│  Apple Vision Pro 2 发布  ·  The Verge  ↗│
│  OpenAI GPT-5 发布  ·  Hacker News  ↗   │
│  小米 SU9 亮相  ·  36Kr  ↗              │
│                                      │
│  ── Transcript ───────────────────── │
│                                      │
│  小明: 大家好，欢迎收听...           │
│  小红: 今天我们来聊聊...             │
│  小明: 对，这次升级幅度挺大的...     │
│  (Show more...)                      │
│                                      │
└──────────────────────────────────────┘
```

### Components

- **Back button**: top-left, navigates back. No bottom tab bar on this page — full immersive view.
- **Cover image**: large square, centered, rounded corners (16px), ~70% of screen width.
- **Title**: bold, large font, below the image. Max 2 lines.
- **Author**: secondary gray text.
- **Progress bar**: seekable (draggable thumb). Shows current time and total duration on the sides.
- **Playback controls**: centered row of three buttons:
  - Skip back 15s (small)
  - Play/Pause (large circle, ~64px)
  - Skip forward 15s (small)
- **Sources section**: collapsible list of source articles. Each row: article title, source name, external link icon. Tapping opens link in new tab. Show 3 by default, "Show all" if more.
- **Transcript section**: collapsible. Show first 10 lines by default with "Show full transcript" button. Each line prefixed with speaker name in bold. Different speakers have slightly different text colors.

### Behavior

- Navigated to by tapping a card or tapping the mini player.
- Playback state syncs with the mini player (same audio).
- Hide the bottom tab bar on this page for a cleaner look.
- Swipe down or tap back button to go back.

---

## Interactions Summary

| Action | Result |
|--------|--------|
| Tap play button on card | Start/pause playback, show mini player |
| Tap card body | Navigate to Episode Detail |
| Tap mini player | Navigate to Episode Detail |
| Tap play/pause on mini player | Toggle playback |
| Tap back on Episode Detail | Return to previous page |
| Tap source link | Open article URL in new tab |
| Tap "Show full transcript" | Expand transcript section |
| Tap "Load More" | Append more episodes to list |
| Tap "+ New Episode" | Show "Coming soon" toast |
| Tap "Log Out" | Clear state, show login prompts on Library/Profile |
| Switch tabs | Playback continues, mini player persists |

---

## Tech Notes for Prototype

- Use React state to manage: current playing episode, playback state (playing/paused), logged-in state
- Audio: use an HTML `<audio>` element with a ref. Actual .mp3 not needed — just wire up the UI controls. Can use a sample public MP3 if desired.
- Routing: 4 routes — `/`, `/library`, `/profile`, `/episode/[id]`
- All data is hardcoded arrays of objects. No API calls.
- Mobile-first responsive: looks great on 375px width, works fine up to desktop.
