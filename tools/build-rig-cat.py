#!/usr/bin/env python3
"""Assemble cat-rig.svg from cat-recraft.svg (Recraft, detached-parts source).

Def ids are SPECIES-SUFFIXED (cdNMcat etc.): the popup mounts several rigs on one
page (chooser, shop stage + hero) and <use href="#id"> resolves to the FIRST id in
the document — unsuffixed, the cat wore Winston's nose. Every new animal suffixes.

Same rig
contract as Winston: .cd-ear-l/.cd-ear-r/.cd-tail pivot sandwiches, static
eye discs with synthesized .cd-pupils under static shines, .cd-lids, the
three .cd-mouth-* variants sharing one nose via clip, .cd-collar recolorable.

Path indices verified via the labeled dissect render (44 paths):
  0 silhouette+whiskers  1 head tan  2 white face  3 cream muzzle  4 nose+mouth
  5 nose shine  6 head-top highlight  7/8 R eye+shine  9/10 L eye+shine
  11 body white  12-16 patches  17-22,24,25 paws  27 leg white  29 cheek
  23,28 collar halves  30 buckle  26 tag  31-35 tail  36-39 L ear  40-43 R ear
"""
import re, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from rigfx import eye_fx

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "extension/art/cat-recraft.svg"
OUT = ROOT / "extension/art/cat-rig.svg"

svg = SRC.read_text()
svg = re.sub(r"<metadata[\s\S]*?</metadata>", "", svg)
paths = re.findall(r"<path [^>]*?/>", svg)
assert len(paths) == 44, f"expected 44 paths, got {len(paths)}"
d_of = lambda i: re.search(r'd="([^"]*)"', paths[i]).group(1)

# colorway: the source is drawn in tan; the rig recolors at build time so the source stays
# untouched and a variant is just another table
PALETTE = {
    "#E3B081": "#A9AEBB",   # coat
    "#FEFEFE": "#F6F3EE",   # bib / belly / highlights
    "#EFDAC6": "#E1DFE2",   # muzzle band / chest shade
    "#542513": "#3B3644",   # outline
    "#723D27": "#6E7382",   # tail rings, collar base (economy recolors the collar)
    "#CF946B": "#8F94A3",   # shading
}
OVERRIDES = {
    7: "#5A5D74", 9: "#5A5D74",             # eye discs: dark slate
    37: "#E8A7B1", 41: "#E8A7B1",           # inner ear → pink
    38: "#F4C9CE", 42: "#F4C9CE",           # inner ear light
    18: "#E8A7B1", 20: "#E8A7B1", 22: "#E8A7B1", 25: "#E8A7B1",  # toe beans
    26: "#CDD1DA", 30: "#B9BEC9",           # tag, buckle → silver
    6: "#D3D6DF",                           # head-top highlight
}
def recolor(i, markup):
    cur = re.search(r'fill="([^"]+)"', markup).group(1)
    new = OVERRIDES.get(i, PALETTE.get(cur, cur))
    return markup.replace(f'fill="{cur}"', f'fill="{new}"', 1)
paths = [recolor(i, m) for i, m in enumerate(paths)]

FUR = PALETTE["#E3B081"]  # head fur — lids are cut from it
INK = PALETTE["#542513"]  # outline / mouth / whiskers
NOSE = (368, 366, 108, 58)  # clip: keeps the nose off path 4, drops its mouth
EYE_R, EYE_L = (554, 343), (286, 345)

# detached parts: (attach translate, pivot in POST-translate coords, members).
# The source floats them with a gap; the translate closes it. Ears slide toward the head center
# (their own outline reads as the fold); the tail base tucks behind the rump.
# (attach translate, pivot in POST-translate coords, base rotation °, members)
# Ears: seated 38 units into the head, pivot a further 22 units in (below the base)
# so a swing never lifts the base off the head; +12°/−12° base tilt points them up.
PARTS = {
    "cd-ear-l": ((30, 24),  (302, 242), 12,  (36, 37, 38, 39)),
    "cd-ear-r": ((-29, 24), (594, 238), -12, (40, 41, 42, 43)),
    "cd-tail":  ((-42, 12), (748, 600), 0,   (31, 32, 33, 34, 35)),  # pivot: where the tail meets the rump (base hidden behind the body)
}

def part(cls):
    (tx, ty), (px, py), rot, members = PARTS[cls]
    inner = "".join(paths[i] for i in members)
    # attach translate first, then the pivot sandwich (engine rotates around local 0,0);
    # the base rotation lives inside the sandwich so the engine's swing composes with it
    return (f'<g transform="translate({px},{py})"><g class="{cls}">'
            f'<g transform="rotate({rot}) translate({tx - px},{ty - py})">{inner}</g></g></g>')

# ── whiskers: the art fused them into the silhouette (stubs on path 0, notches
# cut into fills 1/2/3). Surgery from the art's own geometry: (1) mask the whisker
# zones out of path 0, (2) fill the notches by fat-stroking copies of 1/2/3 in
# their own colors, clipped to the same zones, (3) draw six new whiskers as
# individually pivoted curves the engine can sway.
# Each whisker as read off the art's own vertices: inner end (where the painted
# notch starts inside the cheek) → head-edge point → tip. They kink at the edge:
# down into the cheek, up toward the tip — a straight line cuts the wrong slot.
WHISKERS = {
    "r": [((673.5, 444), (732, 426), (800, 420)),
          ((673.5, 466), (719, 462), (796.4, 485.6)),
          ((671, 483), (699, 496), (743, 523))],
    "l": [((222, 443), (168, 427), (95.5, 420.3)),
          ((220, 466), (180, 464), (99.5, 485.3)),
          ((223, 483), (195, 493), (153, 522.4))],
}
ZONE_W = 18  # painted stubs are ~10 wide; ±9 leaves no slivers when the new whisker swings
def zone_shapes(color):
    # FILLED capsules (a clipPath ignores strokes): a quad per segment + joint circles
    import math
    out = []
    for side in WHISKERS.values():
        for pts in side:
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                dx, dy = bx - ax, by - ay
                n = math.hypot(dx, dy); nx, ny = -dy / n * ZONE_W / 2, dx / n * ZONE_W / 2
                out.append(f'<path d="M{ax+nx:.1f} {ay+ny:.1f} L{bx+nx:.1f} {by+ny:.1f} L{bx-nx:.1f} {by-ny:.1f} L{ax-nx:.1f} {ay-ny:.1f} Z" fill="{color}"/>')
            out += [f'<circle cx="{x}" cy="{y}" r="{ZONE_W/2}" fill="{color}"/>' for x, y in pts]
    return "".join(out)

def whisker(side, pts):
    # smooth curve through inner → edge → tip; pivot sandwich at the inner end so the
    # engine rotates it around local (0,0) and the root stays planted in the cheek
    (rx, ry), (ex, ey), (tx, ty) = pts
    return (f'<g transform="translate({rx},{ry})"><g class="cd-wh cd-wh-{side}">'
            f'<path transform="translate({-rx},{-ry})" d="M{rx} {ry} Q{ex} {ey} {tx} {ty}" '
            f'fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round"/></g></g>')

def whiskers(side):
    return f'<g class="cd-whiskers cd-whiskers-{side}">' + "".join(whisker(side, pts) for pts in WHISKERS[side]) + "</g>"

def fat(i, w=16):
    color = re.search(r'fill="([^"]+)"', paths[i]).group(1)
    return paths[i].replace("<path ", f'<path stroke="{color}" stroke-width="{w}" stroke-linejoin="round" ', 1)

def cls(i, c):
    return paths[i].replace("<path ", f'<path class="{c}" ', 1)

pupil = lambda cx, cy: f'<circle cx="{cx}" cy="{cy}" r="17" fill="#0A0A0C"/>'  # the pupil carries the gaze
lid = lambda cx, cy: (f'<ellipse cx="{cx}" cy="{cy}" rx="60" ry="56" fill="{FUR}"/>'
                      f'<path d="M{cx-40} {cy+4} Q{cx} {cy+30} {cx+40} {cy+4}" fill="none" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>')

body = [
    part("cd-tail"),                      # behind the body: the rump overlaps its base
    part("cd-ear-l"),                     # upright ears grow out from BEHIND the head — their base
    part("cd-ear-r"),                     #   tucks under the head outline (Winston's floppy ears
                                          #   needed the top layer; a cat's don't cross the face)
    paths[0].replace("<path ", '<path mask="url(#cdWhiskerMaskCat)" ', 1),   # silhouette minus whisker stubs
    '<g clip-path="url(#cdWhiskerClipCat)">' + fat(1) + fat(2) + fat(3) + "</g>",  # notch filler
    paths[1], paths[2], paths[3],
    # nose is shared by every mouth; the happy mouth is the art's own
    '<use href="#cdNMcat" class="cd-mouth-happy"/>',
    '<g class="cd-mouth-sad"><use href="#cdNMcat" clip-path="url(#cdNoseClipCat)"/>'
        f'<path d="M382 464 Q421 438 460 464" fill="none" stroke="{INK}" stroke-width="8" stroke-linecap="round"/></g>',
    '<g class="cd-mouth-open"><use href="#cdNMcat" clip-path="url(#cdNoseClipCat)"/>'
        f'<ellipse cx="421" cy="452" rx="22" ry="20" fill="{INK}"/>'
        '<ellipse cx="421" cy="461" rx="12" ry="9" fill="#E8837B"/></g>',
    paths[5],                             # nose shine (rides every mouth)
    paths[6],                             # head-top highlight
    '<g class="cd-eyes-open">' + paths[7] + paths[9] +
        '<g class="cd-pupils">' + pupil(*EYE_R) + pupil(*EYE_L) + "</g>" +
        paths[8] + paths[10] +            # shines STATIC, above the pupils
        eye_fx(*EYE_R, 52, "#8C90A8", "CatR", gloss=.18, rim_op=0) + eye_fx(*EYE_L, 52, "#8C90A8", "CatL", gloss=.18, rim_op=0) +   # slate eyes: gloss and catchlight only
    "</g>",
    '<g class="cd-lids" opacity="0">' + lid(*EYE_R) + lid(*EYE_L) + "</g>",
    *(paths[i] for i in (11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)),
    cls(23, "cd-collar"),
    *(paths[i] for i in (24, 25)),
    cls(26, "cd-collar-tag"),
    paths[27],
    cls(28, "cd-collar"),
    paths[29], paths[30],
    whiskers("l"), whiskers("r"),         # above the face
    '<g class="cd-zzz" font-family="Georgia, serif" font-weight="700" fill="#B08D5B">'
        '<text x="700" y="200" font-size="110">z</text><text x="775" y="130" font-size="80">z</text></g>',
]

OUT.write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
    + '<defs>'
    + f'<path id="cdNMcat" fill="{INK}" d="{d_of(4)}"/>'
    + f'<clipPath id="cdNoseClipCat"><rect x="{NOSE[0]}" y="{NOSE[1]}" width="{NOSE[2]}" height="{NOSE[3]}"/></clipPath>'
    + '<mask id="cdWhiskerMaskCat" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">'
    + '<rect width="1024" height="1024" fill="#fff"/>' + zone_shapes("#000") + "</mask>"
    + '<clipPath id="cdWhiskerClipCat">' + zone_shapes("#000") + "</clipPath>"
    + "</defs>" + "".join(body) + "</svg>"
)
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
