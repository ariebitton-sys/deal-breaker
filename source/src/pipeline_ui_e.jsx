// ============================================================================
// v29 — SITE PLAN design: shell (sidebar, deal header), underwriting groups, results rail
// ============================================================================
const PROPER_WORDS = new Set(["Kappa", "Zillow", "Google", "Drive", "Claude", "Anthropic", "Ohio", "Cleveland"]);
// "Buying Transaction Costs" → "Buying transaction costs"; keeps acronyms (ARV, SOW, ROI) and proper nouns.
const sentenceCase = (s) => {
  if (typeof s !== "string") return s;
  return s
    .split(" ")
    .map((w, i) => {
      if (i === 0) return w;
      const bare = w.replace(/[^A-Za-z]/g, "");
      if (!bare || bare === bare.toUpperCase() || PROPER_WORDS.has(bare) || /\d/.test(w)) return w;
      return w.charAt(0) === w.charAt(0).toUpperCase() ? w.charAt(0).toLowerCase() + w.slice(1) : w;
    })
    .join(" ");
};

// ---------- tiny line icons (no emoji in the chrome) ----------
const ICONS = {
  plug: "M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  funnel: "M4 5h16l-6 8v6l-4-2v-4z",
  hammer: "M14 4l6 6-3 3-6-6zM11 7l-8 8 3 3 8-8",
  home: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5",
  bell: "M6 9a6 6 0 1 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9M10.3 20.5a2 2 0 0 0 3.4 0",
  bank: "M3 9.5L12 4l9 5.5M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20h18",
  calc: "M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01",
  cal: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  pulse: "M3 12h4l3-7 4 14 3-7h4",
  map: "M9 4l6 2 5-2v14l-5 2-6-2-5 2V6zM9 4v14M15 6v14",
  alert: "M12 3l10 18H2zM12 10v4M12 17h.01",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  board: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  chevron: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  back: "M15 6l-6 6 6 6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  print: "M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  dot: "M12 12h.01",
  folder: "M4 6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
  save: "M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM8 4v5h7V4M8 20v-6h8v6",
  x: "M6 6l12 12M18 6L6 18",
  edit: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  clip: "M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  copy: "M9 9h10v11H9zM5 15V4h10",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  bolt: "M13 2L4.5 13.5H11L10 22l8.5-11.5H12z",
  path: "M5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM19 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6.5 17h4a2 2 0 0 0 2-2V9a2 2 0 0 1 2-2h3",
  eyeoff: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9.7 9.7 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-2.4 3.6M6.1 6.1C4 7.5 2.6 9.6 2 12c1 2.5 5 7 10 7 1.7 0 3.2-.4 4.5-1.1",
  fit: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
  zin: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M11 8v6M8 11h6",
  zout: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4M8 11h6",
  expand: "M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5",
  template: "M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z",
  gantt: "M4 5h8M8 10h10M6 15h7M11 20h9",
};
function Icon({ name, size = 16, stroke = 1.8, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      <path d={ICONS[name] || ""} />
    </svg>
  );
}
const btnPrimary = () => ({ ...bs(T.navy, "#FFFFFF"), border: `1px solid ${T.navy}`, display: "inline-flex", alignItems: "center", gap: 7 });
const btnGhost = (color) => ({ ...bs("#FFFFFF", color || T.txt), display: "inline-flex", alignItems: "center", gap: 7 });

function stageCounts(files, summaries) {
  const c = { all: 0, dead: 0 };
  files.forEach((f) => {
    const s = summaries[f.id];
    if (!s) return;
    c[s.st] = (c[s.st] || 0) + 1;
    if (s.st !== "dead") c.all++;
  });
  c.active = ACTIVE_STAGES.reduce((n, k) => n + (c[k] || 0), 0);
  c.overview = c.all;
  c.leads = c.analyzing || 0;
  c.portfolio = c.sold || 0;
  return c;
}
function DealFinder({ files, summaries, onOpen, onDelete, onRefresh, onClose }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    onRefresh && onRefresh();
  }, []);
  const ql = q.trim().toLowerCase();
  const list = files.filter((f) => f.name.toLowerCase().includes(ql));
  return (
    <div className="finder" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <input autoFocus placeholder="Search by address" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inSt(), fontSize: 13 }} />
        <button onClick={onClose} aria-label="Close" style={iconBtn()}>
          <Icon name="x" />
        </button>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {list.length === 0 && <div style={{ padding: 10, fontSize: 12.5, color: T.txtMute }}>{files.length ? `No deals match “${q}”.` : "No saved deals yet."}</div>}
        {list.map((f) => {
          const s = summaries[f.id];
          return (
            <div key={f.id} className="finder-row" onClick={() => (onOpen(f), onClose())}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name.replace(/\.json$/, "")}</div>
                <div style={{ fontSize: 11.5, color: T.txtMute, display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                  {s && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: stageMeta(s.st).color }} />
                      {stageMeta(s.st).label}
                    </span>
                  )}
                  <span>{f.modifiedTime ? fmtDateShort(isoOf(new Date(f.modifiedTime))) : ""}</span>
                </div>
              </div>
              <button onClick={(e) => onDelete(f, e)} title="Delete this deal from Drive" aria-label="Delete deal" style={{ ...iconBtn(T.red), fontSize: 12 }}>
                <Icon name="x" size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Underwriting: collapsible cost groups ----------
const GROUPS_KEY = "kappa_uw_groups";
const loadGroups = () => {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
function Group({ id, title, sub, total, totalTone, actions, children }) {
  const [open, setOpen] = useState(() => !!loadGroups()[id]);
  const toggle = () => {
    const n = !open;
    setOpen(n);
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify({ ...loadGroups(), [id]: n }));
    } catch {}
  };
  return (
    <section className={"grp" + (open ? " open" : "")} id={"grp-" + id}>
      <div className="grp-head" onClick={toggle} role="button" tabIndex={0} aria-expanded={open} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}>
        <div style={{ minWidth: 0 }}>
          <div className="grp-title">{title}</div>
          {sub && <div className="grp-sub">{sub}</div>}
        </div>
        {actions && (
          <div className="grp-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
        {total != null && (
          <div className="grp-total" style={totalTone ? { color: totalTone } : undefined}>
            {total}
          </div>
        )}
        <span className="grp-chev">
          <Icon name="chevron" size={18} />
        </span>
      </div>
      {open && <div className="grp-body">{children}</div>}
    </section>
  );
}

// ---------- Underwriting: results rail ----------
function ResultsRail({ deal, m, mao, purchase, arv, investorAmount, sqft, gradeRef, onGradeHover }) {
  const [more, setMore] = useState(false);
  const inc = deal.incomplete;
  const parts = [
    ["Purchase", m.purchase, "#111827"],
    ["Rehab", m.repair, "#374151"],
    ...(m.pmFee > 0 ? [["Project manager", m.pmFee, "#4B5563"]] : []),
    ["Financing", m.totalFinancing, "#6B7280"],
    ["Selling", m.totalSelling, "#9CA3AF"],
    ["Buying", m.totalBuying, "#C7CCD3"],
    ["Holding", m.totalHolding, "#E2E5E9"],
  ];
  const profit = Math.max(0, m.netProfit || 0);
  const total = parts.reduce((s, p) => s + Math.max(0, p[1] || 0), 0) + profit;
  const maoTone = inc || mao.target == null ? T.txtDim : purchase <= mao.target ? T.green : mao.walk != null && purchase <= mao.walk ? T.amber : T.red;
  const ratioPct = Number.isFinite(deal.ratio) ? Math.round(deal.ratio * 100) : null;
  const gap = (m.netProfit || 0) - deal.threshold;
  const cushion = inc ? "Not graded yet" : gap >= 0 ? `${fmt(gap)} above the ${fmt(deal.threshold)} target` : `${fmt(-gap)} short of the ${fmt(deal.threshold)} target`;
  const adjText = (deal.adj || []).map((a) => `${a.label.toLowerCase()} ${a.delta > 0 ? "+" : "−"}${Math.abs(a.delta)}`).join(", ");
  let how = deal.verdict;
  if (!inc && ratioPct != null) {
    how = `${ratioPct}% of target earns ${deal.initialGrade === "Reject" ? "Reject" : deal.initialGrade}`;
    how += adjText ? `; ${adjText} makes it ${deal.finalLetter}.` : ".";
    if (deal.grade === "REJECT") how += ` Needs ${fmt(Math.max(0, deal.threshold * 0.6 - m.netProfit))} more profit to clear Reject.`;
  }
  return (
    <aside className="rail">
      <div ref={gradeRef} className="rail-grade" onMouseEnter={() => onGradeHover(true)} onMouseLeave={() => onGradeHover(false)} title="Hover to see how this grade was calculated">
        <div className={"rail-letter" + (deal.grade === "REJECT" ? " word" : "")} style={{ color: deal.grade === "REJECT" ? T.red : T.txt }}>
          {deal.grade === "REJECT" ? "Reject" : deal.grade}
        </div>
        <div className="rail-grade-meta">
          <span>Risk {deal.riskLevel} deal</span>
          <b style={!inc && gap < 0 ? { color: deal.grade === "REJECT" ? T.red : T.txt } : undefined}>{cushion}</b>
        </div>
      </div>
      <div className="rail-verdict">{how}</div>
      <div className="rail-k">Net profit</div>
      <div className={"rail-profit" + (!inc && m.netProfit > 0 ? " pos" : "")} style={{ color: inc ? T.txtMute : m.netProfit > 0 ? T.txt : T.red }}>
        {inc ? "—" : fmt(m.netProfit)}
      </div>
      <div className="rail-stats">
        <div title="Net profit divided by the total all-in project cost.">
          <span>ROI</span>
          <b>{inc ? "—" : pct(m.roi)}</b>
          <em>{inc ? "" : `${pct(m.roiAnnual)} a year`}</em>
        </div>
        <div title={`Highest purchase price that still earns the Risk ${deal.riskLevel} target profit (${fmt(deal.threshold)}).`}>
          <span>Max offer</span>
          <b style={{ color: maoTone }}>{inc ? "—" : mao.target == null ? "None" : fmt(mao.target)}</b>
          <em>{inc ? "" : mao.walk != null ? `walk away above ${fmtK(mao.walk)}` : "no price works"}</em>
        </div>
        <div title="Kappa's own out-of-pocket cash: interest, draw fees, holding, the project manager and any closing gap the investor doesn't cover.">
          <span>Kappa cash</span>
          <b>{inc ? "—" : fmt(m.cashIn)}</b>
          <em>out of pocket</em>
        </div>
      </div>
      {arv > 0 && total > 0 && (
        <React.Fragment>
          <div className="rail-k" style={{ marginTop: 18 }}>
            Where the {fmt(arv)} goes
          </div>
          <div className="rail-bar">
            {parts.map(([n, v, c]) =>
              v > 0 ? <span key={n} className="keep-color" title={`${n}: ${fmt(v)}`} style={{ width: `${(v / total) * 100}%`, background: c }} /> : null,
            )}
            {profit > 0 && <span className="keep-color" title={`Profit: ${fmt(profit)}`} style={{ width: `${(profit / total) * 100}%`, background: "#10B981" }} />}
          </div>
          <div className="rail-legend">
            {parts.map(([n, v, c]) => (
              <div key={n}>
                <i className="keep-color" style={{ background: c }} />
                <span>{n}</span>
                <b>{fmt(v)}</b>
              </div>
            ))}
            <div>
              <i className="keep-color" style={{ background: "#10B981" }} />
              <span>Profit</span>
              <b style={{ color: m.netProfit < 0 ? T.red : undefined }}>{fmt(m.netProfit)}</b>
            </div>
          </div>
        </React.Fragment>
      )}
      <button className="rail-more" onClick={() => setMore((x) => !x)} aria-expanded={more}>
        {more ? "Fewer numbers" : "More numbers"} <Icon name="down" size={14} style={{ transform: more ? "rotate(180deg)" : "none" }} />
      </button>
      {more && (
        <div className="rail-extra">
          <LR label="Total project cost" value={fmt(m.totalCosts)} />
          <LR label="Loan amount" value={fmt(m.loanAmount)} />
          <LR label="Investor capital" value={fmt(investorAmount)} />
          <LR label="Investor return" value={fmt(m.investorInterest)} />
          <LR
            label="Cash-on-cash (annual)"
            value={inc || !Number.isFinite(m.cashOnCashAnnual) ? "—" : m.cashOnCashAnnual > 9.99 ? "999%+" : pct(m.cashOnCashAnnual)}
          />
          <LR label="Cost per sq ft" value={sqft > 0 && Number.isFinite(m.costPerSqft) ? fmt(m.costPerSqft) : "—"} />
        </div>
      )}
    </aside>
  );
}
