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
    <span className="sp">
      <i style={{ background: m.color }} />
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
  costs: { title: "Expense search", sub: "Every ledger line across the projects", stages: [] },
};
// What an empty dashboard says: where its deals come from.
const DASH_EMPTY = {
  portfolio:
    "No sold flips yet. When a sale closes, open the deal and choose \u201cMark as sold\u201d: it moves here with the actual profit, the hold time and how it did against the original plan.",
  dead: "No dead deals. Deals you mark as dead from \u201cMore\u201d on a deal are kept here for reference.",
};
// Older saved filters (v26–v29) map onto the new dashboards.
const normDash = (k) =>
  DASH_META[k] ? k : k === "analyzing" ? "leads" : ["contract", "rehab", "market"].includes(k) ? "active" : k === "sold" ? "portfolio" : "overview";
const dashOfStage = (st) => (st === "analyzing" ? "leads" : st === "sold" ? "portfolio" : st === "dead" ? "dead" : "active");
// Project tabs (inside a deal). v50 merges Budget vs actual, Expenses and Documents into one screen.
const PROJECT_NAV = [
  ["overview", "Project overview", "home"],
  ["underwrite", "Flip analysis", "calc"],
  ["manage", "Stages and milestones", "cal"],
  ["expenses", "Expenses & Documents", "receipt"],
];
// Older tab keys (saved history entries, links inside the app) land on the merged screen.
const MODE_ALIAS = { budget: "expenses", actuals: "expenses", docs: "expenses" };
const normMode = (k) => MODE_ALIAS[k] || (PROJECT_NAV.some((x) => x[0] === k) ? k : "overview");
const RAIL_KEY = "kappa_rail_collapsed";
const readRailCollapsed = () => {
  try {
    return localStorage.getItem(RAIL_KEY) === "1";
  } catch (e) {
    return false;
  }
};
// The favicon set already carries Kappa's mark: reuse it for the collapsed rail.
const kappaMark = () => {
  try {
    const l = document.querySelector('link[rel="apple-touch-icon"]');
    return l ? l.href : null;
  } catch (e) {
    return null;
  }
};
// Global rail: portfolio-level views only. A deal's own tools live in the header tabs.
function Sidebar({ logo, view, filter, onFilter, counts, project, onNew, onSettings, collapsed, onToggle }) {
  const mark = kappaMark();
  return (
    <aside className={"sidebar no-print" + (collapsed ? " collapsed" : "")} aria-label="Main navigation">
      <div className="sb-titleblock" title="Kappa Real Estate Investments, Deal Breaker">
        <img className="sb-logo" src={logo} alt="Kappa Real Estate Investments" />
        {mark && <img className="sb-mark" src={mark} alt="" aria-hidden="true" />}
        {!collapsed && <div className="sb-product">Deal Breaker</div>}
      </div>
      <nav className="sb-nav" aria-label="Portfolio views">
        {DASHBOARDS.map(([k, l, icn]) => (
          <button key={k} onClick={() => onFilter(k)} className={"sb-item" + (view === "portfolio" && filter === k ? " on" : "")} title={collapsed ? `${l} (${counts[k] || 0})` : undefined} aria-current={view === "portfolio" && filter === k ? "page" : undefined}>
            <Icon name={icn} size={17} />
            <span className="sb-label">{l}</span>
            <em>{counts[k] || 0}</em>
          </button>
        ))}
        <button onClick={() => onFilter("dead")} className={"sb-item sb-minor" + (view === "portfolio" && filter === "dead" ? " on" : "")} title={collapsed ? `Dead deals (${counts.dead || 0})` : undefined}>
          <Icon name="x" size={15} />
          <span className="sb-label">Dead deals</span>
          <em>{counts.dead || 0}</em>
        </button>
        <div className="sb-sep" />
        <button onClick={() => onFilter("costs")} className={"sb-item" + (view === "portfolio" && filter === "costs" ? " on" : "")} title={collapsed ? "Expense search" : "Search expenses across every project"} aria-current={view === "portfolio" && filter === "costs" ? "page" : undefined}>
          <Icon name="search" size={17} />
          <span className="sb-label">Expense search</span>
        </button>
      </nav>
      {project && (
        <button className={"sb-project" + (view === "deal" ? " on" : "")} onClick={() => project.go(project.mode)} title={project.dirty ? `${project.name}: unsaved changes` : `Back to ${project.name}`}>
          <Icon name="home" size={17} />
          <span className="sb-project-txt">
            <span className="sb-project-k">Open deal</span>
            <span className="sb-project-v">
              {project.name}
              {project.dirty && <span className="sb-dirty" />}
            </span>
          </span>
        </button>
      )}
      <div className="sb-grow" />
      <button className="sb-new" onClick={onNew} title={collapsed ? "New deal" : undefined}>
        <Icon name="plus" size={16} stroke={2.2} /> <span className="sb-label">New deal</span>
      </button>
      <button className="sb-link" onClick={onSettings} data-no-autoconnect="" title={collapsed ? "Settings" : undefined}>
        <Icon name="settings" size={17} /> <span className="sb-label">Settings</span>
      </button>
      <button className="sb-link sb-collapse" onClick={onToggle} aria-label={collapsed ? "Expand the menu" : "Collapse the menu"} title={collapsed ? "Expand" : "Collapse"}>
        <Icon name={collapsed ? "chevron" : "back"} size={16} /> <span className="sb-label">Collapse</span>
      </button>
    </aside>
  );
}
// Sticky header: Back, breadcrumb with the property switcher, search, account; the deal's tabs below.
function TopBar({ crumbs, connected, userEmail, onConnect, finder, onBack, tabs }) {
  const [open, setOpen] = useState(null); // "search" | "switch" | null
  const initials = (userEmail || "")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("");
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [open]);
  return (
    <header className={"topbar no-print" + (tabs ? " has-tabs" : "")}>
      <div className="tb-row">
        {onBack && (
          <button className="tb-back" onClick={onBack} title="Back to the previous screen (Alt+←)" aria-label="Back to the previous screen">
            <Icon name="back" size={15} /> <span>Back</span>
          </button>
        )}
        <nav className="crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="crumb-sep">/</span>}
              {c.switcher ? (
                <span className="crumb-switch-wrap">
                  <button
                    className="crumb-switch"
                    onClick={(e) => {
                      e.stopPropagation();
                      connected && setOpen(open === "switch" ? null : "switch");
                    }}
                    disabled={!connected}
                    aria-haspopup="listbox"
                    aria-expanded={open === "switch"}
                    title={connected ? "Switch to another property" : c.label}
                  >
                    <b>{c.label}</b>
                    {connected && <Icon name="down" size={14} />}
                  </button>
                  {open === "switch" && <DealFinder {...finder} onClose={() => setOpen(null)} />}
                </span>
              ) : c.onClick ? (
                <button className="crumb" onClick={c.onClick}>
                  {c.label}
                </button>
              ) : (
                <b>{c.label}</b>
              )}
            </React.Fragment>
          ))}
        </nav>
        <div className="tb-right">
          <div style={{ position: "relative" }}>
            <button
              className="tb-search"
              onClick={(e) => {
                e.stopPropagation();
                connected && setOpen(open === "search" ? null : "search");
              }}
              disabled={!connected}
              title={connected ? "Search every saved deal" : "Connect Google first"}
            >
              <Icon name="search" size={15} /> <span>Search properties</span>
            </button>
            {open === "search" && <DealFinder {...finder} onClose={() => setOpen(null)} />}
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
      </div>
      {tabs}
    </header>
  );
}
function ProjectTabs({ mode, go, counts }) {
  const cur = normMode(mode);
  return (
    <div className="ptabs" role="tablist" aria-label="Project">
      {PROJECT_NAV.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={cur === k} className={"ptab" + (cur === k ? " on" : "")} onClick={() => go(k)}>
          {l}
          {counts && counts[k] ? <em>{counts[k]}</em> : null}
        </button>
      ))}
    </div>
  );
}
// Save status: changes save themselves; the header says where they stand.
const AUTO_BLOCKED = {
  connect: "Not saved: connect Google to save",
  address: "Not saved yet: add the full address",
  conflict: "Not saved: this deal was changed elsewhere. Click Save deal to choose",
  exists: "Not saved: another deal already has this address",
  folder: "Not saved: set the Drive folder in Settings",
};
function ProjectHeader({ address, setAddress, stage, health, context, dirty, saving, saveMsg, autoSave, autoBlocked, onSave, onExportCsv, onPrint, actions }) {
  const [menu, setMenu] = useState(false);
  const st = autoSave || {};
  const auto =
    autoBlocked && dirty
      ? [AUTO_BLOCKED[autoBlocked], T.amber]
      : st.status === "error"
        ? ["Not saved, retrying: " + (st.msg || "Drive error"), T.red]
        : saving || st.status === "saving"
          ? ["Saving…", T.txtMute]
          : dirty
            ? ["Unsaved changes", T.amber]
            : ["All changes saved", T.txtMute];
  const msgTone = saveMsg && !saveMsg.startsWith("✓") ? (saveMsg.startsWith("⚠") ? T.amber : T.red) : auto[1];
  const msg = saveMsg && !saveMsg.startsWith("✓") ? saveMsg.replace(/^[✓⚠❌]\s*/, "") : auto[0];
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
          <span className="dh-save" role="status" style={{ fontSize: 12.5, color: msgTone }}>
            {msg}
          </span>
          <button onClick={onSave} disabled={saving} title="Changes save themselves; this saves right now (Ctrl+S)" style={dirty && autoBlocked ? btnPrimary() : btnGhost()}>
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
function Dashboard({ filter: rawFilter, files, summaries, busy, connected, hasClientId, teamSetup, userEmail, onRetrySetup, invited, onConnect, onOpenSettings, onOpen, onNew, onRefresh }) {
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
          <h2>{invited ? "You're invited to Kappa's deals" : "Your flip portfolio"}</h2>
          <p>
            {invited
              ? "Connect Google with your Kappa account (kappainv.com) to open the team's deals."
              : "Connect Google Drive to see every deal, from analysis through rehab to sale, in one place."}
          </p>
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

  // Signed in, but this browser doesn't know the deals folder yet: it's found through the team settings file
  if (teamSetup)
    return (
      <React.Fragment>
        <DashHead title={meta.title} sub={userEmail ? "Signed in as " + userEmail : "Signed in"} />
        <div className="pf-empty pf-setup">
          {teamSetup.status === "searching" ? (
            <React.Fragment>
              <h2>Setting up your access</h2>
              <p>Looking for Kappa's deals folder in your Google Drive…</p>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <h2>{teamSetup.status === "noaccess" ? "This account can't open Kappa's deals folder yet" : "Kappa's deals folder wasn't found"}</h2>
              <p>
                {teamSetup.status === "error"
                  ? "Google Drive didn't answer (" + (teamSetup.msg || "error") + "). Try again in a moment."
                  : teamSetup.status === "noaccess"
                    ? `The invite link points to the deals folder, but it isn't shared with ${userEmail || "this Google account"}. Ask Arie to share it (as Editor), then try again.`
                    : `No Kappa deals are shared with ${userEmail || "this Google account"} yet. Ask Arie to share the deals folder with this account (as Editor), or to send you the invite link from Settings. Then try again.`}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={onRetrySetup} style={btnPrimary()}>
                  Try again
                </button>
                <button onClick={onOpenSettings} style={btnGhost()} data-no-autoconnect>
                  Enter settings by hand
                </button>
              </div>
            </React.Fragment>
          )}
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

      {meta.stages.length > 1 && <PipelineFunnel stages={meta.stages} deals={mine} value={stageF} onChange={setStageF} />}
      <div className="pf-tools no-print">
        <span className="pf-search">
          <Icon name="search" size={15} />
          <input placeholder="Search by address" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search deals by address" />
        </span>
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
            DASH_EMPTY[filter] || `No deals in ${meta.title.toLowerCase()} yet.`
          )}
        </div>
      ) : lay === "board" ? (
        <Board stages={stageF === "all" ? meta.stages : [stageF]} deals={shown} today={today} onOpen={onOpen} />
      ) : (
        <DealTable filter={filter} deals={shown} today={today} onOpen={onOpen} />
      )}
    </div>
  );
}
// The pipeline as one bar: how many deals sit in each stage and what they're worth. Click a stage to filter.
function PipelineFunnel({ stages, deals, value, onChange }) {
  const rows = stages.map((st) => {
    const ds = deals.filter((d) => d.s && d.s.st === st);
    return { st, n: ds.length, v: ds.reduce((t, d) => t + ((d.s.ap != null ? d.s.ap : d.s.np) || 0), 0) };
  });
  const total = rows.reduce((t, r) => t + r.n, 0);
  const worth = rows.reduce((t, r) => t + r.v, 0);
  const pick = (st) => onChange(value === st ? "all" : st);
  return (
    <section className={"fn no-print" + (value !== "all" ? " filtered" : "")} aria-label="Pipeline by stage">
      <div className="fn-top">
        <b>Pipeline</b>
        <span>
          {total} {total === 1 ? "deal" : "deals"}
          {total ? `, ${fmtK(worth)} profit (forecast${stages.includes("sold") ? " and realized" : ""})` : ""}
        </span>
        <button className={"fn-all" + (value === "all" ? " on" : "")} onClick={() => onChange("all")}>
          All {total}
        </button>
      </div>
      <div className="fn-bar" role="group" aria-label="Filter by stage">
        {rows.map((r) =>
          r.n > 0 ? (
            <button
              key={r.st}
              className={value === r.st ? "on" : ""}
              style={{ flex: r.n, background: stageMeta(r.st).color }}
              onClick={() => pick(r.st)}
              title={`${stageMeta(r.st).label}: ${r.n} ${r.n === 1 ? "deal" : "deals"}`}
              aria-label={`Show ${stageMeta(r.st).label}`}
            />
          ) : null,
        )}
      </div>
      <div className="fn-steps" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0,1fr))` }}>
        {rows.map((r) => (
          <button key={r.st} className={"fn-step" + (value === r.st ? " on" : "") + (r.n === 0 ? " zero" : "")} onClick={() => pick(r.st)} aria-pressed={value === r.st}>
            <span className="fn-step-l">
              <i style={{ background: stageMeta(r.st).color }} />
              {stageMeta(r.st).label}
            </span>
            <b>{r.n}</b>
            <em>{r.n ? `${fmtK(r.v)} ${r.st === "sold" ? "realized" : "forecast"}` : "none"}</em>
          </button>
        ))}
      </div>
    </section>
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
  const color = pct > 110 ? "#DC2626" : pct > 100 ? "#F59E0B" : T.txt;
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
  // one cell for spend against budget and the deal's health: a bar, the amounts, one variance pill
  const isBudgetAlert = (a) => /budget/i.test(a.text);
  const status = (d) => {
    const s = d.s;
    const other = (d.att || []).filter((a) => !isBudgetAlert(a));
    const showBar = (s.st === "rehab" || s.st === "market") && s.rb > 0;
    const spent = s.rsp || 0;
    const overPct = showBar && spent > s.rb ? Math.round((spent / s.rb - 1) * 100) : 0;
    const pill = overPct > 0 ? (
      <span className={"vpill " + (overPct > 10 ? "red" : "amber")}>+{overPct}% over</span>
    ) : d.h ? (
      <span className={"vpill " + (d.h.key === "ok" ? "pos" : d.h.key === "risk" ? "red" : "amber")} title={d.h.all && d.h.all.length ? d.h.all.map((a) => a.text).join("\n") : d.h.reason}>
        {d.h.label}
      </span>
    ) : null;
    if (!showBar && !pill) return <span className="dt-mute">—</span>;
    return (
      <div className="dt-budget">
        <div className="dt-budget-top">
          <span>{showBar ? `${fmtK(spent)} / ${fmtK(s.rb)}` : s.st === "contract" && s.rb ? `${fmtK(s.rb)} rehab budget` : ""}</span>
          {pill}
        </div>
        {showBar && <BudgetBar spent={spent} budget={s.rb} work={s.st === "rehab" ? s.mp : null} />}
        {other.length > 0 && filter !== "active" && (
          <div className={"dt-alert " + (other[0].lvl === "red" ? "red" : "amber")}>
            <i />
            {other[0].text}
          </div>
        )}
      </div>
    );
  };
  const docs = (s) => {
    const ds = docsStatus(s);
    if (!ds) return <span className="dt-docs na">—</span>;
    if (ds.unknown) return <span className="dt-docs na">…</span>;
    if (!ds.missing.length)
      return (
        <span className="dt-docs ok" title="Purchase HUD-1, SOW and sale HUD-1 as the stage needs">
          <Icon name="check" size={13} stroke={2.4} /> {ds.have}/{ds.need} Docs
        </span>
      );
    return (
      <span className="dt-docs miss" title={`Missing: ${ds.missing.join(", ")}`}>
        {ds.missing.length === 1 ? `Missing ${ds.missing[0]}` : `Missing ${ds.missing.length} docs`}
      </span>
    );
  };
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
      if (!s.rs) {
        const w = daysBetween(s.acd, today);
        return (
          <div className="dt-two">
            <span>Not started</span>
            <em style={w > 14 ? { color: w > 30 ? T.red : T.amber } : undefined}>{w != null ? `${Math.max(0, w)} days since closing` : ""}</em>
          </div>
        );
      }
      const day = daysBetween(s.rs, today);
      const plan = daysBetween(s.rs, s.rte);
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
  const nextStep = (s) => {
    if (s.st === "contract") {
      const di = daysBetween(today, s.ied);
      return di != null && di >= 0 ? `Inspection ends ${relDays(di)}` : s.ecd ? `Closing ${relDays(daysBetween(today, s.ecd))}` : "Set a closing date";
    }
    if (s.st === "rehab") return s.nm || (s.mp >= 100 ? "Ready to list" : "—");
    if (s.st === "market") return s.bcd ? "Buyer under contract" : s.lp ? `Listed at ${fmt(s.lp)}` : "—";
    return "—";
  };
  // alerts other than the budget lead the Next up cell; the budget one is the pill
  const nextUp = (d) => {
    const other = (d.att || []).filter((a) => !isBudgetAlert(a));
    if (!other.length) return <span className="dt-next">{nextStep(d.s)}</span>;
    return (
      <div>
        <div className={"dt-alert " + (other[0].lvl === "red" ? "red" : "amber")}>
          <i />
          {other[0].text}
        </div>
        {other.length > 1 && <div className="dt-alert-more">+{other.length - 1} more</div>}
      </div>
    );
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
      ["Budget & status", (d) => status(d)],
      ["Docs", (d) => docs(d.s)],
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
      ["Timeline", (d) => timeline(d.s)],
      ["Budget & status", (d) => status(d)],
      ["Docs", (d) => docs(d.s)],
      ["Forecast profit", (d) => money(d.s.np), "num"],
      ["Next up", (d) => nextUp(d)],
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
      ["Docs", (d) => docs(d.s)],
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
// Open tasks, milestones and utilities in one operational list.
const CHECKLIST_OF = { contract: "contract", rehab: "rehab", market: "market", sold: "market" };
function NextUp({ stage, mgmt, setMgmt, address, by, addLog, onGo, onUploadDoc, openAttachment, connected }) {
  const ck = CHECKLIST_OF[stage];
  const items = ck ? (mgmt.checklists && mgmt.checklists[ck]) || [] : [];
  const tasks = items.filter((i) => !i.ut);
  const open = tasks.filter((i) => !i.done);
  const doneN = tasks.length - open.length;
  const toggle = (id) =>
    setMgmt((mg) => ({
      ...mg,
      checklists: {
        ...mg.checklists,
        [ck]: (mg.checklists[ck] || []).map((i) => (i.id === id ? { ...i, done: !i.done, doneAt: !i.done ? new Date().toISOString() : "", by: !i.done ? by : "" } : i)),
      },
    }));
  const ms = mgmt.rehab.milestones || [];
  const showMs = ["rehab", "market"].includes(stage) && ms.length > 0;
  const doing = ms.filter((x) => x.status === "doing");
  const next = ms.filter((x) => x.status === "todo").slice(0, Math.max(1, 3 - doing.length));
  const msDone = ms.filter((x) => x.status === "done").length;
  const cycleMs = (id) =>
    setMgmt((mg) => ({
      ...mg,
      rehab: {
        ...mg.rehab,
        milestones: mg.rehab.milestones.map((x) => {
          if (x.id !== id) return x;
          const nx = x.status === "todo" ? "doing" : x.status === "doing" ? "done" : "todo";
          if (nx === "done") setTimeout(() => addLog(`Milestone done: ${x.label}`), 0);
          return { ...x, status: nx, doneAt: nx === "done" ? new Date().toISOString() : "", by: nx === "done" ? by : "" };
        }),
      },
    }));
  const MS_LABEL = { todo: "To do", doing: "In progress", done: "Done" };
  const today = todayISO();
  return (
    <section className="dcard nx">
      <div className="dcard-h">
        <Icon name="check" /> Next up
        <span className="dcard-r">{ck ? `${stageMeta(stage).label} checklist: ${doneN} of ${tasks.length} done` : stageMeta(stage).label}</span>
        <button className="dcard-link" onClick={() => onGo("manage")}>
          All tasks <Icon name="chevron" size={14} />
        </button>
      </div>
      {stage === "analyzing" ? (
        <div className="nx-sec">
          <div className="nx-k">Deal</div>
          <div className="nx-row">
            <span className="nx-l">{(mgmt.offers || []).some((o) => o.status === "Accepted") ? "Offer accepted: mark the deal under contract" : (mgmt.offers || []).length ? "Follow up on the last offer" : "Make an offer"}</span>
            <button className="link-btn" onClick={() => onGo("manage")}>
              Offers
            </button>
          </div>
        </div>
      ) : (
        ck && (
          <div className="nx-sec">
            <div className="nx-k">Tasks</div>
            {open.length === 0 && <div className="nx-empty">Nothing open on the {stageMeta(stage).label.toLowerCase()} checklist.</div>}
            {open.slice(0, 6).map((i) => (
              <div key={i.id} className="nx-row">
                <label>
                  <input type="checkbox" checked={!!i.done} onChange={() => toggle(i.id)} />
                  <span className="nx-l" title={i.note || i.label}>
                    {i.label}
                  </span>
                </label>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                )}
              </div>
            ))}
            {open.length > 6 && (
              <button className="link-btn nx-more" onClick={() => onGo("manage")}>
                {open.length - 6} more on the checklist
              </button>
            )}
          </div>
        )
      )}
      {showMs && (
        <div className="nx-sec">
          <div className="nx-k">
            Milestones
            <span className="nx-count">
              {msDone} of {ms.length} done
            </span>
          </div>
          {[...doing, ...next].map((x) => (
            <div key={x.id} className="nx-row">
              <span className="nx-l">{x.label}</span>
              {num(x.budget) > 0 && <span className="nx-due">{fmt(num(x.budget))}</span>}
              <button className={"nx-ms-st " + x.status} onClick={() => cycleMs(x.id)} title="Click to move it on: To do → In progress → Done">
                {MS_LABEL[x.status]}
              </button>
            </div>
          ))}
          {!doing.length && !next.length && <div className="nx-empty">Every milestone is done.</div>}
        </div>
      )}
      {stage !== "dead" && <UtilitiesCard address={address} stage={stage} mgmt={mgmt} setMgmt={setMgmt} by={by} onUploadDoc={onUploadDoc} openAttachment={openAttachment} connected={connected} />}
    </section>
  );
}
function ProjectOverview({ address, mapsKey, folderId, photosUrl, setPhotosUrl, sqft, yearBuilt, arv, purchase, stage, mgmt, setMgmt, m, deal, mao, uwBaseline, actuals, actualSale, analysisDate, health, onGo, userEmail, addLog, onUploadDoc, openAttachment, connected }) {
  const today = todayISO();
  const [street, city] = splitAddress(address || "");
  const q = encodeURIComponent((address || "").trim());
  const links = [
    address.trim() && ["Zillow", `https://www.zillow.com/homes/${q}_rb/`, "link"],
    address.trim() && ["Google Maps", `https://www.google.com/maps/search/?api=1&query=${q}`, "map"],
    folderId && ["Drive folder", `https://drive.google.com/drive/folders/${folderId}`, "folder"],
    photosUrl && ["Photos", photosUrl, "camera"],
  ].filter(Boolean);
  const comps = (mgmt.docs || []).filter((d) => d.kind === "Comps").length;
  const [photoEdit, setPhotoEdit] = useState(null);
  const savePhotos = () => {
    const t = (photoEdit || "").trim();
    setPhotosUrl(t ? (/^https?:\/\//i.test(t) ? t : "https://" + t) : "");
    setPhotoEdit(null);
  };
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
  const rc = rehabClock(mgmt, today);
  const rDay = rc.day;
  const rPlan = rc.plan;
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
          {rc.waiting ? (
            <OvStat k="Rehab" v="Not started" h={rc.gap != null ? `${rc.gap} day${rc.gap === 1 ? "" : "s"} since closing` : ""} tone={rc.gap > 30 ? T.red : rc.gap > 14 ? T.amber : undefined} big />
          ) : (
            <OvStat
              k="Rehab day"
              v={rDay == null ? "—" : String(rDay)}
              h={(rPlan ? `of ${rPlan} planned, ` : "") + (rc.gap != null ? `started ${rc.gap} day${rc.gap === 1 ? "" : "s"} after closing` : "")}
              tone={rPlan != null && rDay > rPlan ? T.red : undefined}
              big
            />
          )}
          <OvStat k="Work complete" v={mp == null ? "—" : `${mp}%`} big />
        </div>
        <div className="bb" style={{ height: 6, marginTop: 4 }}>
          <i style={{ width: `${mp || 0}%`, background: T.txt }} />
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
          <OvStat k="Days on market" v={dom == null ? "—" : String(dom)} h={mgmt.buyer.date ? "sale pending" : `listed ${fmtDate(mgmt.listing.date)}`} big />
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
        <OvStat
          k="Hold time"
          v={hold == null ? "—" : `${hold.toFixed(1)} mo`}
          h={(uwBaseline ? `planned ${uwBaseline.inputs.holdMonths} mo` : "") + (rc.gap != null && mgmt.rehab.startDate ? `${uwBaseline ? ", " : ""}${rc.gap} days to start the rehab` : "")}
          big
        />
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
  const rTone = rBudget > 0 && rSpent > rBudget ? (rSpent > rBudget * 1.1 ? "red" : "amber") : null;
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
  const upd = (path, val) => setMgmt((mm) => setIn(mm, path, val));
  const specs = [
    ["ARV", arv > 0 ? fmt(arv) : "—"],
    ["Purchase", purchase > 0 ? fmt(purchase) : "—"],
    [null, sqft ? `${Number(sqft).toLocaleString("en-US")} sq ft` : "— sq ft"],
    ["Built", yearBuilt ? String(yearBuilt) : "—"],
  ];
  return (
    <div className="ov">
      <section className="dcard ov-hero">
        <div className="ov-map">
          {mapsKey && address.trim() ? (
            <iframe title="Property location" loading="lazy" src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${q}`} />
          ) : (
            <a href={address.trim() ? `https://www.google.com/maps/search/?api=1&query=${q}` : undefined} target="_blank" rel="noopener noreferrer" className="ov-map-ph">
              <Icon name="map" size={22} />
              <span>{address.trim() ? "Open in Google Maps" : "Add an address"}</span>
            </a>
          )}
        </div>
        <div className="ov-hero-main">
          <div className="ov-hero-top">
            <div className="ov-hero-id">
              <div className="ov-city">{[street, city].filter(Boolean).join(", ") || "No address yet"}</div>
              <div className="ov-specs">
                {specs.map(([k, v], i) => (
                  <span key={i} className="ov-spec">
                    {k && <span>{k}</span>}
                    <b>{v}</b>
                  </span>
                ))}
              </div>
            </div>
            {photoEdit !== null ? (
              <div className="ov-photo-edit">
                <input
                  autoFocus
                  value={photoEdit}
                  onChange={(e) => setPhotoEdit(e.target.value)}
                  onKeyDown={(e) => (e.key === "Enter" ? savePhotos() : e.key === "Escape" ? setPhotoEdit(null) : null)}
                  placeholder="Google Photos, Drive or Dropbox album link"
                  aria-label="Photos link"
                />
                <button onClick={savePhotos} style={btnPrimary()}>
                  Save
                </button>
                <button onClick={() => setPhotoEdit(null)} style={btnGhost()}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="ov-links">
                {links.map(([l, href, icn]) => (
                  <a key={l} href={href} target="_blank" rel="noopener noreferrer">
                    <Icon name={icn} size={13} /> {l}
                  </a>
                ))}
                {comps > 0 && (
                  <button className="ov-link-btn" onClick={() => onGo("expenses", "sec-docs")}>
                    <Icon name="file" size={13} /> Comps ({comps})
                  </button>
                )}
                {setPhotosUrl && (
                  <button className="ov-link-btn quiet" onClick={() => setPhotoEdit(photosUrl || "")}>
                    {photosUrl ? (
                      "Change photos link"
                    ) : (
                      <>
                        <Icon name="camera" size={13} /> Add photos link
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="ov-track">
            <ol className="trk" aria-label="Deal stage">
              {STAGES.map((s, i) => {
                const on = i <= curIdx;
                const cur = i === curIdx && !dead && s.key !== "sold";
                return (
                  <li key={s.key} className={"trk-st" + (on ? " on" : "") + (cur ? " cur" : "")} aria-current={cur ? "step" : undefined}>
                    <span className="trk-tick" />
                    <span className="trk-l">{s.label}</span>
                    <span className="trk-d">{on && dates[s.key] ? fmtDate(dates[s.key]) : ""}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          {health && health.key !== "ok" && (
            <div className="ov-health">
              <HealthPill h={health} />
              <span>{health.all.map((a) => a.text).join(". ")}.</span>
            </div>
          )}
        </div>
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
        <OvCard icon="chart" title="Accounting" onOpen={() => onGo("expenses")} openLabel="Expenses & Documents">
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
                <OvStat k="Rehab spent" v={fmt(rSpent)} tone={rTone === "red" ? T.red : rTone === "amber" ? T.amber : undefined} big />
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
      <div className="ov-ops">
        <NextUp stage={stage} mgmt={mgmt} setMgmt={setMgmt} address={address} by={userEmail || ""} addLog={addLog || (() => {})} onGo={onGo} onUploadDoc={onUploadDoc} openAttachment={openAttachment} connected={connected} />
        <div className="ov-side">
          <OvCard icon="cal" title="Key dates">
            <div className="ov-k">Transaction</div>
            {tx.map(dateRow)}
            <div className="ov-k" style={{ marginTop: 12 }}>
              Construction
            </div>
            {cx.map(dateRow)}
          </OvCard>
          <ContactsPanel contacts={mgmt.contacts || []} upd={upd} />
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
        </div>
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
