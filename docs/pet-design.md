# Pet — design outline (v1)

Product frame (decided in the project notes): the pet is acquisition + the reporting
reward loop. Emotions run on real Canvas state; streaks earn points; points
unlock animals; prestige animals are earned-only; art bar is high; not
toggleable.

## Architecture

- **Overlay:** one fixed-position element on Canvas pages, walking along the
  bottom edge. Draggable; position persisted. Pauses when tab hidden
  (performance + battery). No iframes, no external requests for assets —
  everything bundles with the extension.
- **Rendering (decided 2026-09-03 — soft vector):** layered inline SVG with
  skeletal CSS/JS animation — squash-and-stretch, smooth easing, Duolingo/Finch
  vibe. Fits the "fluid movements" bar better than stepped sprites, and the
  first character can be crafted in code (no asset sourcing delay). The
  commissioned menagerie later inherits the same rig.
- **Modules:** `pet.js` (state machine + renderer), `streak.js` (points/streak
  ledger), both content-script side; state in `chrome.storage.local`. Server
  sync deferred until the economy matters (anti-cheat/purchases are
  server-authoritative by design when they arrive).

## State machine (priority top → bottom)

| State | Trigger | Duration |
|---|---|---|
| ultra_celebrate | exam/big project (>40 pts or keyword) completed & verified | one-shot burst |
| happy_jump | time report tapped (the core reward) | one-shot |
| eating → fed | assignment completion verified (submitted/graded) | one-shot → mood boost |
| sad | overdue/missing item exists | while true |
| hungry | no Canvas visit ≥ 2 days (decay — the check-back-daily pull) | until visit |
| sleeping | local night hours, nothing pending | ambient |
| idle / walk | default | ambient loop |

Mood = f(overdue count, streak, days since visit). Emotions may react to
checkmarks; **points may not** (economy pays only on verified events — the
anti-data-poisoning rule).

## Streak + points (v1)

- **Streak day** = visited Canvas AND zero missing submissions at day's end.
- Points: +10/streak day; milestone bonuses (7d +50, 30d +250, 50d +500);
  +5 per verified completion. Balance is local in v1, labeled "beta — syncs
  later"; server-authoritative before any money exists.
- **Policy amendment required:** streak verification needs one more
  session-API read (`/users/self/missing_submissions`). Extension fetch budget
  goes 2 → 3 calls, documented in data-flow doc when approved.

## Unlocks (v1 scaffolding)

Starter animal free; 2–3 unlockables at point tiers shown as **silhouettes**
("??? — 1000 pts") — anticipation without art debt. Prestige/earned-only tiers
and purchases come with the server economy, not v1.

## Build phases

1. **P0 — it lives:** overlay + one animal + idle/walk ambient + happy_jump on
   report tap + drag/persist position.
2. **P1 — it feels:** Canvas-state emotions (sad/hungry/fed/ultra), streak +
   points ledger, small hover card (pet name, streak, points, next unlock).
3. **P2 — it progresses:** unlock UI, second/third animal, celebration
   particles.
4. **P3 — it's an economy (server):** sync, anti-cheat, purchases (Stripe),
   prestige tiers.

## Design principle: unpredictability (Alec, 2026-09-03)

"Predictable doesn't read as cute." Mechanisms read as machines; noise reads
as mind. Every behavior gets variance: interest-gated gaze (he sometimes
ignores the cursor entirely; pursuit is slow), ambient glances of his own,
jittered stroll pace with gait tempo synced, mid-walk changes of mind,
chained idle routines, weighted-random everything. Apply this rule to every
future behavior before shipping it.

## Decisions (2026-09-03)

- Art: **soft vector / modern** (SVG rig, code-crafted starter, commissioned set later)
- Placement: **all Canvas pages**
- Speech: **mute in v1** — emotions carry the message; hover card for streak/points
- Fetch list amended to v2 (own missing_submissions + own submission/grade state) —
  approved; documented in data-flow doc. IT meeting demoted to optional B2B call.
