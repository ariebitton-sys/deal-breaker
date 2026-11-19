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
  await click(btn("Mark closed, start rehab"));
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
  assert(/Credit from the seller \(property tax\), kept for the tax bill\$2,071\.54/.test(sum), "the tax credit is shown apart, kept for the tax bill");
  assert(/comes off that bill when you log it/.test(sum), "explains where the credit goes");
  assert(/Paid: \$2,500 EMD before closing \+ \$141,873\.61 at closing; the other \$2,071\.54 is the seller's credit\. Together: \$146,445\.15\./.test(sum), "paid: EMD + cash at closing + the seller's credit");
  assert(/Every line is read: they add up to the statement's \$141,873\.61 due from the buyer/.test(sum), "lines match the statement's total");
  const row = (re) => [...md.querySelectorAll("tr")].find((r) => re.test(r.textContent));
  assert(row(/BROWN DOOR/).querySelector("select").value === "price" && row(/Assignment Fee/).querySelector("select").value === "price", "assignment / JV lines go to the purchase price, even when filed as misc");
  assert(row(/Deposit held by/).querySelector("select").value === "deposit", "the deposit is the EMD");
  assert(row(/Property Tax @/).querySelector("select").value === "credit", "the tax proration is a credit to us, not a negative holding cost");
  assert(!row(/Split Proceeds|Payoff Judgment|Transaction Coordination/), "seller-only lines aren't shown");
  assert(/Add the breakdown to the purchase price entry in the ledger \(\$142,500\)/.test(md.textContent), "the closing's $142,500 entry is right; it gets the breakdown");
  assert(/Keep the seller's \$2,071\.54 credit with the deal, to take off the property tax bill when you log it/.test(md.textContent), "offers to keep the credit for the tax bill");
  assert(/Acquisition in the ledger after this: \$146,445\.15, the same as the cost of the purchase/.test(md.textContent), "ledger after applying = $146,445.15");
  await click(btn(/Apply \d+ line/, md));
  await sleep(30); await settle(8);

  console.log("3. Ledger");
  await click(btn("Save deal"));
  await sleep(40); await settle(8);
  const saved = JSON.parse(drive.files[fid].content);
  const A = saved.actuals;
  assert(acq(A) === 146445.15, `ledger total $146,445.15 (got ${acq(A)})`);
  const pe = A.find((a) => a.tag === "purchase_price");
  assert(A.filter((a) => a.tag === "purchase_price").length === 1 && pe.amount === 142500, "one purchase entry: $142,500 paid at closing");
  assert(pe.label === "Purchase price $145,000 ($130,000 to the seller + $15,000 assignment / JV), paid at closing, less the $2,500 EMD paid earlier", "its description: " + pe.label);
  assert(pe.items.length === 7 && Math.round(pe.items.reduce((t, i) => t + i.amount, 0) * 100) / 100 === 142500 && pe.items.some((i) => /Joint Venture Agreement: Ashley White/.test(i.label)), "purchase breakdown: seller price, 5 assignment / JV payments, less the EMD");
  assert(saved.mgmt.credits.length === 1 && saved.mgmt.credits[0].amount === 2071.54 && saved.mgmt.credits[0].kind === "tax" && !saved.mgmt.credits[0].used, "the $2,071.54 tax credit is kept with the deal");
  assert(A.some((a) => a.label === "EMD" && a.amount === 2500), "the EMD entry is kept");
  const st = A.filter((a) => a.tag === "stmt_buy");
  assert(st.length === 1 && st[0].label === "Closing costs from the purchase statement (10 items)" && st[0].amount === 1445.15 && st[0].items.length === 10, "one statement entry: the title company's closing costs $1,445.15, with its 10 items");

  console.log("3b. Open a breakdown; log the tax bill against the credit");
  await click(btn(/^Expenses/, t.doc.querySelector(".sidebar")));
  const ccBtn = [...t.doc.querySelectorAll(".ledger-items-btn")].find((b) => /Closing costs from the purchase statement/.test(b.textContent));
  assert(ccBtn && ccBtn.getAttribute("aria-expanded") === "false", "closing costs entry can be opened");
  await click(ccBtn);
  const list = ccBtn.closest("div").parentElement.querySelector(".ledger-items");
  assert(list && list.querySelectorAll(".ledger-item:not(.sum)").length === 10 && /Owner's Premium for 130,000\.00: Eagle Land Title, LLC\$475/.test(list.textContent) && /10 items\$1,445\.15/.test(list.textContent), "it lists the 10 closing costs and their total");
  const cr = t.doc.querySelector(".ledger-credit");
  assert(cr && /Seller's property tax credit from closing: \$2,071\.54/.test(cr.textContent), "the ledger shows the credit waiting for the tax bill");
  await click(btn("Log the tax bill", cr));
  await t.setVal(cr.querySelector('input[type="number"]'), "2355.50");
  assert(/Log \$283\.96/.test(cr.textContent), "bill $2,355.50 less the $2,071.54 credit = $283.96");
  await click(btn(/^Log \$/, cr));
  await settle(6);
  assert(!t.doc.querySelector(".ledger-credit"), "credit used: the note is gone");
  await click(btn("Save deal"));
  await sleep(40); await settle(8);
  const saved2 = JSON.parse(drive.files[fid].content);
  const tax = saved2.actuals.find((a) => /Property tax bill/.test(a.label));
  assert(tax && tax.cat === "Holding" && tax.amount === 283.96 && tax.items.length === 2 && saved2.mgmt.credits[0].used === tax.id, "tax bill logged under Holding, net of the credit, with its breakdown");
  assert(A.every((a) => a.amount > 0) && !A.some((a) => a.cat === "Holding"), "every ledger entry is money out of our pocket: nothing negative, no negative tax under Holding");
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
  await t2.click(t2.btn(/^Expenses/, t2.doc.querySelector(".sidebar")));
  await t2.click(t2.btn(/Purchase closing docs|Fill the ledger from a document/));
  let m2 = t2.modal();
  if (/Purchase closing/.test(m2.textContent) && m2.querySelector('input[type="file"]') === null) { await t2.click(t2.btn(/Purchase closing/, m2)); m2 = t2.modal(); }
  const f2 = m2.querySelector('input[type="file"]');
  Object.defineProperty(f2, "files", { value: [new t2.win.File(["%PDF-1.4 fake"], "hud.pdf", { type: "application/pdf" })], configurable: true });
  f2.dispatchEvent(new t2.win.Event("change", { bubbles: true }));
  await t2.settle(4);
  await t2.click(t2.btn("Read statement", m2));
  await t2.sleep(60); await t2.settle(10);
  m2 = t2.modal();
  const fix = [...m2.querySelectorAll("label")].find((l) => /Correct the purchase price entry in the ledger from \$145,000 to \$142,500 \(\$145,000 less the \$2,500 EMD already in the ledger\)/.test(l.textContent));
  assert(fix && fix.querySelector("input").checked, "offers to correct the $145,000 entry to $142,500 (on by default)");
  await t2.click(t2.btn(/Apply \d+ line/, m2));
  await t2.sleep(30); await t2.settle(8);
  await t2.click(t2.btn("Save deal"));
  await t2.sleep(40); await t2.settle(8);
  const A2 = JSON.parse(drive2.files[fid2].content).actuals;
  assert(acq(A2) === 146445.15 && !A2.some((a) => /Joint Venture|Assignment Fee/.test(a.label)) && A2.every((a) => a.amount > 0), `old double counting removed: ledger $146,445.15, all entries positive (got ${acq(A2)})`);

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
  await t3.click(t3.btn(/^Documents$/, t3.doc.querySelector(".sidebar")));
  const arow = [...t3.doc.querySelectorAll(".analysis-row")].find((r) => /Purchase closing statement/.test(r.textContent));
  await t3.click(t3.btn(/^Open$/, arow));
  await t3.settle(6);
  const m3 = t3.modal();
  const row3 = (re) => [...m3.querySelectorAll("tr")].find((r) => re.test(r.textContent));
  assert(calls === 0, "no new Claude call");
  assert(row3(/Ashley White/).querySelector("select").value === "price" && row3(/Deposit held by/).querySelector("select").value === "deposit", "old mapping replaced: JV → purchase price, deposit → EMD");
  assert(/Cost of the purchase\$146,445\.15/.test(m3.textContent) && /totals weren't read/.test(m3.textContent), "same $146,445.15; says the totals check needs a fresh read");
  assert(row3(/Property Tax @/).querySelector("select").value === "credit", "the v41 mapping of the tax line (negative holding) is replaced by the credit");
  assert(t.errors.length === 0 && t2.errors.length === 0 && t3.errors.length === 0, "no errors " + t.errors.concat(t2.errors, t3.errors).join(" | "));
  console.log("\nALL CLOSING TESTS PASSED");
  process.exit(0);
})().catch((e) => { console.log("FAILED:", e); process.exit(1); });
