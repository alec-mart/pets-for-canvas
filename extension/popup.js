const DEV = true; // the store build sets this false; gates every test helper
const MILESTONES = [7, 10, 25, 30, 50, 75, 100, 150, 200, 365];
const MILESTONE_POINTS = { 7: 15, 10: 25, 25: 100, 30: 120, 50: 300, 75: 500, 100: 1000, 150: 1500, 200: 2000, 365: 4000 };
// mood: [text color, tint bg]
const MOOD_STYLE = {
  content: ["#1F8A66", "rgba(47,169,126,.13)"],
  sad: ["#4A6DB0", "rgba(91,127,192,.15)"],
  hungry: ["#C1701F", "rgba(232,147,90,.18)"],
  sleeping: ["#6F63B8", "rgba(139,126,200,.16)"],
  waiting: ["#3D6BC6", "rgba(91,141,239,.12)"],
  new: ["#3D6BC6", "rgba(91,141,239,.12)"],
};
const MOODS = {
  content: ["😊", "feeling good"],
  sad: ["😔", "feeling sad"],
  hungry: ["🥺", "missing you"],
  sleeping: ["😴", "asleep"],
  waiting: ["👀", ""],
  new: ["🐾", ""],
};

// starts from the displayed value, so repeated renders never restart the count
function countUp(el, target, ms = 700) {
  const from = parseInt(el.textContent.replace(/\D/g, ""), 10) || 0;
  if (from === target) return;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / ms, 1);
    el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- rig ----
// pet.js is the source of truth: the rig markup and SPECIES table are parsed out of its source
let petSrc = null;
async function getPetSrc() {
  return petSrc ?? (petSrc = await (await fetch(chrome.runtime.getURL("pet.js"))).text());
}
async function speciesTable() {
  const src = await getPetSrc();
  const out = {};
  const re = /^\s*(\w+): \{ art: "([^"]+)", transform: "([^"]+)", scale: ([\d.]+), idles: "([^"]+)", ready: (true|false) \},?$/gm;
  for (const m of src.matchAll(re)) out[m[1]] = { art: m[2], transform: m[3], scale: +m[4], idles: m[5].split(","), ready: m[6] === "true" };
  return out;
}
const rigCache = {};
async function getRig(species = "pup") {
  if (rigCache[species]) return rigCache[species];
  const src = await getPetSrc();
  const m = src.match(/wrap\.innerHTML = `([\s\S]*?)`;\s*return wrap;/);
  const sp = (await speciesTable())[species] ?? (await speciesTable()).pup;
  let art = null;
  if (sp) {
    try {
      const txt = await (await fetch(chrome.runtime.getURL(sp.art))).text();
      art = `<g transform="${sp.transform}">` + txt.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "") + "</g>";
    } catch {}
  }
  rigCache[species] = { html: m ? m[1].replaceAll("${SIZE}", "108") : null, idles: sp?.idles ?? ["sit", "look", "stretch"], art };
  return rigCache[species];
}

const IDLE_MS = { sit: 5000, look: 3400, earflick: 1300, sniff: 2400, stretch: 2300, yawn: 2400, wagburst: 1800, shake: 1500, tailchase: 2900 };

async function mountPet(stageId, size = 108, species = "pup") {
  const rig = await getRig(species);
  if (!rig.html) return null;
  const stage = document.getElementById(stageId);
  // same species already mounted: keep the DOM and refresh the collar, a rebuild blinks the pet for a frame
  const existing = stage.querySelector("#cd-pet");
  if (existing && existing.dataset.species === species) { await applyCollar(existing); return { holder: existing, idles: rig.idles }; }
  stage.innerHTML = "";
  const holder = document.createElement("div");
  holder.id = "cd-pet";
  holder.dataset.species = species;
  holder.style.cssText = `position:relative; width:${size}px; height:${size}px;`;
  holder.innerHTML = rig.html.replaceAll('width="108" height="108"', `width="${size}" height="${size}"`);
  if (rig.art) {
    const facing = holder.querySelector(".cd-facing");
    if (facing) { facing.innerHTML = rig.art; holder.classList.add("cd-imported"); }
  }
  stage.appendChild(holder);
  await applyCollar(holder);
  return { holder, idles: rig.idles };
}

// mirrors pet.js applyEquipped so the hub shows the same outfit as the page
let fxCssReady = false;
function ensureFxCss() { if (fxCssReady) return; const st = document.createElement("style"); st.textContent = COLLAR_FX_CSS; document.head.appendChild(st); fxCssReady = true; }
const moteLoops = new Map(); // stage element → stop()
async function applyCollar(holder) {
  try {
    ensureFxCss();
    const { cd_econ } = await chrome.storage.local.get("cd_econ");
    const def = COLLAR_DEFS.find((d) => d.id === (cd_econ?.equipped?.collar ?? "coral"));
    const svg = holder.querySelector("svg");
    if (!def || !svg) return;
    applyCollarDef(svg, def, holder.id + Math.random().toString(36).slice(2, 5));
    const stage = holder.parentElement;
    if (!stage) return;
    moteLoops.get(stage)?.();
    stage.querySelectorAll(".cd-cmote").forEach((m) => m.remove());
    if (getComputedStyle(stage).position === "static") stage.style.position = "relative";
    moteLoops.set(stage, collarMoteLoop(def, stage, () => {
      if (!holder.isConnected) return null;
      return { x: holder.offsetLeft, y: holder.offsetTop, w: holder.offsetWidth, h: holder.offsetHeight, dir: 1, moving: false };
    }));
  } catch {}
}
function collarCard(def, { wearing = false, onclick = null, footer = null } = {}) {
  ensureFxCss();
  const card = document.createElement("div");
  card.className = `ccard rc-frame-${def.rarity}` + (wearing ? " wearing" : "");
  card.innerHTML = `<div class="cglyph">${collarGlyph(58)}</div><div class="cname">${def.name}</div><span class="raritychip rc-${def.rarity}">${def.rarity}</span>${footer ? `<div class="cfoot">${footer}</div>` : ""}${wearing ? '<span class="cwearing">wearing</span>' : ""}`;
  const svg = card.querySelector("svg"); svg.style.setProperty("--u", ".1");
  applyCollarDef(svg, def, "card" + def.id);
  card.title = wearing ? "Wearing" : "Tap to wear";
  if (onclick) card.onclick = onclick;
  return card;
}

// ---- wardrobe ----
async function renderWardrobe() {
  const e = await getEcon();
  setCoins(e.balance);
  const key = e.equipped.animal ?? "pup";
  const meta = ANIMAL_META[key] ?? ANIMAL_META.pup;
  setHabitat(meta.species ?? "pup", "wardrobeHabitat", true);
  await stageArt("wardrobeStage", meta, 120);

  const row = document.getElementById("wardrobeCollars");
  const owned = COLLAR_DEFS.filter((d) => e.owned.includes(`collar_${d.id}`));
  row.innerHTML = "";
  if (!owned.length) row.innerHTML = `<div class="empty">Nothing here yet.</div>`;
  const order = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  owned.sort((a, b) => order[a.rarity] - order[b.rarity]);
  for (const d of owned) {
    const wearing = e.equipped.collar === d.id;
    row.appendChild(collarCard(d, { wearing, onclick: async () => {
      if (wearing) return;
      if (refused(await ledgerSpend("equip_collar", { id: d.id }))) return;
      renderWardrobe();
    } }));
  }
  const perk = COLLAR_PERKS[e.equipped.collar]?.text;
  document.getElementById("wardrobePerk").textContent = perk ? `✦ ${perk}` : "";
}

async function mountHeroPet(species = "pup") {
  const mounted = await mountPet("petStage", 126, species);
  if (!mounted || mounted.holder.dataset.idling) return; // one idle loop per mounted pet
  mounted.holder.dataset.idling = "1";
  (function idleLoop() {
    setTimeout(() => {
      if (!mounted.holder.isConnected) return;
      const idle = mounted.idles[Math.floor(Math.random() * mounted.idles.length)];
      mounted.holder.classList.add(`cd-idle-${idle}`);
      setTimeout(() => mounted.holder.classList.remove(`cd-idle-${idle}`), IDLE_MS[idle] ?? 2500);
      idleLoop();
    }, 9000 + Math.random() * 13000);
  })();
}

// ---- habitats ----
// card=true: short bottom-anchored framing for small stages so the ground meets the feet
const sceneOpen = (card) => card
  ? `<svg viewBox="0 0 360 212" preserveAspectRatio="xMidYMax slice">`
  : `<svg viewBox="0 0 360 1400" preserveAspectRatio="xMidYMin slice">`;
function meadowScene(card = false) {
  // fixed positions so the scene never flickers between renders
  const tufts = [[28, 201], [66, 197], [104, 203], [140, 198], [222, 199], [262, 203], [298, 197], [334, 202], [86, 208], [246, 209], [316, 208]];
  const tuft = ([x, y]) => `<path fill="#6DB878" d="M${x} ${y} c0 -5 1 -9 4 -13 c1 5 0 9 -1 13 z"/><path fill="#5DA868" d="M${x + 4} ${y} c-1 -6 0 -11 2 -15 c2 4 2 10 1 15 z"/><path fill="#6DB878" d="M${x + 8} ${y} c1 -5 0 -9 -3 -12 c-1 5 0 8 0 12 z"/>`;
  const flower = (x, y, c) => `<g><circle cx="${x - 3}" cy="${y}" r="2.1" fill="#fff"/><circle cx="${x + 3}" cy="${y}" r="2.1" fill="#fff"/><circle cx="${x}" cy="${y - 3}" r="2.1" fill="#fff"/><circle cx="${x}" cy="${y + 3}" r="2.1" fill="#fff"/><circle cx="${x}" cy="${y}" r="1.7" fill="${c}"/></g>`;
  // tall canvas pinned to the top: sky and hills sit behind the hero, the ground runs on below and crops
  const ground = [[40, 262], [300, 258], [170, 300], [330, 330], [24, 350], [200, 410], [90, 470], [280, 520], [150, 600], [320, 660], [50, 720]];
  return `${sceneOpen(card)}
    <defs>
      <linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C3D9FA"/><stop offset="1" stop-color="#E9F0FC"/></linearGradient>
      <linearGradient id="hbGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#AEDFAE"/><stop offset=".08" stop-color="#8FCD97"/><stop offset="1" stop-color="#7CC287"/></linearGradient>
    </defs>
    <rect x="0" y="0" width="360" height="230" fill="url(#hbSky)"/>
    <g fill="#fff" opacity=".9">
      <circle cx="64" cy="54" r="11"/><circle cx="80" cy="47" r="15"/><circle cx="98" cy="54" r="10"/><rect x="58" y="54" width="46" height="10" rx="5"/>
      <circle cx="274" cy="40" r="8"/><circle cx="287" cy="34" r="12"/><circle cx="301" cy="41" r="7"/><rect x="268" y="40" width="38" height="8" rx="4"/>
    </g>
    <path d="M-10 170 C60 138 120 142 180 162 C240 180 300 136 370 158 L370 240 L-10 240 Z" fill="#CFEBD1"/>
    <path d="M-10 188 C70 168 140 194 200 180 C260 166 320 190 370 178 L370 1400 L-10 1400 Z" fill="url(#hbGround)"/>
    <g opacity=".55">${ground.map(tuft).join("")}</g>
    <g opacity=".7">${flower(120, 285, "#F2A5A0")}${flower(250, 380, "#F7C6BF")}${flower(60, 560, "#F2A5A0")}</g>
    <path d="M-10 188 C70 168 140 194 200 180 C260 166 320 190 370 178" fill="none" stroke="#C9EBCB" stroke-width="3" opacity=".8"/>
    <g>${tufts.map(tuft).join("")}</g>
    ${flower(50, 195, "#F2A5A0")}${flower(290, 205, "#F2A5A0")}${flower(200, 208, "#F7C6BF")}
    <circle cx="120" cy="206" r="1.6" fill="#F2A5A0"/><circle cx="330" cy="196" r="1.6" fill="#fff"/>
  </svg>`;
}
function cozyScene(card = false) {
  return `${sceneOpen(card)}
    <defs><linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFD7FA"/><stop offset="1" stop-color="#E6EEFB"/></linearGradient></defs>
    <rect x="0" y="0" width="360" height="212" fill="#FBEFE3"/>
    <polygon points="236,104 322,104 360,212 150,212" fill="#FFF3D4" opacity=".7"/>
    <rect x="236" y="26" width="86" height="80" rx="9" fill="url(#hbSky)" stroke="#fff" stroke-width="6"/>
    <path d="M279 30 V102 M240 66 H318" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    <g fill="#fff" opacity=".9"><circle cx="258" cy="52" r="6"/><circle cx="266" cy="48" r="8"/><circle cx="275" cy="53" r="5"/></g>
    <rect x="228" y="104" width="102" height="9" rx="4" fill="#F1DEC8"/>
    <rect x="0" y="152" width="360" height="1248" fill="#EBD2B3"/>
    <g stroke="#DFC09E" stroke-width="1.5"><path d="M0 172 H360 M0 192 H360 M0 232 H360 M0 272 H360 M0 312 H360 M0 352 H360 M0 392 H360 M0 432 H360 M0 472 H360 M0 512 H360 M0 552 H360 M0 592 H360 M0 632 H360 M0 672 H360 M0 712 H360"/><path d="M60 152 V172 M180 172 V192 M300 152 V172 M120 192 V232 M250 192 V232 M40 232 V272 M200 232 V272 M320 232 V272 M100 272 V312 M260 272 V312 M60 312 V352 M180 312 V352 M300 312 V352 M120 352 V392 M250 352 V392 M40 392 V432 M200 392 V432 M320 392 V432 M100 432 V472 M260 432 V472 M60 472 V512 M180 472 V512 M300 472 V512 M120 512 V552 M250 512 V552 M40 552 V592 M200 552 V592 M320 552 V592 M100 592 V632 M260 592 V632 M60 632 V672 M180 632 V672 M300 632 V672 M120 672 V712 M250 672 V712"/></g>
    <ellipse cx="180" cy="197" rx="124" ry="19" fill="#F2A9A0"/>
    <ellipse cx="180" cy="197" rx="100" ry="14" fill="#F8CBC3"/>
    <ellipse cx="180" cy="197" rx="72" ry="9.5" fill="#F2A9A0"/>
  </svg>`;
}
const HABITATS = { pup: meadowScene, cat: cozyScene };
function setHabitat(species, elId = "habitat", card = false) {
  const el = document.getElementById(elId);
  const key = HABITATS[species] ? species : "pup";
  if (el.dataset.species === key) return;
  el.dataset.species = key;
  el.innerHTML = HABITATS[key](card);
}

// ---- home companion carousel ----
const ANIMAL_META = {
  pup: { kind: "rig", species: "pup", moji: "🐶", name: "Puppy" },
  animal_cat: { kind: "rig", species: "cat", moji: "🐱", name: "Kitten" },
  animal_capy: { kind: "rig", species: "capy", moji: "🦫", name: "Capybara" },
  animal_hamster: { kind: "moji", moji: "🐹", name: "Hamster" },
  animal_frog: { kind: "moji", moji: "🐸", name: "Frog" },
  animal_duck: { kind: "moji", moji: "🦆", name: "Duck" },
  animal_fox: { kind: "moji", moji: "🦊", name: "Fox" },
  animal_penguin: { kind: "moji", moji: "🐧", name: "Penguin" },
  animal_owl: { kind: "moji", moji: "🦉", name: "Owl" },
  animal_axolotl: { kind: "moji", moji: "🦎", name: "Axolotl" },
  animal_dragon: { kind: "moji", moji: "🐉", name: "Dragon" },
  animal_unicorn: { kind: "moji", moji: "🦄", name: "Unicorn" },
};

async function stageArt(stageId, meta, size, dim = false) {
  const table = await speciesTable();
  if (meta.species && table[meta.species]?.ready) {
    const m = await mountPet(stageId, size, meta.species);
    if (m) { m.holder.style.margin = "0 auto"; if (dim) m.holder.style.filter = "grayscale(.45) opacity(.9)"; return true; }
  }
  document.getElementById(stageId).innerHTML = `<div class="bigmoji"${dim ? "" : ' style="filter:none"'}>${meta.moji}</div>`;
  return false;
}
const ownedKeyToHero = (k) => (k === "animal_pup" ? "pup" : k);

// bounded shelf: the equipped pet anchors slot 1 for the popup session, the others follow
let heroOrder = null, heroView = 0;
function heroList(e) {
  const canonical = e.owned.map(ownedKeyToHero).filter((k) => ANIMAL_META[k]);
  if (!canonical.length) canonical.push("pup");
  if (!heroOrder) {
    const cur = e.equipped.animal ?? "pup";
    heroOrder = [cur, ...canonical.filter((k) => k !== cur)];
  } else {
    heroOrder = heroOrder.filter((k) => canonical.includes(k));
    for (const k of canonical) if (!heroOrder.includes(k)) heroOrder.push(k);
  }
  return heroOrder;
}

async function renderHeroPet() {
  const e = await getEcon();
  const list = heroList(e);
  heroView = Math.min(Math.max(heroView, 0), list.length - 1);
  const viewed = list[heroView];
  const equipped = e.equipped.animal ?? "pup";
  document.getElementById("cyclePet").hidden = heroView >= list.length - 1;
  document.getElementById("cyclePetBack").hidden = heroView === 0;
  const eq = document.getElementById("equipBtn");
  eq.hidden = viewed === equipped;
  document.getElementById("openWardrobe").hidden = viewed !== equipped;
  const meta = ANIMAL_META[viewed] ?? ANIMAL_META.pup;
  const { pet_name } = await chrome.storage.local.get("pet_name");
  const table = await speciesTable();
  setHabitat(meta.species ?? "pup");
  const rigged = meta.kind === "rig" || (meta.species && table[meta.species]?.ready);
  const nameOf = (key) => key === "pup" ? (e.names?.animal_pup ?? pet_name ?? meta.name) : (e.names?.[key] ?? meta.name);
  if (rigged) await mountHeroPet(meta.species);
  else document.getElementById("petStage").innerHTML = `<div class="bigmoji">${meta.moji}</div>`;
  setHeroName(nameOf(viewed));
  const key = viewed === "pup" ? "animal_pup" : viewed;
  const hasName = Boolean(e.names?.[key]) || (viewed === "pup" && Boolean(pet_name));
  const row = document.getElementById("heroRenameRow");
  row.hidden = true;
  document.getElementById("heroRename").onclick = (ev) => {
    ev.stopPropagation();
    row.hidden = !row.hidden;
    const inp = document.getElementById("heroRenameInput");
    inp.value = nameOf(viewed) === meta.name ? "" : nameOf(viewed); inp.placeholder = meta.name;
    document.getElementById("heroRenameSave").innerHTML = hasName ? `Save · ${coin(12)} ${RENAME_COST}` : "Save";
    if (!row.hidden) inp.focus();
  };
  document.getElementById("heroRenameSave").onclick = async () => {
    const name = document.getElementById("heroRenameInput").value.trim();
    if (!name) { row.hidden = true; return; }
    const now = await getEcon();
    if (hasName) {
      if (now.balance < RENAME_COST) return;
      if (!(await confirmSpend({ html: "<div style=\"font-size:52px;line-height:1\">✏️</div>", title: `Rename to ${name}?`, note: "Changing a name costs.", price: RENAME_COST, yes: "Rename" }))) return;
    }
    const r = await ledgerSpend("rename", { key, name }); if (refused(r)) return;
    if ((r.state.equipped.animal ?? "pup") === viewed) await chrome.storage.local.set({ pet_name: name }); // the page greets the equipped pet by pet_name
    setCoins(r.state.balance);
    row.hidden = true;
    renderHeroPet();
  };
}

function stepPet(dir, btn) {
  btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
  heroView += dir;
  renderHeroPet();
}
document.getElementById("cyclePet").onclick = (ev) => stepPet(1, ev.currentTarget);
document.getElementById("cyclePetBack").onclick = (ev) => stepPet(-1, ev.currentTarget);
document.getElementById("equipBtn").onclick = async () => {
  const e = await getEcon();
  const list = heroList(e);
  if (refused(await ledgerSpend("equip_animal", { key: list[heroView] }))) return;
  renderHeroPet();
};

function sprinkleSparkles() {
  const hero = document.getElementById("hero");
  for (let i = 0; i < 7; i++) {
    const s = document.createElement("div");
    s.className = "sparkle";
    s.textContent = "✦";
    s.style.left = `${8 + Math.random() * 84}%`;
    s.style.top = `${10 + Math.random() * 60}%`;
    s.style.color = Math.random() > 0.5 ? "#FFC24B" : "#5FA5DC";
    s.style.animationDelay = `${Math.random() * 3}s`;
    hero.appendChild(s);
  }
}

// ---- economy ----
// perks apply while the collar is worn
const COLLAR_PERKS = {
  gold:   { earnMul: 1.15, dailyTreat: true,      text: "+15% coins earned · a treat a day" },
  aurora: { boxDiscount: 30,                        text: "clothing boxes 30 cheaper" },
  ember:  { streakTreatBonus: 1,                    text: "+1 treat every streak day" },
  frost:  { mendHours: 72,                          text: "72h instead of 48h to mend a break" },
  comet:  { milestoneRareTreat: 1,                  text: "+1 rare treat at every streak milestone" },
};
async function wornPerks() { const e = await getEcon(); return COLLAR_PERKS[e.equipped.collar] ?? {}; }
async function boxPriceNow() { const p = await wornPerks(); return Math.max(0, CLOTHING_BOX.price - (p.boxDiscount ?? 0)); }

// commons sell directly; everything above comes from the clothing box
const COLLARS = [
  { id: "coral",  name: "Coral",  color: "#CD5A4E", rarity: "common",    price: 0 },
  { id: "sky",    name: "Sky",    color: "#2B7ABC", rarity: "common",    price: 60 },
  { id: "mint",   name: "Mint",   color: "#2FA97E", rarity: "common",    price: 60 },
  { id: "lilac",  name: "Lilac",  color: "#9B7FD4", rarity: "common",    price: 60 },
  { id: "sunset", name: "Sunset", color: "#F08A3E", rarity: "uncommon" },
  { id: "scroll", name: "Scroll", color: "#15120F", rarity: "rare", launch: true }, // promo code only; never sold, never dropped
  { id: "forest", name: "Forest", color: "#2E7D5B", rarity: "uncommon" },
  { id: "berry",  name: "Berry",  color: "#B0306E", rarity: "uncommon" },
  { id: "midnight", name: "Midnight", color: "#243B6B", rarity: "rare" },
  { id: "rose",   name: "Rose",   color: "#E58FA6", rarity: "rare" },
  { id: "aurora", name: "Aurora", color: "#6ED3C8", rarity: "epic" },
  { id: "gold",   name: "Gold",   color: "#E2A93B", rarity: "legendary" },
];
const ECON_DEFAULTS = { balance: 0, lifetime: 0, paid: {}, milestones_paid: {}, owned: ["collar_coral"], equipped: { collar: "coral" }, names: {} };
const RENAME_COST = 100; // first naming is free; changing it costs

// every read is the server ledger's answer; chrome.storage is a mirror
async function getEcon() {
  const e = await ledgerGet();
  return { ...ECON_DEFAULTS, ...e, equipped: { ...ECON_DEFAULTS.equipped, ...(e.equipped ?? {}) } };
}
function refused(r) {
  if (!r?.error) return false;
  const msg = r.error === "offline" ? "Can't reach the server — try again in a bit." : r.error;
  document.querySelectorAll(".spendStatus").forEach((st) => { st.textContent = msg; setTimeout(() => (st.textContent = ""), 3500); });
  return true;
}

// boot: nothing paints until the mirror says whether this is a first open
chrome.storage.local.get("cd_econ").then(({ cd_econ }) => {
  if (!cd_econ?.adopted) document.getElementById("welcome").hidden = false;
  // habitat and pet come from the cached mirror before the first frame; the ledger fetch corrects later
  else {
    const meta = ANIMAL_META[cd_econ.equipped?.animal ?? "pup"] ?? ANIMAL_META.pup;
    setHabitat(meta.species ?? "pup");
    if (meta.kind === "rig") mountHeroPet(meta.species);
  }
  document.body.classList.remove("boot");
});
const coin = (px = 16) => CD_COIN_SVG(px);
// keeps the pencil child: replace the text node, not the element
function setHeroName(text) {
  const el = document.getElementById("petName");
  const pencil = el.querySelector("#heroRename");
  el.textContent = ""; el.append(document.createTextNode(text)); if (pencil) el.appendChild(pencil);
}
document.getElementById("heroRenameInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("heroRenameSave").click();
  if (e.key === "Escape") document.getElementById("heroRenameRow").hidden = true;
});
// a click outside an open rename box closes it
document.addEventListener("click", (e) => {
  for (const id of ["heroRenameRow", "renameRow"]) {
    const row = document.getElementById(id);
    if (row && !row.hidden && !row.contains(e.target) && !e.target.closest(".pencil")) row.hidden = true;
  }
});

// ---- tips bar ----
const TIPS = [
  "🪙 To earn coins, submit assignments.",
  "🔥 Hit streaks to earn paydays!",
  "🛍️ Adopt new animals in the shop with coins.",
  "🔥 Finish everything due today to keep the flame lit.",
  "🔥 Nothing due today? Your streak is safe.",
  "🔥 Miss a due date and the flame goes out.",
  "🦴 Every streak day earns treats. Milestones pay big.",
  "🔥 Long streaks unlock animals coins alone can't buy.",
  "🏆 Your best streak is always remembered.",
  "✦ Epic collars carry unique properties.",
  "👑 Legendary collars are said to bring fortune.",
  "🎁 Boxes never drop what you already own.",
  "🧥 Wear what you win from the Wardrobe.",
  "🌙 Some things only happen after dark.",
  "🐾 Every friend has a home of its own.",
];
(function tipsLoop() {
  const el = document.getElementById("tip");
  if (!el) return;
  let i = Math.floor(Math.random() * TIPS.length);
  let paused = false;
  const bar = document.getElementById("tips");
  bar.onmouseenter = () => (paused = true);
  bar.onmouseleave = () => (paused = false);
  const show = () => { el.textContent = TIPS[i]; el.classList.remove("out"); el.classList.add("in"); };
  show();
  setInterval(() => {
    if (paused) return;
    el.classList.remove("in"); el.classList.add("out");
    setTimeout(() => { i = (i + 1) % TIPS.length; show(); }, 260);
  }, 4200);
})();

document.querySelectorAll(".coinpill").forEach((el) => el.insertAdjacentHTML("afterbegin", coin(22)));
document.getElementById("openBox").innerHTML = document.getElementById("openBox").innerHTML.replace("🪙", coin(14));

function setCoins(balance) {
  const el = document.getElementById("coins");
  const shown = parseInt(el.textContent.replace(/\D/g, ""), 10) || 0;
  if (balance > shown) {
    document.querySelectorAll(".coinpill").forEach((p) => { p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump"); });
  }
  countUp(el, balance, 500);
  countUp(document.getElementById("coins2"), balance, 500);
  countUp(document.getElementById("coins3"), balance, 500);
}

// ---- animals catalog + carousel ----
const ANIMALS = [
  { id: "cat", kind: "rig", species: "cat", moji: "🐱", name: "Kitten", price: 300, key: "animal_cat", rarity: "common" },
  { id: "pup", kind: "rig", species: "pup", moji: "🐶", name: "Puppy", price: 300, key: "animal_pup", rarity: "common" },
  { id: "capy", kind: "rig", species: "capy", moji: "🦫", name: "Capybara", price: 2000, key: "animal_capy", rarity: "epic", requires: 100, req: "100 day streak + 2000 🪙" },
];

// ---- clothing box ----
// mirrors the server's price and odds; a roll draws without replacement within a tier, a full tier pays tierCoins instead
const CLOTHING_BOX = {
  price: 120,
  odds: [["common", 0.585], ["uncommon", 0.25], ["rare", 0.10], ["epic", 0.05], ["legendary", 0.015]],
  tierCoins: { common: 40, uncommon: 80, rare: 150, epic: 300, legendary: 600 }, // paid when a tier is complete
  pool: (tier) => COLLARS.filter((c) => c.rarity === tier),
};

const RARITY = {
  common: { accent: "#B9C4D2", card: "#9FAEC4", sparkles: 8 },
  uncommon: { accent: "#6BCB8C", sparkles: 12 },
  rare: { accent: "#7FB0FF", sparkles: 16 },
  epic: { accent: "#C08BF0", sparkles: 20 },
  legendary: { accent: "#FFC24B", sparkles: 26 },
};
let animalIdx = 0;
let shopList = ANIMALS;
const shopAnimals = (e) => ANIMALS.filter((a) => !e.owned.includes(a.key));

// every coin spend confirms here; backdrop tap or Esc is a no
function confirmSpend({ html = "", title, note = "", price, yes = "Buy" }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const stage = document.getElementById("confirmMoji");
    if (html !== null) stage.innerHTML = html;
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmNote").textContent = note;
    document.getElementById("confirmPrice").innerHTML = price != null ? `${coin(16)} ${price}` : "";
    document.getElementById("confirmYes").textContent = yes;
    modal.hidden = false;
    const done = (ok) => { modal.hidden = true; document.removeEventListener("keydown", onKey); resolve(ok); };
    const onKey = (e) => { if (e.key === "Escape") done(false); };
    document.addEventListener("keydown", onKey);
    document.getElementById("confirmYes").onclick = (e) => { e.stopPropagation(); done(true); };
    document.getElementById("confirmNo").onclick = (e) => { e.stopPropagation(); done(false); };
    modal.onclick = (e) => { if (e.target === modal) done(false); };
  });
}
async function confirmAdoption(a) {
  const p = confirmSpend({ html: null, title: `Adopt ${a.name}?`, note: "Adoptions are forever.", price: a.price, yes: "Adopt" });
  stageArt("confirmMoji", a, 88);
  return p;
}
function collarPreview(def) {
  const html = `<div style="display:flex;justify-content:center">${collarGlyph(72)}</div>`;
  setTimeout(() => { const svg = document.querySelector("#confirmMoji svg"); if (svg) { svg.style.setProperty("--u", ".1"); applyCollarDef(svg, def, "confirm"); } }, 0);
  return html;
}

// closing the popup mid-ceremony leaves the pet unnamed; naming stays free later via the pencil
function celebrateAdoption(a, opts = {}) {
  const overlay = document.getElementById("celebrate");
  stageArt("celebratePet", a, 112);
  document.getElementById("celebrateText").innerHTML =
    opts.tierFull ? `${a.rarity} collars complete! +${coin(16)} ${opts.refund}` :
    opts.dupe ? `${a.name} again! +${coin(16)} ${opts.refund ?? 0}` :
    opts.noName ? a.name : "Welcome,";
  const nameRow = document.getElementById("celebrateName");
  nameRow.style.display = (opts.dupe || opts.noName) ? "none" : "";
  const input = document.getElementById("nameInput");
  input.value = "";
  input.placeholder = a.name;
  const tier = RARITY[a.rarity ?? "common"];
  overlay.className = `r-${a.rarity ?? "common"}`;
  overlay.hidden = false;
  overlay.querySelectorAll(".celebrate-flash, .celebrate-rays, .celebrate-orb, .celebrate-pet, .celebrate-text, .celebrate-name")
    .forEach((el) => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
  for (let i = 0; i < tier.sparkles; i++) {
    const s = document.createElement("div");
    s.className = "sparkle";
    s.textContent = "✦";
    s.style.cssText = `position:absolute; left:${10 + Math.random() * 80}%; top:${12 + Math.random() * 70}%;
      color:${Math.random() > 0.4 ? tier.accent : "#fff"}; font-size:${11 + Math.random() * 9}px;
      animation: spark 1.5s ease-out ${1.2 + Math.random() * 0.6}s 1;`;
    overlay.appendChild(s);
    setTimeout(() => s.remove(), 3400);
  }
  setTimeout(() => input.focus(), 2300);

  const fadeOut = () => {
    overlay.classList.add("out");
    setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove("out");
      renderAnimal();
      document.dispatchEvent(new CustomEvent("cd-ceremony-done", { detail: { key: a.key } }));
    }, 460);
  };
  if (opts.dupe || opts.noName) setTimeout(fadeOut, 2800);
  document.getElementById("nameSave").onclick = async () => {
    const name = input.value.trim();
    if (name) {
      const r = await ledgerSpend("rename", { key: a.key, name });
      // the page greets the equipped pet by pet_name; naming a shop adoptee leaves it alone
      if (!r.error && ownedKeyToHero(a.key) === (r.state.equipped.animal ?? "pup")) await chrome.storage.local.set({ pet_name: name });
    }
    fadeOut();
    renderHeroPet();
  };
  input.onkeydown = (ev) => { if (ev.key === "Enter") document.getElementById("nameSave").onclick(); };
  document.getElementById("nameSkip").onclick = fadeOut;
}


async function renderAnimal() {
  const e = await getEcon();
  shopList = shopAnimals(e);
  const carousel = document.querySelector("#viewShop .carousel");
  const info = document.querySelector("#viewShop .animalinfo");
  carousel.hidden = info.hidden = !shopList.length;
  if (!shopList.length) return;
  animalIdx = Math.min(Math.max(animalIdx, 0), shopList.length - 1);
  const a = shopList[animalIdx];
  document.getElementById("prevAnimal").hidden = document.getElementById("nextAnimal").hidden = shopList.length < 2;
  const stage = document.getElementById("animalStage");
  const btn = document.getElementById("animalAction");
  btn.onclick = null;

  const tier = RARITY[a.rarity ?? "common"];
  const chip = document.getElementById("rarityChip");
  chip.className = `raritychip rc-${a.rarity ?? "common"}`;
  chip.textContent = a.rarity ?? "common";
  const box = document.querySelector(".stagebox");
  box.style.borderColor = tier.accent;
  box.style.boxShadow = `inset 0 0 0 1px ${tier.accent}33`;
  info.style.setProperty("--acc", tier.card ?? tier.accent);

  setHabitat(a.species ?? "pup", "shopHabitat", true);
  // the milestone must be claimed, not just reached; the server enforces the same rule on adopt
  const locked = Boolean(a.locked) || (a.requires && !e.milestones_paid?.[String(a.requires)]);
  box.classList.toggle("locked", !e.owned.includes(a.key) || locked);
  await stageArt("animalStage", a, 108, false);
  const renameBtn = document.getElementById("renameBtn");
  const renameRow = document.getElementById("renameRow");
  renameBtn.hidden = true;
  renameRow.hidden = true;

  if (locked) {
    document.getElementById("animalName").textContent = a.name;
    document.getElementById("animalReq").innerHTML = (a.req ?? "").replace("🪙", coin(12));
    btn.textContent = "🔒 Locked";
    btn.disabled = true;
    return;
  }

  const owned = e.owned.includes(a.key);
  if (owned) {
    const hasName = Boolean(e.names?.[a.key]);
    document.getElementById("animalName").textContent = e.names?.[a.key] ?? a.name;
    document.getElementById("animalReq").textContent = "";
    btn.textContent = "Adopted ✓";
    btn.disabled = true;
    renameBtn.hidden = false;
    renameBtn.onclick = () => {
      renameRow.hidden = !renameRow.hidden;
      const inp = document.getElementById("renameInput");
      inp.value = e.names?.[a.key] ?? "";
      inp.placeholder = a.name;
      document.getElementById("renameSave").innerHTML = hasName ? `Save · ${coin(13)} ${RENAME_COST}` : "Save";
      if (!renameRow.hidden) inp.focus();
    };
    document.getElementById("renameSave").onclick = async () => {
      const name = document.getElementById("renameInput").value.trim();
      if (!name) { renameRow.hidden = true; return; }
      const now = await getEcon();
      const alreadyNamed = Boolean(now.names?.[a.key]);
      if (alreadyNamed) {
        if (now.balance < RENAME_COST) return;
        if (!(await confirmSpend({ html: "<div style=\"font-size:52px;line-height:1\">✏️</div>", title: `Rename to ${name}?`, note: "Changing a name costs.", price: RENAME_COST, yes: "Rename" }))) return;
      }
      const r = await ledgerSpend("rename", { key: a.key, name }); if (refused(r)) return;
      setCoins(r.state.balance);
      renderAnimal();
    };
    return;
  }
  document.getElementById("animalName").textContent = a.name;
  document.getElementById("animalReq").textContent = "a new friend";
  btn.innerHTML = `Adopt · ${coin(14)} ${a.price}`;
  btn.disabled = e.balance < a.price;
  btn.onclick = async () => {
    if (!(await confirmAdoption(a))) return;
    const r = await ledgerSpend("adopt", { key: a.key }); if (refused(r)) return;
    celebrateAdoption(a);
    setCoins(r.state.balance);
    renderAnimal();
  };
}

document.getElementById("prevAnimal").onclick = () => {
  animalIdx = (animalIdx - 1 + shopList.length) % shopList.length;
  renderAnimal();
};
document.getElementById("nextAnimal").onclick = () => {
  animalIdx = (animalIdx + 1) % shopList.length;
  renderAnimal();
};

// ---- box open ----
async function renderBoxSec() {
  const e = await getEcon();
  const free = (e.free_boxes ?? 0) + (e.first_box ?? 0);
  const price = await boxPriceNow();
  const btn = document.getElementById("openBox");
  btn.disabled = !free && e.balance < price;
  btn.innerHTML = free ? `Open<br><small>${free} free</small>` : `Open<br>${coin(14)} ${price}${price < CLOTHING_BOX.price ? ` <s style="opacity:.6">${CLOTHING_BOX.price}</s>` : ""}`;
}
let forceTier = null;
if (DEV) document.addEventListener("keydown", (e) => { if (document.getElementById("viewShop").hidden) return; if (e.key === "l") forceTier = "legendary"; if (e.key === "e") forceTier = "epic"; if (e.key === "r") forceTier = "rare"; });

document.getElementById("openBox").onclick = async () => {
  const e = await getEcon();
  const price = await boxPriceNow();
  if (!((e.free_boxes ?? 0) + (e.first_box ?? 0) > 0)) {
    if (e.balance < price) return;
    if (!(await confirmSpend({ html: `<div style="font-size:56px;line-height:1">🎁</div>`, title: "Are you sure?", note: "", price, yes: "Open" }))) return;
  }
  // the server rolls; the client only shows the result
  const r = await ledgerSpend("open_box", DEV && forceTier ? { force: forceTier } : {}); forceTier = null;
  if (refused(r)) return;
  const res = r.result ?? {};
  const collar = res.collar ? COLLARS.find((c) => c.id === res.collar) ?? { id: res.collar, name: res.collar, color: "#999" } : null;
  setCoins(r.state.balance);
  renderBoxSec();
  renderShop();
  celebrateCollar({ collar, coins: res.coins, tier: res.tier });
};
if (DEV) { // dev build only; the server gates it by DEV_SECRET
  document.addEventListener("keydown", async (e) => { if (e.key === "g" && !document.getElementById("viewShop").hidden) { await ledgerSpend("dev_grant"); renderShop(); renderAnimal(); } });
}

// ---- box reveal ----
// tension time scales with the tier; epic and legendary lift before they open
const BOX_TENSION = { common: 0.9, uncommon: 1.3, rare: 1.8, epic: 2.6, legendary: 3.6 };
const SPARKS = { common: 8, uncommon: 12, rare: 16, epic: 26, legendary: 44 };
let fxCssInjected = false;
async function celebrateCollar({ collar, coins, tier }) {
  if (!fxCssInjected) { const st = document.createElement("style"); st.textContent = COLLAR_FX_CSS; document.head.appendChild(st); fxCssInjected = true; }
  const ov = document.getElementById("boxReveal");
  ov.className = `r-${tier}`;
  ov.style.setProperty("--t", `${BOX_TENSION[tier] ?? 1.4}s`);
  ov.querySelectorAll(".br-spark").forEach((s) => s.remove());
  ov.hidden = false;
  ov.querySelectorAll("*").forEach((el) => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
  // the item is built synchronously before the overlay shows so a quick tap cannot outrun it
  ensureFxCss();
  const stage = document.getElementById("brStage");
  stage.innerHTML = "";
  if (collar) {
    stage.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%">${collarGlyph(118)}</div>`;
    const def = COLLAR_DEFS.find((d) => d.id === collar.id);
    const svg = stage.querySelector("svg"); svg.style.setProperty("--u", ".1");
    if (def) applyCollarDef(svg, def, "reveal");
  } else stage.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%">${coin(88)}</div>`;
  document.getElementById("brName").textContent = collar ? `${collar.name} collar` : `+${coins} coins`;
  const chip = document.getElementById("brChip");
  chip.className = `raritychip br-chip rc-${tier}`; chip.textContent = collar ? tier : `${tier} set complete`;
  const perk = collar ? COLLAR_PERKS[collar.id]?.text : null;
  document.getElementById("brPerk").textContent = perk ? `✦ ${perk}` : "";
  for (let i = 0; i < (SPARKS[tier] ?? 10); i++) {
    const s = document.createElement("i"); s.className = "br-spark";
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 130;
    s.style.setProperty("--dx", `${Math.cos(a) * d}px`); s.style.setProperty("--dy", `${Math.sin(a) * d - 30}px`);
    s.style.background = tier === "legendary" ? (Math.random() < .5 ? "#FFD75A" : "#fff") : "var(--cm)";
    s.style.boxShadow = "0 0 6px 1px var(--cm)"; s.style.animationDelay = `calc(var(--t) + ${.45 + Math.random() * .25}s)`;
    ov.appendChild(s);
  }
  // tap anywhere: press squashes the box, release cracks it
  const box = ov.querySelector(".br-box");
  let opened = false;
  ov.onpointerdown = (ev) => { if (opened || ev.target.closest(".br-actions")) return; box.classList.add("press"); };
  ov.onpointerup = ov.onpointercancel = () => box.classList.remove("press");
  ov.onclick = (ev) => {
    if (opened || ev.target.closest(".br-actions")) return;
    opened = true;
    box.classList.remove("press");
    ov.classList.add("opening"); if (tier === "epic" || tier === "legendary") ov.classList.add("lift");
  };
  document.getElementById("brDone").onclick = (ev) => {
    ev.stopPropagation();
    ov.onclick = ov.onpointerdown = ov.onpointerup = null;
    ov.classList.add("out");
    setTimeout(async () => {
      ov.hidden = true; ov.classList.remove("out", "opening", "lift"); renderShop(); renderWardrobe();
    }, 420);
  };
}

// ---- collar shop ----
async function renderShop(justBought) {
  const e = await getEcon();
  setCoins(e.balance);
  renderBoxSec();
  const row = document.getElementById("collarShop");
  row.innerHTML = "";
  // commons only, as a wrapping grid: the popup window grows to fit an overflowing row and never shrinks back
  for (const d of COLLAR_DEFS.filter((x) => x.rarity === "common")) {
    const c = COLLARS.find((x) => x.id === d.id) ?? { price: 60 };
    const owned = e.owned.includes(`collar_${d.id}`);
    const wearing = e.equipped.collar === d.id;
    const price = c.price ?? 60;
    const affordable = e.balance >= price;
    const card = collarCard(d, { wearing, footer: wearing ? "" : owned ? "owned" : `${coin(11)} ${price}` });
    if (!owned) card.classList.add("locked"); if (!owned && !affordable) card.classList.add("cantafford");
    if (justBought === d.id) card.classList.add("bought");
    card.title = wearing ? "Wearing" : owned ? "Tap to wear" : affordable ? `Buy for ${price}` : `Need ${price - e.balance} more`;
    card.onclick = async () => {
      const now = await getEcon();
      const isOwned = now.owned.includes(`collar_${d.id}`);
      if (!isOwned) {
        if (now.balance < price) return;
        if (!(await confirmSpend({ html: collarPreview(d), title: `Buy the ${d.name} collar?`, note: "Yours to wear whenever you like.", price }))) return;
        const r = await ledgerSpend("buy_collar", { id: d.id }); if (refused(r)) return;
        setCoins(r.state.balance);
        renderShop(d.id);
        return;
      }
      if (refused(await ledgerSpend("equip_collar", { id: d.id }))) return;
      renderShop();
      renderAnimal();
    };
    row.appendChild(card);
  }
}

// ---- promo codes ----
document.getElementById("promoBtn").onclick = async () => {
  const inp = document.getElementById("promoInput");
  const code = inp.value.trim().toUpperCase();
  if (!code) return;
  const r = await ledgerSpend("redeem", { id: code });
  if (refused(r)) return;
  inp.value = "";
  const id = r.result?.collar;
  const collar = COLLARS.find((c) => c.id === id) ?? { id, name: id, rarity: "uncommon" };
  celebrateCollar({ collar, coins: 0, tier: collar.rarity });
};
document.getElementById("promoInput").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("promoBtn").onclick(); });

// ---- views ----
const VIEWS = ["viewMain", "viewShop", "viewWardrobe", "viewFriends"];
/* @strip:visits */
const VISITS = false; // gates the Friends page and the first-visit screen
const NICK_COST = 100; // server-enforced
// ---- friends ----
async function renderFriends() {
  const e = await getEcon();
  setCoins(e.balance);
  document.getElementById("coins4").textContent = e.balance;
  const { visits_enabled } = await chrome.storage.local.get("visits_enabled");
  document.getElementById("visitsToggle").checked = visits_enabled === true;
  document.getElementById("nickShow").textContent = e.nick ?? "";
  document.getElementById("nickRow").hidden = true;
  const list = document.getElementById("friendsList");
  const info = e.friends_info ?? [];
  list.hidden = !info.length;
  list.innerHTML = info.map((f) => `<div class="setrow" data-pid="${f.pid}"><span>${(ANIMAL_META[f.animal] ?? ANIMAL_META.pup).moji} ${f.nick ?? ""}</span><button class="pencil" title="Remove">✕</button></div>`).join("");
  list.querySelectorAll("button").forEach((b) => { b.onclick = async () => { const r = await ledgerSpend("remove_friend", { id: b.parentElement.dataset.pid }); if (!refused(r)) renderFriends(); }; });
}
document.getElementById("visitsToggle").onchange = (ev) => chrome.storage.local.set({ visits_enabled: ev.target.checked });
document.getElementById("nickEdit").onclick = (ev) => {
  ev.stopPropagation();
  const row = document.getElementById("nickRow"); row.hidden = !row.hidden;
  const inp = document.getElementById("nickInput"); inp.value = document.getElementById("nickShow").textContent;
  document.getElementById("nickSave").innerHTML = `Save · ${coin(12)} ${NICK_COST}`;
  if (!row.hidden) inp.focus();
};
document.getElementById("nickSave").onclick = async () => {
  const name = document.getElementById("nickInput").value.trim();
  const row = document.getElementById("nickRow");
  if (!name || name === document.getElementById("nickShow").textContent) { row.hidden = true; return; }
  const now = await getEcon();
  if (now.balance < NICK_COST) return;
  if (!(await confirmSpend({ html: "<div style=\"font-size:52px;line-height:1\">✏️</div>", title: "Are you sure?", note: "", price: NICK_COST, yes: "Save" }))) return;
  const r = await ledgerSpend("set_nick", { name }); if (refused(r)) return;
  setCoins(r.state.balance);
  renderFriends();
};
document.getElementById("openFriends").onclick = () => { showView("viewFriends"); renderFriends(); };
document.getElementById("openFriends").hidden = !VISITS;
document.getElementById("friendsBack").onclick = () => { showView("viewMain"); render(); };
/* @/strip:visits */
function showView(id) { for (const v of VIEWS) { const el = document.getElementById(v); if (el) el.hidden = v !== id; } window.scrollTo(0, 0); }
function openShop(section = null) {
  showView("viewShop");
  animalIdx = 0;
  renderAnimal();
  renderShop().then(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
document.getElementById("openShop").onclick = () => openShop();
document.getElementById("openWardrobe").onclick = () => { showView("viewWardrobe"); renderWardrobe(); };
document.getElementById("wardrobeBack").onclick = () => { showView("viewMain"); renderHeroPet(); render(); };
document.getElementById("wardrobeToShop").onclick = () => openShop("collarSection");
document.getElementById("backBtn").onclick = () => {
  showView("viewMain");
  renderHeroPet();
  render();
};

// ---- treat shelf ----
async function renderTreats() {
  let { cd_treats, cd_treat_armed } = await chrome.storage.local.get(["cd_treats", "cd_treat_armed"]);
  if (!cd_treats) {
    cd_treats = { plain: 3, rare: 1 };
    chrome.storage.local.set({ cd_treats });
  }
  const t = cd_treats;
  document.getElementById("treatN").textContent = t.plain ?? 0;
  document.getElementById("treatRareN").textContent = t.rare ?? 0;
  document.getElementById("treatPlain").disabled = !(t.plain > 0);
  document.getElementById("treatRare").disabled = !(t.rare > 0);
  document.getElementById("treatRare").hidden = !(t.rare > 0);
  const hint = document.getElementById("treatHint");
  if (cd_treat_armed && Date.now() - (cd_treat_armed.ts ?? 0) < 60000) {
    hint.textContent = "click anywhere to drop";
  } else if ((t.plain ?? 0) + (t.rare ?? 0) === 0) {
    hint.textContent = "extend your streak to earn treats";
  } else {
    hint.textContent = "";
  }
}

// the popup closes on blur, so a drag out of it is impossible: the carry hands off through storage
// and the popup closes itself when the active tab is Canvas
async function armTreat(kind) {
  const { cd_treats, extra_hosts = [] } = await chrome.storage.local.get(["cd_treats", "extra_hosts"]);
  const t = cd_treats ?? { plain: 0, rare: 0 };
  if (!(t[kind] > 0)) return;
  await chrome.storage.local.set({ cd_treat_armed: { kind, ts: Date.now() } });
  renderTreats();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const host = tab?.url ? new URL(tab.url).hostname : "";
    const onCanvas = /\.instructure\.com$/i.test(host) || extra_hosts.includes(host);
    if (onCanvas) { setTimeout(() => window.close(), 180); return; }
    document.getElementById("treatHint").textContent = "open your Canvas tab";
  } catch {}
}
document.getElementById("treatPlain").onclick = () => armTreat("plain");
document.getElementById("treatRare").onclick = () => armTreat("rare");
chrome.storage.onChanged.addListener((ch) => { if (ch.cd_treats || ch.cd_treat_armed) renderTreats(); });

// ---- streak payout ----
function showStreakReward(coins, parts) {
  const ov = document.getElementById("streakReward");
  ov.hidden = false;
  ov.querySelectorAll("*").forEach((el) => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
  document.getElementById("srCoin").innerHTML = coin(96);
  const ms = parts.filter((p) => p.kind === "milestone").map((p) => `${p.days}-day`);
  const w = parts.find((p) => p.kind === "welcome");
  document.querySelector("#streakReward .sr-text").textContent = ms.length ? "Streak payday." : "";
  document.getElementById("srSub").textContent = [ms.length ? `${ms.join(" · ")} milestone${ms.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ");
  const amt = document.getElementById("srAmount"); const t0 = performance.now();
  const tick = (now) => { const k = Math.min((now - t0 - 600) / 900, 1); amt.textContent = `+${Math.round(coins * (k <= 0 ? 0 : 1 - Math.pow(1 - k, 3)))}`; if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  document.getElementById("srDone").onclick = () => { ov.classList.add("out"); setTimeout(() => { ov.hidden = true; ov.classList.remove("out"); }, 450); };
}

// ---- starter chooser ----
const STARTERS = ANIMALS.filter((a) => a.key === "animal_pup" || a.key === "animal_cat");
async function maybeChoose() {
  const w = document.getElementById("welcome");
  const modal = document.getElementById("adoptModal");
  const e = await getEcon();
  if (e.adopted) { w.hidden = true; return; }
  // the chooser appears under the welcome, which then fades over it, so home is never visible in between
  w.hidden = false;
  await new Promise((res) => { let done = false; const go = () => { if (done) return; done = true; res(); }; w.onclick = go; setTimeout(go, 5200); });
  modal.hidden = false;
  w.classList.add("out");
  setTimeout(() => { w.hidden = true; w.classList.remove("out"); }, 450);
  await Promise.all([stageArt("choosePup", STARTERS[1], 104), stageArt("chooseCat", STARTERS[0], 104)]);
  const pick = async (a) => {
    const now = await getEcon();
    if (now.adopted) return;
    const r = await ledgerSpend("adopt_starter", { key: a.key }); // the adoption gift is paid server-side
    if (refused(r)) return;
    modal.hidden = true;
    heroOrder = null;
    celebrateAdoption(a);
    renderHeroPet();
  };
  document.getElementById("pickPup").onclick = () => pick(STARTERS[1]);
  document.getElementById("pickCat").onclick = () => pick(STARTERS[0]);
}

/* @strip:visits */
async function maybeFirstVisit() {
  if (!VISITS) return;
  const { cd_first_visit, first_visit_shown } = await chrome.storage.local.get(["cd_first_visit", "first_visit_shown"]);
  if (!cd_first_visit || first_visit_shown) return;
  const ov = document.getElementById("firstVisit");
  ov.hidden = false;
  document.getElementById("fvDone").onclick = () => { ov.hidden = true; chrome.storage.local.set({ first_visit_shown: true }); };
}
/* @/strip:visits */
async function render() {
  maybeChoose();
  maybeSitePrompt();
  chrome.storage.local.remove(["tour_done", "tour_step", "tour_started", "tour_final_pending"]);
  /* @strip:visits */ maybeFirstVisit(); /* @/strip:visits */
  const {
    cd_streak_display: sd, pet_name, pet_enabled, night_sleep,
  } = await chrome.storage.local.get(["cd_streak_display", "pet_name", "pet_enabled", "night_sleep"]);

  document.getElementById("petToggle").checked = pet_enabled !== false;
  document.getElementById("nightToggle").checked = night_sleep !== false;


  // mood chip: the mood pet.js persisted, streak state as fallback
  const { pet_state } = await chrome.storage.local.get("pet_state");
  let moodKey = pet_state?.mood && MOODS[pet_state.mood] ? pet_state.mood : null;
  if (!moodKey) { moodKey = sd ? (sd.state === "extended" ? "content" : "waiting") : "new"; }
  const [mEmoji, mText] = MOODS[moodKey];
  const chip = document.getElementById("moodChip");
  chip.innerHTML = mText ? `<span>${mEmoji}</span><span>${mText}</span>` : `<span>${mEmoji}</span>`;
  const [mc, mbg] = MOOD_STYLE[moodKey] ?? MOOD_STYLE.waiting;
  chip.style.color = mc; chip.style.background = mbg;
  chip.style.borderColor = mc + "55"; chip.style.borderBottomColor = mc + "77";

  renderTreats();
  renderSiteEnable();

  // streak
  const n = sd?.displayN ?? sd?.n ?? 0;
  const high = sd?.high ?? 0;
  countUp(document.getElementById("streakN"), n);
  countUp(document.getElementById("streakHigh"), high);
  const flame = document.getElementById("flame");
  const stale = document.getElementById("staleLine");
  if (sd?.state === "extended") {
    flame.classList.remove("cold");
    stale.textContent = "";
  } else {
    flame.classList.add("cold");
    stale.textContent = "";
  }

  // milestone progress + payout
  const next = MILESTONES.find((mv) => mv > n) ?? n + 100;
  // the bar measures n out of next from zero, matching the label
  const pct = Math.max(4, Math.min(100, (n / next) * 100));
  document.getElementById("progLabel").textContent = `${next}-day milestone · ${n} / ${next}`;
  const payout = MILESTONE_POINTS[next];
  document.getElementById("progPayout").innerHTML = payout ? `+${payout} ${coin(13)}` : "";
  requestAnimationFrame(() => { document.getElementById("fill").style.width = `${pct}%`; });

  // coins
  const e = await getEcon();
  setCoins(e.balance);
  // claim covers the newcomer reward (once) plus every unclaimed milestone
  const claim = document.getElementById("claimStreak");
  const pending = (e.milestones_pending ?? []).length > 0;
  claim.hidden = !((n >= 1 && !e.welcome_claimed) || pending);
  claim.onclick = async () => {
    claim.disabled = true;
    const r = await ledgerSpend("claim_streak", { days: n }); claim.disabled = false;
    if (refused(r)) return;
    claim.hidden = true;
    setCoins(r.state.balance);
    showStreakReward(r.result.coins, r.result.parts ?? []);
  };

  // settings: the device id is the handle for deletion requests
  const { device_id } = await chrome.storage.local.get("device_id");
  document.getElementById("sync").textContent = device_id ? `device id ${device_id.slice(0, 8)}…${device_id.slice(-4)}` : "";
  document.getElementById("sync").title = device_id ? `Device id (for data deletion requests): ${device_id}` : "";
}

document.getElementById("nightToggle").onchange = async (e) => {
  await chrome.storage.local.set({ night_sleep: e.target.checked });
};
document.getElementById("fbSend").onclick = async () => {
  const ta = document.getElementById("fbText"), st = document.getElementById("fbStatus"), btn = document.getElementById("fbSend");
  const message = ta.value.trim();
  if (message.length < 3) { st.textContent = "Say a little more?"; return; }
  btn.disabled = true; st.textContent = "Sending…";
  try {
    const device_id = await ledgerDeviceId();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
    const { extra_hosts = [] } = await chrome.storage.local.get("extra_hosts");
    const tabHost = tab?.url ? new URL(tab.url).hostname : "";
    const host = /\.instructure\.com$/i.test(tabHost) || extra_hosts.includes(tabHost) ? tabHost : "";
    await netFeedback({ device_id, message, version: chrome.runtime.getManifest().version, host });
    ta.value = ""; st.textContent = "Sent. Thank you.";
  } catch { st.textContent = "Couldn't send — try again in a bit."; }
  btn.disabled = false;
  setTimeout(() => (st.textContent = ""), 4000);
};

document.getElementById("copyId").onclick = async (e) => {
  const { device_id } = await chrome.storage.local.get("device_id");
  if (!device_id) { e.target.textContent = "No device id yet"; return; }
  try { await navigator.clipboard.writeText(device_id); e.target.textContent = "Copied ✓"; } catch { e.target.textContent = device_id; }
  setTimeout(() => (e.target.textContent = "Copy device id"), 1800);
};
document.getElementById("whyBtn").onclick = (e) => {
  const card = document.getElementById("whyCard");
  card.hidden = !card.hidden;
  e.currentTarget.setAttribute("aria-expanded", String(!card.hidden));
};

document.getElementById("petToggle").onchange = async (e) => {
  await chrome.storage.local.set({ pet_enabled: e.target.checked });
};

// ---- other Canvas domains ----
// permissions.request must run inside the click handler; the registered scripts persist across restarts
async function renderSiteEnable() {
  const btn = document.getElementById("enableSite");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const u = tab?.url ? new URL(tab.url) : null;
    if (!u || u.protocol !== "https:" || /\.instructure\.com$/i.test(u.hostname)) { btn.hidden = true; return; }
    const origin = `${u.origin}/*`;
    const has = await chrome.permissions.contains({ origins: [origin] });
    btn.hidden = false;
    btn.disabled = has;
    btn.textContent = has ? `✓ Enabled on ${u.hostname}` : `Use on ${u.hostname} (my school's Canvas)`;
    btn.onclick = async () => {
      const ok = await chrome.permissions.request({ origins: [origin] });
      if (!ok) return;
      await registerSite(u.hostname, origin);
      renderSiteEnable();
    };
  } catch { btn.hidden = true; }
}

// the popup opens on the tab the icon was clicked on; activeTab lets it look at that page once
async function detectCanvasTab(snoozed) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
  const u = tab?.url ? new URL(tab.url) : null;
  if (!tab?.id || !u || u.protocol !== "https:" || /\.instructure\.com$/i.test(u.hostname)) return null;
  if ((snoozed[u.hostname] ?? 0) > Date.now() - 864e5) return null;
  const origin = `${u.origin}/*`;
  if (await chrome.permissions.contains({ origins: [origin] })) return null;
  const [r] = await chrome.scripting.executeScript({
    target: { tabId: tab.id }, world: "MAIN",
    func: () => Boolean(window.ENV && typeof window.ENV === "object" && ("active_brand_config_json_url" in window.ENV || "ASSET_HOST" in window.ENV || document.getElementById("application"))),
  }).catch(() => [null]);
  return r?.result ? { tab, host: u.hostname, origin } : null;
}
async function maybeSitePrompt() {
  const m = document.getElementById("siteModal");
  if (!m.hidden) return;
  const { cd_econ, site_prompt_snoozed = {} } = await chrome.storage.local.get(["cd_econ", "site_prompt_snoozed"]);
  if (!cd_econ?.adopted) return;
  const c = await detectCanvasTab(site_prompt_snoozed);
  if (!c) return;
  document.getElementById("siteHost").textContent = c.host;
  m.hidden = false;
  document.getElementById("siteNo").onclick = async () => {
    m.hidden = true;
    await chrome.storage.local.set({ site_prompt_snoozed: { ...site_prompt_snoozed, [c.host]: Date.now() } });
  };
  document.getElementById("siteYes").onclick = async () => {
    const ok = await chrome.permissions.request({ origins: [c.origin] });
    if (!ok) return;
    await registerSite(c.host, c.origin);
    m.hidden = true;
    renderSiteEnable();
    chrome.tabs.reload(c.tab.id).catch(() => {});
  };
}
document.addEventListener("cd-ceremony-done", () => maybeSitePrompt());
if (DEV) document.addEventListener("keydown", (e) => {
  if (e.key !== "s" || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const m = document.getElementById("siteModal");
  document.getElementById("siteHost").textContent = "canvas.wisc.edu";
  m.hidden = false;
  document.getElementById("siteNo").onclick = () => { m.hidden = true; };
  document.getElementById("siteYes").onclick = () => { m.hidden = true; };
});

async function registerSite(host, origin) {
  const id = `canvas-${host}`;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] }).catch(() => []);
  if (existing.length) return;
  await chrome.scripting.registerContentScripts([{
    id, matches: [origin], js: ["coin.js", "collar-engine.js", "network.js", "ledger.js", "content.js", "streak.js", "economy.js", "pet.js"],
    runAt: "document_end", persistAcrossSessions: true,
  }]);
  const { extra_hosts = [] } = await chrome.storage.local.get("extra_hosts");
  if (!extra_hosts.includes(host)) await chrome.storage.local.set({ extra_hosts: [...extra_hosts, host] });
}

renderHeroPet();
sprinkleSparkles();
render();
