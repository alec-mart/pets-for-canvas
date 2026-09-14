#!/usr/bin/env python3
"""Assemble capy-rig.svg from capy-recraft.svg (Recraft, detached-parts source).

Side-profile art (walking right), which
suits the engine's flip-by-direction. Same rig contract: .cd-ear-l/.cd-ear-r/.cd-tail pivot
sandwiches, a synthesized .cd-pupils dot under the art's static shine, .cd-lids, three
.cd-mouth-* variants, .cd-collar / .cd-collar-tag recolorable, whiskers as .cd-wh pivots.
Def ids are species-suffixed (…Capy).

Path indices (bbox dump, 100 paths):
  0 outline  1 coat  2/3/15 back sheen  4 far-back leg outline  5-16 far-back paw
  17 belly  18/19 leg line  20/21 sheen  22/27/67/72 collar  57-66 tag  68-71/73 ring
  23-26/28 front-far paw  29/74 mouth corners  30 head  31 snout patch  33/34 nose  35 cheek
  36/37 chin  38/41/45 mouth  39/40/46 head sheen  42-44 jaw  47 eye  48 shine  49 near whisker
  50-56 front-near leg  75-84 back-near leg  85-88 back ear  89-92 tail  93/94 front ear
  95-97 far whiskers  98/99 leg detail
"""
import re, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from rigfx import eye_fx

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "extension/art/capy-recraft.svg"
OUT = ROOT / "extension/art/capy-rig.svg"

svg = SRC.read_text()
svg = re.sub(r"<metadata[\s\S]*?</metadata>", "", svg)
# gradient ids are document-global (the popup mounts several rigs on one page): suffix them
svg = re.sub(r'id="gradient_(\d+)"', r'id="gradientCapy_\1"', svg)
svg = re.sub(r'url\(#gradient_(\d+)\)', r'url(#gradientCapy_\1)', svg)
# Recraft scatters one <defs> per gradient; gather every gradient (post-suffix) into a single defs
defs = "<defs>" + "".join(re.findall(r"<(?:linear|radial)Gradient[\s\S]*?</(?:linear|radial)Gradient>", svg)) + "</defs>"
paths = re.findall(r"<path [^>]*?/>", svg)
assert len(paths) == 80, f"expected 80 paths, got {len(paths)}"
d_of = lambda i: re.search(r'd="([^"]*)"', paths[i]).group(1)

# colorway: the source is drawn in tan; the rig recolors at build time. One solid coat, no
# belly or cheek patch; belly, cheek, snout, feet and sheen all collapse into the coat.
COAT = "#A9744A"   # red-brown
PALETTE = {
    "#E3A569": COAT,        # coat
    "#CE8151": COAT,        # feet
    "#F1B88C": COAT,        # highlights
    "#D8987D": COAT,        # small shade
    "#9B5631": "#6E4327",   # snout patch, darker than the coat
    "#FEFEFE": COAT,        # belly / cheek / sheen
    "#531707": "#3E1E0C",   # outline
    "#431204": "#2E1508", "#602709": "#5A3418", "#833A19": "#6E4425",
}
PINK = "#E8A7B1"   # inner ears and toe beans
OVERRIDES = {44: "#FFFFFF", 69: "#F4C9CE", 70: PINK, 7: PINK, 10: PINK, 13: PINK, 21: PINK, 25: PINK, 49: PINK}
def recolor(i, markup):
    m = re.search(r'fill="([^"]+)"', markup)
    if not m: return markup
    cur = m.group(1); new = OVERRIDES.get(i, PALETTE.get(cur, cur))
    return markup.replace(f'fill="{cur}"', f'fill="{new}"', 1)
paths = [recolor(i, m) for i, m in enumerate(paths)]

FUR = PALETTE["#E3A569"]; INK = PALETTE["#531707"]
EYE = (770, 298)   # centre of the dark disc (47)

# (attach translate, pivot in POST-translate coords, base rotation °, members)
# Ears seat ~30 units into the head from behind; pivots sit below the base, inside the head.
PARTS = {
    "cd-ear-l": ((26, 42),  (616, 262), 10,  (67, 68, 69, 70)),   # back ear
    "cd-ear-r": ((-6, 48),  (716, 250), -8,  (75, 76)),           # front ear
    "cd-tail":  ((72, 8),   (190, 500), 0,   (71, 72, 73, 74)),   # stub tail: base 70 units inside the rump, hidden by the body
}
def part(cls):
    (tx, ty), (px, py), rot, members = PARTS[cls]
    inner = "".join(paths[i] for i in members)
    return (f'<g transform="translate({px},{py})"><g class="{cls}">'
            f'<g transform="rotate({rot}) translate({tx - px},{ty - py})">{inner}</g></g></g>')

# whiskers are already detached shapes: pivot each at its root (the snout end)
def wh(i, side, root, dx=0):
    rx, ry = root
    return (f'<g transform="translate({rx + dx},{ry})"><g class="cd-wh cd-wh-{side} cd-wh-wide">'
            f'<g transform="translate({-rx},{-ry})">{paths[i]}</g></g></g>')
whiskers = ('<g class="cd-whiskers cd-whiskers-r">' + wh(77, "r", (961, 365), -18) + wh(78, "r", (963, 391), -18) + wh(79, "r", (959, 410), -18) + "</g>"
            '<g class="cd-whiskers cd-whiskers-l">' + wh(45, "l", (831, 367)) + "</g>")

def cls(i, c): return paths[i].replace("<path ", f'<path class="{c}" ', 1)

pupil = f'<circle cx="{EYE[0]}" cy="{EYE[1]}" r="15" fill="#0A0A0C"/>'
lid = (f'<ellipse cx="{EYE[0]}" cy="{EYE[1]}" rx="40" ry="38" fill="{FUR}"/>'
       f'<path d="M{EYE[0]-26} {EYE[1]+2} Q{EYE[0]} {EYE[1]+22} {EYE[0]+26} {EYE[1]+2}" fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>')
MOUTH = (35, 38, 40)
body = [
    part("cd-tail"), part("cd-ear-l"), part("cd-ear-r"),      # behind the body / head
    paths[0], paths[1], paths[2], paths[3], paths[4], paths[5],
    *(paths[i] for i in range(6, 14)),
    paths[15], paths[14], paths[16], paths[17], paths[19],
    *(paths[i] for i in (20, 21, 22, 23, 24, 25, 27)),
    paths[28], paths[29], paths[33], paths[36], paths[37], paths[39], paths[41], paths[34], paths[30], paths[43],
    paths[31], paths[32],                                       # nose, static
    '<g class="cd-mouth-happy">' + "".join(paths[i] for i in MOUTH) + "</g>",
    # the mouth sits at the FRONT of the blunt snout, under the nose (the art's smile runs 798→833; the
    # opening belongs where that line meets the chin, ~x 870) — the first guess sat back in the cheek
    # under the whiskers (they end at y≈428): a dark mouth touching dark whiskers read as whiskers vanishing
    f'<g class="cd-mouth-sad"><path d="M834 462 Q860 446 886 462" fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round"/></g>',
    f'<g class="cd-mouth-open"><ellipse cx="860" cy="456" rx="16" ry="12" fill="{INK}"/><ellipse cx="860" cy="462" rx="9" ry="5" fill="#E8837B"/></g>',
    '<g class="cd-eyes-open">' + paths[42] + '<g class="cd-pupils">' + pupil + "</g>" + paths[44] + eye_fx(*EYE, 29, "#6E4C30", "Capy") + "</g>",
    '<g class="cd-lids" opacity="0">' + lid + "</g>",
    paths[46], paths[47], paths[52],                            # front-near leg, all four paws down (art v3)
    paths[48], paths[49], paths[50], paths[51],
    cls(18, "cd-collar"), cls(26, "cd-collar"), cls(60, "cd-collar"),
    *(paths[i] for i in (61, 62, 63, 64, 65, 66)),
    *(cls(i, "cd-collar-tag") for i in range(53, 60)),
    # the tangerine: a detached prop on the head (its own pivot at the contact point so the engine can bob it)
    '<g transform="translate(770,196)"><g class="cd-prop"><g transform="translate(-770,-196)">'
      '<ellipse cx="770" cy="150" rx="58" ry="52" fill="#F28C28"/><ellipse cx="770" cy="150" rx="58" ry="52" fill="none" stroke="#3E1E0C" stroke-width="8"/>'
      '<ellipse cx="750" cy="132" rx="16" ry="10" fill="#FFC27A" opacity=".85"/>'
      '<path d="M774 100 Q800 70 830 82 Q808 104 780 104 Z" fill="#5FA85A" stroke="#3E1E0C" stroke-width="7" stroke-linejoin="round"/>'
      '<path d="M770 100 L770 84" stroke="#3E1E0C" stroke-width="7" stroke-linecap="round"/>'
    '</g></g></g>',
    whiskers,
    '<g class="cd-zzz" font-family="Georgia, serif" font-weight="700" fill="#B08D5B">'
        '<text x="900" y="200" font-size="110">z</text><text x="975" y="130" font-size="80">z</text></g>',
]
OUT.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
               + defs
               + "".join(body) + "</svg>")
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
