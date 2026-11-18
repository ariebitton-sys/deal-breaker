// Google sign-in: survives a reload while the hour lasts; renews on the user's next click;
// no background pop-ups; one Google window per reconnect.
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
const deal = {
  address: "100 Alpha St, Cleveland, OH 44102", sqft: 1200, holdMonths: 4, arv: 200000, yearBuilt: 1950, purchase: 100000,
  repairs: [], useRepairBuilder: false, manualRepair: 30000, loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.12, intRateRehab: 0.16,
  points: 0, investorAmount: 0, investorAuto: true, investorRate: 0.09, analysisDate: day(-20), taxAnnual: 0, insuranceMonthly: 120,
  utilitiesMonthly: 150, lawnMonthly: 0, miscMonthly: 0, buyTxn: txn(), sellTxn: txn(), actuals: [], stage: "analyzing", mgmt: {},
};
const SETTINGS = { clientId: "c", folderId: "f" };
const stored = (t) => JSON.parse(t.win.localStorage.getItem("kappa_google_token") || "null");
const rows = (t) => t.doc.querySelectorAll("tr.dt-row").length;
(async () => {
  console.log("1. Connect: the token is kept with its expiry");
  const drive = makeDrive();
  drive.add("100 Alpha St, Cleveland, OH 44102.json", deal);
  const t = await boot({ drive, settings: SETTINGS });
  await t.click(t.btn("Connect Google", t.doc.querySelector(".pf-empty")));
  await t.sleep(30); await t.settle(10);
  const s1 = stored(t);
  assert(t.gis.requests === 1, "one Google window for one click on Connect (the click listener and the button share it)");
  assert(s1 && s1.token === "tok1" && s1.cid === "c" && s1.exp - Date.now() > 55 * 60 * 1000, "token stored with about an hour left");
  assert(rows(t) === 1, "deal list loaded");

  console.log("2. Reload within the hour: still connected, no Google window");
  const t2 = await boot({ drive, settings: SETTINGS, localStorageInit: { kappa_google_token: JSON.stringify(s1), kappa_user_email: "arie@kappainv.com" } });
  await t2.sleep(30); await t2.settle(10);
  assert(t2.gis.requests === 0 && rows(t2) === 1 && !/Connect Google/.test(t2.doc.querySelector(".topbar").textContent), "deal list loads straight away after a reload");
  await t2.click(t2.doc.querySelector("tr.dt-row"));
  await t2.sleep(20); await t2.settle(10);
  assert(t2.gis.requests === 0 && t2.doc.querySelector(".dh-addr"), "clicks with plenty of time left don't touch Google");

  console.log("3. Token from another Client ID is ignored");
  const t3 = await boot({ drive, settings: { clientId: "other", folderId: "f" }, localStorageInit: { kappa_google_token: JSON.stringify(s1) } });
  await t3.settle(10);
  assert(rows(t3) === 0 && t3.doc.querySelector(".pf-empty"), "not connected with a token for a different app");

  console.log("4. Near the end of the hour: the next click renews it");
  const soon = { ...s1, exp: Date.now() + 4 * 60 * 1000 };
  const t4 = await boot({ drive, settings: SETTINGS, localStorageInit: { kappa_google_token: JSON.stringify(soon), kappa_user_email: "arie@kappainv.com" } });
  await t4.sleep(30); await t4.settle(10);
  assert(t4.gis.requests === 0 && rows(t4) === 1, "connected; nothing happens on its own (no blocked background pop-up)");
  await t4.click(t4.doc.querySelector("tr.dt-row"));
  await t4.sleep(30); await t4.settle(10);
  assert(t4.gis.requests === 1 && stored(t4).token === "tok1" && stored(t4).exp - Date.now() > 55 * 60 * 1000, "a click renewed the token for another hour");
  assert(t4.gis.hints[0] === "arie@kappainv.com", "Google is told which account (the Kappa one)");
  await t4.click(t4.doc.querySelector(".dh-addr"));
  await t4.settle(4);
  assert(t4.gis.requests === 1, "no second renewal right after");

  console.log("5. Hour ran out (e.g. after a break): first click anywhere reconnects");
  const old = { ...s1, exp: Date.now() - 10 * 60 * 1000 };
  const t5 = await boot({ drive, settings: SETTINGS, localStorageInit: { kappa_google_token: JSON.stringify(old), kappa_user_email: "arie@kappainv.com" } });
  await t5.settle(10);
  assert(rows(t5) === 0 && t5.doc.querySelector(".pf-empty"), "expired token is not used");
  await t5.click(t5.doc.querySelector(".sidebar"));
  await t5.sleep(30); await t5.settle(10);
  assert(t5.gis.requests === 1 && rows(t5) === 1, "a click on the page reconnected and loaded the deals, no Connect button needed");
  const t5b = await boot({ drive, settings: SETTINGS, localStorageInit: { kappa_google_token: JSON.stringify(old), kappa_user_email: "arie@kappainv.com" } });
  await t5b.settle(10);
  await t5b.click(t5b.btn(/^\s*Settings$/));
  await t5b.settle(6);
  assert(t5b.gis.requests === 0, "opening Settings doesn't trigger a reconnect");

  console.log("6. Token rejected and the browser blocks Google's window: clean fallback");
  const drive6 = makeDrive();
  drive6.add("100 Alpha St, Cleveland, OH 44102.json", deal);
  drive6.rejected.add("revoked");
  const t6 = await boot({ drive: drive6, settings: SETTINGS, localStorageInit: { kappa_google_token: JSON.stringify({ ...s1, token: "revoked" }), kappa_user_email: "arie@kappainv.com" }, gisInit: { fail: "popup_failed_to_open" } });
  await t6.sleep(40); await t6.settle(10);
  assert(t6.gis.requests === 1 && !stored(t6) && t6.doc.querySelector(".pf-empty"), "blocked renewal → token dropped, Connect shown again");
  t6.gis.fail = null;
  await t6.click(t6.doc.querySelector(".sidebar"));
  await t6.sleep(30); await t6.settle(10);
  assert(rows(t6) === 1 && stored(t6).token === "tok2", "next click reconnects");
  const errs = t6.errors.filter((e) => !/sign-in expired/.test(e));
  assert(errs.length === 0 && t.errors.length === 0 && t2.errors.length === 0 && t4.errors.length === 0 && t5.errors.length === 0, "no other errors " + errs.join(" | "));
  console.log("\nALL AUTH TESTS PASSED");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e); process.exit(1); });
