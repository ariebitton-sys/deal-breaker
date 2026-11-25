// Project manager fee (Flip analysis + payments by flip step) and the wait between closing and the rehab start.
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const money = (el) => Number(String(el.textContent).replace(/[^0-9.-]/g, ""));
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const base = {
  sqft: 1200, holdMonths: 5, arv: 220000, purchase: 110000, repairs: [], useRepairBuilder: false, manualRepair: 30000,
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.18, intRateRehab: 0.16, points: 0, investorAuto: true, investorRate: 0.09,
  taxAnnual: 0, insMonthly: 120, utilGas: 75, utilWater: 75, utilElec: 50, hoaMonthly: 0, miscHold: 0, buyTxn: txn(), sellTxn: txn(), actuals: [], schema: 2,
};
(async () => {
  const drive = makeDrive();
  const fA = drive.add("10 Analyze Rd, Cleveland, OH 44102.json", { ...base, address: "10 Analyze Rd, Cleveland, OH 44102", stage: "analyzing" });
  const fW = drive.add("20 Wait St, Cleveland, OH 44102.json", {
    ...base, address: "20 Wait St, Cleveland, OH 44102", stage: "rehab",
    mgmt: { closing: { date: daysAgo(20), price: 110000 }, rehab: { startDate: "", targetEnd: daysAgo(-70), endDate: "" } },
  });
  const fP = drive.add("30 Paid Ave, Cleveland, OH 44102.json", {
    ...base, address: "30 Paid Ave, Cleveland, OH 44102", stage: "rehab", pm: { type: "pct", val: 10 },
    mgmt: { closing: { date: daysAgo(30), price: 110000 }, rehab: { startDate: daysAgo(25), targetEnd: daysAgo(-60), endDate: "" }, pm: { terms: "agreed" } },
  });
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, text } = t;
  const nav = t.nav;
  const row = (name) => [...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes(name));
  const group = (title) => [...doc.querySelectorAll("section.grp")].find((s) => s.querySelector(".grp-title").textContent === title);
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(40); await settle(10);

  console.log("1. Dashboards: waiting for the rehab start, and a PM payment due");
  assert(/Rehab not started, 20 days after closing/.test(row("20 Wait St").closest("table") ? t.text() : ""), "alert: rehab not started 20 days after closing");
  await click(nav(/^Active projects/));
  await settle(4);
  assert(/Not started/.test(row("20 Wait St").textContent) && /20 days since closing/.test(row("20 Wait St").textContent), "deals table: Not started, 20 days since closing");
  assert(/Project manager payment due: \$1,200/.test(t.text()), "alert: the first PM installment (40% of $3,000) is due since the rehab started");

  console.log("2. Flip analysis: the fee lowers profit, not the deal's size class");
  await click(nav(/^Overview\d/));
  await settle(4);
  await click(row("10 Analyze Rd"));
  await sleep(30); await settle(10);
  await click(nav(/^Flip analysis$/));
  const np0 = money(doc.querySelector(".rail-profit"));
  const risk0 = doc.querySelector(".rail-grade-meta span").textContent;
  const cash0 = money([...doc.querySelectorAll(".rail-stats > div")].find((d) => /Kappa cash/.test(d.textContent)).querySelector("b"));
  let g = group("Project manager");
  assert(g && /No fee/.test(g.textContent), "Project manager group, no fee by default");
  await click(g.querySelector(".grp-head"));
  g = group("Project manager");
  await setVal(g.querySelector('input[type="number"]'), "10");
  await settle(4);
  g = group("Project manager");
  assert(/\$3,000/.test(g.querySelector(".grp-head").textContent) && /10% of the rehab estimate, paid out of pocket/.test(g.textContent), "10% of the $30,000 rehab = $3,000");
  assert(money(doc.querySelector(".rail-profit")) === np0 - 3000, "net profit down by $3,000");
  assert(doc.querySelector(".rail-grade-meta span").textContent === risk0, "same risk / size class (the fee isn't rehab)");
  assert(money([...doc.querySelectorAll(".rail-stats > div")].find((d) => /Kappa cash/.test(d.textContent)).querySelector("b")) === cash0 + 3000, "paid out of pocket: Kappa cash up by $3,000, no interest");
  assert([...doc.querySelectorAll(".rail-legend > div")].some((d) => /Project manager\$3,000/.test(d.textContent)), "where the ARV goes: Project manager $3,000");
  await click(btn("Fixed amount", g));
  await setVal(group("Project manager").querySelector('input[type="number"]'), "4500");
  await settle(4);
  assert(money(doc.querySelector(".rail-profit")) === np0 - 4500 && /Fixed amount, paid out of pocket/.test(group("Project manager").textContent), "fixed $4,500 fee");
  await sleep(1700); await settle(8);
  assert(JSON.parse(drive.files[fA].content).pm.type === "flat" && JSON.parse(drive.files[fA].content).pm.val === 4500, "saved with the deal");

  console.log("3. Expenses: installments by flip step; paying one logs it under Services");
  await click(nav(/^Overview\d/));
  await settle(4);
  await click(row("30 Paid Ave"));
  await sleep(30); await settle(10);
  await click(nav(/^Expenses/));
  const pay = () => doc.querySelector(".pm-pay");
  assert(pay() && /Fee \$3,000 \(10% of the \$30,000 rehab estimate\)/.test(pay().textContent), "payments panel: fee from Flip analysis");
  let rows = [...pay().querySelectorAll(".pm-inst")];
  assert(rows.length === 3 && /When the rehab starts/.test(rows[0].querySelector("select").selectedOptions[0].textContent) && rows[2].querySelector("select").value === "sold", "default plan: rehab start, rehab done, sale");
  assert(/\$1,200/.test(rows[0].textContent) && /Due since/.test(rows[0].textContent) && /Not due yet/.test(rows[1].textContent), "40% due since the rehab started; the rest not yet");
  await click(btn("Log payment", rows[0]));
  await setVal(pay().querySelector('.pm-pay-form input[type="number"]'), "1200");
  await click(btn("Log", pay().querySelector(".pm-pay-form")));
  await settle(6);
  rows = [...pay().querySelectorAll(".pm-inst")];
  assert(/Paid/.test(rows[0].textContent) && /\$1,200/.test(pay().querySelector(".pm-pay-sum").textContent), "installment 1 paid; $1,200 paid of $3,000");
  assert([...doc.querySelectorAll(".ledger-row")].some((r) => /Services/.test(r.textContent) && /Project manager: installment 1 of 3/.test(r.textContent)), "ledger: Services entry for the PM");
  await setVal(rows[1].querySelector('input[type="number"]'), "50");
  await settle(4);
  assert(/add up to 110%/.test(pay().textContent), "warns when the shares don't add up to 100%");
  await setVal([...pay().querySelectorAll(".pm-inst")][1].querySelector('input[type="number"]'), "40");
  assert([...doc.querySelectorAll(".xd-bar")].some((r) => /^Services/.test(r.textContent.trim()) && /\$3,000/.test(r.textContent) && /\$1,200/.test(r.textContent)), "Budget vs actual: Services budget $3,000, actual $1,200");
  await sleep(1700); await settle(8);
  const sp = JSON.parse(drive.files[fP].content);
  assert(sp.actuals.some((a) => a.tag === "pm_fee" && a.cat === "Services" && a.amount === 1200 && a.pmInst === "pm1"), "saved: the payment is tied to installment 1");

  console.log("4. Waiting deal: mark the start, the rehab clock starts then");
  await click(nav(/^Overview\d/));
  await settle(4);
  await click(row("20 Wait St"));
  await sleep(30); await settle(10);
  assert(/Closed 20 days ago, rehab not started/.test(t.text()), "header: closed 20 days ago, rehab not started");
  await click(nav(/^Stages and milestones$/));
  const w = doc.querySelector(".rehab-wait");
  assert(w && /20 days since closing/.test(w.textContent), "rehab section: waiting note");
  await setVal(w.querySelector('input[type="date"]'), daysAgo(2));
  await click(btn("Mark rehab started", w));
  await settle(6);
  assert(/Started 18 days after closing/.test(t.text()) && /Rehab, day 2/.test(t.text()), "started 18 days after closing; rehab day 2");
  await sleep(1700); await settle(8);
  assert(JSON.parse(drive.files[fW].content).mgmt.rehab.startDate === daysAgo(2), "start date saved");

  assert(t.errors.length === 0, "no errors " + t.errors.join(" | "));
  console.log("\nALL PM TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.log("FAILED:", e);
  process.exit(1);
});
