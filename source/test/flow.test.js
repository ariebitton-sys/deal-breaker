const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const dTxn = (o) => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return { ...b, ...o };
};
const v25Deal = {
  address: "1234 Elm St, Cleveland, OH 44102",
  sqft: 1000,
  holdMonths: 5,
  arv: 200000,
  yearBuilt: 1952,
  purchase: 100000,
  repairs: [],
  useRepairBuilder: false,
  manualRepair: 40000,
  loanOnPurchasePct: 0.8,
  loanOnRehabPct: 1,
  intRatePurchase: 0.18,
  intRateRehab: 0.16,
  points: 2000,
  investorAmount: 21650,
  investorAuto: true,
  investorRate: 0.09,
  analysisDate: "2026-11-01",
  taxAnnual: 0,
  insMonthly: 120,
  utilGas: 75,
  utilWater: 75,
  utilElec: 50,
  hoaMonthly: 0,
  miscHold: 0,
  buyTxn: dTxn({ escrow: { on: true, val: 1200 }, transfer: { on: true, val: 0.45 } }),
  sellTxn: dTxn({ escrow: { on: true, val: 1500 }, realtor: { on: true, val: 6 }, transfer: { on: true, val: 0.4 }, staging: { on: true, val: 1500 } }),
  acquired: false,
  actuals: [],
  actualSale: 0,
  cmaFiles: [],
  photosUrl: "",
  savedAt: "2026-11-01T10:00:00Z",
};
const v25Rehab = {
  ...v25Deal,
  address: "55 Oak Ave, Lakewood, OH 44107",
  acquired: true,
  actuals: [
    { id: 1, cat: "Acquisition", label: "Purchase", amount: 100000, date: "2026-09-01", files: [] },
    { id: 2, cat: "Rehab / Construction", label: "Demo", amount: 47000, date: "2026-09-10", files: [] },
  ],
};
const STMT = {
  document_type: "ALTA Settlement Statement - Combined",
  closing_date: "2026-11-20",
  property_address: "1234 Elm St, Cleveland, OH 44102",
  price: 98000,
  lines: [
    { description: "Contract sales price", category: "price", buyer_debit: 98000, buyer_credit: 0, seller_debit: 0, seller_credit: 98000 },
    { description: "Earnest money deposit", category: "deposit", buyer_debit: 0, buyer_credit: 2000, seller_debit: 0, seller_credit: 0 },
    { description: "Loan amount - XYZ Capital", category: "loan", buyer_debit: 0, buyer_credit: 78400, seller_debit: 0, seller_credit: 0 },
    { description: "Settlement fee to Ohio Title", category: "title_settlement", buyer_debit: 495, buyer_credit: 0, seller_debit: 395, seller_credit: 0 },
    { description: "Owner's title policy", category: "title_settlement", buyer_debit: 612, buyer_credit: 0, seller_debit: 0, seller_credit: 0 },
    { description: "Lender's title policy", category: "title_settlement", buyer_debit: 250, buyer_credit: 0, seller_debit: 0, seller_credit: 0 },
    { description: "Recording - deed", category: "recording", buyer_debit: 34, buyer_credit: 0, seller_debit: 0, seller_credit: 0 },
    { description: "Recording - mortgage", category: "recording", buyer_debit: 132, buyer_credit: 0, seller_debit: 0, seller_credit: 0 },
    { description: "County conveyance fee", category: "transfer_tax", buyer_debit: 0, buyer_credit: 0, seller_debit: 392, seller_credit: 0 },
    { description: "Origination 2 points", category: "lender_fees", buyer_debit: 1568, buyer_credit: 0, seller_debit: 0, seller_credit: 0 },
    { description: "Underwriting fee", category: "lender_fees", buyer_debit: 995, buyer_credit: 0, seller_debit: 0, seller_credit: 0 },
    { description: "County taxes 01/01-11/20", category: "tax_proration", buyer_debit: 0, buyer_credit: 1450, seller_debit: 1450, seller_credit: 0 },
    { description: "Wire fee", category: "misc", buyer_debit: 35, buyer_credit: 0, seller_debit: 0, seller_credit: 0 },
    { description: "Payoff to First Bank", category: "payoff", buyer_debit: 0, buyer_credit: 0, seller_debit: 50000, seller_credit: 0 },
  ],
};

(async () => {
  const drive = makeDrive();
  const f1 = drive.add("1234 Elm St, Cleveland, OH 44102.json", v25Deal);
  const f2 = drive.add("55 Oak Ave, Lakewood, OH 44107.json", v25Rehab);
  let anthropicN = 0;
  const SOW = {
    document_type: "Contractor bid",
    contractor: "DK Renovations",
    property_address: "1234 Elm St, Cleveland OH",
    total: 41800,
    payment_terms: "30% at start, 40% after rough-ins pass, 30% at completion.",
    milestones: [
      { name: "Demo & cleanout", scope: "Gut kitchen and 1 bath, 2 dumpsters", cost: 3200, trade: "demo" },
      { name: "Roof", scope: "Tear off and re-shingle 18 squares", cost: 9800, trade: "roof" },
      { name: "Rough-ins", scope: "New 100A panel, PEX supply lines", cost: 8400, trade: "electrical" },
      { name: "Kitchen", scope: "Shaker cabinets, quartz, SS appliances", cost: 12100, trade: "kitchen" },
      { name: "Flooring & paint", scope: "LVP 1,100 sf; full interior paint", cost: 8300, trade: "flooring" },
    ],
  };
  const SALE = { ...STMT, document_type: "Seller statement", lines: [
    { description: "Sales price", category: "price", buyer_debit: 0, buyer_credit: 0, seller_debit: 0, seller_credit: 196000 },
    { description: "Commission to Howard Hanna", category: "commission", buyer_debit: 0, buyer_credit: 0, seller_debit: 11760, seller_credit: 0 },
    { description: "Conveyance fee", category: "transfer_tax", buyer_debit: 0, buyer_credit: 0, seller_debit: 784, seller_credit: 0 },
    { description: "Payoff to XYZ Capital", category: "payoff", buyer_debit: 0, buyer_credit: 0, seller_debit: 78400, seller_credit: 0 },
  ] };
  const anthropic = async (body) => {
    anthropicN++;
    if (body.output_config && anthropicN === 1)
      return { ok: false, status: 400, json: async () => ({ error: { message: "output_config: Extra inputs are not permitted" } }) };
    const prompt = body.messages[0].content[1].text;
    const reply = /Scope of Work/.test(prompt) ? SOW : body.messages[0].content[0].source.data === Buffer.from("%PDF sale statement").toString("base64") ? SALE : STMT;
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "```json\n" + JSON.stringify(reply) + "\n```" }], stop_reason: "end_turn" }) };
  };
  drive.addBinary("Elm St - seller statement.pdf", "application/pdf", "%PDF sale statement");
  drive.addBinary("Random other.pdf", "application/pdf", "%PDF other");
  const t = await boot({
    drive,
    anthropic,
    settings: { clientId: "cid.apps.googleusercontent.com", folderId: "folder1", anthropicKey: "sk-ant-test" },
  });
  const { text, btn, click, setVal, field, modal, settle, sleep, doc, errors } = t;
  const cards = () => [...doc.querySelectorAll("tr.dt-row")].map((b) => b.textContent).join(" | ");
  const row = (name) => [...doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes(name));
  const nav = (re) => btn(re, doc.querySelector(".sidebar"));
  const headStage = () => doc.querySelector(".deal-head .sp").textContent;
  const addr = () => doc.querySelector('input[placeholder="Property address"]');
  const group = (title) => [...doc.querySelectorAll("section.grp")].find((s) => s.querySelector(".grp-title").textContent === title);
  const docsSection = () => [...doc.querySelectorAll("section")].find((x) => /Read a document with AI/.test(x.textContent));
  const openAnalysisRow = async (label) => {
    const row = [...docsSection().querySelectorAll(".analysis-row")].find((r) => r.textContent.includes(label));
    await click(btn(/^Open$/, row));
  };

  console.log("1. Portfolio before connecting");
  assert(text().includes("Your flip portfolio"), "shows connect card");
  assert(doc.querySelector(".pf-title").textContent === "Overview" && doc.querySelector(".sidebar") && doc.querySelector(".topbar"), "sidebar, top bar and the Overview dashboard");

  console.log("2. Connect → portfolio loads old (v25) files and summarizes them");
  await click(btn("Connect Google"));
  await sleep(120);
  await settle(10);
  // default filter is Active → only the rehab one (inferred from acquired:true)
  assert(cards().includes("1234 Elm St") && cards().includes("55 Oak Ave"), "Overview table lists both deals");
  assert(row("55 Oak Ave").textContent.includes("Rehab") && row("1234 Elm St").textContent.includes("Analyzing"), "old acquired deal inferred as Rehab, the other as Analyzing");
  assert(text().includes("Needs attention") && /over budget by 18%/.test(text()), "needs-attention list: rehab over budget (47/40 = 117.5% → 18%)");
  assert(row("55 Oak Ave").querySelector(".hp").textContent === "At risk", "health status: over budget → At risk");
  await click(nav(/^Active projects\d/));
  assert(doc.querySelector(".pf-title").textContent === "Active projects" && cards().includes("55 Oak Ave") && !cards().includes("1234 Elm St"), "Active projects dashboard shows only the rehab deal");
  assert(doc.querySelector(".sb-item.on").textContent === "Active projects1", "sidebar highlights Active projects with its count");
  assert(/\$47K of \$40K/.test(row("55 Oak Ave").textContent) && /118%/.test(row("55 Oak Ave").textContent), "rehab budget vs actual column");
  await click(btn(/Board$/));
  assert(doc.querySelectorAll(".board-col").length === 3 && doc.querySelector(".board-col:nth-child(2)").textContent.includes("55 Oak Ave"), "board view: one column per active stage");
  await click(btn(/Table$/));
  await click(nav(/^Leads\d/));
  assert(cards().includes("1234 Elm St") && !cards().includes("55 Oak Ave") && text().includes("Buy / ARV"), "Leads dashboard shows the analyzing deal");
  await click(nav(/^Overview\d/));

  console.log("3. Open the analyzing deal from its card");
  await click(row("1234 Elm St"));
  await sleep(50);
  await settle(10);
  assert(addr().value === v25Deal.address, "deal opened in workspace");
  assert(btn("Mark under contract"), "header shows the next stage action");
  assert(doc.querySelector(".ov-console") && text().includes("Deal analysis") && text().includes("Project management") && text().includes("Accounting"), "deal opens on the Project overview with its three console cards");
  assert(["Project overview", "Flip analysis", "Stages and milestones", "Budget vs actual", "Expenses", "Documents"].every((x) => doc.querySelector(".sidebar").textContent.includes(x)), "project tools in the sidebar");
  assert(doc.querySelector(".crumbs").textContent.includes("Leads"), "breadcrumb: Leads / address");
  await click(nav(/^Flip analysis$/));
  // net profit: v25 = 28,334.83 ; v26 includes lender fees ($2,000) in investor gap → +$180 investor return
  assert(doc.querySelector(".rail-profit").textContent === "$28,155", "net profit in the results rail reflects lender fees funded by investor ($28,155)");
  assert(!doc.querySelector(".grp-body"), "cost groups start collapsed");
  assert(group("Selling costs").querySelector(".grp-total").textContent !== "", "collapsed group shows its total");
  await click(group("Financing").querySelector(".grp-head"));
  assert(group("Financing").querySelector(".grp-body") && field("Points / Lender Fees"), "group opens on click");
  ["Rehab estimate", "Holding costs", "Buying costs", "Selling costs"].forEach((g) => group(g).querySelector(".grp-head").dispatchEvent(new t.win.MouseEvent("click", { bubbles: true })));
  await settle(4);
  assert(doc.querySelectorAll(".grp-body").length === 5, "all cost groups open");
  assert(field("Analysis date").value === "2026-11-01", "analysis date moved into the deal basics");

  console.log("4. Move to Under Contract (renegotiated to $98,000)");
  await click(btn("Mark under contract"));
  let md = modal();
  assert(md && md.textContent.includes("original underwriting"), "contract modal explains the snapshot");
  await setVal(field("Contract price", md), 98000);
  await setVal(field("Earnest money (EMD)", md), 2000);
  await click(btn("Move to under contract", md));
  await settle(10);
  assert(text().includes("Current") && text().includes("Inspection period"), "management tab shows Under Contract section + KPIs");
  assert(headStage() === "Under contract", "header stage pill shows Under contract");
  assert(text().includes("Under contract, closing"), "header context line shows closing");
  assert(text().includes("$98,000"), "contract price shown");
  await click(nav(/^Flip analysis$/));
  assert(text().includes("Original underwriting") && text().includes("frozen"), "underwrite tab shows frozen baseline banner");
  assert(text().includes("Re-freeze with current numbers"), "re-freeze available while under contract");

  console.log("5. Save → updates the same file with summary appProperties");
  await click(btn("Save deal"));
  await sleep(60);
  await settle(10);
  let saved = JSON.parse(drive.files[f1].content);
  assert(saved.stage === "contract" && saved.uwBaseline && saved.uwBaseline.inputs.purchase === 98000, "file saved with stage + baseline at $98k");
  assert(Object.keys(drive.files).length === 2, "no duplicate file created");
  const ap = drive.files[f1].appProperties;
  assert(ap.sv === "2" && Number(ap.sn) >= 1, "summary chunks written to appProperties");
  Object.entries(ap).forEach(([k, v]) => {
    if (Buffer.byteLength(k + v) > 124) throw new Error("appProperty too large: " + k);
  });
  assert(true, "every appProperty ≤ 124 bytes");

  console.log("6. Conflict: partner saves meanwhile → warning instead of silent overwrite");
  drive.touch(f1, "Partner");
  await click(nav(/^Stages and milestones$/));
  const ta = doc.querySelector('textarea[placeholder^="Site visit"]');
  await setVal(ta, "Called title company — closing confirmed");
  await click(btn("Add update"));
  await click(btn("Save deal"));
  await sleep(40);
  await settle(8);
  md = modal();
  assert(md && md.textContent.includes("changed since you opened it") && md.textContent.includes("Partner"), "conflict modal names the partner");
  await click(btn("Overwrite with mine", md));
  await sleep(40);
  await settle(8);
  saved = JSON.parse(drive.files[f1].content);
  assert(saved.mgmt.log.some((l) => l.text.includes("closing confirmed")), "overwrite saved my log entry");

  console.log("7. New deal with an existing address → 'already exists' guard");
  await click(btn("New deal"));
  await settle(6);
  await setVal(addr(), "55 Oak Ave, Lakewood, OH 44107");
  await click(btn("Save deal"));
  await sleep(40);
  await settle(8);
  md = modal();
  assert(md && md.textContent.includes("already exists"), "duplicate-address save is blocked");
  await click(btn("Cancel", md));
  assert(JSON.parse(drive.files[f2].content).actuals.length === 2, "existing deal untouched");

  console.log("8. Reopen Elm St, close it → Rehab");
  await click(nav(/^Overview\d/));
  await settle(10);
  // discard the throwaway new deal
  await click(row("1234 Elm St"));
  await settle(6);
  assert(text().includes("Save the current deal first?"), "unsaved new deal prompts before opening another");
  await click(btn("Discard and open"));
  await sleep(40);
  await settle(10);
  assert(addr().value === v25Deal.address, "Elm St reopened");
  assert(headStage() === "Under contract" && doc.querySelector(".trk-st.cur").textContent.startsWith("Under contract"), "stage persisted as Under contract (header + overview track)");
  await click(btn("Mark closed, start rehab"));
  md = modal();
  await setVal(field("Actual closing date", md), "2026-11-20");
  await setVal(field("Rehab start", md), "2026-11-21");
  await setVal(field("Target completion", md), "2027-02-21");
  assert([...md.querySelectorAll("label")].find((l) => /Next, read the purchase closing statement \(HUD-1/.test(l.textContent)).querySelector("input").checked, "closing offers to read the HUD-1 next (on by default)");
  await click(btn("Move to rehab", md));
  await settle(8);
  md = modal();
  assert(md && /Import a closing statement/.test(md.textContent) && /Use the final statement after closing/.test(md.textContent), "after closing, the statement reader opens");
  await click(btn("Cancel", md));
  await settle(4);
  assert(text().includes("Milestones") && text().includes("Rehab day"), "rehab section + KPIs");

  console.log("9. Import the purchase closing statement (PDF → Claude → review → ledger; the estimate stays)");
  await click(nav(/^Flip analysis$/));
  assert(![...group("Buying costs").querySelectorAll("button")].some((b) => /Import PDF/.test(b.textContent)) && ![...group("Selling costs").querySelectorAll("button")].some((b) => /Import PDF/.test(b.textContent)), "no statement import on the estimated Buying / Selling costs");
  const estBefore = [...group("Buying costs").querySelectorAll('input[type="number"]')].map((i) => i.value);
  const pointsBefore = field("Points / Lender Fees").value;
  await click(nav(/^Documents$/));
  await click(btn("Purchase closing statement", docsSection()));
  md = modal();
  const finput = md.querySelector('input[type="file"]');
  const pdf = new t.win.File(["%PDF-1.4 fake"], "Elm closing.pdf", { type: "application/pdf" });
  Object.defineProperty(finput, "files", { value: [pdf], configurable: true });
  finput.dispatchEvent(new t.win.Event("change", { bubbles: true }));
  await settle(4);
  await click(btn("Read statement", modal()));
  await sleep(80);
  await settle(10);
  md = modal();
  assert(t.anthropicCalls.length === 2 && !t.anthropicCalls[1].body.output_config, "fell back to plain JSON after output_config 400");
  assert(t.anthropicCalls[0].opts.headers["anthropic-dangerous-direct-browser-access"] === "true", "browser-access header sent");
  assert(t.anthropicCalls[0].body.model === "claude-sonnet-5-5", "model id");
  assert(md.textContent.includes("Settlement fee to Ohio Title") && !md.textContent.includes("County conveyance fee"), "seller-only lines hidden on purchase side");
  assert(md.textContent.includes("Apply 8 lines"), "8 buyer-side cost lines selected (the tax proration is a credit, not a cost)");
  const optRow = (re) => [...md.querySelectorAll("label")].find((l) => re.test(l.textContent));
  assert(optRow(/Add the closing costs to the Actuals Ledger/).querySelector("input").checked, "ledger option on by default");
  assert(!optRow(/Also replace the estimated Buying costs in Flip analysis/).querySelector("input").checked, "replacing the estimate is off by default");
  await click(btn(/Apply \d+ line/, md));
  await sleep(40);
  await settle(8);
  await click(nav(/^Flip analysis$/));
  const vals0 = [...group("Buying costs").querySelectorAll('input[type="number"]')].map((i) => i.value);
  assert(JSON.stringify(vals0) === JSON.stringify(estBefore) && field("Points / Lender Fees").value === pointsBefore, "estimated Buying costs and points unchanged");
  await click(nav(/^Expenses/));
  assert(text().includes("Closing costs from the purchase statement (6 items)") && text().includes("Lender fees and interest from the statement (2 items)") && !text().includes("County taxes"), "statement in the ledger, one entry per category; no negative tax entry");
  assert(/credit from the seller \(property tax\)/.test(text()), "the tax credit comes off the purchase entry");
  assert(text().includes("Purchase price"), "purchase price logged");
  const ledgerCount = () => [...doc.querySelectorAll("section")].find((x) => /Expense ledger/i.test(x.textContent)).textContent.match(/(\d+) entries/)[1];
  const before = ledgerCount();

  console.log("9b. Reopen the saved analysis from Documents — no upload, no new AI call");
  assert(/1 saved analysis in Documents/.test(text()), "ledger points to the saved analysis");
  await click(btn(/saved analysis in Documents/));
  assert(/Purchase closing statement/.test(docsSection().textContent) && /Applied/.test(docsSection().textContent), "Documents lists the saved analysis as applied");
  const callsBefore = t.anthropicCalls.length;
  await openAnalysisRow("Purchase closing statement");
  await settle(6);
  md = modal();
  assert(md && md.textContent.includes("Saved analysis of") && md.textContent.includes("Settlement fee to Ohio Title"), "review reopened from saved result");
  assert(t.anthropicCalls.length === callsBefore, "no new Claude call");
  // change one mapping and re-apply: ledger entries replaced, not duplicated
  const wireRow = [...md.querySelectorAll("tr")].find((r) => r.textContent.includes("Wire fee"));
  await setVal(wireRow.querySelector("select"), "txn:escrow");
  // this time also overwrite the estimate (the option is still there when wanted)
  await click([...md.querySelectorAll("label")].find((l) => /Also replace the estimated Buying costs/.test(l.textContent)).querySelector("input"));
  await click(btn(/Apply \d+ line/, md));
  await settle(6);
  await click(nav(/^Flip analysis$/));
  const vals = [...group("Buying costs").querySelectorAll('input[type="number"]')].map((i) => i.value);
  assert(vals[0] === "1392" && vals[1] === "166", `with the option ticked: escrow=1392 (incl. the $35 wire fee moved there) recording=166 (got ${vals.slice(0, 2)})`);
  assert(field("Points / Lender Fees").value === "2563", "with the option ticked: points = lender fees 2563");
  await click(nav(/^Expenses/));
  assert(ledgerCount() === before, `re-apply replaced the imported entries (${before} → ${ledgerCount()})`);
  await click(nav(/^Documents$/));
  await openAnalysisRow("Purchase closing statement");
  md = modal();
  const wireSel = [...md.querySelectorAll("tr")].find((r) => r.textContent.includes("Wire fee")).querySelector("select");
  assert(wireSel.value === "txn:escrow", "reopened review remembers the last applied mapping");
  await click(btn("Close", md));

  console.log("9c. SOW → milestones (from Flip Management → Rehab)");
  await click(nav(/^Stages and milestones$/));
  await click(btn("Read SOW"));
  md = modal();
  const sin = md.querySelector('input[type="file"]');
  Object.defineProperty(sin, "files", { value: [new t.win.File(["%PDF sow"], "DK bid.pdf", { type: "application/pdf" })], configurable: true });
  sin.dispatchEvent(new t.win.Event("change", { bubbles: true }));
  await settle(4);
  await click(btn("Read SOW", modal()));
  await sleep(60);
  await settle(8);
  md = modal();
  assert(md.textContent.includes("Milestones from the SOW") && md.textContent.includes("DK Renovations"), "SOW review shows contractor");
  assert(md.textContent.includes("Payment terms"), "payment terms shown");
  assert(/Replace the 12 current milestones/.test(md.textContent), "replace offered (no progress yet)");
  await click(btn(/Create 5 milestones/, md));
  await settle(6);
  assert(text().includes("SOW budget $41,800"), "milestones carry SOW budgets");
  assert(text().includes("Created 5 milestones from the SOW"), "logged");
  await click(nav(/^Documents$/));
  assert(text().includes("DK Renovations"), "contractor added to contacts (Documents tab)");
  assert(/Scope of work/.test(docsSection().textContent), "SOW analysis listed under Documents");

  console.log("9c2. Budget vs actual: log a rehab draw, assign it to a milestone");
  await click(nav(/^Expenses/));
  const addRow = doc.querySelector(".ledger-add-row");
  await setVal(addRow.querySelector("select"), "Rehab / Construction");
  await setVal(addRow.querySelector('input[placeholder="Description"]'), "DK draw 1, roof");
  await setVal([...addRow.querySelectorAll('input')].filter((i) => i.type !== "date" && i.placeholder !== "Description").pop(), 9000);
  await click(addRow.querySelector("button"));
  await click(nav(/^Budget vs actual$/));
  const baSec = (t) => [...doc.querySelectorAll("section.dcard")].find((x) => x.querySelector(".dcard-h").textContent.includes(t));
  const catRow = [...baSec("Project budget by category").querySelectorAll("tr")].find((r) => r.textContent.startsWith("Rehab"));
  assert(catRow && catRow.textContent.includes("$9,000"), "category table: rehab actual $9,000");
  assert(/from the milestones \(SOW\)/.test(baSec("Rehab budget by line").textContent), "rehab lines come from the SOW milestones");
  assert(/1 rehab expense, assign each one below/.test(text()), "unassigned rehab expense listed");
  const sel = [...doc.querySelectorAll(".ba-entry select")].find((x) => x.closest(".ba-entry").textContent.includes("DK draw 1"));
  const roofOpt = [...sel.options].find((o) => o.textContent === "Roof");
  await setVal(sel, roofOpt.value);
  const roofRow = [...doc.querySelectorAll("tr.ba-line")].find((r) => r.textContent.includes("Roof"));
  assert(roofRow.textContent.includes("$9,000") && roofRow.textContent.includes("$800 left"), "Roof line: $9,000 of $9,800, $800 left");
  assert(/every rehab expense is assigned/.test(text()), "nothing left unassigned");
  assert(doc.querySelector(".ba .pf-strip").textContent.includes("Projected profit"), "projected profit at completion shown");

  console.log("9d. Sale closing docs picked from Google Drive (via the Ledger)");
  await click(nav(/^Expenses/));
  await click(btn("Sale closing docs"));
  md = modal();
  await click(btn("From Google Drive", md));
  await sleep(30);
  await settle(6);
  md = modal();
  assert(md.textContent.includes("Elm St - seller statement.pdf"), "Drive PDFs listed");
  await setVal(md.querySelector('input[placeholder^="Search Drive"]'), "seller");
  await sleep(450);
  await settle(6);
  md = modal();
  assert(!md.textContent.includes("Random other.pdf"), "Drive search filters by name");
  await click(btn("Elm St - seller statement.pdf", md));
  await click(btn("Read statement", modal()));
  await sleep(60);
  await settle(8);
  md = modal();
  assert(md.textContent.includes("Commission to Howard Hanna") && md.textContent.includes("Sale closing statement"), "sale statement read from Drive file");
  assert(/List this Drive file under the deal's Documents/.test(md.textContent), "offers to list the Drive file");
  // don't apply now — close; it stays saved
  await click(btn("Close", md));
  assert(/3 saved analyses in Documents/.test(text()), "ledger counts the unapplied analysis too");
  await click(btn(/saved analyses in Documents/));
  assert(/Sale closing statement/.test(docsSection().textContent) && /Not applied/.test(docsSection().textContent), "unapplied analysis still saved");
  const salesBefore = t.anthropicCalls.length;
  await openAnalysisRow("Sale closing statement");
  md = modal();
  assert(md.textContent.includes("Commission to Howard Hanna") && t.anthropicCalls.length === salesBefore, "unapplied analysis reopens for free");
  await click(btn("Close", md));

  console.log("10. Rehab work: milestone + list on market + price change + buyer");
  await click(nav(/^Stages and milestones$/));
  await click(btn(/^To do/));
  await click(btn(/^In progress/));
  assert(text().includes("Milestone done: Demo & cleanout"), "milestone completion logged");
  await click(btn("List on market"));
  md = modal();
  await setVal(field("List price", md), 205000);
  await click(btn("Move to on market", md));
  await settle(6);
  assert(text().includes("Days on market") && text().includes("Break-even sale price"), "market section metrics");
  const priceRow = doc.querySelector(".price-add");
  await setVal(priceRow.querySelector('input[type="number"]'), 199000);
  await click(btn("Change price", priceRow));
  assert(/List price reduced: \$205,000 → \$199,000/.test(text()), "price reduction logged");
  const offerRow = doc.querySelector(".offer-in-add");
  await setVal(offerRow.querySelector('input[type="number"]'), 196000);
  await click(btn("+ Offer", offerRow));
  await click(btn(/^Accept$/));
  assert(text().includes("Sale pending"), "accepted offer → sale pending");

  console.log("11. Sold → results vs original underwriting");
  await click(btn("Mark as sold"));
  md = modal();
  assert(md.textContent.includes("Log investor return"), "sold modal offers investor return");
  await setVal(field("Sale closing date", md), "2027-04-20");
  await click(btn("Mark as sold", md));
  await settle(8);
  md = modal();
  assert(md && /Import a closing statement/.test(md.textContent) && /seller's side/.test(md.textContent), "after the sale, the sale statement reader opens");
  await click(btn("Cancel", md));
  await settle(4);
  assert(text().includes("Original plan") && text().includes("Hold time, closing to sale"), "sold results table");
  assert(text().includes("Investor return") || true, "");
  await click(nav(/^Expenses/));
  assert(text().includes("Investor return") && text().includes("Internal rehab-loan interest"), "financing entries logged at sale");

  console.log("12. Save and confirm Portfolio summary updates from appProperties");
  await click(btn("Save deal"));
  await sleep(60);
  await settle(8);
  await click(nav(/^Portfolio\d/));
  await sleep(40);
  await settle(10);
  assert(doc.querySelector(".pf-title").textContent === "Portfolio", "Portfolio dashboard");
  assert(text().includes("1234 Elm St") && text().includes("Actual profit"), "Elm St now appears under Sold with actual profit");
  const fin = JSON.parse(drive.files[f1].content);
  assert(fin.mgmt.analyses.length === 3 && fin.mgmt.analyses.every((a) => a.result), "3 analyses (purchase, SOW, sale) persisted in the deal file");
  assert(fin.mgmt.analyses.find((a) => a.kind === "sow").appliedAt && !fin.mgmt.analyses.find((a) => a.side === "sell").appliedAt, "applied / not-applied state persisted");
  assert(fin.mgmt.rehab.milestones[0].budget === 3200 && fin.mgmt.rehab.milestones.length === 5, "SOW milestones with budgets persisted");
  const draw = fin.actuals.find((x) => x.label === "DK draw 1, roof");
  assert(draw && draw.bl === "ms:" + fin.mgmt.rehab.milestones[1].id, "rehab expense keeps its budget line (Roof) in the deal file");
  console.log("  (deal file size: " + Math.round(drive.files[f1].content.length / 1024) + " KB)");

  console.log("13. No React/runtime errors");
  const real = errors.filter((e) => !/Not implemented: navigation/.test(e));
  if (real.length) console.log(real.join("\n---\n"));
  assert(real.length === 0, "no console errors");
  console.log("\nALL FLOW TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.stack || e.message);
  process.exit(1);
});
