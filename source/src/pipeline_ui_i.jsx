// ============================================================================
// v51 — Expense search across every project: what did we pay for it before?
// Reads each deal's ledger from Drive once per file version (kept in the browser).
// ============================================================================

const LEDGER_INDEX_KEY = "kappa_ledger_index_v1";
const readLedgerIndex = () => {
  try {
    const o = JSON.parse(localStorage.getItem(LEDGER_INDEX_KEY) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (e) {
    return {};
  }
};
const writeLedgerIndex = (idx) => {
  try {
    localStorage.setItem(LEDGER_INDEX_KEY, JSON.stringify(idx));
  } catch (e) {} // full storage: the index still works for this session
};
// one deal's ledger, compact: [id, label, category, amount, date, tag, items | null, file count]
const ledgerIndexEntry = (d, mt, fallbackName) => ({
  mt,
  ad: d.address || String(fallbackName || "").replace(/\.json$/i, ""),
  st: inferStage(d),
  e: (d.actuals || []).map((a) => [
    a.id,
    String(a.label || ""),
    a.cat || "Other",
    parseFloat(a.amount) || 0,
    a.date || "",
    a.tag || "",
    Array.isArray(a.items) && a.items.length ? a.items.map((it) => [String(it.label || ""), Number(it.amount) || 0]) : null,
    (a.files || []).length,
  ]),
});
const COST_STAGES = [
  ["all", "All stages"],
  ["active", "Active projects"],
  ["sold", "Sold"],
  ["analyzing", "Leads"],
  ["dead", "Dead deals"],
];
const COST_SORTS = [
  ["date", "Newest first"],
  ["high", "Highest amount"],
  ["low", "Lowest amount"],
];
const stageOk = (st, f) => f === "all" || (f === "active" ? ["contract", "rehab", "market"].includes(st) : st === f);

function CostSearch({ files, index, live, busy, query, setQuery, onOpen }) {
  const [cat, setCat] = useState("all");
  const [stg, setStg] = useState("all");
  const [sort, setSort] = useState("date");
  const [limit, setLimit] = useState(150);
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);
  const toks = searchTokens(query);
  // every ledger line (or matching sub-item) across the projects
  const all = [];
  let pending = 0;
  files.forEach((f) => {
    const x = live && live.id === f.id ? live : index[f.id];
    if (!x || (x.mt !== f.modifiedTime && !(live && live.id === f.id))) pending++;
    if (!x) return;
    if (!stageOk(x.st, stg)) return;
    const street = splitAddress(x.ad)[0] || x.ad;
    x.e.forEach(([id, label, c, amount, date, tag, items, nf]) => {
      const a = { id, label, cat: c, amount, tag, items: items ? items.map(([l, v]) => ({ label: l, amount: v })) : null };
      const mt = matchEntry(a, toks);
      if (!mt.hit) return;
      const t = entryTitle(a);
      const base = { fid: f.id, street, ad: x.ad, st: x.st, id, date, cat: c };
      const entryHit = !toks.length || hasAll(entryHay(label, c, amount), toks);
      if (entryHit) all.push({ ...base, key: `${f.id}:${id}`, title: t.title, detail: t.detail, amount, nItems: items ? items.length : 0, nf });
      else
        mt.items.forEach((it, k) =>
          all.push({ ...base, key: `${f.id}:${id}:${k}`, title: it.label, parent: t.title, amount: Number(it.amount) || 0, item: true }),
        );
    });
  });
  const catCount = (c) => all.filter((r) => r.cat === c).length;
  const rows = (cat === "all" ? all : all.filter((r) => r.cat === cat)).sort((a, b) =>
    sort === "high" ? b.amount - a.amount : sort === "low" ? a.amount - b.amount : String(b.date || "").localeCompare(String(a.date || "")) || b.amount - a.amount,
  );
  const amts = rows.map((r) => r.amount).filter((v) => v > 0);
  const total = rows.reduce((t, r) => t + r.amount, 0);
  const projects = new Set(rows.map((r) => r.fid)).size;
  const presentCats = ACTUAL_CATS.filter((c) => all.some((r) => r.cat === c));
  const shown = rows.slice(0, limit);
  return (
    <div className="cs">
      <DashHead title="Expense search" sub="Every ledger line in every project, sub-items included. What did we pay for it before?" />
      <div className="cs-bar">
        <div className="cs-input">
          <Icon name="search" size={17} />
          <input ref={inputRef} value={query} onChange={(e) => (setQuery(e.target.value), setLimit(150))} placeholder="e.g. water heater, roof, owner's title premium, dumpster" aria-label="Search expenses in every project" />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear the search">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <select value={stg} onChange={(e) => setStg(e.target.value)} aria-label="Projects">
          {COST_STAGES.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          {COST_SORTS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {busy && (
        <div className="cs-busy" role="status">
          <span className="spin sm" /> Reading project ledgers: {busy.done} of {busy.total}
        </div>
      )}
      <div className="lg-chips cs-chips" role="group" aria-label="Filter by category">
        <button className={"lg-chip" + (cat === "all" ? " on" : "")} onClick={() => setCat("all")} aria-pressed={cat === "all"}>
          All <em>{all.length}</em>
        </button>
        {presentCats.map((c) => (
          <button key={c} className={"lg-chip" + (cat === c ? " on" : "")} onClick={() => setCat(cat === c ? "all" : c)} aria-pressed={cat === c}>
            {catShort(c)} <em>{catCount(c)}</em>
          </button>
        ))}
      </div>
      <div className="pf-strip strip-4 cs-stats">
        <div>
          <span>Matches</span>
          <b>{rows.length}</b>
          <em>
            in {projects} {projects === 1 ? "project" : "projects"}
          </em>
        </div>
        <div>
          <span>Total</span>
          <b>{fmt(total)}</b>
          <em>{toks.length ? `for “${query.trim()}”` : cat === "all" ? "every ledger line" : catShort(cat)}</em>
        </div>
        <div>
          <span>Average</span>
          <b>{amts.length ? fmt(amts.reduce((t, v) => t + v, 0) / amts.length) : "—"}</b>
          <em>per line, credits left out</em>
        </div>
        <div>
          <span>Range</span>
          <b>{amts.length ? (amts.length === 1 ? fmt(amts[0]) : `${fmt(Math.min(...amts))} – ${fmt(Math.max(...amts))}`) : "—"}</b>
          <em>lowest to highest</em>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="pf-none">
          {pending && busy ? "Still reading the ledgers…" : toks.length ? `No expense in any project matches “${query.trim()}”.` : "No expenses logged in any project yet."}
        </div>
      ) : (
        <div className="dt-wrap">
          <table className="dt cs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense</th>
                <th>Project</th>
                <th>Category</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className="dt-row cs-row" tabIndex={0} onClick={() => onOpen(r.fid, r.id, r.item ? r.title : null)} onKeyDown={(e) => e.key === "Enter" && onOpen(r.fid, r.id, r.item ? r.title : null)} title={`Open in ${r.street}`}>
                  <td className="cs-date">{r.date ? fmtDate(r.date) : <span className="dt-mute">No date</span>}</td>
                  <td>
                    <div className="dt-prop cs-exp">
                      <b>
                        <Hl text={r.title} toks={toks} />
                      </b>
                      <span>
                        {r.item ? (
                          <>
                            Sub-item of <Hl text={r.parent} toks={toks} />
                          </>
                        ) : (
                          [r.detail, r.nItems ? `${r.nItems} items` : "", r.nf ? `${r.nf} file${r.nf === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="cs-proj">
                      <i style={{ background: stageMeta(r.st).color }} />
                      <span>{r.street}</span>
                    </div>
                  </td>
                  <td className="cs-cat">{catShort(r.cat)}</td>
                  <td className={"num cs-amt" + (r.amount < 0 ? " pos" : "")}>{r.amount < 0 ? `−${fmt2(-r.amount)}` : fmt2(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown.length && (
            <button className="pf-att-more cs-more" onClick={() => setLimit(limit + 300)}>
              Showing {shown.length} of {rows.length}. Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
