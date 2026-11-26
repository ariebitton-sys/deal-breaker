// v71: Capital deployed, split by who funded it: investors (money in, dated) and Kappa (outside lender
// principal received + Kappa's own money / internal loan). Summaries carry ci / cl; the tile shows the split.
const fs = require("fs"),
  vm = require("vm"),
  babel = require("@babel/core");
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};

const src = fs.readFileSync(__dirname + "/../dist/app.jsx", "utf8");
const code = babel.transformSync(src.slice(0, src.indexOf("function App()")), { babelrc: false, configFile: false, sourceType: "script", presets: [["@babel/preset-react", { runtime: "classic" }]] }).code;
const C = { React: { useState() {}, useMemo() {}, useEffect() {}, useRef() {}, createElement() {}, Fragment: "F" }, window: {}, localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(C);
vm.runInContext(code + ";this.__g={summarizeDeal};", C);
const { summarizeDeal } = C.__g;

const pad = (n) => String(n).padStart(2, "0");
const day = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const base = (o) => ({
  sqft: 1200, holdMonths: 5, arv: 260000, purchase: 100000, repairs: [], useRepairBuilder: false, manualRepair: 30000, pm: { type: "flat", val: 0 },
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.18, intRateRehab: 0.18, points: 0, investorAuto: true, investorRate: 0.09,
  taxAnnual: 0, insMonthly: 0, utilGas: 0, utilWater: 0, utilElec: 0, hoaMonthly: 0, miscHold: 0, buyTxn: txn(), sellTxn: txn(), ...o,
});
// an outside lender ($90K at closing + a $10K release), $30K of investors in, and a $15K investor not in yet
const lenderDeal = base({
  address: "635 Fund Trl, Willoughby, OH 44094", stage: "market",
  actuals: [{ id: 1, cat: "Acquisition", label: "Purchase", amount: 100867, date: day(-170) }, { id: 2, cat: "Rehab / Construction", label: "Rehab", amount: 20000, date: day(-100) }],
  mgmt: {
    closing: { date: day(-170), price: 100000 }, rehab: { startDate: day(-165) }, listing: { date: day(-3), price: 260000, prices: [] },
    draws: [{ id: "d1", amount: 10000, received: day(-90) }],
    financing: {
      lender: { kind: "lender", name: "Lima One", note: 100000, funded: 90000, start: day(-170), rate: 0.18, accrual: "funded", dayCount: "month", fees: [] },
      investors: [{ id: "i1", name: "Investor A", amount: 30000, date: day(-160), rate: 0.09, basis: "flat" }, { id: "i2", name: "Investor B", amount: 15000, date: "", rate: 0.09, basis: "flat" }],
    },
  },
});
// a Kappa internal loan: everything is Kappa's
const kappaDeal = base({
  address: "4623 Kappa Ave, Indianapolis, IN 46205", stage: "rehab",
  actuals: [{ id: 1, cat: "Acquisition", label: "Purchase", amount: 50000, date: day(-30) }],
  mgmt: { closing: { date: day(-30), price: 50000 }, rehab: { startDate: day(-25) }, financing: { lender: { kind: "kappa", name: "Kappa internal loan", rate: 0.18, dayCount: "365", fees: [] } } },
});

console.log("1. The summary says where the money came from");
let s = summarizeDeal(lenderDeal);
assert(s.fs === 1 && s.ci === 30000 && s.cl === 100000, "outside lender: $30K investors in (the undated $15K isn't), $100K lender principal ($90K + $10K release)");
s = summarizeDeal(kappaDeal);
assert(s.fs === 1 && s.ci === undefined && s.cl === undefined, "Kappa internal loan: no investors, no outside lender");
s = summarizeDeal(base({ address: "1 Lead St", stage: "analyzing", actuals: [], mgmt: {} }));
assert(s.fs === undefined && s.ci === undefined, "a deal in analysis: nothing to split");
const derived = summarizeDeal(base({ address: "9 Plan St", stage: "rehab", actuals: [{ id: 1, cat: "Acquisition", label: "Purchase", amount: 100000, date: day(-20) }], mgmt: { closing: { date: day(-20), price: 100000 } } }));
assert(derived.cl === 80000, "no lender entered: the analysis's purchase loan (80%) from the closing date");

(async () => {
  const drive = makeDrive();
  drive.add("635 Fund Trl, Willoughby, OH 44094.json", lenderDeal);
  drive.add("4623 Kappa Ave, Indianapolis, IN 46205.json", kappaDeal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, settle, sleep, nav } = t;
  console.log("2. The Capital deployed tile");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(80);
  await settle(14);
  const tile = () => [...doc.querySelectorAll(".pf-strip > div")].find((d) => /Capital deployed/.test(d.textContent));
  // $120,867 (investors $30K, lenders $90,867 of their $100K) + $50,000 Kappa's own = $170,867
  assert(tile().querySelector("b").textContent === "$170,867", "capital deployed: $170,867");
  const split = tile().querySelector(".cap-split");
  assert(split && /Investors\s*\$30K/.test(split.textContent) && /Kappa\s*\$141K/.test(split.textContent), "Investors $30K · Kappa $141K");
  assert(/Kappa: \$91K loans \+ \$50K own/.test(split.querySelector(".cap-sub").textContent), "Kappa's share: $91K lender loans (capped at what was spent) + $50K own");
  const tip = split.getAttribute("title");
  assert(tip.startsWith("Investors $30,000 (18%) · Kappa $140,867 (82%): lender loans $90,867, Kappa's own $50,000"), "the tooltip: the totals with percentages");
  assert(/635 Fund Trl: \$120,867\. Investors \$30,000, Kappa \$90,867 \(lenders \$90,867, own \$0\)/.test(tip) && /4623 Kappa Ave: \$50,000\. Investors \$0, Kappa \$50,000/.test(tip), "and each project");
  const bars = split.querySelectorAll(".cap-bar i");
  assert(bars.length === 3, "a bar in three parts: investors, lenders, Kappa's own");
  await click(nav(/^Active projects/));
  assert(tile().querySelector(".cap-split"), "the same on Active projects");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL CAPITAL TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
