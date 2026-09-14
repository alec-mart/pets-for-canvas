# Pet behavior — what the great pet games know (research, 2026-09-03)

Six reference designs, what each proved, and how ours compares. Sources:
Deconstructor of Fun's Finch teardown, Finch UX critiques, Nookipedia/ACNH
behavior docs, plus design lore (Tamagotchi, Nintendogs, Shimeji).

## The references

**Finch (self-care pet, ~$30M ARR, no VC)** — the closest analog to us:
a pet powered by *real-life obligations*. Proved:
- **Positive-only reinforcement.** The bird never sickens, never dies, never
  guilts. For an app tied to things people already feel anxious about
  (self-care; for us, schoolwork), punishment compounds the anxiety and
  churns users. Finch's growth is all carrot.
- **The pet externalizes your effort** — tasks visibly *power* the pet
  (energy → adventures). Effort you can see lands harder than points.
- **Presence beats notification.** Widgets showing the pet's current state
  drive re-engagement without push spam ("appointment mechanics").
- **Identity investment**: naming, outfits, room decor. You keep the app
  because the bird is *yours*.

**Animal Crossing** — the attachment masterclass. Proved:
- **The character initiates.** Villagers "ping" the player — surprise, run
  over, start the interaction. A creature that *wants your attention
  sometimes* feels alive; one that only reacts feels like a widget.
- **Memory/continuity**: villagers reference what you did yesterday.
  Continuity of state = perceived inner life (our cross-page persistence is
  a primitive version of this).
- **Emote exchange**: you emote, they emote back — interaction, not display.
- **Real-clock rhythms** (shops close, villagers sleep) create daily ritual
  and scarcity. Non-punitive: miss a week and villagers *miss you*; nothing
  is destroyed.
- **Personality types** make a menagerie meaningful — villagers differ in
  behavior, not just skin.

**Tamagotchi** — the original loop: needs decay → check-back pull →
care-quality determines evolution. Also the cautionary tale: death/neglect
punishment is why lapsed users never came back. Modern descendants dropped it.

**Nintendogs / Talking Tom** — direct touch is the delight core: petting,
feeding, reactions to contact. Attention is the currency; the pet visibly
enjoys *you*.

**Duolingo** — streaks + a mascot with feelings about your streak. Proved
streak psychology at planetary scale; also proved the line where guilt-tripping
becomes a meme and then a liability. They sell streak *freezes* — forgiveness
as a product.

**Shimeji (desktop pets)** — pure ambient charm, zero loop. Everyone installs
one, everyone removes it in two weeks. Charm without progression decays;
that's the trap our streaks/unlocks exist to avoid.

## Ours vs. the canon

| Mechanic | Canon example | Ours today |
|---|---|---|
| Needs/moods from real state | Tamagotchi, Finch | ✅ overdue→sad, absence→hungry, night→sleep |
| Positive reward moment | Finch energy, AC gifts | ✅ treat arc, jump, confetti |
| Touch delight | Nintendogs | ✅ pats, leash-walking |
| Wordless emotes | AC reactions | ✅ bubbles (food/sad/zzz/heart) |
| Continuity/memory | AC "about yesterday" | ✅ position persistence; ❌ no behavioral memory |
| Pet initiates ("ping") | AC villagers | ❌ only pokes at *things*, never at *you* |
| Naming / identity | Finch, Nintendogs | ❌ hardcoded "Miso" |
| Visible growth on the pet | Finch outfits/stages | ❌ unlocks planned, nothing visible yet |
| Personality per animal | AC types | ❌ menagerie currently skins-only (rig contract ready for params) |
| Daily ritual anchor | AC real-clock | ⚠️ sleep cycle only; no first-visit-of-day moment |
| Forgiveness mechanic | Duolingo freezes | ❌ not designed yet (matters before streaks ship) |
| Punishment ceiling | Finch (none), Tamagotchi (fatal) | ✅ sad is our floor — keep it there forever |

## Ranked recommendations

1. **Naming** (cheap, highest attachment-per-line-of-code). First-run: the pet
   trots in, a small "What's their name?" input appears once. Named pets don't
   get uninstalled.
2. **Eye contact**: eyes track the cursor when it's near. The single cheapest
   "it's alive" signal in the entire canon (Nintendogs presence, in 10 lines).
3. **Daily greeting ritual**: first Canvas visit of the day → wake-stretch-yawn
   + happy trot to you (AC's ping + ritual anchor in one). This is also the
   natural home for the streak-day tick later.
4. **The ping**: rarely (once/session max), the pet walks toward the cursor,
   looks up, and does a small bounce — it *wanted you*. Pure AC. Cap
   frequency ruthlessly; a needy pet is a muted pet.
5. **Positive-only tuning pass** (Finch's law): sad-on-overdue stays (it's
   honest), but recovery must be instant and oversized — completing the
   overdue item should trigger the *biggest* celebration, not a quiet mood
   flip. Never stack guilt: one sad emote per session-ish, never escalating.
6. **Forgiveness by design**: before streaks ship, define the freeze (a sick
   day shouldn't kill a 40-day streak; Duolingo monetizes this — we can just
   *give* one per month and be loved for it).
7. **Visible growth**: milestones change the pet itself (collar tag upgrades →
   tiny accessories). Growth on-body beats numbers in a popup (Finch).
8. **Personality params for the menagerie** (v2): temperament knobs per animal
   (lazy/lively/curious multipliers on existing behaviors). Makes the second
   animal a different *pet*, not a different sprite — AC's lesson, and it's
   nearly free with the rig contract.

## The one-sentence synthesis

Finch proves the loop (real obligations → pet growth, never punishment),
Animal Crossing proves the soul (initiative, memory, ritual, personality) —
ours has the body and the loop's skeleton; the soul items above are what turn
"a cute overlay" into "my cat."
