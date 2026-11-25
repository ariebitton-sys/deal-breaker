// v69: the rehab schedule feeds the Tasks board (each milestone from its scheduled start, due on its finish,
// ticked there = done in the deal) and the Forecast (the sale date = the rehab's finish + days to sell).
const fs = require("fs"),
  vm = require("vm"),
  babel = require("@babel/core");
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};

// ---------- the logic, straight from the built source ----------
const src = fs.readFileSync(__dirname + "/../dist/app.jsx", "utf8");
const code = babel.transformSync(src.slice(0, src.indexOf("function App()")), { babelrc: false, configFile: false, sourceType: "script", presets: [["@babel/preset-react", { runtime: "classic" }]] }).code;
const C = { React: { useState() {}, useMemo() {}, useEffect() {}, useRef() {}, createElement() {}, Fragment: "F" }, window: {}, localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(C);
vm.runInContext(code + ";this.__g={dealTasks,collectTasks,fcScenarios,fcSchedSale,FC_SELL_DAYS,schedOf};", C);
const { dealTasks, collectTasks, fcScenarios } = C.__g;

const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const base = (mgmt, extra = {}) => ({
  address: "1 Test St, Cleveland, OH 44102", sqft: 1200, holdMonths: 5, arv: 300000, purchase: 150000, repairs: [], useRepairBuilder: false, manualRepair: 50000, pm: { type: "flat", val: 0 },
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.16, intRateRehab: 0.16, points: 0, investorAuto: true, investorRate: 0.09,
  taxAnnual: 0, insMonthly: 0, utilGas: 0, utilWater: 0, utilElec: 0, hoaMonthly: 0, miscHold: 0, buyTxn: txn(), sellTxn: txn(), actuals: [], stage: "rehab", mgmt, ...extra,
});
const T = "2026-11-25";
const ms3 = (dur) => [
  { id: "a", label: "Demo", status: "todo", ...(dur ? { dur: 3 } : {}) },
  { id: "b", label: "Rough-ins", status: "todo" },
  { id: "c", label: "Paint", status: "todo" },
];
const sch = (d) => dealTasks(d, T).open.filter((t) => t.ck === "sched");

console.log("1. Board tasks from the schedule");
let d = base({ closing: { date: "2026-11-02" }, rehab: { startDate: "2026-11-02", milestones: ms3(false) } });
assert(sch(d).length === 0, "a schedule still on its 5-day defaults puts nothing on the board");
d = base({ closing: { date: "2026-11-02" }, rehab: { startDate: "2026-11-02", milestones: ms3(true) } });
let s = sch(d);
assert(s.length === 3 && s[0].id === "sch-a" && s[0].ms === "a" && s[0].from === "2026-11-02" && s[0].due === "2026-11-04" && s[1].from === "2026-11-05" && s[2].from === "2026-11-12" && s[2].due === "2026-11-18", "set up (a duration): each milestone, from its start, due on its finish");
d.mgmt.rehab.milestones[0] = { ...d.mgmt.rehab.milestones[0], status: "done", doneAt: "2026-11-20T10:00:00Z", by: "arie@kappainv.com" };
assert(sch(d).length === 2 && dealTasks(d, T).done.some((t) => t.id === "sch-a"), "a done milestone leaves the open tasks and shows among the recently done");
assert(sch({ ...d, mgmt: { ...d.mgmt, rehab: { ...d.mgmt.rehab, sched: { board: false } } } }).length === 0, "switched off in the Schedule tab: none");
assert(sch({ ...d, mgmt: { ...d.mgmt, rehab: { ...d.mgmt.rehab, startDate: "" } } }).length === 0, "the rehab hasn't started: none yet");
assert(sch({ ...d, stage: "market" }).length === 0, "on the market: none");
const entry = { address: "1 Test St", st: "rehab", open: [{ id: "sch-x", ck: "sched", label: "Kitchen", from: "2026-12-01", due: "2026-12-04" }, { id: "y", ck: "rehab", label: "Permits" }] };
assert(collectTasks({ f1: entry }, [{ id: "f1" }], null, T).length === 1 && collectTasks({ f1: entry }, [{ id: "f1" }], null, "2026-12-01").length === 2, "a task starting 12/01 reaches the board on 12/01, not before");

console.log("2. Forecast sale date from the schedule");
const ctx = (mgmt, stage = "rehab") => ({ P: { stage }, mgmt, uw: { holdMonths: 5 }, m: { arv: 300000, repair: 50000, pmFee: 0 }, today: T, position: { defaultPrice: 300000 }, actuals: [] });
const mg1 = { closing: { date: "2026-11-02" }, contract: {}, buyer: {}, rehab: { startDate: "2026-11-02", milestones: ms3(true) } };
let sc = fcScenarios(ctx(mg1))[0];
assert(sc.saleFrom === "schedule" && sc.sched.rehabEnd === "2026-11-18" && sc.saleDate === "2027-01-17", "Expected: rehab ends 11/18 on the schedule + 60 days to sell = 01/17/2027");
sc = fcScenarios(ctx({ ...mg1, rehab: { ...mg1.rehab, milestones: ms3(false) } }))[0];
assert(!sc.sched && sc.saleFrom === undefined, "no schedule set up: the date comes from the deal as before");
const saved = [{ id: "s1", name: "Base", price: 300000, saleDate: "2027-03-01", main: true }, { id: "s2", name: "Linked", price: 290000, saleDate: "2027-03-01", saleFrom: "schedule", sellDays: 30 }];
let list = fcScenarios(ctx({ ...mg1, scenarios: saved }));
assert(list[0].saleDate === "2027-03-01" && !list[0].sched && list[1].saleDate === "2026-12-18", "saved scenarios: one keeps its own date; the linked one is rehab end + its 30 days");
list = fcScenarios(ctx({ ...mg1, scenarios: saved, rehab: { ...mg1.rehab, endDate: "2026-11-30" } }));
assert(list[1].saleDate === "2026-12-30" && list[1].sched.actual, "once the rehab's actual completion is set, from that date");
list = fcScenarios(ctx({ ...mg1, scenarios: saved }, "market"));
assert(list[1].saleDate === "2027-03-01" && !list[1].sched, "on the market: the stored date stands");

// ---------- the app ----------
const pad = (n) => String(n).padStart(2, "0");
const iso = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const mmdd = (x) => `${x.slice(5, 7)}/${x.slice(8, 10)}/${x.slice(0, 4)}`;
const monday = (() => {
  const x = new Date();
  x.setDate(x.getDate() - 21);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return iso(x);
})();
const addWork = (from, n) => {
  const x = new Date(from + "T00:00");
  while (n > 0) {
    x.setDate(x.getDate() + 1);
    if (x.getDay() % 6) n--;
  }
  return iso(x);
};
const addDays = (from, n) => {
  const x = new Date(from + "T00:00");
  x.setDate(x.getDate() + n);
  return iso(x);
};
const today = iso(new Date());
const daysLate = Math.round((new Date(today + "T00:00") - new Date(addWork(monday, 2) + "T00:00")) / 86400000);
const sched = () => [
  { id: "m1", label: "Demo & cleanout", status: "todo", dur: 3 },
  { id: "m2", label: "Rough-ins", status: "todo", dur: 40 },
  { id: "m3", label: "Paint & floors", status: "todo", dur: 5 },
];
const endAll = addWork(monday, 47);
const dealA = base({ closing: { date: monday, price: 150000 }, rehab: { startDate: monday, targetEnd: "", endDate: "", milestones: sched() } }, { address: "12 Board St, Cleveland, OH 44102" });
const dealB = base({ closing: { date: monday, price: 150000 }, rehab: { startDate: monday, targetEnd: "", endDate: "", milestones: sched() } }, { address: "34 Other Ave, Cleveland, OH 44102" });

(async () => {
  const drive = makeDrive();
  const fA = drive.add("12 Board St, Cleveland, OH 44102.json", dealA);
  const fB = drive.add("34 Other Ave, Cleveland, OH 44102.json", dealB);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, nav, win } = t;
  const savedOf = (fid) => JSON.parse(drive.files[fid].content);
  const side = () => [...doc.querySelectorAll(".sidebar .sb-item")].find((b) => /Tasks/.test(b.textContent));
  const group = (addr) => [...doc.querySelectorAll(".tasks .tk-group")].find((g) => g.textContent.includes(addr));
  const rowIn = (addr, label) => group(addr) && [...group(addr).querySelectorAll(".tk-row")].find((r) => r.querySelector(".tk-l").textContent.includes(label));

  console.log("3. The Tasks board");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(80);
  await settle(14);
  await click(side());
  await sleep(40);
  await settle(8);
  const demoB = rowIn("34 Other Ave", "Demo & cleanout");
  assert(demoB && /Rehab schedule · \d\d\/\d\d – \d\d\/\d\d/.test(demoB.querySelector(".tk-meta").textContent) && demoB.querySelector(".tk-due").textContent === `${daysLate} days late`, `a project not open: Demo & cleanout, Rehab schedule, ${daysLate} days late`);
  assert(rowIn("34 Other Ave", "Rough-ins") && !rowIn("34 Other Ave", "Paint & floors"), "Rough-ins (started) is there; Paint & floors (starts later) is not yet");
  assert(!demoB.querySelector(".tk-setdue"), "no due-date button: the dates come from the schedule");
  await click(demoB.querySelector('input[type="checkbox"]'));
  await sleep(40);
  await settle(8);
  let b = savedOf(fB);
  const m1 = b.mgmt.rehab.milestones.find((x) => x.id === "m1");
  assert(m1.status === "done" && m1.doneAt && b.mgmt.log.some((l) => l.text === "Milestone done: Demo & cleanout"), "ticked on the board: the milestone is done in that deal's file, and logged");
  assert(!rowIn("34 Other Ave", "Demo & cleanout") && [...doc.querySelectorAll(".tk-done .tk-row")].some((r) => r.textContent.includes("Demo & cleanout")), "it leaves the open list for the done list");
  await click([...doc.querySelectorAll(".tk-done .tk-row")].find((r) => r.textContent.includes("Demo & cleanout")).querySelector("input"));
  await sleep(40);
  await settle(8);
  assert(savedOf(fB).mgmt.rehab.milestones.find((x) => x.id === "m1").status === "todo" && rowIn("34 Other Ave", "Demo & cleanout"), "reopened from the done list: To do again, back on the board");
  const bell = doc.querySelector(".tb-bell");
  assert(/overdue/.test(bell.getAttribute("aria-label")), "the bell counts the late schedule tasks as overdue");

  console.log("4. Open the schedule; switch the board off");
  await click(rowIn("12 Board St", "Rough-ins").querySelector(".tk-sch-link"));
  await sleep(60);
  await settle(10);
  const G = () => doc.querySelector(".gantt");
  assert(G() && /12 Board St/.test(t.text()) && doc.querySelector('.ptabs [aria-selected="true"]').textContent === "Schedule", "Open the schedule: that deal's Schedule tab");
  assert(/On/.test(G().querySelector(".gt-board").textContent) && /2 tasks there now/.test(G().querySelector(".gt-board").textContent), "the Tasks board switch: On, 2 tasks there now");
  await click(G().querySelector(".gt-board input"));
  assert(/Off/.test(G().querySelector(".gt-board").textContent), "switched off");
  await click(side());
  await sleep(20);
  await settle(6);
  assert(!rowIn("12 Board St", "Rough-ins") && rowIn("34 Other Ave", "Rough-ins"), "its schedule tasks leave the board; the other deal's stay");
  await click(doc.querySelector(".sb-project"));
  await settle(6);

  console.log("5. The Forecast follows the schedule");
  await click(nav(/^Forecast/));
  const card = () => doc.querySelector(".fc-card");
  const dateIn = () => card().querySelector('input[type="date"]');
  assert(dateIn().value === addDays(endAll, 60) && /Rehab ends .* on the schedule \+/.test(card().querySelector(".fc-sched.on").textContent), `Expected: the schedule's finish (${mmdd(endAll)}) + 60 days = ${mmdd(addDays(endAll, 60))}`);
  const days = card().querySelector('.fc-sched input[aria-label="Days to sell"]');
  await setVal(days, "45");
  days.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true }));
  await settle(4);
  assert(dateIn().value === addDays(endAll, 45), "45 days to sell: the sale date moves with it");
  await sleep(1700);
  await settle(6);
  let a = savedOf(fA);
  assert(a.mgmt.scenarios[0].saleFrom === "schedule" && a.mgmt.scenarios[0].sellDays === 45 && !a.mgmt.scenarios[0].sched, "saved: the scenario follows the schedule, 45 days to sell");
  await click(nav(/^Schedule/));
  const n3 = [...G().querySelectorAll(".gt-r.task")].find((r) => r.querySelector(".gt-name").value === "Paint & floors").querySelector(".gt-num");
  await setVal(n3, "10");
  n3.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true }));
  await settle(4);
  await click(nav(/^Forecast/));
  assert(dateIn().value === addDays(addWork(monday, 52), 45), "Paint & floors 5 → 10 days: the forecast's sale date moves 5 work days later");
  await click(nav(/^Project overview/));
  const kpi = [...doc.querySelectorAll(".kpi-tile")].find((x) => /Projected profit at sale/.test(x.textContent));
  assert(kpi && kpi.getAttribute("title").includes(`sale on ${mmdd(addDays(addWork(monday, 52), 45))}`), "the overview's projected profit is at that sale date");
  await click(nav(/^Forecast/));
  await setVal(dateIn(), "2027-06-30");
  assert(!card().querySelector(".fc-sched.on") && card().querySelector(".fc-sched-use") && dateIn().value === "2027-06-30", "a date typed in: it stops following the schedule; From the schedule is offered");
  await click(card().querySelector(".fc-sched-use"));
  assert(card().querySelector(".fc-sched.on") && dateIn().value === addDays(addWork(monday, 52), 45), "From the schedule: following it again, with its 45 days");
  await click(btn("Unlink", card()));
  assert(!card().querySelector(".fc-sched.on") && dateIn().value === addDays(addWork(monday, 52), 45), "Unlink: keeps the date, stops following");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL SCHEDULE LINK TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
