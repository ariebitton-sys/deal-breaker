// v72: the public signing page (sign.html): loads the waiver from the signing service, checks its fingerprint,
// takes the name, title, signature and consent, and posts the signature back. Refuses links it doesn't trust.
const fs = require("fs");
const { JSDOM } = require("jsdom");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const html = fs.readFileSync(__dirname + "/../sign.html", "utf8");
const API = "https://kappa.app.n8n.cloud/webhook/kappa-lien-waivers";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the same fingerprint the app makes
const vm = require("vm"),
  babel = require("@babel/core");
const src = fs.readFileSync(__dirname + "/../dist/app.jsx", "utf8");
const code = babel.transformSync(src.slice(0, src.indexOf("function App()")), { babelrc: false, configFile: false, sourceType: "script", presets: [["@babel/preset-react", { runtime: "classic" }]] }).code;
const Cx = { React: { useState() {}, useMemo() {}, useEffect() {}, useRef() {}, createElement() {}, Fragment: "F" }, window: {}, localStorage: { getItem: () => null, setItem() {} }, console, TextEncoder };
vm.createContext(Cx);
vm.runInContext(code + ";this.__g={lwDoc};", Cx);
const L = { owner: "Kappa Flips LLC", parties: [{ id: "gc", role: "contractor", company: "Mauricio Construction LLC" }], payments: [], waivers: [] };
const DOC = Cx.__g.lwDoc(L, { kind: "cp", party: "gc", amount: 18000, through: "2026-11-09" }, { address: "4623 Carrollton Ave, Indianapolis, IN 46205", state: "IN" });

function open(hash, server) {
  const posts = [];
  const dom = new JSDOM(html, {
    url: "https://ariebitton-sys.github.io/deal-breaker/sign.html" + hash,
    runScripts: "dangerously",
    beforeParse(win) {
      win.TextEncoder = TextEncoder;
      win.fetch = async (url, opts) => {
        if (opts && opts.method === "POST") {
          posts.push({ url, body: JSON.parse(opts.body) });
          return { ok: true, status: 200, json: async () => ({ ok: true }) };
        }
        const r = server(url);
        return { ok: r.status === 200, status: r.status, json: async () => r.body };
      };
    },
  });
  return { win: dom.window, doc: dom.window.document, posts };
}
const $ = (w, id) => w.doc.getElementById(id);

(async () => {
  console.log("1. A good link");
  let seen = null;
  let w = open(`#t=tok123&a=${encodeURIComponent(API)}`, (url) => ((seen = url), { status: 200, body: { ok: true, status: "sent", doc: DOC, toName: "Mauricio Lopez", claimant: "Mauricio Construction LLC", from: "Arie Bitton" } }));
  await sleep(50);
  assert(seen === API + "-doc?t=tok123", "asks the service for the document by its token");
  assert($(w, "title").textContent === "Conditional Waiver and Release on Progress Payment" && /Arie Bitton at Kappa Real Estate Investments asks Mauricio Construction LLC to sign/.test($(w, "intro").textContent), "shows the waiver and who asks");
  assert([...w.doc.querySelectorAll("dt")].map((x) => x.textContent).includes("Covers work through") && w.doc.querySelectorAll("p.para").length === 3, "the fields and the paragraphs");
  assert($(w, "name").value === "Mauricio Lopez" && $(w, "sign").disabled, "the name filled in; Sign off until they agree");
  $(w, "jobtitle").value = "Owner";
  $(w, "agree").checked = true;
  $(w, "agree").dispatchEvent(new w.win.Event("change"));
  assert(!$(w, "sign").disabled, "agreed: Sign on");
  $(w, "sign").dispatchEvent(new w.win.MouseEvent("click", { bubbles: true }));
  await sleep(50);
  const p = w.posts[0];
  assert(p && p.url === API + "-sign" && p.body.t === "tok123" && p.body.hash === DOC.hash && p.body.name === "Mauricio Lopez" && p.body.title === "Owner" && p.body.consent === true, "posts the signature: token, fingerprint, name, title, consent");
  assert(/Signed\. Thank you, Mauricio Lopez/.test($(w, "state").textContent) && $(w, "signCard").classList.contains("hidden"), "thanks them");

  console.log("2. Links it won't use");
  w = open(`#t=tok123&a=${encodeURIComponent("https://evil.example.com/webhook/x")}`, () => ({ status: 200, body: {} }));
  await sleep(30);
  assert(/isn't complete/.test($(w, "state").textContent) && $(w, "docCard").classList.contains("hidden"), "a service that isn't Kappa's n8n: refused");
  w = open(`#t=tok123&a=${encodeURIComponent(API)}`, () => ({ status: 200, body: { ok: true, status: "sent", doc: { ...DOC, paras: [...DOC.paras.slice(0, 2), "Changed text."] } } }));
  await sleep(50);
  assert(/can't be verified/.test($(w, "state").textContent) && $(w, "signCard").classList.contains("hidden"), "a document whose text doesn't match its fingerprint: refused");
  w = open(`#t=tok123&a=${encodeURIComponent(API)}`, () => ({ status: 200, body: { ok: true, status: "void", doc: DOC } }));
  await sleep(50);
  assert(/was cancelled/.test($(w, "state").textContent), "a cancelled request");
  w = open(`#t=tok123&a=${encodeURIComponent(API)}`, () => ({ status: 200, body: { ok: true, status: "signed", signedAt: "2026-11-20T15:04:00Z", doc: DOC } }));
  await sleep(50);
  assert(/was signed/.test($(w, "state").textContent) && $(w, "signCard").classList.contains("hidden") && !$(w, "docCard").classList.contains("hidden"), "already signed: shows the document, no signing");
  w = open(`#t=nope&a=${encodeURIComponent(API)}`, () => ({ status: 404, body: {} }));
  await sleep(50);
  assert(/isn't valid anymore/.test($(w, "state").textContent), "an unknown token");
  console.log("\nALL SIGN PAGE TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
