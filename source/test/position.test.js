// v56: Position today — paid / not paid on ledger entries, and the statement of everything the deal is
// committed to: the ledger, what is owed under the financing terms, and estimates for unrecorded holding costs.
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
const money = (v) => (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const deal = {
  address: "99 Ledger Ln, Willoughby, OH 44094", sqft: 1000, holdMonths: 3, arv: 160000, yearBuilt: 1946, purchase: 100000, repairs: [], useRepairBuilder: false, manualRepair: 10000,
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.18, intRateRehab: 0.18, points: 0, investorAmount: 30000, investorAuto: false, investorRate: 0.09,
  analysisDate: day(-200), taxAnnual: 2129, insMonthly: 225, utilGas: 75, utilWater: 75, utilElec: 50, hoaMonthly: 0, miscHold: 0,
  buyTxn: txn(), sellTxn: txn(), actualSale: 0, stage: "rehab", uwBaseline: null, rehabFunding: "draws", drawCount: 1, drawMonths: 6, drawFee: 0,
  actuals: [
    { id: 1, cat: "Acquisition", label: "Purchase price $100,000", amount: 100000, date: day(-174), tag: "purchase_price", files: [] },
    { id: 2, cat: "Financing", label: "Doc prep fee", amount: 700, date: day(-174), files: [] },
    { id: 3, cat: "Holding", label: "Property tax credit from the seller at closing", amount: -892.21, date: day(-174), tag: "stmt_buy_credit", files: [] },
    { id: 4, cat: "Rehab / Construction", label: "Paint and flooring", amount: 12050, date: day(-120), files: [] },
    { id: 5, cat: "Rehab / Construction", label: "Countertops, balance due", amount: 1945, date: day(-3), unpaid: true, files: [] },
  ],
  mgmt: {
    closing: { date: day(-174), price: 100000 },
    rehab: { startDate: day(-170) },
    draws: [{ id: "r1", requested: day(-113), received: day(-113), amount: 10000, fee: 0 }],
    financing: {
      lender: { name: "Bridgeit LLC", note: 90000, funded: 80000, start: day(-174), rate: 0.18, accrual: "funded", dayCount: "365", maturity: day(8), defaultRate: 0.3, paidInterest: 0, fees: [{ id: "f1", label: "Extension fee", amount: 900, paid: false }] },
      investors: [{ id: "i1", name: "Investors", amount: 30000, date: day(-174), rate: 0.09, basis: "flat", paidBack: "" }],
    },
  },
};

(async () => {
  const drive = makeDrive();
  const fid = drive.add("99 Ledger Ln, Willoughby, OH 44094.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, nav } = t;
  const saved = () => JSON.parse(drive.files[fid].content);
  const w = () => doc.querySelector(".pos-w");
  const hero = (k) => [...w().querySelectorAll(".xw-hero > div")].find((d) => d.querySelector("span").textContent === k).querySelector("b").textContent;
  const accounting = () => [...doc.querySelectorAll(".ov-console > .dcard")].find((c) => c.querySelector(".dcard-h") && /Accounting/.test(c.querySelector(".dcard-h").textContent));

  // what the statement should say
  const paid = 100000 + 700 - 892.21 + 12050;
  const interest = (80000 * 0.18 * 174) / 365 + (10000 * 0.18 * 113) / 365;
  const owed = 1945 + interest + 900 + 2700;
  const months = 174 / 30.4375;
  const tax = (2129 * 174) / 365 + 892.21;
  const ins = 225 * months;
  const util = 200 * months;
  const committed = paid + owed + tax + ins + util;

  console.log("1. The Accounting card adds it up");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(40);
  await settle(10);
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("99 Ledger Ln")));
  await sleep(30);
  await settle(10);
  const ac = accounting().textContent;
  assert(ac.includes("Paid so far" + money(paid)) && ac.includes("Owed, not paid yet" + money(owed)), `paid ${money(paid)}, owed ${money(owed)} (the open bill, lender interest, the fee, the investor return)`);
  assert(ac.includes("Estimated, not recorded" + money(tax + ins + util)) && ac.includes("Committed to date" + money(committed)), `estimated ${money(tax + ins + util)}; committed ${money(committed)}`);

  console.log("1b. The numbers strip under the address");
  const kpi = (k) => [...doc.querySelectorAll(".kpi-tile")].find((x) => x.querySelector(".kpi-k").textContent === k);
  assert(doc.querySelectorAll(".kpi-strip .kpi-tile").length === 6 && doc.querySelector(".ov > .kpi-strip + .ov-hero"), "six tiles, above the map card");
  assert(/^Profit at analysis\$[\d,]+Grade .+plan not saved$/.test(kpi("Profit at analysis").textContent), "profit at analysis, flagged when no plan is saved");
  assert(kpi("Spent so far").textContent === "Spent so far" + money(paid) + "+ " + money(owed) + " owed, not paid yet", "spent so far, with what is owed");
  assert(kpi("Paying interest on").textContent === "Paying interest on$90,0001.5% a month, $44.38 a day", "paying interest on $90,000");
  const perDay = (90000 * 0.18) / 365 + 2129 / 365 + 425 / 30.4375;
  assert(kpi("Each extra day costs").textContent === `Each extra day costs${money(perDay)}Day 174 of 91 planned` && kpi("Each extra day costs").querySelector(".kpi-h.warn"), "each extra day costs interest + holding; held longer than planned, amber");
  assert(/^\$[\d,]+$/.test(kpi("Projected profit at sale").querySelector(".kpi-v").textContent) && /committed today/.test(kpi("Projected profit at sale").title) && /^\$[\d,]+$/.test(kpi("Break-even price").querySelector(".kpi-v").textContent), "projected profit at sale (its sum in the tooltip) and the break-even price");

  console.log("2. The statement");
  await click(btn("Position today", accounting()));
  assert(w(), "Position today opens");
  assert(hero("Committed to date") === money(committed) && hero("Paid") === money(paid) && hero("Owed, not paid yet") === money(owed), "hero: committed, paid, owed");
  const cat = (c) => [...w().querySelectorAll(".pos-tr")].find((r) => r.firstChild.textContent === c);
  assert(cat("Rehab / Construction").textContent.includes("$12,050$1,945") && cat("Financing").textContent.includes(money(interest + 900 + 2700)), "by category: rehab paid / not paid; financing owed = interest + fee + investor return");
  const owedRows = [...w().querySelectorAll(".pos-owed")].map((r) => r.textContent);
  assert(owedRows.length === 4 && owedRows[0].includes("Countertops, balance due") && owedRows.some((r) => /Lender interest to date, Bridgeit LLC/.test(r) && r.includes(money(interest))), "owed: the open bill, lender interest, the fee, the investor return");
  const estRows = [...w().querySelectorAll(".pos-est")].map((r) => r.textContent);
  assert(estRows.length === 3 && estRows[0].includes("Property tax owed") && estRows[0].includes("+ $892 the seller credited") && estRows[0].includes(money(tax)), "estimate: tax since closing plus the seller's credited share");
  assert(w().textContent.includes("Lender$90,000") && w().textContent.includes("Investors$30,000") && w().textContent.includes("Loan and investor money not spent yet−" + money(120000 - paid)), "paid so far came from the lender and investors; what they put in beyond that is not spent yet");
  assert(w().textContent.includes("Profit, if nothing more is spent" + money(160000 - committed)) && /Break-even sale price today: \$/.test(w().textContent), "against the sale at the ARV, no selling costs set: profit and break-even");

  console.log("3. Untick an estimate, mark the bill paid");
  await click(w().querySelectorAll('.pos-est input[type="checkbox"]')[1]);
  assert(hero("Committed to date") === money(committed - ins), "insurance left out");
  await click(btn("Mark paid", w()));
  assert(hero("Paid") === money(paid + 1945) && hero("Owed, not paid yet") === money(owed - 1945) && hero("Committed to date") === money(committed - ins), "the bill moves from owed to paid; the total stays");
  doc.dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle(3);
  await sleep(1700);
  await settle(6);
  let s = saved();
  assert(!s.actuals.find((a) => a.id === 5).unpaid && s.mgmt.position.positionSkip.includes("ins"), "saved: the bill paid, insurance left out");

  console.log("4. The ledger: a bill not paid yet");
  await click(nav(/^Expenses & Documents/));
  const addRow = doc.querySelector(".ledger-add-row");
  await setVal(addRow.querySelector('input[placeholder="Description"]'), "Plumber invoice");
  await setVal(addRow.querySelector('input[type="number"]'), "650");
  await click(addRow.querySelector(".lg-paid-tog"));
  await click(addRow.querySelector(".lg-add-btn"));
  const e = [...doc.querySelectorAll(".lg-entry")].find((x) => /Plumber invoice/.test(x.textContent));
  assert(e && e.querySelector(".lg-unpaid"), "added as not paid: the row says so");
  const chip = [...doc.querySelectorAll(".lg-chip")].find((b) => /^Not paid/.test(b.textContent));
  assert(chip && /1/.test(chip.textContent), "a Not paid chip counts it");
  await click(chip);
  assert(doc.querySelectorAll(".xd-ledger .lg-entry").length === 1 && /Not paid yet\$650/.test(doc.querySelector(".lg-total").textContent), "the chip shows only open bills, with their total");
  await click(chip);
  assert(/of which not paid yet\$650/.test(doc.querySelector(".lg-total.sub").textContent), "the ledger total says how much is not paid");
  await click(e.querySelector(".ledger-row"));
  await setVal(doc.querySelector('.xw [aria-label="Paid or not"]'), "paid");
  await click(btn("Done", doc.querySelector(".xw")));
  assert(!doc.querySelector(".lg-unpaid") && !doc.querySelector(".lg-total.sub"), "marked paid in its window: nothing open now");
  await click(btn("Position today", doc.querySelector(".xd-ledger")));
  assert(w() && hero("Owed, not paid yet") === money(owed - 1945), "Position today opens from the ledger too");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL POSITION TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
