# Art style direction — research & decision (2026-09-03)

Question: which art style maximizes first-impression appeal for 18–24 college
students, supports a variant/collection economy, and stays buildable in our
SVG rig pipeline?

## What the research says

**1. "Plushcore" is the dominant Gen-Z/Alpha character aesthetic right now.**
Soft, toy-like, squishy mascots dominate short-form feeds and brand design
(Envato 2026 3D trends). Interfaces increasingly use "cheerful mascots,
rounded characters" for likability. The winning mascots per the 2026 trend
writeups are NOT single-trend-chasing designs but characters with **emotional
range + clear rules across surfaces** — exactly our rig-contract philosophy.

**2. The collectible-comfort-object craze is our audience, precisely.**
Smiski/Sonny Angel/blind-box trinkets are a documented obsession among
college students (Harvard Crimson, campus papers): drivers are *comfort and
companionship for emotionally isolated students*, *inner-child healing*,
*affordable collecting*, *the blind-box discovery thrill*, and *community
trading/meetups*. Read that list again — it is our product spec: a comfort
companion (pet) + affordable collecting (points economy) + discovery thrill
(variant luck) + campus community. **A Smiski is a little guy hiding in the
corner of your room; our pet is a little guy hiding in the corner of your
Canvas.** That's the positioning sentence.

**3. Retro/nostalgia (pixel, Y3K) is real but secondary** — a strong *skin*
direction someday (pixel variant week?), not the identity.

## Candidate directions

| Direction | For | Against | Verdict |
|---|---|---|---|
| Flat geometric (Duolingo) | Professional, cheap to animate, timeless | Reads "brand mascot," not "my pet"; low collectible energy; everyone's default | No |
| **Soft-plush vector ("plushcore-lite")** | Matches the dominant aesthetic AND the comfort-object psychology; collectible "little guy" energy makes variants feel like blind-box pulls; our current puppy is already 80% this; SVG gradients + squash/stretch sell "squishy" | Slightly heavier SVG than flat | **YES — the direction** |
| Pixel-retro | Nostalgia wave, dirt-cheap variants, Tamagotchi callback | Lower emotional softness; reads "dev project" unless exceptional; we already left it | Skin idea later, not identity |
| True 3D / pre-rendered plush | Peak trend | Kills the procedural rig + palette-variant advantage; heavy pipeline | No (revisit only with real art budget) |

## The decision

**Soft-plush vector.** Push the current puppy further toward "digital plush
toy": chunky rounded silhouette, soft gradient shading (already in), squash-
and-stretch that reads as *squishy* (already in), warm pastel-leaning
palettes, big expressive eyes (already in). Spend future art effort on
**emotional range** (more expressions, better mood poses) over rendering
complexity — per the trend research, range is what separates beloved mascots
from decorations.

**Positioning language this unlocks:** "a little guy who lives in your
Canvas." Variants = blind-box pulls you earn by staying on top of school.
The Smiski parallel should inform store screenshots and flyer copy.

**What we deliberately skip:** 3D pipelines, outline-heavy styles, single
trend gimmicks. Pixel appears, if ever, as a rare variant *within* the
plush world (a "retro" coat), which turns the trend into content instead of
identity.
