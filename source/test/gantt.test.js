// v68: the Schedule tab — a Gantt chart of the rehab milestones. The engine (work days, dependencies, locks,
// loops, the critical path, templates) and the tab (editing, Done synced with the Stages tab, undo/redo, target,
// critical path, weekends, templates, groups, dragging, full screen, PDF).
const fs = require("fs"),
  vm = require("vm"),
  babel = require("@babel/core");
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};

// ---------- the engine, straight from the built source ----------
const src = fs.readFileSync(__dirname + "/../dist/app.jsx", "utf8");
const code = babel.transformSync(src.slice(0, src.indexOf("function App()")), { babelrc: false, configFile: false, sourceType: "script", presets: [["@babel/preset-react", { runtime: "classic" }]] }).code;
const C = { React: { useState() {}, useMemo() {}, useEffect() {}, useRef() {}, createElement() {}, Fragment: "F" }, window: {}, localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(C);
vm.runInContext(code + ";this.__g={schedOf,gtApplyTemplate,GT_TEMPLATES,GT_STAGES,PROJECT_NAV};", C);
const { schedOf, gtApplyTemplate, GT_TEMPLATES } = C.__g;

const T = "2026-11-25"; // a Wednesday
const mg = (ms, rehab = {}, extra = {}) => ({ closing: { date: "2026-10-30" }, contract: {}, ...extra, rehab: { startDate: "2026-11-02", targetEnd: "", milestones: ms, ...rehab } });
const ids = (n) => Array.from({ length: n }, (_, i) => ({ id: "t" + (i + 1), label: "Task " + (i + 1), status: "todo" }));
const by = (S, id) => S.tasks.find((k) => k.id === id);

console.log("1. Engine: work days and dependencies");
let S = schedOf(mg(ids(3)), T);
assert(S.start === "2026-11-02" && by(S, "t1").start === "2026-11-02" && by(S, "t1").end === "2026-11-06", "starts on the rehab start; 5 work days by default: Mon 11/02 – Fri 11/06");
assert(by(S, "t2").start === "2026-11-09" && by(S, "t3").end === "2026-11-20" && S.end === "2026-11-20" && S.workDays === 15, "each task follows the one above it, over the weekend: finish Fri 11/20, 15 work days");
let ms = ids(3);
ms[0].dur = 3;
ms[0].auto = false;
ms[0].start = "2026-11-05";
S = schedOf(mg(ms), T);
assert(by(S, "t1").start === "2026-11-05" && by(S, "t1").end === "2026-11-09" && by(S, "t2").start === "2026-11-10" && !by(S, "t1").auto, "locked to Thu 11/05 for 3 days: ends Mon 11/09; the next one starts Tue 11/10");
ms = ids(3);
ms[0].dur = 2;
ms[1].dur = 4;
ms[1].after = [];
ms[2].after = ["t1", "t2"];
S = schedOf(mg(ms), T);
assert(by(S, "t2").start === "2026-11-02" && by(S, "t3").start === "2026-11-06", "two predecessors (2 and 4 days, side by side): it starts when the later one ends");
assert(by(S, "t2").critical && by(S, "t3").critical && !by(S, "t1").critical && by(S, "t1").slack === 2, "critical path: the 4-day branch; the 2-day one has 2 days of slack");
ms = ids(3);
ms[0].after = ["t3"];
S = schedOf(mg(ms), T);
assert(S.dropped.length === 1 && S.tasks.every((k) => /^\d{4}-\d\d-\d\d$/.test(k.start)), "a loop (1 → 2 → 3 → 1) is ignored and reported; every task still has dates");
S = schedOf(mg(ids(2), { sched: { workdays: 6 } }), T);
assert(by(S, "t2").start === "2026-11-07" && by(S, "t2").end === "2026-11-12", "Mon–Sat: the second task starts Saturday and skips Sunday");
S = schedOf(mg(ids(2), { sched: { workdays: 7 } }), T);
assert(by(S, "t2").start === "2026-11-07" && by(S, "t2").end === "2026-11-11", "7 days a week: no days off");
ms = ids(3);
ms[2].dur = 0;
S = schedOf(mg(ms), T);
assert(by(S, "t3").start === "2026-11-13" && by(S, "t3").end === "2026-11-13" && S.end === "2026-11-13", "a 0-day milestone falls on the day the task before it ends");
ms[2] = { ...ms[2], auto: false, start: "2026-11-18" };
S = schedOf(mg(ms), T);
assert(by(S, "t3").start === "2026-11-18" && !by(S, "t3").conflict, "a milestone locked to a date sits on that date");

console.log("2. Engine: where it starts, late and behind");
const nostart = (extra, sched) => schedOf({ ...mg(ids(1), { startDate: "", sched }), ...extra }, T);
assert(nostart({ closing: { date: "2026-10-30" } }).start === T && nostart({ closing: { date: "2026-10-30" } }).anchor.from === "today", "rehab not started, closed in the past: the schedule starts today");
assert(nostart({ closing: { date: "" }, contract: { expectedClosing: "2026-12-07" } }).start === "2026-12-07", "under contract: from the expected closing");
assert(nostart({}, { start: "2026-12-14" }).start === "2026-12-14", "a planned start wins");
ms = ids(4);
ms[0].status = "done";
S = schedOf(mg(ms), T);
assert(!by(S, "t1").late && by(S, "t2").late && by(S, "t3").late && by(S, "t4").behind, "on 11/25: done is not late; tasks that should have ended are late; one that should have started is behind");

console.log("3. Engine: templates");
const full = gtApplyTemplate({ milestones: [] }, "full", "replace");
S = schedOf(mg(full.milestones, { groups: full.groups }), T);
assert(full.milestones.length === 22 && full.groups.length === 4 && S.groups.every((g) => g.n > 0), "full rehab: 22 tasks in 4 groups");
assert(S.workDays === 52 && S.end === "2027-01-12" && by(S, full.milestones[21].id).dur === 0, "52 work days from Mon 11/02: ready to list on Tue 01/12/2027");
const app = gtApplyTemplate({ milestones: ids(2) }, "cosmetic", "append");
S = schedOf(mg(app.milestones, { groups: app.groups }), T);
assert(app.milestones.length === 15 && app.milestones[2].after[0] === "t2" && S.tasks[2].start === "2026-11-16", "cosmetic added after two tasks: its first task follows the current last one");

// ---------- the tab ----------
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mmdd = (s) => `${s.slice(5, 7)}/${s.slice(8, 10)}/${s.slice(0, 4)}`;
const monday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 21);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
})();
const addWork = (s, n) => {
  const d = new Date(s + "T00:00");
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() % 6) n--;
  }
  return iso(d);
};
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const deal = {
  address: "12 Gantt Ln, Cleveland, OH 44102", sqft: 1300, holdMonths: 5, arv: 260000, purchase: 120000, repairs: [], useRepairBuilder: false, manualRepair: 50000, pm: { type: "flat", val: 0 },
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.16, intRateRehab: 0.16, points: 0, investorAuto: true, investorRate: 0.09,
  taxAnnual: 0, insMonthly: 0, utilGas: 0, utilWater: 0, utilElec: 0, hoaMonthly: 0, miscHold: 0, buyTxn: txn(), sellTxn: txn(), actuals: [], stage: "rehab",
  mgmt: {
    closing: { date: monday, price: 120000 },
    rehab: { startDate: monday, targetEnd: "", endDate: "", milestones: [{ id: "m1", label: "Demo & cleanout", status: "todo" }, { id: "m2", label: "Rough-ins", status: "todo" }, { id: "m3", label: "Paint & floors", status: "todo" }] },
  },
};

(async () => {
  const drive = makeDrive();
  const fid = drive.add("12 Gantt Ln, Cleveland, OH 44102.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, win, click, btn, setVal, settle, sleep, nav } = t;
  let printed = 0;
  win.print = () => printed++;
  const saved = () => JSON.parse(drive.files[fid].content);
  const G = () => doc.querySelector(".gantt");
  const rows = () => [...G().querySelectorAll(".gt-r.task")];
  const row = (label) => rows().find((r) => r.querySelector(".gt-name").value === label);
  const tool = (l) => [...G().querySelectorAll(".gt-tools .gt-tb")].find((b) => b.getAttribute("aria-label") === l);
  const finish = () => G().querySelector(".gt-finish").textContent;
  const blur = async (el) => {
    el.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true }));
    await settle(3);
  };

  console.log("4. The tab");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(60);
  await settle(12);
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("12 Gantt Ln")));
  await sleep(30);
  await settle(8);
  assert([...doc.querySelectorAll(".ptabs button")].map((b) => b.textContent).join("|").includes("Stages and milestones|Schedule|Expenses"), "a Schedule tab after Stages and milestones");
  await click(nav(/^Schedule/));
  assert(G() && rows().length === 3 && rows()[1].querySelector(".gt-date").value === addWork(monday, 5), "the three milestones, one after the other, 5 work days each");
  assert(finish() === mmdd(addWork(monday, 14)) && /15 work days/.test(G().querySelector(".gt-sum").textContent), `finish ${finish()}: 15 work days from the rehab start`);
  assert(G().querySelectorAll(".gt-bar").length === 3 && G().querySelectorAll(".gt-arrows > path").length === 2, "three bars, two dependency arrows");

  console.log("5. Edit a duration; tick Done; undo and redo");
  const n1 = row("Demo & cleanout").querySelector(".gt-num");
  await setVal(n1, "3");
  await blur(n1);
  assert(row("Rough-ins").querySelector(".gt-date").value === addWork(monday, 3) && finish() === mmdd(addWork(monday, 12)), "3 days: everything after it moves two work days earlier");
  await click(row("Demo & cleanout").querySelector(".gt-done"));
  assert(row("Demo & cleanout").querySelector(".gt-done").checked && /1 of 3 done/.test(G().textContent), "ticked Done: 1 of 3 done");
  await click(tool("Undo"));
  assert(!row("Demo & cleanout").querySelector(".gt-done").checked, "undo: not done");
  await click(tool("Undo"));
  assert(row("Demo & cleanout").querySelector(".gt-num").value === "5", "undo again: back to 5 days");
  await click(tool("Redo"));
  await click(tool("Redo"));
  assert(row("Demo & cleanout").querySelector(".gt-done").checked && row("Demo & cleanout").querySelector(".gt-num").value === "3", "redo twice: 3 days and done");
  await sleep(1700);
  await settle(6);
  let s = saved();
  let m1 = s.mgmt.rehab.milestones.find((x) => x.id === "m1");
  assert(m1.dur === 3 && m1.status === "done" && m1.doneAt && s.mgmt.log.some((l) => l.text === "Milestone done: Demo & cleanout"), "saved: 3 days, done (with the date), and logged");

  console.log("6. The target");
  await click(btn(/^Use .* as the target$/, G()));
  assert(/on target/.test(G().querySelector(".gt-tgt").textContent) && G().querySelector(".gt-target"), "Use as the target: on target, with a target line");
  await sleep(1700);
  await settle(6);
  assert(saved().mgmt.rehab.targetEnd === addWork(monday, 12) && saved().mgmt.log.some((l) => /^Target completion set to .* from the schedule$/.test(l.text)), "saved the target completion and logged it");

  console.log("7. Predecessors and the critical path");
  await click(row("Paint & floors").querySelector('[aria-label="Task details"]'));
  const panel = () => G().querySelector(".gt-panel");
  await click([...panel().querySelectorAll(".gt-check")].find((l) => /These tasks/.test(l.textContent)).querySelector("input"));
  const pick = [...panel().querySelectorAll(".gt-plist .gt-check")].find((l) => /Rough-ins/.test(l.textContent)).querySelector("input");
  assert(pick.checked, "these tasks: starts from the task above, ticked");
  await click(pick);
  assert(/None ticked: it starts with the project/.test(panel().textContent) && row("Paint & floors").querySelector(".gt-date").value === monday, "none ticked: it starts with the project");
  await click(tool("Critical path"));
  const crit = (label) => G().querySelector(`.gt-bar[data-id="${rows().find((r) => r.querySelector(".gt-name").value === label).dataset.id}"]`).classList.contains("crit");
  assert(crit("Demo & cleanout") && crit("Rough-ins") && !crit("Paint & floors"), "critical: Demo then Rough-ins; Paint & floors has slack");
  assert(/3 work days of slack/.test(panel().textContent), "the panel: 3 work days of slack");
  await click(panel().querySelector('[aria-label="Close"]'));

  console.log("8. Weekends, templates, groups");
  const w0 = parseFloat(G().querySelector(".gt-chart").style.width);
  await click(tool("Hide weekends"));
  const w1 = parseFloat(G().querySelector(".gt-chart").style.width);
  assert(w1 < w0 * 0.8 && !G().querySelector(".gt-we"), `hide weekends: narrower chart (${w0} → ${w1}px), no weekend shading`);
  await click(tool("Templates"));
  await click(btn("Add after current", G().querySelector(".gt-tpl-i")));
  assert(rows().length === 16 && G().querySelectorAll(".gt-r.grp").length === 3, "the cosmetic template added after the current tasks: 16 tasks, 3 groups");
  const grp = G().querySelectorAll(".gt-r.grp")[2];
  await click(grp.querySelector(".gt-caret"));
  assert(rows().length === 9, "collapse Interior: its 7 tasks hide");
  await click(G().querySelectorAll(".gt-r.grp")[2].querySelector(".gt-caret"));
  assert(rows().length === 16, "expand it again");

  console.log("9. Drag a bar");
  const dayW = parseFloat(G().querySelector(".gt-chart").style.backgroundSize) || 18;
  const r2 = row("Rough-ins");
  const was = r2.querySelector(".gt-date").value;
  const bar = G().querySelector(`.gt-bar[data-id="${r2.dataset.id}"]`);
  const ev = (type, x) => bar.dispatchEvent(new win.MouseEvent(type, { bubbles: true, clientX: x, button: 0 }));
  ev("pointerdown", 200);
  await settle(2);
  ev("pointermove", 200 + dayW * 3);
  await settle(2);
  ev("pointerup", 200 + dayW * 3);
  await settle(3);
  const r2b = row("Rough-ins");
  assert(r2b.querySelector(".gt-date").value === addWork(was, 3) && !r2b.querySelector('[aria-label="Auto schedule"]').checked, "dragged 3 work days later: locked to the new start");
  await click(tool("Auto schedule"));
  assert(row("Rough-ins").querySelector(".gt-date").value === was && row("Rough-ins").querySelector('[aria-label="Auto schedule"]').checked, "Auto schedule: back to following its predecessor");

  console.log("10. Done is the same milestone on the Stages tab");
  await click(nav(/^Stages and milestones/));
  const ms3 = [...doc.querySelectorAll(".milestones > div")].find((d) => d.textContent.includes("Demo & cleanout"));
  assert(ms3 && /^Done/.test(ms3.querySelector("button").textContent), "Stages and milestones: Demo & cleanout is Done");
  await click(ms3.querySelector("button"));
  await click(btn("Schedule", doc.querySelector(".milestones").parentElement));
  assert(G() && !row("Demo & cleanout").querySelector(".gt-done").checked, "cycled back to To do there; its Schedule button opens this tab, unticked here");

  console.log("11. Full screen and PDF");
  await click(tool("Full screen"));
  assert(doc.body.querySelector(":scope > .gantt.gt-full") && !doc.getElementById("root").querySelector(".gantt"), "full screen: the chart over the whole page");
  doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle(3);
  assert(!doc.body.querySelector(":scope > .gantt") && doc.getElementById("root").querySelector(".gantt"), "Escape: back in the page");
  await click(tool("Download PDF"));
  assert(doc.body.classList.contains("gt-printing") && doc.body.querySelector(":scope > .gantt.gt-printmode") && !doc.body.querySelector(".gt-printmode .gt-in"), "PDF: a print layout of plain text, landscape");
  await sleep(150);
  assert(printed === 1, "the browser's print dialog opens once");
  await sleep(400);
  await settle(3);
  assert(!doc.body.classList.contains("gt-printing") && doc.getElementById("root").querySelector(".gantt"), "and the page comes back after it");

  console.log("12. Replace with a template; groups saved");
  await click(tool("Templates"));
  await click(btn("Replace current", G().querySelectorAll(".gt-tpl-i")[1]));
  assert(rows().length === 22 && G().querySelectorAll(".gt-r.grp").length === 4, "full rehab template: 22 tasks in 4 groups");
  await sleep(1700);
  await settle(6);
  s = saved();
  assert(s.mgmt.rehab.milestones.length === 22 && s.mgmt.rehab.groups.length === 4 && s.mgmt.rehab.milestones.every((x) => x.dur >= 0), "saved with the deal");

  console.log("13. Delete a task: the trash button, the Delete key, Undo");
  const victim = rows()[3];
  const vLabel = victim.querySelector(".gt-name").value;
  await click(victim.querySelector('[aria-label="Delete task"]'));
  assert(rows().length === 21 && !row(vLabel) && /Deleted “.*”/.test(G().querySelector(".gt-flash").textContent), `trash: "${vLabel}" deleted, with a note next to Undo`);
  await click(btn("Undo", G().querySelector(".gt-flash")));
  assert(rows().length === 22 && row(vLabel) && !G().querySelector(".gt-flash"), "Undo in the note: it's back");
  row(vLabel).dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true }));
  await settle(2);
  doc.body.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  await settle(3);
  assert(rows().length === 21 && !row(vLabel), "a selected row and the Delete key: deleted");
  const gRow = G().querySelectorAll(".gt-r.grp")[0];
  const gName = gRow.querySelector(".gt-gname").value;
  await click(gRow.querySelector('[aria-label="Delete group"]'));
  assert(G().querySelectorAll(".gt-r.grp").length === 3 && rows().length === 21 && new RegExp(`Deleted the group “${gName}”; its \\d+ tasks? stays?`).test(G().querySelector(".gt-flash").textContent), "a group's trash: the group goes, its tasks stay");
  await sleep(1700);
  await settle(6);
  assert(saved().mgmt.rehab.milestones.length === 21 && saved().mgmt.rehab.groups.length === 3, "saved: 21 tasks, 3 groups");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL SCHEDULE TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
