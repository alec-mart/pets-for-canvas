// Streak tracking. A streak is a start date; days with nothing due are safe; today goes from
// stale to extended once everything due is done.
// Debug: set cd_streak_debug_date (ISO string) in chrome.storage.

(() => {
  const log = (...a) => console.log("[canvas-digest:streak]", ...a);
  const MILESTONES = [7, 10, 25, 30, 50, 75, 100, 150, 200, 365];
  const DAY = 86400000;

  const dstr = (d) => {
    const a = new Date(d);
    return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
  };
  const parseD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / DAY);

  async function now() {
    try {
      const { cd_streak_debug_date } = await chrome.storage.local.get("cd_streak_debug_date");
      if (cd_streak_debug_date) return new Date(cd_streak_debug_date);
    } catch {}
    return new Date();
  }

  const api = (path) => netCanvasJson(path); // network.js

  // local dates in [fromStr, toStr] with a due task that was actually missed (missing_submissions;
  // external-tool items checked off in the planner are not missed)
  async function missedDates(fromStr, toStr) {
    const raw = await api("/api/v1/users/self/missing_submissions?include[]=planner_overrides&per_page=100");
    const out = new Set();
    for (const a of raw) {
      if (!a.due_at) continue;
      if ((a.submission_types ?? []).includes("external_tool") && a.planner_override?.marked_complete) continue;
      const ds = dstr(new Date(a.due_at));
      if (ds >= fromStr && ds <= toStr) out.add(ds);
    }
    return [...out].sort();
  }

  // anything due today still incomplete? A checkmark grants the same-day glow;
  // a fake one self-corrects tomorrow when verification reads Canvas truth.
  async function incompleteToday(nowD) {
    const start = new Date(nowD); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const raw = await api(`/api/v1/planner/items?start_date=${start.toISOString()}&end_date=${end.toISOString()}&per_page=50`);
    let count = 0;
    for (const it of raw) {
      if (!["assignment", "quiz", "discussion_topic", "sub_assignment"].includes(it.plannable_type)) continue;
      const submitted = it.submissions && it.submissions.submitted;
      const checked = it.planner_override?.marked_complete;
      if (!submitted && !checked) count++;
    }
    return count;
  }

  const EMPTY = { started_at: "", prev_started_at: "", high: 0, last_verified: "", last_expired: "", restored_at: "" };
  async function getState() {
    const { cd_streak } = await chrome.storage.local.get("cd_streak");
    return { ...EMPTY, ...(cd_streak ?? {}) };
  }
  const save = (s) => chrome.storage.local.set({ cd_streak: s });

  async function compute() {
    const nowD = await now();
    const today = dstr(nowD);
    const yesterday = dstr(new Date(parseD(today) - DAY));
    const s = await getState();
    let broke = false;

    if (!s.started_at) {
      // retroactive credit: scan back a year for the most recent missed day
      const yearAgo = dstr(new Date(parseD(today) - 365 * DAY));
      const missed = await missedDates(yearAgo, yesterday);
      // retro credit is capped so a long clean history and a single old miss land in the same range
      const RETRO_CAP = 30;
      const sinceMiss = missed.length ? daysBetween(dstr(new Date(parseD(missed[missed.length - 1]) + DAY)), today) : RETRO_CAP;
      s.started_at = dstr(new Date(parseD(today) - Math.min(sinceMiss, RETRO_CAP) * DAY));
      log("retroactive credit — streak began", s.started_at);
    } else {
      // re-verify from min(last_verified, today-2) — catches late changes
      const twoBack = dstr(new Date(parseD(today) - 2 * DAY));
      let from = s.last_verified && s.last_verified < twoBack ? s.last_verified : twoBack;
      if (from < s.started_at) from = s.started_at;
      if (s.restored_at && from <= s.restored_at) from = dstr(new Date(parseD(s.restored_at) + DAY));
      if (from <= yesterday) {
        const missed = await missedDates(from, yesterday);
        if (missed.length) {
          broke = true;
          s.high = Math.max(s.high, daysBetween(s.started_at, today));
          s.prev_started_at = s.started_at;
          s.started_at = dstr(new Date(parseD(missed[missed.length - 1]) + DAY));
          s.last_expired = nowD.toISOString();
          s.restored_at = "";
          log("streak broke — new start", s.started_at);
        }
      }
    }

    const base = daysBetween(s.started_at, today);
    const openCount = await incompleteToday(nowD);
    const n = openCount > 0 ? base : base + 1;
    const state = openCount > 0 ? "stale" : "extended";
    s.high = Math.max(s.high, n);
    s.last_verified = today;
    await save(s);

    // if another extension's streak pill is on the page and disagrees, display its number;
    // payouts always use the verified n
    let displayN = n;
    const bcText = [...document.querySelectorAll('[class*="bc-streak"]')].map((e) => e.textContent).join(" ");
    const bcMatch = bcText.match(/(\d+)\s*days?/i);
    if (bcMatch) displayN = parseInt(bcMatch[1]);

    const { cd_streak_display: prev } = await chrome.storage.local.get("cd_streak_display");
    await chrome.storage.local.set({
      cd_streak_display: { n, displayN, state, high: s.high, date: today, broke, at: Date.now() },
    });

    const extendedNow = state === "extended" && !(prev && prev.date === today && prev.state === "extended");
    document.dispatchEvent(new CustomEvent("cd-streak", {
      detail: { streak: n, state, high: s.high, broke, extendedNow, milestone: extendedNow && MILESTONES.includes(n) ? n : null },
    }));
    if (extendedNow) {
      // treats per streak day; worn-collar perks: ember +1 plain per day, gold a plain treat a day,
      // comet +1 rare at milestones
      const { cd_treats, cd_econ } = await chrome.storage.local.get(["cd_treats", "cd_econ"]);
      const worn = cd_econ?.equipped?.collar;
      const t = cd_treats ?? { plain: 0, rare: 0 };
      t.plain = (t.plain ?? 0) + 2 + (worn === "ember" ? 1 : 0) + (worn === "gold" ? 1 : 0);
      if (MILESTONES.includes(n)) t.rare = (t.rare ?? 0) + 1 + (worn === "comet" ? 1 : 0);
      await chrome.storage.local.set({ cd_treats: t });
    }
    log("streak", { n, displayN, state, high: s.high, broke });
  }

/* @strip:dev */
  // dev bridge (dev builds only; the store build blanks LEDGER_DEV_SECRET). The page writes a JSON
  // op into data-cd-dev on <html> and fires cd-dev: {op:"reset"} wipes the install,
  // {op:"streak", days:N} sets a streak.
  {
    document.addEventListener("cd-dev", async () => {
      try {
        await LEDGER_DEV_READY;
        if (!LEDGER_DEV_SECRET) return;
        const op = JSON.parse(document.documentElement.dataset.cdDev || "{}");
        if (op.op === "reset") { await chrome.storage.local.clear(); log("DEV: install reset"); document.documentElement.dataset.cdDevDone = "reset"; }
        if (op.op === "streak") {
          const nowD = await now(); const today = dstr(nowD);
          const started = dstr(new Date(parseD(today) - (op.days - 1) * DAY));
          await chrome.storage.local.set({ cd_streak: { started_at: started, prev_started_at: "", high: op.days, last_verified: dstr(new Date(parseD(today) - DAY)), last_expired: "", restored_at: "" } });
          log("DEV: streak set", op.days, "started", started); document.documentElement.dataset.cdDevDone = "streak";
        }
      } catch (e) { log("DEV op failed", String(e)); }
    });
  }
/* @/strip:dev */

  // no free mend; prev_started_at / last_expired stay recorded for a future paid mend

  const run = () => compute().catch((e) => log("compute failed", String(e)));
  setTimeout(run, 2500);
  setInterval(run, 30 * 60 * 1000);
  // recheck right after completion moments
  document.addEventListener("cd-completion", () => setTimeout(run, 1500));
})();
