// v61: a Kappa internal loan follows the money spent; investors count once their money is in.
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
const money = (v, c) => {
  const cents = c && Math.abs(v - Math.round(v)) >= 0.005;
  return (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
};
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const deal = {
  address: "4623 Kappa Ave, Cleveland, OH 44102", sqft: 1400, holdMonths: 5, arv: 425000, yearBuilt: 1920, purchase: 132675, repairs: [], useRepairBuilder: false, manualRepair: 100000,
  loanOnPurchasePct: 1, loanOnRehabPct: 1, intRatePurchase: 0.16, intRateRehab: 0.16, points: 0, investorAmount: 15000, investorAuto: false, investorRate: 0.1,
  analysisDate: day(-30), taxAnnual: 0, insMonthly: 0, utilGas: 0, utilWater: 0, utilElec: 0, hoaMonthly: 0, miscHold: 0,
  buyTxn: txn(), sellTxn: txn(), actualSale: 0, stage: "rehab", uwBaseline: null, rehabFunding: "internal", purchaseLender: "kappa", drawCount: 1, drawMonths: 3, drawFee: 0,
  actuals: [
    { id: 1, cat: "Acquisition", label: "Purchase price $132,675", amount: 132675, date: day(-7), tag: "purchase_price", files: [] },
    { id: 2, cat: "Acquisition", label: "Closing costs", amount: 2325, date: day(-7), files: [] },
    { id: 3, cat: "Rehab / Construction", label: "Demo", amount: 8000, date: day(-3), files: [] },
    { id: 4, cat: "Rehab / Construction", label: "Roofer deposit, not paid yet", amount: 6000, date: day(-1), unpaid: true, files: [] },
  ],
  mgmt: { closing: { date: day(-7), price: 132675 }, rehab: { startDate: day(-6) } },
};
const rate = 0.16;
const iOf = (amt, days) => (amt * rate * days) / 365;

(async () => {
  const drive = makeDrive();
  const fid = drive.add("4623 Kappa Ave, Cleveland, OH 44102.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, nav } = t;
  const saved = () => JSON.parse(drive.files[fid].content);
  const card = () => doc.querySelector(".fin-card");
  const w = () => doc.querySelector(".fin-w");
  const hero = (k) => [...w().querySelectorAll(".xw-hero > div")].find((d) => d.querySelector("span").textContent === k).querySelector("b").textContent;
  const loanFrom = async (l) => {
    if (!doc.querySelector('[aria-label="Purchase loan from"]')) await click([...doc.querySelectorAll("section.grp")].find((x) => x.querySelector(".grp-title").textContent === "Financing").querySelector(".grp-head"));
    return [...doc.querySelector('[aria-label="Purchase loan from"]').querySelectorAll("button")].find((b) => b.textContent === l);
  };

  console.log("1. Kappa internal loan in the analysis: the card follows the money spent");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(40);
  await settle(10);
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Kappa Ave")));
  await sleep(30);
  await settle(10);
  const interest = iOf(135000, 7) + iOf(8000, 3);
  assert(/Lender payoff today\$[\d,]+Kappa internal loan/.test(card().textContent), "the lender is Kappa internal loan");
  assert(card().querySelector(".ov-stat.big b").textContent === money(interest), `interest owed today: $135,000 for 7 days + $8,000 for 3 days at 16% = ${money(interest)}`);
  assert(card().textContent.includes(`$135,000 spent on ${mmdd(day(-7))}, 7 days`) && card().textContent.includes(`$8,000 spent on ${mmdd(day(-3))}, 3 days`), "one line per day's spending");
  assert(/Investors, \$15,000 planned\s*not in yet/.test(card().textContent), "the analysis's $15,000 investor: planned, not in yet");
  assert(card().textContent.includes("Owed today, lender and investors" + money(143000 + interest)), "owed: Kappa's $143,000 balance (not the $6,000 unpaid bill) plus interest");

  console.log("2. The details window");
  await click(card().querySelector(".dcard-link"));
  assert(w().querySelector('[aria-label="Loan type"]').value === "kappa" && !w().querySelector('[aria-label="Note amount"]') && !w().querySelector('[aria-label="Release amount"]'), "loan type Kappa internal loan; no note or releases to enter");
  assert(/Money Kappa has advanced/.test(w().textContent) && w().textContent.includes("Kappa's balance$143,000"), "money advanced: the paid expenses by date, balance $143,000");
  assert(hero("Interest owed today") === money(interest, true) && hero("Interest grows") === money((143000 * rate) / 365, true) + "/day", "interest owed today, and $62.68 a day on the balance");
  // the investor's money comes in 2 days ago: the balance drops from then
  await setVal(w().querySelector('.fin-inv-r [aria-label="Money in"]'), day(-2));
  const interest2 = interest - iOf(15000, 2);
  assert(hero("Interest owed today") === money(interest2, true) && w().textContent.includes("Kappa's balance$128,000"), "investor money in 2 days ago: balance $128,000, less interest");
  assert(hero("Owed to investors") === money(16500, true), "and the investor is owed $15,000 + 10%");
  await click(btn("Done", w()));
  await sleep(1700);
  await settle(6);
  let s = saved();
  assert(s.mgmt.financing.investors[0].date === day(-2) && !s.mgmt.financing.lender, "saved: the investor's date; the loan still follows the analysis");

  console.log("3. Switching the analysis");
  await click(nav(/^Flip analysis/));
  await click(await loanFrom("Outside lender"));
  await click(nav(/^Project overview/));
  assert(!/Kappa internal loan/.test(card().textContent) && card().textContent.includes(`$132,675 since ${mmdd(day(-7))}`), "outside lender: the note from closing again");
  await click(card().querySelector(".dcard-link"));
  await click(w().querySelector('[aria-label="Lender name"]'));
  const nm = w().querySelector('[aria-label="Lender name"]');
  await setVal(nm, "Bridge Capital");
  nm.dispatchEvent(new t.win.FocusEvent("focusout", { bubbles: true }));
  await settle(3);
  await click(btn("Done", w()));
  await click(nav(/^Flip analysis/));
  await click(await loanFrom("Kappa internal loan"));
  await click(nav(/^Project overview/));
  assert(/Kappa internal loan/.test(card().textContent) && card().textContent.includes(`$135,000 spent on ${mmdd(day(-7))}`), "entered terms follow the analysis back to Kappa internal loan");
  await sleep(1700);
  await settle(6);
  s = saved();
  assert(s.purchaseLender === "kappa" && s.mgmt.financing.lender.kind === "kappa" && s.mgmt.financing.lender.name === "Kappa internal loan", "saved: purchaseLender kappa; the loan's kind and name");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL KAPPA LOAN TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
