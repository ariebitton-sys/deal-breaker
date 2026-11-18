// Utilities: find providers for a property from the free map services, turn them into
// stage tasks, fall back to city rules when the services don't answer.
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
  address: "4623 Carrollton Ave, Indianapolis, IN 46205",
  sqft: 1400, holdMonths: 4, arv: 330000, yearBuilt: 1925, purchase: 210000,
  repairs: [], useRepairBuilder: false, manualRepair: 45000,
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.12, intRateRehab: 0.16, points: 0,
  investorAmount: 0, investorAuto: true, investorRate: 0.09, analysisDate: day(-20), taxAnnual: 0,
  insuranceMonthly: 120, utilitiesMonthly: 150, lawnMonthly: 0, miscMonthly: 0, buyTxn: txn(), sellTxn: txn(), actuals: [],
  stage: "contract",
  mgmt: { contract: { date: day(-10), price: 210000, expectedClosing: day(5), inspectionEnd: "", emd: 3000 } },
};
const sections = (t) => [...t.doc.querySelectorAll("section.dcard")];
const utilCard = (t) => sections(t).find((s) => s.querySelector(".dcard-h") && s.querySelector(".dcard-h").textContent.includes("Utilities"));
const row = (t, label) => [...utilCard(t).querySelectorAll("tbody tr")].find((r) => r.querySelector(".util-type").textContent === label);

async function openDeal(t) {
  await t.click(t.btn("Connect Google", t.doc.querySelector(".pf-empty")));
  await t.sleep(30);
  await t.settle(10);
  await t.click([...t.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton Ave")));
  await t.sleep(20);
  await t.settle(10);
}

(async () => {
  console.log("1. Address parsing helpers");
  {
    const t = await boot({ drive: makeDrive(), settings: {} });
    const p = t.win.parseCityState;
    const a = p("4623 Carrollton Ave, Indianapolis, IN 46205");
    assert(a.city === "Indianapolis" && a.state === "IN", "city and state from 'street, city, ST zip'");
    const b = p("1234 Elm St, Cleveland OH 44102");
    assert(b.city === "Cleveland" && b.state === "OH", "city and state from 'street, city ST zip'");
    const c = p("55 Oak Ave, Lakewood, Ohio");
    assert(c.city === "Lakewood" && c.state === "OH", "full state name");
  }

  console.log("2. Find utilities for 4623 Carrollton Ave (maps answer)");
  const drive = makeDrive();
  const fid = drive.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  await openDeal(t);
  assert(utilCard(t) && /Find utilities/.test(utilCard(t).textContent), "Project overview offers Find utilities");
  await t.click(t.btn("Find utilities", utilCard(t)));
  await t.sleep(40);
  await t.settle(10);
  assert(t.geoCalls.some((u) => /geocoding\.geo\.census\.gov\/geocoder\/geographies\/onelineaddress\?address=4623%20Carrollton%20Ave/.test(u) && /format=jsonp/.test(u)), "Census geocoder called with JSONP");
  assert(t.geoCalls.some((u) => /FeatureServer\/26\/query\?geometry=-86.1419,39.8393/.test(u)), "electric territory queried at the property's point");
  assert(t.geoCalls.some((u) => /Water_System_Boundaries/.test(u)) && t.geoCalls.some((u) => /SolidWaste/.test(u)), "water and Indianapolis trash maps queried");
  assert(/AES Indiana/.test(row(t, "Electric").textContent) && /Service-area map, verify/.test(row(t, "Electric").textContent), "electric: AES Indiana from the map");
  assert(/Citizens Energy Group/.test(row(t, "Gas").textContent) && /Citizens Energy Group/.test(row(t, "Water").textContent), "gas and water: Citizens Energy Group");
  assert(/Citizens Energy Group/.test(row(t, "Sewer").textContent) && /City default/.test(row(t, "Sewer").textContent), "sewer: Citizens by Indianapolis rule");
  assert(/City of Indianapolis/.test(row(t, "Trash").textContent) && /LRS \(Lakeshore Recycling Systems\), district 7, pickup on Tuesday/.test(row(t, "Trash").textContent), "trash: hauler, district and day from the city map");
  const startLink = row(t, "Gas").querySelector("a");
  assert(startLink && startLink.href === "https://www.citizensenergygroup.com/My-Account/Start-Stop-Transfer?Type=Start", "Citizens start link");
  assert(/Added 4 tasks to Under contract and 2 to On market/.test(utilCard(t).textContent), "tasks added message");
  assert(/Matched 4623 CARROLLTON AVE, INDIANAPOLIS, IN, 46205, Indianapolis, Marion County/.test(utilCard(t).textContent), "matched address shown");
  assert(/utility tasks? still open before closing/.test(t.doc.querySelector(".ov-health") ? t.doc.querySelector(".ov-health").textContent : ""), "closing in 5 days with open utility tasks → health warning");

  console.log("3. Tasks on the Under contract checklist");
  await t.click(t.btn(/^Stages and milestones$/, t.doc.querySelector(".sidebar")));
  const txt = t.text();
  assert(txt.includes("Citizens Energy Group: start water, sewer and gas in the LLC's name from the closing date"), "one Citizens task for water, sewer and gas");
  assert(txt.includes("AES Indiana: start electric in the LLC's name from the closing date"), "AES Indiana start task");
  assert(txt.includes("City of Indianapolis: confirm trash pickup"), "trash task");
  assert(txt.includes("Confirm the utility providers and final meter readings with the seller or title"), "verification task");
  const links = [...t.doc.querySelectorAll("a.ck-link")].map((a) => a.href);
  assert(links.includes("https://www.aesindiana.com/homes") && links.includes("https://www.indy.gov/workflow/trash-pickup"), "tasks link to the provider pages");
  const citizensBox = [...t.doc.querySelectorAll("input[type=checkbox]")].find((cb) => cb.parentElement.textContent.includes("Citizens Energy Group: start"));
  citizensBox.click();
  await t.settle(4);

  console.log("4. Status, confirm, account number, change provider");
  await t.click(t.btn(/^Project overview$/, t.doc.querySelector(".sidebar")));
  assert(/Set up/.test(row(t, "Water").textContent) && /To do/.test(row(t, "Electric").textContent), "status follows the checklist (Citizens set up, AES to do)");
  await t.click(t.btn("Mark confirmed", row(t, "Electric")));
  assert(/Confirmed/.test(row(t, "Electric").textContent), "electric marked confirmed");
  await t.setVal(row(t, "Electric").querySelector("input.util-acct"), "AES-778812");
  await t.click(t.btn("Change", row(t, "Trash")));
  await t.setVal(row(t, "Trash").querySelector('input[placeholder="Provider name"]'), "Ray's Trash Service");
  await t.click(t.btn("Save", row(t, "Trash")));
  assert(/Ray's Trash Service/.test(row(t, "Trash").textContent) && /Confirmed/.test(row(t, "Trash").textContent), "trash provider changed by hand");

  console.log("5. Save: utilities and tasks persist in the deal file");
  await t.click(t.btn("Save deal"));
  await t.sleep(30);
  await t.settle(10);
  const saved = JSON.parse(drive.files[fid].content);
  const u = saved.mgmt.utilities;
  assert(u && u.items.length === 5 && u.items.find((x) => x.type === "electric").account === "AES-778812", "utilities saved with the account number");
  const c = saved.mgmt.checklists.contract;
  assert(c.find((i) => i.ut === "citizens:buy" && i.done) && c.find((i) => i.ut === "aes-indiana:buy" && !i.done && i.url), "contract tasks saved with state and link");
  assert(!c.some((i) => i.ut === "indy-trash:buy") && c.some((i) => /^x-ray-s-trash-service:buy$/.test(i.ut)), "open city trash task replaced by the new hauler's task");
  assert(saved.mgmt.checklists.market.some((i) => i.ut === "citizens:sell" && /Type=Stop/.test(i.url)), "sale checklist has the Citizens stop task");
  assert(!saved.mgmt.checklists.rehab.some((i) => i.label === "Utilities transferred"), "generic rehab item replaced");
  const props = drive.files[fid].appProperties;
  assert(Object.keys(props).length > 0, "summary still written");
  assert(t.errors.length === 0, "no errors " + t.errors.join(" | "));

  console.log("6. Services down: city rules from the typed address");
  const drive2 = makeDrive();
  drive2.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", { ...deal, stage: "analyzing", mgmt: {} });
  const t2 = await boot({ drive: drive2, settings: { clientId: "c", folderId: "f" }, geo: { census: new Error("down"), layers: {} } });
  await openDeal(t2);
  await t2.click(t2.btn("Find utilities", utilCard(t2)));
  await t2.sleep(40);
  await t2.settle(10);
  assert(/AES Indiana/.test(row(t2, "Electric").textContent) && /City default/.test(row(t2, "Electric").textContent), "electric falls back to AES Indiana (city default)");
  assert(/Citizens Energy Group/.test(row(t2, "Water").textContent), "water falls back to Citizens");
  assert(/Census geocoder didn't answer/.test(utilCard(t2).textContent) && /Couldn't place the address/.test(utilCard(t2).textContent), "explains what didn't answer");
  assert(t2.errors.length === 0, "no errors " + t2.errors.join(" | "));
  console.log("\nALL UTILITIES TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.log("FAILED:", e);
  process.exit(1);
});
