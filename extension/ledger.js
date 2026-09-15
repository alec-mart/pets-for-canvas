// Economy client. The server owns all state; cd_econ in chrome.storage mirrors its last answer.
// Earn events queue offline. Requests live in network.js.

let mintP = null;
async function ledgerDeviceId() {
  const { device_id } = await chrome.storage.local.get("device_id");
  if (device_id) return device_id;
  return (mintP ??= mintDeviceId());
}
// concurrent contexts (page + popup) each propose an id; after a settle the earliest proposal wins in every context
async function mintDeviceId() {
  const mine = { id: crypto.randomUUID().replace(/-/g, ""), t: Date.now() };
  await chrome.storage.local.set({ [`mint_${mine.id.slice(0, 8)}`]: mine });
  await new Promise((r) => setTimeout(r, 300));
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("mint_"));
  const win = all.device_id ?? keys.map((k) => all[k]).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1))[0].id;
  await chrome.storage.local.set({ device_id: win });
  await chrome.storage.local.remove(keys);
  return win;
}
async function ledgerMirror(state) { if (state) await chrome.storage.local.set({ cd_econ: state }); return state; }

let ledgerMemo = { at: 0, state: null };
async function ledgerGet({ fresh = false } = {}) {
  if (!fresh && ledgerMemo.state && Date.now() - ledgerMemo.at < 1500) return ledgerMemo.state;
  await ledgerFlush();
  try {
    const state = await netLedgerGet(await ledgerDeviceId());
    ledgerMemo = { at: Date.now(), state };
    return ledgerMirror(state);
  } catch {
    const { cd_econ } = await chrome.storage.local.get("cd_econ"); // offline: show the last mirror
    return cd_econ ?? { balance: 0, lifetime: 0, owned: ["collar_coral"], equipped: { collar: "coral" }, names: {}, free_boxes: 0, offline: true };
  }
}

// spends: the server validates; a refusal comes back as { error }
async function ledgerSpend(action, body = {}) {
  try {
    const { ok, status, data } = await netLedgerSpend(await ledgerDeviceId(), action, body);
    if (!ok) return { error: data.detail ?? `error ${status}` };
    ledgerMemo = { at: Date.now(), state: data.state };
    await ledgerMirror(data.state);
    return data;
  } catch { return { error: "offline" }; }
}

// earns: queued if offline, flushed in order; returns { awarded, state } or null when queued
async function ledgerEarn(type, key) {
  const { ledger_queue = [] } = await chrome.storage.local.get("ledger_queue");
  ledger_queue.push({ type, key: String(key), ts: Date.now() });
  await chrome.storage.local.set({ ledger_queue });
  return ledgerFlush(type, String(key));
}
let flushing = false;
async function ledgerFlush(wantType = null, wantKey = null) {
  if (flushing) return null;
  flushing = true;
  let wanted = null;
  try {
    const { ledger_queue = [] } = await chrome.storage.local.get("ledger_queue");
    const id = await ledgerDeviceId();
    while (ledger_queue.length) {
      const ev = ledger_queue[0];
      const r = await netLedgerEarn(id, ev.type, ev.key);
      if (!r.ok && r.status !== 422) break; // offline or throttled: keep the queue, try later
      const data = r.data ?? { awarded: 0, state: null };
      if (data.state) { ledgerMemo = { at: Date.now(), state: data.state }; await ledgerMirror(data.state); }
      if (ev.type === wantType && ev.key === wantKey) wanted = data;
      ledger_queue.shift();
      await chrome.storage.local.set({ ledger_queue });
    }
  } catch {} finally { flushing = false; }
  return wanted;
}

/* @strip:sync */
// sync codes: mint one here, type it on another install to adopt this ledger (second laptop, reinstall)
async function ledgerSyncCode() {
  try { return await netLedgerSyncCode(await ledgerDeviceId()); } // { code: "ABCD-EFGH", expires_in }
  catch { return { error: "offline" }; }
}
async function ledgerClaim(code) {
  try {
    const res = await netLedgerClaim(code);
    if (!res) return { error: "bad_code" };
    const { device_id, state } = res;
    // this install now IS that ledger: swap the id, drop the old mirror and queue, and start clean
    await chrome.storage.local.set({ device_id, cd_econ: state, ledger_queue: [] });
    ledgerMemo = { at: Date.now(), state };
    return { state };
  } catch { return { error: "offline" }; }
}
/* @/strip:sync */

// identity: the device id is stored in the user's private Canvas custom data, so any install
// under the same login adopts the same ledger. Content-script only.
async function syncIdentityWithCanvas() {
  try {
    const host = location.host;
    const { device_id: local, cd_canvas_sync } = await chrome.storage.local.get(["device_id", "cd_canvas_sync"]);
    if (cd_canvas_sync?.host === host && Date.now() - cd_canvas_sync.at < 6 * 3600 * 1000) return;
    const remote = (await netCanvasCustomData("GET"))?.device_id;
    if (remote && /^[a-z0-9]{8,64}$/.test(remote)) {
      if (remote !== local) { // this install becomes the person's existing ledger
        await chrome.storage.local.set({ device_id: remote, ledger_queue: [] });
        await chrome.storage.local.remove("cd_econ");
        ledgerMemo = { at: 0, state: null };
        await ledgerGet({ fresh: true });
      }
    } else {
      await netCanvasCustomData("PUT", { device_id: await ledgerDeviceId() });
    }
    await chrome.storage.local.set({ cd_canvas_sync: { host, at: Date.now() } });
  } catch { /* offline, or a school without custom data: the local id still works */ }
}
