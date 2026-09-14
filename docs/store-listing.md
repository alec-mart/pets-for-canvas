# Chrome Web Store listing — paste-ready (2026-09-04; time estimates removed 2026-09-10 — re-paste the changed fields with 1.0.5)

Name decided 2026-09-05: **Pets for Canvas** (title, brand, and the exact query — "Pets!" alone is crowded; "pets for canvas" returns 3 unrelated results).

## Single purpose (dashboard field)

Adds a companion pet to Canvas LMS pages that reacts to the student's real assignment state, with coins, streaks, and collars earned by real work.

## Short description (132 chars max)

A pet that lives in your Canvas. It gets happy when you submit, sad when you're late, and grows with your streak.

(alternates, pick one)
- Your Canvas gets a pet. Feed it by finishing assignments, keep your streak alive, unlock new animals and collars.
- A virtual pet for Canvas LMS that actually knows how your semester is going. Submit work, earn coins, dress it up.

## Full description (approved by Alec 2026-09-06 — paste as-is)

A pet that lives in your Canvas.

Pets for Canvas puts a little friend on your Canvas pages. It walks around while you work, gets happy when you submit, gets sad when something is overdue, and falls asleep at night. It knows how your semester is going, because it lives inside Canvas.

Submit assignments to earn coins. Keep your streak alive to earn treats and paydays. Spend coins on collars, open clothing boxes, and adopt new animals. Every reward comes from real work, and coins can't be bought.

Features:
- Pick your first friend: the pup or the kitten
- Feed, pet, walk, and name your pet
- Streaks, milestones, and paydays
- Collars, clothing boxes, and new animals in the shop
- Works with any school on Canvas
- Nothing personal leaves your browser: no names, no grades, no messages

Privacy policy: https://canvas-digest-production.up.railway.app/privacy

## Category

Education

## Permission justifications (dashboard asks for each)

- storage: keeps the pet's state, your streak, and the anonymous device id in your browser. Coins and unlocks are kept on our server under that device id so they cannot be tampered with.
- scripting and activeTab: lets a student on a school with its own Canvas domain (for example canvas.school.edu) enable the extension for that site from the extension menu. Used only when the student clicks "Use on this site".
- Host permission https://*.instructure.com/*: Canvas LMS pages are where the extension works. It reads the current page and, from the page, the student's own course list and course details, assignment details, and overdue status so the pet can reflect real Canvas state. None of it is sent anywhere.
- Optional host permission https://*/*: requested only when a student enables the extension on their school's own Canvas domain. Never requested automatically.

## Remote code

No. All code ships in the package. The extension exchanges JSON with our API for the coin ledger (network.js is the only file that makes requests); it never loads or executes remote scripts.

## Data usage disclosure (Privacy practices tab)

Collected: "User activity" (an anonymous device id, the numeric assignment id or streak milestone a coin was earned for, shop actions, and feedback the student chooses to send). Not collected: personally identifiable information, health, financial, authentication, personal communications, location, web history, website content.

Certifications: data is not sold to third parties; not used for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

Privacy policy URL: https://canvas-digest-production.up.railway.app/privacy

## Assets still needed

- Screenshots: docs/store/ frame 1 (the Canvas page) still shows estimate chips — re-shoot without them for 1.0.5.
- Small promo tile 440x280 (optional but shown in search).
