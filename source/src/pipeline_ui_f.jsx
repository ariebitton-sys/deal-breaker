// ============================================================================
// v30 — FlipperForce-style structure: dashboards (Leads / Active projects / Portfolio),
// a Project overview hub per deal, tools grouped under Deal analysis / Project management /
// Accounting, deal health, board view, "coming up" across deals, and budget vs actual.
// ============================================================================

// ---------- deal health (derived from the same rules as "Needs attention") ----------
const HEALTH = {
  ok: { label: "On track", fg: "#1B7F4C", bg: "#E6F4EC" },
  watch: { label: "Watch", fg: "#9A5B05", bg: "#FDF0D8" },
  risk: { label: "At risk", fg: "#B42318", bg: "#FDECEA" },
};
function healthOf(s, today) {
  if (!s || !ACTIVE_STAGES.includes(s.st)) return null;
  const att = attentionFor(s, today);
  const red = att.find((a) => a.lvl === "red");
  const amb = att.find((a) => a.lvl === "amber");
  if (red) return { key: "risk", ...HEALTH.risk, reason: red.text, all: att };
  if (amb) return { key: "watch", ...HEALTH.watch, reason: amb.text, all: att };
  return { key: "ok", ...HEALTH.ok, reason: "Nothing needs attention", all: att };
}
function HealthPill({ h }) {
  if (!h) return null;
  return (
    <span className="hp" style={{ background: h.bg, color: h.fg }} title={h.all && h.all.length ? h.all.map((a) => a.text).join("\n") : h.reason}>
      <i style={{ background: h.fg }} />
      {h.label}
    </span>
  );
}
function StagePill({ st }) {
  const m = stageMeta(st);
  return (
    <span className="sp" style={{ color: m.color, background: `${m.color}12`, borderColor: `${m.color}38` }}>
      {m.label}
    </span>
  );
}

// ---------- dates coming up across every deal ----------
function upcomingFor(deals, today, days = 14) {
  const out = [];
  deals.forEach((d) => {
    const s = d.s;
    if (!s) return;
    const add = (date, label, onlyFuture) => {
      if (!date) return;
      const dd = daysBetween(today, date);
      if (dd == null || dd > days || dd < (onlyFuture ? 0 : -30)) return;
      out.push({ date, dd, label, d });
    };
    if (s.st === "contract") {
      add(s.ied, "Inspection period ends", true);
      add(s.ecd, "Purchase closing");
    }
    if (s.st === "rehab") add(s.rte, "Rehab target completion");
    if (s.st === "market" && s.bcd) add(s.bec, "Sale closing");
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- navigation ----------
const DASHBOARDS = [
  ["overview", "Overview", "grid"],
  ["leads", "Leads", "funnel"],
  ["active", "Active projects", "hammer"],
  ["portfolio", "Portfolio", "check"],
];
const DASH_META = {
  overview: { title: "Overview", sub: "Every live deal, from analysis to sale", stages: ["analyzing", "contract", "rehab", "market", "sold"] },
  leads: { title: "Leads", sub: "Deals you're analyzing and making offers on", stages: ["analyzing"] },
  active: { title: "Active projects", sub: "Under contract, in rehab and on the market", stages: ["contract", "rehab", "market"] },
  portfolio: { title: "Portfolio", sub: "Sold flips and how they did against the plan", stages: ["sold"] },
  dead: { title: "Dead deals", sub: "Deals that didn't go ahead", stages: ["dead"] },
};
// Older saved filters (v26–v29) map onto the new dashboards.
const normDash = (k) =>
  DASH_META[k] ? k : k === "analyzing" ? "leads" : ["contract", "rehab", "market"].includes(k) ? "active" : k === "sold" ? "portfolio" : "overview";
const dashOfStage = (st) => (st === "analyzing" ? "leads" : st === "sold" ? "portfolio" : st === "dead" ? "dead" : "active");
const PROJECT_NAV = [
  ["overview", "Project overview", "home", null],
  ["underwrite", "Flip analysis", "calc", "Deal analysis"],
  ["manage", "Stages and milestones", "cal", "Project management"],
  ["budget", "Budget vs actual", "chart", "Accounting"],
  ["actuals", "Expenses", "receipt", "Accounting"],
  ["docs", "Documents", "folder", null],
];
function Sidebar({ logo, view, filter, onFilter, counts, project, onNew, onSettings }) {
  let lastGroup = null;
  return (
    <aside className="sidebar no-print">
      <div className="sb-titleblock">
        <img src={logo} alt="Kappa Real Estate Investments" />
        <div className="sb-product">Deal Breaker</div>
      </div>
      <div className="sb-sep">Dashboards</div>
      <nav className="sb-nav" aria-label="Dashboards">
        {DASHBOARDS.map(([k, l, icn]) => (
          <button key={k} onClick={() => onFilter(k)} className={"sb-item" + (view === "portfolio" && filter === k ? " on" : "")}>
            <Icon name={icn} />
            <span className="sb-label">{l}</span>
            <em>{counts[k] || 0}</em>
          </button>
        ))}
        <button onClick={() => onFilter("dead")} className={"sb-item sb-minor" + (view === "portfolio" && filter === "dead" ? " on" : "")}>
          <Icon name="x" size={14} />
          <span className="sb-label">Dead deals</span>
          <em>{counts.dead || 0}</em>
        </button>
      </nav>
      {project && (
        <React.Fragment>
          <button className={"sb-project" + (view === "deal" ? " on" : "")} onClick={() => project.go(project.mode)} title={project.dirty ? "Unsaved changes" : "Open deal"}>
            <span className="sb-project-k">Project</span>
            <span className="sb-project-v">
              {project.name}
              {project.dirty && <span className="sb-dirty" />}
            </span>
            {project.context && <span className="sb-project-k">{project.context}</span>}
          </button>
          <nav className="sb-nav" aria-label="Project tools">
            {PROJECT_NAV.map(([k, l, icn, grp]) => {
              const head = grp && grp !== lastGroup ? grp : null;
              lastGroup = grp;
              return (
                <React.Fragment key={k}>
                  {head && <div className="sb-group">{head}</div>}
                  <button onClick={() => project.go(k)} className={"sb-item" + (grp ? " sub" : "") + (view === "deal" && project.mode === k ? " on" : "")}>
                    {!grp && <Icon name={icn} />}
                    <span className="sb-label">{l}</span>
                    {k === "actuals" && project.ledgerCount ? <em>{project.ledgerCount}</em> : null}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </React.Fragment>
      )}
      <div className="sb-grow" />
      <button className="sb-new" onClick={onNew}>
        <Icon name="plus" size={16} stroke={2.2} /> New deal
      </button>
      <button className="sb-link" onClick={onSettings} data-no-autoconnect="">
        <Icon name="settings" /> Settings
      </button>
    </aside>
  );
}
function TopBar({ crumbs, connected, userEmail, onConnect, finder, onBack }) {
  const [open, setOpen] = useState(false);
  const initials = (userEmail || "")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("");
  return (
    <div className="topbar no-print">
      {onBack && (
        <button className="tb-back" onClick={onBack} title="Back to the previous screen (Alt+←)" aria-label="Back to the previous screen">
          <Icon name="back" size={16} /> <span>Back</span>
        </button>
      )}
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.onClick ? (
              <button className="crumb" onClick={c.onClick}>
                {c.label}
              </button>
            ) : (
              <b>{c.label}</b>
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: "relative", marginLeft: "auto" }}>
        <button className="tb-search" onClick={() => connected && setOpen((o) => !o)} disabled={!connected} title={connected ? "Search every saved deal" : "Connect Google first"}>
          <Icon name="search" size={15} /> Search properties
        </button>
        {open && <DealFinder {...finder} onClose={() => setOpen(false)} />}
      </div>
      {connected ? (
        <span className="tb-avatar" title={userEmail || "Connected to Google"}>
          {initials || "K"}
        </span>
      ) : (
        <button className="tb-connect" onClick={onConnect}>
          Connect Google
        </button>
      )}
    </div>
  );
}
function ProjectTabs({ mode, go }) {
  return (
    <div className="tabs ptabs no-print" role="tablist">
      {PROJECT_NAV.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={mode === k} className={"tab" + (mode === k ? " on" : "")} onClick={() => go(k)}>
          {l.replace("Project overview", "Overview")}
        </button>
      ))}
    </div>
  );
}
function ProjectHeader({ address, setAddress, stage, health, context, dirty, saving, saveMsg, onSave, onExportCsv, onPrint, actions }) {
  const [menu, setMenu] = useState(false);
  const msgTone = saveMsg ? (saveMsg.startsWith("✓") ? T.green : saveMsg.startsWith("⚠") ? T.amber : T.red) : dirty ? T.amber : T.txtMute;
  const msg = saveMsg ? saveMsg.replace(/^[✓⚠❌]\s*/, "") : dirty ? "Unsaved changes" : "All changes saved";
  return (
    <div className="deal-head">
      <input className="dh-addr" placeholder="Property address" value={address} onChange={(e) => setAddress(e.target.value)} aria-label="Property address" />
      <div className="dh-row">
        <div className="dh-meta">
          <StagePill st={stage} />
          <HealthPill h={health} />
          {context && <span className="dh-context">{context}</span>}
        </div>
        <div className="dh-actions no-print">
          <span style={{ fontSize: 12.5, color: msgTone }}>{msg}</span>
          <button onClick={onSave} disabled={saving} title="Save to Drive (Ctrl+S)" style={dirty ? btnPrimary() : btnGhost()}>
            <Icon name="save" /> {saving ? "Saving…" : "Save deal"}
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenu((m) => !m)} style={btnGhost()} aria-expanded={menu}>
              Export <Icon name="down" size={14} />
            </button>
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => (setMenu(false), onExportCsv())}>
                  <Icon name="download" /> Download CSV
                </button>
                <button onClick={() => (setMenu(false), onPrint())}>
                  <Icon name="print" /> Print or save as PDF
                </button>
              </div>
            )}
          </div>
          {actions}
        </div>
      </div>
    </div>
  );
}

// ---------- dashboards ----------
const DASH_LAYOUT_KEY = "kappa_dash_layout";
function Dashboard({ filter: rawFilter, files, summaries, busy, connected, hasClientId, onConnect, onOpenSettings, onOpen, onNew, onRefresh }) {
  const filter = normDash(rawFilter);
  const meta = DASH_META[filter];
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("updated");
  const [stageF, setStageF] = useState("all");
  const [layout, setLayoutRaw] = useState(() => {
    try {
      return localStorage.getItem(DASH_LAYOUT_KEY) === "board" ? "board" : "table";
    } catch (e) {
      return "table";
    }
  });
  const setLayout = (v) => {
    setLayoutRaw(v);
    try {
      localStorage.setItem(DASH_LAYOUT_KEY, v);
    } catch (e) {}
  };
  useEffect(() => setStageF("all"), [filter]);
  const today = todayISO();
  const year = today.slice(0, 4);
  const deals = files.map((f) => {
    const s = summaries[f.id] || null;
    const [street, city] = splitAddress(f.name);
    return { f, s, street, city, att: attentionFor(s, today), h: healthOf(s, today) };
  });
  const inDash = (d) => (d.s ? meta.stages.includes(d.s.st) : filter === "overview");
  const mine = deals.filter(inDash);
  const ql = q.trim().toLowerCase();
  let shown = mine.filter((d) => (stageF === "all" || (d.s && d.s.st === stageF)) && (!ql || d.f.name.toLowerCase().includes(ql)));
  const stageOrder = (d) => (d.s ? (d.s.st === "dead" ? 9 : stageIdx(d.s.st)) : 10);
  const profitOf = (s) => (s ? (s.ap != null ? s.ap : s.np) : null);
  const hRank = (d) => (d.h ? { risk: 0, watch: 1, ok: 2 }[d.h.key] : 3);
  shown = [...shown].sort((a, b) => {
    if (sort === "profit") return (profitOf(b.s) ?? -1e12) - (profitOf(a.s) ?? -1e12);
    if (sort === "stage") return stageOrder(a) - stageOrder(b) || (b.f.modifiedTime || "").localeCompare(a.f.modifiedTime || "");
    if (sort === "attention") return hRank(a) - hRank(b) || b.att.length - a.att.length;
    return (b.f.modifiedTime || "").localeCompare(a.f.modifiedTime || "");
  });

  if (!connected)
    return (
      <React.Fragment>
        <DashHead title={meta.title} sub="Not connected to Google Drive" />
        <div className="pf-empty">
          <h2>Your flip portfolio</h2>
          <p>Connect Google Drive to see every deal, from analysis through rehab to sale, in one place.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {hasClientId ? (
              <button onClick={onConnect} style={btnPrimary()}>
                Connect Google
              </button>
            ) : (
              <button onClick={onOpenSettings} style={btnPrimary()}>
                Open settings
              </button>
            )}
            <button onClick={onNew} style={btnGhost()}>
              New deal
            </button>
          </div>
        </div>
      </React.Fragment>
    );

  // ---- tiles ----
  const S = deals.filter((d) => d.s).map((d) => d.s);
  const active = S.filter((s) => ACTIVE_STAGES.includes(s.st));
  const capital = active.reduce((t, s) => t + (s.st === "contract" ? s.emd || 0 : s.spent || s.pp || 0), 0);
  const projected = active.reduce((t, s) => t + (s.np || 0), 0);
  const sold = S.filter((s) => s.st === "sold");
  const soldYr = sold.filter((s) => (s.sd || "").startsWith(year));
  const realized = soldYr.reduce((t, s) => t + (s.ap || 0), 0);
  const flips = sold.filter((s) => s.acd && s.sd).map((s) => daysBetween(s.acd, s.sd));
  const avgDays = flips.length ? Math.round(flips.reduce((a, b) => a + b, 0) / flips.length) : null;
  const cnt = (st) => S.filter((s) => s.st === st).length;
  const leads = S.filter((s) => s.st === "analyzing");
  const rehabs = active.filter((s) => s.rb > 0 && (s.st === "rehab" || s.st === "market"));
  const rbSum = rehabs.reduce((t, s) => t + s.rb, 0);
  const rspSum = rehabs.reduce((t, s) => t + (s.rsp || 0), 0);
  const attDeals = mine.filter((d) => d.att.length && d.s && d.s.st !== "dead");
  const tiles = {
    overview: [
      ["Active projects", String(active.length), `${cnt("analyzing")} leads in analysis`],
      ["Capital deployed", fmt(capital), "spent so far plus deposits"],
      ["Forecast profit", fmt(projected), "active projects", projected < 0],
      [`Realized in ${year}`, fmt(realized), `${soldYr.length} sold this year`, realized < 0],
      ["Days to flip", avgDays != null ? String(avgDays) : "—", flips.length ? `average of ${flips.length} sold` : "no sold deals yet"],
    ],
    leads: [
      ["Leads", String(leads.length), "being analyzed"],
      ["Grade B- or better", String(leads.filter((s) => /^[AB]/.test(s.gr || "")).length), "meet or beat the target"],
      ["Offers out", String(leads.filter((s) => s.oa && /sent|counter/i.test(s.os || "")).length), "sent or countered"],
      ["Projected profit", fmt(leads.reduce((t, s) => t + Math.max(0, s.np || 0), 0)), "if every lead closes"],
    ],
    active: [
      ["Active projects", String(active.length), ["contract", "rehab", "market"].map((k) => `${cnt(k)} ${stageMeta(k).label.toLowerCase()}`).join(", ")],
      ["Capital deployed", fmt(capital), "spent so far plus deposits"],
      ["Forecast profit", fmt(projected), "across active projects", projected < 0],
      ["Rehab budget used", rbSum > 0 ? `${Math.round((rspSum / rbSum) * 100)}%` : "—", rbSum > 0 ? `${fmtK(rspSum)} of ${fmtK(rbSum)}` : "no rehab under way"],
      [
        "Needs attention",
        `${attDeals.length} ${attDeals.length === 1 ? "deal" : "deals"}`,
        attDeals.length ? `${attDeals.reduce((t, d) => t + d.att.length, 0)} alerts, ${attDeals.filter((d) => d.h && d.h.key === "risk").length} at risk` : "all on track",
        false,
        attDeals.some((d) => d.h && d.h.key === "risk"),
      ],
    ],
    portfolio: [
      ["Flips sold", String(sold.length), `${soldYr.length} this year`],
      [`Realized in ${year}`, fmt(realized), "actual profit", realized < 0],
      ["Average profit", sold.length ? fmt(sold.reduce((t, s) => t + (s.ap || 0), 0) / sold.length) : "—", "per flip"],
      ["Against the plan", sold.length ? (sold.reduce((t, s) => t + ((s.ap || 0) - (s.bnp != null ? s.bnp : s.np || 0)), 0) >= 0 ? "+" : "") + fmt(sold.reduce((t, s) => t + ((s.ap || 0) - (s.bnp != null ? s.bnp : s.np || 0)), 0)) : "—", "actual minus original plan"],
      ["Days to flip", avgDays != null ? String(avgDays) : "—", "purchase to sale, average"],
    ],
    dead: [["Dead deals", String(cnt("dead")), "kept for reference"]],
  }[filter];
  const upcoming = filter === "overview" || filter === "active" ? upcomingFor(mine, today) : [];
  const attention = attDeals
    .flatMap((d) => d.att.map((a) => ({ ...a, d })))
    .sort((a, b) => (a.lvl === b.lvl ? 0 : a.lvl === "red" ? -1 : 1));
  const canBoard = meta.stages.length > 1;
  const lay = canBoard ? layout : "table";

  return (
    <div>
      <DashHead
        title={meta.title}
        sub={`${meta.sub}. ${mine.length} ${mine.length === 1 ? "deal" : "deals"}.`}
        right={
          <React.Fragment>
            {busy && <span style={{ fontSize: 12.5, color: T.txtMute }}>Loading deals…</span>}
            {canBoard && (
              <div className="seg" role="group" aria-label="Layout">
                <button className={lay === "table" ? "on" : ""} onClick={() => setLayout("table")}>
                  <Icon name="list" size={15} /> Table
                </button>
                <button className={lay === "board" ? "on" : ""} onClick={() => setLayout("board")}>
                  <Icon name="board" size={15} /> Board
                </button>
              </div>
            )}
            <button onClick={onRefresh} style={btnGhost()}>
              <Icon name="refresh" /> Refresh
            </button>
          </React.Fragment>
        }
      />
      <div className={"pf-strip" + (tiles.length === 4 ? " strip-4" : tiles.length === 1 ? " strip-1" : "")}>
        {tiles.map(([k, v, h, neg, warn]) => (
          <div key={k}>
            <span>{k}</span>
            <b style={neg ? { color: T.red } : warn ? { color: T.red } : undefined}>{v}</b>
            <em>{h}</em>
          </div>
        ))}
      </div>

      {(upcoming.length > 0 || attention.length > 0) && (
        <div className="dash-pair">
          {(filter === "overview" || filter === "active") && <ComingUp items={upcoming} onOpen={onOpen} />}
          <AttentionList items={attention} onOpen={onOpen} />
        </div>
      )}

      <div className="pf-tools no-print">
        <span className="pf-search">
          <Icon name="search" size={15} />
          <input placeholder="Search by address" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search deals by address" />
        </span>
        {meta.stages.length > 1 && lay === "table" && (
          <div className="chips" role="group" aria-label="Stage">
            {["all", ...meta.stages].map((k) => (
              <button key={k} className={stageF === k ? "on" : ""} onClick={() => setStageF(k)}>
                {k === "all" ? "All" : stageMeta(k).label}
                <em>{k === "all" ? mine.length : mine.filter((d) => d.s && d.s.st === k).length}</em>
              </button>
            ))}
          </div>
        )}
        {lay === "table" && (
          <label className="pf-sort">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="updated">Recently updated</option>
              <option value="attention">Needs attention first</option>
              <option value="stage">By stage</option>
              <option value="profit">Highest profit</option>
            </select>
          </label>
        )}
      </div>

      {shown.length === 0 && lay === "table" ? (
        <div className="pf-none">
          {files.length === 0 ? (
            <React.Fragment>
              No deals in Drive yet.{" "}
              <button onClick={onNew} className="link-btn">
                Start a new deal
              </button>
            </React.Fragment>
          ) : ql ? (
            `No deals match “${q}”.`
          ) : (
            `No deals in ${meta.title.toLowerCase()} yet.`
          )}
        </div>
      ) : lay === "board" ? (
        <Board stages={meta.stages} deals={shown} today={today} onOpen={onOpen} />
      ) : (
        <DealTable filter={filter} deals={shown} today={today} onOpen={onOpen} />
      )}
    </div>
  );
}
function DashHead({ title, sub, right }) {
  return (
    <div className="pf-head">
      <div>
        <h1 className="pf-title">{title}</h1>
        <div className="dh-meta" style={{ marginTop: 4 }}>
          {sub}
        </div>
      </div>
      {right && <div className="dh-actions">{right}</div>}
    </div>
  );
}
function ComingUp({ items, onOpen }) {
  return (
    <section className="dcard">
      <div className="dcard-h">
        <Icon name="cal" /> Coming up
        <span className="dcard-r">next 14 days</span>
      </div>
      {items.length === 0 ? (
        <div className="dcard-empty">No closings or deadlines in the next two weeks.</div>
      ) : (
        items.slice(0, 7).map((x, i) => (
          <button key={i} className="cu-row" onClick={() => onOpen(x.d.f)}>
            <span className={"cu-date" + (x.dd < 0 ? " late" : x.dd <= 3 ? " soon" : "")}>{x.dd < 0 ? `${-x.dd}d overdue` : fmtDateShort(x.date)}</span>
            <span className="cu-label">{x.label}</span>
            <span className="cu-deal">{x.d.street}</span>
          </button>
        ))
      )}
    </section>
  );
}
function AttentionList({ items, onOpen }) {
  const [all, setAll] = useState(false);
  const list = all ? items : items.slice(0, 6);
  return (
    <section className="dcard">
      <div className="dcard-h">
        <Icon name="alert" /> Needs attention
        <span className="dcard-r">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="dcard-empty">Nothing needs attention.</div>
      ) : (
        list.map((a, i) => (
          <button key={i} className="cu-row" onClick={() => onOpen(a.d.f)}>
            <i className={"att-dot" + (a.lvl === "red" ? " red" : "")} />
            <span className="cu-label">
              <b>{a.d.street}</b> {a.text}
            </span>
            <span className="cu-deal">{stageMeta(a.d.s.st).label}</span>
          </button>
        ))
      )}
      {items.length > 6 && (
        <button className="pf-att-more" onClick={() => setAll((x) => !x)}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}
function Board({ stages, deals, today, onOpen }) {
  return (
    <div className="board" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(250px, 1fr))` }}>
      {stages.map((st) => {
        const col = deals.filter((d) => d.s && d.s.st === st);
        const sum = col.reduce((t, d) => t + ((d.s.ap != null ? d.s.ap : d.s.np) || 0), 0);
        return (
          <section key={st} className="board-col">
            <div className="board-h">
              <span className="sb-dot" style={{ background: stageMeta(st).color }} />
              <b>{stageMeta(st).label}</b>
              <em>{col.length}</em>
              <span>{col.length ? fmtK(sum) : ""}</span>
            </div>
            {col.length === 0 && <div className="board-empty">No deals</div>}
            {col.map((d) => (
              <DealCard key={d.f.id} d={d} today={today} onOpen={onOpen} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
function BudgetBar({ spent, budget, work, h = 6 }) {
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const color = pct > 110 ? T.red : pct > 100 || (work != null && pct - work > 25) ? "#C27C0E" : T.navy;
  return (
    <div className="bb" style={{ height: h }}>
      <i style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      {work != null && <b style={{ left: `${Math.max(0, Math.min(100, work))}%` }} title={`Work ${work}% done`} />}
    </div>
  );
}
function DealTable({ filter, deals, today, onOpen }) {
  const prop = (d) => (
    <div className="dt-prop">
      <b>{d.street}</b>
      <span>{d.city}</span>
    </div>
  );
  const status = (d) =>
    d.h ? (
      <div className="dt-status">
        <HealthPill h={d.h} />
        {d.h.key !== "ok" && <span>{d.h.reason}</span>}
      </div>
    ) : (
      <span className="dt-mute">—</span>
    );
  const grade = (s) => <b className="dt-grade" style={{ color: s.gr === "REJECT" ? T.red : T.txt }}>{s.gr === "REJECT" ? "Reject" : s.gr}</b>;
  const money = (v) => (v == null ? <span className="dt-mute">—</span> : <span style={v < 0 ? { color: T.red } : undefined}>{fmt(v)}</span>);
  const timeline = (s) => {
    if (s.st === "contract") {
      const dc = daysBetween(today, s.ecd);
      return s.ecd ? (
        <div className="dt-two">
          <span>Closing {fmtDateShort(s.ecd)}</span>
          <em style={dc != null && dc < 0 ? { color: T.red } : undefined}>{relDays(dc)}</em>
        </div>
      ) : (
        "No closing date"
      );
    }
    if (s.st === "rehab") {
      const st = s.rs || s.acd;
      const day = daysBetween(st, today);
      const plan = daysBetween(st, s.rte);
      return (
        <div className="dt-two">
          <span>{day != null ? `Day ${Math.max(0, day)}${plan ? ` of ${plan}` : ""}` : "Not started"}</span>
          <em style={plan != null && day > plan ? { color: T.red } : undefined}>{s.rte ? `target ${fmtDateShort(s.rte)}` : ""}</em>
        </div>
      );
    }
    if (s.st === "market") {
      const dom = daysBetween(s.ld, today);
      return (
        <div className="dt-two">
          <span>{s.bcd ? "Sale pending" : dom != null ? `${dom} days listed` : "Listed"}</span>
          <em>{s.bcd ? (s.bec ? `closing ${fmtDateShort(s.bec)}` : "") : s.ld ? `since ${fmtDateShort(s.ld)}` : ""}</em>
        </div>
      );
    }
    return "—";
  };
  const budget = (s) =>
    s.st === "contract" ? (
      <span className="dt-mute">{s.rb ? `${fmtK(s.rb)} budget, not started` : "—"}</span>
    ) : s.rb > 0 ? (
      <div className="dt-budget">
        <div>
          <span>
            {fmtK(s.rsp || 0)} of {fmtK(s.rb)}
          </span>
          <em>{Math.round(((s.rsp || 0) / s.rb) * 100)}%</em>
        </div>
        <BudgetBar spent={s.rsp || 0} budget={s.rb} work={s.st === "rehab" ? s.mp : null} />
      </div>
    ) : (
      <span className="dt-mute">—</span>
    );
  const nextUp = (s) => {
    if (s.st === "contract") {
      const di = daysBetween(today, s.ied);
      return di != null && di >= 0 ? `Inspection ends ${relDays(di)}` : s.ecd ? `Closing ${relDays(daysBetween(today, s.ecd))}` : "Set a closing date";
    }
    if (s.st === "rehab") return s.nm || (s.mp >= 100 ? "Ready to list" : "—");
    if (s.st === "market") return s.bcd ? "Buyer under contract" : s.lp ? `Listed at ${fmt(s.lp)}` : "—";
    return "—";
  };
  const updated = (d) => {
    const u = d.f.lastModifyingUser;
    return (
      <div className="dt-two">
        <span>{d.f.modifiedTime ? fmtDateShort(isoOf(new Date(d.f.modifiedTime))) : "—"}</span>
        <em>{u && (u.displayName || u.emailAddress) ? u.displayName || nameOnly(u.emailAddress) : ""}</em>
      </div>
    );
  };
  const cols = {
    overview: [
      ["Property", (d) => prop(d)],
      ["Stage", (d) => <StagePill st={d.s.st} />],
      ["Status", (d) => status(d)],
      ["Grade", (d) => grade(d.s)],
      ["Profit", (d) => <div className="dt-two">{money(d.s.ap != null ? d.s.ap : d.s.np)}<em>{d.s.ap != null ? "actual" : "forecast"}</em></div>, "num"],
      ["Updated", (d) => updated(d)],
    ],
    leads: [
      ["Property", (d) => prop(d)],
      ["Grade", (d) => grade(d.s)],
      ["Buy / ARV", (d) => `${fmtK(d.s.pp)} / ${fmtK(d.s.arv)}`],
      ["Rehab", (d) => fmtK(d.s.rp), "num"],
      ["Projected profit", (d) => money(d.s.np), "num"],
      ["Last offer", (d) => (d.s.oa ? <div className="dt-two"><span>{fmt(d.s.oa)}</span><em>{d.s.os || ""}</em></div> : <span className="dt-mute">None yet</span>)],
      ["Updated", (d) => updated(d)],
    ],
    active: [
      ["Property", (d) => prop(d)],
      ["Stage", (d) => <StagePill st={d.s.st} />],
      ["Status", (d) => status(d)],
      ["Timeline", (d) => timeline(d.s)],
      ["Rehab budget vs actual", (d) => budget(d.s)],
      ["Forecast profit", (d) => money(d.s.np), "num"],
      ["Next up", (d) => <span className="dt-next">{nextUp(d.s)}</span>],
    ],
    portfolio: [
      ["Property", (d) => prop(d)],
      ["Sold", (d) => (d.s.sd ? fmtDate(d.s.sd) : "—")],
      ["Hold", (d) => (d.s.acd && d.s.sd ? `${monthsBetween(d.s.acd, d.s.sd).toFixed(1)} mo` : "—")],
      ["Sale price", (d) => money(d.s.sp), "num"],
      ["Actual profit", (d) => money(d.s.ap), "num"],
      [
        "Against plan",
        (d) => {
          const plan = d.s.bnp != null ? d.s.bnp : d.s.np;
          const v = d.s.ap != null && plan != null ? d.s.ap - plan : null;
          return v == null ? <span className="dt-mute">—</span> : <span style={{ color: v >= 0 ? T.green : T.red }}>{(v >= 0 ? "+" : "") + fmt(v)}</span>;
        },
        "num",
      ],
      ["Grade", (d) => grade(d.s)],
    ],
    dead: [
      ["Property", (d) => prop(d)],
      ["Reason", (d) => d.s.dr || "—"],
      ["Since", (d) => (d.s.dd ? fmtDate(d.s.dd) : "—")],
      ["Was in", (d) => stageMeta(d.s.dfs || "analyzing").label],
      ["Projected profit", (d) => money(d.s.np), "num"],
    ],
  }[filter];
  return (
    <div className="dt-wrap">
      <table className="dt">
        <thead>
          <tr>
            {cols.map(([h, , cls]) => (
              <th key={h} className={cls || ""}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((d) =>
            d.s ? (
              <tr key={d.f.id} className="dt-row" tabIndex={0} onClick={() => onOpen(d.f)} onKeyDown={(e) => e.key === "Enter" && onOpen(d.f)}>
                {cols.map(([h, r, cls]) => (
                  <td key={h} className={cls || ""}>
                    {r(d)}
                  </td>
                ))}
              </tr>
            ) : (
              <tr key={d.f.id} className="dt-row" onClick={() => onOpen(d.f)}>
                <td>{prop(d)}</td>
                <td colSpan={cols.length - 1} className="dt-mute">
                  Reading…
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

// ---------- project overview (the hub of each deal) ----------
function OvCard({ icon, title, onOpen, openLabel, children, className }) {
  return (
    <section className={"dcard " + (className || "")}>
      <div className="dcard-h">
        <Icon name={icon} /> {title}
        {onOpen && (
          <button className="dcard-link" onClick={onOpen}>
            {openLabel || "Open"} <Icon name="chevron" size={14} />
          </button>
        )}
      </div>
      <div className="dcard-b">{children}</div>
    </section>
  );
}
function OvStat({ k, v, h, tone, big }) {
  return (
    <div className={"ov-stat" + (big ? " big" : "")}>
      <span>{k}</span>
      <b style={tone ? { color: tone } : undefined}>{v}</b>
      {h && <em>{h}</em>}
    </div>
  );
}
function ProjectOverview({ address, mapsKey, folderId, photosUrl, sqft, yearBuilt, arv, purchase, stage, mgmt, setMgmt, m, deal, mao, uwBaseline, actuals, actualSale, analysisDate, health, onGo }) {
  const today = todayISO();
  const [street, city] = splitAddress(address || "");
  const q = encodeURIComponent((address || "").trim());
  const links = [
    address.trim() && ["Zillow", `https://www.zillow.com/homes/${q}_rb/`, "link"],
    address.trim() && ["Google Maps", `https://www.google.com/maps/search/?api=1&query=${q}`, "map"],
    folderId && ["Drive folder", `https://drive.google.com/drive/folders/${folderId}`, "folder"],
    photosUrl && ["Photos", photosUrl, "camera"],
  ].filter(Boolean);
  const dates = {
    analyzing: analysisDate,
    contract: mgmt.contract.date,
    rehab: mgmt.closing.date,
    market: mgmt.listing.date,
    sold: mgmt.sale.date,
  };
  const dead = stage === "dead";
  const curIdx = dead ? Math.max(0, stageIdx((mgmt.dead && mgmt.dead.fromStage) || "analyzing")) : Math.max(0, stageIdx(stage));
  // ---- project management card ----
  const ms = mgmt.rehab.milestones || [];
  const mp = milestonePct(ms);
  const doing = ms.find((x) => x.status === "doing");
  const nextMs = ms.find((x) => x.status === "todo");
  const ck = (k) => {
    const items = (mgmt.checklists && mgmt.checklists[k]) || [];
    return items.length ? `${items.filter((i) => i.done).length} of ${items.length} done` : "—";
  };
  const rehabStart = mgmt.rehab.startDate || mgmt.closing.date;
  const rDay = daysBetween(rehabStart, today);
  const rPlan = daysBetween(rehabStart, mgmt.rehab.targetEnd);
  let pm;
  if (stage === "analyzing") {
    const lo = mgmt.offers[mgmt.offers.length - 1];
    pm = (
      <React.Fragment>
        <div className="ov-pair">
          <OvStat k="Offers made" v={String(mgmt.offers.length)} h={lo ? `last ${fmt(num(lo.amount))}, ${lo.status.toLowerCase()}` : "none yet"} big />
          <OvStat k="Lead source" v={mgmt.source || "—"} />
        </div>
        <div className="ov-list">
          <div>
            <span>Next step</span>
            <em>{lo && lo.status === "Accepted" ? "Mark under contract" : "Make an offer"}</em>
          </div>
        </div>
      </React.Fragment>
    );
  } else if (stage === "contract") {
    const dc = daysBetween(today, mgmt.contract.expectedClosing);
    const di = daysBetween(today, mgmt.contract.inspectionEnd);
    pm = (
      <React.Fragment>
        <div className="ov-pair">
          <OvStat k="Closing" v={dc == null ? "—" : dc < 0 ? `${-dc} days late` : `${dc} days`} h={fmtDate(mgmt.contract.expectedClosing)} tone={dc != null && dc < 0 ? T.red : undefined} big />
          <OvStat k="Inspection period" v={di == null ? "—" : di < 0 ? "Ended" : `${di} days left`} h={fmtDate(mgmt.contract.inspectionEnd)} />
        </div>
        <div className="ov-list">
          <div>
            <span>Contract checklist</span>
            <em>{ck("contract")}</em>
          </div>
          <div>
            <span>Earnest money</span>
            <em>{fmt(num(mgmt.contract.emd))}</em>
          </div>
        </div>
      </React.Fragment>
    );
  } else if (stage === "rehab") {
    pm = (
      <React.Fragment>
        <div className="ov-pair">
          <OvStat k="Rehab day" v={rDay == null ? "—" : String(Math.max(0, rDay))} h={rPlan ? `of ${rPlan} planned` : ""} tone={rPlan != null && rDay > rPlan ? T.red : undefined} big />
          <OvStat k="Work complete" v={mp == null ? "—" : `${mp}%`} big />
        </div>
        <div className="bb" style={{ height: 6, marginTop: 4 }}>
          <i style={{ width: `${mp || 0}%`, background: T.green }} />
        </div>
        <div className="ov-list">
          {doing && (
            <div>
              <span>{doing.label}</span>
              <em className="tag-doing">In progress</em>
            </div>
          )}
          {nextMs && (
            <div>
              <span>{nextMs.label}</span>
              <em>Next</em>
            </div>
          )}
          <div>
            <span>Rehab checklist</span>
            <em>{ck("rehab")}</em>
          </div>
        </div>
      </React.Fragment>
    );
  } else if (stage === "market") {
    const dom = daysBetween(mgmt.listing.date, mgmt.buyer.date || today);
    const offers = (mgmt.listing.offers || []).length;
    pm = (
      <React.Fragment>
        <div className="ov-pair">
          <OvStat k="Days on market" v={dom == null ? "—" : String(dom)} h={mgmt.buyer.date ? "sale pending" : `listed ${fmtDateShort(mgmt.listing.date)}`} big />
          <OvStat k="List price" v={fmt(num(mgmt.listing.price))} h={mgmt.listing.prices.length > 1 ? `was ${fmt(num(mgmt.listing.prices[0].price))}` : ""} />
        </div>
        <div className="ov-list">
          <div>
            <span>Offers received</span>
            <em>{offers}</em>
          </div>
          <div>
            <span>Buyer</span>
            <em>{mgmt.buyer.date ? `under contract, closing ${fmtDateShort(mgmt.buyer.expectedClosing)}` : "none yet"}</em>
          </div>
          <div>
            <span>Listing checklist</span>
            <em>{ck("market")}</em>
          </div>
        </div>
      </React.Fragment>
    );
  } else if (stage === "sold") {
    const hold = monthsBetween(mgmt.closing.date, mgmt.sale.date);
    pm = (
      <div className="ov-pair">
        <OvStat k="Hold time" v={hold == null ? "—" : `${hold.toFixed(1)} mo`} h={uwBaseline ? `planned ${uwBaseline.inputs.holdMonths} mo` : ""} big />
        <OvStat k="Sold" v={fmtDate(mgmt.sale.date)} h={actualSale > 0 ? fmt(actualSale) : ""} />
      </div>
    );
  } else {
    pm = (
      <div className="ov-pair">
        <OvStat k="Status" v="Dead" tone={T.red} h={mgmt.dead ? mgmt.dead.reason : ""} big />
        <OvStat k="Since" v={fmtDate(mgmt.dead && mgmt.dead.date)} />
      </div>
    );
  }
  // ---- accounting card ----
  const spent = sumActuals(actuals);
  const rSpent = sumActuals(actuals, "Rehab / Construction");
  const rBudget = uwBaseline ? uwBaseline.m.repair : m.repair;
  const plan = uwBaseline ? uwBaseline.m.netProfit : m.netProfit;
  const actualProfit = actualSale - spent;
  // ---- key dates ----
  const c = mgmt.contract;
  const tx = [
    ["Contract signed", c.date],
    ["Inspection period ends", c.inspectionEnd],
    [mgmt.closing.date ? "Purchase closed" : "Expected closing", mgmt.closing.date || c.expectedClosing],
    ["Listed", mgmt.listing.date],
    ["Buyer under contract", mgmt.buyer.date],
    [mgmt.sale.date ? "Sold" : "Expected sale closing", mgmt.sale.date || mgmt.buyer.expectedClosing],
  ];
  const cx = [
    ["Rehab start", mgmt.rehab.startDate],
    [mgmt.rehab.endDate ? "Rehab completed" : "Target completion", mgmt.rehab.endDate || mgmt.rehab.targetEnd],
  ];
  const dateRow = ([l, d]) => {
    const dd = d ? daysBetween(today, d) : null;
    return (
      <div key={l} className="ov-date">
        <span>{l}</span>
        <em>
          {d ? fmtDate(d) : "—"}
          {d && dd > 0 && dd <= 30 ? <small>{relDays(dd)}</small> : null}
        </em>
      </div>
    );
  };
  const log = (mgmt.log || []).slice(0, 4);
  return (
    <div className="ov">
      <section className="dcard ov-prop">
        <div className="ov-map">
          {mapsKey && address.trim() ? (
            <iframe title="Property location" loading="lazy" src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${q}`} />
          ) : (
            <a href={address.trim() ? `https://www.google.com/maps/search/?api=1&query=${q}` : undefined} target="_blank" rel="noopener noreferrer" className="ov-map-ph">
              <Icon name="map" size={26} />
              <span>{address.trim() ? "Open in Google Maps" : "Add an address"}</span>
            </a>
          )}
        </div>
        <div className="ov-facts">
          <div className="ov-city">{city || street || "No address yet"}</div>
          <div className="ov-factrow">
            <OvStat k="ARV" v={fmt(arv)} />
            <OvStat k="Purchase" v={fmt(purchase)} />
            <OvStat k="Size" v={sqft ? `${Number(sqft).toLocaleString("en-US")} sq ft` : "—"} />
            <OvStat k="Built" v={yearBuilt ? String(yearBuilt) : "—"} />
          </div>
          {links.length > 0 && (
            <div className="ov-links">
              {links.map(([l, href, icn]) => (
                <a key={l} href={href} target="_blank" rel="noopener noreferrer">
                  <Icon name={icn} size={14} /> {l}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="dcard ov-track">
        <ol className="trk" aria-label="Deal stage">
          {STAGES.map((s, i) => {
            const on = i <= curIdx;
            const cur = i === curIdx && !dead && s.key !== "sold";
            return (
              <li key={s.key} className={"trk-st" + (on ? " on" : "") + (cur ? " cur" : "")} aria-current={cur ? "step" : undefined}>
                <span className="trk-tick" />
                <span className="trk-l">{s.label}</span>
                <span className="trk-d">{on && dates[s.key] ? fmtDateShort(dates[s.key]) : ""}</span>
              </li>
            );
          })}
        </ol>
        {health && health.key !== "ok" && (
          <div className="ov-health">
            <HealthPill h={health} />
            <span>{health.all.map((a) => a.text).join(". ")}.</span>
          </div>
        )}
      </section>
      <div className="ov-console">
        <OvCard icon="calc" title="Deal analysis" onOpen={() => onGo("underwrite")} openLabel="Flip analysis">
          <div className="ov-grade">
            <div className="ov-letter" style={{ color: deal.grade === "REJECT" ? T.red : T.txt }}>
              {deal.grade === "REJECT" ? "Reject" : deal.grade}
            </div>
            <OvStat k={stage === "sold" ? "Underwritten profit" : "Forecast profit"} v={deal.incomplete ? "—" : fmt(m.netProfit)} h={uwBaseline ? `original plan ${fmt(uwBaseline.m.netProfit)}` : `Risk ${deal.riskLevel} target ${fmt(deal.threshold)}`} tone={m.netProfit < 0 ? T.red : undefined} big />
          </div>
          <div className="ov-grid4">
            <OvStat k="ARV" v={fmt(arv)} />
            <OvStat k="Max offer" v={deal.incomplete || mao.target == null ? "—" : fmt(mao.target)} />
            <OvStat k="ROI" v={deal.incomplete ? "—" : pct(m.roi)} />
            <OvStat k="Kappa cash" v={deal.incomplete ? "—" : fmt(m.cashIn)} />
          </div>
        </OvCard>
        <OvCard icon="cal" title="Project management" onOpen={() => onGo("manage")} openLabel="Stages and milestones">
          {pm}
        </OvCard>
        <OvCard icon="chart" title="Accounting" onOpen={() => onGo("budget")} openLabel="Budget vs actual">
          {stage === "sold" ? (
            <React.Fragment>
              <div className="ov-pair">
                <OvStat k="Actual profit" v={fmt(actualProfit)} tone={actualProfit < 0 ? T.red : undefined} big />
                <OvStat k="Against plan" v={(actualProfit - plan >= 0 ? "+" : "") + fmt(actualProfit - plan)} tone={actualProfit - plan >= 0 ? T.green : T.red} h={`plan ${fmt(plan)}`} />
              </div>
              <div className="ov-list">
                <div>
                  <span>Total spent</span>
                  <em>{fmt(spent)}</em>
                </div>
                <div>
                  <span>Ledger entries</span>
                  <em>{actuals.length}</em>
                </div>
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="ov-pair">
                <OvStat k="Rehab spent" v={fmt(rSpent)} big />
                <OvStat k="Rehab budget" v={fmt(rBudget)} />
              </div>
              <BudgetBar spent={rSpent} budget={rBudget} work={stage === "rehab" ? mp : null} />
              <div className="ov-note">
                {rBudget > 0 ? `${Math.round((rSpent / rBudget) * 100)}% of budget spent${stage === "rehab" && mp != null ? `, ${mp}% of work done` : ""}` : "No rehab budget yet"}
              </div>
              <div className="ov-list">
                <div>
                  <span>Total spent</span>
                  <em>{fmt(spent)}</em>
                </div>
                <div>
                  <span>Ledger entries</span>
                  <em>{actuals.length}</em>
                </div>
              </div>
            </React.Fragment>
          )}
        </OvCard>
      </div>
      {stage !== "dead" && <UtilitiesCard address={address} stage={stage} mgmt={mgmt} setMgmt={setMgmt} />}
      <div className="ov-lower">
        <OvCard icon="cal" title="Key dates">
          <div className="ov-k">Transaction</div>
          {tx.map(dateRow)}
          <div className="ov-k" style={{ marginTop: 12 }}>
            Construction
          </div>
          {cx.map(dateRow)}
        </OvCard>
        <OvCard icon="pulse" title="Recent activity" onOpen={() => onGo("manage")} openLabel="Activity log">
          {log.length === 0 && <div className="dcard-empty">Stage changes and updates show up here.</div>}
          {log.map((l) => (
            <div key={l.id} className="ov-log">
              <em>
                {fmtTs(l.ts)}
                {l.by ? `, ${nameOnly(l.by)}` : ""}
              </em>
              <span>{l.text}</span>
            </div>
          ))}
        </OvCard>
        <OvCard icon="users" title="Contacts" onOpen={() => onGo("docs")} openLabel="Documents">
          {(mgmt.contacts || []).length === 0 && <div className="dcard-empty">No contacts yet. Add the title company, lender and contractor.</div>}
          {(mgmt.contacts || []).slice(0, 4).map((c) => (
            <div key={c.id} className="ov-log">
              <span style={{ fontWeight: 600 }}>{c.name || c.company || "—"}</span>
              <em>{[c.role, c.company && c.name ? c.company : "", c.phone].filter(Boolean).join(", ")}</em>
            </div>
          ))}
        </OvCard>
      </div>
    </div>
  );
}

// ---------- accounting: budget vs actual ----------
const RB_UNASSIGNED = "";
// The rehab budget's lines: SOW/milestone budgets when there are any, otherwise the itemized
// repair estimate, otherwise one line for the whole rehab.
function rehabBudgetLines({ milestones, repairs, useRepairBuilder, repairTotal }) {
  const ms = milestones || [];
  if (ms.some((x) => num(x.budget) > 0))
    return { kind: "milestones", lines: ms.map((x) => ({ key: "ms:" + x.id, label: x.label, budget: num(x.budget), status: x.status })) };
  if (useRepairBuilder) {
    const items = (repairs || []).filter((r) => r.qty > 0).map((r) => ({ key: `ri:${r.group}/${r.label}`, label: r.label, group: r.group, budget: r.lump ? r.price : r.qty * r.price }));
    if (items.length) return { kind: "items", lines: items };
  }
  return { kind: "total", lines: [{ key: "rehab", label: "Rehab (one total)", budget: repairTotal }] };
}
function BudgetVsActual({ m, uwBaseline, actuals, setActuals, mgmt, repairs, useRepairBuilder, repairTotal, arv, actualSale, stage, onGo }) {
  const [openLine, setOpenLine] = useState(null);
  const P = uwBaseline ? uwBaseline.m : m;
  const cats = [
    ["Acquisition", (P.purchase || 0) + (P.totalBuying || 0), "purchase price and buying costs"],
    ["Rehab / Construction", P.repair || 0, "rehab estimate"],
    ["Financing", P.totalFinancing || 0, "interest, points, investor return"],
    ["Holding", P.totalHolding || 0, "taxes, insurance, utilities"],
    ["Selling", P.totalSelling || 0, "commission, title, transfer"],
    ["Services", 0, "not budgeted"],
    ["Other", 0, "not budgeted"],
  ].map(([cat, budget, note]) => {
    const actual = sumActuals(actuals, cat);
    return { cat, budget, note, actual, projected: Math.max(actual, budget) };
  });
  const totBudget = cats.reduce((t, c) => t + c.budget, 0);
  const totActual = cats.reduce((t, c) => t + c.actual, 0);
  const totProjected = cats.reduce((t, c) => t + c.projected, 0);
  const saleBasis = actualSale > 0 ? actualSale : arv;
  const projProfit = saleBasis - totProjected;
  const planProfit = P.netProfit != null ? P.netProfit : (uwBaseline ? uwBaseline.inputs.arv : arv) - totBudget;
  // rehab lines
  const RL = rehabBudgetLines({ milestones: mgmt.rehab.milestones, repairs, useRepairBuilder, repairTotal });
  const keys = new Set(RL.lines.map((l) => l.key));
  const rehabEntries = actuals.filter((a) => a.cat === "Rehab / Construction");
  const lineOf = (a) => (RL.lines.length === 1 && RL.kind === "total" ? "rehab" : a.bl && keys.has(a.bl) ? a.bl : RB_UNASSIGNED);
  const lineRows = RL.lines.map((l) => {
    const entries = rehabEntries.filter((a) => lineOf(a) === l.key);
    return { ...l, entries, actual: entries.reduce((t, a) => t + (parseFloat(a.amount) || 0), 0) };
  });
  const unassigned = rehabEntries.filter((a) => lineOf(a) === RB_UNASSIGNED);
  const unassignedTotal = unassigned.reduce((t, a) => t + (parseFloat(a.amount) || 0), 0);
  const lineBudgetTotal = lineRows.reduce((t, l) => t + l.budget, 0);
  const assign = (id, key) => setActuals((p) => p.map((a) => (a.id === id ? { ...a, bl: key || undefined } : a)));
  const varCell = (budget, actual) => {
    const v = budget - actual;
    if (!budget && !actual) return <span className="dt-mute">—</span>;
    return <span style={{ color: v < 0 ? T.red : T.txt }}>{v < 0 ? `${fmt(-v)} over` : `${fmt(v)} left`}</span>;
  };
  const entryRow = (a, current) => (
    <div key={a.id} className="ba-entry">
      <span className="ba-entry-d">{a.date ? fmtDateShort(a.date) : ""}</span>
      <span className="ba-entry-l">{a.label || "—"}</span>
      <span className="ba-entry-a">{fmt(parseFloat(a.amount) || 0)}</span>
      {RL.kind !== "total" && (
        <select value={current} onChange={(e) => assign(a.id, e.target.value)} aria-label={`Budget line for ${a.label || "expense"}`}>
          <option value="">Unassigned</option>
          {RL.lines.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
  return (
    <div className="ba">
      <div className="pf-strip strip-4">
        <div title={uwBaseline ? `Original underwriting, frozen ${fmtDate(uwBaseline.date)}` : "Current underwriting (no original snapshot yet)"}>
          <span>Project budget</span>
          <b>{fmt(totBudget)}</b>
          <em>{uwBaseline ? `original plan, ${fmtDateShort(uwBaseline.date)}` : "current underwriting"}</em>
        </div>
        <div>
          <span>Spent so far</span>
          <b>{fmt(totActual)}</b>
          <em>{totBudget > 0 ? `${Math.round((totActual / totBudget) * 100)}% of budget` : " "}</em>
        </div>
        <div>
          <span>Projected final cost</span>
          <b style={totProjected > totBudget ? { color: T.red } : undefined}>{fmt(totProjected)}</b>
          <em>{totProjected > totBudget ? `${fmt(totProjected - totBudget)} over budget` : "on budget so far"}</em>
        </div>
        <div title="Sale price (actual, or ARV until it sells) minus the projected final cost. Each category counts at its budget, or at what's already spent if that's more.">
          <span>Projected profit</span>
          <b style={projProfit < 0 ? { color: T.red } : undefined}>{fmt(projProfit)}</b>
          <em>
            plan {fmt(planProfit)}, {actualSale > 0 ? "at the actual sale price" : "at the ARV"}
          </em>
        </div>
      </div>

      <section className="dcard">
        <div className="dcard-h">
          <Icon name="chart" /> Project budget by category
          <button className="dcard-link" onClick={() => onGo("actuals")}>
            Expenses <Icon name="chevron" size={14} />
          </button>
        </div>
        <div className="dt-wrap flush">
          <table className="dt ba-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Budget</th>
                <th className="num">Actual</th>
                <th className="num">Remaining</th>
                <th style={{ width: "26%" }}>Used</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.cat}>
                  <td>
                    <div className="dt-prop">
                      <b>{c.cat === "Rehab / Construction" ? "Rehab" : c.cat}</b>
                      <span>{c.note}</span>
                    </div>
                  </td>
                  <td className="num">{c.budget ? fmt(c.budget) : <span className="dt-mute">—</span>}</td>
                  <td className="num">{c.actual ? fmt(c.actual) : <span className="dt-mute">—</span>}</td>
                  <td className="num">{varCell(c.budget, c.actual)}</td>
                  <td>
                    {c.budget > 0 ? (
                      <div className="dt-budget">
                        <div>
                          <span />
                          <em>{Math.round((c.actual / c.budget) * 100)}%</em>
                        </div>
                        <BudgetBar spent={c.actual} budget={c.budget} />
                      </div>
                    ) : c.actual > 0 ? (
                      <span style={{ fontSize: 12.5, color: "#9A5B05" }}>Not in the budget</span>
                    ) : null}
                  </td>
                </tr>
              ))}
              <tr className="ba-total">
                <td>Total</td>
                <td className="num">{fmt(totBudget)}</td>
                <td className="num">{fmt(totActual)}</td>
                <td className="num">{varCell(totBudget, totActual)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="dcard">
        <div className="dcard-h">
          <Icon name="hammer" /> Rehab budget by line
          <span className="dcard-r">
            {RL.kind === "milestones" ? "from the milestones (SOW)" : RL.kind === "items" ? "from the itemized estimate" : "one total amount"}
          </span>
        </div>
        {RL.kind === "total" && (
          <div className="ba-hint">
            Read a contractor's SOW or itemize the rehab estimate to track the budget line by line. <button className="link-btn" onClick={() => onGo("underwrite")}>Open the rehab estimate</button>
          </div>
        )}
        <div className="dt-wrap flush">
          <table className="dt ba-table">
            <thead>
              <tr>
                <th>{RL.kind === "milestones" ? "Milestone" : "Line"}</th>
                <th className="num">Budget</th>
                <th className="num">Actual</th>
                <th className="num">Remaining</th>
                <th style={{ width: "26%" }}>Used</th>
              </tr>
            </thead>
            <tbody>
              {lineRows.map((l) => (
                <React.Fragment key={l.key}>
                  <tr className={"ba-line" + (l.entries.length ? " has" : "")} onClick={() => l.entries.length && setOpenLine(openLine === l.key ? null : l.key)}>
                    <td>
                      <div className="dt-prop">
                        <b>
                          {l.entries.length > 0 && <Icon name="chevron" size={13} style={{ transform: openLine === l.key ? "rotate(90deg)" : "none", marginRight: 4, verticalAlign: -2 }} />}
                          {l.label}
                        </b>
                        <span>
                          {[
                            RL.kind === "milestones" ? (l.status === "done" ? "Done" : l.status === "doing" ? "In progress" : "To do") : l.group || "",
                            l.entries.length ? `${l.entries.length} expense${l.entries.length === 1 ? "" : "s"}` : "",
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    </td>
                    <td className="num">{l.budget ? fmt(l.budget) : <span className="dt-mute">—</span>}</td>
                    <td className="num">{l.actual ? fmt(l.actual) : <span className="dt-mute">—</span>}</td>
                    <td className="num">{varCell(l.budget, l.actual)}</td>
                    <td>{l.budget > 0 && <BudgetBar spent={l.actual} budget={l.budget} work={RL.kind === "milestones" ? (l.status === "done" ? 100 : l.status === "doing" ? 50 : 0) : null} />}</td>
                  </tr>
                  {openLine === l.key && (
                    <tr className="ba-entries">
                      <td colSpan={5}>{l.entries.map((a) => entryRow(a, l.key))}</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {RL.kind !== "total" && (
                <tr className="ba-un">
                  <td>
                    <div className="dt-prop">
                      <b>Not assigned to a line</b>
                      <span>{unassigned.length ? `${unassigned.length} rehab expense${unassigned.length === 1 ? "" : "s"}, assign each one below` : "every rehab expense is assigned"}</span>
                    </div>
                  </td>
                  <td />
                  <td className="num">{unassignedTotal ? fmt(unassignedTotal) : <span className="dt-mute">—</span>}</td>
                  <td />
                  <td />
                </tr>
              )}
              {RL.kind !== "total" && unassigned.length > 0 && (
                <tr className="ba-entries">
                  <td colSpan={5}>{unassigned.map((a) => entryRow(a, ""))}</td>
                </tr>
              )}
              <tr className="ba-total">
                <td>Rehab total</td>
                <td className="num">{fmt(lineBudgetTotal)}</td>
                <td className="num">{fmt(sumActuals(actuals, "Rehab / Construction"))}</td>
                <td className="num">{varCell(lineBudgetTotal, sumActuals(actuals, "Rehab / Construction"))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {RL.kind !== "total" && Math.abs(lineBudgetTotal - (P.repair || 0)) >= 1 && (
          <div className="ba-hint">
            The lines add up to {fmt(lineBudgetTotal)}; the {uwBaseline ? "original" : "current"} rehab budget is {fmt(P.repair || 0)}.
          </div>
        )}
      </section>
    </div>
  );
}
