# Streak spec — BetterCampus's exact algorithm, reverse-engineered (2026-09-02)

Source: BetterCampus v9.8.6 `content-scripts/all.js`, read from the installed
extension. Their streak is the market's expectation-setter (1.5M users), so we
copy the *mechanics* and swap only the completion-truth source.

## Their algorithm, verbatim semantics

**Storage:** `streak: { started_at, high, last_verified, last_expired,
restored_at, push_dirty, last_sync }` — a streak is a **start date**; the
count is days-since. Local-first, synced to their server.

1. **Definition:** consecutive days "without missing a task." A day only
   *counts against you* if it had ≥1 due task that wasn't completed. **Days
   with nothing due are automatically safe** — weekends and breaks cost
   nothing (deadline-anchored, no freezes needed).
2. **Retroactive install credit:** on first run, they scan up to **1 year**
   back for the most recent missed day; `started_at` = that day + 1. New
   users instantly see a big earned streak — onboarding dopamine, zero grind.
3. **Daily states:** if anything due *today* is still incomplete, the pill is
   **"stale"** (gray) and shows N (yesterday's count). Complete everything due
   today → **"extended"**: count becomes N+1 immediately and a fire "burn"
   animation plays on the stale→extended transition. Securing the day is a
   *moment*, not a midnight tick.
4. **Verification window:** each check re-verifies from
   `min(last_verified, today−2d)` (always re-checks the last 2 days, catching
   late submissions/changes), clamped to ≥ started_at and ≥ restored_at+1.
   If a missed day is found: **broke** — `started_at` = missed day + 1,
   `high` = max(high, old count), `last_expired` = now.
5. **Completion truth (theirs):** Canvas assignments + *their own todo
   overrides* — manual checkmarks count toward streak.
6. **Restore mechanic:** after a break you can restore the old streak IF
   (a) within **48 hours** of the break (`1728e5` ms), and (b) the lost
   streak exceeded the current one by > **14 days** (prod constant) — small
   losses aren't restorable. Restoring sets `restored_at`, which exempts the
   missed day from future verification. Restores are gated (paid/limited).
7. **Tier table:** burn-animation intensity and pill color scale with streak
   length via a lookup table; `high` (record) is kept separately.
8. **Dev tooling:** `__streak_debug_date` storage key overrides "today" for
   testing, plus a hidden debug panel showing per-day status. (Copy this.)

## Our adaptation (mechanics identical, truth source swapped)

- **Copy verbatim:** started_at model, retroactive credit on install,
  no-task days safe, stale/extended today states, 2-day re-verification,
  high tracking, 48h/min-loss restore shape, debug date override.
- **Swap:** "completed" = our completion truth (submission exists / graded /
  external-tool checkoff per the LTI rule) via `missing_submissions` +
  submission state — NOT bare checkmarks. Reason: streak milestones pay
  points (economy Rule 1: receipts only); BetterCampus checkmark-streaks are
  gameable, ours can't be, and that's a marketing line too.
- **Pet mapping:** "stale" = pet waits expectantly (glances at you more);
  stale→extended transition = the pet's daily celebration (our streakBurn
  equivalent — jump + heart, milestone days get the dance); break → sad,
  restore → relieved ultra.
- **Restore policy (ours):** one free restore per month (forgiveness-by-design
  from the behavior research; they charge for it — we gift it).
- Milestone payouts per economy v2 (super-linear), day-denominated ✓ (their
  unit is days; ours matches).

## ⚠️ Competitive intel found in the same bundle

BetterCampus v9.8.6 ships storage keys **`pet_profile_updated_at`** and
**`cached_game_home`** plus sticker positions and a "cards" system — the
1.5M-user incumbent is building (or already shipping) pet/game features.
Investigate scope; assume the pet space gets contested. Our moats stay: the
crowd time-estimate data layer, tokenless trust posture, behavior depth.
