// v54: the Financing card on the project overview and its details window: money received from the lender
// and investors, interest accrued (default rate past maturity), fees, what is owed today and on a payoff date.
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
// like the app: cents only when there are any
const money = (v, c) => {
  const cents = c && Math.abs(v - Math.round(v)) >= 0.005;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
};
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const deal = {
  address: "88 Loan Way, Willoughby, OH 44094", sqft: 1000, holdMonths: 3, arv: 160000, yearBuilt: 1946, purchase: 100000, repairs: [], useRepairBuilder: false, manualRepair: 10000,
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.18, intRateRehab: 0.18, points: 0, investorAmount: null, investorAuto: true, investorRate: 0.09,
  analysisDate: day(-200), taxAnnual: 2129, insMonthly: 225, utilGas: 75, utilWater: 75, utilElec: 50, hoaMonthly: 0, miscHold: 0,
  buyTxn: txn(), sellTxn: txn(), actualSale: 0, stage: "rehab", uwBaseline: null, rehabFunding: "draws", drawCount: 1, drawMonths: 6, drawFee: 0,
  actuals: [{ id: 1, cat: "Acquisition", label: "Purchase price $100,000", amount: 100000, date: day(-174), tag: "purchase_price", files: [] }],
  mgmt: { closing: { date: day(-174), price: 100000 }, rehab: { startDate: day(-170) } },
};
const addM = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1 + n, d);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};
// 1.5% for each full month, the days after the last full month ÷ 30
const monthly = (amt, from, to) => {
  let n = 0;
  while (addM(from, n + 1) <= to) n++;
  return amt * 0.015 * (n + Math.round((new Date(to) - new Date(addM(from, n))) / 864e5) / 30);
};

(async () => {
  const drive = makeDrive();
  const fid = drive.add("88 Loan Way, Willoughby, OH 44094.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, nav } = t;
  const saved = () => JSON.parse(drive.files[fid].content);
  const card = () => doc.querySelector(".fin-card");
  const w = () => doc.querySelector(".fin-w");
  const inp = (label) => w().querySelector(`[aria-label="${label}"]`);
  const commit = async (label, v) => {
    const el = inp(label);
    await setVal(el, v);
    el.dispatchEvent(new t.win.FocusEvent("focusout", { bubbles: true }));
    await settle(3);
  };
  const hero = (k) => [...w().querySelectorAll(".xw-hero > div")].find((d) => d.querySelector("span").textContent === k).querySelector("b").textContent;

  console.log("1. The card, from the Flip analysis until real terms are entered");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(40);
  await settle(10);
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("88 Loan Way")));
  await sleep(30);
  await settle(10);
  assert(card() && /Financing/.test(card().querySelector(".dcard-h").textContent), "a Financing card sits beside the other three");
  // plan: $80,000 at closing, the $10,000 rehab draw not received; investors (auto) $20,000 + 9% flat
  const i80 = (80000 * 0.18 * 174) / 365;
  assert(/Interest owed today/.test(card().textContent) && card().querySelector(".ov-stat.big b").textContent === money(i80), "derived: interest owed today on the $80,000 released at closing");
  assert(card().textContent.includes(`$80,000 since ${mmdd(day(-174))}, 174 days`) && /Investors, \$20,000 planned\s*not in yet/.test(card().textContent), "one line per loan amount with its days; the analysis's investors are planned, not in yet");
  assert(/Owed today, lender and investors/.test(card().textContent) && card().textContent.includes("Owed today, lender and investors" + money(80000 + i80)), "and the total owed today: no investor money in yet");
  assert(/From the Flip analysis/.test(card().textContent), "and it says the terms are from the Flip analysis");

  console.log("2. Enter the real loan in the details window");
  await click(card().querySelector(".dcard-link"));
  assert(w() && /These terms come from the Flip analysis/.test(w().textContent), "the window opens on the derived terms");
  await commit("Lender name", "Bridgeit LLC");
  await commit("Note amount", "90,000");
  await commit("Interest rate", 18);
  await setVal(inp("Interest is charged on"), "full");
  await setVal(inp("Maturity date"), day(8));
  await commit("Default rate", 30);
  await setVal(inp("Release date"), day(-93));
  await setVal(inp("Release amount"), "10000");
  await click(btn("Add release", w()));
  await setVal(inp("Fee name"), "Extension fee (1 point)");
  await setVal(inp("Fee amount"), "900");
  await click(btn("Add fee", w()));
  const inv = w().querySelector(".fin-inv-r");
  const ia = inv.querySelector('[aria-label="Investor amount"]');
  await setVal(ia, "30000");
  ia.dispatchEvent(new t.win.FocusEvent("focusout", { bubbles: true }));
  await settle(3);
  assert(/Not in yet/.test(w().querySelector(".fin-inv-r").textContent), "no money-in date: the investor shows Not in yet");
  await setVal(w().querySelector('.fin-inv-r [aria-label="Money in"]'), day(-174));
  assert(!/These terms come from the Flip analysis/.test(w().textContent), "the first edit saved the deal's own terms");
  const i90 = (90000 * 0.18 * 174) / 365; // the full note, from closing
  assert(hero("Interest owed today") === money(i90, true) && hero("Lender payoff today") === money(90000 + i90 + 900, true), `interest today ${hero("Interest owed today")}; payoff = $90,000 + interest + $900 fee`);
  assert(/^\$32,700(\.00)?$/.test(hero("Owed to investors")) && hero("Interest grows") === money((90000 * 0.18) / 365, true) + "/day", "investors $32,700; interest grows $44.38 a day");
  assert(/Matures/.test(w().querySelector(".xw-sec-h em").textContent) && w().querySelector(".xw-sec-h em.warn"), "maturity in 8 days is flagged");
  await setVal(inp("Interest is charged on"), "funded");
  const iFunded = (80000 * 0.18 * 174) / 365 + (10000 * 0.18 * 93) / 365;
  assert(hero("Interest owed today") === money(iFunded, true), "charged only on what was released: the $10,000 accrues from its release date");
  const rows = [...w().querySelectorAll(".fin-row")].map((r) => r.textContent);
  assert(rows.some((r) => r.startsWith(`Interest on $80,000 from ${mmdd(day(-174))}, 174 days at 1.5% a month`)) && rows.some((r) => r.startsWith(`Interest on $10,000 from ${mmdd(day(-93))}, 93 days`)), "the window lists the interest on each amount, with its days");
  await setVal(inp("Interest is counted"), "month");
  const iMonth = monthly(80000, day(-174), day(0)) + monthly(10000, day(-93), day(0));
  assert(hero("Interest owed today") === money(iMonth, true), `by month: 1.5% per full month, part months ÷ 30 → ${money(iMonth, true)}`);
  await setVal(inp("Interest is counted"), "365");
  await setVal(inp("Interest is charged on"), "full");
  await setVal(inp("Payoff date"), day(29));
  const at = [...w().querySelectorAll(".xw-sec")].pop().textContent;
  const def = (90000 * 0.3 * 21) / 365;
  assert(at.includes("of which default interest after " + mmdd(day(8))) && at.includes(money(def, true)), "paying off 21 days past maturity shows the default interest");
  await click(btn("Done", w()));
  assert(!w(), "Done closes the window");

  console.log("3. The card shows where things stand, and it is saved");
  assert(card().textContent.includes("Matures " + mmdd(day(8)) + ", in 8 days") && card().querySelector(".ov-note.warn"), "card: matures in 8 days, amber");
  assert(card().textContent.includes(`$90,000 since ${mmdd(day(-174))}, 174 days`) && /Lender fees due at payoff\$900/.test(card().textContent) && /Investors, \$30,000 in\$2,700 return/.test(card().textContent), "card rows: the note's interest line, fees due, investors in + return");
  assert(card().textContent.includes("Owed today, lender and investors" + money(90000 + i90 + 900 + 32700)), "and the total owed today");
  await sleep(1700);
  await settle(6);
  let s = saved();
  const L = s.mgmt.financing.lender;
  assert(L.name === "Bridgeit LLC" && L.note === 90000 && L.funded === 80000 && L.rate === 0.18 && L.defaultRate === 0.3 && L.maturity === day(8) && L.accrual === "full", "lender terms saved with the deal");
  assert(L.fees.some((f) => f.label === "Extension fee (1 point)" && f.amount === 900 && !f.paid), "the $900 fee saved as due at payoff");
  assert(s.mgmt.draws.length === 1 && s.mgmt.draws[0].amount === 10000 && s.mgmt.draws[0].received === day(-93), "the release saved as a received lender draw");
  assert(s.mgmt.financing.investors[0].amount === 30000 && s.mgmt.financing.investors[0].basis === "flat", "investor saved");
  assert(s.mgmt.log.some((l) => /Lender released \$10,000/.test(l.text)), "the release is in the activity log");

  console.log("4. Past maturity: default interest, in red");
  await click(card().querySelector(".dcard-link"));
  await setVal(inp("Maturity date"), day(-4));
  const iPast = (90000 * 0.18 * 170) / 365 + (90000 * 0.3 * 4) / 365;
  assert(hero("Interest owed today") === money(iPast, true) && w().querySelector(".xw-hero b.neg"), "interest at 18% to maturity, then 30%, in red");
  assert(hero("Interest grows") === money((90000 * 0.3) / 365, true) + "/day" && /\$2,250 a month, at the default rate/.test(w().textContent), "growing at the default rate now: $2,250 a month");
  await click(btn("Done", w()));
  assert(card().querySelector(".ov-note.neg") && /Past maturity \(.+\) by 4 days, default rate 2\.5%\/mo/.test(card().textContent), "card: past maturity by 4 days, red");
  assert(card().querySelector(".fin-lines em.neg"), "and the interest line turns red");

  console.log("5. An investor paid back stops counting");
  await click(card().querySelector(".dcard-link"));
  await setVal(w().querySelector('.fin-inv-r [aria-label="Paid back on"]'), day(0));
  assert(/^\$0(\.00)?$/.test(hero("Owed to investors")), "nothing owed to the investor once paid back");
  await click(btn("Done", w()));
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL FINANCING TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
