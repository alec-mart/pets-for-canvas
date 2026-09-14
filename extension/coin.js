// The coin: one glyph and one "+N" moment, shared by the page and the popup.
// Top-level consts are shared across content scripts (one isolated world).

// ids are unique per instance: url(#id) resolves to the first match in the document, and a
// copy inside a hidden view would make the gradient/clip fail
let cdCoinN = 0;
const CD_COIN_SVG = (size = 24, cls = "") => { const u = `c${++cdCoinN}`; return `
<svg class="cd-coin ${cls}" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" style="vertical-align:-0.18em;overflow:visible">
  <defs>
    <radialGradient id="cdCoinG-${u}" cx="38%" cy="30%" r="78%">
      <stop offset="0" stop-color="#FFE99A"/><stop offset=".5" stop-color="#F6C13C"/><stop offset="1" stop-color="#D68F17"/>
    </radialGradient>
    <clipPath id="cdCoinClip-${u}"><circle cx="16" cy="16" r="14"/></clipPath>
  </defs>
  <circle cx="16" cy="17.6" r="14" fill="#A8680C"/>
  <circle cx="16" cy="16" r="14" fill="url(#cdCoinG-${u})" stroke="#C4841A" stroke-width="1.1"/>
  <circle cx="16" cy="16.7" r="10.4" fill="none" stroke="#B9770F" stroke-width="1" opacity=".55"/>
  <circle cx="16" cy="16" r="10.4" fill="none" stroke="#FFF0BC" stroke-width="1.3" opacity=".95"/>
  <g fill="#B5720E">
    <ellipse cx="16" cy="18.9" rx="4.1" ry="3.3"/>
    <circle cx="11.3" cy="15" r="1.75"/><circle cx="14.2" cy="12.4" r="1.75"/>
    <circle cx="17.8" cy="12.4" r="1.75"/><circle cx="20.7" cy="15" r="1.75"/>
  </g>
  <ellipse cx="10.6" cy="9.4" rx="3.4" ry="1.8" fill="#fff" opacity=".6" transform="rotate(-32 10.6 9.4)"/>
  <g clip-path="url(#cdCoinClip-${u})"><rect class="cd-coin-shine" x="-6" y="-2" width="6" height="36" fill="#fff" opacity="0"/></g>
</svg>`; };

// ── the "+N" moment on the Canvas page ──
(() => {
  if (typeof document === "undefined" || !document.body || location.protocol === "chrome-extension:") return;

  let styled = false;
  function ensureStyle() {
    if (styled) return;
    styled = true;
    const st = document.createElement("style");
    st.id = "cd-coin-style";
    let font = "";
    try { font = `@font-face { font-family: "Baloo 2"; src: url("${chrome.runtime.getURL("fonts/baloo2.woff2")}") format("woff2"); font-weight: 400 800; }`; } catch {}
    st.textContent = `
      ${font}
      @keyframes cd-coin-in { 0% { transform: scale(.2) rotate(-25deg); opacity: 0 } 55% { transform: scale(1.28) rotate(6deg); opacity: 1 } 78% { transform: scale(.94) } 100% { transform: scale(1) } }
      @keyframes cd-coin-rise { 0%,38% { transform: translateY(0); opacity: 1 } 100% { transform: translateY(-54px); opacity: 0 } }
      @keyframes cd-coin-shine { 0% { transform: translateX(0) skewX(-22deg) } 100% { transform: translateX(46px) skewX(-22deg) } }
      @keyframes cd-coin-text { 0% { transform: translateX(-6px) scale(.6); opacity: 0 } 60% { transform: translateX(0) scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
      @keyframes cd-coin-spark { 0% { transform: translate(0,0) scale(.4); opacity: 0 } 25% { opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0 } }
      .cd-coin-pop { position: fixed; z-index: 2147483647; pointer-events: none; display: flex; align-items: center; gap: 5px;
        will-change: transform, opacity; animation: cd-coin-rise 1.35s cubic-bezier(.2,.6,.3,1) forwards; }
      .cd-coin-pop .cd-coin { animation: cd-coin-in .42s cubic-bezier(.34,1.56,.64,1) both; filter: drop-shadow(0 2px 2px rgba(120,70,0,.35)); }
      .cd-coin-pop .cd-coin-shine { opacity: .55; animation: cd-coin-shine .55s ease-out .28s both; }
      .cd-coin-pop .cd-coin-n { font: 800 22px/1 "Baloo 2", -apple-system, "Segoe UI", sans-serif; color: #FFD75A;
        -webkit-text-stroke: 1.2px #9A5C05; paint-order: stroke fill; text-shadow: 0 2px 0 #9A5C05, 0 3px 6px rgba(0,0,0,.3);
        animation: cd-coin-text .38s cubic-bezier(.34,1.56,.64,1) .07s both; letter-spacing: .01em; }
      .cd-coin-pop.big .cd-coin-n { font-size: 30px; }
      .cd-coin-spark { position: absolute; left: 50%; top: 50%; width: 7px; height: 7px; border-radius: 50%; background: #FFE27A;
        box-shadow: 0 0 6px 1px rgba(255,205,80,.8); animation: cd-coin-spark .7s ease-out both; }
    `;
    document.documentElement.appendChild(st);
  }

  function fallbackPoint() {
    // no click to anchor to (milestones, retro credit): the pet is the natural place
    const pet = document.getElementById("cd-pet");
    if (pet) { const r = pet.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top - 8 }; }
    return { x: window.innerWidth - 80, y: 70 };
  }

  // pts: number; at: {x,y} client coords or null
  function coinPop(pts, at) {
    if (!pts || document.hidden) return;
    ensureStyle();
    const p = at && Number.isFinite(at.x) ? at : fallbackPoint();
    const big = pts >= 50;
    const size = big ? 40 : 28;
    const el = document.createElement("div");
    el.className = "cd-coin-pop" + (big ? " big" : "");
    el.style.left = `${Math.min(Math.max(p.x - size / 2, 8), window.innerWidth - 120)}px`;
    el.style.top = `${Math.min(Math.max(p.y - size / 2 - 6, 8), window.innerHeight - 60)}px`;
    el.innerHTML = `${CD_COIN_SVG(size)}<span class="cd-coin-n">+${big ? 0 : pts}</span>`;
    const sparks = big ? 12 : 6;
    for (let i = 0; i < sparks; i++) {
      const s = document.createElement("i");
      s.className = "cd-coin-spark";
      const a = (i / sparks) * Math.PI * 2 + Math.random() * 0.6, d = (big ? 34 : 22) + Math.random() * 14;
      s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
      s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
      s.style.animationDelay = `${0.12 + Math.random() * 0.1}s`;
      el.appendChild(s);
    }
    document.body.appendChild(el);
    if (big) {
      // the number is the show: count it up
      const n = el.querySelector(".cd-coin-n"), t0 = performance.now(), dur = 750;
      const tick = (now) => {
        const k = Math.min((now - t0) / dur, 1);
        n.textContent = `+${Math.round(pts * (1 - Math.pow(1 - k, 3)))}`;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    setTimeout(() => el.remove(), 1500);
  }

  // the economy announces every payout; this is the only renderer of it
  document.addEventListener("cd-points", (e) => {
    const d = e.detail ?? {};
    coinPop(d.pts, d.at ?? null);
  });
})();
