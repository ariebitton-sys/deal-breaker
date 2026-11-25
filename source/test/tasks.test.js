// v59: the Tasks screen (open checklist tasks across the projects) and the notifications bell.
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const pad = (n) => String(n).padStart(2, "0");
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const ts = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600000).toISOString();
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const item = (id, label, extra) => ({ id, label, done: false, ...(extra || {}) });
const deal = (address, stage, mgmt, extra) => ({ address, sqft: 1000, holdMonths: 4, arv: 200000, purchase: 120000, repairs: [], useRepairBuilder: false, manualRepair: 25000, stage, actuals: [], mgmt, ...(extra || {}) });

const A = deal(
  "11 Task St, Cleveland, OH 44102",
  "rehab",
  {
    closing: { date: day(-20), price: 120000 },
    checklists: {
      contract: [item("a1", "Title ordered", { done: true, doneAt: ts(600) }), item("a2", "Start electric service in the LLC's name", { ut: "electric:buy", addedAt: ts(240), note: "CEI 1-800-589-3101" })],
      rehab: [
        item("a3", "Utilities transferred"),
        item("a4", "Locks changed / lockbox", { done: true, doneAt: ts(48), by: "mike@kappainv.com" }),
        item("a5", "Permits pulled", { due: day(-2) }),
        item("a6", "Confirm the electric account is in the LLC's name", { custom: true, addedAt: ts(1) }),
      ],
      market: [item("a7", "Listing live on MLS")],
    },
  },
  { stageHistory: [{ stage: "contract", date: day(-40), ts: ts(960) }, { stage: "rehab", date: day(-20), ts: ts(480) }] },
);
const B = deal(
  "22 Market Ave, Lakewood, OH 44107",
  "market",
  {
    closing: { date: day(-90), price: 150000 },
    listing: { date: day(-1), price: 239000 },
    checklists: {
      contract: [item("b1", "Inspection scheduled")],
      rehab: [item("b2", "Before photos taken")],
      market: [item("b3", "Listing agent signed"), item("b4", "Professional photos"), item("b5", "Disclosures prepared")],
    },
  },
  { stageHistory: [{ stage: "market", date: day(-1), ts: ts(20) }] },
);
const C = deal("33 Lead Rd, Euclid, OH 44123", "analyzing", { checklists: { contract: [item("c1", "EMD deposited")] } });
const D = deal(
  "44 Sold Ct, Parma, OH 44129",
  "sold",
  { sale: { date: day(-5) }, checklists: { market: [item("d1", "Stop electric service after the sale", { ut: "electric:sell" }), item("d2", "Staging picked up")] } },
  { actualSale: 210000, stageHistory: [{ stage: "sold", date: day(-5), ts: ts(120) }] },
);

(async () => {
  const drive = makeDrive();
  const ids = { A: drive.add("11 Task St, Cleveland, OH 44102.json", A), B: drive.add("22 Market Ave, Lakewood, OH 44107.json", B), C: drive.add("33 Lead Rd, Euclid, OH 44123.json", C), D: drive.add("44 Sold Ct, Parma, OH 44129.json", D) };
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, nav } = t;
  const saved = (k) => JSON.parse(drive.files[ids[k]].content);
  const bell = () => doc.querySelector(".tb-bell");
  const rows = () => [...doc.querySelectorAll(".tasks .tk-group .tk-row")];
  const row = (label) => rows().find((r) => r.querySelector(".tk-l").textContent.includes(label));

  console.log("1. The bell counts tasks you haven't seen; red when something is overdue");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(60);
  await settle(12);
  await sleep(60);
  await settle(8);
  // new: the hand-added task (1 h ago) and the market checklist that went live 20 h ago (3)
  assert(bell() && bell().querySelector(".tb-bell-n").textContent === "4", `bell shows 4 new (got ${bell() && bell().textContent})`);
  assert(bell().classList.contains("late"), "red: a task is overdue");
  const side = [...doc.querySelectorAll(".sidebar .sb-item")].find((b) => /Tasks/.test(b.textContent));
  // open: A carried utility 1 + rehab 3 open; B market 3; D the stop-electric utility task 1
  assert(side && side.querySelector("em").textContent === "8", `sidebar Tasks: 8 open (got ${side && side.textContent})`);
  await click(bell());
  const pop = doc.querySelector(".bell-pop");
  const secs = [...pop.querySelectorAll(".bell-sec")].map((x) => x.querySelector(".bell-k").textContent + ":" + x.querySelectorAll(".bell-row").length);
  assert(secs.join(",") === "New tasks:4,Overdue:1", "the panel: 4 new, 1 overdue — " + secs.join(","));
  assert(/Confirm the electric account.*11 Task St · Rehab/.test(pop.querySelector(".bell-row").textContent), "newest first, with the project and stage");
  await click(bell());
  assert(!doc.querySelector(".bell-pop") && !bell().querySelector(".tb-bell-n") && bell().querySelector(".tb-bell-dot"), "closing it marks them seen: no number, a red dot stays for the overdue task");

  console.log("2. The Tasks screen");
  await click(side);
  assert(doc.querySelector(".tasks") && doc.querySelectorAll(".tasks .tk-group").length === 3, "three projects with open tasks (not the one being analyzed)");
  const groups = [...doc.querySelectorAll(".tasks .tk-group .tk-addr")].map((x) => x.textContent);
  assert(groups[0] === "11 Task St", "the project with the overdue task comes first");
  assert(row("Start electric service") && /Under contract checklist, still open from that stage · Utilities · CEI/.test(row("Start electric service").querySelector(".tk-meta").textContent), "a utility task still open from Under contract carries over, with its note");
  assert(!row("Title ordered") && !row("Inspection scheduled") && !row("Before photos taken") && !row("EMD deposited"), "earlier stages' template items and the analyzing deal stay out");
  assert(row("Stop electric service") && !row("Staging picked up"), "the sold deal keeps only its open utility task");
  assert(row("Permits pulled").querySelector(".tk-due.overdue").textContent === "2 days late", "overdue: 2 days late, in red");
  assert(row("Confirm the electric account").querySelector(".tk-new") && row("Listing agent signed").querySelector(".tk-new") && !row("Utilities transferred").querySelector(".tk-new"), "New this week: tagged");
  const chip = (l) => [...doc.querySelectorAll(".tasks .lg-chip")].find((b) => b.textContent.startsWith(l));
  assert(chip("All open").querySelector("em").textContent === "8" && chip("New this week").querySelector("em").textContent === "4" && chip("Overdue").querySelector("em").textContent === "1", "filters count 8 / 4 / 1");
  await click(chip("Overdue"));
  assert(rows().length === 1 && row("Permits pulled"), "Overdue shows only the late task");
  await click(chip("All open"));

  console.log("3. Done, due date and a new task, saved to each project's file");
  await click(row("Permits pulled").querySelector('input[type="checkbox"]'));
  await sleep(30);
  await settle(6);
  let a = saved("A");
  const pp = a.mgmt.checklists.rehab.find((i) => i.id === "a5");
  assert(pp.done && pp.doneAt && a.mgmt.log[0].text === "Task done: Permits pulled", "ticked: saved done in 11 Task St, with a log line");
  assert(!row("Permits pulled") && /Permits pulled/.test(doc.querySelector(".tk-done").textContent), "it leaves the list and shows under Done");
  assert(a.actuals.length === 0 && a.arv === 200000 && a.mgmt.checklists.contract.length === 2, "nothing else in the file changed");
  assert(!row("Professional photos").querySelector(".tk-date") && row("Professional photos").querySelector(".tk-setdue"), "no due date: a Due date button, not an empty date field");
  await click(row("Professional photos").querySelector(".tk-setdue"));
  await setVal(row("Professional photos").querySelector(".tk-date"), day(2));
  await sleep(20);
  await settle(6);
  assert(saved("B").mgmt.checklists.market.find((i) => i.id === "b4").due === day(2) && row("Professional photos").querySelector(".tk-due.soon").textContent === `due ${mmdd(day(2))}`, "due date saved; due in 2 days shows amber");
  const add = doc.querySelector(".tk-add");
  await setVal(add.querySelector("select"), ids.B);
  await setVal(add.querySelector('input[aria-label="New task"]'), "Order a pre-listing inspection");
  await setVal(add.querySelector('input[type="date"]'), day(5));
  await click(btn("Add task", add));
  await sleep(20);
  await settle(6);
  const nb = saved("B").mgmt.checklists.market.find((i) => i.label === "Order a pre-listing inspection");
  assert(nb && nb.custom && nb.addedAt && nb.due === day(5) && saved("B").mgmt.log[0].text === "Task added: Order a pre-listing inspection", "added to 22 Market Ave's On market checklist, with its due date");
  assert(row("Order a pre-listing inspection") && row("Order a pre-listing inspection").querySelector(".tk-new"), "and it shows, as new");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));

  console.log("4. The open project changes in place");
  const g = [...doc.querySelectorAll(".tasks .tk-group")].find((x) => /11 Task St/.test(x.textContent));
  await click(btn("Open project", g));
  await sleep(30);
  await settle(8);
  assert(doc.querySelector(".ptab.on") && /Stages and milestones/.test(doc.querySelector(".ptab.on").textContent), "Open project lands on Stages and milestones");
  await click(side);
  await click(row("Utilities transferred").querySelector('input[type="checkbox"]'));
  await settle(4);
  assert(!row("Utilities transferred"), "ticking a task of the open deal updates it at once");
  await sleep(1700);
  await settle(6);
  assert(saved("A").mgmt.checklists.rehab.find((i) => i.id === "a3").done, "and autosave writes it");

  console.log("5. The checklist in the deal shows the due date");
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("22 Market Ave")));
  await sleep(30);
  await settle(8);
  await click(nav(/^Stages and milestones/));
  assert(doc.body.textContent.includes("Due " + mmdd(day(2))), "Professional photos: Due " + mmdd(day(2)));
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL TASKS TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
