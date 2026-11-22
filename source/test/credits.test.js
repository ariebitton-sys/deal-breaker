// v53: a seller's credit counted twice (the v43-47 migration beside a later statement re-import) is cleaned
// up once on load, and a deal past analysis with no frozen plan can save its current numbers as the plan.
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const credit = "1111 Investor Credit to Title Co";
const deal = {
  address: "77 Test Trl, Willoughby, OH 44094", sqft: 1200, holdMonths: 3, arv: 160000, yearBuilt: 1960, purchase: 100000, repairs: [], useRepairBuilder: false, manualRepair: 10000,
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.18, intRateRehab: 0.18, points: 0, investorAmount: null, investorAuto: true, investorRate: 0.09,
  analysisDate: "2026-05-20", taxAnnual: 2129, insMonthly: 225, utilGas: 75, utilWater: 75, utilElec: 50, hoaMonthly: 0, miscHold: 0,
  buyTxn: txn(), sellTxn: txn(), actualSale: 0, stage: "rehab", uwBaseline: null, rehabFunding: "draws", drawCount: 1, drawMonths: 6, drawFee: 0,
  actuals: [
    { id: 1001, cat: "Rehab / Construction", label: "Paint and flooring", amount: 6025, date: "2026-07-01", files: [] },
    { id: 1002, cat: "Acquisition", label: "Purchase price $100,000", amount: 100000, date: "2026-06-02", tag: "purchase_price", files: [] },
    { id: 1003, cat: "Holding", label: "Property tax credit from the seller at closing (County Taxes 01/01/26 to 06/02/26)", amount: -892.21, date: "2026-06-02", tag: "stmt_buy_credit", files: [] },
    { id: 1004, cat: "Acquisition", label: `Credit from the seller at closing (${credit})`, amount: -150, date: "2026-06-02", tag: "stmt_buy_credit", files: [] },
    { id: 1005, cat: "Acquisition", label: `Credit from the seller at closing (${credit})`, amount: -150, date: "2026-06-02", tag: "stmt_buy_credit", files: [{ id: "x1", name: "credit memo.pdf" }] },
  ],
  mgmt: {
    closing: { date: "2026-06-02", price: 100000 },
    rehab: { startDate: "2026-06-10" },
    credits: [
      { id: "c-tax", label: "County Taxes 01/01/26 to 06/02/26", amount: 892.21, kind: "tax", from: "stmt_buy", date: "2026-06-02", used: 999, counted: true },
      { id: "c-inv", label: credit, amount: 150, kind: "other", from: "stmt_buy", date: "2026-06-02", used: 1005, counted: true },
    ],
  },
};

(async () => {
  const drive = makeDrive();
  const fid = drive.add("77 Test Trl, Willoughby, OH 44094.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, settle, sleep, nav } = t;
  const saved = () => JSON.parse(drive.files[fid].content);

  console.log("1. A duplicate seller's credit is removed once, on load");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(40);
  await settle(10);
  await click(nav(/^Active projects/));
  const row = [...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("77 Test Trl"));
  await click(row);
  await sleep(30);
  await settle(10);
  await sleep(1700); // autosave
  await settle(10);
  let s = saved();
  const inv = s.actuals.filter((a) => a.label.includes(credit));
  assert(inv.length === 1 && inv[0].id === 1004, "one investor credit left: the imported one");
  assert(inv[0].files.length === 1 && inv[0].files[0].name === "credit memo.pdf", "it took over the file attached to the removed copy");
  assert(s.actuals.some((a) => a.id === 1003) && s.actuals.length === 4, "the tax credit and the other entries are untouched");
  const ci = s.mgmt.credits.find((c) => c.id === "c-inv");
  assert(ci.used === 1004 && ci.counted, "the credit now points to the entry that stays");
  assert(s.mgmt.credits.find((c) => c.id === "c-tax").used === 999, "the tax credit record is left as it was");
  assert(s.mgmt.log.some((l) => /Removed a duplicate ledger entry: Credit from the seller at closing/.test(l.text) && /−\$150/.test(l.text)), "the cleanup is in the activity log");
  const logs = s.mgmt.log.length;
  await sleep(1700);
  await settle(6);
  assert(saved().actuals.length === 4 && saved().mgmt.log.length === logs, "it runs once: nothing more on the next pass");

  console.log("2. Save the current numbers as the original plan");
  await click(nav(/^Flip analysis/));
  const banner = doc.querySelector(".baseline");
  assert(banner && /No original plan is saved/.test(banner.textContent) && /\$42,793/.test(banner.textContent), "rehab deal with no plan: the banner offers to save the current $42,793");
  await click(btn("Save as original plan", banner));
  await settle(4);
  assert(/Original underwriting/.test(doc.querySelector(".baseline").textContent) && ![...doc.querySelectorAll("button")].some((b) => /Save as original plan/.test(b.textContent)), "the banner now shows the frozen plan");
  await sleep(1700);
  await settle(6);
  s = saved();
  assert(s.uwBaseline && Math.round(s.uwBaseline.m.netProfit) === 42793 && s.uwBaseline.inputs.holdMonths === 3, "saved: the plan at $42,793, 3 months");
  assert(s.mgmt.log.some((l) => /Original plan saved from the current numbers: \$42,793/.test(l.text)), "logged");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL CREDITS TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
