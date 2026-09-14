// Collar styling engine — shared by the bench (docs/collar-bench.html) and,
// once the list is final, ported into pet.js applyEquipped. Given a mounted rig
// <svg> and a collar def, it recolors/patterns the .cd-collar band + tag and
// attaches the continuous effect. Event effects (jump motes, walk trails) are
// simulated in the bench with looping overlays.
const COLLAR_DEFS = [
  // common — flat, sold directly
  { id: "coral",  name: "Coral",  rarity: "common",   fill: "#CD5A4E" },
  { id: "sky",    name: "Sky",    rarity: "common",   fill: "#2B7ABC" },
  { id: "mint",   name: "Mint",   rarity: "common",   fill: "#2FA97E" },
  { id: "lilac",  name: "Lilac",  rarity: "common",   fill: "#9B7FD4" },
  { id: "slate",  name: "Slate",  rarity: "common",   fill: "#4A5163" },
  // uncommon — flat, box only
  { id: "sunset", name: "Sunset", rarity: "uncommon", fill: "#F08A3E" },
  { id: "forest", name: "Forest", rarity: "uncommon", fill: "#2E7D5B" },
  { id: "berry",  name: "Berry",  rarity: "uncommon", fill: "#B0306E" },
  { id: "denim",  name: "Denim",  rarity: "uncommon", fill: "#5B7FA6" },
  // rare — pattern or trim
  { id: "midnight", name: "Midnight", rarity: "rare", pattern: { kind: "specks", base: "#243B6B", ink: "#FFFFFF" } },
  { id: "rose",   name: "Rose",   rarity: "rare",     fill: "#C93A66", pattern: { kind: "roses", base: "#C93A66", ink: "#F7C6D0", width: 66 }, tag: "#F7C6D0", tagHeart: "#D9426F" },
  { id: "candy",  name: "Candy",  rarity: "rare",     pattern: { kind: "stripes", base: "#E23D3D", ink: "#FFFFFF" } },
  { id: "tiger",  name: "Tiger",  rarity: "rare",     pattern: { kind: "stripes", base: "#E8892B", ink: "#2B2B2B", width: 22 } },
  { id: "ocean",  name: "Ocean",  rarity: "rare",     gradient: ["#2AB3B1", "#2F6FD8"] },
  // epic — animated
  { id: "aurora", name: "Aurora", rarity: "epic",     gradient: ["#6ED3C8", "#8E7BFF", "#FF8BC8"], animate: "aurora", effect: "glow", glow: "#8E7BFF" },
  { id: "ember",  name: "Ember",  rarity: "epic",     gradient: ["#FF7A2F", "#C9301C"], effect: "glow", glow: "#FF7A2F", motes: "spark" },
  { id: "frost",  name: "Frost",  rarity: "epic",     gradient: ["#DFF4FF", "#7FC3F0"], effect: "glow", glow: "#BFE6FF", motes: "snow" },
  { id: "comet",  name: "Comet",  rarity: "epic",     gradient: ["#3D2A7A", "#6B4BC7"], effect: "glow", glow: "#8A73D9", glowScale: .55, motes: "trail", plus: true },
  // legendary
  { id: "scroll", name: "Scroll", rarity: "rare", fill: "#15120F", pattern: { kind: "scroll", base: "#15120F", ink: "#F0C24A", width: 48 }, tag: "#15120F", tagRim: "#F0C24A", launch: true }, // launch week only (2026-09), never in the box
  { id: "gold",   name: "Gold",   rarity: "legendary", gradient: ["#FFF1B0", "#FFC83D", "#E39A1F", "#FFE38A"], tag: "#FFD54A", effect: "aura", glow: "#FFC94A", halo: "#FFD75A", shimmer: true, shimmerFast: true, motes: "coin" },
];

function collarDefs(svg, def, uid) {
  let defs = svg.querySelector("defs");
  if (!defs) { defs = document.createElementNS("http://www.w3.org/2000/svg", "defs"); svg.insertBefore(defs, svg.firstChild); }
  let fill = def.fill;
  if (def.gradient) {
    const id = `cg-${def.id}-${uid}`;
    const stops = def.gradient.map((c, i) => `<stop offset="${(i / (def.gradient.length - 1)) * 100}%" stop-color="${c}" class="${def.animate ? "cg-anim s" + i : ""}"/>`).join("");
    defs.insertAdjacentHTML("beforeend", `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>`);
    fill = `url(#${id})`;
  }
  if (def.pattern) {
    const id = `cp-${def.id}-${uid}`, p = def.pattern, w = p.width ?? 26;
    // roses: a rosette (three nested petals) + two leaves per tile, offset on alternate rows
    const rose = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#F4A6BC"/><circle cx="${x}" cy="${y}" r="${r * .62}" fill="#E8789A"/><circle cx="${x - r * .12}" cy="${y - r * .1}" r="${r * .3}" fill="#FFD9E2"/>`
      + `<ellipse cx="${x - r * 1.05}" cy="${y + r * .55}" rx="${r * .55}" ry="${r * .28}" transform="rotate(-35 ${x - r * 1.05} ${y + r * .55})" fill="#6FAF6A"/>`
      + `<ellipse cx="${x + r * 1.0}" cy="${y + r * .6}" rx="${r * .55}" ry="${r * .28}" transform="rotate(35 ${x + r * 1.0} ${y + r * .6})" fill="#6FAF6A"/>`;
    const body = p.kind === "stripes"
      ? `<rect width="${w}" height="${w}" fill="${p.base}"/><rect width="${w / 2}" height="${w}" fill="${p.ink}"/>`
      : p.kind === "scroll"
      // a bold cloud-scroll: thick gold curls that read at pet size, on black
      ? `<rect width="${w}" height="${w}" fill="${p.base}"/><g fill="none" stroke="${p.ink}" stroke-width="${w * .13}" stroke-linecap="round" stroke-linejoin="round">`
        + `<path d="M${w * .06} ${w * .62} C ${w * .06} ${w * .3} ${w * .42} ${w * .22} ${w * .46} ${w * .5} C ${w * .48} ${w * .66} ${w * .3} ${w * .68} ${w * .28} ${w * .54}"/>`
        + `<path d="M${w * .94} ${w * .38} C ${w * .94} ${w * .7} ${w * .58} ${w * .78} ${w * .54} ${w * .5} C ${w * .52} ${w * .34} ${w * .7} ${w * .32} ${w * .72} ${w * .46}"/>`
        + `</g><circle cx="${w * .5}" cy="${w * .1}" r="${w * .06}" fill="${p.ink}"/><circle cx="${w * .5}" cy="${w * .9}" r="${w * .06}" fill="${p.ink}"/>`
      : p.kind === "roses"
      ? `<rect width="${w}" height="${w}" fill="${p.base}"/>${rose(w * .5, w * .5, w * .3)}`   // one big rosette per tile — reads at pet size
      : `<rect width="${w}" height="${w}" fill="${p.base}"/><circle cx="6" cy="7" r="1.6" fill="${p.ink}"/><circle cx="18" cy="15" r="1.2" fill="${p.ink}"/><circle cx="11" cy="21" r="1" fill="${p.ink}"/><circle cx="22" cy="4" r="1" fill="${p.ink}"/>`;
    // the standalone glyph (64-unit viewBox) is ~1:1 while rigs are ~1024 units: scale the tile so the motif
    // repeats across the band the same way on a wardrobe card as on the pet
    const k = (svg.getAttribute("viewBox") || "").startsWith("0 0 64") ? 0.12 : 1;
    defs.insertAdjacentHTML("beforeend", `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${w}" patternTransform="scale(${k}) rotate(${p.kind === "stripes" ? 25 : 0})">${body}</pattern>`);
    fill = `url(#${id})`;
  }
  return fill;
}

// a lighter tone of a hex color (for pendants: same family as the band, one step up)
function lighten(hex, k = 0.35) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(c + (255 - c) * k).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}
function tagColorFor(def) {
  if (def.tag) return def.tag;
  if (def.rarity === "common") return null;               // commons keep the art's own pendant
  const base = def.fill ?? def.pattern?.base ?? def.gradient?.[0];
  return base ? lighten(base) : null;
}

// a collar on its own — band + pendant — for cards and shelves. Same classes as the
// rigs, so applyCollarDef dresses it exactly like it dresses the pet.
function collarGlyph(size = 56) {
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="overflow:visible">
    <defs></defs>
    <path class="cd-collar" d="M8 28 C8 12 56 12 56 28 C56 38 44 42 32 42 C20 42 8 38 8 28 Z M32 39 C42 39 52 36 52 28 C52 16 12 16 12 28 C12 36 22 39 32 39 Z" fill="#CD5A4E" stroke="#3B3644" stroke-width="2.5" stroke-linejoin="round"/>
    <circle class="cd-collar-tag" cx="32" cy="47" r="7" fill="#CDD1DA" stroke="#3B3644" stroke-width="2.2"/>
  </svg>`;
}

function applyCollarDef(svg, def, uid = Math.random().toString(36).slice(2, 7)) {
  svg.querySelectorAll(".cd-collar-shine, .cd-collar-halo, .cd-collar-heart").forEach((el) => el.remove());
  const fill = collarDefs(svg, def, uid);
  const collars = [...svg.querySelectorAll(".cd-collar")];
  collars.forEach((el) => el.setAttribute("fill", fill));
  const tag = tagColorFor(def);
  const glyph = (svg.getAttribute("viewBox") || "").startsWith("0 0 64");
  svg.querySelectorAll(".cd-collar-tag").forEach((el) => {
    if (tag) el.setAttribute("fill", tag);
    // a rimmed pendant (Scroll: black with a gold rim) — stroke scales with the drawing (glyph ≈ 1:1, rigs ≈ 1024 units)
    if (def.tagRim) { el.setAttribute("stroke", def.tagRim); el.setAttribute("stroke-width", glyph ? "2.4" : "14"); el.setAttribute("paint-order", "stroke"); }
    else if (el.dataset.rimmed) { el.removeAttribute("stroke"); el.removeAttribute("stroke-width"); el.removeAttribute("paint-order"); }
    el.dataset.rimmed = def.tagRim ? "1" : "";
  });
  svg.classList.remove("fx-glow", "fx-aura", "fx-shimmer", "fx-fast");
  svg.style.setProperty("--glow", def.glow ?? "transparent");
  svg.style.setProperty("--gs", String(def.glowScale ?? 1));
  if (def.halo && collars.length) {
    // a soft light behind the collar — only the legendary gets one
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    collars.forEach((c) => { const b = c.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
    const id = `ch-${def.id}-${uid}`;
    svg.querySelector("defs").insertAdjacentHTML("beforeend", `<radialGradient id="${id}"><stop offset="0" stop-color="${def.halo}" stop-opacity=".75"/><stop offset=".55" stop-color="${def.halo}" stop-opacity=".22"/><stop offset="1" stop-color="${def.halo}" stop-opacity="0"/></radialGradient>`);
    const halo = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    halo.setAttribute("cx", (x0 + x1) / 2); halo.setAttribute("cy", (y0 + y1) / 2 + (y1 - y0) * .15);
    halo.setAttribute("rx", (x1 - x0) * .9); halo.setAttribute("ry", (y1 - y0) * 1.9);
    halo.setAttribute("fill", `url(#${id})`); halo.setAttribute("class", "cd-collar-halo");
    collars[0].parentNode.insertBefore(halo, collars[0]);
  }
  if (def.shimmerFast) svg.classList.add("fx-fast");
  if (def.effect === "glow") svg.classList.add("fx-glow");
  if (def.effect === "aura") svg.classList.add("fx-aura");
  if (def.shimmer) {
    // a light bar sweeps the band: clip = copies of the collar paths
    if (collars.length) {
      const id = `cs-${def.id}-${uid}`;
      const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath"); clip.id = id;
      collars.forEach((c) => { const n = c.cloneNode(false); n.removeAttribute("class"); n.removeAttribute("fill"); clip.appendChild(n); });
      svg.querySelector("defs").appendChild(clip);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      collars.forEach((c) => { const b = c.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
      const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bar.setAttribute("x", x0 - 60); bar.setAttribute("y", y0 - 20); bar.setAttribute("width", 46); bar.setAttribute("height", y1 - y0 + 40);
      bar.setAttribute("fill", "#fff"); bar.setAttribute("opacity", ".6"); bar.setAttribute("clip-path", `url(#${id})`);
      bar.setAttribute("class", "cd-collar-shine"); bar.style.setProperty("--sweep", `${x1 - x0 + 140}px`);
      collars[collars.length - 1].parentNode.insertBefore(bar, collars[collars.length - 1].nextSibling);
      svg.classList.add("fx-shimmer");
    }
  }
  if (def.tagHeart) {
    const tag = svg.querySelector(".cd-collar-tag");
    if (tag) { const b = tag.getBBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2, s = b.width / 2.6;
      tag.insertAdjacentHTML("afterend", `<path class="cd-collar-heart" d="M${cx} ${cy + s * .9} C${cx - s * 1.2} ${cy} ${cx - s * .9} ${cy - s * .9} ${cx} ${cy - s * .3} C${cx + s * .9} ${cy - s * .9} ${cx + s * 1.2} ${cy} ${cx} ${cy + s * .9} Z" fill="${def.tagHeart}"/>`); }
  }
}

// ── ambient particles for the top tiers (gamewide, 2026-09-05): one system, two hosts.
// coin (Gold): small $ coins drift up around the body and fade — sparse, slow.
// spark (Ember): quick orange embers rising. snow (Frost): flakes falling past him.
// trail (Comet): purple motes left behind while he moves. Aurora has no particles — the
// shifting band is its effect. `collarMoteLoop` returns a stop() — call it on re-equip.
const COLLAR_MOTES = {
  coin:  { every: 1100, kind: "coin" },
  spark: { every: 650,  kind: "spark" },
  snow:  { every: 520,  kind: "snow" },
  trail: { every: 140,  kind: "trail", onlyMoving: true },
};
function spawnCollarMote(kind, host, x, y, dir = 1, fixed = false) {
  const m = document.createElement("i");
  m.className = `cd-cmote ${kind}`;
  m.style.cssText = `position:${fixed ? "fixed" : "absolute"}; left:${x}px; top:${y}px; --sway:${(-8 + Math.random() * 16).toFixed(1)}px; --dir:${dir};`;
  if (kind === "coin") m.textContent = "$";
  if (kind === "snow") m.textContent = "❄";
  host.appendChild(m);
  setTimeout(() => m.remove(), 5200);
}
// anchor(): { x, y, w, h, dir, moving } — the pet's box in the host's coordinates
function collarMoteLoop(def, host, anchor, fixed = false) {
  const spec = COLLAR_MOTES[def?.motes];
  if (!spec) return () => {};
  const t = setInterval(() => {
    if (document.hidden) return;
    const a = anchor(); if (!a) return;
    if (spec.onlyMoving && !a.moving) return;
    let x, y;
    if (spec.kind === "snow") { x = a.x + Math.random() * a.w; y = a.y - 12; }
    else if (spec.kind === "trail") { x = a.x + (a.dir === 1 ? a.w * .15 : a.w * .85); y = a.y + a.h * (.55 + Math.random() * .3); }
    else { x = a.x + a.w * (.15 + Math.random() * .7); y = a.y + a.h * (.2 + Math.random() * .6); }
    spawnCollarMote(spec.kind, host, x, y, a.dir, fixed);
  }, spec.every);
  return () => clearInterval(t);
}

const COLLAR_FX_CSS = `
  .cd-cmote { pointer-events: none; z-index: 2147483647; width: 9px; height: 9px; border-radius: 50%; opacity: 0; will-change: transform, opacity; }
  .cd-cmote.coin { background: radial-gradient(circle at 38% 32%, #FFE99A, #F6C13C 55%, #D68F17); box-shadow: 0 0 0 1.2px #B8760F, 0 0 5px 1px rgba(255,205,80,.45);
    font: 800 7px/9px "Baloo 2", sans-serif; color: #8A5200; text-align: center; animation: cd-cm-coin 4.6s ease-in-out forwards; }
  .cd-cmote.spark { width: 6px; height: 6px; background: #FFB25A; box-shadow: 0 0 5px 1px rgba(255,120,40,.7); animation: cd-cm-rise 1.9s ease-out forwards; }
  .cd-cmote.snow { width: auto; height: auto; background: none; color: #fff; font: 700 11px/1 sans-serif; text-shadow: 0 0 3px rgba(120,190,255,.9); animation: cd-cm-snow 3.2s linear forwards; }
  .cd-cmote.trail { width: 7px; height: 7px; background: #B79BFF; box-shadow: 0 0 5px 1px rgba(160,120,255,.7); animation: cd-cm-trail 1.3s linear forwards; }
  @keyframes cd-cm-coin { 0% { opacity: 0; transform: translate(0,4px) } 20% { opacity: .7 } 75% { opacity: .55 } 100% { opacity: 0; transform: translate(var(--sway), -30px) } }
  @keyframes cd-cm-rise { 0% { opacity: 0; transform: translate(0,0) scale(.6) } 20% { opacity: 1 } 100% { opacity: 0; transform: translate(var(--sway), -44px) scale(0) } }
  @keyframes cd-cm-snow { 0% { opacity: 0; transform: translate(0,0) rotate(0) } 15% { opacity: .95 } 100% { opacity: 0; transform: translate(calc(var(--sway) + 8px), 58px) rotate(160deg) } }
  @keyframes cd-cm-trail { 0% { opacity: .9; transform: translate(0,0) scale(1) } 100% { opacity: 0; transform: translate(calc(-36px * var(--dir)), 10px) scale(.2) } }
  /* blur radii are in the element's user units: inside a rig's ~0.1-scale group 60 ≈ 6 screen px, so
     rigs use --u:1 and the standalone collar glyph (1:1) sets --u:.1. --gs scales a collar's glow. */
  svg { --u: 1; }
  @keyframes cd-glowpulse { 0%,100% { filter: drop-shadow(0 0 calc(12px * var(--gs) * var(--u)) var(--glow)) drop-shadow(0 0 calc(36px * var(--gs) * var(--u)) var(--glow)) } 50% { filter: drop-shadow(0 0 calc(20px * var(--gs) * var(--u)) var(--glow)) drop-shadow(0 0 calc(64px * var(--gs) * var(--u)) var(--glow)) } }
  @keyframes cd-aurapulse { 0%,100% { filter: drop-shadow(0 0 calc(24px * var(--u)) var(--glow)) drop-shadow(0 0 calc(90px * var(--u)) var(--glow)) drop-shadow(0 0 calc(190px * var(--u)) var(--glow)) } 50% { filter: drop-shadow(0 0 calc(40px * var(--u)) var(--glow)) drop-shadow(0 0 calc(140px * var(--u)) var(--glow)) drop-shadow(0 0 calc(300px * var(--u)) var(--glow)) } }
  @keyframes cd-halopulse { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: .95; transform: scale(1.12) } }
  .fx-glow .cd-collar, .fx-glow .cd-collar-tag { animation: cd-glowpulse 2.6s ease-in-out infinite; }
  .fx-aura .cd-collar, .fx-aura .cd-collar-tag { animation: cd-aurapulse 2.2s ease-in-out infinite; }
  .fx-aura .cd-collar-halo { transform-box: fill-box; transform-origin: center; animation: cd-halopulse 2.2s ease-in-out infinite; }
  @keyframes cd-collar-sweep { 0%, 60% { transform: translateX(0) skewX(-18deg) } 100% { transform: translateX(var(--sweep)) skewX(-18deg) } }
  .fx-shimmer .cd-collar-shine { animation: cd-collar-sweep 2.8s cubic-bezier(.4,0,.3,1) infinite; }
  .fx-shimmer.fx-fast .cd-collar-shine { animation-duration: 1.6s; }
  @keyframes cd-aurora0 { 0%,100% { stop-color: #6ED3C8 } 33% { stop-color: #8E7BFF } 66% { stop-color: #FF8BC8 } }
  @keyframes cd-aurora1 { 0%,100% { stop-color: #8E7BFF } 33% { stop-color: #FF8BC8 } 66% { stop-color: #6ED3C8 } }
  @keyframes cd-aurora2 { 0%,100% { stop-color: #FF8BC8 } 33% { stop-color: #6ED3C8 } 66% { stop-color: #8E7BFF } }
  .cg-anim.s0 { animation: cd-aurora0 6s linear infinite } .cg-anim.s1 { animation: cd-aurora1 6s linear infinite } .cg-anim.s2 { animation: cd-aurora2 6s linear infinite }
`;
