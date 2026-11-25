// v62: Forecast — what-if scenarios after the purchase: actual costs so far plus each scenario's assumptions.
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
const addM = (s, n) => {
  const [y, m, d] = s.split("-").map(Number);
  return iso(new Date(y, m - 1 + n, d));
};
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const money = (v) => (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const sell = txn();
sell.realtor = { on: true, val: 5, type: "pct" };
const close = day(-30);
const deal = {
  address: "4623 Forecast Ave, Cleveland, OH 44102", sqft: 1400, holdMonths: 7, arv: 425000, yearBuilt: 1920, purchase: 132675, repairs: [], useRepairBuilder: false, manualRepair: 100000,
  pm: { type: "flat", val: 10000 },
  loanOnPurchasePct: 1, loanOnRehabPct: 1, intRatePurchase: 0.16, intRateRehab: 0.16, points: 0, investorAmount: 0, investorAuto: false, investorRate: 0.1,
  analysisDate: day(-60), taxAnnual: 0, insMonthly: 0, utilGas: 0, utilWater: 0, utilElec: 0, hoaMonthly: 0, miscHold: 0,
  buyTxn: txn(), sellTxn: sell, actualSale: 0, stage: "rehab", uwBaseline: null, rehabFunding: "internal", purchaseLender: "kappa", drawCount: 1, drawMonths: 3, drawFee: 0,
  actuals: [
    { id: 1, cat: "Acquisition", label: "Purchase price $132,675", amount: 132675, date: close, tag: "purchase_price", files: [] },
    { id: 2, cat: "Acquisition", label: "Closing costs", amount: 2325, date: close, files: [] },
    { id: 3, cat: "Rehab / Construction", label: "Demo and framing", amount: 20000, date: day(-10), files: [] },
    { id: 4, cat: "Services", label: "Project manager, first payment", amount: 2500, date: day(-5), tag: "pm_fee", files: [] },
  ],
  mgmt: { closing: { date: close, price: 132675 }, rehab: { startDate: day(-28) } },
};
const lead = deal.address.replace("4623 Forecast Ave", "9 Lead St");
const r = 0.16;
// the app's model, by hand
const saleDate = addM(close, 7);
const toSale = days(day(0), saleDate);
const intNow = (135000 * r * 30) / 365 + (20000 * r * 10) / 365 + (2500 * r * 5) / 365;
const intAtSale = (135000 * r * days(close, saleDate)) / 365 + (20000 * r * days(day(-10), saleDate)) / 365 + (2500 * r * days(day(-5), saleDate)) / 365;
const profitOf = ({ price, rehab, pm, extra }) => {
  const rehabToCome = Math.max(0, rehab - 20000);
  const pmToCome = Math.max(0, pm - 2500);
  const future = ((rehabToCome + pmToCome + Math.max(0, extra || 0)) * r * (toSale / 2)) / 365;
  const total = 135000 + (20000 + rehabToCome) + (2500 + pmToCome) + intAtSale + future + price * 0.05 + (extra || 0);
  return price - total;
};

(async () => {
  const drive = makeDrive();
  const fid = drive.add("4623 Forecast Ave, Cleveland, OH 44102.json", deal);
  drive.add("9 Lead St, Cleveland, OH 44102.json", { ...deal, address: lead, stage: "analyzing", actuals: [], mgmt: {} });
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, click, btn, setVal, settle, sleep, nav } = t;
  const saved = () => JSON.parse(drive.files[fid].content);
  const cards = () => [...doc.querySelectorAll(".fc-card")];
  const profit = (i) => cards()[i].querySelector(".fc-profit b").textContent;
  const commit = async (el, v) => {
    await setVal(el, v);
    el.dispatchEvent(new t.win.FocusEvent("focusout", { bubbles: true }));
    await settle(3);
  };
  const field = (i, l) => cards()[i].querySelector(`[aria-label="${l}"]`);
  const ptab = (l) => [...doc.querySelectorAll(".ptabs .ptab")].find((b) => b.textContent.startsWith(l));

  console.log("1. The Forecast tab and its Expected scenario");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(40);
  await settle(10);
  await click(nav(/^Active projects/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((x) => x.textContent.includes("4623 Forecast Ave")));
  await sleep(30);
  await settle(10);
  const rehabBudget = () => [...doc.querySelectorAll(".ov-stat")].find((x) => /^Rehab budget/.test(x.textContent));
  assert(rehabBudget().textContent === "Rehab budget$100,000from the Flip analysis", "the Accounting card's rehab budget: the Flip analysis while there is no forecast");
  assert(ptab("Forecast") && doc.querySelectorAll(".ptabs .ptab")[2] === ptab("Forecast"), "a Forecast tab, after Flip analysis");
  await click(ptab("Forecast"));
  assert(cards().length === 1 && /Expected/.test(cards()[0].querySelector(".fc-name").value) && cards()[0].querySelector(".fc-main"), "one scenario to start: Expected, the forecast");
  assert(field(0, "Sale price").value === "425,000" && field(0, "Sale date").value === saleDate && field(0, "Rehab, total").value === "100,000" && field(0, "Project management").value === "10,000", "its numbers come from the analysis and the deal's dates");
  assert(/\$20,000 spent so far/.test(cards()[0].textContent) && /\$2,500 paid so far/.test(cards()[0].textContent), "what's spent on rehab and the PM so far");
  const p0 = profitOf({ price: 425000, rehab: 100000, pm: 10000 });
  assert(profit(0) === money(p0), `net profit: actual costs so far + rehab, PM, interest and selling to come = ${money(p0)} (got ${profit(0)})`);

  console.log("2. The PM fee came in at $5,000");
  await commit(field(0, "Project management"), "5000");
  const p1 = profitOf({ price: 425000, rehab: 100000, pm: 5000 });
  assert(profit(0) === money(p1), `profit up by $5,000 and the interest on it: ${money(p1)}`);
  await sleep(1700);
  await settle(6);
  let s = saved();
  assert(s.mgmt.scenarios.length === 1 && s.mgmt.scenarios[0].pm === 5000 && s.mgmt.scenarios[0].main && s.pm.val === 10000, "saved as the deal's scenario; the Flip analysis keeps its $10,000");

  console.log("3. A conservative scenario");
  await click(btn("Add scenario", doc.querySelector(".fc-head")));
  assert(cards().length === 2 && cards()[1].querySelector(".fc-name").value === "Conservative" && field(1, "Project management").value === "5,000", "Conservative starts from the forecast (PM $5,000)");
  await commit(field(1, "Sale price"), "375000");
  await commit(field(1, "Rehab, total"), "135000");
  const p2 = profitOf({ price: 375000, rehab: 135000, pm: 5000 });
  assert(profit(1) === money(p2), `sale $375,000, rehab $135,000: ${money(p2)}`);
  const head = [...doc.querySelectorAll(".fc-cmp thead th")].map((x) => x.textContent);
  assert(head.join("|") === "|Plan|Expected|Conservative", "compare: plan and the two scenarios");
  const rowOf = (l) => [...doc.querySelectorAll(".fc-cmp tbody tr")].find((x) => x.firstChild.textContent === l);
  assert(rowOf("Rehab").children[3].textContent === "$135,000+$35,000" && rowOf("Project management").children[2].textContent === "$5,000−$5,000", "rehab +$35,000 over plan; PM $5,000 under");
  assert(rowOf("Selling").children[3].textContent.startsWith("$18,750"), "selling costs at the lower price: 5% of $375,000");

  console.log("4. Other changes, the forecast and the overview");
  await click(btn("Other change (a cost, or a negative amount for a saving)", cards()[1]));
  await commit(cards()[1].querySelector('[aria-label="Change"]'), "Contingency");
  await commit(cards()[1].querySelector('[aria-label="Change amount"]'), "5000");
  const p3 = profitOf({ price: 375000, rehab: 135000, pm: 5000, extra: 5000 });
  assert(profit(1) === money(p3) && rowOf("Other").children[3].textContent.startsWith("$5,000"), "a $5,000 contingency: under Other, and interest on it");
  await click(btn("Use as forecast", cards()[1]));
  assert(cards()[1].querySelector(".fc-main") && !cards()[0].querySelector(".fc-main"), "Conservative is now the forecast");
  const sens = doc.querySelector(".fc-sens");
  assert(/Sensitivity: Conservative/.test(sens.textContent) && sens.querySelector("td.base").textContent === money(p3), "the sensitivity grid follows it");
  assert(/Each \$5,000 off the sale price costs \$4,750 of profit/.test(sens.textContent), "each $5,000 off the price: $4,750 after the 5% realtor");
  await click(ptab("Project overview"));
  const tile = [...doc.querySelectorAll(".kpi-tile")].find((x) => /Projected profit at sale/.test(x.textContent));
  assert(tile.querySelector(".kpi-v").textContent === money(p3) && /Conservative$/.test(tile.querySelector(".kpi-h").textContent), "the overview's Projected profit at sale shows the forecast scenario");
  assert(rehabBudget().textContent === "Rehab budget$135,000from the forecast (Conservative)" && /15% of budget spent/.test(doc.querySelector(".ov-console").textContent), "the Accounting card's rehab budget comes from the forecast: $135,000, $20,000 spent = 15%");
  await sleep(1700);
  await settle(6);
  s = saved();
  assert(s.mgmt.scenarios[1].main && !s.mgmt.scenarios[0].main && s.mgmt.scenarios[1].extras[0].label === "Contingency" && s.mgmt.log.some((l) => /Forecast set to the "Conservative" scenario/.test(l.text)), "saved, and logged");

  console.log("4b. The forecast's rehab is the budget everywhere");
  await click(ptab("Forecast"));
  await commit(field(1, "Rehab, total"), "15000");
  await click(ptab("Expenses"));
  assert(/The rehab and project management budgets and the projected profit come from the forecast \(Conservative\)/.test(doc.querySelector(".xd-rail").textContent), "Expenses: the budget rail says its budgets and projected profit are the forecast's");
  const p4 = profitOf({ price: 375000, rehab: 15000, pm: 5000, extra: 5000 });
  assert(doc.querySelector(".xd-rail .xd-head-v").textContent === money(p4) && /\$375,000 sale on/.test(doc.querySelector(".xd-rail .xd-head-sub").textContent), `the rail's projected net profit is the forecast's: ${money(p4)} at $375,000`);
  const rehabBar = [...doc.querySelectorAll(".xd-rail .xd-bar")].find((x) => /Rehab/.test(x.textContent));
  assert(rehabBar && /\+33% over/.test(rehabBar.textContent), "the rehab bar: $20,000 against the forecast's $15,000, 33% over");
  await click(ptab("Project overview"));
  assert(/Rehab over budget \(forecast\) by 33%/.test(doc.querySelector(".ov-hero").textContent), "the deal's health: Rehab over budget (forecast) by 33%");
  await sleep(1700);
  await settle(6);
  await click(nav(/^Active projects/));
  const row = [...doc.querySelectorAll("tr.dt-row")].find((x) => x.textContent.includes("4623 Forecast Ave"));
  assert(row && /\$20K \/ \$15K/.test(row.textContent), "the Active projects dashboard: $20K / $15K");
  await click(row);
  await sleep(30);
  await settle(8);

  console.log("5. Delete; not for deals still being analyzed");
  await click(ptab("Forecast"));
  await click(btn("Delete", cards()[1]));
  assert(cards().length === 1 && cards()[0].querySelector(".fc-main"), "deleting the forecast scenario makes the other one the forecast");
  await click(nav(/^Properties/));
  await click([...doc.querySelectorAll("tr.dt-row")].find((x) => x.textContent.includes("9 Lead St")));
  await sleep(30);
  await settle(8);
  assert(!ptab("Forecast"), "a deal in analysis has no Forecast tab");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL FORECAST TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
