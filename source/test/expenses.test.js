// v50: Expenses & Documents (drop zone, invoice reader, inline edit, grouping, source pills and
// the document viewer), the dashboard's Docs column, the collapsible rail and utility statuses.
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
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const mmdd = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const base = (o) => ({
  sqft: 1890, holdMonths: 7, yearBuilt: 1920, repairs: [], useRepairBuilder: false, manualRepair: 100000, loanOnPurchasePct: 0.8, loanOnRehabPct: 1,
  intRatePurchase: 0.18, intRateRehab: 0.16, points: 0, investorAmount: 0, investorAuto: true, investorRate: 0.09, analysisDate: day(-60), taxAnnual: 0,
  buyTxn: txn(), sellTxn: txn(), actualSale: 0, ...o,
});
const withDocs = base({
  address: "4623 Carrollton Ave, Indianapolis, IN 46205", arv: 425000, purchase: 145000, stage: "rehab",
  actuals: [
    { id: 11, cat: "Acquisition", label: "EMD", amount: 2500, date: day(-34), tag: "emd", files: [] },
    { id: 12, cat: "Acquisition", label: "Purchase price $145,000, paid at closing, less the $2,500 EMD paid earlier", amount: 142500, date: day(-30), tag: "purchase_price", files: [] },
    { id: 13, cat: "Acquisition", label: "Closing costs from the purchase statement (2 items)", amount: 655, date: day(-30), tag: "stmt_buy", files: [], items: [{ label: "Settlement fee", amount: 300 }, { label: "Title services", amount: 355 }] },
    { id: 14, cat: "Rehab / Construction", label: "Home Depot: lumber", amount: 2316.4, date: day(-6), files: [] },
    { id: 15, cat: "Rehab / Construction", label: "Water heater, 40 gal (Lowe's)", amount: 1020, date: day(-3), files: [] },
  ],
  mgmt: {
    closing: { date: day(-30), price: 145000 },
    rehab: { startDate: day(-26), targetEnd: day(60), milestones: [{ id: "m1", label: "Demo", budget: 6500, status: "done", src: "sow" }, { id: "m2", label: "Roof", budget: 14000, status: "doing", src: "sow" }] },
    analyses: [
      { id: "a1", kind: "closing", side: "buy", fileName: "ALTA final.pdf", driveFileId: "hud1", date: day(-29) + "T10:00:00Z", appliedAt: day(-29) + "T10:05:00Z", result: { lines: [] } },
      { id: "a2", kind: "sow", fileName: "DK SOW.pdf", driveFileId: "sow1", date: day(-27) + "T10:00:00Z", appliedAt: day(-27) + "T10:05:00Z", result: { milestones: [], total: 20500 } },
    ],
    utilities: {
      address: "4623 Carrollton Ave, Indianapolis, IN 46205", state: "IN", place: "Indianapolis", county: "Marion County", at: Date.now(),
      items: [
        { type: "electric", name: "AES Indiana", id: "aes-indiana", phone: "317-261-8222", source: "map", confirmed: false },
        { type: "gas", name: "Citizens Energy Group", id: "citizens", phone: "317-924-3311", source: "map", confirmed: false },
      ],
    },
    checklists: {
      contract: [
        { id: "k1", label: "AES Indiana: start electric in the LLC's name from the closing date", done: false, ut: "aes-indiana:buy" },
        { id: "k2", label: "Citizens Energy Group: start gas in the LLC's name from the closing date", done: false, ut: "citizens:buy" },
      ],
      rehab: [{ id: "r1", label: "Permits pulled", done: false }],
    },
  },
});
const noDocs = base({ address: "1188 W 104th St, Cleveland, OH 44102", arv: 189000, purchase: 72000, manualRepair: 38000, stage: "rehab", actuals: [{ id: 21, cat: "Rehab / Construction", label: "Water heater 50 gal (Home Depot)", amount: 1150, date: day(-15), files: [] }, { id: 22, cat: "Acquisition", label: "Closing costs from the purchase statement (2 items)", amount: 690, date: day(-20), tag: "stmt_buy", items: [{ label: "Title services", amount: 390 }, { label: "Recording", amount: 300 }] }], mgmt: { closing: { date: day(-20), price: 72000 }, rehab: { startDate: day(-18) } } });
const INVOICE = { document_type: "Invoice", vendor: "DK Renovations", invoice_number: "1042", date: day(-2), total: 9250, description: "Roof replacement, draw 2 of 3", category: "rehab", property_address: "4623 Carrollton Ave" };

(async () => {
  const drive = makeDrive();
  const fid = drive.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", withDocs);
  const fid2 = drive.add("1188 W 104th St, Cleveland, OH 44102.json", noDocs);
  const anthropic = async (body) => {
    const prompt = body.messages[0].content[1].text;
    if (!/contractor invoice/.test(prompt)) throw new Error("unexpected prompt");
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify(INVOICE) }], stop_reason: "end_turn" }) };
  };
  const t = await boot({ drive, anthropic, settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  const { doc, click, btn, setVal, settle, sleep, nav } = t;
  const row = (name) => [...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes(name));
  const entry = (re) => [...doc.querySelectorAll(".lg-entry")].find((e) => e.querySelector(".lg-title") && re.test(e.querySelector(".lg-title").textContent));
  const saved = () => JSON.parse(drive.files[fid].content);

  console.log("1. Dashboard: the Docs column and the collapsible rail");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await sleep(40);
  await settle(10);
  await click(nav(/^Active projects/));
  assert(/2\/2 Docs/.test(row("4623 Carrollton").textContent), "purchase HUD-1 and SOW on file → 2/2 Docs");
  assert(/Missing 2 docs/.test(row("1188 W 104th").textContent) && row("1188 W 104th").querySelector(".dt-docs.miss"), "nothing on file in rehab → Missing 2 docs");
  await click(doc.querySelector(".sb-collapse"));
  assert(doc.querySelector(".sidebar.collapsed") && doc.querySelector(".app-shell.rail-collapsed") && t.win.localStorage.getItem("kappa_rail_collapsed") === "1", "rail collapses and remembers it");
  await click(doc.querySelector(".sb-collapse"));
  assert(!doc.querySelector(".sidebar.collapsed"), "and expands again");

  console.log("2. The ledger: crisp rows, source pills, the purchase as one row");
  await click(row("4623 Carrollton"));
  await sleep(30);
  await settle(10);
  await click(nav(/^Expenses & Documents/));
  assert(/HUD-1 Purchase/.test(doc.querySelector(".xd-chips").textContent) && /SOW v1/.test(doc.querySelector(".xd-chips").textContent) && /Add Sale HUD/.test(doc.querySelector(".xd-chips").textContent), "chips: ✓ HUD-1 Purchase, ✓ SOW v1, + Add Sale HUD");
  const grp = doc.querySelector(".lg-group");
  assert(grp && /Purchase price/.test(grp.textContent) && /\$145,000/.test(grp.querySelector(".lg-amt").textContent) && /\$2,500 EMD/.test(grp.textContent), "EMD + closing balance grouped under one $145,000 Purchase price row");
  await click(grp.querySelector(".lg-chev"));
  assert(doc.querySelectorAll(".lg-group .lg-kids .lg-entry").length === 2 && !doc.querySelector(".xw"), "the chevron unfolds the group in place to its two entries");
  await click(grp.querySelector(".lg-chev"));
  const hd = entry(/^Home Depot: lumber$/);
  assert(hd && hd.querySelector(".lg-meta").textContent.includes(mmdd(day(-6))) && /Rehab/.test(hd.querySelector(".lg-meta").textContent), "meta line: MM/DD/YYYY · category");
  assert(hd.querySelector(".src-pill").textContent.includes("Manual"), "hand-entered expense: Manual pill");
  assert(/HUD-1/.test(entry(/^Purchase closing costs$/).querySelector(".src-pill").textContent), "statement entry: HUD-1 pill");

  console.log("3. Category chips and the ledger search");
  const chip = (re) => [...doc.querySelectorAll(".xd-ledger .lg-chip")].find((b) => re.test(b.textContent));
  assert(/All5/.test(chip(/^All/).textContent.replace(/\s/g, "")) && /Rehab2/.test(chip(/^Rehab/).textContent.replace(/\s/g, "")), "chips: All 5, Rehab 2");
  await click(chip(/^Rehab/));
  assert([...doc.querySelectorAll(".xd-ledger .lg-entry")].every((e) => /Rehab/.test(e.querySelector(".lg-meta").textContent)) && /2 of 5 entries/.test(doc.querySelector(".xd-ledger .dcard-r").textContent), "Rehab chip shows only the rehab lines");
  assert(doc.querySelector(".xd-bar.on") && /^Rehab/.test(doc.querySelector(".xd-bar.on").textContent), "the rail's Rehab bar follows the chip");
  await click(chip(/^All/));
  const ls = doc.querySelector(".lg-search input");
  await setVal(ls, "title services");
  const hits = [...doc.querySelectorAll(".xd-ledger .lg-entry")];
  assert(hits.length === 1 && /Purchase closing costs/.test(hits[0].textContent) && hits[0].querySelector(".ledger-items mark"), "searching a sub-item finds its entry and opens the breakdown, highlighted");
  await setVal(ls, "");

  console.log("4. Clicking a row opens the expense window");
  const hdRow = () => entry(/^Home Depot: lumber/).querySelector(".ledger-row");
  await click(hdRow());
  let xw = doc.querySelector(".xw");
  assert(xw && /Home Depot: lumber/.test(xw.querySelector("h3").textContent) && /\$2,316\.40/.test(xw.querySelector(".xw-hero").textContent), "window: title and the amount, large");
  await setVal(xw.querySelector(".xw-amt"), 2450);
  await setVal(xw.querySelector(".xw-label"), "Home Depot: lumber and drywall");
  xw.querySelector(".xw-label").dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await settle(4);
  assert(/\$2,450/.test(doc.querySelector(".xw-hero").textContent) && entry(/^Home Depot: lumber and drywall$/) && /\$2,450/.test(entry(/^Home Depot: lumber and drywall$/).textContent), "Enter saves the description and the amount");
  await setVal(doc.querySelector(".xw .xw-amt"), 1);
  doc.querySelector(".xw .xw-amt").dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle(4);
  assert(doc.querySelector(".xw") && doc.querySelector(".xw .xw-amt").value === "2450", "Esc in a field undoes that field and keeps the window open");
  const up = doc.querySelector(".xw input[type=file]");
  Object.defineProperty(up, "files", { value: [new t.win.File(["%PDF receipt"], "HD receipt.pdf", { type: "application/pdf" })], configurable: true });
  up.dispatchEvent(new t.win.Event("change", { bubbles: true }));
  await sleep(40);
  await settle(8);
  assert(/HD receipt\.pdf/.test(doc.querySelector(".xw").textContent) && doc.querySelector(".xw-preview iframe"), "a receipt uploads into the window, with a preview");
  await click(btn("Done", doc.querySelector(".xw")));
  assert(!doc.querySelector(".xw") && /File/.test(entry(/^Home Depot: lumber and drywall$/).querySelector(".src-pill").textContent), "Done closes; the pill now reads File");
  await click(entry(/^Purchase closing costs$/).querySelector(".ledger-row"));
  xw = doc.querySelector(".xw");
  assert(xw && xw.querySelectorAll(".xw-item:not(.sum)").length === 2 && /Settlement fee/.test(xw.textContent) && /add up to the entry's amount/.test(xw.textContent), "sub-expenses listed in the window, checked against the total");
  doc.dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle(4);
  assert(!doc.querySelector(".xw"), "Esc closes the window");
  await click(doc.querySelector(".lg-parent"));
  xw = doc.querySelector(".xw");
  assert(xw && /Purchase price/.test(xw.querySelector("h3").textContent) && xw.querySelectorAll(".xw-item.link").length === 2 && /Balance paid at closing/.test(xw.textContent) && /Earnest money deposit/.test(xw.textContent), "the purchase opens as EMD + balance paid at closing");
  await click([...xw.querySelectorAll(".xw-item.link")].find((b) => /Earnest money/.test(b.textContent)));
  assert(/Earnest money deposit/.test(doc.querySelector(".xw h3").textContent) && doc.querySelector(".xw-backbtn"), "each linked entry opens on its own, with a way back");
  await click(doc.querySelector(".xw-backbtn"));
  assert(/Purchase price/.test(doc.querySelector(".xw h3").textContent), "back to the purchase");
  await click(doc.querySelector(".xw .dv-x"));

  console.log("4b. Source pills open the document");
  await click(entry(/^Purchase closing costs$/).querySelector(".src-pill"));
  const dv = doc.querySelector(".dv");
  assert(dv && /Purchase closing statement/.test(dv.textContent) && dv.querySelector("iframe") && /hud1\/preview/.test(dv.querySelector("iframe").getAttribute("src")), "HUD-1 pill opens the statement's preview");
  doc.dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle(4);
  assert(!doc.querySelector(".dv"), "Esc closes the viewer");

  console.log("5. Drop a contractor invoice: Claude reads it, one click adds it");
  const dz = doc.querySelector(".xd-drop input[type=file]");
  Object.defineProperty(dz, "files", { value: [new t.win.File(["%PDF invoice"], "DK invoice 1042.pdf", { type: "application/pdf" })], configurable: true });
  dz.dispatchEvent(new t.win.Event("change", { bubbles: true }));
  await settle(4);
  assert(/Invoice or receiptsuggested/.test(doc.querySelector(".xd-choose-opt.on").textContent), "an invoice file name → Invoice suggested");
  await click(btn(/^Invoice or receipt/, doc.querySelector(".xd-choose")));
  await sleep(60);
  await settle(10);
  let md = t.modal();
  assert(md && /Check the entry/.test(md.textContent) && t.anthropicCalls.length === 1, "read straight away (one Claude call)");
  assert(t.field("Vendor", md).value === "DK Renovations" && t.field("Description", md).value === "Roof replacement, draw 2 of 3" && t.field("Amount", md).value === "9250" && t.field("Category", md).value === "Rehab / Construction" && t.field("Date", md).value === day(-2), "vendor, description, amount, category and date filled in");
  await setVal(t.field("Rehab budget line", md), "ms:m2");
  await click(btn("Add to ledger", md));
  await sleep(40);
  await settle(10);
  const inv = entry(/^DK Renovations: Roof replacement, draw 2 of 3$/);
  assert(inv && /\$9,250/.test(inv.textContent) && /Invoice/.test(inv.querySelector(".src-pill").textContent), "in the ledger with an Invoice pill");
  await click(btn("Save deal"));
  await sleep(40);
  await settle(8);
  const S = saved();
  const a = S.actuals.find((x) => x.tag === "invoice");
  assert(a && a.amount === 9250 && a.cat === "Rehab / Construction" && a.bl === "ms:m2" && a.date === day(-2) && a.files.length === 1 && a.files[0].name === "DK invoice 1042.pdf", "saved: amount, category, budget line, date and the attached invoice");
  assert(S.mgmt.docs.some((d) => d.kind === "Invoice" && d.name === "DK invoice 1042.pdf"), "the invoice is kept with the deal's documents");
  assert(S.actuals.find((x) => x.id === 14).amount === 2450 && S.actuals.find((x) => x.id === 14).files.length === 1, "edits made in the window and the receipt saved");

  console.log("6. Utilities: the status pill writes to the checklist");
  await click(nav(/^Project overview$/));
  const urow = (label) => [...doc.querySelectorAll("table.util-table tbody tr")].find((r) => r.querySelector(".util-type").textContent === label);
  const pill = (label) => urow(label).querySelector(".util-st");
  assert(pill("Electric").textContent === "To do", "starts at To do");
  await click(pill("Electric"));
  await click(pill("Electric"));
  assert(pill("Electric").textContent === "Active", "To do → Confirmed → Active");
  assert(/Permits pulled/.test(doc.querySelector(".nx").textContent) && /Roof/.test(doc.querySelector(".nx").textContent), "Next up lists the open rehab task and the milestone in progress");
  await click(btn("Save deal"));
  await sleep(40);
  await settle(8);
  const S2 = saved();
  assert(S2.mgmt.utilities.items.find((x) => x.type === "electric").confirmed && S2.mgmt.checklists.contract.find((i) => i.ut === "aes-indiana:buy").done, "saved: provider confirmed, the start task done");
  console.log("7. Expense search across projects");
  await click(nav(/^Expenses & Documents/));
  await setVal(doc.querySelector(".lg-search input"), "water heater");
  await click(btn("Search all projects", doc.querySelector(".lg-tools")));
  await sleep(60);
  await settle(12);
  assert(doc.querySelector(".cs") && doc.querySelector(".cs-input input").value === "water heater" && /Expense search/.test(doc.querySelector(".sidebar .sb-item.on").textContent), "Search all projects carries the words to the Expense search screen");
  const csRows = () => [...doc.querySelectorAll("tr.cs-row")];
  assert(csRows().length === 2 && /4623 Carrollton/.test(csRows().map((r) => r.textContent).join()) && /1188 W 104th/.test(csRows().map((r) => r.textContent).join()), "finds the water heater in both projects");
  assert(/\$2,170/.test(doc.querySelector(".cs-stats").textContent) && /\$1,020 – \$1,150/.test(doc.querySelector(".cs-stats").textContent) && /in 2 projects/.test(doc.querySelector(".cs-stats").textContent), "total, range and project count");
  await setVal(doc.querySelector(".cs-input input"), "title services");
  assert(csRows().length === 2 && csRows().every((r) => /Sub-item of Purchase closing costs/.test(r.textContent)), "sub-items are searchable in every project");
  await setVal(doc.querySelector(".cs-input input"), "");
  assert(csRows().length === 8, "no words: every ledger line in every project (8)");
  await click([...doc.querySelectorAll(".cs-chips .lg-chip")].find((b) => /^Acquisition/.test(b.textContent)));
  assert(csRows().every((r) => /Acquisition/.test(r.querySelector(".cs-cat").textContent)) && csRows().length === 4, "category chip filters the results");
  await setVal(doc.querySelector(".cs-input input"), "title services");
  await click(csRows().find((r) => /1188 W 104th/.test(r.textContent)));
  await sleep(60);
  await settle(12);
  assert(/1188 W 104th/.test(doc.querySelector(".crumbs").textContent) && /Expenses & Documents/.test(doc.querySelector(".ptab.on").textContent), "a result opens its project on Expenses & Documents");
  const xw2 = doc.querySelector(".xw");
  assert(xw2 && /Purchase closing costs/.test(xw2.querySelector("h3").textContent) && /Title services/.test(xw2.querySelector(".xw-item.hit").textContent), "with that expense's window open and the matching sub-item highlighted");
  const ix = JSON.parse(t.win.localStorage.getItem("kappa_ledger_index_v1") || "{}");
  assert(ix[fid] && ix[fid2] && ix[fid2].e.length === 2, "the ledgers are kept in the browser for the next search");
  const real = t.errors.filter((e) => !/Not implemented: navigation/.test(e));
  assert(real.length === 0, "no errors " + real.join(" | "));
  console.log("\nALL EXPENSES TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.stack || e.message);
  process.exit(1);
});
