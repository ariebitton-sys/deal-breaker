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
      market: [item("b3", "Listing agent signed"), item("b4", "Professional photos"), item("b5", "Disclosures prepared"), item("b6", "Listing live on MLS"), item("b7", "Republic Services: stop trash on the sale closing date", { ut: "republic:sell" })],
    },
  },
  { stageHistory: [{ stage: "market", date: day(-1), ts: ts(20) }] },
);
const C = deal("33 Lead Rd, Euclid, OH 44123", "analyzing", { checklists: { contract: [item("c1", "EMD deposited")] } });
const E = deal(
  "55 Contract Way, Akron, OH 44301",
  "contract",
  {
    contract: { date: day(-3), expectedClosing: day(20) },
    checklists: {
      contract: [
        item("e1", "EMD deposited"),
        item("e2", "Inspection scheduled"),
        item("e3", "Inspection completed"),
        item("e4", "Insurance bound"),
        item("e5", "Final walkthrough"),
        item("e6", "Ohio Edison: start electric in the LLC's name from the closing date", { ut: "edison:buy", addedAt: ts(70) }),
      ],
      rehab: [item("e7", "Locks changed / lockbox")],
    },
  },
  { stageHistory: [{ stage: "contract", date: day(-3), ts: ts(70) }] },
);
const D = deal(
  "44 Sold Ct, Parma, OH 44129",
  "sold",
  { sale: { date: day(-5) }, checklists: { market: [item("d1", "Stop electric service after the sale", { ut: "electric:sell" }), item("d2", "Staging picked up")] } },
  { actualSale: 210000, stageHistory: [{ stage: "sold", date: day(-5), ts: ts(120) }] },
);

(async () => {
  const drive = makeDrive();
  const ids = { A: drive.add("11 Task St, Cleveland, OH 44102.json", A), B: drive.add("22 Market Ave, Lakewood, OH 44107.json", B), C: drive.add("33 Lead Rd, Euclid, OH 44123.json", C), D: drive.add("44 Sold Ct, Parma, OH 44129.json", D), E: drive.add("55 Contract Way, Akron, OH 44301.json", E) };
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
  // new: the hand-added task (1 h ago), the market checklist that went live 20 h ago (3 workable now), and the
  // contract that started 3 days ago (EMD, inspection scheduled; the rest comes later), and the stop-electric task
  // that came up when the sale closed 5 days ago
  assert(bell() && bell().querySelector(".tb-bell-n").textContent === "7", `bell shows 7 new (got ${bell() && bell().textContent})`);
  assert(bell().classList.contains("late"), "red: a task is overdue");
  const side = [...doc.querySelectorAll(".sidebar .sb-item")].find((b) => /Tasks/.test(b.textContent));
  // open: A carried utility 1 + rehab 3 open + the standard insurance task; B market 3; D the stop-electric utility task 1; E 2
  assert(side && side.querySelector("em").textContent === "11", `sidebar Tasks: 11 open (got ${side && side.textContent})`);
  await click(bell());
  const pop = doc.querySelector(".bell-pop");
  const secs = [...pop.querySelectorAll(".bell-sec")].map((x) => x.querySelector(".bell-k").textContent + ":" + x.querySelectorAll(".bell-row").length);
  assert(secs.join(",") === "New tasks:7,Overdue:1", "the panel: 7 new, 1 overdue — " + secs.join(","));
  assert(/Confirm the electric account.*11 Task St · Rehab/.test(pop.querySelector(".bell-row").textContent), "newest first, with the project and stage");
  await click(bell());
  assert(!doc.querySelector(".bell-pop") && !bell().querySelector(".tb-bell-n") && bell().querySelector(".tb-bell-dot"), "closing it marks them seen: no number, a red dot stays for the overdue task");

  console.log("2. The Tasks screen");
  await click(side);
  assert(doc.querySelector(".tasks") && doc.querySelectorAll(".tasks .tk-group").length === 4, "four projects with open tasks (not the one being analyzed)");
  const groups = [...doc.querySelectorAll(".tasks .tk-group .tk-addr")].map((x) => x.textContent);
  assert(groups[0] === "11 Task St", "the project with the overdue task comes first");
  assert(row("Start electric service") && /Under contract checklist, still open from that stage · Utilities · CEI/.test(row("Start electric service").querySelector(".tk-meta").textContent), "a utility task still open from Under contract carries over, with its note");
  const bGroup = [...doc.querySelectorAll(".tasks .tk-group")].find((x) => /22 Market Ave/.test(x.textContent));
  assert(!row("Title ordered") && !/Inspection scheduled|Before photos taken/.test(bGroup.textContent), "earlier stages' template items stay out");
  assert(row("Stop electric service") && row("Stop electric service").querySelector(".tk-new") && !row("Staging picked up"), "the sold deal keeps only its open utility task, new from the sale");
  assert(!row("Republic Services: stop trash"), "a stop-the-service task waits for the sale to close: not on the board while on the market");
  assert(!row("Listing live on MLS"), "Listing live on MLS waits for the listing agent and the photos");
  assert(row("EMD deposited") && row("Inspection scheduled") && !row("Inspection completed") && !row("Insurance bound") && !row("Final walkthrough") && !row("Ohio Edison"), "under contract: the first steps now; inspection completed after it's scheduled; insurance, walkthrough and utilities closer to closing");
  assert(row("Permits pulled").querySelector(".tk-due.overdue").textContent === "2 days late", "overdue: 2 days late, in red");
  assert(row("Confirm the electric account").querySelector(".tk-new") && row("Listing agent signed").querySelector(".tk-new") && !row("Utilities transferred").querySelector(".tk-new"), "New this week: tagged");
  const chip = (l) => [...doc.querySelectorAll(".tasks .lg-chip")].find((b) => b.textContent.startsWith(l));
  assert(chip("All open").querySelector("em").textContent === "11" && chip("New this week").querySelector("em").textContent === "7" && chip("Overdue").querySelector("em").textContent === "1", "filters count 11 / 7 / 1");
  const ins = rows().filter((x) => /Property insurance bought/.test(x.textContent));
  assert(ins.length === 1 && /Rehab checklist/.test(ins[0].querySelector(".tk-meta").textContent) && [...doc.querySelectorAll(".tasks .tk-group")].find((x) => /11 Task St/.test(x.textContent)).contains(ins[0]), "every purchased property gets an insurance task: only the deal in rehab, not the ones under contract or on the market");
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

  await click(row("Inspection scheduled").querySelector('input[type="checkbox"]'));
  await sleep(20);
  await settle(6);
  assert(row("Inspection completed") && row("Inspection completed").querySelector(".tk-new"), "inspection scheduled done: inspection completed comes up, as new");

  await click(rows().find((x) => /Property insurance bought/.test(x.textContent)).querySelector('input[type="checkbox"]'));
  await sleep(20);
  await settle(6);
  const insA = saved("A").mgmt.checklists.rehab.find((i) => i.id === "std-insurance");
  assert(insA && insA.done && saved("A").mgmt.std.insurance === 1, "ticked from the board: saved in the file as done");

  console.log("4. The open project changes in place");
  const g = [...doc.querySelectorAll(".tasks .tk-group")].find((x) => /11 Task St/.test(x.textContent));
  await click(btn("Open project", g));
  await sleep(30);
  await settle(8);
  assert(doc.querySelector(".ptab.on") && /Stages and milestones/.test(doc.querySelector(".ptab.on").textContent), "Open project lands on Stages and milestones");
  assert(/Property insurance bought \(vacant \/ builder's risk\)/.test(doc.body.textContent), "the insurance task is in the deal's rehab checklist");
  const cp = doc.querySelector(".dh-addr-row > .dh-copy");
  assert(cp && cp.nextElementSibling.classList.contains("dh-addr") && cp.getAttribute("aria-label") === "Copy the address", "a copy button to the left of the address");
  t.win.navigator.clipboard = { writeText: async (v) => (t.win.__copied = v) };
  await click(cp);
  assert(t.win.__copied === "11 Task St, Cleveland, OH 44102" && cp.getAttribute("aria-label") === "Address copied", "one click copies the address, and says so");
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
  const later = [...doc.querySelectorAll(".ck-later")].map((x) => x.textContent);
  assert(later.includes("On the task board after the sale closes") && later.includes('On the task board after "Listing agent signed" and "Professional photos"'), "the checklist says when a waiting task comes up");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL TASKS TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
