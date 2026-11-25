// v67: project manager payment terms — nothing is due until they're agreed; the board asks to agree them, then
// carries each installment as it falls due.
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
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const deal = {
  address: "40 Terms Rd, Indianapolis, IN 46205", sqft: 1200, holdMonths: 5, arv: 300000, purchase: 150000, repairs: [], useRepairBuilder: false, manualRepair: 60000, pm: { type: "flat", val: 5000 },
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.16, intRateRehab: 0.16, points: 0, investorAuto: true, investorRate: 0.09,
  taxAnnual: 0, insMonthly: 0, utilGas: 0, utilWater: 0, utilElec: 0, hoaMonthly: 0, miscHold: 0, buyTxn: txn(), sellTxn: txn(), actuals: [], stage: "rehab",
  mgmt: { closing: { date: day(-12), price: 150000 }, rehab: { startDate: day(-10), targetEnd: day(80), endDate: "" } },
};

(async () => {
  const drive = makeDrive();
  const fid = drive.add("40 Terms Rd, Indianapolis, IN 46205.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, nav } = t;
  const saved = () => JSON.parse(drive.files[fid].content);
  const side = () => [...doc.querySelectorAll(".sidebar .sb-item")].find((b) => /Tasks/.test(b.textContent));
  const rows = () => [...doc.querySelectorAll(".tasks .tk-row")];
  const panel = () => doc.querySelector("#pm-payments");

  console.log("1. Terms not agreed: nothing due, a task to agree them");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(60);
  await settle(12);
  assert(!/Project manager payment due/.test(t.text()), "no 'payment due' alert: the default 40% at the rehab start isn't due until terms are agreed");
  await click(side());
  await sleep(20);
  await settle(6);
  const terms = rows().find((r) => /Agree the project manager's payment terms \(\$5,000\)/.test(r.textContent));
  assert(terms && /Project manager payments · Set the terms/.test(terms.querySelector(".tk-meta").textContent) && !terms.querySelector('input[type="checkbox"]'), "the board: agree the PM's payment terms ($5,000), with Set the terms");
  await click(terms.querySelector(".tk-pm-link"));
  await sleep(40);
  await settle(10);
  assert(panel() && /Payment terms not agreed yet/.test(panel().textContent), "Set the terms opens the deal's payments panel");
  assert([...panel().querySelectorAll(".pm-inst-st")].every((x) => x.textContent === "Draft"), "the installments are a draft");

  console.log("2. Pick a schedule and agree it");
  const preset = (l) => [...panel().querySelectorAll(".pm-preset")].find((b) => b.textContent.startsWith(l));
  await click(preset("By rehab milestones"));
  const nMs = panel().querySelectorAll(".pm-inst").length;
  assert(nMs >= 2 && [...panel().querySelectorAll(".pm-inst select")].every((s) => s.value.startsWith("ms:")) && !/not 100%/.test(panel().textContent), `by milestones: ${nMs} installments, one per milestone, adding up to 100%`);
  await click(preset("All at the sale"));
  assert(panel().querySelectorAll(".pm-inst").length === 1 && panel().querySelector(".pm-inst select").value === "sold", "all at the sale: one installment");
  await click(btn("Terms agreed", panel()));
  assert(/Terms agreed/.test(panel().querySelector(".pm-terms.ok").textContent) && panel().querySelector(".pm-inst-st").textContent === "Not due yet", "agreed: the sale installment is not due yet");
  await sleep(1700);
  await settle(6);
  let s = saved();
  assert(s.mgmt.pm.terms === "agreed" && s.mgmt.log.some((l) => /Project manager payment terms agreed \(\$5,000\): 100% at the sale/.test(l.text)), "saved and logged: 100% at the sale");
  await click(side());
  assert(!rows().some((r) => /project manager/i.test(r.textContent)), "the board: no PM task now (the sale hasn't happened)");

  console.log("3. A payment on a date comes up when due");
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("40 Terms Rd")));
  await sleep(30);
  await settle(8);
  await click(nav(/^Expenses/));
  await setVal(panel().querySelector(".pm-inst select"), "date");
  await setVal(panel().querySelector('.pm-inst input[type="date"]'), day(-2));
  assert(panel().querySelector(".pm-inst-st").textContent.startsWith("Due since"), "on a date two days ago: due");
  await click(side());
  const pay = rows().find((r) => /Pay the project manager \$5,000: installment 1 of 1, on /.test(r.textContent));
  assert(pay && pay.querySelector(".tk-due.overdue").textContent === "2 days late", "the board: pay the PM $5,000, 2 days late");
  await click(pay.querySelector(".tk-pm-link"));
  await sleep(30);
  await settle(6);
  await click(btn("Log payment", panel()));
  await click(btn("Log", panel().querySelector(".pm-pay-form")));
  assert(/Paid/.test(panel().querySelector(".pm-inst-st").textContent), "logged in the panel");
  await click(side());
  assert(!rows().some((r) => /Pay the project manager/.test(r.textContent)), "and the task is gone from the board");

  console.log("4. Edit terms pauses what's due");
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("40 Terms Rd")));
  await sleep(30);
  await settle(8);
  await click(nav(/^Expenses/));
  await click(btn("Edit terms", panel()));
  assert(/Payment terms not agreed yet/.test(panel().textContent) && /Paid/.test(panel().querySelector(".pm-inst-st").textContent), "reopened: back to a draft; the payment stays paid");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL PM TERMS TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
