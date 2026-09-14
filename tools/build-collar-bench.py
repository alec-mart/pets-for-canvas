#!/usr/bin/env python3
"""Generate docs/collar-bench.html — every collar on both rigs, self-contained
(rigs + engine inlined so it opens from file:// with no fetch)."""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
rig = lambda f: re.sub(r"^<svg[^>]*>", "", (ROOT / "extension/art" / f).read_text()).replace("</svg>", "")
engine = (ROOT / "docs/collar-engine.js").read_text()
pet = (ROOT / "extension/pet.js").read_text()
sp = dict(re.findall(r'(\w+): \{ art: "[^"]+", transform: "([^"]+)"', pet))
html = f'''<!doctype html><meta charset="utf-8"><title>collar bench</title>
<style>
  body{{margin:0;background:#F3F6FB;font:700 12px system-ui;color:#333B49;padding:16px}}
  h1{{font:800 18px system-ui;margin:0 0 10px}} .bar{{display:flex;gap:10px;align-items:center;margin-bottom:12px}}
  button{{font:800 12px system-ui;padding:6px 12px;border-radius:10px;border:1px solid #DDE3EE;background:#fff;cursor:pointer}} button.on{{background:#5B8DEF;color:#fff;border-color:#3E6CCB}}
  .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}}
  .cell{{background:#fff;border:1px solid #DDE3EE;border-radius:14px;padding:8px 8px 10px;text-align:center;position:relative;overflow:hidden}}
  .stage{{position:relative;height:130px;background:radial-gradient(120% 100% at 50% 0%,#C7DCFB,#E6EEFB 60%,#F3F6FB);border-radius:10px}}
  .stage svg{{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);width:118px;height:118px;overflow:visible}}
  .name{{margin-top:6px;font-size:13px}} .rc{{display:inline-block;margin-top:3px;padding:1px 7px;border-radius:8px;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#fff}}
  .rc-common{{background:#9AA6BC}} .rc-uncommon{{background:#5CB683}} .rc-rare{{background:#5A8FE6}} .rc-epic{{background:#9B6BE0}} .rc-legendary{{background:#E39A1F}}
  .plus{{position:absolute;top:8px;right:8px;font-size:9px;background:#3B3644;color:#fff;border-radius:6px;padding:2px 6px}}
  .cd-mouth-sad,.cd-mouth-open,.cd-zzz{{opacity:0}}
  /* bench-only event overlays: motes/glints/trails that the engine emits on jump/walk */
  .mote{{position:absolute;width:6px;height:6px;border-radius:50%;pointer-events:none;left:50%;bottom:58px;opacity:0}}
  .mote.gold{{background:#FFD75A;box-shadow:0 0 6px 1px rgba(255,205,80,.8);animation:rise 2.4s ease-out infinite}}
  .mote.spark{{background:#FFB25A;box-shadow:0 0 5px 1px rgba(255,120,40,.7);animation:rise 2s ease-out infinite}}
  .mote.glint{{width:8px;height:8px;background:#fff;clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);animation:twinkle 2.2s ease-in-out infinite}}
  .mote.trail{{background:#B79BFF;box-shadow:0 0 5px 1px rgba(160,120,255,.7);animation:trail 1.6s linear infinite}}
  .mote.snow{{width:auto;height:auto;background:none;color:#fff;font-size:11px;line-height:1;text-shadow:0 0 3px rgba(120,190,255,.9);animation:snow 3.2s linear infinite}}
  .mote.snow::before{{content:"❄"}}
  /* legendary aura: a few small coins drift up around him and fade — sparse, slow, not a fountain */
  .mote.coin{{width:9px;height:9px;bottom:auto;top:var(--top);left:var(--left);background:radial-gradient(circle at 38% 32%,#FFE99A,#F6C13C 55%,#D68F17);box-shadow:0 0 0 1.2px #B8760F,0 0 5px 1px rgba(255,205,80,.45);animation:coinaura 4.6s ease-in-out infinite;font:800 7px/9px "Baloo 2",sans-serif;color:#8A5200;text-align:center}}
  .mote.coin::before{{content:"$"}}
  @keyframes snow{{0%{{opacity:0;transform:translate(var(--dx),-40px) rotate(0)}}15%{{opacity:.95}}100%{{opacity:0;transform:translate(calc(var(--dx) + 10px),18px) rotate(160deg)}}}}
  @keyframes coinaura{{0%{{opacity:0;transform:translate(0,4px)}}20%{{opacity:.7}}75%{{opacity:.55}}100%{{opacity:0;transform:translate(var(--sway),-30px)}}}}
  @keyframes rise{{0%{{opacity:0;transform:translate(var(--dx),0) scale(.6)}}20%{{opacity:1}}100%{{opacity:0;transform:translate(calc(var(--dx)*1.6),-46px) scale(0)}}}}
  @keyframes twinkle{{0%,100%{{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.4)}}50%{{opacity:1;transform:translate(var(--dx),var(--dy)) scale(1)}}}}
  @keyframes trail{{0%{{opacity:.9;transform:translate(var(--dx),var(--dy)) scale(1)}}100%{{opacity:0;transform:translate(calc(var(--dx) - 40px),calc(var(--dy) + 10px)) scale(.2)}}}}
</style>
<h1>Collar bench</h1>
<div class="bar"><button id="bPup" class="on">Winston</button><button id="bCat">Cat</button><span style="color:#8792A3">art placeholder — patterns/effects are the engine's real treatment</span></div>
<div class="grid" id="grid"></div>
<template id="rigPup"><svg viewBox="0 0 100 100"><g transform="{sp["pup"]}">{rig("winston-rig.svg")}</g></svg></template>
<template id="rigCat"><svg viewBox="0 0 100 100"><g transform="{sp["cat"]}">{rig("cat-rig.svg")}</g></svg></template>
<script>
{engine}
const st = document.createElement("style"); st.textContent = COLLAR_FX_CSS; document.head.appendChild(st);
const MOTES = {{ gold: 5, spark: 4, glint: 4, trail: 5, snow: 6, coin: 5 }};
function build(which) {{
  const grid = document.getElementById("grid"); grid.innerHTML = "";
  COLLAR_DEFS.forEach((d, i) => {{
    const cell = document.createElement("div"); cell.className = "cell";
    cell.innerHTML = `<div class="stage"></div><div class="name">${{d.name}}</div><span class="rc rc-${{d.rarity}}">${{d.rarity}}</span>${{d.plus ? '<span class="plus">PLUS</span>' : ""}}`;
    const stage = cell.querySelector(".stage");
    stage.appendChild(document.getElementById(which === "cat" ? "rigCat" : "rigPup").content.cloneNode(true));
    const svg = stage.querySelector("svg");
    grid.appendChild(cell);
    applyCollarDef(svg, d, i);
    if (d.motes) for (let k = 0; k < MOTES[d.motes]; k++) {{ const m = document.createElement("i"); m.className = "mote " + d.motes;
      m.style.setProperty("--dx", `${{-24 + Math.random() * 48}}px`); m.style.setProperty("--dy", `${{-20 + Math.random() * 30}}px`);
      // aura coins: scattered around the body, not the collar
      m.style.setProperty("--left", `${{24 + Math.random() * 52}}%`); m.style.setProperty("--top", `${{18 + Math.random() * 56}}%`); m.style.setProperty("--sway", `${{-8 + Math.random() * 16}}px`);
      m.style.animationDelay = `${{(k / MOTES[d.motes]) * (d.motes === "coin" ? 4.2 : 2)}}s`; stage.appendChild(m); }}
  }});
}}
document.getElementById("bPup").onclick = () => {{ build("pup"); bPup.classList.add("on"); bCat.classList.remove("on"); }};
document.getElementById("bCat").onclick = () => {{ build("cat"); bCat.classList.add("on"); bPup.classList.remove("on"); }};
build("pup");
</script>'''
out = ROOT / "docs/collar-bench.html"; out.write_text(html); print("wrote", out, out.stat().st_size)
