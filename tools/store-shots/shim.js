// Fake just enough of the extension platform for popup.html to render in a normal tab (store screenshots).
(() => {
  const q = new URLSearchParams(location.search); const state = q.get("state") || "home";
  const econ = { balance: 340, lifetime: 1210, paid: {}, milestones_paid: {}, reports_paid: {},
    owned: ["collar_coral","collar_sky","collar_mint","collar_sunset","collar_forest","collar_midnight","collar_rose","collar_aurora","collar_gold","animal_pup","animal_cat"],
    equipped: { collar: "gold", animal: "pup" }, names: { animal_pup: "Winston", animal_cat: "Mochi" },
    free_boxes: 0, first_box: 0, adopted: 1, welcome_claimed: 1, milestones_pending: [], day: "", day_counts: {} };
  if (state === "shop") econ.owned = econ.owned.filter((k) => k !== "animal_cat"); // the kitten is for sale in the shop shot
  const S = { device_id: "storeshot0000000000000000000000", cd_econ: econ, pet_name: "Winston",
    cd_streak_display: { n: 23, displayN: 23, state: "extended", high: 41, date: "2026-09-06", broke: false, at: Date.now() },
    pet_state: { mood: "content", x: 64, y: 0 }, cd_treats: { plain: 4, rare: 1 }, tour_done: true, tour_started: true,
    reports: [], extra_hosts: [], ledger_queue: [] };
  const listeners = [];
  const get = (keys) => { const out = {}; const ks = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || S); for (const k of ks) if (k in S) out[k] = structuredClone(S[k]); return Promise.resolve(out); };
  window.chrome = {
    storage: { local: { get, set: (o) => { Object.assign(S, structuredClone(o)); return Promise.resolve(); }, remove: (k) => { for (const x of [].concat(k)) delete S[x]; return Promise.resolve(); } },
      onChanged: { addListener: (f) => listeners.push(f) } },
    runtime: { getURL: (p) => p, getManifest: () => ({ version: "1.0.1" }) },
    tabs: { query: () => Promise.resolve([]) },
    permissions: { contains: () => Promise.resolve(false), request: () => Promise.resolve(false) },
    scripting: { getRegisteredContentScripts: () => Promise.resolve([]), registerContentScripts: () => Promise.resolve() },
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = (u, o) => (String(u).includes("railway.app") ? Promise.reject(new Error("offline for the shot")) : realFetch(u, o));
  window.addEventListener("load", () => setTimeout(() => {
    if (window.countUp) window.countUp = (el, n) => { el.textContent = String(n); }; // no animated numbers in a still
    if (state === "shop") document.getElementById("openShop").click();
    if (state === "wardrobe") document.getElementById("openWardrobe").click();
    if (state === "claim") { window.requestAnimationFrame = () => 0; showStreakReward(100, [{ kind: "milestone", days: 25, coins: 100 }]); setTimeout(() => { document.getElementById("srAmount").textContent = "+100"; document.querySelectorAll("#streakReward, #streakReward *").forEach((el) => { el.style.animationDelay = "0s"; el.style.animationDuration = "0.01s"; el.style.animationFillMode = "forwards"; }); }, 800); }
    document.documentElement.dataset.shot = state;
    // count-ups run on real timers; pin the balance so the shot never catches a number mid-flight
    setTimeout(() => { for (const id of ["coins", "coins2", "coins3"]) { const el = document.getElementById(id); if (el) el.textContent = String(econ.balance); } }, 2500);
  }, 400));
})();
