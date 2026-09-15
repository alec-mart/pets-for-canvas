// Every network request the extension makes. Two destinations: the API (ledger, promo codes,
// feedback) and the student's own Canvas session (read-only checks plus one private write,
// the device id in custom data). Loaded before every other script.

const API = "https://canvas-digest-production.up.railway.app";
let LEDGER_DEV_SECRET = "";
/* @strip:dev */
// dev copies keep the secret in extension storage (cd_dev_secret), never in source
const LEDGER_DEV_READY = chrome.storage.local.get("cd_dev_secret").then((r) => { LEDGER_DEV_SECRET = r.cd_dev_secret || ""; }).catch(() => {});
/* @/strip:dev */

// ---- API ----

// GET the ledger for this install. Sends: the anonymous device id and whether the pet is switched on.
async function netLedgerGet(deviceId, petOn = null) {
  const q = petOn === null ? "" : `?pet=${petOn ? 1 : 0}`;
  const r = await fetch(`${API}/ledger/${deviceId}${q}`, { cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).state;
}

// POST an earn event. Sends: device id, event type ("submission" | "milestone"), and the key
// it is for (the assignment id, or the milestone day count). Returns { ok, status, data }.
async function netLedgerEarn(deviceId, type, key) {
  const r = await fetch(`${API}/ledger/${deviceId}/earn`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, key }),
  });
  return { ok: r.ok, status: r.status, data: r.ok ? await r.json() : null };
}

// POST a spend / shop action (equip, buy, adopt, rename, open box, claim streak, redeem code…).
// Sends: device id, the action, and its arguments (an item id, a name, a code). Returns { ok, status, data }.
async function netLedgerSpend(deviceId, action, body = {}) {
  const headers = { "content-type": "application/json" };
  /* @strip:dev */
  await LEDGER_DEV_READY;
  if (typeof DEV !== "undefined" && DEV && LEDGER_DEV_SECRET) headers["x-dev"] = LEDGER_DEV_SECRET;
  /* @/strip:dev */
  const r = await fetch(`${API}/ledger/${deviceId}/spend`, { method: "POST", headers, body: JSON.stringify({ action, ...body }) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

// POST feedback typed into Settings. Sends: device id, the message, the extension version,
// and the Canvas domain of the current tab (so a bug report can be tied to a campus).
async function netFeedback({ device_id, message, version, host }) {
  const r = await fetch(`${API}/feedback`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_id, message, version, host }),
  });
  if (!r.ok) throw new Error(String(r.status));
}

/* @strip:sync */
// sync codes: mint on one install, type on another to adopt the same ledger
async function netLedgerSyncCode(deviceId) {
  const r = await fetch(`${API}/ledger/${deviceId}/code`, { method: "POST" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json(); // { code, expires_in }
}
async function netLedgerClaim(code) {
  const r = await fetch(`${API}/ledger/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(String(r.status));
  return r.json(); // { device_id, state }
}
/* @/strip:sync */

/* @strip:visits */
// visits: presence heartbeat and visitor lookup (dormant)
async function netPresence({ device_id, host, courses, pet_name, best_streak }) {
  await fetch(`${API}/presence`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ device_id, host, courses, pet_name, best_streak }),
  });
}
async function netVisitor(deviceId, host, courses) {
  const r = await fetch(`${API}/visitor?device_id=${deviceId}&host=${encodeURIComponent(host)}&courses=${courses.join(",")}`, { cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).visitor;
}
/* @/strip:visits */

// ---- the student's own Canvas (same-origin session, never a token) ----

// GET a Canvas API path as JSON (missing_submissions and planner items for streak/overdue state; courses for visits)
async function netCanvasJson(path) {
  const r = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return JSON.parse((await r.text()).replace(/^while\(1\);/, "")); // Canvas prefixes session JSON with while(1);
}

// private per-user custom data, readable only by that login; holds the device id. Content-script only.
const CANVAS_NS = "com.petsforcanvas";
async function netCanvasCustomData(method, body) {
  const csrf = decodeURIComponent((document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]+)/) || [])[1] || "");
  const r = await fetch(`${location.origin}/api/v1/users/self/custom_data/pets?ns=${CANVAS_NS}`, {
    method, credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/json", "x-csrf-token": csrf },
    body: body ? JSON.stringify({ ns: CANVAS_NS, data: body }) : undefined,
  });
  if (method === "GET" && (r.status === 400 || r.status === 404)) return null; // nothing stored yet
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).data ?? null;
}
