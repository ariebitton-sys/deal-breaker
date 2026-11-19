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
  const aid = drive.add("100 Alpha St, Cleveland, OH 44102.json", mk("100 Alpha St, Cleveland, OH 44102", "contract"));
  const bid = drive.add("200 Beta Ave, Cleveland, OH 44103.json", mk("200 Beta Ave, Cleveland, OH 44103", "contract"));
  const gid = drive.add(
    "300 Gamma Rd, Cleveland, OH 44104.json",
    mk("300 Gamma Rd, Cleveland, OH 44104", "contract", {
      cmaFiles: [
        { type: "drive_file", driveFileId: "cma1", name: "Gamma comps.pdf", mimeType: "application/pdf" },
        { type: "link", url: "https://example.com/comps", name: "Agent CMA" },
      ],
    }),
  );
  { const g = JSON.parse(drive.files[gid].content); g.mgmt.docs = [{ id: "d0", type: "drive_file", driveFileId: "cma1", name: "Gamma comps.pdf" }]; drive.files[gid].content = JSON.stringify(g); }
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

  console.log("4. Changes save themselves: going forward to another deal doesn't ask");
  const status = () => (t.doc.querySelector(".dh-save") ? t.doc.querySelector(".dh-save").textContent : "");
  const edited = "100 Alpha St, Cleveland, OH 44102 (edited)";
  await t.setVal(t.doc.querySelector(".dh-addr"), edited);
  assert(status() === "Saving…", "header says Saving… right after a change");
  await fwd();
  assert(!t.doc.querySelector(".dh-addr"), "Forward → dashboard (the edited deal stays open in the sidebar)");
  await fwd();
  await t.sleep(60); await t.settle(10);
  assert(!/Discard and open|Save the current deal first/.test(t.text()) && addr() === "200 Beta Ave, Cleveland, OH 44103", "Forward → other deal opens without asking");
  assert(drive.files[aid].name === edited + ".json" && JSON.parse(drive.files[aid].content).address === edited, "the edit was saved to Drive on the way (file renamed)");
  assert(Object.keys(drive.files).length === 3, "no duplicate file");

  console.log("4b. Autosave: a change reaches Drive by itself a moment later");
  await t.click(nav(/^Stages and milestones$/));
  await t.setVal(t.doc.querySelector('textarea[placeholder^="Site visit"]'), "Lockbox code changed");
  await t.click(t.btn("Add update"));
  assert(status() === "Saving…", "Saving… while the change waits");
  const before = drive.calls.length;
  await t.sleep(900); await t.settle(4);
  assert(!JSON.parse(drive.files[bid].content).mgmt.log, "nothing written while still editing (short pause)");
  await t.sleep(1100); await t.settle(10);
  const beta = JSON.parse(drive.files[bid].content);
  assert(beta.mgmt.log && beta.mgmt.log.some((l) => /Lockbox code changed/.test(l.text)), "saved to Drive without clicking Save");
  assert(status() === "All changes saved", "header: All changes saved");
  assert(!/Saved to Drive/.test(t.text()), "no toast for an autosave");
  assert(!drive.calls.slice(before).some((c) => /\/files\?q=|files\?.*q=/.test(c.url || c)), "an in-place save doesn't reload the whole deal list");

  console.log("4c. Can't save yet (new deal without a full address): switching still asks");
  await t.click(t.btn("New deal"));
  await t.settle(6);
  await t.setVal(t.doc.querySelector(".dh-addr"), "12 Main");
  assert(status() === "Not saved yet: add the full address", "header explains why it isn't saved");
  await t.click(nav(/^Overview\d/));
  await t.settle(6);
  await openRow("300 Gamma Rd");
  assert(/Save the current deal first/.test(t.text()), "opening another deal asks (nothing to save it under)");
  await t.click(t.btn("Discard and open"));
  await t.sleep(40); await t.settle(10);
  assert(addr() === "300 Gamma Rd, Cleveland, OH 44104" && Object.keys(drive.files).length === 3, "discard → Gamma opened, nothing created");

  console.log("4d. A partner saved this deal meanwhile: autosave asks once, then waits");
  const gBefore = drive.files[gid].content;
  drive.touch(gid, "Partner");
  await t.click(nav(/^Stages and milestones$/));
  await t.setVal(t.doc.querySelector('textarea[placeholder^="Site visit"]'), "Roof bid in");
  await t.click(t.btn("Add update"));
  await t.sleep(1800); await t.settle(10);
  let md = t.modal();
  assert(md && /changed since you opened it/.test(md.textContent) && /Partner/.test(md.textContent), "conflict window names the partner");
  assert(drive.files[gid].content === gBefore, "partner's version not overwritten");
  await t.click(t.btn("Cancel", md));
  await t.sleep(1900); await t.settle(8);
  assert(!t.modal() && /changed elsewhere/.test(status()), "after Cancel: no repeated pop-ups, header says why it isn't saved");
  await t.click(t.btn("Save deal"));
  await t.sleep(40); await t.settle(8);
  md = t.modal();
  await t.click(t.btn("Overwrite with mine", md));
  await t.sleep(40); await t.settle(8);
  assert(JSON.parse(drive.files[gid].content).mgmt.log.some((l) => /Roof bid in/.test(l.text)) && status() === "All changes saved", "Save deal → Overwrite with mine → saved");

  console.log("4e. New deal at an address that already has a deal: no pop-up, just a note");
  await t.click(t.btn("New deal"));
  await t.settle(6);
  await t.setVal(t.doc.querySelector(".dh-addr"), "200 Beta Ave, Cleveland, OH 44103");
  await t.sleep(4400); await t.settle(10);
  assert(!t.modal() && status() === "Not saved: another deal already has this address", "header note instead of a pop-up");
  assert(Object.keys(drive.files).length === 3 && JSON.parse(drive.files[bid].content).mgmt.log.length === 1, "existing deal untouched");
  await t.setVal(t.doc.querySelector(".dh-addr"), "210 Beta Ave, Cleveland, OH 44103");
  await t.sleep(4400); await t.settle(10);
  assert(Object.keys(drive.files).length === 4 && status() === "All changes saved", "a new address → the new deal is saved");
  await t.click(nav(/^Overview\d/));
  await t.settle(6);
  await openRow("300 Gamma Rd");

  console.log("5. Empty Portfolio explains how deals get there; past stages keep forms folded");
  await t.click(nav(/^\s*Portfolio/));
  assert(/No sold flips yet\. When a sale closes, open the deal and choose “Mark as sold”/.test(t.text()), "empty Portfolio explains how sold deals land there");
  await t.click(nav(/^\s*Active projects/));
  await openRow("200 Beta Ave");
  await t.click(nav(/^Stages and milestones$/));
  const anaHead = [...t.doc.querySelectorAll(".stg-head")].find((b) => /Analyzing/.test(b.textContent));
  assert(/Source not set, no offers logged/.test(anaHead.textContent), "collapsed Analyzing shows a one-line summary");
  await t.click(anaHead);
  const ana = anaHead.closest("section");
  assert(/No offers were logged for this deal/.test(ana.textContent) && !/\+ Offer/.test(ana.textContent) && /Log an offer/.test(ana.textContent), "past Analyzing: history only, the offer form folded behind “Log an offer”");
  await t.click(t.btn("Log an offer", ana));
  assert(/\+ Offer/.test(ana.textContent), "“Log an offer” opens the form");

  console.log("6. Property section removed from Flip analysis; comps moved to Documents; photos link from the overview");
  await t.click(nav(/^\s*Active projects/));
  await openRow("300 Gamma Rd");
  if (/Discard and open/.test(t.text())) await t.click(t.btn("Discard and open"));
  await t.sleep(30); await t.settle(10);
  assert(t.doc.querySelector(".dh-addr").value === "300 Gamma Rd, Cleveland, OH 44104", "deal with old comps opened");
  const ovLinks = () => t.doc.querySelector(".ov-links").textContent;
  assert(/Comps \(2\)/.test(ovLinks()) && /Add photos link/.test(ovLinks()), "overview: Comps (2) — the already-filed one isn't doubled — and Add photos link");
  await t.click(t.btn("Add photos link", t.doc.querySelector(".ov-links")));
  await t.setVal(t.doc.querySelector(".ov-photo-edit input"), "photos.app.goo.gl/abc");
  await t.click(t.btn("Save", t.doc.querySelector(".ov-photo-edit")));
  const ph = [...t.doc.querySelectorAll(".ov-links a")].find((a) => /Photos/.test(a.textContent));
  assert(ph && ph.href === "https://photos.app.goo.gl/abc" && /Change photos link/.test(ovLinks()), "photos link set from the overview");
  await t.click(t.btn(/Comps \(2\)/, t.doc.querySelector(".ov-links")));
  assert(/Gamma comps\.pdf/.test(t.text()) && /Agent CMA/.test(t.text()) && (t.text().match(/Gamma comps\.pdf/g) || []).length === 1, "Comps (2) opens Documents with both comps, no duplicate");
  await t.click(nav(/^Flip analysis$/));
  assert(![...t.doc.querySelectorAll(".grp-head, .grp")].some((g) => /Map, Zillow, photos and comps/.test(g.textContent)), "Flip analysis has no Property section");
  await t.click(t.btn("Save deal"));
  await t.sleep(30); await t.settle(10);
  const saved = JSON.parse(drive.files[gid].content);
  assert(saved.photosUrl === "https://photos.app.goo.gl/abc" && (saved.cmaFiles || []).length === 0, "saved: photos link, old comps list emptied");
  assert(saved.mgmt.docs.filter((d) => d.kind === "Comps").length === 2 && saved.mgmt.docs.some((d) => d.driveFileId === "cma1") && saved.mgmt.docs.length === 2, "saved: comps are deal documents, nothing lost or doubled");
  assert(t.errors.length === 0, "no errors " + t.errors.join(" | "));
  console.log("\nALL NAV TESTS PASSED");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e); process.exit(1); });
