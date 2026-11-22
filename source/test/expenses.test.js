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
const noDocs = base({ address: "1188 W 104th St, Cleveland, OH 44102", arv: 189000, purchase: 72000, manualRepair: 38000, stage: "rehab", actuals: [], mgmt: { closing: { date: day(-20), price: 72000 }, rehab: { startDate: day(-18) } } });
const INVOICE = { document_type: "Invoice", vendor: "DK Renovations", invoice_number: "1042", date: day(-2), total: 9250, description: "Roof replacement, draw 2 of 3", category: "rehab", property_address: "4623 Carrollton Ave" };

(async () => {
  const drive = makeDrive();
  const fid = drive.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", withDocs);
  drive.add("1188 W 104th St, Cleveland, OH 44102.json", noDocs);
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
  await click(grp.querySelector(".lg-title"));
  assert(doc.querySelectorAll(".lg-group .lg-kids .lg-entry").length === 2, "the group opens to its two entries");
  const hd = entry(/^Home Depot: lumber$/);
  assert(hd && hd.querySelector(".lg-meta").textContent.includes(mmdd(day(-6))) && /Rehab/.test(hd.querySelector(".lg-meta").textContent), "meta line: MM/DD/YYYY · category");
  assert(hd.querySelector(".src-pill").textContent.includes("Manual"), "hand-entered expense: Manual pill");
  assert(/HUD-1/.test(entry(/^Purchase closing costs$/).querySelector(".src-pill").textContent), "statement entry: HUD-1 pill");

  console.log("3. Click to edit: Enter saves, Esc cancels");
  await click(hd.querySelector(".lg-amt"));
  let ed = doc.querySelector(".ledger-row.editing");
  assert(ed && ed.querySelector(".lg-in-amt"), "clicking the amount opens the row for editing");
  await setVal(ed.querySelector(".lg-in-amt"), 2450);
  await setVal(ed.querySelector(".lg-in-label"), "Home Depot: lumber and drywall");
  ed.querySelector(".lg-in-amt").dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await settle(4);
  assert(!doc.querySelector(".ledger-row.editing") && entry(/^Home Depot: lumber and drywall$/) && /\$2,450/.test(entry(/^Home Depot: lumber and drywall$/).textContent), "Enter saves the new label and amount");
  await click(entry(/^Home Depot: lumber and drywall$/).querySelector(".lg-title"));
  ed = doc.querySelector(".ledger-row.editing");
  await setVal(ed.querySelector(".lg-in-amt"), 1);
  ed.querySelector(".lg-in-label").dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle(4);
  assert(/\$2,450/.test(entry(/^Home Depot: lumber and drywall$/).textContent), "Esc leaves it unchanged");

  console.log("4. Source pill → document viewer; attach a receipt to a manual entry");
  await click(entry(/^Purchase closing costs$/).querySelector(".src-pill"));
  let dv = doc.querySelector(".dv");
  assert(dv && /Purchase closing statement/.test(dv.textContent) && /ALTA final\.pdf/.test(dv.textContent), "HUD-1 pill opens the statement");
  assert(dv.querySelector("iframe") && /drive\.google\.com\/file\/d\/hud1\/preview/.test(dv.querySelector("iframe").getAttribute("src")), "the Drive preview of the document sits beside the lines");
  assert(/Purchase price/.test(dv.querySelector(".dv-lines").textContent) && /Purchase closing costs/.test(dv.querySelector(".dv-lines").textContent), "with the ledger lines it produced");
  doc.dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await settle(4);
  assert(!doc.querySelector(".dv"), "Esc closes the viewer");
  await click(entry(/^Home Depot: lumber and drywall$/).querySelector(".src-pill"));
  dv = doc.querySelector(".dv");
  assert(dv && /No receipt or invoice attached yet/.test(dv.textContent), "Manual pill opens the entry with room for a receipt");
  const up = dv.querySelector(".dv-attach input[type=file]");
  Object.defineProperty(up, "files", { value: [new t.win.File(["%PDF receipt"], "HD receipt.pdf", { type: "application/pdf" })], configurable: true });
  up.dispatchEvent(new t.win.Event("change", { bubbles: true }));
  await sleep(40);
  await settle(8);
  assert(/HD receipt\.pdf/.test(doc.querySelector(".dv").textContent), "receipt uploaded and attached");
  await click(doc.querySelector(".dv-x"));
  assert(/File/.test(entry(/^Home Depot: lumber and drywall$/).querySelector(".src-pill").textContent), "the pill now reads File");

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
  assert(S.actuals.find((x) => x.id === 14).amount === 2450 && S.actuals.find((x) => x.id === 14).files.length === 1, "inline edit and the receipt saved");

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
  const real = t.errors.filter((e) => !/Not implemented: navigation/.test(e));
  assert(real.length === 0, "no errors " + real.join(" | "));
  console.log("\nALL EXPENSES TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.stack || e.message);
  process.exit(1);
});
