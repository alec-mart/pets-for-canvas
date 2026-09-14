// Earning side of the economy: turns page events into earn requests. The server decides amounts.
(() => {
  const log = (...a) => console.log("[canvas-digest:econ]", ...a);

  window.cdEarn = (...a) => earn(...a); // pet.js pays the visitor tap through the same path
  async function earn(type, key, note, at) {
    const data = await ledgerEarn(type, key);
    if (!data) return log("queued (offline)", type, key);
    const pts = data.awarded ?? 0;
    if (pts > 0) {
      // `at` = where the user's action happened; coin.js pops the "+N" there
      document.dispatchEvent(new CustomEvent("cd-points", { detail: { pts, balance: data.state?.balance, note, at } }));
      log(`+${pts}`, note, "→", data.state?.balance);
    }
  }

  // verified submission detected (the submission page itself is the receipt)
  document.addEventListener("cd-submission", (ev) => {
    const id = ev.detail?.assignmentId;
    if (id) earn("submission", id, `submitted #${id}`, ev.detail?.at ?? null);
  });

  // streak milestone reached (already verified by streak.js)
  document.addEventListener("cd-streak", (ev) => {
    const m = ev.detail?.milestone;
    if (m) earn("milestone", m, `${m}-day streak`, null);
  });

  ledgerFlush(); // anything queued while offline
})();
