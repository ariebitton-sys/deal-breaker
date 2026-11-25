// ============================================================================
// v26 — PIPELINE CORE: stages, deal model helpers, summaries, Drive & Claude
// ============================================================================

// ---------- small utils ----------
const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => isoOf(new Date());
const parseISO = (s) => {
  if (!s || typeof s !== "string") return null;
  const [y, mo, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d);
};
const daysBetween = (a, b) => {
  const A = parseISO(a),
    B = parseISO(b);
  if (!A || !B) return null;
  return Math.round((B - A) / 86400000);
};
const monthsBetween = (a, b) => {
  const d = daysBetween(a, b);
  return d == null ? null : d / 30.4375;
};
const addDaysISO = (s, n) => {
  const d = parseISO(s);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const addMonthsISO = (s, n) => {
  const d = parseISO(s);
  if (!d) return "";
  const whole = Math.floor(n);
  const t = new Date(d.getFullYear(), d.getMonth() + whole, d.getDate());
  t.setDate(t.getDate() + Math.round((n - whole) * 30.4375));
  return isoOf(t);
};
// Dates read MM/DD/YYYY everywhere (MM/DD in compact rows)
const fmtDate = (s) => {
  const d = parseISO(s);
  return d ? `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}` : "—";
};
const fmtDateShort = (s) => {
  const d = parseISO(s);
  return d ? `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}` : "—";
};
const fmtTs = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return "";
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}, ` + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
const relDays = (n) => {
  if (n == null) return "";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const numId = (() => {
  let last = 0;
  return () => {
    const n = Math.max(Date.now(), last + 1);
    last = n;
    return n;
  };
})();
const R0 = (n) => (Number.isFinite(n) ? Math.round(n) : undefined);
const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const setIn = (obj, path, val) => {
  const keys = path.split(".");
  const out = { ...obj };
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] || {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = val;
  return out;
};
const nameOnly = (email) => (email ? String(email).split("@")[0] : "");
const fileNameFor = (address) => address.trim().replace(/[\/\\:*?"<>|]/g, "_") + ".json";
const splitAddress = (name) => {
  const s = (name || "").replace(/\.json$/, "");
  const i = s.indexOf(",");
  return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : [s, ""];
};

// ---------- stages ----------
const STAGES = [
  // one blue-violet ramp, light to deep, so a stage never borrows a semantic color (emerald / amber / crimson)
  { key: "analyzing", label: "Analyzing", color: "#94A3B8", dateLabel: "Analyzed" },
  { key: "contract", label: "Under contract", color: "#818CF8", dateLabel: "Contract" },
  { key: "rehab", label: "Rehab", color: "#6366F1", dateLabel: "Closed" },
  { key: "market", label: "On market", color: "#4F46E5", dateLabel: "Listed" },
  { key: "sold", label: "Sold", color: "#312E81", dateLabel: "Sold" },
];
const DEAD_STAGE = { key: "dead", label: "Dead", color: "#D1D5DB", dateLabel: "Dead" };
const stageIdx = (k) => STAGES.findIndex((s) => s.key === k);
const stageMeta = (k) => STAGES.find((s) => s.key === k) || DEAD_STAGE;
const ACTIVE_STAGES = ["contract", "rehab", "market"];
const DEAL_SOURCES = ["MLS", "Wholesaler", "Off-market / direct", "Agent", "Auction", "Facebook group", "Probate", "Other"];
const OFFER_STATUSES = ["Sent", "Countered", "Accepted", "Rejected", "Withdrawn"];
const DEAD_REASONS = [
  "Numbers don't work",
  "Offer rejected / outbid",
  "Inspection issues",
  "Title issues",
  "Financing fell through",
  "Seller backed out",
  "Other",
];
const CONTACT_ROLES = [
  "Title company",
  "Lender",
  "Seller's agent",
  "Listing agent",
  "Buyer's agent",
  "Contractor",
  "Inspector",
  "Insurance",
  "Investor",
  "Other",
];
const BUYER_FINANCING = ["Cash", "Conventional", "FHA", "VA", "Hard money", "Other"];
const DEFAULT_MILESTONES = [
  "Demo & cleanout",
  "Roof & exterior",
  "Rough-ins (plumbing / electric / HVAC)",
  "Permits & inspections",
  "Drywall",
  "Kitchen",
  "Bathrooms",
  "Flooring",
  "Paint",
  "Fixtures & finishes",
  "Landscaping",
  "Final clean & punch list",
];
const CHECKLIST_TEMPLATES = {
  contract: [
    "EMD deposited",
    "Inspection scheduled",
    "Inspection completed",
    "Title ordered",
    "Title commitment reviewed",
    "Lender approval / appraisal",
    "Investor funds confirmed",
    "Insurance bound",
    "Final walkthrough",
    "Closing funds wired",
  ],
  rehab: ["Utilities transferred", "Locks changed / lockbox", "Contractor agreement signed", "Permits pulled", "Before photos taken"],
  market: ["Listing agent signed", "Professional photos", "Listing live on MLS", "Disclosures prepared"],
};
// ---------- project manager fee and its installments ----------
const pmFeeOf = (pm, repair) => {
  if (!pm) return 0;
  const v = Math.max(0, parseFloat(pm.val) || 0);
  return pm.type === "flat" ? v : ((repair || 0) * v) / 100;
};
// when an installment falls due: a step of the flip
const PM_WHEN = [
  ["closing", "At the purchase closing"],
  ["rehabStart", "When the rehab starts"],
  ["rehabDone", "When the rehab is done"],
  ["listed", "When it's listed"],
  ["sold", "At the sale"],
];
const pmWhenLabel = (w) => (PM_WHEN.find((x) => x[0] === w) || [w, w])[1];
const PM_DEFAULT_PLAN = () => [
  { id: "pm1", when: "rehabStart", pct: 40 },
  { id: "pm2", when: "rehabDone", pct: 40 },
  { id: "pm3", when: "sold", pct: 20 },
];
const pmDueDate = (mg, when) =>
  ({
    closing: mg.closing.date,
    rehabStart: mg.rehab.startDate,
    rehabDone: mg.rehab.endDate,
    listed: mg.listing.date,
    sold: mg.sale.date,
  })[when] || "";
// each installment: its share of the fee, when it's due, and the ledger entry that paid it
function pmPlan(mg, actuals, fee, today) {
  const t = today || todayISO();
  const list = (mg.pm && mg.pm.installments) || [];
  const rows = list.map((inst, i) => {
    const amount = Math.round((fee * (parseFloat(inst.pct) || 0)) / 100);
    const paid = (actuals || []).find((a) => a.tag === "pm_fee" && a.pmInst === inst.id) || null;
    const due = pmDueDate(mg, inst.when);
    const status = paid ? "paid" : due && due <= t ? "due" : "later";
    return { inst, i, amount, due, paid, status };
  });
  const paidTotal = (actuals || []).filter((a) => a.tag === "pm_fee").reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const dueTotal = rows.filter((r) => r.status === "due").reduce((s, r) => s + r.amount, 0);
  const pctTotal = list.reduce((s, x) => s + (parseFloat(x.pct) || 0), 0);
  return { rows, paidTotal, dueTotal, pctTotal };
}

// ---------- rehab clock ----------
// Rehab time runs from the day work actually starts. The days between the purchase closing and that
// start are measured on their own and are not rehab time (they are hold time).
function rehabClock(mg, today) {
  const t = today || todayISO();
  const cd = mg.closing.date,
    st = mg.rehab.startDate;
  const gap = cd ? daysBetween(cd, st || t) : null;
  const day = st ? daysBetween(st, mg.rehab.endDate || t) : null;
  const plan = st && mg.rehab.targetEnd ? daysBetween(st, mg.rehab.targetEnd) : null;
  return { waiting: !st, gap: gap != null ? Math.max(0, gap) : null, day: day != null ? Math.max(0, day) : null, plan };
}
const mkItems = (labels) => labels.map((label) => ({ id: uid(), label, done: false }));
const emptyMgmt = () => ({
  source: "",
  offers: [],
  contract: { date: "", price: 0, expectedClosing: "", inspectionEnd: "", emd: 0 },
  closing: { date: "", price: 0 },
  rehab: {
    startDate: "",
    targetEnd: "",
    endDate: "",
    milestones: DEFAULT_MILESTONES.map((label) => ({ id: uid(), label, status: "todo" })),
  },
  draws: [],
  listing: { date: "", price: 0, agent: "", prices: [], offers: [] },
  buyer: { date: "", price: 0, expectedClosing: "", financing: "", inspectionEnd: "" },
  sale: { date: "" },
  dead: null,
  checklists: {
    contract: mkItems(CHECKLIST_TEMPLATES.contract),
    rehab: mkItems(CHECKLIST_TEMPLATES.rehab),
    market: mkItems(CHECKLIST_TEMPLATES.market),
  },
  contacts: [],
  docs: [],
  log: [],
  lessons: "",
  analyses: [],
  utilities: null,
  pm: { installments: PM_DEFAULT_PLAN() },
});
function mergeMgmt(x) {
  const e = emptyMgmt();
  if (!x || typeof x !== "object") return e;
  const o = (k) => ({ ...e[k], ...(x[k] || {}) });
  return {
    ...e,
    ...x,
    contract: o("contract"),
    closing: o("closing"),
    rehab: { ...o("rehab"), milestones: Array.isArray(x.rehab && x.rehab.milestones) ? x.rehab.milestones : e.rehab.milestones },
    listing: {
      ...o("listing"),
      prices: (x.listing && x.listing.prices) || [],
      offers: (x.listing && x.listing.offers) || [],
    },
    buyer: o("buyer"),
    sale: o("sale"),
    checklists: { ...e.checklists, ...(x.checklists || {}) },
    offers: x.offers || [],
    draws: x.draws || [],
    contacts: x.contacts || [],
    docs: x.docs || [],
    log: x.log || [],
    lessons: x.lessons || "",
    analyses: Array.isArray(x.analyses) ? x.analyses : [],
    credits: Array.isArray(x.credits) ? x.credits : [],
    pm: x.pm && Array.isArray(x.pm.installments) ? x.pm : e.pm,
    utilities: x.utilities && Array.isArray(x.utilities.items) ? x.utilities : null,
    dead: x.dead || null,
  };
}
// Deals saved before v26 have no stage — infer one from what they hold.
const inferStage = (d) => {
  if (d && d.stage) return d.stage;
  if (d && d.actualSale > 0) return "sold";
  if (d && d.acquired) return "rehab";
  return "analyzing";
};
// % of rehab work done. When every milestone has a budget (e.g. from a SOW), weight by budget so
// it compares like-for-like with "% of budget spent"; otherwise every milestone counts the same.
const milestonePct = (ms) => {
  if (!ms || !ms.length) return null;
  const w = (x) => (x.status === "done" ? 1 : x.status === "doing" ? 0.5 : 0);
  const weighted = ms.every((x) => Number(x.budget) > 0);
  if (weighted) {
    const tot = ms.reduce((s, x) => s + Number(x.budget), 0);
    return Math.round((ms.reduce((s, x) => s + w(x) * Number(x.budget), 0) / tot) * 100);
  }
  return Math.round((ms.reduce((s, x) => s + w(x), 0) / ms.length) * 100);
};
const milestonesWeighted = (ms) => !!ms && ms.length > 0 && ms.every((x) => Number(x.budget) > 0);

// ---------- defaults & pure deal inputs ----------
const DEFAULT_BUY_TXN = () => dTxn({ escrow: { on: true, val: 1200 }, transfer: { on: true, val: 0.45 } });
const DEFAULT_SELL_TXN = () =>
  dTxn({ escrow: { on: true, val: 1500 }, realtor: { on: true, val: 6 }, transfer: { on: true, val: 0.4 }, staging: { on: true, val: 1500 } });
const DEFAULTS = {
  loanOnPurchasePct: 0.8,
  loanOnRehabPct: 1.0,
  intRatePurchase: 0.18,
  intRateRehab: 0.16,
  points: 0,
  investorAuto: true,
  investorRate: 0.09,
  investorAmount: 0,
  taxAnnual: 0,
  insMonthly: 120,
  utilGas: 75,
  utilWater: 75,
  utilElec: 50,
  hoaMonthly: 0,
  miscHold: 0,
  rehabFunding: "internal",
  purchaseLender: "lender",
  drawCount: 4,
  drawMonths: 3,
  drawFee: 0,
  // project manager: a % of the rehab estimate or a fixed amount; paid out of pocket, no interest
  pm: { type: "pct", val: 0 },
};
const repairTotalOf = (d) => {
  if (!d.useRepairBuilder) return d.manualRepair || 0;
  return (d.repairs || DEFAULT_REPAIRS).reduce((s, r) => s + (r.lump ? (r.qty > 0 ? r.price : 0) : r.qty * r.price), 0);
};
function inputsFromState(d) {
  const g = (k) => (d[k] !== undefined && d[k] !== null ? d[k] : DEFAULTS[k]);
  return {
    arv: d.arv || 0,
    purchase: d.purchase || 0,
    repair: repairTotalOf(d),
    holdMonths: d.holdMonths || 0,
    loanOnPurchasePct: g("loanOnPurchasePct"),
    loanOnRehabPct: g("loanOnRehabPct"),
    intRatePurchase: d.intRatePurchase !== undefined ? d.intRatePurchase : d.intRate !== undefined ? d.intRate : DEFAULTS.intRatePurchase,
    intRateRehab: d.intRateRehab !== undefined ? d.intRateRehab : d.intRate !== undefined ? d.intRate : DEFAULTS.intRateRehab,
    points: g("points"),
    investorAmount: g("investorAmount"),
    investorAuto: g("investorAuto"),
    investorRate: g("investorRate"),
    taxAnnual: g("taxAnnual"),
    insMonthly: g("insMonthly"),
    hoaMonthly: g("hoaMonthly"),
    utilGas: g("utilGas"),
    utilWater: g("utilWater"),
    utilElec: g("utilElec"),
    miscHold: g("miscHold"),
    buyTxn: d.buyTxn || DEFAULT_BUY_TXN(),
    sellTxn: d.sellTxn || DEFAULT_SELL_TXN(),
    sqft: d.sqft || 0,
    rehabFunding: g("rehabFunding"),
    purchaseLender: g("purchaseLender"),
    drawCount: g("drawCount"),
    drawMonths: g("drawMonths"),
    drawFee: g("drawFee"),
    pm: d.pm && typeof d.pm === "object" ? d.pm : DEFAULTS.pm,
  };
}

// ---------- grading (pure; App and summaries share it) ----------
// The deal's forecast scenario (Forecast tab) once scenarios are saved, while the deal is between contract and
// sale: its rehab total and project-management fee are the budget from then on.
function forecastScenario(mg, st) {
  if (!mg || !Array.isArray(mg.scenarios) || !mg.scenarios.length || !["contract", "rehab", "market"].includes(st)) return null;
  return mg.scenarios.find((x) => x.main) || mg.scenarios[0];
}
function gradeDeal({ repair, holdMonths, netProfit, purchase, arv }) {
  const r = repair || 0,
    h = holdMonths || 0,
    p = netProfit;
  let rehabLvl;
  if (r < 20000) rehabLvl = 1;
  else if (r <= 50000) rehabLvl = 2;
  else if (r <= 100000) rehabLvl = 3;
  else if (r <= 175000) rehabLvl = 4;
  else rehabLvl = 5;
  let holdLvl;
  if (h <= 3) holdLvl = 1;
  else if (h <= 4) holdLvl = 2;
  else if (h <= 6) holdLvl = 3;
  else if (h <= 9) holdLvl = 4;
  else holdLvl = 5;
  const riskLevel = Math.max(rehabLvl, holdLvl);
  const TARGETS = [20000, 30000, 40000, 55000, 75000];
  const target = TARGETS[riskLevel - 1];
  const ratio = p / target;
  const LADDER = ["Reject", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
  let idx;
  if (ratio >= 1.6) idx = 9;
  else if (ratio >= 1.4) idx = 8;
  else if (ratio >= 1.25) idx = 7;
  else if (ratio >= 1.1) idx = 6;
  else if (ratio >= 1.0) idx = 5;
  else if (ratio >= 0.9) idx = 4;
  else if (ratio >= 0.8) idx = 3;
  else if (ratio >= 0.7) idx = 2;
  else if (ratio >= 0.6) idx = 1;
  else idx = 0;
  const initialGrade = LADDER[idx];
  const adj = [];
  if (h <= 2) {
    idx += 1;
    adj.push({ label: "Speed bonus (≤2 mo)", delta: 1 });
  } else if (h > 6 && h <= 9) {
    idx -= 1;
    adj.push({ label: "Long hold (7–9 mo)", delta: -1 });
  } else if (h > 9) {
    idx -= 2;
    adj.push({ label: "Very long hold (>9 mo)", delta: -2 });
  }
  if (purchase > 300000 && r < purchase * 0.1 && h <= 3) {
    idx += 1;
    adj.push({ label: "Capital efficiency", delta: 1 });
  }
  if (r > 150000 && h > 6 && p < 60000) {
    idx += -1;
    adj.push({ label: "Heavy construction risk", delta: -1 });
  }
  idx = Math.max(0, Math.min(9, idx));
  const finalLetter = LADDER[idx];
  const grade = idx === 0 ? "REJECT" : finalLetter;
  const gradeColor = idx === 0 ? T.red : idx >= 7 ? T.green : idx >= 4 ? T.lime : T.amber;
  const RISK_COLORS = [T.green, T.lime, T.amber, T.violet, T.red];
  const tierColor = RISK_COLORS[riskLevel - 1];
  const tier = `Risk ${riskLevel}`;
  const pctTxt = `${Math.round(ratio * 100)}%`;
  let verdict = `Profit is ${pctTxt} of the Risk ${riskLevel} target (${fmt(target)}) → ${initialGrade}.`;
  if (adj.length) verdict += ` ${adj.map((a) => `${a.label} ${a.delta > 0 ? "+" : ""}${a.delta}`).join(", ")} → ${finalLetter}.`;
  if (idx === 0) verdict += ` ${fmt(Math.max(0, target * 0.6 - p))} more profit needed to clear Reject.`;
  // A hold time of 0 would zero out interest and holding and add a speed bonus, so it can't be graded.
  const incomplete = !(arv > 0 && purchase > 0 && h > 0);
  return {
    tier,
    tierColor,
    grade: incomplete ? "—" : grade,
    gradeColor: incomplete ? T.txtMute : gradeColor,
    verdict: incomplete ? "Enter ARV, purchase price and hold time to grade this deal." : verdict,
    incomplete,
    threshold: target,
    riskLevel,
    ratio,
    initialGrade,
    finalLetter,
    adj,
    rehabLvl,
    holdLvl,
  };
}
const gradeColorOf = (g) => {
  if (!g || g === "—") return T.txtMute;
  if (g === "REJECT") return T.red;
  if (g[0] === "A") return T.green;
  if (g[0] === "B") return T.lime;
  return T.amber;
};

// ---------- original-underwriting snapshot ----------
function makeUwSnapshot(inputs, by, date) {
  const m = calcDeal(inputs);
  const g = gradeDeal({ repair: m.repair, holdMonths: inputs.holdMonths, netProfit: m.netProfit, purchase: inputs.purchase, arv: inputs.arv });
  const keep = {};
  [
    "purchase",
    "repair",
    "loanAmount",
    "interest",
    "drawFees",
    "investorAmount",
    "investorInterest",
    "totalFinancing",
    "totalMonthlyHold",
    "totalHolding",
    "pmFee",
    "totalBuying",
    "totalSelling",
    "totalCosts",
    "netProfit",
    "cashIn",
    "roi",
    "monthlyInterest",
  ].forEach((k) => (keep[k] = Number.isFinite(m[k]) ? Math.round(m[k] * 100) / 100 : null));
  return {
    date,
    frozenAt: new Date().toISOString(),
    by: by || "",
    inputs: { arv: inputs.arv, purchase: inputs.purchase, repair: m.repair, holdMonths: inputs.holdMonths },
    m: keep,
    grade: g.grade,
    riskLevel: g.riskLevel,
    threshold: g.threshold,
  };
}

// ---------- actuals helpers ----------
const ACTUAL_CATS = ["Acquisition", "Rehab / Construction", "Financing", "Holding", "Services", "Selling", "Other"];
const sumActuals = (acts, cat) => (acts || []).filter((a) => !cat || a.cat === cat).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

// ---------- deal summary (powers the Portfolio and Drive appProperties) ----------
function summarizeDeal(d) {
  const inp = inputsFromState(d);
  const m = calcDeal(inp);
  const g = gradeDeal({ repair: m.repair, holdMonths: inp.holdMonths, netProfit: m.netProfit, purchase: inp.purchase, arv: inp.arv });
  const mg = mergeMgmt(d.mgmt);
  const acts = d.actuals || [];
  const spent = sumActuals(acts);
  const base = d.uwBaseline || null;
  const fsc = forecastScenario(mg, inferStage(d));
  const lastLog = mg.log.reduce((mx, l) => (l.ts && l.ts > mx ? l.ts : mx), "");
  const lu = [d.savedAt || "", lastLog].sort().pop() || "";
  const lastOffer = mg.offers.length ? mg.offers[mg.offers.length - 1] : null;
  const s = {
    v: 2,
    st: inferStage(d),
    gr: g.grade,
    np: R0(m.netProfit),
    bnp: base && base.m ? R0(base.m.netProfit) : undefined,
    bgr: base ? base.grade : undefined,
    arv: R0(inp.arv),
    pp: R0(inp.purchase),
    rp: R0(m.repair),
    hm: inp.holdMonths,
    src: mg.source || undefined,
    oa: lastOffer ? R0(num(lastOffer.amount)) : undefined,
    os: lastOffer ? lastOffer.status : undefined,
    cd: mg.contract.date || undefined,
    cp: R0(num(mg.contract.price)) || undefined,
    ecd: mg.contract.expectedClosing || undefined,
    ied: mg.contract.inspectionEnd || undefined,
    emd: R0(num(mg.contract.emd)) || undefined,
    acd: mg.closing.date || undefined,
    rs: mg.rehab.startDate || undefined,
    rte: mg.rehab.targetEnd || undefined,
    red: mg.rehab.endDate || undefined,
    mp: milestonePct(mg.rehab.milestones),
    // open utility set-up tasks while under contract (for the "closing soon" warning)
    uo: (() => {
      const n = ((mg.checklists && mg.checklists.contract) || []).filter((i) => i.ut && /:buy$/.test(i.ut) && !i.done).length;
      return n || undefined;
    })(),
    nm: (() => {
      const ms = mg.rehab.milestones || [];
      const x = ms.find((y) => y.status === "doing") || ms.find((y) => y.status !== "done");
      return inferStage(d) === "rehab" && x ? String(x.label || "").slice(0, 40) : undefined;
    })(),
    pmd: (() => {
      const fee = m.pmFee || 0;
      if (!(fee > 0)) return undefined;
      return R0(pmPlan(mg, acts, fee).dueTotal) || undefined;
    })(),
    // paperwork on file: P purchase HUD-1, S scope of work, L sale HUD-1 ("-" none); powers the Docs column
    dk: (() => {
      const an = mg.analyses || [];
      const side = (a) => (a.review && a.review.side) || a.side;
      const kinds = (mg.docs || []).map((d) => String(d.kind || ""));
      const buy = an.some((a) => a.kind === "closing" && side(a) === "buy" && a.appliedAt) || kinds.some((k) => /purchase closing/i.test(k));
      const sow = an.some((a) => a.kind === "sow" && a.appliedAt) || kinds.some((k) => /scope of work/i.test(k));
      const sale = an.some((a) => a.kind === "closing" && side(a) === "sell" && a.appliedAt) || kinds.some((k) => /sale closing/i.test(k));
      return (buy ? "P" : "") + (sow ? "S" : "") + (sale ? "L" : "") || "-";
    })(),
    // rehab budget: the forecast's total rehab once saved, else the plan's; fr marks summaries made this way
    rb: R0(fsc ? num(fsc.rehab) : base ? base.m.repair : m.repair),
    rbf: fsc ? 1 : undefined,
    fr: 1,
    rsp: R0(sumActuals(acts, "Rehab / Construction")),
    ld: mg.listing.date || undefined,
    lp: R0(num(mg.listing.price)) || undefined,
    olp: mg.listing.prices.length ? R0(num(mg.listing.prices[0].price)) : undefined,
    bcd: mg.buyer.date || undefined,
    bec: mg.buyer.expectedClosing || undefined,
    bp: R0(num(mg.buyer.price)) || undefined,
    sd: mg.sale.date || undefined,
    sp: d.actualSale > 0 ? R0(d.actualSale) : undefined,
    ap: d.actualSale > 0 ? R0(d.actualSale - spent) : undefined,
    spent: R0(spent) || undefined,
    lu: lu ? lu.slice(0, 10) : undefined,
    dr: mg.dead ? mg.dead.reason : undefined,
    dd: mg.dead ? mg.dead.date : undefined,
    dfs: mg.dead ? mg.dead.fromStage : undefined,
  };
  Object.keys(s).forEach((k) => (s[k] === undefined || s[k] === null || s[k] === "") && delete s[k]);
  return s;
}
// Drive appProperties: max 30 per app, 124 bytes per key+value. The summary JSON is
// ASCII-escaped and split into chunks so it always fits.
const SUM_CHUNK = 118;
const SUM_MAX_CHUNKS = 24;
function summaryToProps(sum, forCreate) {
  const json = JSON.stringify(sum).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  const n = Math.ceil(json.length / SUM_CHUNK);
  if (n > SUM_MAX_CHUNKS) return null;
  const props = { sv: "2", sn: String(n) };
  for (let i = 0; i < n; i++) props["s" + i] = json.slice(i * SUM_CHUNK, (i + 1) * SUM_CHUNK);
  if (!forCreate) for (let j = n; j < SUM_MAX_CHUNKS; j++) props["s" + j] = null;
  return props;
}
function propsToSummary(ap) {
  if (!ap || ap.sv !== "2") return null;
  const n = parseInt(ap.sn, 10);
  if (!(n > 0)) return null;
  let json = "";
  for (let i = 0; i < n; i++) {
    if (typeof ap["s" + i] !== "string") return null;
    json += ap["s" + i];
  }
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------- paperwork each stage should have on file ----------
const DOC_NEEDS = { rehab: ["P", "S"], market: ["P", "S"], sold: ["P", "S", "L"] };
const DOC_NAMES = { P: "Purchase HUD", S: "SOW", L: "Sale HUD" };
function docsStatus(s) {
  const need = s && DOC_NEEDS[s.st];
  if (!need) return null;
  if (s.dk === undefined) return { unknown: true };
  const have = need.filter((k) => s.dk.includes(k));
  return { need: need.length, have: have.length, missing: need.filter((k) => !s.dk.includes(k)).map((k) => DOC_NAMES[k]) };
}

// ---------- needs-attention rules ----------
function attentionFor(s, today) {
  const out = [];
  if (!s) return out;
  const t = today || todayISO();
  const st = s.st;
  if (st === "contract") {
    const dc = daysBetween(t, s.ecd);
    if (dc != null && dc < 0) out.push({ lvl: "red", text: `Closing date passed ${-dc} day${dc === -1 ? "" : "s"} ago` });
    else if (dc != null && dc <= 7) out.push({ lvl: "amber", text: `Closing ${relDays(dc)}` });
    const di = daysBetween(t, s.ied);
    if (di != null && di >= 0 && di <= 3) out.push({ lvl: "amber", text: `Inspection period ends ${relDays(di)}` });
    if (s.uo && dc != null && dc <= 7) out.push({ lvl: "amber", text: `${s.uo} utility task${s.uo === 1 ? "" : "s"} still open before closing` });
  }
  if (st === "rehab" && !s.rs && s.acd) {
    const w = daysBetween(s.acd, t);
    if (w != null && w > 30) out.push({ lvl: "red", text: `Rehab not started, ${w} days after closing` });
    else if (w != null && w > 14) out.push({ lvl: "amber", text: `Rehab not started, ${w} days after closing` });
  }
  if (s.pmd > 0 && ACTIVE_STAGES.concat(["sold"]).includes(st)) out.push({ lvl: "amber", text: `Project manager payment due: $${Math.round(s.pmd).toLocaleString("en-US")}` });
  if (st === "rehab") {
    const of = s.rbf ? " (forecast)" : "";
    if (s.rb > 0 && s.rsp > s.rb * 1.1) out.push({ lvl: "red", text: `Rehab over budget${of} by ${Math.round((s.rsp / s.rb - 1) * 100)}%` });
    else if (s.rb > 0 && s.rsp > s.rb) out.push({ lvl: "amber", text: `Rehab at ${Math.round((s.rsp / s.rb) * 100)}% of budget${of}` });
    const dl = daysBetween(t, s.rte);
    if (dl != null && dl < 0) out.push({ lvl: "red", text: `Rehab ${-dl} days past target date` });
    if (s.rb > 0 && s.mp != null && s.rsp / s.rb - s.mp / 100 > 0.25 && !(s.rsp > s.rb))
      out.push({ lvl: "amber", text: `Spent ${Math.round((s.rsp / s.rb) * 100)}% of budget, work ${s.mp}% done` });
  }
  if (st === "market") {
    if (s.bcd) {
      const db = daysBetween(t, s.bec);
      if (db != null && db < 0) out.push({ lvl: "red", text: `Buyer closing date passed ${-db} days ago` });
      else if (db != null && db <= 7) out.push({ lvl: "amber", text: `Buyer closing ${relDays(db)}` });
    } else {
      const dom = daysBetween(s.ld, t);
      if (dom != null && dom > 60) out.push({ lvl: "red", text: `${dom} days on market` });
      else if (dom != null && dom > 30) out.push({ lvl: "amber", text: `${dom} days on market` });
    }
  }
  if (ACTIVE_STAGES.includes(st) && s.lu) {
    const stale = daysBetween(s.lu, t);
    if (stale != null && stale > 14) out.push({ lvl: "amber", text: `No update in ${stale} days` });
  }
  return out;
}

// ---------- Google Drive: metadata + multipart update ----------
async function driveGetMeta(token, fileId) {
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${encodeURIComponent("id,name,modifiedTime,lastModifyingUser(displayName,emailAddress)")}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) {
    const e = new Error(`Drive meta: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
async function driveUpdateFull(token, fileId, data, meta) {
  const boundary = "kappa_upd_bnd";
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta || {})}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const r = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=${encodeURIComponent("id,name,modifiedTime")}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary="${boundary}"` },
      body,
    },
  );
  if (!r.ok) {
    const e = new Error(`Drive update: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
const SUMMARY_CACHE_KEY = "kappa_summary_cache_v2";
const loadSummaryCache = () => {
  try {
    return JSON.parse(localStorage.getItem(SUMMARY_CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const saveSummaryCache = (c) => {
  try {
    localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(c));
  } catch {}
};

// ---------- Closing statement extraction (Claude API, called from the browser) ----------
const CLAUDE_MODEL = "claude-sonnet-5-5";
// Pasted keys can carry invisible characters (spaces, line breaks, zero-width marks, quotes)
// that make the API reject them with 401 — strip them all.
const cleanApiKey = (k) =>
  String(k || "")
    .replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/^["'`\u201c\u201d]+|["'`\u201c\u201d]+$/g, "");
const looksLikeAnthropicKey = (k) => /^sk-ant-[A-Za-z0-9_-]{40,}$/.test(k);
const maskKey = (k) => (k ? `${k.slice(0, 14)}\u2026${k.slice(-4)}, ${k.length} characters` : "");
const ANTHROPIC_HEADERS = (apiKey) => ({
  "x-api-key": cleanApiKey(apiKey),
  "anthropic-version": "2023-06-01",
  "content-type": "application/json",
  "anthropic-dangerous-direct-browser-access": "true",
});
// Free check (no tokens used): list one model with the key.
async function testAnthropicKey(apiKey) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: ANTHROPIC_HEADERS(apiKey) });
    if (r.ok) return { ok: true, text: "\u2713 Key works" };
    let msg = "";
    try {
      const j = await r.json();
      msg = (j && j.error && j.error.message) || "";
    } catch {}
    if (r.status === 401) return { ok: false, text: "\u2715 Rejected (401) \u2014 this isn't a valid, active key. Create a new one and paste it in full." };
    if (r.status === 403) return { ok: false, text: "\u2715 Not allowed (403) \u2014 " + (msg || "check the key's workspace permissions.") };
    return { ok: false, text: `\u2715 ${r.status}${msg ? " \u2014 " + msg : ""}` };
  } catch (e) {
    return { ok: false, text: "\u2715 Couldn't reach the Anthropic API \u2014 " + (e.message || "network error") };
  }
}
const STMT_CATEGORIES = [
  "price",
  "assignment",
  "deposit",
  "loan",
  "payoff",
  "payoff_interest",
  "title_settlement",
  "recording",
  "transfer_tax",
  "commission",
  "home_warranty",
  "inspection",
  "lender_fees",
  "tax_proration",
  "insurance",
  "hoa",
  "utilities",
  "concession",
  "misc",
];
const STMT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "closing_date", "property_address", "price", "totals", "lines"],
  properties: {
    document_type: { type: "string" },
    closing_date: { type: "string" },
    property_address: { type: "string" },
    price: { type: "number" },
    totals: {
      type: "object",
      additionalProperties: false,
      required: ["buyer_debits", "buyer_credits", "due_from_buyer", "seller_debits", "seller_credits", "due_to_seller"],
      properties: {
        buyer_debits: { type: "number" },
        buyer_credits: { type: "number" },
        due_from_buyer: { type: "number" },
        seller_debits: { type: "number" },
        seller_credits: { type: "number" },
        due_to_seller: { type: "number" },
      },
    },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "category", "buyer_debit", "buyer_credit", "seller_debit", "seller_credit"],
        properties: {
          description: { type: "string" },
          category: { type: "string", enum: STMT_CATEGORIES },
          buyer_debit: { type: "number" },
          buyer_credit: { type: "number" },
          seller_debit: { type: "number" },
          seller_credit: { type: "number" },
        },
      },
    },
  },
};
const STMT_PROMPT = `You are reading a US real-estate closing / settlement statement (ALTA Settlement Statement, HUD-1, Closing Disclosure, or a title company's buyer/seller statement).

Extract EVERY individual charge or credit line into "lines". For each line give the amount in each party column exactly as printed:
- buyer_debit / buyer_credit = Borrower/Buyer columns; seller_debit / seller_credit = Seller columns. Use 0 for empty columns.
- Include items marked POC (paid outside of closing) in the column of the party that paid them.
- Do NOT include subtotals, totals, "cash to/from borrower/seller", "due from/to" summary lines or balance lines.
- Description: the line text, plus the payee if shown (e.g. "Settlement fee to ABC Title").

category (pick one):
price = contract sales price (what the seller sells for);
assignment = money the buyer pays for the right to buy the property, on top of the sales price: assignment fees, wholesale / wholesaler fees,
  "Joint Venture Agreement" (JV) payments, contract assignment or finder's fees paid to the assignor or JV partners. These are part of the
  buyer's real purchase price, NOT closing costs. Title, escrow, settlement or attorney services are never "assignment";
deposit = earnest money / deposit (EMD) the buyer paid before closing, usually a buyer credit such as "Deposit held by ...";
loan = new loan amount / principal;
payoff = payoff of an existing loan's principal (or a combined payoff total); payoff_interest = interest itemized on a payoff;
title_settlement = settlement/closing/escrow fees, title insurance premiums, endorsements, CPL, title search/exam, attorney/doc fees charged by title or attorney;
recording = recording fees; transfer_tax = transfer, conveyance or deed taxes; commission = real-estate commissions;
home_warranty = home warranty; inspection = inspections, survey, pest/sewer reports;
lender_fees = loan origination, points, underwriting, processing, lender doc fees, appraisal, credit report, lender's escrow holdbacks for fees;
tax_proration = property tax prorations/adjustments or delinquent taxes; insurance = hazard insurance premium;
hoa = HOA dues, transfer or estoppel fees; utilities = water/sewer/utility bills or escrows;
concession = seller credits, concessions, repair credits between buyer and seller; misc = anything else (courier, wire, notary, admin, municipal certs).

closing_date: settlement/closing date as YYYY-MM-DD ("" if not shown). price: the contract sales price (0 if not shown). document_type: a short name of the form.

totals: copy the statement's own summary rows exactly as printed (0 if not shown):
buyer_debits / buyer_credits = the Borrower/Buyer column Subtotals; due_from_buyer = "Due From Borrower", "Cash from Borrower" or "Cash to Close"
(what the buyer brings to closing); seller_debits / seller_credits = the Seller column Subtotals; due_to_seller = "Due To Seller" / "Cash to Seller".
These are used to check that every line was read, so never compute them yourself.
Return only the JSON object.`;
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = () => reject(new Error("Could not read the file"));
    fr.readAsDataURL(file);
  });
const parseJsonLoose = (text) => {
  const t = (text || "").replace(/```json|```/g, "");
  const a = t.indexOf("{"),
    b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The model did not return JSON");
  return JSON.parse(t.slice(a, b + 1));
};
// ---------- AI documents: source loading (computer or Google Drive) ----------
// Claude reads PDFs as documents and JPG/PNG/WEBP/GIF as images. Google Docs are exported to PDF.
const AI_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
const GDOC_MIME = "application/vnd.google-apps.document";
const AI_ACCEPT = "application/pdf,.pdf,image/jpeg,image/png,image/webp,image/gif";
const MAX_PDF_BYTES = 24 * 1024 * 1024; // request limit is 32 MB after base64 (+33%)
const MAX_IMG_BYTES = 5 * 1024 * 1024; // API limit per image
const docKindIcon = (mime) => <span style={{ display: "inline-flex", color: SITE_T.txtMute }}><Icon name={mime && mime.startsWith("image/") ? "dot" : "file"} /></span>;
const bufToBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
};
const checkDocSize = (mediaType, bytes, name) => {
  if (!AI_DOC_TYPES.includes(mediaType)) throw new Error(`${name || "This file"} is ${mediaType || "an unsupported type"} — use a PDF, JPG, PNG, WEBP or a Google Doc`);
  if (mediaType === "application/pdf" && bytes > MAX_PDF_BYTES) throw new Error(`PDF is ${Math.round(bytes / 1048576)} MB — the limit is 24 MB`);
  if (mediaType !== "application/pdf" && bytes > MAX_IMG_BYTES) throw new Error(`Image is ${(bytes / 1048576).toFixed(1)} MB — the limit is 5 MB (export it as PDF instead)`);
};
async function payloadFromLocal(file) {
  const mediaType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "");
  checkDocSize(mediaType, file.size, file.name);
  return { b64: await fileToBase64(file), mediaType, name: file.name, size: file.size };
}
// Drive: search files the user can open (PDF, images, Google Docs)
async function driveSearchDocs(token, query) {
  const types = `(mimeType='application/pdf' or mimeType contains 'image/' or mimeType='${GDOC_MIME}')`;
  const nameQ = query && query.trim() ? ` and name contains '${query.trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'` : "";
  const q = encodeURIComponent(`trashed=false and ${types}${nameQ}`);
  const fields = encodeURIComponent("files(id,name,mimeType,size,modifiedTime)");
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${encodeURIComponent("modifiedTime desc")}&pageSize=30&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) {
    const e = new Error(`Drive search: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return (await r.json()).files || [];
}
async function driveFileInfo(token, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=${encodeURIComponent("id,name,mimeType,size,modifiedTime")}&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const e = new Error(r.status === 404 ? "File not found — check the link and that you have access" : `Drive: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
const driveIdFromLink = (s) => {
  const t = String(s || "").trim();
  const m = t.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([A-Za-z0-9_-]{15,})/) || t.match(/[?&]id=([A-Za-z0-9_-]{15,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(t) ? t : null;
};
async function payloadFromDrive(token, f) {
  const isGdoc = f.mimeType === GDOC_MIME;
  const mediaType = isGdoc ? "application/pdf" : f.mimeType;
  if (!isGdoc) checkDocSize(mediaType, Number(f.size) || 0, f.name);
  const url = isGdoc
    ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=application%2Fpdf`
    : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    const e = new Error(`Drive download: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  const buf = await r.arrayBuffer();
  if (isGdoc) checkDocSize(mediaType, buf.byteLength, f.name);
  return { b64: bufToBase64(buf), mediaType, name: f.name, size: buf.byteLength, driveFileId: isGdoc ? null : f.id, driveSourceId: f.id, sourceMime: f.mimeType };
}

// ---------- AI documents: one generic Claude call ----------
async function callClaudeDoc(apiKey, payload, prompt, schema, structured) {
  const block =
    payload.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: payload.b64 } }
      : { type: "image", source: { type: "base64", media_type: payload.mediaType, data: payload.b64 } };
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 24000,
    messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }],
  };
  if (structured) body.output_config = { format: { type: "json_schema", schema } };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: ANTHROPIC_HEADERS(apiKey),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = `Claude API ${r.status}`;
    try {
      const j = await r.json();
      if (j && j.error && j.error.message) msg += ": " + j.error.message;
    } catch {}
    const e = new Error(msg);
    e.status = r.status;
    throw e;
  }
  const j = await r.json();
  if (j.stop_reason === "max_tokens") throw new Error("The document is too long to read in one pass");
  if (j.stop_reason === "refusal") throw new Error("The model declined to read this document");
  const text = (j.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  return parseJsonLoose(text);
}
async function callClaudeDocWithFallback(apiKey, payload, prompt, schema) {
  try {
    return await callClaudeDoc(apiKey, payload, prompt, schema, true);
  } catch (e) {
    // If this account/API version rejects structured outputs, ask for plain JSON instead.
    if (e.status === 400 && /output_config|format|schema/i.test(e.message)) return callClaudeDoc(apiKey, payload, prompt, schema, false);
    throw e;
  }
}
async function extractClosingStatement(apiKey, payload) {
  const out = await callClaudeDocWithFallback(apiKey, payload, STMT_PROMPT, STMT_SCHEMA);
  if (!out || !Array.isArray(out.lines)) throw new Error("No line items found in this document");
  out.lines = out.lines.map((l) => ({
    description: String(l.description || "").trim(),
    category: STMT_CATEGORIES.includes(l.category) ? l.category : "misc",
    buyer_debit: num(l.buyer_debit),
    buyer_credit: num(l.buyer_credit),
    seller_debit: num(l.seller_debit),
    seller_credit: num(l.seller_credit),
  }));
  out.price = num(out.price);
  out.closing_date = /^\d{4}-\d{2}-\d{2}$/.test(out.closing_date || "") ? out.closing_date : "";
  const tt = out.totals || {};
  out.totals = {
    buyer_debits: num(tt.buyer_debits),
    buyer_credits: num(tt.buyer_credits),
    due_from_buyer: num(tt.due_from_buyer),
    seller_debits: num(tt.seller_debits),
    seller_credits: num(tt.seller_credits),
    due_to_seller: num(tt.due_to_seller),
  };
  return out;
}
// Where each statement category lands, per side. "txn:<key>" = a Buying/Selling cost row.
const STMT_TARGETS = {
  buy: [
    ["price", "Purchase price (incl. assignment / JV)"],
    ["deposit", "EMD / deposit, paid before closing"],
    ["credit", "Credit to us (lowers what we paid)"],
    ["txn:escrow", "Escrow / Title / Attorney"],
    ["txn:recording", "Recording Fees"],
    ["txn:transfer", "Transfer & Conveyance"],
    ["txn:realtor", "Realtor Fees"],
    ["txn:warranty", "Home Warranty"],
    ["txn:staging", "Inspections"],
    ["txn:marketing", "Marketing"],
    ["txn:misc", "Miscellaneous (closing)"],
    ["points", "Lender fees / points"],
    ["holding", "Holding (prorations, insurance)"],
    ["interest", "Loan interest"],
    ["ignore", "Not a cost — skip"],
  ],
  sell: [
    ["txn:escrow", "Escrow / Title / Attorney"],
    ["txn:recording", "Recording Fees"],
    ["txn:transfer", "Transfer & Conveyance"],
    ["txn:realtor", "Realtor Fees"],
    ["txn:warranty", "Home Warranty"],
    ["txn:staging", "Staging"],
    ["txn:marketing", "Marketing"],
    ["txn:misc", "Miscellaneous (closing)"],
    ["holding", "Holding (tax prorations, utilities)"],
    ["interest", "Loan interest"],
    ["ignore", "Not a cost — skip"],
  ],
};
const STMT_DEFAULT_TARGET = {
  price: "ignore",
  assignment: "txn:misc",
  deposit: "ignore",
  loan: "ignore",
  payoff: "ignore",
  payoff_interest: "interest",
  title_settlement: "txn:escrow",
  recording: "txn:recording",
  transfer_tax: "txn:transfer",
  commission: "txn:realtor",
  home_warranty: "txn:warranty",
  inspection: "txn:staging",
  lender_fees: "points",
  tax_proration: "holding",
  insurance: "holding",
  hoa: "holding",
  utilities: "holding",
  concession: "txn:misc",
  misc: "txn:misc",
};
// Text cues for what the model may have filed elsewhere (and for statements read before v41).
const STMT_ASSIGNMENT_RE = /\bassign(ment|or)?\b|joint\s*venture|\bJ\.?V\.?\b|wholesal|finder'?s?\s+fee|contract\s+fee/i;
const STMT_DEPOSIT_RE = /\bdeposit\b|earnest|\bEMD\b/i;
const stmtCategory = (l) => {
  if (l.category === "assignment" || l.category === "price" || l.category === "loan" || l.category === "payoff") return l.category;
  if (l.buyer_debit > 0 && STMT_ASSIGNMENT_RE.test(l.description) && !/title|escrow|settlement|recording|attorney/i.test(l.description)) return "assignment";
  if (l.buyer_credit > 0 && STMT_DEPOSIT_RE.test(l.description)) return "deposit";
  return l.category;
};
// One row per statement line, with where it goes. On the purchase side the price, assignment / JV
// fees and the EMD make up the purchase price; they are not closing costs.
function stmtLinesForSide(out, side) {
  return out.lines
    .map((l, i) => {
      const category = stmtCategory(l);
      const amount = side === "buy" ? l.buyer_debit - l.buyer_credit : l.seller_debit - l.seller_credit;
      let target = STMT_DEFAULT_TARGET[category] || "txn:misc";
      if (side === "buy" && (category === "price" || category === "assignment")) target = "price";
      if (side === "buy" && category === "deposit") target = "deposit";
      // a credit to the buyer (tax proration, seller credit) isn't a cost: it lowers what we paid at closing
      if (side === "buy" && amount < 0 && target !== "ignore" && target !== "deposit" && target !== "price" && category !== "loan" && category !== "payoff") target = "credit";
      if (side === "sell" && target === "points") target = "txn:misc";
      if (side === "sell" && category === "inspection") target = "txn:misc";
      return { id: i, description: l.description, category, amount: Math.round(amount * 100) / 100, target, include: target !== "ignore" && amount !== 0 };
    })
    .filter((l) => l.amount !== 0);
}
function stmtPriceForSide(out, side) {
  const priceLine = out.lines.find((l) => l.category === "price");
  if (priceLine) {
    const v = side === "buy" ? priceLine.buyer_debit : priceLine.seller_credit;
    if (v > 0) return v;
  }
  return out.price || 0;
}
const r2 = (v) => Math.round(v * 100) / 100;
// The money picture of a purchase statement, from the reviewed lines:
// price = sales price + assignment / JV; costs = title & closing fees; credits = prorations and the like.
// Paid = cash at closing + EMD paid earlier + loans. "check" compares the lines with the statement's own total.
function stmtBuySummary(lines, out) {
  const inc = lines.filter((l) => l.include);
  const sum = (f) => r2(inc.filter(f).reduce((t, l) => t + l.amount, 0));
  const price = sum((l) => l.target === "price");
  const sellerPrice = sum((l) => l.target === "price" && l.category === "price");
  const assignment = r2(price - sellerPrice);
  const deposit = -sum((l) => l.target === "deposit");
  const closing = sum((l) => l.target.startsWith("txn:") || l.target === "points");
  const other = sum((l) => l.target === "holding" || l.target === "interest");
  const credits = sum((l) => l.target === "credit"); // negative
  const creditLines = inc.filter((l) => l.target === "credit");
  const taxCredit = creditLines.some((l) => l.category === "tax_proration");
  const taxCredits = r2(creditLines.filter((l) => l.category === "tax_proration").reduce((t, l) => t + l.amount, 0)); // negative
  const otherCredits = r2(credits - taxCredits); // negative
  // the cost of the purchase: price + closing costs (+ anything else we paid). The seller's credits count
  // too, as their own ledger entries: a property-tax credit under Holding (it's the seller's share of the
  // taxes we pay later, at the tax bill or at the sale), any other credit under Acquisition.
  const total = r2(price + closing + other);
  const net = r2(total + credits);
  const allLines = r2(lines.reduce((t, l) => t + l.amount, 0)); // every line, whatever its mapping = cash due at closing
  const loans = -r2(lines.filter((l) => l.category === "loan").reduce((t, l) => t + l.amount, 0));
  const due = out && out.totals ? out.totals.due_from_buyer : 0;
  const check = due > 0 ? (Math.abs(allLines - due) < 1 ? "ok" : "off") : "none";
  return { price, sellerPrice, assignment, deposit, closing, other, credits, creditLines, taxCredit, taxCredits, otherCredits, total, net, cashAtClosing: due > 0 ? due : allLines, linesCash: allLines, loans, check };
}
function stmtSellSummary(lines, out) {
  const allLines = r2(lines.reduce((t, l) => t + l.amount, 0)); // seller debits − credits = −(cash to seller)
  const due = out && out.totals ? out.totals.due_to_seller : 0;
  const check = due > 0 ? (Math.abs(-allLines - due) < 1 ? "ok" : "off") : "none";
  // property taxes we owe up to the sale (a seller debit; a credit if we'd paid ahead), counted under Holding
  const taxes = r2(lines.filter((l) => l.include && l.category === "tax_proration" && l.target !== "ignore").reduce((t, l) => t + l.amount, 0));
  return { proceeds: due > 0 ? due : -allLines, linesProceeds: -allLines, check, taxes };
}
// The seller's credits on a purchase statement, as ledger entries (amounts negative: they lower the cost).
const STMT_CREDIT_TAG = "stmt_buy_credit";
const creditEntryFor = (c, date) => ({
  cat: c.kind === "tax" ? "Holding" : "Acquisition",
  label: c.kind === "tax" ? `Property tax credit from the seller at closing (${c.label})` : `Credit from the seller at closing (${c.label})`,
  amount: -Math.abs(r2(c.amount)),
  date,
  tag: STMT_CREDIT_TAG,
});
// EMD the user already logged in the ledger (by hand or from an earlier import).
const ledgerEmd = (actuals) =>
  r2(
    (actuals || [])
      .filter((a) => a.tag === "emd" || (a.cat === "Acquisition" && !a.tag && STMT_DEPOSIT_RE.test(a.label || "")))
      .reduce((t, a) => t + num(a.amount), 0),
  );
const ledgerCatForTarget = (target, side) => {
  if (target === "points" || target === "interest") return "Financing";
  if (target === "holding") return "Holding";
  return side === "buy" ? "Acquisition" : "Selling";
};
const houseNo = (s) => {
  const m = String(s || "").match(/^\s*(\d+)/);
  return m ? m[1] : null;
};

// ---------- Scope of Work (SOW) → rehab milestones ----------
const SOW_TRADES = [
  "demo",
  "roof",
  "exterior",
  "structural",
  "windows_doors",
  "plumbing",
  "electrical",
  "hvac",
  "permits",
  "insulation_drywall",
  "kitchen",
  "bathrooms",
  "flooring",
  "paint",
  "fixtures_finishes",
  "landscaping",
  "cleanup",
  "other",
];
const SOW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "contractor", "property_address", "total", "payment_terms", "milestones"],
  properties: {
    document_type: { type: "string" },
    contractor: { type: "string" },
    property_address: { type: "string" },
    total: { type: "number" },
    payment_terms: { type: "string" },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "scope", "cost", "trade"],
        properties: {
          name: { type: "string" },
          scope: { type: "string" },
          cost: { type: "number" },
          trade: { type: "string", enum: SOW_TRADES },
        },
      },
    },
  },
};
const SOW_PROMPT = `You are reading a Scope of Work (SOW) or contractor bid for a fix-and-flip rehab of a single-family house.

Turn it into the project's rehab MILESTONES:
- Group the line items into 5–15 practical milestones a project manager would track (e.g. "Demo & cleanout", "Roof", "Plumbing rough-in", "Kitchen", "Flooring", "Interior paint", "Final clean & punch list").
- Order them the way the work is normally done: demo → roof/exterior → structural → windows/doors → rough-ins (plumbing, electrical, HVAC) → permits/inspections → insulation & drywall → kitchen & bathrooms → flooring → paint → fixtures & finishes → landscaping → final clean / punch list.
- name: short (max 40 characters). scope: one or two sentences listing what is included, with quantities, sizes or materials when the document gives them.
- cost: the sum of the prices of the line items in that milestone; 0 if the document shows no prices for them. Never invent prices.
- trade: the closest category.
- Only include work that is in the document. Keep permits/inspections, dumpsters and cleanup if they are listed.

total: the document's grand total (if none is printed, the sum of all line-item prices; 0 if there are no prices).
contractor: the contractor or company name ("" if not shown). property_address: as printed ("" if not shown).
payment_terms: the payment or draw schedule as printed, condensed to one or two sentences ("" if none). document_type: a short name of the document.
Return only the JSON object.`;
async function extractSow(apiKey, payload) {
  const out = await callClaudeDocWithFallback(apiKey, payload, SOW_PROMPT, SOW_SCHEMA);
  if (!out || !Array.isArray(out.milestones) || !out.milestones.length) throw new Error("No scope items found in this document");
  out.milestones = out.milestones.map((x) => ({
    name: String(x.name || "").trim().slice(0, 60) || "Milestone",
    scope: String(x.scope || "").trim(),
    cost: Math.max(0, num(x.cost)),
    trade: SOW_TRADES.includes(x.trade) ? x.trade : "other",
  }));
  out.total = num(out.total);
  out.contractor = String(out.contractor || "").trim();
  out.payment_terms = String(out.payment_terms || "").trim();
  return out;
}

// ---------- Saved AI analyses (kept on the deal so they can be reopened for free) ----------
const ANALYSIS_LABEL = { closing_buy: "Purchase closing statement", closing_sell: "Sale closing statement", sow: "Scope of work" };
const analysisKey = (a) => (a.kind === "sow" ? "sow" : `closing_${a.side}`);
