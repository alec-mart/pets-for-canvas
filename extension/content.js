// Catches completion moments on Canvas pages (submission receipt, planner checkoff) and
// notifies the pet, streak and economy. Every network request lives in network.js.

const log = (...args) => console.log("[canvas-digest]", ...args);

// content-script console output is invisible to page tooling; expose state on <html> instead
document.documentElement.setAttribute("data-cd-loaded", new Date().toISOString());
const reportError = (where, err) => {
  document.documentElement.setAttribute("data-cd-error", `${where}: ${err}`);
  log("ERROR", where, err);
};

// once per item; the storage key name predates its current use
async function seenBefore(key) {
  const { asked = {} } = await chrome.storage.local.get("asked");
  return Boolean(asked[key]);
}
async function markSeen(key) {
  const { asked = {} } = await chrome.storage.local.get("asked");
  asked[key] = Date.now();
  await chrome.storage.local.set({ asked });
}

// the pet reacts and the streak rechecks; the economy pays only on receipts (economy.js)
async function completion(key, title) {
  try {
    if (await seenBefore(key)) return;
    await markSeen(key);
    document.dispatchEvent(new CustomEvent("cd-completion", { detail: { title } }));
  } catch (err) {
    reportError("completion", err);
  }
}

// ---------- detector 1: assignment submission confirmation ----------

// Canvas reloads onto the receipt page, so the click point has to survive in sessionStorage
window.addEventListener("pointerdown", (e) => {
  try {
    if (!/\/courses\/\d+\/assignments\/\d+/.test(location.pathname)) return;
    const btn = e.target?.closest?.("button, input[type=submit], a.btn, [role=button]");
    if (!btn) return;
    const txt = (btn.textContent || btn.value || "").trim();
    if (!/^(submit|turn in)/i.test(txt)) return;
    sessionStorage.setItem("cd_submit_at", JSON.stringify({ x: e.clientX, y: e.clientY, ts: Date.now() }));
  } catch {}
}, { capture: true, passive: true });

function takeSubmitPoint(signalEl) {
  try {
    const raw = sessionStorage.getItem("cd_submit_at");
    sessionStorage.removeItem("cd_submit_at");
    const p = raw && JSON.parse(raw);
    if (p && Date.now() - p.ts < 120000) return { x: p.x, y: p.y };
  } catch {}
  // no remembered click (e.g. reloaded the receipt later): pop on the "Submitted" box
  const r = signalEl?.getBoundingClientRect?.();
  return r && r.width ? { x: r.left + Math.min(r.width / 2, 120), y: r.top + r.height / 2 } : null;
}

// ---------- detector 1b: the submission record itself ----------
// The receipt DOM differs between Canvas builds and is absent for quizzes and SPA submits, so the
// assignment's own submission record (same-origin session) is the fallback truth. Only a recent
// submission counts, so a mid-semester install cannot be paid for last month's work.
const RECENT_MS = 7 * 86400000;
let firedThisPage = new Set();
async function verifySubmission(courseId, assignmentId, at) {
  const key = `${courseId}:${assignmentId}`;
  if (firedThisPage.has(key)) return;
  const stamp = `cd_verified:${key}`;
  try {
    const last = Number(sessionStorage.getItem(stamp) || 0);
    if (Date.now() - last < 60000) return; // a few polls after a submit click, not a loop
    sessionStorage.setItem(stamp, String(Date.now()));
  } catch {}
  let sub;
  try { sub = await netCanvasJson(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`); }
  catch (err) { document.documentElement.setAttribute("data-cd-verify", `error ${err}`); return; }
  const state = sub?.workflow_state, when = sub?.submitted_at ? Date.parse(sub.submitted_at) : 0;
  const ok = ["submitted", "graded", "pending_review"].includes(state) && when && Date.now() - when < RECENT_MS;
  document.documentElement.setAttribute("data-cd-verify", `${key} ${state} ${sub?.submitted_at || "-"} ${ok ? "recent" : "no"}`);
  if (!ok || firedThisPage.has(key)) return;
  firedThisPage.add(key);
  log("submission verified via record", { courseId, assignmentId, state });
  document.dispatchEvent(new CustomEvent("cd-submission", { detail: { courseId, assignmentId, at: at ?? null } }));
  completion(`a:${courseId}:${assignmentId}`, document.querySelector("h1")?.textContent?.trim() || "that assignment");
}
async function verifyCurrentPage(at) {
  const a = location.pathname.match(/\/courses\/(\d+)\/assignments\/(\d+)/);
  if (a) return verifySubmission(a[1], a[2], at);
  const q = location.pathname.match(/\/courses\/(\d+)\/quizzes\/(\d+)/);
  if (q) {
    try {
      const quiz = await netCanvasJson(`/api/v1/courses/${q[1]}/quizzes/${q[2]}`);
      if (quiz?.assignment_id) return verifySubmission(q[1], String(quiz.assignment_id), at);
    } catch {}
  }
}
// after a Submit click, the record can lag the page by a few seconds
window.addEventListener("pointerdown", (e) => {
  try {
    if (!/\/courses\/\d+\/(assignments|quizzes)\/\d+/.test(location.pathname)) return;
    const btn = e.target?.closest?.("button, input[type=submit], a.btn, [role=button]");
    const txt = (btn?.textContent || btn?.value || "").trim();
    if (!btn || !/^(submit|turn in)/i.test(txt)) return;
    const at = { x: e.clientX, y: e.clientY };
    for (const ms of [3000, 8000, 20000]) setTimeout(() => { try { sessionStorage.removeItem(`cd_verified:${location.pathname}`); } catch {} verifyCurrentPage(at); }, ms);
  } catch {}
}, { capture: true, passive: true });

function checkSubmissionConfirmation() {
  const m = location.pathname.match(/\/courses\/(\d+)\/assignments\/(\d+)/);
  if (!m) { verifyCurrentPage(null); return; }
  const [, courseId, assignmentId] = m;

// several DOM generations of the receipt sidebar; "not submitted" must never match
  const isReceipt = (t) => /turned in|submitted/i.test(t) && !/not\s+submitted|unsubmitted|no submission/i.test(t);
  const signal =
    document.querySelector(".submission_details, #sidebar_content .submitted") ||
    Array.from(document.querySelectorAll("#right-side h3, #right-side h4, [data-testid]")).find(
      (el) => isReceipt(el.textContent || "")
    );
  if (!signal) { verifyCurrentPage(null); return; }
  firedThisPage.add(`${courseId}:${assignmentId}`);

  const title =
    document.querySelector("h1")?.textContent?.trim() ||
    document.title.replace(/^.*?:\s*/, "") ||
    "that assignment";
  log("submission confirmation detected", { courseId, assignmentId, title });
  // the receipt page is what the economy pays on; the server dedupes
  const at = takeSubmitPoint(signal);
  document.dispatchEvent(new CustomEvent("cd-submission", { detail: { courseId, assignmentId, at } }));
  completion(`a:${courseId}:${assignmentId}`, title);
}

// ---------- detector 2: planner checkbox ----------
//
// Checkbox: input[data-testid="planner-item-completed-checkbox"]
// Row:      [data-testid="planner-item-raw"], whose <label> reads
//           "<Type> <Title> is (not) marked as done." and whose first <a>
//           href carries /courses/<id>/<kind>/<id>.

const COMPLETION_TYPES = new Set(["assignment", "quiz", "discussion", "to do", ""]);

// InstUI checkboxes are React-controlled and the checked property is unreliable inside the
// change event, so let Canvas re-render and re-read the DOM
function evaluateRowByHref(href) {
  const row = Array.from(document.querySelectorAll('[data-testid="planner-item-raw"]')).find(
    (r) => r.querySelector("a")?.getAttribute("href") === href
  );
  if (!row) return log("row gone after toggle (collapsed?)", href);

  const cb = row.querySelector('input[data-testid="planner-item-completed-checkbox"]');
  const labelText = row.querySelector("label")?.textContent ?? "";
  const completed = cb?.checked || /is\s+marked as done/i.test(labelText);
  if (!completed) return log("settled state: not completed", href);

  const m = labelText.match(
    /^(Assignment|Quiz|Discussion|Announcement|Calendar Event|To Do|Page)?\s*(.+?)\s+is\s+(?:not\s+)?marked as done/i
  );
  const type = (m?.[1] ?? "").toLowerCase();
  const title = m?.[2]?.trim() || "that item";
  if (!COMPLETION_TYPES.has(type)) {
    return log("checkoff ignored (type)", { type, title });
  }

  const ids = href.match(/\/courses\/(\d+)\/(?:assignments|quizzes|discussion_topics)\/(\d+)/);
  log("planner checkoff detected", { type, title, href });
  completion(ids ? `p:${ids[1]}:${ids[2]}` : `p:${title}`, title);
}

document.addEventListener(
  "change",
  (e) => {
    const cb = e.target;
    if (!cb?.matches?.('input[data-testid="planner-item-completed-checkbox"]')) return;
    const href = cb.closest('[data-testid="planner-item-raw"]')?.querySelector("a")?.getAttribute("href");
    if (!href) return;
    setTimeout(() => evaluateRowByHref(href), 700);
  },
  true
);

// ---------- SPA-aware: re-run detector 1 on every in-page navigation ----------

let lastHref = "";
new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    firedThisPage = new Set();
    setTimeout(checkSubmissionConfirmation, 800);
  }
}).observe(document.body, { childList: true, subtree: true });

checkSubmissionConfirmation();
// queue left behind by older versions: delete, never send
chrome.storage.local.remove(["reports", "estimates_enabled", "asks_enabled"]).catch(() => {});
syncIdentityWithCanvas().then(() => ledgerGet()).catch(() => {}); // same login, same ledger; also creates this device's ledger

/* @strip:visits */
// ---- visits: presence heartbeat (opt-in) ----
async function syncCourses() {
  const { cd_courses } = await chrome.storage.local.get("cd_courses");
  if (cd_courses?.host === location.host && Date.now() - cd_courses.at < 6 * 3600 * 1000) return cd_courses.ids;
  try {
    const ids = (await netCanvasJson(`/api/v1/courses?enrollment_state=active&per_page=50`)).map((c) => c.id).filter(Number.isInteger);
    await chrome.storage.local.set({ cd_courses: { host: location.host, ids, at: Date.now() } });
    return ids;
  } catch { return []; }
}
const VISITS = false; // dormant
async function presenceHeartbeat() {
  if (!VISITS) return;
  try {
    const { visits_enabled, device_id, pet_name, cd_streak_display } = await chrome.storage.local.get(["visits_enabled", "device_id", "pet_name", "cd_streak_display"]);
    if (visits_enabled !== true || !device_id || document.hidden) return;
    const courses = await syncCourses();
    if (!courses.length) return;
    await netPresence({ device_id, host: location.host, courses, pet_name: pet_name ?? "", best_streak: cd_streak_display?.high ?? 0 });
  } catch {}
}
setTimeout(presenceHeartbeat, 4000);
setInterval(presenceHeartbeat, 5 * 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) presenceHeartbeat(); });
/* @/strip:visits */
log("content script loaded");
