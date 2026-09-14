"""Shared rig touches. eye_fx: the life in the eyes — a small secondary catchlight lower-right,
a soft rim light along the bottom of the iris, and a faint gloss over the top. The art's own primary shine stays.
Drawn inside .cd-eyes-open (so the lids still cover them). uid keeps gradient ids unique per species."""
def eye_fx(cx, cy, r, rim, uid, gloss=.26, rim_op=.55, rim_w=.14):
    return (f'<clipPath id="cdEyeLower{uid}"><rect x="{cx - r}" y="{cy}" width="{2 * r}" height="{r}"/></clipPath>'
            f'<radialGradient id="cdEyeGloss{uid}" cx="50%" cy="30%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="{gloss}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.78:.1f}" fill="none" stroke="{rim}" stroke-width="{r * rim_w:.1f}" opacity="{rim_op}" clip-path="url(#cdEyeLower{uid})"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.98:.1f}" fill="url(#cdEyeGloss{uid})"/>'
            f'<circle cx="{cx + r * 0.42:.1f}" cy="{cy + r * 0.38:.1f}" r="{r * 0.13:.1f}" fill="#FFFFFF" opacity=".95"/>')
