// v72: Lien waivers. The rules (which waivers each payment to the contractor needs), the documents and their
// fingerprint, the PDF, the tasks; and the tab: set up from the team defaults, parties, payments, e-signature
// through the n8n signing service (mocked), filing the signed PDF in Drive, Kappa's signature, paper uploads,
// paying with and without the waivers, team settings.
const fs = require("fs"),
  vm = require("vm"),
  babel = require("@babel/core");
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};

const src = fs.readFileSync(__dirname + "/../dist/app.jsx", "utf8");
const code = babel.transformSync(src.slice(0, src.indexOf("function App()")), { babelrc: false, configFile: false, sourceType: "script", presets: [["@babel/preset-react", { runtime: "classic" }]] }).code;
const C = { React: { useState() {}, useMemo() {}, useEffect() {}, useRef() {}, createElement() {}, Fragment: "F" }, window: {}, localStorage: { getItem: () => null, setItem() {} }, console, TextEncoder };
vm.createContext(C);
vm.runInContext(code + ";this.__g={sha256,lwRequired,lwView,lwDoc,lwTasks,lwPdfBuild,lwPayNeeds,dealTasks};", C);
const { sha256, lwRequired, lwView, lwDoc, lwTasks, lwPdfBuild } = C.__g;

// a stand-in for jsPDF: records what is written
const pdfs = [];
function FakePdf() {
  const texts = [],
    images = [];
  const api = {
    texts,
    images,
    setFont() {},
    setFontSize() {},
    setTextColor() {},
    setFillColor() {},
    setDrawColor() {},
    rect() {},
    line() {},
    addPage: () => texts.push("--page--"),
    splitTextToSize: (s) => [String(s)],
    text: (s) => texts.push(String(s)),
    addImage: (d) => images.push(d),
    output: () => ({ size: 100, arrayBuffer: async () => new TextEncoder().encode("%PDF " + texts.join("\n")).buffer }),
    save: (n) => (api.savedAs = n),
  };
  pdfs.push(api);
  return api;
}

console.log("1. The fingerprint and the rules");
assert(sha256("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" && sha256("") === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "SHA-256 (standard test vectors)");
const L = {
  owner: "Kappa Flips LLC",
  county: "Marion",
  threshold: 1000,
  countersign: true,
  signer: { name: "Arie Bitton", title: "Managing member", email: "arie@kappainv.com" },
  parties: [
    { id: "gc", role: "contractor", company: "Mauricio Construction LLC", name: "Mauricio Lopez", email: "m@example.com" },
    { id: "el", role: "sub", company: "Bright Electric", email: "e@example.com" },
    { id: "pl", role: "sub", company: "Pipe Pros", email: "p@example.com" },
  ],
  payments: [
    { id: "p1", amount: 18000, planned: "2026-11-10", through: "2026-11-09", subs: [{ id: "s1", party: "el", amount: 6000 }, { id: "s2", party: "pl", amount: 500 }] },
    { id: "p2", amount: 24000, planned: "2026-12-01", subs: [{ id: "s3", party: "pl", amount: 3000 }] },
    { id: "p3", amount: 24000, planned: "2026-12-20", final: true, subs: [] },
  ],
  waivers: [],
};
const R = lwRequired(L);
const of = (pay, when = "before") => R.filter((r) => r.payment === pay && r.when === when).map((r) => `${r.kind}:${r.party}:${r.amount}`);
assert(of("p1").join() === "cp:gc:18000", "payment 1: the contractor's conditional waiver on it");
assert(of("p2").join() === "cp:gc:24000,up:gc:18000,up:el:6000", "payment 2: conditional on it; unconditional on payment 1 from the contractor and the electrician ($500 to the plumber is under the threshold)");
assert(of("p3").join() === "cf:gc:24000,up:gc:24000,up:pl:3000,cf:el:6000,cf:pl:3500", "final payment: conditional final from the contractor and everyone paid, unconditional on payment 2");
assert(of("p3", "after").join() === "uf:gc:66000,uf:el:6000,uf:pl:3500", "after it: unconditional finals for everything each was paid");
let V = lwView({ ...L, waivers: [{ id: "w1", key: "cp|gc|p1", kind: "cp", party: "gc", amount: 18000, status: "complete" }] });
assert(V.find((r) => r.key === "cp|gc|p1").ok, "a signed waiver for the amount: done");
V = lwView({ ...L, waivers: [{ id: "w1", key: "cp|gc|p1", kind: "cp", party: "gc", amount: 17000, status: "complete" }] });
assert(!V.find((r) => r.key === "cp|gc|p1").ok && V.find((r) => r.key === "cp|gc|p1").changed, "signed for a different amount: not done, flagged");

console.log("2. The documents");
const doc = lwDoc(L, R.find((r) => r.key === "up|el|p1"), { address: "4623 Carrollton Ave, Indianapolis, IN 46205", state: "IN" });
assert(doc.title === "Unconditional Waiver and Release on Progress Payment" && doc.hash === sha256(JSON.stringify({ title: doc.title, notice: doc.notice, fields: doc.fields, paras: doc.paras })), "the title, and the fingerprint of exactly what is shown");
const F = Object.fromEntries(doc.fields);
assert(F.Owner === "Kappa Flips LLC" && F.Claimant === "Bright Electric" && F["Paid by"] === "Mauricio Construction LLC" && F.Payment === "$6,000" && F["County and state"] === "Marion County, Indiana" && F["Covers work through"] === "11/09/2026", "the fields: owner, claimant, paid by the contractor, $6,000, Marion County, through 11/09/2026");
assert(/has received a progress payment from Mauricio Construction LLC in the sum of \$6,000/.test(doc.paras[0]) && /has been paid for that work/.test(doc.paras[1]), "the wording: received, and its own subs and suppliers paid");
const fin = lwDoc(L, R.find((r) => r.key === "uf|gc|final"), { address: "x", state: "IN" });
assert(fin.title === "Unconditional Waiver and Release on Final Payment" && Object.fromEntries(fin.fields)["Total paid"] === "$66,000" && Object.fromEntries(fin.fields)["Disputed claims"] === "None", "the final unconditional: total paid, disputed claims");
let pdf = lwPdfBuild(FakePdf, doc, { claimant: null, claimantCompany: "Bright Electric", kappaLine: true, owner: "Kappa Flips LLC", ref: "" });
assert(pdf.texts[0] === doc.title && pdf.texts.includes("CLAIMANT") && pdf.texts.includes("RECEIVED ON BEHALF OF THE OWNER, KAPPA FLIPS LLC") && !pdf.texts.some((x) => /Signed electronically/.test(x)), "the PDF to sign on paper: blank lines for the claimant and the owner");
pdf = lwPdfBuild(FakePdf, doc, { claimant: { company: "Bright Electric", name: "Dana Volt", title: "Owner", at: "2026-11-20T15:04:00Z", sig: "", email: "e@example.com", ip: "203.0.113.7", ua: "Safari" }, kappaLine: false, ref: "tok1", esign: true });
assert(pdf.texts.includes("/s/ Dana Volt") && pdf.texts.some((x) => /Signed electronically by Dana Volt \(e@example\.com\) on 2026-11-20 15:04 UTC from IP 203\.0\.113\.7/.test(x)) && pdf.texts.some((x) => x.includes(doc.hash)), "e-signed with a typed name: /s/ Dana Volt, the audit line, the fingerprint");

console.log("3. Tasks");
const mg = { liens: { ...L, waivers: [{ id: "w9", key: "cp|gc|p1", kind: "cp", party: "gc", amount: 18000, status: "signed", signedAt: "2026-11-08T10:00:00Z" }] } };
let tk = lwTasks({ liens: L }, "rehab", "2026-11-05");
assert(tk.some((x) => x.id === "lw-pay-p1" && x.due === "2026-11-10" && /before payment 1: 1 of 1 not signed/.test(x.label)) && !tk.some((x) => x.id === "lw-pay-p2"), "a payment within 10 days with a waiver missing: a task; the later one waits");
tk = lwTasks(mg, "rehab", "2026-11-05");
assert(!tk.some((x) => x.id === "lw-pay-p1") && tk.some((x) => x.id === "lw-cs-w9" && x.who === "Arie Bitton"), "once the contractor signed: no task for the payment, one for Arie to sign for Kappa");
assert(lwTasks({}, "rehab", "2026-11-05").length === 0 && lwTasks(mg, "analyzing", "2026-11-05").length === 0, "no lien waivers, or a deal in analysis: none");

// ---------- the app ----------
const pad = (n) => String(n).padStart(2, "0");
const day = (n) => {
  const x = new Date();
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const deal = {
  address: "4623 Lien Ave, Indianapolis, IN 46205", sqft: 1300, holdMonths: 5, arv: 300000, purchase: 140000, repairs: [], useRepairBuilder: false, manualRepair: 80000, pm: { type: "flat", val: 0 },
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.16, intRateRehab: 0.16, points: 0, investorAuto: true, investorRate: 0.09,
  taxAnnual: 0, insMonthly: 0, utilGas: 0, utilWater: 0, utilElec: 0, hoaMonthly: 0, miscHold: 0, buyTxn: txn(), sellTxn: txn(), actuals: [], stage: "rehab",
  mgmt: { closing: { date: day(-30), price: 140000 }, rehab: { startDate: day(-25) }, contacts: [{ role: "Contractor", name: "Mauricio Lopez", company: "Mauricio Construction LLC", phone: "", email: "m@example.com" }] },
};
const N8N = "https://kappa.app.n8n.cloud/webhook/kappa-lien-waivers";
const KEY = "k3y";
const lienCfg = { url: N8N, key: KEY, owner: "Kappa Flips LLC", threshold: 1000, countersign: true, signer: { name: "Arie Bitton", title: "Managing member", email: "arie@kappainv.com" } };

(async () => {
  const drive = makeDrive();
  const fid = drive.add("4623 Lien Ave, Indianapolis, IN 46205.json", deal);
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f", lienCfg } });
  const { doc: d, win, click, btn, setVal, settle, sleep, nav } = t;
  win.jspdf = { jsPDF: FakePdf };
  // the n8n signing service
  const store = {},
    calls = [];
  const orig = win.fetch;
  win.fetch = async (url, opts) => {
    if (String(url) !== N8N) return orig(url, opts);
    const b = JSON.parse(opts.body);
    calls.push({ ...b, key: opts.headers["X-Kappa-Key"] });
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (opts.headers["X-Kappa-Key"] !== KEY) return { ok: false, status: 401, json: async () => ({ ok: false }) };
    if (b.action === "request") return (store[b.token] = { ...b, status: "sent" }), ok({ ok: true });
    if (b.action === "void") return (store[b.token] && (store[b.token].status = "void"), ok({ ok: true }));
    if (b.action === "remind") return ok({ ok: true });
    if (b.action === "status") return ok({ ok: true, items: b.tokens.filter((x) => store[x]).map((x) => ({ token: x, ...store[x] })) });
    return ok({ ok: false, error: "unknown action" });
  };
  const saved = () => JSON.parse(drive.files[fid].content);
  const blur = async (el) => {
    el.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true }));
    await settle(3);
  };
  const type = async (el, v) => {
    await setVal(el, v);
    await blur(el);
  };
  const LW = () => d.querySelector(".lw");
  const pay = (i) => LW().querySelectorAll(".lw-pay")[i];
  const row = (key) => LW().querySelector(`.lw-w[data-key="${key}"]`);
  const keyOf = (i, kind, partyRe) => [...pay(i).querySelectorAll(".lw-w")].find((r) => r.dataset.key.startsWith(kind + "|") && partyRe.test(r.querySelector(".lw-w-who b").textContent)).dataset.key;

  console.log("4. Set up from the team defaults");
  await click(btn("Connect Google", d.querySelector(".pf-empty")));
  await sleep(80);
  await settle(14);
  await click(nav(/^Active projects/));
  await click([...d.querySelectorAll("tr.dt-row")].find((r) => r.textContent.includes("4623 Lien Ave")));
  await sleep(30);
  await settle(8);
  assert([...d.querySelectorAll(".ptabs button")].some((b) => b.textContent === "Lien waivers"), "a Lien waivers tab");
  await click(nav(/^Lien waivers/));
  await click(btn("Set up lien waivers", LW()));
  assert(LW().querySelector('[aria-label="Owner of record"]').value === "Kappa Flips LLC" && /Arie Bitton/.test(LW().querySelector(".lw-signer").textContent) && /On: sent by email/.test(LW().textContent), "set up: the team's owner LLC, Arie signs for Kappa, e-signature on");
  const pr = () => [...LW().querySelectorAll(".lw-pr")];
  assert(pr().length === 1 && pr()[0].querySelector('[aria-label="Company"]').value === "Mauricio Construction LLC" && pr()[0].querySelector("select").value === "contractor", "the contractor from the contacts");
  await click(btn(/Add$/, LW().querySelectorAll(".lw-card")[0]));
  await type(pr()[1].querySelector('[aria-label="Company"]'), "Bright Electric");
  await type(pr()[1].querySelector('[aria-label="Email"]'), "e@example.com");
  assert(pr()[1].querySelector("select").value === "sub", "a subcontractor added");

  console.log("5. Payments and what they need");
  await click(btn(/Payment$/, LW().querySelectorAll(".lw-card")[1]));
  await click(btn(/Payment$/, LW().querySelectorAll(".lw-card")[1]));
  await type(pay(0).querySelector('[aria-label="Payment amount"]'), "18000");
  await setVal(pay(0).querySelector('[aria-label="Planned date"]'), day(3));
  await type(pay(1).querySelector('[aria-label="Payment amount"]'), "24000");
  await click(btn(/Sub or supplier paid from payment 1/, pay(0)));
  await setVal(pay(0).querySelector(".lw-subrow select"), pr()[1].dataset.party);
  await type(pay(0).querySelector('[aria-label="Amount paid to them"]'), "6000");
  assert(pay(0).querySelectorAll(".lw-w").length === 1 && pay(1).querySelectorAll(".lw-w").length === 3, "payment 1 needs 1 waiver; payment 2 needs 3 (with the electrician's on payment 1)");
  assert(/Payment 1: 1 of 1 waivers missing/.test(LW().querySelector(".lw-head-r").textContent), "the header: payment 1, 1 of 1 missing");

  console.log("6. Send for e-signature; it comes back signed");
  const k1 = keyOf(0, "cp", /Mauricio/);
  await click(btn("Send", row(k1)));
  await settle(4);
  const req = calls.find((c) => c.action === "request");
  assert(req && req.key === KEY && req.to === "m@example.com" && req.doc.title === "Conditional Waiver and Release on Progress Payment" && req.hash === sha256(JSON.stringify({ title: req.doc.title, notice: req.doc.notice, fields: req.doc.fields, paras: req.doc.paras })), "sent to the contractor: the document and its fingerprint");
  assert(req.link === `https://ariebitton-sys.github.io/deal-breaker/sign.html#t=${req.token}&a=${encodeURIComponent(N8N)}` && req.notify === "arie@kappainv.com", "with the signing link, and Arie to notify");
  assert(/^Sent /.test(row(k1).querySelector(".lw-st").textContent) && row(k1).querySelector(".lw-a") && btn("Remind", row(k1)), "status: Sent; Remind and Copy link offered");
  Object.assign(store[req.token], { status: "signed", signedAt: new Date().toISOString(), name: "Mauricio Lopez", title: "Owner", email: "m@example.com", ip: "203.0.113.7", ua: "Mobile Safari", signature: "data:image/png;base64,SIG" });
  await click(btn("Check for signatures", LW()));
  await sleep(30);
  await settle(8);
  const filed = Object.values(drive.files).find((f) => /lien waiver — Mauricio Construction LLC — Conditional \$18,000/.test(f.name));
  assert(filed && /Signed electronically by Mauricio Lopez \(m@example\.com\)/.test(filed.content) && /RECEIVED ON BEHALF OF THE OWNER/.test(filed.content), "the signed PDF filed in Drive, with the audit line and Kappa's line");
  assert(/Signed .* waiting for Arie Bitton/.test(row(k1).querySelector(".lw-st").textContent) && btn("Sign for Kappa", row(k1)), "status: signed, waiting for Arie, who can sign for Kappa");

  console.log("7. Arie signs for Kappa");
  await click(btn("Sign for Kappa", row(k1)));
  const sb = btn(/^Sign$/, d.body);
  assert(sb.disabled, "Sign waits for the box to be ticked");
  await click([...d.querySelectorAll(".lw-check input")].pop());
  await click(btn(/^Sign$/, d.body));
  await sleep(30);
  await settle(8);
  const files = Object.values(drive.files).filter((f) => /lien waiver — Mauricio Construction LLC/.test(f.name));
  assert(files.length === 1 && /Signed for the Owner in Deal Breaker by Arie Bitton \(arie@kappainv\.com\)/.test(files[0].content) && /SIG/.test(pdfs[pdfs.length - 1].images.join()), "a new PDF with both signatures replaces the first one");
  assert(/^Signed /.test(row(k1).querySelector(".lw-st").textContent) && !/waiting/.test(row(k1).querySelector(".lw-st").textContent) && /Ready to pay/.test(pay(0).textContent), "complete: payment 1 is ready to pay");

  console.log("8. Pay, on paper, and paying without");
  await type(pay(0).querySelector('[aria-label="What this payment covers"]'), "Demo and framing");
  await click(btn("Mark paid…", pay(0)));
  assert(/For: Demo and framing/.test(d.body.textContent), "the Mark paid window says what the payment covers");
  await click(btn(/^Mark paid$/, d.body));
  await sleep(1700);
  await settle(6);
  let s = saved();
  assert(
    s.mgmt.liens.payments[0].paidOn && s.mgmt.liens.payments[0].note === "Demo and framing" && s.actuals.some((a) => a.cat === "Rehab / Construction" && a.amount === 18000 && a.label === "Mauricio Construction LLC: payment 1 — Demo and framing"),
    "paid: recorded, and added to Expenses with what it covers",
  );
  await type(pay(0).querySelector('[aria-label="What this payment covers"]'), "Demo, framing and rough plumbing");
  await sleep(1700);
  await settle(6);
  s = saved();
  assert(s.actuals.filter((a) => a.amount === 18000).length === 1 && s.actuals.some((a) => a.label === "Mauricio Construction LLC: payment 1 — Demo, framing and rough plumbing"), "a later change follows into the Expenses line");
  const kUp = keyOf(1, "up", /Mauricio/);
  const input = LW().querySelector('input[type="file"]');
  await click(btn("Upload signed", row(kUp)));
  Object.defineProperty(input, "files", { configurable: true, value: [{ name: "waiver-scan.pdf", type: "application/pdf", size: 3, arrayBuffer: async () => new Uint8Array([37, 80, 68]).buffer }] });
  input.dispatchEvent(new win.Event("change", { bubbles: true }));
  await sleep(30);
  await settle(6);
  assert(/\(uploaded\)/.test(row(kUp).querySelector(".lw-st").textContent) && Object.values(drive.files).some((f) => f.name === "waiver-scan.pdf"), "uploaded a paper copy: signed (uploaded), in Drive");
  await click(btn("Mark paid…", pay(1)));
  const warn = d.querySelector(".lw-warn");
  assert(warn && /2 waivers aren't signed yet/.test(warn.textContent) && btn(/^Mark paid$/, d.body).disabled, "2 still missing: a warning, and Mark paid is off");
  await click(warn.querySelector("input"));
  assert(!btn(/^Mark paid$/, d.body).disabled, "until 'Pay without them' is ticked");
  await click(btn("Cancel", d.body));
  await type(pay(1).querySelector('[aria-label="Payment amount"]'), "25000");
  const kCp2 = keyOf(1, "cp", /Mauricio/);
  assert(/Not requested/.test(row(kCp2).textContent) && /\$25,000/.test(row(kCp2).textContent), "the new amount: payment 2's conditional waiver is for $25,000");

  console.log("9. Tasks and team settings");
  await click([...d.querySelectorAll(".sidebar .sb-item")].find((b) => /Tasks/.test(b.textContent)));
  await sleep(20);
  await settle(6);
  const lwTask = [...d.querySelectorAll(".tk-row")].find((r) => /Lien waivers before payment 2: 2 of 3 not signed/.test(r.textContent));
  assert(lwTask && /Open lien waivers/.test(lwTask.textContent) && !lwTask.querySelector('input[type="checkbox"]'), "the next payment (no date yet): a task on the board, 2 of 3 not signed, no tick box");
  await click(lwTask.querySelector(".tk-lw-link"));
  await sleep(20);
  await settle(6);
  assert(LW() && d.querySelector('.ptabs [aria-selected="true"]').textContent === "Lien waivers", "Open lien waivers: the project's tab");
  await click(btn("Team settings", LW()));
  await setVal(d.querySelector('[aria-label="Default threshold"]'), "1500");
  await click(btn("Save for the team", d.body));
  await sleep(30);
  await settle(6);
  const team = Object.values(drive.files).find((f) => f.name === "Deal Breaker team settings.json");
  assert(team && JSON.parse(team.content).liens.threshold === 1500 && JSON.parse(team.content).liens.url === N8N, "saved in the team settings file, for everyone");
  assert(!t.errors.length, "no errors " + t.errors.join(" | "));
  console.log("\nALL LIEN WAIVER TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
