#!/usr/bin/env python3
"""Assemble winston-rig.svg from winston-recraft-3.svg (detached-parts source).

The import format: generate/edit the character in
Recraft with every movable part DETACHED — ears, tail floating beside the body,
no ground shadow. The vectorizer then emits each part as its own self-outlined
path cluster (it only fuses shapes that touch), so rigging = delete spares,
tint, translate parts to their attach points, wrap rig groups. No mask surgery.

Path indices verified via docs/rig-dissect.html?f=winston-recraft-3.svg.
"""
import re, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); from rigfx import eye_fx

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "extension/art/winston-recraft-3.svg"
OUT = ROOT / "extension/art/winston-rig.svg"

svg = SRC.read_text()
defs = re.search(r"<defs>.*?</defs>", svg, re.S)
grad_inner = defs.group(0)[len("<defs>"):-len("</defs>")] if defs else ""
paths = re.findall(r"<path [^>]*?/>", svg)
assert len(paths) == 65, f"expected 65 paths, got {len(paths)}"

d_of = lambda i: re.search(r'd="([^"]*)"', paths[i]).group(1)

SPARE_LEGS = set(range(50, 60))   # the duplicate floating legs — deleted
NOSE = (415, 336, 145, 70)        # clip: keeps the nose off path 9, drops its mouth

# detached parts: (attach translate, pivot in POST-translate coords, members)
PARTS = {
    "cd-ear-l": ((58, 6),   (340, 160), (42, 43, 44)),  # 45 = stray white fleck, deleted
    "cd-ear-r": ((-58, 6),  (660, 160), (46, 47, 48, 49)),
    "cd-tail":  ((-40, -12), (752, 682), (60, 61, 62, 63, 64)),
}

def part(cls):
    (tx, ty), (px, py), members = PARTS[cls]
    inner = "".join(paths[i] for i in members)
    # attach translate first, then the pivot sandwich (engine rotates around local 0,0)
    return (f'<g transform="translate({px},{py})"><g class="{cls}">'
            f'<g transform="translate({tx - px},{ty - py})">{inner}</g></g></g>')

collar = lambda i: paths[i].replace("<path ", '<path class="cd-collar" ', 1)

body = [
    paths[0],                                             # silhouette: head+body+legs (self-contained)
    paths[1], paths[2], paths[5],                         # head + tan patches
    '<g class="cd-eyes-open">' + paths[3] + paths[6] +    # dark eye circles (static)
    '<g class="cd-pupils">'
        '<circle cx="376" cy="325" r="19" fill="#1C0803"/>'
        '<circle cx="609" cy="325" r="19" fill="#1C0803"/>'
    "</g>" + paths[4] + paths[7] +                        # shines STATIC, above the pupils
    eye_fx(376, 325, 42, "#5A3A22", "PupL") + eye_fx(609, 325, 42, "#5A3A22", "PupR") +   # life: rim light, gloss, 2nd catchlight
    "</g>",
    paths[8],                                             # muzzle band
    '<use href="#cdNM" class="cd-mouth-happy"/>',
    '<g class="cd-mouth-sad"><use href="#cdNM" clip-path="url(#cdNoseClip)"/>'
        '<path d="M446 447 Q487 415 528 447" fill="none" stroke="#5C2410" stroke-width="9" stroke-linecap="round"/></g>',
    '<g class="cd-mouth-open"><use href="#cdNM" clip-path="url(#cdNoseClip)"/>'
        '<ellipse cx="487" cy="437" rx="26" ry="24" fill="#5C2410"/>'
        '<ellipse cx="487" cy="448" rx="14" ry="11" fill="#E8837B"/></g>',
    paths[10],                                            # nose shine (rides every mouth)
    # lids sized to cover the eyes even at full gaze offset; fill matches the tan patches
    '<g class="cd-lids" opacity="0">'
        '<ellipse cx="376" cy="325" rx="62" ry="58" fill="#ECBA88"/>'
        '<ellipse cx="609" cy="325" rx="62" ry="58" fill="#ECBA88"/>'
        '<path d="M334 328 Q376 356 419 328" fill="none" stroke="#5C2410" stroke-width="9" stroke-linecap="round"/>'
        '<path d="M567 328 Q609 356 651 328" fill="none" stroke="#5C2410" stroke-width="9" stroke-linecap="round"/></g>',
    part("cd-tail"),                                      # behind the body: rump overlaps its base
    *(paths[i] for i in range(11, 38)),                   # body, legs, paws
    collar(38), collar(39),                               # collar halves (recolorable)
    paths[40].replace("<path ", '<path class="cd-collar-tag" ', 1),
    paths[41],
    part("cd-ear-l"),                                     # ears on the TOP layer — nothing
    part("cd-ear-r"),                                     #   clips them during swings
    '<g class="cd-zzz" font-family="Georgia, serif" font-weight="700" fill="#B08D5B">'
        '<text x="690" y="200" font-size="110">z</text><text x="765" y="130" font-size="80">z</text></g>',
]

OUT.write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
    + f'<defs>{grad_inner}'
    + f'<path id="cdNM" fill="#5C2410" d="{d_of(9)}"/>'
    + f'<clipPath id="cdNoseClip"><rect x="{NOSE[0]}" y="{NOSE[1]}" width="{NOSE[2]}" height="{NOSE[3]}"/></clipPath>'
    + "</defs>" + "".join(body) + "</svg>"
)
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
