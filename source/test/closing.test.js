// Purchase closing statement → ledger, with the numbers of the 4623 Carrollton Ave ALTA statement:
// $130,000 to the seller + $15,000 assignment / JV = $145,000; title fees $1,445.15; tax credit $2,071.54;
// EMD $2,500 paid before; $141,873.61 due at closing. Total paid: $144,373.61.
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
const L = (description, category, bd, bc, sd = 0, sc = 0) => ({ description, category, buyer_debit: bd, buyer_credit: bc, seller_debit: sd, seller_credit: sc });
const HUD = {
  document_type: "ALTA Settlement Statement - Combined",
  closing_date: "2026-11-18",
  property_address: "4623 CARROLLTON AVENUE, Indianapolis, IN 46205",
  price: 130000,
  totals: { buyer_debits: 146445.15, buyer_credits: 4571.54, due_from_buyer: 141873.61, seller_debits: 130000, seller_credits: 130000, due_to_seller: 0 },
  lines: [
    L("Sales Price of Property", "price", 130000, 0, 0, 130000),
    L("Deposit held by: Eagle Land Title, LLC", "deposit", 0, 2500),
    L("Property Tax @ 2,355.50 per 1 year(s) 1/01/2026 to 11/18/2026", "tax_proration", 0, 2071.54, 2071.54, 0),
    L("Settlement Agent Fee: Eagle Land Title, LLC", "title_settlement", 300, 0),
    L("Title Services Fee: Eagle Land Title, LLC", "title_settlement", 355, 0),
    L("Electronic Recording Fee: Eagle Land Title, LLC", "recording", 5.15, 0, 15.45, 0),
    L("Owner's Premium for 130,000.00: Eagle Land Title, LLC", "title_settlement", 475, 0),
    L("Sales Disclosure: Eagle Land Title, LLC", "misc", 30, 0),
    L("Affidavit Recording 3 @ $35/each: Eagle Land Title, LLC", "recording", 0, 0, 105, 0),
    L("Wire Fees: Eagle Land Title, LLC", "misc", 100, 0),
    L("Document Preparation Fee: Kerry Mann", "title_settlement", 90, 0),
    L("TIEFF: Old Republic National Title Insurance Company", "title_settlement", 5, 0),
    L("CPL Fee: Old Republic", "title_settlement", 50, 0),
    L("Fall Tax 25/26 + Penalties to: Marion County Treasurer", "tax_proration", 0, 0, 1236.64, 0),
    L("Deed Recording Fee: Eagle Land Title, LLC", "recording", 35, 0),
    L("Payoff Judgment Case # 49d12-2306-ct-023266", "payoff", 0, 0, 5310.01, 0),
    L("Transaction Coordination Fee: PROJECT GOLDEN ESTATES LLC", "misc", 0, 0, 500, 0),
    // the model files these as misc on purpose here: the text cues must still catch them
    L("Assignment Fee: PROJECT GOLDEN ESTATES LLC", "misc", 2625, 0),
    L("Joint Venture Agreement: BROWN DOOR LLC", "misc", 4500, 0),
    L("Joint Venture Agreement: Ashley White", "assignment", 4500, 0),
    L("Joint Venture Agreement: Alexandre Lafontant", "assignment", 750, 0),
    L("Joint Venture Agreement: E & L Asset Management LLC", "assignment", 2625, 0),
    L("Split Proceeds: Patricia Martin", "misc", 0, 0, 31472.84, 0),
  ],
};
const deal = {
  address: "4623 Carrollton Ave, Indianapolis, IN 46205", sqft: 1890, holdMonths: 7, arv: 375000, yearBuilt: 1920, purchase: 145000,
  repairs: [], useRepairBuilder: false, manualRepair: 100000, loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.12, intRateRehab: 0.16,
  points: 0, investorAmount: 0, investorAuto: true, investorRate: 0.09, analysisDate: "2026-11-08", taxAnnual: 0, insuranceMonthly: 120,
  utilitiesMonthly: 150, lawnMonthly: 0, miscMonthly: 0, buyTxn: { ...txn(), escrow: { on: true, val: 1500, type: "flat" } }, sellTxn: txn(),
  actuals: [{ id: 1, cat: "Acquisition", label: "EMD", amount: 2500, date: "2026-11-17", files: [] }],
  stage: "contract",
  mgmt: { contract: { date: "2026-11-10", price: 145000, expectedClosing: "2026-11-18", inspectionEnd: "", emd: 2500 } },
};
const acq = (actuals) => Math.round(actuals.reduce((t, a) => t + (["Acquisition", "Holding", "Financing"].includes(a.cat) ? a.amount : 0), 0) * 100) / 100;
(async () => {
  const drive = makeDrive();
  const fid = drive.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", deal);
  const anthropic = async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify(HUD) }], stop_reason: "end_turn" }) });
  const t = await boot({ drive, anthropic, settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  const { click, btn, modal, sleep, settle } = t;
  await click(btn("Connect Google", t.doc.querySelector(".pf-empty")));
  await sleep(30); await settle(10);
  await click([...t.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton")));
  await sleep(20); await settle(10);

  console.log("1. Closing: the purchase price entry doesn't count the EMD twice");
  await click(btn("Mark purchase closed"));
  let md = modal();
  assert(/\$142,500 at closing, since the \$2,500 EMD is already logged/.test(md.textContent), "closing window explains the EMD");
  await click(btn("Move to rehab", md));
  await settle(8);

  console.log("2. Read the HUD-1");
  md = modal();
  const finput = md.querySelector('input[type="file"]');
  Object.defineProperty(finput, "files", { value: [new t.win.File(["%PDF-1.4 fake"], "20261117105131.pdf", { type: "application/pdf" })], configurable: true });
  finput.dispatchEvent(new t.win.Event("change", { bubbles: true }));
  await settle(4);
  await click(btn("Read statement", md));
  await sleep(60); await settle(10);
  md = modal();
  const price = md.querySelector(".stmt-price");
  assert(/\$145,000/.test(price.textContent) && /\$130,000 to the seller \+ \$15,000 assignment \/ JV/.test(price.textContent), "purchase price $145,000 = $130,000 + $15,000 assignment / JV");
  const sum = md.querySelector(".stmt-sum").textContent;
  assert(/Closing costs \(title, recording and fees\)\$1,445\.15/.test(sum), "closing costs $1,445.15 (title company fees only)");
  assert(/Cost of the purchase\$146,445\.15/.test(sum), "cost of the purchase $146,445.15: price + closing costs, no tax taken off");
  assert(/Property tax credit from the seller \(counted under Holding\)−\$2,071\.54/.test(sum), "the tax credit is shown as a credit, under Holding");
  assert(/Net cost after the seller's credits\$144,373\.61/.test(sum), "net cost after the credit: $144,373.61");
  assert(/counts under Holding, next to them/.test(sum), "explains why the credit sits under Holding");
  assert(/Paid: \$2,500 EMD before closing \+ \$141,873\.61 at closing; the other \$2,071\.54 is the seller's credit\. Together: \$146,445\.15\./.test(sum), "paid: EMD + cash at closing + the seller's credit");
  assert(/Every line is read: they add up to the statement's \$141,873\.61 due from the buyer/.test(sum), "lines match the statement's total");
  const row = (re) => [...md.querySelectorAll("tr")].find((r) => re.test(r.textContent));
  assert(row(/BROWN DOOR/).querySelector("select").value === "price" && row(/Assignment Fee/).querySelector("select").value === "price", "assignment / JV lines go to the purchase price, even when filed as misc");
  assert(row(/Deposit held by/).querySelector("select").value === "deposit", "the deposit is the EMD");
  assert(row(/Property Tax @/).querySelector("select").value === "credit", "the tax proration is a credit to us, not a negative holding cost");
  assert(!row(/Split Proceeds|Payoff Judgment|Transaction Coordination/), "seller-only lines aren't shown");
  assert(/Add the breakdown to the purchase price entry in the ledger \(\$142,500\)/.test(md.textContent), "the closing's $142,500 entry is right; it gets the breakdown");
  const cc = [...md.querySelectorAll("label")].find((l) => /Count the seller's \$2,071\.54 credit in the ledger, as a credit under Holding \(property taxes\)/.test(l.textContent));
  assert(cc && cc.querySelector("input").checked, "offers to count the credit in the ledger (on by default)");
  assert(/Acquisition in the ledger after this: \$146,445\.15, the same as the cost of the purchase/.test(md.textContent), "ledger after applying = $146,445.15");
  await click(btn(/Apply \d+ line/, md));
  await sleep(30); await settle(8);

  console.log("3. Ledger");
  await click(btn("Save deal"));
  await sleep(40); await settle(8);
  const saved = JSON.parse(drive.files[fid].content);
  const A = saved.actuals;
  assert(acq(A) === 144373.61, `ledger total $144,373.61: $146,445.15 less the $2,071.54 credit (got ${acq(A)})`);
  const cre = A.filter((a) => a.tag === "stmt_buy_credit");
  assert(cre.length === 1 && cre[0].cat === "Holding" && cre[0].amount === -2071.54 && /Property tax credit from the seller at closing/.test(cre[0].label) && cre[0].date === "2026-11-18", "the credit is its own Holding entry, −$2,071.54, dated at closing");
  const pe = A.find((a) => a.tag === "purchase_price");
  assert(A.filter((a) => a.tag === "purchase_price").length === 1 && pe.amount === 142500, "one purchase entry: $142,500 paid at closing");
  assert(pe.label === "Purchase price $145,000 ($130,000 to the seller + $15,000 assignment / JV), paid at closing, less the $2,500 EMD paid earlier", "its description: " + pe.label);
  assert(pe.items.length === 7 && Math.round(pe.items.reduce((t, i) => t + i.amount, 0) * 100) / 100 === 142500 && pe.items.some((i) => /Joint Venture Agreement: Ashley White/.test(i.label)), "purchase breakdown: seller price, 5 assignment / JV payments, less the EMD");
  assert(!(saved.mgmt.credits || []).length, "nothing kept aside: the credit is in the ledger");
  assert(A.some((a) => a.label === "EMD" && a.amount === 2500), "the EMD entry is kept");
  const st = A.filter((a) => a.tag === "stmt_buy");
  assert(st.length === 1 && st[0].label === "Closing costs from the purchase statement (10 items)" && st[0].amount === 1445.15 && st[0].items.length === 10, "one statement entry: the title company's closing costs $1,445.15, with its 10 items");

  console.log("3b. Open a breakdown; the credit shows as a credit");
  await click(t.nav(/^Expenses/));
  const ccEntry = () => [...t.doc.querySelectorAll(".lg-entry")].find((e) => /Purchase closing costs/.test(e.querySelector(".lg-title").textContent));
  const ccBtn = ccEntry() && ccEntry().querySelector(".ledger-items-btn");
  assert(ccBtn && ccBtn.getAttribute("aria-expanded") === "false" && /10 items/.test(ccBtn.textContent), "closing costs entry (titled Purchase closing costs) can be opened");
  assert(/HUD-1/.test(ccEntry().querySelector(".src-pill").textContent), "its source pill reads HUD-1");
  await click(ccBtn);
  const list = ccEntry().querySelector(".ledger-items");
  assert(list && list.querySelectorAll(".ledger-item:not(.sum)").length === 10 && /Owner's Premium for 130,000\.00: Eagle Land Title, LLC\$475/.test(list.textContent) && /10 items\$1,445\.15/.test(list.textContent), "it lists the 10 closing costs and their total");
  const crRow = [...t.doc.querySelectorAll(".ledger-row")].find((r) => /Seller property tax credit/.test(r.textContent) && /Property Tax @/.test(r.textContent));
  assert(crRow && crRow.querySelector(".ledger-neg") && /−\$2,072 credit/.test(crRow.textContent), "ledger row reads −$2,072 credit");
  assert(!t.doc.querySelector(".ledger-credit"), "no 'waiting for the tax bill' note any more");
  assert(A.filter((a) => a.amount < 0).length === 1, "the credit is the only negative entry");
  assert(!A.some((a) => /Joint Venture|Assignment Fee/.test(a.label)), "no assignment / JV lines as extra costs");
  assert(saved.buyTxn.escrow.val === 1500, "the estimated Buying costs are untouched");
  assert(saved.purchase === 145000, "purchase price stays $145,000");

  console.log("4. A ledger from the old import gets corrected");
  const bad = {
    ...saved,
    actuals: [
      { id: 1, cat: "Acquisition", label: "EMD", amount: 2500, date: "2026-11-17", files: [] },
      { id: 2, cat: "Acquisition", label: "Purchase price", amount: 145000, date: "2026-11-18", tag: "purchase_price", files: [] },
      { id: 3, cat: "Acquisition", label: "Joint Venture Agreement: BROWN DOOR LLC", amount: 4500, date: "2026-11-18", tag: "stmt_buy", files: [] },
      { id: 4, cat: "Acquisition", label: "Assignment Fee: PROJECT GOLDEN ESTATES LLC", amount: 2625, date: "2026-11-18", tag: "stmt_buy", files: [] },
    ],
  };
  const drive2 = makeDrive();
  const fid2 = drive2.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", bad);
  const t2 = await boot({ drive: drive2, anthropic, settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  await t2.click(t2.btn("Connect Google", t2.doc.querySelector(".pf-empty")));
  await t2.sleep(30); await t2.settle(10);
  await t2.click([...t2.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton")));
  await t2.sleep(20); await t2.settle(10);
  await t2.click(t2.nav(/^Expenses/));
  // a corrected statement goes in through the drop zone: pick the file, confirm its type, the reader starts by itself
  const dz = t2.doc.querySelector(".xd-drop input[type=file]");
  Object.defineProperty(dz, "files", { value: [new t2.win.File(["%PDF-1.4 fake"], "hud.pdf", { type: "application/pdf" })], configurable: true });
  dz.dispatchEvent(new t2.win.Event("change", { bubbles: true }));
  await t2.settle(4);
  const chooser = t2.doc.querySelector(".xd-choose");
  assert(chooser && /Read hud\.pdf as/.test(chooser.textContent) && /Purchase HUD-1suggested/.test(chooser.querySelector(".xd-choose-opt.on").textContent), "drop zone: asks what the file is, suggests a purchase HUD-1");
  await t2.click(t2.btn(/^Purchase HUD-1/, chooser));
  await t2.sleep(60); await t2.settle(10);
  let m2 = t2.modal();
  const fix = [...m2.querySelectorAll("label")].find((l) => /Correct the purchase price entry in the ledger from \$145,000 to \$142,500 \(\$145,000 less the \$2,500 EMD already in the ledger\)/.test(l.textContent));
  assert(fix && fix.querySelector("input").checked, "offers to correct the $145,000 entry to $142,500 (on by default)");
  await t2.click(t2.btn(/Apply \d+ line/, m2));
  await t2.sleep(30); await t2.settle(8);
  await t2.click(t2.btn("Save deal"));
  await t2.sleep(40); await t2.settle(8);
  const A2 = JSON.parse(drive2.files[fid2].content).actuals;
  assert(acq(A2) === 144373.61 && !A2.some((a) => /Joint Venture|Assignment Fee/.test(a.label)) && A2.filter((a) => a.amount < 0).length === 1, `old double counting removed: ledger $144,373.61 with the credit (got ${acq(A2)})`);

  console.log("5. A statement saved before this change reopens right, without a new upload");
  const oldResult = { ...HUD, totals: undefined, lines: HUD.lines.map((l) => (l.category === "assignment" ? { ...l, category: "misc" } : l)) };
  delete oldResult.totals;
  const oldRec = {
    id: "an1", kind: "closing", side: "buy", fileName: "20261117105131.pdf", date: "2026-11-19T09:00:00Z", appliedAt: "2026-11-19T09:05:00Z",
    result: oldResult,
    review: { side: "buy", price: 130000, closingDate: "2026-11-18", lines: oldResult.lines.map((l, i) => ({ id: i, target: "txn:misc", include: true, amount: l.buyer_debit - l.buyer_credit })) },
  };
  const drive3 = makeDrive();
  drive3.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", { ...bad, mgmt: { ...bad.mgmt, analyses: [oldRec] } });
  let calls = 0;
  const t3 = await boot({ drive: drive3, anthropic: async (...a) => { calls++; return anthropic(...a); }, settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  await t3.click(t3.btn("Connect Google", t3.doc.querySelector(".pf-empty")));
  await t3.sleep(30); await t3.settle(10);
  await t3.click([...t3.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton")));
  await t3.sleep(20); await t3.settle(10);
  await t3.click(t3.nav(/^Expenses/));
  const arow = [...t3.doc.querySelectorAll(".analysis-row")].find((r) => /Purchase closing statement/.test(r.textContent));
  await t3.click(t3.btn(/^Open$/, arow));
  await t3.settle(6);
  const m3 = t3.modal();
  const row3 = (re) => [...m3.querySelectorAll("tr")].find((r) => re.test(r.textContent));
  assert(calls === 0, "no new Claude call");
  assert(row3(/Ashley White/).querySelector("select").value === "price" && row3(/Deposit held by/).querySelector("select").value === "deposit", "old mapping replaced: JV → purchase price, deposit → EMD");
  assert(/Cost of the purchase\$146,445\.15/.test(m3.textContent) && /totals weren't read/.test(m3.textContent), "same $146,445.15; says the totals check needs a fresh read");
  assert(row3(/Property Tax @/).querySelector("select").value === "credit", "the v41 mapping of the tax line (negative holding) is replaced by the credit");

  console.log("6. Closing at a different price leaves Flip analysis as underwritten");
  const drive4 = makeDrive();
  const fid4 = drive4.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", deal);
  const t4 = await boot({ drive: drive4, anthropic, settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  await t4.click(t4.btn("Connect Google", t4.doc.querySelector(".pf-empty")));
  await t4.sleep(30); await t4.settle(10);
  await t4.click([...t4.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton")));
  await t4.sleep(20); await t4.settle(10);
  await t4.click(t4.btn("Mark purchase closed"));
  let m4 = t4.modal();
  await t4.setVal(t4.field("Final purchase price", m4), "150000");
  await t4.click([...m4.querySelectorAll("label")].find((l) => /Next, read the purchase closing statement/.test(l.textContent)).querySelector("input"));
  await t4.click(t4.btn("Move to rehab", m4));
  await t4.settle(8);
  await t4.click(t4.btn("Save deal"));
  await t4.sleep(40); await t4.settle(8);
  const s4 = JSON.parse(drive4.files[fid4].content);
  assert(s4.purchase === 145000 && s4.mgmt.closing.price === 150000, "Flip analysis keeps $145,000; the actual $150,000 is the closing record");
  assert(s4.actuals.find((a) => a.tag === "purchase_price").amount === 147500, "ledger: $150,000 less the $2,500 EMD");

  console.log("7. A credit kept aside by v43-v47 counts in the ledger now (once)");
  const kept = { ...saved, actuals: saved.actuals.filter((a) => a.tag !== "stmt_buy_credit"), mgmt: { ...saved.mgmt, credits: [{ id: "c1", label: "Property Tax @ 1,550.04/yr", amount: 2071.54, kind: "tax", from: "stmt_buy", date: "2026-11-18", used: null }] } };
  const drive5 = makeDrive();
  const fid5 = drive5.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", kept);
  let t5 = await boot({ drive: drive5, anthropic, settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  await t5.click(t5.btn("Connect Google", t5.doc.querySelector(".pf-empty")));
  await t5.sleep(30); await t5.settle(10);
  await t5.click([...t5.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton")));
  await t5.sleep(1900); await t5.settle(10);
  let s5 = JSON.parse(drive5.files[fid5].content);
  assert(acq(s5.actuals) === 144373.61 && s5.actuals.filter((a) => a.tag === "stmt_buy_credit").length === 1 && s5.mgmt.credits[0].counted, "on opening: the kept credit becomes a ledger credit, saved by itself");
  await t5.click(t5.nav(/^Expenses/));
  const delRow = [...t5.doc.querySelectorAll(".ledger-row")].find((r) => /Seller property tax credit/.test(r.textContent));
  await t5.click([...delRow.querySelectorAll("button")].find((b) => /Delete|Remove/i.test(b.getAttribute("title") || b.getAttribute("aria-label") || "")));
  await t5.sleep(1900); await t5.settle(10);
  t5.win.close();
  t5 = await boot({ drive: drive5, anthropic, settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  await t5.click(t5.btn("Connect Google", t5.doc.querySelector(".pf-empty")));
  await t5.sleep(30); await t5.settle(10);
  await t5.click([...t5.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton")));
  await t5.sleep(1900); await t5.settle(10);
  s5 = JSON.parse(drive5.files[fid5].content);
  assert(!s5.actuals.some((a) => a.tag === "stmt_buy_credit"), "deleted by hand → it doesn't come back");

  console.log("8. Sale statement: the property taxes we pay at the sale count under Holding");
  const SALE = {
    document_type: "Settlement statement (seller)", property_address: "4623 Carrollton Ave, Indianapolis, IN 46205", settlement_date: "2027-04-20", price: 225000,
    totals: { buyer_debits: 0, buyer_credits: 0, due_from_buyer: 0, seller_debits: 15218.4, seller_credits: 225000, due_to_seller: 209781.6 },
    lines: [
      { description: "Sales price", category: "price", buyer_debit: 0, buyer_credit: 0, seller_debit: 0, seller_credit: 225000 },
      { description: "Commission to Keller Williams", category: "commission", buyer_debit: 0, buyer_credit: 0, seller_debit: 13500, seller_credit: 0 },
      { description: "Settlement fee", category: "title_settlement", buyer_debit: 0, buyer_credit: 0, seller_debit: 350, seller_credit: 0 },
      { description: "County taxes 01/01/27 to 04/20/27", category: "tax_proration", buyer_debit: 0, buyer_credit: 0, seller_debit: 1368.4, seller_credit: 0 },
    ],
  };
  const drive6 = makeDrive();
  const fid6 = drive6.add("4623 Carrollton Ave, Indianapolis, IN 46205.json", { ...saved, stage: "market" });
  const t6 = await boot({ drive: drive6, anthropic: async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: JSON.stringify(SALE) }], stop_reason: "end_turn" }) }), settings: { clientId: "c", folderId: "f", anthropicKey: "sk-ant-test" } });
  await t6.click(t6.btn("Connect Google", t6.doc.querySelector(".pf-empty")));
  await t6.sleep(30); await t6.settle(10);
  await t6.click([...t6.doc.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Carrollton")));
  await t6.sleep(20); await t6.settle(10);
  await t6.click(t6.nav(/^Expenses/));
  await t6.click(t6.btn("Add Sale HUD"));
  let m6 = t6.modal();
  const f6 = m6.querySelector('input[type="file"]');
  Object.defineProperty(f6, "files", { value: [new t6.win.File(["%PDF-1.4 sale"], "sale.pdf", { type: "application/pdf" })], configurable: true });
  f6.dispatchEvent(new t6.win.Event("change", { bubbles: true }));
  await t6.settle(4);
  await t6.click(t6.btn("Read statement", m6));
  await t6.sleep(60); await t6.settle(10);
  m6 = t6.modal();
  assert(/Property taxes up to the sale, which we pay at closing: \$1,368\.40\. Counted under Holding/.test(m6.textContent), "sale summary names the taxes we pay and where they go");
  await t6.click(t6.btn(/Apply \d+ line/, m6));
  await t6.sleep(1900); await t6.settle(10);
  const A6 = JSON.parse(drive6.files[fid6].content).actuals;
  const hold = A6.filter((a) => a.cat === "Holding").reduce((t, a) => t + a.amount, 0);
  assert(A6.some((a) => a.cat === "Holding" && a.amount === 1368.4 && /County taxes/.test(a.label)) && Math.round(hold * 100) / 100 === Math.round((1368.4 - 2071.54) * 100) / 100, "Holding: the sale's $1,368.40 taxes next to the purchase's −$2,071.54 credit");
  assert(t.errors.length === 0 && t2.errors.length === 0 && t3.errors.length === 0 && t4.errors.length === 0 && t5.errors.length === 0 && t6.errors.length === 0, "no errors " + t.errors.concat(t2.errors, t3.errors, t4.errors, t5.errors, t6.errors).join(" | "));
  console.log("\nALL CLOSING TESTS PASSED");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e); process.exit(1); });
