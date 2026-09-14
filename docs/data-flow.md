# Data flow: extension → backend → DB

> **SUPERSEDED IN PART (2026-09-10):** time reports and estimate chips were REMOVED from the extension (1.0.5, Alec: "nothing about the page leaves the browser"). Sections 1, 5, 6 and 8 describe the report pipeline as it was; the server endpoints still exist but no shipped client calls them. What leaves the browser today is exactly the contents of `extension/network.js`: the ledger (device id + earn/spend events), feedback, and the device id written to the student's own Canvas custom data. docs/privacy.md is the user-facing statement.

The end-to-end map of what we collect, where it travels, what touches AI, and
what each field's source is. Facts marked **verified** were tested against live
MTU Canvas on 2026-09-02. This document doubles as the security story for the
Phase 3 IT meeting: the goal is that Alec can draw this from memory.

## 1. The report payload (what leaves the browser)

One bucket tap produces one report:

```json
{
  "device_id":  "b3f2…",            // random UUID, generated on install, stored in chrome.storage
  "course_id":  1611537,             // from the planner row's link
  "assignment_id": 13824489,         // same
  "kind": "assignment",              // assignment | quiz | discussion
  "bucket": "3_6",                   // lt1 | 1_3 | 3_6 | 6_10 | gt10
  "title": "Class Survey",
  "reported_at": "2026-09-04T21:40:00Z"
}
```

What is **never** in a payload: name, email, Canvas user id, grades, message
content, browsing history. The device_id is anonymous and resettable (clear
extension storage = new identity).

- **v0 (now):** payload stays in `chrome.storage.local`; popup shows/exports it.
- **Phase 1:** `POST https://api.<ourdomain>/reports` over HTTPS. Local storage
  becomes a write-through queue (offline-safe: retry until acked).

## 2. Identity and dedupe

- **Anonymous by default.** device_id only. Soft enrollment proof: a report can
  only originate from the real planner/assignment page of a course the browser
  is actually logged into — trolling requires being enrolled, unlike RMP.
- **Never-ask-twice** is enforced twice: client-side (asked-keys in storage) and
  server-side (`UNIQUE(device_id, assignment_id)`).
- **Account-link (later, optional):** digest users connect Discord → their
  device_id joins to a user row. Linked reports get higher weight in medians and
  unlock "you vs. class" reciprocity. Unlinked reports remain first-class.

## 3. The same-origin session API (verified 2026-09-02)

The content script runs on `mtu.instructure.com`, so `fetch('/api/v1/…')`
rides the user's logged-in session — no token, no OAuth. Responses are JSON
prefixed with `while(1);` (strip it). Verified live:
`/api/v1/courses?enrollment_state=active&include[]=teachers` → 200 with all
five professor names.

**Design decision — the extension's fetch list is fixed and documented**
(v2, amended 2026-09-03 for the pet's verified streaks/points):

| Fetch | When | Why |
|---|---|---|
| `courses?include[]=teachers` | once per term, cached | course → professor/section mapping |
| `courses/:id/assignments/:id` | on report / estimate display | title, points, due, description, submission_types |
| `users/self/missing_submissions` | on streak verification (~30 min) | verified streak: missed-day detection |
| `planner/items` (today window) | on streak verification | today's stale/extended state |
| own submission/grade state | on completion events | verified points — the economy pays only on receipts |

**Policy line, non-negotiable:** everything on the list is the user's own
data; the extension never reads inbox, discussion content, or anything about
any other user. The list may grow only by documented amendment — never drift.
It's short enough to read aloud; that's the point (store listing, reviews,
and Chrome's data-use justification — the audiences that replaced the IT
meeting, which is now an optional B2B conversation, not a gate).

**Capability vs. policy — be honest about which is which.** Session auth is
close to *full* API power, writes included (mutations need Canvas's CSRF
token, but it lives in a cookie the same-origin script can read). The
two-call budget is enforced by our shipped code and Chrome-store review, not
by a technical wall. The defensible claim is "audit the list of calls our
code makes" — never "we can't do more." Same posture as digest tokens, which
are also technically full-power and read-only by policy.

## 4. Field provenance (page DOM vs. session API vs. backend token API)

| Field | Page DOM | Session API (extension) | Token API (backend) |
|---|---|---|---|
| course + section name | ✅ card label | ✅ | ✅ |
| course_id / assignment_id | ✅ row link href | ✅ | ✅ |
| title, type | ✅ card | ✅ | ✅ |
| due date, points | ✅ card | ✅ | ✅ |
| **professor name** | ❌ **verified absent** (dashboard DOM + `ENV`) | ✅ **verified** via `include[]=teachers` | ✅ |
| assignment description | ❌ (not on dashboard) | ✅ | ✅ |
| own submission state/timestamps | partial | ✅ | ✅ |
| grades, inbox | ❌ | possible but **forbidden by policy** | digest users only |

Conclusion for the funnel: **the anonymous, install-and-done extension can
produce fully-tagged reports** (campus → term → course → section → professor →
assignment) with zero onboarding. The backend token API is only needed for the
digest/agent product, not the crowd layer.

## 5. DB schema (Phase 1 sketch — Postgres on Railway)

```
devices(device_id PK, created_at, user_id NULL → users)
users(id PK, discord_id, canvas_user_id, canvas_token_encrypted, created_at)   -- digest users only
courses(canvas_course_id PK, campus, term, name, section_code, professor_name, updated_at)
assignments(canvas_assignment_id PK, canvas_course_id → courses, title, points,
            due_at, submission_types, description_hash, updated_at)
reports(id PK, device_id → devices, canvas_assignment_id → assignments,
        bucket, reported_at, UNIQUE(device_id, canvas_assignment_id))
estimates(canvas_assignment_id PK, source ENUM(llm, crowd), bucket_median,
          hours_hint, n, updated_at)
```

Notes: description_hash (not raw text) is enough for change detection; raw
descriptions are fetched on demand for the estimator, not warehoused.
Token encryption at rest; delete-my-data = cascade from users + devices.

## 6. AI decision points (all four, and only these four)

1. **Day-one estimator (the LLM prior).** Input: title, description, points,
   course context. Output: a bucket + "estimated" label. Never displayed as if
   reported. Long-run: reported (description → hours) pairs fine-tune/fit a
   model that transfers to new campuses — old data's terminal value.
2. **Cross-section / cross-semester assignment matching — three tiers, LLM last.**
   Within a semester, identity is free: reports key on `assignment_id`, which
   survives renames (title is cosmetic; only a `description_hash` change matters —
   keep the reports, flag the estimate stale). Across semesters, course copy
   mints new ids, so matching runs in tiers:
   - **Exact (most volume, no AI):** identical `description_hash` within the same
     course code — course copy carries descriptions verbatim.
   - **Fuzzy (cheap):** title similarity + points + submission type + position in
     semester (due-week N is a strong signal).
   - **LLM (rare):** adjudicates only the ambiguous middle, and always outputs a
     confidence, never a bare yes.
   A course's historical match rate becomes its **stability score** — measured,
   not assumed — so photocopy courses lean on last year's data while
   new-professor / high-variance courses demote it to a weak prior. Display
   hierarchy, always labeled: *reported this semester* > *reported last term,
   matched* > *estimated*. Current-semester reports trump history the moment
   they exist.
3. **Aggregation & quality.** Bucket medians, never means; min n=5 before any
   display (also the privacy floor — small-n + professor label can deanonymize);
   account-linked reports weigh more; extreme-outlier trim.
4. **The digest prompt** (the product's voice) — separate concern, lives in the
   delivery layer, never touches raw reports.

Everything else in the pipeline is deterministic plumbing.

## 7. Privacy invariants (the IT story, condensed)

- Reports are anonymous; only aggregates above min-n are ever displayed.
- The extension reads the pages the user already sees plus two fixed metadata
  calls; never grades, never inbox, never other students. The full fetch list
  fits in one breath.
- Digest tokens: encrypted at rest, used read-only by policy, delete-my-data
  is a hard cascade.
- Individual-level data is never sold or shared. Aggregate analytics
  (course/department workload) is the only external product, and it clears the
  same min-n floor.
```

## 8. The flow, end to end

```
 ┌────────────────────────── browser (mtu.instructure.com) ──────────────────────────┐
 │  planner page DOM ──ids/title/due──▶ content script ◀──prof/desc── session API    │
 │                                      │        ▲                                   │
 │                          bucket tap  │        │ estimate chip (display path)      │
 │                                      ▼        │                                   │
 │                              chrome.storage (queue)                               │
 └──────────────────────────────────────┼────────┼──────────────────────────────────┘
                                 POST /reports   GET /estimates          (Phase 1)
                                        ▼        │
                                   API (Railway) ┘
                                        ▼
                                    Postgres ◀── enrichment worker (token API: courses,
                                        │         assignments; digest users only)
                                        ▼
                                   estimator (LLM prior → crowd medians)
                                        ▼
                              digest / ICS / registration lookup
```
