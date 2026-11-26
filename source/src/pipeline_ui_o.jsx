// ============================================================================
// v72 — LIEN WAIVERS: what has to be waived before each payment to the contractor, the documents, the
// signatures (e-signed through Kappa's signing service in n8n, or on paper). Only the claimant signs a waiver.
// ============================================================================
// mgmt.liens = { owner, county, threshold, signer {name,email}, parties, payments, waivers }
//   signer = who the waivers are sent by: named in the emails, and told when one is signed
//   parties  [{ id, role: "contractor" | "sub" | "supplier", company, name, email, phone, trade }]
//   payments [{ id, amount, note, planned, through, final, paidOn, subs: [{ id, party, amount }], override }]
//            to the general contractor, in order; subs = who the contractor paid from it: they waive before the next one
//            note = what the payment covers; it goes into the Expenses line made when the payment is marked paid
//   waivers  [{ id, key, kind, party, payment, about, amount, through, status, via, token, sentAt, signedAt, signer, kappa, file, hash }]
//            kind cp / up: conditional / unconditional on a progress payment; cf / uf: on the final payment.
//            status sent → complete once signed ("signed" in deals from v72: the same); void when replaced or cancelled
// The team's defaults and the signing service (settings.lienCfg, kept in the team settings file):
//   { url, key, owner, threshold, signer {name,email} }
const LW_STAGES = ["contract", "rehab", "market", "sold"];
const LW_THRESHOLD = 1000;
const LW_KINDS = {
  cp: { short: "Conditional", title: "Conditional Waiver and Release on Progress Payment", cond: true, final: false },
  up: { short: "Unconditional", title: "Unconditional Waiver and Release on Progress Payment", cond: false, final: false },
  cf: { short: "Conditional final", title: "Conditional Waiver and Release on Final Payment", cond: true, final: true },
  uf: { short: "Unconditional final", title: "Unconditional Waiver and Release on Final Payment", cond: false, final: true },
};
const LW_ROLES = [
  ["contractor", "General contractor"],
  ["sub", "Subcontractor"],
  ["supplier", "Supplier"],
];
const LW_STATE_NAME = { IN: "Indiana", OH: "Ohio" };
const LW_JSPDF = "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js";
const LW_SIGN_PAGE = "https://ariebitton-sys.github.io/deal-breaker/sign.html";
const lwEmpty = () => ({ owner: "", county: "", threshold: LW_THRESHOLD, signer: null, parties: [], payments: [], waivers: [] });
const lwOf = (mg) => ({ ...lwEmpty(), ...((mg && mg.liens) || {}) });
const lwState = (address) => {
  const m = String(address || "").match(/,\s*([A-Z]{2})\s+\d{5}/);
  return m ? m[1] : "";
};
const lwName = (p) => (p && (p.company || p.name)) || "Unnamed";
const lwSignLink = (url, token) => `${LW_SIGN_PAGE}#t=${token}&a=${encodeURIComponent(url)}`;
const lwStamp = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? String(iso || "") : d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
};
const lwSameEmail = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
function lwToken() {
  const a = new Uint8Array(20);
  try {
    crypto.getRandomValues(a);
  } catch (e) {
    for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(a, (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
}

// SHA-256 of a string (UTF-8), hex: the fingerprint of the text a waiver's signer saw
function sha256(str) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const bytes = Array.from(new TextEncoder().encode(String(str)));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) | 0));
  }
  return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
}

// ---------- what each payment needs ----------
function lwTotals(L) {
  const t = {};
  (L.payments || []).forEach((p) => (p.subs || []).forEach((s) => s.party && (t[s.party] = (t[s.party] || 0) + num(s.amount))));
  return t;
}
// Before payment n: the contractor's conditional waiver on it, and unconditional waivers on payment n−1 from the
// contractor and from everyone it paid from that payment (at or above the threshold). Once a progress payment is
// paid, the contractor's unconditional waiver on it is asked for at once (when: "paid"); it is the same waiver
// the next payment needs. The final payment takes final conditional waivers from everyone who worked on the house,
// and after it, final unconditional ones.
function lwRequired(L) {
  const th = L.threshold == null || L.threshold === "" ? LW_THRESHOLD : num(L.threshold);
  const parties = L.parties || [];
  const gc = parties.find((p) => p.role === "contractor");
  const pays = L.payments || [];
  const thru = (p) => p.through || p.paidOn || p.planned || "";
  const out = [],
    seen = new Set();
  const add = (r) => {
    const key = `${r.kind}|${r.party}|${r.about}`;
    const once = key + (r.when === "paid" ? "|paid" : "");
    if (seen.has(once)) return;
    seen.add(once);
    out.push({ ...r, key });
  };
  const totals = lwTotals(L);
  const others = parties.filter((x) => x.role !== "contractor" && (totals[x.id] || 0) >= th && (totals[x.id] || 0) > 0);
  const gcTotal = pays.reduce((t, p) => t + num(p.amount), 0);
  pays.forEach((p, i) => {
    const prev = pays[i - 1];
    if (gc) add({ kind: p.final ? "cf" : "cp", party: gc.id, amount: num(p.amount), through: thru(p), payment: p.id, about: p.id, when: "before" });
    if (prev) {
      if (gc) add({ kind: "up", party: gc.id, amount: num(prev.amount), through: thru(prev), payment: p.id, about: prev.id, when: "before" });
      (prev.subs || [])
        .filter((s) => s.party && s.party !== (gc && gc.id) && num(s.amount) >= th && num(s.amount) > 0)
        .forEach((s) => add({ kind: "up", party: s.party, amount: num(s.amount), through: thru(prev), payment: p.id, about: prev.id, when: "before" }));
    }
    if (gc && p.paidOn && !p.final) add({ kind: "up", party: gc.id, amount: num(p.amount), through: thru(p), payment: p.id, about: p.id, when: "paid" });
    if (p.final) {
      others.forEach((x) => add({ kind: "cf", party: x.id, amount: totals[x.id], through: thru(p), payment: p.id, about: p.id, when: "before" }));
      if (gc) add({ kind: "uf", party: gc.id, amount: gcTotal, through: thru(p), payment: p.id, about: "final", when: "after" });
      others.forEach((x) => add({ kind: "uf", party: x.id, amount: totals[x.id], through: thru(p), payment: p.id, about: "final", when: "after" }));
    }
  });
  return out;
}
// each requirement with its waiver (the latest one not void) and where it stands
function lwView(L) {
  const byKey = {};
  (L.waivers || []).forEach((w) => w.status !== "void" && (byKey[w.key] = w));
  return lwRequired(L).map((r) => {
    const w = byKey[r.key] || null;
    const changed = !!w && Math.round(num(w.amount)) !== Math.round(r.amount);
    const st = !w ? "none" : w.status;
    return { ...r, w, st, changed, ok: (st === "signed" || st === "complete") && !changed };
  });
}
const lwPayNeeds = (V, p) => {
  const before = V.filter((r) => r.payment === p.id && r.when === "before");
  return { before, miss: before.filter((r) => !r.ok) };
};

// ---------- the document ----------
// Kappa's own wording (Indiana and Ohio have no statutory form): have an attorney or the title company review it.
function lwDoc(L, r, ctx) {
  const K = LW_KINDS[r.kind];
  const parties = L.parties || [];
  const party = parties.find((p) => p.id === r.party) || {};
  const gc = parties.find((p) => p.role === "contractor");
  const owner = String(L.owner || "").trim() || "the Owner";
  const claimant = lwName(party);
  const payer = party.role === "contractor" || !gc ? owner : lwName(gc);
  const amount = fmt(num(r.amount));
  const t = r.through ? fmtDate(r.through) : "the date this waiver is signed";
  const where = [L.county ? `${String(L.county).replace(/\s*county$/i, "")} County` : "", LW_STATE_NAME[ctx.state] || ctx.state || ""].filter(Boolean).join(", ");
  const fields = [
    ["Property", ctx.address || ""],
    ...(where ? [["County and state", where]] : []),
    ["Owner", owner],
    ["Claimant", claimant],
    ["Paid by", payer],
    [r.kind === "uf" ? "Total paid" : r.kind === "cf" ? "Final payment" : "Payment", amount],
    K.final ? ["Disputed claims", "None"] : ["Covers work through", r.through ? fmtDate(r.through) : "The date this waiver is signed"],
  ];
  const notice = K.cond
    ? "NOTICE: This document waives the Claimant's lien rights only once the payment described in it has been received. If the payment is not received, it has no effect."
    : "NOTICE: This document waives and releases lien rights unconditionally and states that the Claimant has been paid. It binds the Claimant once signed, even if the Claimant has not in fact been paid. A Claimant that has not been paid should not sign it.";
  const lien = "any mechanic's lien and any other lien, claim or right to a lien the Claimant has on the Property";
  const paras = {
    cp: [
      `Upon receipt by the Claimant of a payment from ${payer} in the sum of ${amount}, and once that payment has cleared the bank it is drawn on or the funds transfer has been received, this document becomes effective to waive and release ${lien} for labor, services, equipment and materials furnished through ${t}.`,
      `This waiver covers a progress payment only. It does not cover retention, extras for which the Claimant has not been paid, or labor, services, equipment and materials furnished after ${t}.`,
      "If the payment is not received, this document has no effect and the Claimant keeps all of its lien rights.",
    ],
    up: [
      `The Claimant has received a progress payment from ${payer} in the sum of ${amount}, and hereby waives and releases ${lien} for labor, services, equipment and materials furnished through ${t}.`,
      "The Claimant warrants that every laborer, subcontractor and supplier it engaged for the work covered by this payment has been paid for that work, or will be paid from this payment.",
      `This waiver does not cover retention, extras for which the Claimant has not been paid, or labor, services, equipment and materials furnished after ${t}.`,
    ],
    cf: [
      `Upon receipt by the Claimant of a final payment from ${payer} in the sum of ${amount}, and once that payment has cleared the bank it is drawn on or the funds transfer has been received, this document becomes effective to waive and release ${lien} for all labor, services, equipment and materials it has furnished to the Property.`,
      "The Claimant states that, once this payment is received, it will have been paid in full for all of its work on the Property, except for the disputed claims listed above.",
      "If the payment is not received, this document has no effect and the Claimant keeps all of its lien rights.",
    ],
    uf: [
      `The Claimant has been paid in full, ${amount} in total, for all labor, services, equipment and materials it has furnished to the Property, and hereby waives and releases ${lien}, except for the disputed claims listed above.`,
      "The Claimant warrants that every laborer, subcontractor and supplier it engaged for work on the Property has been paid in full.",
    ],
  }[r.kind];
  const body = { title: K.title, notice, fields, paras };
  return { ...body, hash: sha256(JSON.stringify(body)) };
}

// ---------- the PDF ----------
function lwLoadPdf() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = LW_JSPDF;
    s.onload = () => (window.jspdf && window.jspdf.jsPDF ? res(window.jspdf.jsPDF) : rej(new Error("the PDF maker didn't load")));
    s.onerror = () => rej(new Error("the PDF maker didn't load"));
    document.head.appendChild(s);
  });
}
// o: { claimant {company,name,title,at,sig,email,ip,ua} | null, claimantCompany, ref, esign, logo (data URL; Kappa's logo by default) }
function lwPdfBuild(JsPDF, doc, o) {
  const pdf = new JsPDF({ unit: "pt", format: "letter" });
  const M = 56,
    W = 612 - 2 * M,
    BOT = 742;
  let y = 64;
  const logo = o.logo !== undefined ? o.logo : typeof window !== "undefined" ? window._KAPPA_LOGO : "";
  if (logo) {
    try {
      const ip = pdf.getImageProperties ? pdf.getImageProperties(logo) : null;
      const lh = 36;
      pdf.addImage(logo, "PNG", M, 36, ip && ip.height ? (lh * ip.width) / ip.height : 85, lh);
      y = 104;
    } catch (e) {}
  }
  const room = (h) => {
    if (y + h > BOT) {
      pdf.addPage();
      y = 64;
    }
  };
  const ink = (c) => pdf.setTextColor(c[0], c[1], c[2]);
  const write = (s, size, style, color, x = M, width = W) => {
    pdf.setFont("helvetica", style || "normal");
    pdf.setFontSize(size);
    ink(color || [17, 24, 39]);
    const lh = size * 1.4;
    pdf.splitTextToSize(String(s), width).forEach((ln) => {
      room(lh);
      pdf.text(ln, x, y);
      y += lh;
    });
  };
  write(doc.title, 15, "bold");
  y += 6;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(9);
  const nl = pdf.splitTextToSize(doc.notice, W - 18);
  const nh = nl.length * 12.6 + 12;
  room(nh);
  pdf.setFillColor(243, 244, 246);
  pdf.rect(M, y - 9, W, nh, "F");
  ink([55, 65, 81]);
  nl.forEach((ln, i) => pdf.text(ln, M + 9, y + 4 + i * 12.6));
  y += nh + 8;
  doc.fields.forEach(([k, v]) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    const vl = pdf.splitTextToSize(String(v || ""), W - 150);
    const h = Math.max(1, vl.length) * 14 + 4;
    room(h);
    ink([17, 24, 39]);
    vl.forEach((ln, i) => pdf.text(ln, M + 150, y + i * 14));
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    ink([107, 114, 128]);
    pdf.text(k, M, y);
    y += h;
  });
  y += 8;
  doc.paras.forEach((p) => {
    write(p, 10.5, "normal");
    y += 5;
  });
  y += 12;
  const block = (head, s, company) => {
    room(140);
    write(head, 8.5, "bold", [107, 114, 128]);
    if (s && s.sig) {
      try {
        const ip = pdf.getImageProperties ? pdf.getImageProperties(s.sig) : null;
        pdf.addImage(s.sig, "PNG", M, y, ip && ip.height ? Math.min(250, (48 * ip.width) / ip.height) : 180, 48);
      } catch (e) {}
    } else if (s && s.name) {
      pdf.setFont("times", "italic");
      pdf.setFontSize(20);
      ink([17, 24, 39]);
      pdf.text(`/s/ ${s.name}`, M + 4, y + 34);
    }
    y += 52;
    pdf.setDrawColor(156, 163, 175);
    pdf.line(M, y, M + 260, y);
    y += 14;
    const row = (k, v) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      ink([107, 114, 128]);
      pdf.text(k, M, y);
      ink([17, 24, 39]);
      pdf.text(String(v || ""), M + 62, y);
      y += 14;
    };
    if (company != null) row("Company", company);
    row("Name", s ? s.name : "");
    row("Title", s ? s.title : "");
    row("Date", s && s.at ? fmtDate(String(s.at).slice(0, 10)) : "");
    y += 8;
  };
  block("CLAIMANT", o.claimant, (o.claimant && o.claimant.company) || o.claimantCompany || "");
  const grey = [120, 128, 140];
  if (o.esign && o.claimant) {
    const c = o.claimant;
    write(
      `Signed electronically by ${c.name}${c.email ? ` (${c.email})` : ""} on ${lwStamp(c.at)}${c.ip ? ` from IP ${c.ip}` : ""} on Kappa's signing page, after agreeing to sign electronically.${c.ua ? ` Browser: ${c.ua}.` : ""}`,
      7.5,
      "normal",
      grey,
    );
  }
  write(`${o.ref ? `Document ${o.ref} · ` : ""}Text fingerprint (SHA-256): ${doc.hash}`, 7, "normal", [156, 163, 175]);
  return pdf;
}
const lwPdfBlob = async (doc, o) => lwPdfBuild(await lwLoadPdf(), doc, o).output("blob");
const lwFile = (blob, name) => ({ name, type: "application/pdf", size: blob.size, arrayBuffer: () => (blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer()) });
const lwFileName = (address, party, kind, amount) =>
  `${String(address || "").split(",")[0]} — lien waiver — ${lwName(party)} — ${LW_KINDS[kind].short} ${fmt(num(amount))} — ${todayISO()}.pdf`.replace(/[\\/:*?"<>|]/g, "-");

// ---------- the signing service (an n8n workflow): one endpoint for Deal Breaker ----------
// actions: request {token, to, toName, claimant, deal, subject, link, doc, hash, notify, from} → {ok}
//          remind {token} · void {token} · status {tokens} → {items: [{token, status, signedAt, name, title, email, ip, ua, signature, doc}]}
// The signing page (sign.html) uses <url>-doc?t=… and <url>-sign.
async function lwApi(cfg, action, body) {
  const r = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/json", "X-Kappa-Key": cfg.key || "" }, body: JSON.stringify({ action, ...body }) });
  if (!r.ok) throw new Error(`the signing service answered ${r.status}`);
  const j = await r.json().catch(() => ({}));
  if (j && j.ok === false) throw new Error(j.error || "the signing service refused it");
  return j || {};
}

// ---------- tasks for the Tasks board ----------
function lwTasks(mg, st, t) {
  const L = mg && mg.liens;
  if (!L || !LW_STAGES.includes(st) || !(L.payments || []).length) return [];
  const V = lwView(L);
  const out = [];
  const base = { ck: "liens", note: "", url: "", ut: "", custom: false, carried: false };
  const next = L.payments.find((p) => !p.paidOn);
  L.payments.forEach((p, i) => {
    if (p.paidOn) return;
    const { before, miss } = lwPayNeeds(V, p);
    if (!miss.length) return;
    if (p.planned ? p.planned > addDaysISO(t, 10) : p !== next) return;
    out.push({ ...base, id: "lw-pay-" + p.id, lw: "pay", label: `Lien waivers before payment ${i + 1}: ${miss.length} of ${before.length} not signed`, due: p.planned || "", dueSet: !!p.planned, at: p.planned ? addDaysISO(p.planned, -10) : t });
  });
  // the last payment so far is paid: its unconditional waiver has no next payment to wait for
  const last = L.payments[L.payments.length - 1];
  if (last && last.paidOn && !last.final) {
    const miss = V.filter((r) => r.payment === last.id && r.when === "paid" && !r.ok);
    if (miss.length) out.push({ ...base, id: "lw-paid-" + last.id, lw: "paid", label: `Unconditional lien waiver on payment ${L.payments.length}: not signed yet`, due: "", dueSet: false, at: last.paidOn });
  }
  const fin = L.payments.find((p) => p.final && p.paidOn);
  if (fin) {
    const after = V.filter((r) => r.when === "after");
    const miss = after.filter((r) => !r.ok);
    if (miss.length) out.push({ ...base, id: "lw-final", lw: "final", label: `Final lien waivers: ${miss.length} of ${after.length} not signed`, due: "", dueSet: false, at: fin.paidOn });
  }
  return out;
}

// ---------- the tab ----------
function LienTab({ mgmt, setMgmt, addLog, userEmail, address, cfg, onSaveCfg, upload, removeFile, setActuals, actuals }) {
  const t0 = todayISO();
  const C = cfg || {};
  const esign = !!(C.url && C.key);
  const started = !!mgmt.liens;
  const L = lwOf(mgmt);
  const st = lwState(address);
  const V = lwView(L);
  const parties = L.parties || [];
  const gc = parties.find((p) => p.role === "contractor");
  const partyOf = (id) => parties.find((p) => p.id === id) || { company: "Removed party" };
  const payNo = (id) => L.payments.findIndex((p) => p.id === id) + 1;
  const signer = L.signer || C.signer || null;
  const [preview, setPreview] = useState(null);
  const [paying, setPaying] = useState(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [signerOpen, setSignerOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);
  const uploadFor = useRef(null);
  const finalizing = useRef(new Set());
  const setL = (fn) => setMgmt((mm) => ({ ...mm, liens: { ...lwOf(mm), ...fn(lwOf(mm)) } }));
  const say = (text, bad) => setMsg({ text, bad: !!bad });
  useEffect(() => {
    if (!msg || msg.bad) return;
    const tm = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(tm);
  }, [msg]);

  const start = () => {
    const gcContact = (mgmt.contacts || []).find((c) => c.role === "Contractor" && (c.name || c.company));
    setMgmt((mm) => ({
      ...mm,
      liens: {
        ...lwEmpty(),
        owner: C.owner || "",
        threshold: C.threshold != null && C.threshold !== "" ? num(C.threshold) : LW_THRESHOLD,
        signer: C.signer && C.signer.name ? { ...C.signer } : null,
        parties: gcContact ? [{ id: uid(), role: "contractor", company: gcContact.company || gcContact.name || "", name: gcContact.company ? gcContact.name || "" : "", email: gcContact.email || "", phone: gcContact.phone || "", trade: "" }] : [],
      },
    }));
    addLog("Lien waivers set up");
  };

  // ---------- parties ----------
  const setParty = (id, patch) => setL((cur) => ({ parties: cur.parties.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const addParty = (from) =>
    setL((cur) => ({
      parties: [
        ...cur.parties,
        from
          ? { id: uid(), role: "sub", company: from.company || from.name || "", name: from.company ? from.name || "" : "", email: from.email || "", phone: from.phone || "", trade: "" }
          : { id: uid(), role: cur.parties.some((p) => p.role === "contractor") ? "sub" : "contractor", company: "", name: "", email: "", phone: "", trade: "" },
      ],
    }));
  const used = (id) => (L.waivers || []).some((w) => w.party === id && w.status !== "void") || L.payments.some((p) => (p.subs || []).some((s) => s.party === id));
  const delParty = (id) => setL((cur) => ({ parties: cur.parties.filter((p) => p.id !== id) }));

  // ---------- payments ----------
  const setPay = (id, patch) =>
    setL((cur) => ({ payments: cur.payments.map((p) => (p.id === id ? { ...p, ...patch } : patch.final ? { ...p, final: false } : p)) }));
  const addPay = () =>
    setL((cur) => ({ payments: [...cur.payments, { id: uid(), amount: 0, planned: "", through: "", final: false, paidOn: "", subs: [] }] }));
  const delPay = (id) => {
    if ((L.waivers || []).some((w) => (w.payment === id || w.about === id) && w.status !== "void") && !window.confirm("Waivers were already sent or signed for this payment. Delete the payment anyway? The waivers stay on record.")) return;
    setL((cur) => ({ payments: cur.payments.filter((p) => p.id !== id) }));
  };
  const setSub = (pid, sid, patch) => setL((cur) => ({ payments: cur.payments.map((p) => (p.id === pid ? { ...p, subs: (p.subs || []).map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : p)) }));
  const addSub = (pid) => setL((cur) => ({ payments: cur.payments.map((p) => (p.id === pid ? { ...p, subs: [...(p.subs || []), { id: uid(), party: "", amount: 0 }] } : p)) }));
  const delSub = (pid, sid) => setL((cur) => ({ payments: cur.payments.map((p) => (p.id === pid ? { ...p, subs: (p.subs || []).filter((s) => s.id !== sid) } : p)) }));

  // ---------- sending ----------
  const record = (r, extra) => ({ id: uid(), key: r.key, kind: r.kind, party: r.party, payment: r.payment, about: r.about, amount: r.amount, through: r.through || "", ...extra });
  const sendOne = async (r) => {
    const p = partyOf(r.party);
    if (!esign || !p.email) return false;
    setBusy(r.key);
    try {
      if (r.w && r.w.status === "sent" && !r.changed && r.w.token) {
        await lwApi(C, "remind", { token: r.w.token });
        addLog(`Lien waiver reminder sent to ${lwName(p)} (${p.email})`);
        say(`Reminder sent to ${lwName(p)}`);
        return true;
      }
      const doc = lwDoc(L, r, { address, state: st });
      const token = lwToken();
      const short = String(address || "").split(",")[0];
      await lwApi(C, "request", {
        token,
        to: p.email,
        toName: p.name || lwName(p),
        claimant: lwName(p),
        deal: address,
        subject: `Lien waiver to sign: ${short}, ${fmt(r.amount)}`,
        link: lwSignLink(C.url, token),
        kind: r.kind,
        amount: r.amount,
        doc,
        hash: doc.hash,
        from: signer ? signer.name : "",
        notify: (signer && signer.email) || userEmail || "",
      });
      if (r.w && r.w.status === "sent" && r.w.token) lwApi(C, "void", { token: r.w.token }).catch(() => {});
      setL((cur) => ({
        waivers: [...cur.waivers.map((x) => (x.key === r.key && x.status === "sent" ? { ...x, status: "void" } : x)), record(r, { status: "sent", via: "esign", token, sentAt: new Date().toISOString(), hash: doc.hash })],
      }));
      addLog(`Lien waiver sent to ${lwName(p)} (${p.email}): ${LW_KINDS[r.kind].title}, ${fmt(r.amount)}`);
      return true;
    } catch (e) {
      say(`Couldn't send to ${lwName(p)}: ${e.message}`, true);
      return false;
    } finally {
      setBusy("");
    }
  };
  const sendMissing = async (list) => {
    let n = 0;
    for (const r of list) if (await sendOne(r)) n++;
    if (n) say(`${n} waiver${n === 1 ? "" : "s"} sent for signature`);
  };
  const copyLink = async (w) => {
    const link = lwSignLink(C.url, w.token);
    try {
      await navigator.clipboard.writeText(link);
      say("Signing link copied");
    } catch (e) {
      window.prompt("The signing link:", link);
    }
  };
  const voidW = (r) => {
    if (!r.w) return;
    if (r.w.status === "sent" && esign && r.w.token) lwApi(C, "void", { token: r.w.token }).catch(() => {});
    setL((cur) => ({ waivers: cur.waivers.map((x) => (x.id === r.w.id ? { ...x, status: "void" } : x)) }));
    addLog(`Lien waiver cancelled: ${lwName(partyOf(r.party))}, ${LW_KINDS[r.kind].title}, ${fmt(r.amount)}`);
  };

  // ---------- coming back signed ----------
  const pending = (L.waivers || []).filter((w) => w.status === "sent" && w.via === "esign" && w.token);
  const pendKey = pending.map((w) => w.token).join(",");
  const finalize = async (w, it) => {
    const p = partyOf(w.party);
    const doc = it.doc && it.doc.title ? it.doc : lwDoc(L, w, { address, state: st });
    const claimant = { company: lwName(p), name: it.name || "", title: it.title || "", at: it.signedAt || new Date().toISOString(), sig: it.signature || "", email: it.email || p.email || "", ip: it.ip || "", ua: it.ua || "" };
    const blob = await lwPdfBlob(doc, { claimant, ref: w.token, esign: true });
    const file = await upload(lwFile(blob, lwFileName(address, p, w.kind, w.amount)));
    setL((cur) => ({
      waivers: cur.waivers.map((x) =>
        x.id === w.id ? { ...x, status: "complete", signedAt: claimant.at, signer: { name: claimant.name, title: claimant.title, email: claimant.email, ip: claimant.ip, ua: claimant.ua }, file } : x,
      ),
    }));
    addLog(`Lien waiver signed by ${claimant.name} for ${lwName(p)}: ${LW_KINDS[w.kind].title}, ${fmt(w.amount)}`);
  };
  const poll = async (loud) => {
    if (!esign || !pending.length) return;
    try {
      const res = await lwApi(C, "status", { tokens: pending.map((w) => w.token) });
      let n = 0;
      for (const it of res.items || []) {
        const w = pending.find((x) => x.token === it.token);
        if (!w || it.status !== "signed" || finalizing.current.has(it.token)) continue;
        finalizing.current.add(it.token);
        try {
          await finalize(w, it);
          n++;
        } catch (e) {
          say(`Couldn't file the signed waiver from ${lwName(partyOf(w.party))}: ${e.message}`, true);
        } finally {
          finalizing.current.delete(it.token);
        }
      }
      if (n) say(`${n} signed waiver${n === 1 ? "" : "s"} filed in Drive`);
      else if (loud) say("Nothing new signed yet");
    } catch (e) {
      if (loud) say(`Couldn't reach the signing service: ${e.message}`, true);
    }
  };
  useEffect(() => {
    poll(false);
    const id = setInterval(() => poll(false), 60000);
    return () => clearInterval(id);
  }, [pendKey, esign]);

  // ---------- on paper ----------
  const pickUpload = (r) => {
    uploadFor.current = r;
    if (fileRef.current) fileRef.current.click();
  };
  const onUpload = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    const r = uploadFor.current;
    if (!f || !r) return;
    setBusy(r.key);
    try {
      const file = await upload(f);
      if (r.w && r.w.status === "sent" && esign && r.w.token) lwApi(C, "void", { token: r.w.token }).catch(() => {});
      setL((cur) => ({
        waivers: [...cur.waivers.map((x) => (x.key === r.key && x.status !== "void" ? { ...x, status: "void" } : x)), record(r, { status: "complete", via: "paper", signedAt: new Date().toISOString(), file })],
      }));
      addLog(`Signed lien waiver uploaded for ${lwName(partyOf(r.party))}: ${LW_KINDS[r.kind].title}, ${fmt(r.amount)}`);
      say("Signed copy saved");
    } catch (er) {
      say("Couldn't upload: " + er.message, true);
    } finally {
      setBusy("");
    }
  };
  const download = async (r) => {
    const p = partyOf(r.party);
    try {
      const pdf = lwPdfBuild(await lwLoadPdf(), lwDoc(L, r, { address, state: st }), { claimant: null, claimantCompany: lwName(p), ref: "" });
      pdf.save(lwFileName(address, p, r.kind, r.amount).replace(/\.pdf$/, " (to sign).pdf"));
    } catch (e) {
      say("Couldn't make the PDF: " + e.message, true);
    }
  };

  // ---------- marking a payment paid ----------
  // the Expenses line of a contractor payment: "Contractor: payment 2 — what it covers"
  const ledgerLabel = (p) => {
    const note = String(p.note || "").trim();
    return `${gc ? lwName(gc) : "Contractor"}: payment ${payNo(p.id)}${p.final ? " (final)" : ""}${note ? ` — ${note}` : ""}`;
  };
  // the contractor's unconditional waiver on a progress payment, asked for once it's paid
  const upKey = (p) => (gc ? `up|${gc.id}|${p.id}` : "");
  const upOpen = (p) => !!gc && !p.final && !(L.waivers || []).some((w) => w.key === upKey(p) && w.status !== "void");
  const markPaid = (p, date, toLedger, why, sendUp) => {
    const n = payNo(p.id);
    const note = String(p.note || "").trim();
    setL((cur) => ({ payments: cur.payments.map((x) => (x.id === p.id ? { ...x, paidOn: date, ...(why ? { override: why } : {}) } : x)) }));
    if (toLedger) setActuals((prev) => [...prev, { id: Date.now(), cat: "Rehab / Construction", label: ledgerLabel(p), amount: num(p.amount), date, files: [], lwPay: p.id }]);
    addLog(`Contractor payment ${n} paid ${fmtDate(date)}: ${fmt(num(p.amount))}${note ? ` (${note})` : ""}${why ? `, without ${why}` : ""}`);
    if (sendUp && upOpen(p))
      sendOne({ key: upKey(p), kind: "up", party: gc.id, amount: num(p.amount), through: p.through || date, payment: p.id, about: p.id, when: "paid", w: null, changed: false }).then(
        (ok) => ok && say(`Unconditional waiver on payment ${n} sent to ${lwName(gc)}`),
      );
  };
  // not paid after all: an unconditional waiver still waiting for a signature is withdrawn
  const markUnpaid = (p) => {
    const n = payNo(p.id);
    const w = gc && (L.waivers || []).find((x) => x.key === upKey(p) && x.status === "sent");
    setPay(p.id, { paidOn: "", override: undefined });
    if (w) {
      if (esign && w.token) lwApi(C, "void", { token: w.token }).catch(() => {});
      setL((cur) => ({ waivers: cur.waivers.map((x) => (x.id === w.id ? { ...x, status: "void" } : x)) }));
    }
    addLog(`Contractor payment ${n} marked unpaid${w ? "; its unconditional waiver request was withdrawn" : ""}`);
  };
  // what a payment covers; once it's paid, its Expenses line follows (unless someone retitled that line by hand)
  const setNote = (p, v) => {
    const note = v.trim();
    if (note === String(p.note || "").trim()) return;
    if (p.paidOn) {
      const was = ledgerLabel(p);
      const now = ledgerLabel({ ...p, note });
      setActuals((prev) => prev.map((a) => ((a.lwPay === p.id || (!a.lwPay && a.date === p.paidOn && Math.round(num(a.amount)) === Math.round(num(p.amount)))) && a.label === was ? { ...a, label: now, lwPay: p.id } : a)));
    }
    setPay(p.id, { note });
  };

  // ---------- rendering ----------
  if (!started)
    return (
      <div className="lw">
        <div className="lw-head">
          <h2>Lien waivers</h2>
          <p>Before each payment to the contractor, collect a waiver for the money you are about to pay and for the payment before it, from the contractor and from every sub and supplier it paid. No payment without the paperwork.</p>
        </div>
        <section className="dcard lw-start">
          <b>Not set up for this project yet.</b>
          <span>
            You'll list the contractor, its subs and suppliers, and the payment schedule. Deal Breaker works out which waivers each payment needs{esign ? ", sends them for e-signature" : ""} and keeps the signed copies in Drive.
          </span>
          <button style={btnPrimary()} onClick={start}>
            Set up lien waivers
          </button>
        </section>
      </div>
    );

  const statusOf = (r) => {
    const w = r.w;
    if (r.st === "none") return <span className="lw-st none">Not requested</span>;
    if (r.st === "sent") return <span className={"lw-st sent" + (r.changed ? " bad" : "")}>{r.changed ? `Sent for ${fmt(num(w.amount))}: the amount changed` : `Sent ${fmtDateShort(String(w.sentAt).slice(0, 10))}`}</span>;
    return <span className={"lw-st done" + (r.changed ? " bad" : "")}>{r.changed ? `Signed for ${fmt(num(w.amount))}: the amount changed` : `Signed ${fmtDateShort(String(w.signedAt).slice(0, 10))}${w.via === "paper" ? " (uploaded)" : ""}`}</span>;
  };
  const wRow = (r) => {
    const p = partyOf(r.party);
    const w = r.w;
    const what = r.kind === "uf" ? "the whole project" : r.kind === "cf" ? "final payment" : r.about === r.payment ? "this payment" : `payment ${payNo(r.about)}`;
    const canSend = esign && (r.st === "none" || r.st === "sent" || r.changed);
    return (
      <div key={r.key} className={"lw-w" + (r.ok ? " ok" : "") + (busy === r.key ? " busy" : "")} data-key={r.key}>
        <span className={"lw-kind k-" + r.kind}>{LW_KINDS[r.kind].short}</span>
        <span className="lw-w-who">
          <b>{lwName(p)}</b>
          <em>
            {what}
            {!LW_KINDS[r.kind].final && r.through ? ` · through ${fmtDateShort(r.through)}` : ""}
            {!p.email && esign && !r.ok ? " · no email" : ""}
          </em>
        </span>
        <span className="lw-w-amt">{fmt(r.amount)}</span>
        {statusOf(r)}
        <span className="lw-w-acts">
          {w && w.file && w.file.driveFileId && !r.changed && (
            <a className="lw-a" href={`https://drive.google.com/file/d/${w.file.driveFileId}/view`} target="_blank" rel="noopener noreferrer">
              Open
            </a>
          )}
          {canSend && (
            <button className="lw-a strong" disabled={!p.email || !!busy} title={p.email ? `Email ${p.email} a link to sign` : "Add this party's email first"} onClick={() => sendOne(r)}>
              {r.st === "sent" && !r.changed ? "Remind" : r.st === "none" ? "Send" : "Send again"}
            </button>
          )}
          {r.st === "sent" && !r.changed && w.token && (
            <button className="lw-a" onClick={() => copyLink(w)}>
              Copy link
            </button>
          )}
          <button className="lw-a" onClick={() => setPreview(r)}>
            View
          </button>
          {(!r.ok || r.changed) && (
            <button className="lw-a" onClick={() => pickUpload(r)} title="Upload a copy signed on paper or elsewhere">
              Upload signed
            </button>
          )}
          {w && (
            <button className="lw-a dim" onClick={() => voidW(r)} title="Cancel this waiver: it's kept on record as void">
              Cancel
            </button>
          )}
        </span>
      </div>
    );
  };
  const contactsToAdd = (mgmt.contacts || []).filter((c) => (c.name || c.company) && !parties.some((p) => lwSameEmail(p.email, c.email) || (p.company && p.company === c.company)));
  const subsChoices = parties.filter((p) => p.role !== "contractor");
  const nextPay = L.payments.find((p) => !p.paidOn);
  const finalPaid = L.payments.find((p) => p.final && p.paidOn);
  const after = V.filter((r) => r.when === "after");

  return (
    <div className="lw">
      <div className="lw-head">
        <div>
          <h2>Lien waivers</h2>
          <p>
            Each payment to the contractor needs its waivers signed first: the contractor's conditional waiver on this payment, and unconditional ones on the payment before it from the contractor and from every sub and supplier it paid. Once a payment
            is made, the contractor signs its unconditional waiver on it.
          </p>
        </div>
        <div className="lw-head-r">
          {nextPay &&
            (() => {
              const { before, miss } = lwPayNeeds(V, nextPay);
              return (
                <span className={"lw-pill " + (miss.length ? "warn" : "ok")}>
                  Payment {payNo(nextPay.id)}: {miss.length ? `${miss.length} of ${before.length} waivers missing` : "ready to pay"}
                </span>
              );
            })()}
          {esign && pending.length > 0 && (
            <button style={btnGhost()} onClick={() => poll(true)}>
              Check for signatures
            </button>
          )}
        </div>
      </div>
      {msg && (
        <div className={"lw-msg" + (msg.bad ? " bad" : "")} role="status">
          {msg.text}
          <button className="link-btn" onClick={() => setMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="dcard lw-setup">
        <label className="lw-f wide">
          <span>Owner of record (LLC)</span>
          <FinText className="lw-in" value={L.owner || ""} onCommit={(v) => setL(() => ({ owner: v.trim() }))} placeholder="The LLC on the deed" aria-label="Owner of record" />
        </label>
        <label className="lw-f">
          <span>County</span>
          <FinText className="lw-in" value={L.county || ""} onCommit={(v) => setL(() => ({ county: v.trim() }))} placeholder={st === "IN" ? "e.g. Marion" : "e.g. Cuyahoga"} aria-label="County" />
        </label>
        <div className="lw-f">
          <span title="Subs and suppliers paid at least this much from a payment sign a waiver for it">Waivers from subs paid at least</span>
          <FinNum value={num(L.threshold)} onCommit={(v) => setL(() => ({ threshold: Math.max(0, Math.round(v)) }))} prefix="$" label="Threshold" />
        </div>
        <div className="lw-f">
          <span title="Named in the emails asking to sign, and told when a waiver is signed">Sent by</span>
          <span className="lw-signer">
            <b>{signer ? signer.name : "Nobody set"}</b>
            <button className="link-btn" onClick={() => setSignerOpen(true)}>
              {signer ? "Change" : "Set"}
            </button>
          </span>
        </div>
        <div className="lw-f">
          <span>E-signature</span>
          <span className={"lw-esign " + (esign ? "on" : "off")}>{esign ? "On: sent by email" : "Not connected: print and upload"}</span>
          <button className="link-btn" onClick={() => setCfgOpen(true)}>
            Team settings
          </button>
        </div>
      </section>

      <section className="dcard lw-card">
        <div className="lw-card-h">
          <div>
            <h3>Who can file a lien</h3>
            <p>The general contractor, and every sub and supplier it pays on credit. Not needed: purchases paid on the spot, like Home Depot.</p>
          </div>
          <div className="lw-card-acts">
            {contactsToAdd.length > 0 && (
              <select className="lw-sel" value="" onChange={(e) => e.target.value !== "" && addParty(contactsToAdd[Number(e.target.value)])} aria-label="Add from contacts">
                <option value="">Add from contacts…</option>
                {contactsToAdd.map((c, i) => (
                  <option key={i} value={i}>
                    {c.company || c.name} ({c.role})
                  </option>
                ))}
              </select>
            )}
            <button style={btnGhost()} onClick={() => addParty(null)}>
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
        </div>
        {parties.length ? (
          <div className="lw-parties">
            <div className="lw-ph">
              <span>Role</span>
              <span>Company</span>
              <span>Contact</span>
              <span>Email</span>
              <span>Trade</span>
              <span />
            </div>
            {parties.map((p) => (
              <div key={p.id} className="lw-pr" data-party={p.id}>
                <select value={p.role} onChange={(e) => setParty(p.id, { role: e.target.value })} aria-label="Role">
                  {LW_ROLES.map(([v, l]) => (
                    <option key={v} value={v} disabled={v === "contractor" && !!gc && gc.id !== p.id}>
                      {l}
                    </option>
                  ))}
                </select>
                <FinText className="lw-in" value={p.company || ""} onCommit={(v) => setParty(p.id, { company: v.trim() })} placeholder="Company" aria-label="Company" />
                <FinText className="lw-in" value={p.name || ""} onCommit={(v) => setParty(p.id, { name: v.trim() })} placeholder="Name" aria-label="Contact name" />
                <FinText className="lw-in" value={p.email || ""} onCommit={(v) => setParty(p.id, { email: v.trim() })} placeholder="Email" aria-label="Email" />
                <FinText className="lw-in" value={p.trade || ""} onCommit={(v) => setParty(p.id, { trade: v.trim() })} placeholder="e.g. Electrical" aria-label="Trade" />
                <button className="lw-x" title={used(p.id) ? "Has payments or waivers: can't be removed" : "Remove"} disabled={used(p.id)} onClick={() => delParty(p.id)} aria-label="Remove party">
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="lw-empty">Add the general contractor first.</p>
        )}
      </section>

      <section className="dcard lw-card">
        <div className="lw-card-h">
          <div>
            <h3>Payments to the contractor</h3>
            <p>In order. For each payment, list who the contractor paid from it: they waive before the next one.</p>
          </div>
          <div className="lw-card-acts">
            <button style={btnGhost()} onClick={addPay}>
              <Icon name="plus" size={14} /> Payment
            </button>
          </div>
        </div>
        {!gc && <p className="lw-empty">Add the general contractor above to see which waivers each payment needs.</p>}
        {L.payments.map((p, i) => {
          const { before, miss } = lwPayNeeds(V, p);
          const toSend = miss.filter((r) => esign && partyOf(r.party).email && (r.st === "none" || r.changed));
          const paidRows = V.filter((r) => r.payment === p.id && r.when === "paid");
          return (
            <div key={p.id} className={"lw-pay" + (p.paidOn ? " paid" : "")} data-pay={p.id}>
              <div className="lw-pay-h">
                <b>
                  Payment {i + 1}
                  {p.final ? " (final)" : ""}
                </b>
                <label className="lw-f inline">
                  <span>Amount</span>
                  <FinNum value={num(p.amount)} onCommit={(v) => setPay(p.id, { amount: Math.max(0, v) })} prefix="$" label="Payment amount" />
                </label>
                <label className="lw-f inline">
                  <span>Planned</span>
                  <input type="date" value={p.planned || ""} onChange={(e) => setPay(p.id, { planned: e.target.value })} aria-label="Planned date" />
                </label>
                <label className="lw-f inline">
                  <span>Work through</span>
                  <input type="date" value={p.through || ""} onChange={(e) => setPay(p.id, { through: e.target.value })} aria-label="Work through" />
                </label>
                <label className="lw-check">
                  <input type="checkbox" checked={!!p.final} onChange={(e) => setPay(p.id, { final: e.target.checked })} aria-label="Final payment" /> Final
                </label>
                <span className="lw-pay-st">
                  {p.paidOn ? (
                    <span className="lw-pill ok">
                      Paid {fmtDateShort(p.paidOn)}
                      {p.override ? " · without all waivers" : ""}
                    </span>
                  ) : before.length ? (
                    <span className={"lw-pill " + (miss.length ? "warn" : "ok")}>{miss.length ? `${miss.length} of ${before.length} missing` : "Ready to pay"}</span>
                  ) : null}
                </span>
                <button className="lw-x" onClick={() => delPay(p.id)} title="Delete this payment" aria-label="Delete payment">
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <label className="lw-f inline lw-pay-note">
                <span>What it covers</span>
                <FinText value={p.note || ""} onCommit={(v) => setNote(p, v)} placeholder="e.g. Demo, framing and rough plumbing" aria-label="What this payment covers" />
              </label>
              {before.length > 0 && (
                <div className="lw-ws">
                  <div className="lw-sub-h">Before paying it</div>
                  {before.map(wRow)}
                </div>
              )}
              {paidRows.length > 0 && (
                <div className="lw-ws">
                  <div className="lw-sub-h">After paying it</div>
                  {paidRows.map(wRow)}
                </div>
              )}
              {subsChoices.length > 0 && (
                <div className="lw-subs">
                  <div className="lw-sub-h">The contractor paid from it</div>
                  {(p.subs || []).map((s) => (
                    <div key={s.id} className="lw-subrow">
                      <select value={s.party || ""} onChange={(e) => setSub(p.id, s.id, { party: e.target.value })} aria-label="Paid to">
                        <option value="">Who…</option>
                        {subsChoices.map((x) => (
                          <option key={x.id} value={x.id}>
                            {lwName(x)}
                            {x.trade ? ` (${x.trade})` : ""}
                          </option>
                        ))}
                      </select>
                      <FinNum value={num(s.amount)} onCommit={(v) => setSub(p.id, s.id, { amount: Math.max(0, v) })} prefix="$" label="Amount paid to them" />
                      {s.party && num(s.amount) > 0 && num(s.amount) < num(L.threshold) && <em className="lw-hint">under {fmt(num(L.threshold))}: no waiver needed</em>}
                      <button className="lw-x" onClick={() => delSub(p.id, s.id)} aria-label="Remove">
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ))}
                  <button className="link-btn lw-addsub" onClick={() => addSub(p.id)}>
                    <Icon name="plus" size={12} /> Sub or supplier paid from payment {i + 1}
                  </button>
                </div>
              )}
              <div className="lw-pay-f">
                {!p.paidOn && toSend.length > 0 && (
                  <button style={btnGhost()} disabled={!!busy} onClick={() => sendMissing(toSend)}>
                    Send the {toSend.length} missing for signature
                  </button>
                )}
                {p.paidOn ? (
                  <button className="link-btn" onClick={() => markUnpaid(p)}>
                    Mark unpaid
                  </button>
                ) : (
                  <button style={miss.length ? btnGhost() : btnPrimary()} disabled={!(num(p.amount) > 0)} onClick={() => setPaying(p.id)}>
                    Mark paid…
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!L.payments.length && gc && <p className="lw-empty">Add the payments from the contractor's contract: the amount and the planned date of each.</p>}
        {finalPaid && after.length > 0 && (
          <div className="lw-pay lw-close">
            <div className="lw-pay-h">
              <b>After the final payment</b>
              <span className="lw-pay-st">
                <span className={"lw-pill " + (after.every((r) => r.ok) ? "ok" : "warn")}>
                  {after.filter((r) => r.ok).length} of {after.length} signed
                </span>
              </span>
            </div>
            <div className="lw-ws">{after.map(wRow)}</div>
            <div className="lw-pay-f">
              {esign && after.filter((r) => !r.ok && partyOf(r.party).email && (r.st === "none" || r.changed)).length > 0 && (
                <button style={btnGhost()} disabled={!!busy} onClick={() => sendMissing(after.filter((r) => !r.ok && partyOf(r.party).email && (r.st === "none" || r.changed)))}>
                  Send the final waivers for signature
                </button>
              )}
            </div>
          </div>
        )}
      </section>
      <p className="lw-note">The waiver wording is Kappa's own draft: Indiana and Ohio have no required form. Have an attorney or the title company review it before relying on it.</p>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={onUpload} aria-label="Signed waiver file" />

      {preview && <LienPreview L={L} r={preview} address={address} state={st} party={partyOf(preview.party)} onDownload={() => download(preview)} onClose={() => setPreview(null)} />}
      {paying &&
        (() => {
          const p = L.payments.find((x) => x.id === paying);
          if (!p) return null;
          return (
            <LienPaidWindow
              p={p}
              n={payNo(p.id)}
              miss={lwPayNeeds(V, p).miss}
              partyOf={partyOf}
              actuals={actuals}
              upTo={esign && upOpen(p) && gc.email ? gc : null}
              onPaid={(date, toLedger, why, sendUp) => (markPaid(p, date, toLedger, why, sendUp), setPaying(null))}
              onClose={() => setPaying(null)}
            />
          );
        })()}
      {signerOpen && (
        <LienSignerWindow
          cur={signer}
          team={C.signer || null}
          userEmail={userEmail}
          onSave={(s, asTeam) => {
            setL(() => ({ signer: s }));
            if (asTeam) onSaveCfg({ ...C, signer: s });
            addLog(`Lien waivers sent by: ${s ? s.name : "nobody"}`);
            setSignerOpen(false);
          }}
          onClose={() => setSignerOpen(false)}
        />
      )}
      {cfgOpen && (
        <LienCfgWindow
          cfg={C}
          onSave={(c) => {
            onSaveCfg(c);
            setCfgOpen(false);
          }}
          onClose={() => setCfgOpen(false)}
        />
      )}
    </div>
  );
}

function LienPreview({ L, r, address, state, party, onDownload, onClose }) {
  const doc = r.w && r.w.status !== "void" && r.w.hash && r.w.hash !== lwDoc(L, r, { address, state }).hash ? lwDoc(L, r, { address, state }) : lwDoc(L, r, { address, state });
  return (
    <Modal kicker={`${lwName(party)} · ${fmt(r.amount)}`} title="Lien waiver" width={680} onClose={onClose}>
      <div className="lw-doc" data-hash={doc.hash}>
        {window._KAPPA_LOGO && <img className="lw-doc-logo" src={window._KAPPA_LOGO} alt="Kappa Real Estate Investments" />}
        <h4>{doc.title}</h4>
        <p className="lw-doc-n">{doc.notice}</p>
        <dl>
          {doc.fields.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        {doc.paras.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="lw-doc-sig">
          <span>Claimant: {lwName(party)}</span>
          <span>By ______________________ Name ______________ Title ______________ Date ________</span>
        </div>
      </div>
      <div className="lw-win-f">
        <button style={btnGhost()} onClick={onDownload}>
          <Icon name="download" size={14} /> PDF to sign on paper
        </button>
        <button style={btnPrimary()} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function LienPaidWindow({ p, n, miss, partyOf, actuals, upTo, onPaid, onClose }) {
  const [date, setDate] = useState(p.planned && p.planned <= todayISO() ? p.planned : todayISO());
  const dup = (actuals || []).some((a) => Math.round(num(a.amount)) === Math.round(num(p.amount)) && a.date && Math.abs(daysBetween(a.date, date) || 0) <= 10);
  const [toLedger, setToLedger] = useState(!dup);
  const [sendUp, setSendUp] = useState(!!upTo);
  const [anyway, setAnyway] = useState(false);
  const ok = !miss.length || anyway;
  return (
    <Modal kicker={`${fmt(num(p.amount))}`} title={`Mark payment ${n} paid`} width={520} onClose={onClose}>
      {miss.length > 0 && (
        <div className="lw-warn" role="alert">
          <b>
            {miss.length} waiver{miss.length === 1 ? " isn't" : "s aren't"} signed yet:
          </b>
          <ul>
            {miss.map((r) => (
              <li key={r.key}>
                {lwName(partyOf(r.party))}: {LW_KINDS[r.kind].short.toLowerCase()}, {fmt(r.amount)}
                {r.changed ? " (amount changed)" : ""}
              </li>
            ))}
          </ul>
          <label className="lw-check">
            <input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} /> Pay without them: I accept the lien risk
          </label>
        </div>
      )}
      {p.note ? <p className="lw-hint">For: {p.note}</p> : null}
      <label className="lw-f">
        <span>Paid on</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Paid on" />
      </label>
      <label className="lw-check">
        <input type="checkbox" checked={toLedger} onChange={(e) => setToLedger(e.target.checked)} /> Add it to Expenses (Rehab / Construction)
      </label>
      {dup && <p className="lw-hint">Expenses already has {fmt(num(p.amount))} within 10 days of that date, so it's left unticked.</p>}
      {upTo && (
        <>
          <label className="lw-check">
            <input type="checkbox" checked={sendUp} onChange={(e) => setSendUp(e.target.checked)} /> Email {lwName(upTo)} the unconditional waiver on this payment now
          </label>
          <p className="lw-hint">The contractor signs it once the money arrives. The next payment needs it too.</p>
        </>
      )}
      <div className="lw-win-f">
        <button style={btnGhost()} onClick={onClose}>
          Cancel
        </button>
        <button style={btnPrimary()} disabled={!ok} onClick={() => onPaid(date, toLedger, miss.length ? `${miss.length} waiver${miss.length === 1 ? "" : "s"}` : "", !!upTo && sendUp)}>
          Mark paid
        </button>
      </div>
    </Modal>
  );
}

function LienSignerWindow({ cur, team, userEmail, onSave, onClose }) {
  const [s, setS] = useState({ name: "", title: "", email: "", ...(cur || team || {}) });
  const [asTeam, setAsTeam] = useState(!team);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  return (
    <Modal kicker="Lien waivers" title="Who the waivers are sent by" width={500} onClose={onClose}>
      <p className="lw-hint">Their name is in the emails asking to sign, replies go to their email, and they're emailed when a waiver is signed.</p>
      <label className="lw-f">
        <span>Name</span>
        <input value={s.name} onChange={set("name")} aria-label="Signer name" autoFocus />
      </label>
      <label className="lw-f">
        <span>Email</span>
        <input value={s.email} onChange={set("email")} placeholder={userEmail || ""} aria-label="Signer email" />
      </label>
      <label className="lw-check">
        <input type="checkbox" checked={asTeam} onChange={(e) => setAsTeam(e.target.checked)} /> Make this the team's default for new projects
      </label>
      <div className="lw-win-f">
        {team && team.name && (!cur || cur.name !== team.name) && (
          <button className="link-btn" onClick={() => onSave({ ...team }, false)}>
            Use the team default ({team.name})
          </button>
        )}
        <button style={btnGhost()} onClick={onClose}>
          Cancel
        </button>
        <button style={btnPrimary()} disabled={!s.name.trim()} onClick={() => onSave({ name: s.name.trim(), email: s.email.trim() }, asTeam)}>
          Save
        </button>
      </div>
    </Modal>
  );
}

function LienCfgWindow({ cfg, onSave, onClose }) {
  const [c, setC] = useState({ url: "", key: "", owner: "", threshold: LW_THRESHOLD, ...cfg });
  const set = (k) => (e) => setC({ ...c, [k]: e.target.value });
  return (
    <Modal kicker="Lien waivers" title="Team settings" width={560} onClose={onClose}>
      <p className="lw-hint">Shared with everyone on the Kappa team through the team settings file in the deals folder.</p>
      <label className="lw-f">
        <span>Default owner of record (LLC)</span>
        <input value={c.owner || ""} onChange={set("owner")} aria-label="Default owner" />
      </label>
      <div className="lw-f2">
        <label className="lw-f">
          <span>Waivers from subs paid at least ($)</span>
          <input inputMode="numeric" value={c.threshold} onChange={set("threshold")} aria-label="Default threshold" />
        </label>
      </div>
      <div className="lw-cfg-svc">
        <b>E-signature service (n8n)</b>
        <span>The workflow that emails the signing links and keeps the signatures. Until it's set, waivers are printed, signed on paper and uploaded.</span>
        <label className="lw-f">
          <span>Webhook URL</span>
          <input value={c.url || ""} onChange={set("url")} placeholder="https://….app.n8n.cloud/webhook/kappa-lien-waivers" aria-label="Webhook URL" />
        </label>
        <label className="lw-f">
          <span>Access key</span>
          <span className="lw-keyrow">
            <input value={c.key || ""} onChange={set("key")} aria-label="Access key" />
            <button className="link-btn" onClick={() => setC({ ...c, key: lwToken() })}>
              New key
            </button>
          </span>
        </label>
      </div>
      <div className="lw-win-f">
        <button style={btnGhost()} onClick={onClose}>
          Cancel
        </button>
        <button
          style={btnPrimary()}
          onClick={() => onSave({ ...c, url: String(c.url || "").trim(), key: String(c.key || "").trim(), owner: String(c.owner || "").trim(), threshold: Math.max(0, Math.round(num(c.threshold))) })}
        >
          Save for the team
        </button>
      </div>
    </Modal>
  );
}
