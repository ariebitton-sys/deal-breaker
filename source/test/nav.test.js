// Back / Forward: screens are browser history entries; the Back button in the top bar.
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const mk = (address, stage, extra) => ({
  address, sqft: 1200, holdMonths: 4, arv: 200000, yearBuilt: 1950, purchase: 100000,
  repairs: [], useRepairBuilder: false, manualRepair: 30000,
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.12, intRateRehab: 0.16, points: 0,
  investorAmount: 0, investorAuto: true, investorRate: 0.09, analysisDate: day(-20), taxAnnual: 0,
  insuranceMonthly: 120, utilitiesMonthly: 150, lawnMonthly: 0, miscMonthly: 0, buyTxn: txn(), sellTxn: txn(), actuals: [],
  stage, mgmt: { contract: { date: day(-10), price: 100000, expectedClosing: day(20), inspectionEnd: "", emd: 1000 } }, ...extra,
});
(async () => {
  const drive = makeDrive();
  drive.add("100 Alpha St, Cleveland, OH 44102.json", mk("100 Alpha St, Cleveland, OH 44102", "contract"));
  drive.add("200 Beta Ave, Cleveland, OH 44103.json", mk("200 Beta Ave, Cleveland, OH 44103", "contract"));
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const H = t.win.history;
  const back = async () => { H.back(); await t.sleep(30); await t.settle(10); };
  const fwd = async () => { H.forward(); await t.sleep(30); await t.settle(10); };
  const addr = () => (t.doc.querySelector(".dh-addr") ? t.doc.querySelector(".dh-addr").value : null);
  const activeNav = () => { const b = t.doc.querySelector(".sidebar .sb-sub.on, .sidebar button.on, .sidebar [aria-current='page']"); return b ? b.textContent.trim() : ""; };
  const backBtn = () => t.doc.querySelector(".tb-back");
  const nav = (re) => t.btn(re, t.doc.querySelector(".sidebar"));
  const openRow = async (txt) => { await t.click([...t.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes(txt))); await t.sleep(20); await t.settle(10); };

  console.log("1. Start on the dashboard: no Back button yet");
  await t.click(t.btn("Connect Google", t.doc.querySelector(".pf-empty")));
  await t.sleep(30); await t.settle(10);
  assert(!backBtn() && H.state && H.state.v === "portfolio", "dashboard is the first history entry, no Back button");

  console.log("2. Open a deal, switch tab, go back step by step");
  await openRow("100 Alpha St");
  assert(addr() === "100 Alpha St, Cleveland, OH 44102" && backBtn(), "deal opened; Back button appears");
  await t.click(nav(/^Budget vs actual$/));
  assert(H.state.v === "deal" && H.state.m === "budget" && H.length >= 3, "tab change is its own entry");
  await back();
  assert(addr() === "100 Alpha St, Cleveland, OH 44102" && H.state.m === "overview" && /Project overview/.test(t.text()), "Back → the deal's overview");
  await t.click(backBtn());
  await t.sleep(30); await t.settle(10);
  assert(!t.doc.querySelector(".dh-addr") && H.state.v === "portfolio" && !backBtn(), "Back button → dashboard, button hidden again");
  await fwd();
  assert(addr() === "100 Alpha St, Cleveland, OH 44102" && H.state.m === "overview", "Forward → the deal again");

  console.log("3. Back across two different deals reopens the earlier one");
  await t.click([...t.doc.querySelectorAll(".topbar .crumb")][0]);
  await t.settle(6);
  await openRow("200 Beta Ave");
  assert(addr() === "200 Beta Ave, Cleveland, OH 44103", "second deal opened");
  await back();
  assert(!t.doc.querySelector(".dh-addr"), "Back → dashboard");
  await back();
  await t.sleep(40); await t.settle(10);
  assert(addr() === "100 Alpha St, Cleveland, OH 44102", "Back again → first deal reloaded from Drive");

  console.log("4. Unsaved changes: going forward to another deal asks first");
  await t.setVal(t.doc.querySelector(".dh-addr"), "100 Alpha St, Cleveland, OH 44102 (edited)");
  await fwd();
  assert(!t.doc.querySelector(".dh-addr"), "Forward → dashboard (the edited deal stays open in the sidebar)");
  await fwd();
  assert(/Discard and open/.test(t.text()), "Forward → other deal asks to save or discard");
  await t.click(t.btn("Discard and open"));
  await t.sleep(40); await t.settle(10);
  assert(addr() === "200 Beta Ave, Cleveland, OH 44103", "discard → second deal opened");
  assert(t.errors.length === 0, "no errors " + t.errors.join(" | "));
  console.log("\nALL NAV TESTS PASSED");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e); process.exit(1); });
