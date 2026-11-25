// ============================================================================
// v50 — Expenses & Documents: one document-centric ledger with a live budget rail.
// Merges the old Expenses, Budget vs actual and Documents tabs.
// ============================================================================

const catShort = (c) => (c === "Rehab / Construction" ? "Rehab" : c);
const isEmdEntry = (a) => a.tag === "emd" || (a.cat === "Acquisition" && !a.tag && STMT_DEPOSIT_RE.test(a.label || ""));
const amtOf = (a) => parseFloat(a.amount) || 0;

// ---------- what a dropped file most likely is ----------
const DOC_KINDS = [
  ["buy", "Purchase HUD-1", "closing statement of the purchase"],
  ["sell", "Sale HUD-1", "closing statement of the sale"],
  ["sow", "Scope of work", "contractor bid or SOW"],
  ["invoice", "Invoice or receipt", "logged as one expense"],
];
function guessDocKind(name, stage) {
  const n = String(name || "").toLowerCase();
  if (/(^|[^a-z])(sow|scope|bid|proposal|estimate)([^a-z]|$)/.test(n)) return "sow";
  if (/(invoice|receipt|(^|[^a-z])inv[\s_-]?\d|(^|[^a-z])bill([^a-z]|$)|(^|[^a-z])draw([^a-z]|$))/.test(n)) return "invoice";
  if (/(hud|alta|settlement|closing|(^|[^a-z])cd([^a-z]|$)|statement)/.test(n)) return /(sale|sold|seller|sell)/.test(n) || ["market", "sold"].includes(stage) ? "sell" : "buy";
  if (stage === "rehab") return "invoice";
  return ["market", "sold"].includes(stage) ? "sell" : "buy";
}

// ---------- the documents behind the ledger ----------
const anSide = (a) => (a.review && a.review.side) || a.side;
function docSources(mgmt) {
  const an = mgmt.analyses || [];
  const latest = (pred) =>
    an
      .filter(pred)
      .sort((x, y) => String(y.appliedAt || y.date || "").localeCompare(String(x.appliedAt || x.date || "")))[0] || null;
  const sows = an.filter((a) => a.kind === "sow" && a.appliedAt);
  return {
    buy: latest((a) => a.kind === "closing" && anSide(a) === "buy" && a.appliedAt),
    sell: latest((a) => a.kind === "closing" && anSide(a) === "sell" && a.appliedAt),
    sow: latest((a) => a.kind === "sow" && a.appliedAt),
    sowCount: sows.length,
  };
}
function entrySource(a, src, msById) {
  const t = a.tag || "";
  if (t === "stmt_buy" || t === STMT_CREDIT_TAG || (t === "purchase_price" && src.buy))
    return { kind: "hud", side: "buy", label: "HUD-1", title: "From the purchase closing statement", an: src.buy };
  if (t === "stmt_sell") return { kind: "hud", side: "sell", label: "HUD-1", title: "From the sale closing statement", an: src.sell };
  if (t === "invoice") return { kind: "invoice", label: "Invoice", title: "Read from an invoice" };
  const ms = /^ms:/.test(a.bl || "") ? msById[a.bl.slice(3)] : null;
  if (ms && ms.src === "sow") return { kind: "sow", label: "SOW", title: `SOW line: ${ms.label}`, an: src.sow };
  if (["investor_return", "rehab_loan_interest", "purchase_loan_interest"].includes(t))
    return { kind: "calc", label: "Calc", title: "Worked out from the deal's financing when it sold" };
  const n = (a.files || []).length;
  if (n) return { kind: "file", label: n > 1 ? `${n} files` : "File", title: "Attached file" };
  return { kind: "manual", label: "Manual", title: "Entered by hand. Click to attach a receipt" };
}

// ---------- a crisp title and one line of detail, from the stored label ----------
const LEDGER_TITLES = {
  "Closing costs from the purchase statement": "Purchase closing costs",
  "Closing costs from the sale statement": "Sale closing costs",
  "Prorations and adjustments from the statement": "Prorations & adjustments",
  "Lender fees and interest from the statement": "Lender fees & interest",
  "From the statement": "Statement items",
};
// "Title (detail)" → ["Title", "detail"]; only a balanced group at the very end counts
const splitParen = (s) => {
  if (!s.endsWith(")")) return null;
  let depth = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i] === ")") depth++;
    else if (s[i] === "(") {
      depth--;
      if (depth === 0) {
        const head = s.slice(0, i).trim();
        return head ? [head, s.slice(i + 1, -1).trim()] : null;
      }
    }
  }
  return null;
};
function entryTitle(a) {
  const raw = String(a.label || "").trim();
  if (!raw) return { title: "Untitled expense", detail: "" };
  const p = splitParen(raw);
  if (a.tag === STMT_CREDIT_TAG) return { title: a.cat === "Holding" ? "Seller property tax credit" : "Seller credit at closing", detail: p ? p[1] : "" };
  if (a.tag === "purchase_price") {
    const rest = raw.replace(/^Purchase price\s*,?\s*/i, "");
    return { title: "Purchase price", detail: /^\$?[\d,]+(\.\d+)?$/.test(rest) ? "" : rest }; // a bare amount repeats the amount column
  }
  if (isEmdEntry(a)) return { title: "Earnest money deposit", detail: /^(earnest money( deposit)?|emd)$/i.test(raw) ? "" : raw };
  if (p) {
    const head = LEDGER_TITLES[p[0]] || p[0];
    return { title: head, detail: /^\d+ items$/.test(p[1]) ? "" : p[1] };
  }
  return { title: LEDGER_TITLES[raw] || raw, detail: "" };
}
// Inside the purchase group the price entry is the part paid at closing.
const kidTitle = (a) => (a.tag === "purchase_price" ? "Balance paid at closing" : entryTitle(a).title);
// The purchase reads as one row: the EMD paid earlier + the balance paid at closing.
function ledgerRows(list) {
  const pp = list.filter((a) => a.tag === "purchase_price");
  const emd = list.filter(isEmdEntry);
  const ids = pp.length && emd.length ? new Set([...pp, ...emd].map((a) => a.id)) : null;
  const rows = [];
  let placed = false;
  list.forEach((a) => {
    if (ids && ids.has(a.id)) {
      if (placed) return;
      placed = true;
      const kids = list.filter((x) => ids.has(x.id));
      rows.push({ group: true, id: "grp-purchase", kids, amount: kids.reduce((t, x) => t + amtOf(x), 0), date: kids.map((x) => x.date || "").sort().pop() });
      return;
    }
    rows.push({ entry: a });
  });
  return rows;
}
// Budget per ledger category: the original underwriting when there is one, else the current one.
function budgetCats(P, actuals, fc) {
  return [
    ["Acquisition", (P.purchase || 0) + (P.totalBuying || 0), "purchase price and buying costs"],
    ["Rehab / Construction", fc ? num(fc.rehab) : P.repair || 0, fc ? `rehab, from the forecast (${fc.name || "scenario"})` : "rehab estimate"],
    ["Financing", P.totalFinancing || 0, "interest, points, investor return"],
    ["Holding", P.totalHolding || 0, "taxes, insurance, utilities"],
    ["Selling", P.totalSelling || 0, "commission, title, transfer"],
    ["Services", fc ? num(fc.pm) : P.pmFee || 0, fc ? `project manager, from the forecast (${fc.name || "scenario"})` : "project manager"],
    ["Other", 0, "not budgeted"],
  ].map(([cat, budget, note]) => {
    const actual = sumActuals(actuals, cat);
    return { cat, budget, note, actual, projected: Math.max(actual, budget) };
  });
}
const overTone = (actual, budget) => (budget > 0 && actual > budget ? (actual > budget * 1.1 ? "red" : "amber") : null);

// ---------- pieces ----------
function SourcePill({ src, onClick }) {
  return (
    <button className={"src-pill src-" + src.kind} onClick={onClick} title={src.title}>
      {src.kind === "manual" ? <Icon name="clip" size={12} /> : <Icon name="file" size={12} />}
      {src.label}
    </button>
  );
}
function DocTypeChooser({ name, guess, onPick, onCancel }) {
  return (
    <div className="xd-choose" role="dialog" aria-label="What is this document?">
      <span className="xd-choose-k">
        Read <b>{name}</b> as
      </span>
      <div className="xd-choose-opts">
        {DOC_KINDS.map(([k, l, sub]) => (
          <button key={k} className={"xd-choose-opt" + (k === guess ? " on" : "")} onClick={() => onPick(k)} title={sub}>
            {l}
            {k === guess && <em>suggested</em>}
          </button>
        ))}
      </div>
      <button className="link-btn xd-choose-x" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
function DocDropzone({ stage, src, analysesCount, onRead, onOpenSource, onShowDocs }) {
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState(null); // { file, guess }
  const fileRef = useRef(null);
  const take = (f) => f && setPending({ file: f, guess: guessDocKind(f.name, stage) });
  const pick = (k) => {
    const f = pending.file;
    setPending(null);
    onRead(k, { kind: "local", file: f, name: f.name, size: f.size, mimeType: f.type });
  };
  const chip = (have, okLabel, addLabel, onOk, onAdd) =>
    have ? (
      <button className="xd-chip ok" onClick={onOk} title="Open the document and the lines it produced">
        <Icon name="check" size={13} stroke={2.4} /> {okLabel}
      </button>
    ) : (
      <button className="xd-chip add" onClick={onAdd}>
        <Icon name="plus" size={13} stroke={2.2} /> {addLabel}
      </button>
    );
  return (
    <section
      className={"xd-drop no-print" + (drag ? " drag" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
      }}
    >
      <div className="xd-drop-main">
        <span className="xd-drop-ic">
          <Icon name="download" size={18} />
        </span>
        <div className="xd-drop-txt">
          <b>Drop HUD-1, SOW, or Contractor Invoice here to auto-parse entries</b>
          <span>
            PDF or photo.{" "}
            <button className="link-btn" onClick={() => fileRef.current && fileRef.current.click()}>
              Browse files
            </button>
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={AI_ACCEPT}
          style={{ display: "none" }}
          aria-label="Choose a document to read"
          onChange={(e) => {
            take(e.target.files && e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
      <div className="xd-chips">
        {chip(!!src.buy, "HUD-1 Purchase", "Add Purchase HUD", () => onOpenSource("buy"), () => onRead("buy"))}
        {chip(!!src.sow, `SOW v${src.sowCount}`, "Add SOW", () => onOpenSource("sow"), () => onRead("sow"))}
        {chip(!!src.sell, "HUD-1 Sale", "Add Sale HUD", () => onOpenSource("sell"), () => onRead("sell"))}
        <button className="xd-chip add" onClick={() => onRead("invoice")}>
          <Icon name="plus" size={13} stroke={2.2} /> Add invoice
        </button>
        {analysesCount > 0 && (
          <button className="xd-chip-link" onClick={onShowDocs}>
            {analysesCount} saved {analysesCount === 1 ? "analysis" : "analyses"}
          </button>
        )}
      </div>
      {pending && <DocTypeChooser name={pending.file.name} guess={pending.guess} onPick={pick} onCancel={() => setPending(null)} />}
    </section>
  );
}

// ---------- slide-over: the document next to the lines it produced ----------
function DocViewer({ view, onClose, onOpenAnalysis, entryTools }) {
  const [fi, setFi] = useState(0);
  const [link, setLink] = useState(null); // { url, name } while adding a link
  const fileRef = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  const files = view.files || [];
  const f = files[Math.min(fi, Math.max(0, files.length - 1))] || null;
  const preview = f && f.type === "drive_file" && f.driveFileId ? `https://drive.google.com/file/d/${f.driveFileId}/preview` : null;
  const openUrl = f ? (f.type === "link" ? f.url : `https://drive.google.com/file/d/${f.driveFileId}/view`) : null;
  const total = (view.lines || []).reduce((t, l) => t + (Number(l.amount) || 0), 0);
  const entry = view.entry;
  return (
    <div className="dv-back no-print" onClick={onClose}>
      <aside className="dv" role="dialog" aria-label={view.title} onClick={(e) => e.stopPropagation()}>
        <header className="dv-h">
          <div className="dv-h-txt">
            <span className="dv-k">{view.kicker}</span>
            <h3>{view.title}</h3>
            {view.sub && <span className="dv-sub">{view.sub}</span>}
          </div>
          {openUrl && (
            <a className="dv-open" href={openUrl} target="_blank" rel="noopener noreferrer">
              Open in new tab <Icon name="link" size={13} />
            </a>
          )}
          <button className="dv-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="dv-body">
          <div className="dv-doc">
            {files.length > 1 && (
              <div className="dv-files">
                {files.map((x, i) => (
                  <button key={i} className={i === fi ? "on" : ""} onClick={() => setFi(i)}>
                    {x.name || "File " + (i + 1)}
                  </button>
                ))}
              </div>
            )}
            {preview ? (
              <iframe title={f.name || "Document"} src={preview} />
            ) : f ? (
              <div className="dv-empty">
                <Icon name="link" size={22} />
                <p>{f.name || f.url}</p>
                <a className="dv-open" href={openUrl} target="_blank" rel="noopener noreferrer">
                  Open the link
                </a>
              </div>
            ) : (
              <div className="dv-empty">
                <Icon name="file" size={22} />
                <p>{view.noDoc || "No document is kept with this entry yet."}</p>
              </div>
            )}
          </div>
          <div className="dv-side">
            <div className="dv-side-h">
              <span>{view.linesTitle || "Extracted line items"}</span>
              <em>{(view.lines || []).length}</em>
            </div>
            <div className="dv-lines">
              {(view.lines || []).length === 0 && <div className="dv-none">Nothing in the ledger came from this document.</div>}
              {(view.lines || []).map((l, i) => (
                <div key={i} className="dv-line">
                  <div>
                    <b>{l.label}</b>
                    {l.meta && <span>{l.meta}</span>}
                  </div>
                  <em className={l.amount < 0 ? "pos" : ""}>{l.amountText || (l.amount < 0 ? "−" + fmt2(-l.amount) : fmt2(l.amount))}</em>
                </div>
              ))}
            </div>
            {(view.lines || []).length > 1 && (
              <div className="dv-total">
                <span>Total</span>
                <b>{fmt2(total)}</b>
              </div>
            )}
            {entry && entryTools && (
              <div className="dv-attach">
                <div className="dv-side-h">
                  <span>Files on this entry</span>
                  <em>{(entry.files || []).length}</em>
                </div>
                {(entry.files || []).map((x, i) => (
                  <div key={i} className="dv-att-row">
                    <Icon name={x.type === "link" ? "link" : "file"} size={14} />
                    <button className="link-btn" onClick={() => setFi(i)}>
                      {x.name}
                    </button>
                    <button className="dv-att-x" onClick={() => entryTools.remove(entry.id, x)} title="Remove from this entry" aria-label="Remove file">
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const fl = Array.from(e.target.files || []);
                    if (fl.length) entryTools.upload(entry.id, fl);
                    e.target.value = "";
                  }}
                />
                {link ? (
                  <div className="dv-link-form">
                    <input autoFocus placeholder="Google Drive / Docs URL" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
                    <input
                      placeholder="Label (optional)"
                      value={link.name}
                      onChange={(e) => setLink({ ...link, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && link.url.trim() && (entryTools.addLink(entry.id, link.url, link.name), setLink(null))}
                    />
                    <div>
                      <button style={btnPrimary()} disabled={!link.url.trim()} onClick={() => (entryTools.addLink(entry.id, link.url, link.name), setLink(null))}>
                        Add
                      </button>
                      <button style={btnGhost()} onClick={() => setLink(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="dv-att-actions">
                    <button style={btnGhost()} disabled={!entryTools.connected || entryTools.uploading === entry.id} onClick={() => fileRef.current && fileRef.current.click()}>
                      <Icon name="download" /> {entryTools.uploading === entry.id ? "Uploading…" : "Upload file"}
                    </button>
                    <button style={btnGhost()} onClick={() => setLink({ url: "", name: "" })}>
                      <Icon name="link" /> Add link
                    </button>
                  </div>
                )}
                {!entryTools.connected && <div className="dv-note">Connect Google Drive to upload files.</div>}
              </div>
            )}
            {view.analysis && (
              <button className="dv-reopen" style={btnGhost()} onClick={() => onOpenAnalysis(view.analysis)}>
                Review the mapping again
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ---------- search helpers (this ledger and across projects) ----------
const searchTokens = (q) =>
  String(q || "")
    .toLowerCase()
    .replace(/[$,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const hasAll = (hay, toks) => toks.every((t) => hay.includes(t));
const entryHay = (label, cat, amount) => `${label} ${cat} ${catShort(cat)} ${Math.round(Math.abs(amount))} ${Math.abs(amount).toFixed(2)}`.toLowerCase().replace(/,/g, "");
// does an entry match the search, and which of its sub-items do
function matchEntry(a, toks) {
  if (!toks.length) return { hit: true, items: [] };
  const items = Array.isArray(a.items) ? a.items : [];
  const hay = entryHay(a.label || "", a.cat || "", amtOf(a));
  const itemHits = items.filter((it) => {
    const il = String(it.label || "").toLowerCase();
    return toks.some((t) => il.includes(t)) && hasAll(`${il} ${Math.round(Math.abs(Number(it.amount) || 0))} ${hay}`, toks);
  });
  return { hit: hasAll(hay, toks) || itemHits.length > 0, items: itemHits };
}
// wrap the searched words in <mark>
function Hl({ text, toks }) {
  const s = String(text || "");
  const ws = (toks || []).filter((t) => t.length > 1 || /\d/.test(t));
  if (!ws.length) return s;
  const re = new RegExp("(" + ws.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
  return s.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

// ---------- ledger rows: the whole row opens the expense window ----------
function EntryRow({ a, src, child, itemsOpen, toks, onOpen, onDelete, onToggleItems, onSource }) {
  const { detail } = entryTitle(a);
  const title = child ? kidTitle(a) : entryTitle(a).title;
  const amt = amtOf(a);
  const items = Array.isArray(a.items) && a.items.length > 1 ? a.items : null;
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className={"lg-entry" + (child ? " child" : "")}>
      <div
        className="ledger-row"
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onOpen())}
        title="Open this expense"
      >
        <div className="lg-main">
          <span className="lg-title">
            <Hl text={title} toks={toks} />
          </span>
          <span className="lg-meta">
            <span>{a.date ? fmtDate(a.date) : "No date"}</span>
            <span>{catShort(a.cat)}</span>
            {a.unpaid && <span className="lg-unpaid">Not paid</span>}
            {items && (
              <button className={"ledger-items-btn" + (itemsOpen ? " open" : "")} onClick={stop(onToggleItems)} aria-expanded={itemsOpen} title={itemsOpen ? "Hide the breakdown" : `Show the ${items.length} items`}>
                <Icon name="down" size={12} />
                {items.length} items
              </button>
            )}
            {detail && (
              <span className="lg-detail">
                <Hl text={detail} toks={toks} />
              </span>
            )}
          </span>
        </div>
        <SourcePill src={src} onClick={stop(onSource)} />
        <span className={"lg-amt" + (amt < 0 ? " neg" : "")}>{amt < 0 ? <span className="ledger-neg">−{fmt(-amt)} credit</span> : fmt(amt)}</span>
        <button className="lg-del" onClick={stop(onDelete)} title="Delete entry" aria-label="Delete entry">
          <Icon name="x" size={14} />
        </button>
      </div>
      {items && itemsOpen && (
        <div className="ledger-items">
          {items.map((it, i) => (
            <div key={i} className="ledger-item">
              <span>
                <Hl text={it.label} toks={toks} />
              </span>
              <span className={it.amount < 0 ? "neg" : ""}>{fmt2(it.amount)}</span>
            </div>
          ))}
          <div className="ledger-item sum">
            <span>{items.length} items</span>
            <span>{fmt2(items.reduce((t, it) => t + (Number(it.amount) || 0), 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- the expense window: one expense, large, with its sub-expenses and files ----------
function ExpenseWindow({ a, group, src, budgetLines, focusItem, onPatch, onDelete, onClose, onOpenEntry, onBack, onOpenSource, entryTools }) {
  const [d, setD] = useState(() => (a ? { label: a.label || "", amount: String(amtOf(a)) } : null));
  const [fi, setFi] = useState(0);
  const [link, setLink] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef(null);
  const commit = () => {
    if (!a || !d) return;
    const patch = {};
    if (d.label !== (a.label || "")) patch.label = d.label;
    const amt = parseFloat(d.amount);
    if (Number.isFinite(amt) && Math.abs(amt - amtOf(a)) > 0.0049) patch.amount = Math.round(amt * 100) / 100;
    if (Object.keys(patch).length) onPatch(a.id, patch);
  };
  const close = () => {
    commit();
    onClose();
  };
  useEffect(() => {
    const k = (e) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t && t.dataset && t.dataset.xw === "text") return; // the field handles its own Esc
      close();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  });
  const fieldKeys = (field) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      e.target.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setD((x) => ({ ...x, [field]: field === "amount" ? String(amtOf(a)) : a.label || "" }));
      setTimeout(() => e.target.blur(), 0);
    }
  };
  // ---- a group (the purchase: EMD + balance at closing) ----
  if (group) {
    return (
      <div className="xw-back no-print" onClick={onClose}>
        <div className="xw" role="dialog" aria-label="Purchase price" onClick={(e) => e.stopPropagation()}>
          <header className="xw-h">
            <div className="xw-h-txt">
              <span className="xw-k">Acquisition · {group.kids.length} linked entries</span>
              <h3>Purchase price</h3>
            </div>
            <button className="dv-x" onClick={onClose} aria-label="Close">
              <Icon name="x" size={18} />
            </button>
          </header>
          <div className="xw-hero">
            <div>
              <span>Total</span>
              <b>{fmt2(group.amount)}</b>
            </div>
            <div>
              <span>Last payment</span>
              <b>{group.date ? fmtDate(group.date) : "—"}</b>
            </div>
            <div>
              <span>Category</span>
              <b>Acquisition</b>
            </div>
          </div>
          <div className="xw-body">
            <section className="xw-sec">
              <div className="xw-sec-h">
                Sub-expenses <em>{group.kids.length}</em>
              </div>
              <div className="xw-items">
                {group.kids.map((k) => (
                  <button key={k.id} className="xw-item link" onClick={() => onOpenEntry(k.id)}>
                    <span className="xw-item-l">
                      <b>{kidTitle(k)}</b>
                      <em>{[k.date ? fmtDate(k.date) : "No date", entryTitle(k).detail].filter(Boolean).join(" · ")}</em>
                    </span>
                    <span className="xw-item-a">{fmt2(amtOf(k))}</span>
                    <Icon name="chevron" size={14} />
                  </button>
                ))}
                <div className="xw-item sum gsum">
                  <span className="xw-item-l">Purchase price</span>
                  <span className="xw-item-a">{fmt2(group.amount)}</span>
                  <span />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }
  if (!a) return null;
  const t = onBack ? { ...entryTitle(a), title: kidTitle(a) } : entryTitle(a);
  const amt = amtOf(a);
  const items = Array.isArray(a.items) && a.items.length ? a.items : null;
  const itemsTotal = items ? items.reduce((s2, it) => s2 + (Number(it.amount) || 0), 0) : 0;
  const files = a.files || [];
  const f = files[Math.min(fi, Math.max(0, files.length - 1))] || null;
  const preview = f && f.type === "drive_file" && f.driveFileId ? `https://drive.google.com/file/d/${f.driveFileId}/preview` : null;
  const openUrl = f ? (f.type === "link" ? f.url : `https://drive.google.com/file/d/${f.driveFileId}/view`) : null;
  const showLines = a.cat === "Rehab / Construction" && budgetLines && budgetLines.length > 1;
  return (
    <div className="xw-back no-print" onClick={close}>
      <div className="xw" role="dialog" aria-label={t.title} onClick={(e) => e.stopPropagation()}>
        <header className="xw-h">
          <div className="xw-h-txt">
            {onBack && (
              <button className="xw-backbtn" onClick={() => (commit(), onBack())}>
                <Icon name="back" size={13} /> Purchase price
              </button>
            )}
            <span className="xw-k">
              {catShort(a.cat)} · {src.title}
            </span>
            <h3>{t.title}</h3>
            {t.detail && <p className="xw-sub">{t.detail}</p>}
          </div>
          <button className="dv-x" onClick={close} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="xw-hero">
          <div>
            <span>Amount</span>
            <b className={amt < 0 ? "pos" : ""}>{amt < 0 ? `−${fmt2(-amt)}` : fmt2(amt)}</b>
            {amt < 0 && <em>credit</em>}
          </div>
          <div>
            <span>Date</span>
            <b>{a.date ? fmtDate(a.date) : "—"}</b>
          </div>
          <div>
            <span>Category</span>
            <b>{a.cat}</b>
          </div>
          <div>
            <span>Source</span>
            {src.kind === "hud" || src.kind === "sow" ? (
              <button className="link-btn xw-src" onClick={() => (commit(), onOpenSource(src.kind === "hud" ? src.side : "sow"))}>
                {src.kind === "hud" ? (src.side === "buy" ? "Purchase HUD-1" : "Sale HUD-1") : "Scope of work"} <Icon name="link" size={12} />
              </button>
            ) : (
              <b>{src.label}</b>
            )}
          </div>
        </div>
        <div className="xw-body">
          <section className="xw-sec">
            <div className="xw-sec-h">Details</div>
            <div className="xw-form">
              <label>
                <span>Date</span>
                <input type="date" value={a.date || ""} onChange={(e) => onPatch(a.id, { date: e.target.value })} />
              </label>
              <label>
                <span>Category</span>
                <select value={a.cat} onChange={(e) => onPatch(a.id, { cat: e.target.value })}>
                  {ACTUAL_CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount</span>
                <input
                  className="xw-amt"
                  type="number"
                  step="0.01"
                  data-xw="text"
                  value={d.amount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setD({ ...d, amount: e.target.value })}
                  onBlur={commit}
                  onKeyDown={fieldKeys("amount")}
                />
              </label>
              <label>
                <span>Status</span>
                <select value={a.unpaid ? "unpaid" : "paid"} onChange={(e) => onPatch(a.id, { unpaid: e.target.value === "unpaid" ? true : undefined })} aria-label="Paid or not">
                  <option value="paid">Paid</option>
                  <option value="unpaid">Not paid yet</option>
                </select>
              </label>
              <label className="span2">
                <span>Description</span>
                <input className="xw-label" data-xw="text" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} onBlur={commit} onKeyDown={fieldKeys("label")} />
              </label>
              {showLines && (
                <label className="wide">
                  <span>Rehab budget line</span>
                  <select value={a.bl || ""} onChange={(e) => onPatch(a.id, { bl: e.target.value || undefined })}>
                    <option value="">Unassigned</option>
                    {budgetLines.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="xw-hint">Changes save as you go. Tab moves between fields, Enter saves, Esc undoes a field.</div>
          </section>
          {items && (
            <section className="xw-sec">
              <div className="xw-sec-h">
                Sub-expenses <em>{items.length}</em>
              </div>
              <div className="xw-items">
                {items.map((it, i) => (
                  <div key={i} className={"xw-item" + (focusItem && it.label === focusItem ? " hit" : "")} ref={focusItem && it.label === focusItem ? (el) => el && el.scrollIntoView && setTimeout(() => el.scrollIntoView({ block: "center" }), 50) : undefined}>
                    <span className="xw-item-n">{i + 1}</span>
                    <span className="xw-item-l">{it.label}</span>
                    <span className={"xw-item-a" + (it.amount < 0 ? " pos" : "")}>{fmt2(it.amount)}</span>
                  </div>
                ))}
                <div className="xw-item sum">
                  <span className="xw-item-n" />
                  <span className="xw-item-l">Total of {items.length} items</span>
                  <span className="xw-item-a">{fmt2(itemsTotal)}</span>
                </div>
              </div>
              <div className={"xw-check" + (Math.abs(itemsTotal - amt) < 0.01 ? " ok" : "")}>
                {Math.abs(itemsTotal - amt) < 0.01 ? "The items add up to the entry's amount." : `The items add up to ${fmt2(itemsTotal)}, ${fmt2(Math.abs(itemsTotal - amt))} ${itemsTotal > amt ? "more" : "less"} than the entry's ${fmt2(amt)}.`}
              </div>
            </section>
          )}
          <section className="xw-sec">
            <div className="xw-sec-h">
              Files <em>{files.length}</em>
              {openUrl && (
                <a className="xw-open" href={openUrl} target="_blank" rel="noopener noreferrer">
                  Open in new tab <Icon name="link" size={12} />
                </a>
              )}
            </div>
            {files.length > 0 && (
              <div className="dv-files xw-files">
                {files.map((x, i) => (
                  <span key={i} className={"xw-file" + (i === fi ? " on" : "")}>
                    <button onClick={() => setFi(i)}>
                      <Icon name={x.type === "link" ? "link" : "file"} size={13} /> {x.name || "File " + (i + 1)}
                    </button>
                    <button className="xw-file-x" onClick={() => entryTools.remove(a.id, x)} title="Remove from this entry" aria-label={`Remove ${x.name || "file"}`}>
                      <Icon name="x" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {preview ? (
              <div className="xw-preview">
                <iframe title={f.name || "Attached file"} src={preview} />
              </div>
            ) : f ? (
              <div className="xw-nofile">
                <Icon name="link" size={18} /> {f.name || f.url}
              </div>
            ) : (
              <div className="xw-nofile">
                <Icon name="file" size={18} /> No receipt or invoice attached yet.
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const fl = Array.from(e.target.files || []);
                if (fl.length) entryTools.upload(a.id, fl);
                e.target.value = "";
              }}
            />
            {link ? (
              <div className="dv-link-form">
                <input autoFocus data-xw="text" placeholder="Google Drive / Docs URL" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
                <input
                  data-xw="text"
                  placeholder="Label (optional)"
                  value={link.name}
                  onChange={(e) => setLink({ ...link, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && link.url.trim() && (entryTools.addLink(a.id, link.url, link.name), setLink(null))}
                />
                <div>
                  <button style={btnPrimary()} disabled={!link.url.trim()} onClick={() => (entryTools.addLink(a.id, link.url, link.name), setLink(null))}>
                    Add
                  </button>
                  <button style={btnGhost()} onClick={() => setLink(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="dv-att-actions">
                <button style={btnGhost()} disabled={!entryTools.connected || entryTools.uploading === a.id} onClick={() => fileRef.current && fileRef.current.click()}>
                  <Icon name="download" /> {entryTools.uploading === a.id ? "Uploading…" : "Upload file"}
                </button>
                <button style={btnGhost()} onClick={() => setLink({ url: "", name: "" })}>
                  <Icon name="link" /> Add link
                </button>
              </div>
            )}
            {!entryTools.connected && <div className="dv-note">Connect Google Drive to upload files.</div>}
          </section>
        </div>
        <footer className="xw-f">
          {confirmDel ? (
            <span className="xw-del-confirm">
              Delete this expense?
              <button className="xw-del-yes" onClick={() => (onDelete(a.id), onClose())}>
                Delete
              </button>
              <button className="link-btn" onClick={() => setConfirmDel(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button className="xw-del" onClick={() => setConfirmDel(true)}>
              Delete expense
            </button>
          )}
          <button style={btnPrimary()} onClick={close}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
function AddExpenseRow({ onAdd, defaultCat }) {
  const blank = (cat, unpaid) => ({ date: todayISO(), cat: cat || "Rehab / Construction", label: "", amount: "", unpaid: !!unpaid });
  const [d, setD] = useState(() => blank(defaultCat));
  const add = () => {
    const amount = parseFloat(d.amount) || 0;
    if (!d.label.trim() && !amount) return;
    onAdd({ date: d.date || todayISO(), cat: d.cat, label: d.label.trim(), amount, ...(d.unpaid ? { unpaid: true } : {}) });
    setD(blank(d.cat));
  };
  const enter = (e) => e.key === "Enter" && add();
  return (
    <div className="ledger-add-row">
      <button onClick={add} className="lg-add-btn" aria-label="Add expense" title="Add to the ledger (Enter)">
        <Icon name="plus" size={15} stroke={2.2} />
      </button>
      <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} title="Expense date" aria-label="Expense date" />
      <select value={d.cat} onChange={(e) => setD({ ...d, cat: e.target.value })} aria-label="Category">
        {ACTUAL_CATS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input placeholder="Description" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} onKeyDown={enter} />
      <input type="number" step="0.01" placeholder="$ amount" value={d.amount} onFocus={(e) => e.target.select()} onChange={(e) => setD({ ...d, amount: e.target.value })} onKeyDown={enter} />
      <button className={"lg-paid-tog" + (d.unpaid ? " unpaid" : "")} onClick={() => setD({ ...d, unpaid: !d.unpaid })} aria-pressed={!!d.unpaid} title="Switch between paid and not paid yet">
        {d.unpaid ? "Not paid" : "Paid"}
      </button>
    </div>
  );
}

// ---------- right rail: live budget burn ----------
const BASIS_KEY = "kappa_ledger_basis";
function BudgetRail({ cats, actualsTotal, actualSale, arv, plan, baselineDate, filter, onFilter, setActualSale, onReadSale, fc }) {
  const [basis, setBasisRaw] = useState(() => {
    try {
      return localStorage.getItem(BASIS_KEY) === "cash" ? "cash" : "projected";
    } catch (e) {
      return "projected";
    }
  });
  const setBasis = (v) => {
    setBasisRaw(v);
    try {
      localStorage.setItem(BASIS_KEY, v);
    } catch (e) {}
  };
  const sold = actualSale > 0;
  // with a saved forecast, "Projected" is the Forecast tab's number: its sale price and all-in costs to the sale
  const useFc = !sold && !!fc;
  const saleBasis = sold ? actualSale : useFc ? fc.price : arv;
  const totBudget = cats.reduce((t, c) => t + c.budget, 0);
  const totProjected = cats.reduce((t, c) => t + c.projected, 0);
  const remaining = Math.max(0, totProjected - actualsTotal);
  const projProfit = useFc ? fc.profit : saleBasis - totProjected;
  const actualProfit = actualSale - actualsTotal;
  const vsPlan = basis === "cash" ? (sold ? actualProfit : null) : projProfit;
  const variance = vsPlan == null ? null : vsPlan - plan;
  const margin = saleBasis > 0 ? projProfit / saleBasis : null;
  const shown = cats.filter((c) => c.budget > 0 || Math.abs(c.actual) > 0.004);
  return (
    <aside className="xd-rail">
      <section className="xd-card">
        <div className="seg xd-basis" role="group" aria-label="Basis">
          <button className={basis === "cash" ? "on" : ""} onClick={() => setBasis("cash")}>
            Cash basis
          </button>
          <button className={basis === "projected" ? "on" : ""} onClick={() => setBasis("projected")}>
            Projected
          </button>
        </div>
        {fc && <div className="xd-fc-note">The rehab and project management budgets{sold ? "" : " and the projected profit"} come from the forecast ({fc.name}).</div>}
        {basis === "cash" ? (
          <div className="xd-head">
            <span className="xd-head-k">{sold ? "Actual net profit" : "Cash out so far"}</span>
            <b className={"xd-head-v" + (sold && actualProfit < 0 ? " neg" : "")}>{sold ? fmt(actualProfit) : fmt(actualsTotal)}</b>
            <span className="xd-head-sub">{sold ? `${fmt(actualSale)} sale less ${fmt(actualsTotal)} spent` : `${totBudget > 0 ? Math.round((actualsTotal / totBudget) * 100) : 0}% of the ${fmt(totBudget)} project budget, credits netted`}</span>
          </div>
        ) : (
          <div className="xd-head">
            <span className="xd-head-k">Projected net profit</span>
            <b className={"xd-head-v" + (projProfit < 0 ? " neg" : "")}>{fmt(projProfit)}</b>
            <span className="xd-head-sub">
              {useFc
                ? `${fmt(fc.price)} sale on ${fmtDate(fc.saleDate)} less ${fmt(fc.total)} all in: spent, owed, and still to come until the sale`
                : `${fmt(saleBasis)} ${sold ? "sale" : "ARV"} less ${fmt(actualsTotal)} spent and ${fmt(remaining)} still budgeted`}
            </span>
          </div>
        )}
        <div className="xd-kv">
          {variance != null ? (
            <div>
              <span>Against the plan</span>
              {Math.abs(variance) < 1 ? (
                <b className="vpill mute">On plan</b>
              ) : (
                <b className={"vpill " + (variance >= 0 ? "pos" : Math.abs(variance) > Math.abs(plan) * 0.1 ? "red" : "amber")}>{(variance >= 0 ? "+" : "−") + fmt(Math.abs(variance))}</b>
              )}
            </div>
          ) : (
            <div>
              <span>Sale</span>
              <b className="xd-kv-mute">Pending</b>
            </div>
          )}
          <div title={baselineDate ? `Original underwriting, frozen ${fmtDate(baselineDate)}` : "Current underwriting (no original snapshot yet)"}>
            <span>Plan profit</span>
            <b>{fmt(plan)}</b>
          </div>
          {basis === "projected" && margin != null && (
            <div>
              <span>Deal margin</span>
              <b>{(margin * 100).toFixed(1)}%</b>
            </div>
          )}
        </div>
      </section>
      <section className="xd-card">
        <div className="xd-card-h">
          <span>Budget by category</span>
          {filter ? (
            <button className="link-btn" onClick={() => onFilter(null)}>
              Show all
            </button>
          ) : (
            <em>actual / {baselineDate ? "original plan" : "underwritten"}</em>
          )}
        </div>
        <div className="xd-bars">
          {shown.map((c) => {
            const tone = overTone(c.actual, c.budget);
            const pctUsed = c.budget > 0 ? (Math.max(0, c.actual) / c.budget) * 100 : c.actual > 0 ? 100 : 0;
            const over = c.budget > 0 && c.actual > c.budget ? Math.round((c.actual / c.budget - 1) * 100) : 0;
            return (
              <button key={c.cat} className={"xd-bar" + (filter === c.cat ? " on" : "") + (filter && filter !== c.cat ? " dim" : "")} onClick={() => onFilter(filter === c.cat ? null : c.cat)} aria-pressed={filter === c.cat} title={`Show only ${catShort(c.cat)} in the ledger`}>
                <span className="xd-bar-top">
                  <span className="xd-bar-l">{catShort(c.cat)}</span>
                  <span className="xd-bar-v">
                    <b className={c.actual < 0 ? "pos" : ""}>{c.actual < 0 ? "−" + fmt(-c.actual) : fmt(c.actual)}</b> / {c.budget > 0 ? fmt(c.budget) : "—"}
                  </span>
                </span>
                <span className="xd-track">
                  <i className={tone || ""} style={{ width: `${Math.min(100, pctUsed)}%` }} />
                </span>
                <span className="xd-bar-foot">
                  {c.actual < 0 ? (
                    <span className="pos">credit</span>
                  ) : c.budget <= 0 ? (
                    c.actual > 0 ? <span className="amber">Not in the budget</span> : <span>{c.note}</span>
                  ) : over > 0 ? (
                    <span className={tone}>+{over}% over</span>
                  ) : (
                    <span>{fmt(c.budget - c.actual)} left</span>
                  )}
                  <span>{c.budget > 0 && c.actual >= 0 ? `${Math.round(pctUsed)}%` : ""}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="xd-card xd-sale">
        <div className="xd-card-h">
          <span>Sale</span>
          {!sold && (
            <button className="link-btn" onClick={onReadSale}>
              Read sale HUD
            </button>
          )}
        </div>
        <Field label="Final sale price" value={actualSale} onChange={setActualSale} prefix="$" step={1000} />
      </section>
    </aside>
  );
}

// ---------- rehab budget, line by line (SOW milestones or the itemized estimate) ----------
function RehabLines({ P, actuals, setActuals, mgmt, repairs, useRepairBuilder, repairTotal, baseline, onGo }) {
  const [openLine, setOpenLine] = useState(null);
  const RL = rehabBudgetLines({ milestones: mgmt.rehab.milestones, repairs, useRepairBuilder, repairTotal });
  const keys = new Set(RL.lines.map((l) => l.key));
  const rehabEntries = actuals.filter((a) => a.cat === "Rehab / Construction");
  const lineOf = (a) => (RL.lines.length === 1 && RL.kind === "total" ? "rehab" : a.bl && keys.has(a.bl) ? a.bl : RB_UNASSIGNED);
  const lineRows = RL.lines.map((l) => {
    const entries = rehabEntries.filter((a) => lineOf(a) === l.key);
    return { ...l, entries, actual: entries.reduce((t, a) => t + amtOf(a), 0) };
  });
  const unassigned = rehabEntries.filter((a) => lineOf(a) === RB_UNASSIGNED);
  const unassignedTotal = unassigned.reduce((t, a) => t + amtOf(a), 0);
  const lineBudgetTotal = lineRows.reduce((t, l) => t + l.budget, 0);
  const rSpent = sumActuals(actuals, "Rehab / Construction");
  const assign = (id, key) => setActuals((p) => p.map((a) => (a.id === id ? { ...a, bl: key || undefined } : a)));
  const varCell = (budget, actual) => {
    const v = budget - actual;
    if (!budget && !actual) return <span className="dt-mute">—</span>;
    const tone = overTone(actual, budget);
    return <span className={tone ? "t-" + tone : ""}>{v < 0 ? `${fmt(-v)} over` : `${fmt(v)} left`}</span>;
  };
  const entryRow = (a, current) => (
    <div key={a.id} className="ba-entry">
      <span className="ba-entry-d">{a.date ? fmtDateShort(a.date) : ""}</span>
      <span className="ba-entry-l">{a.label || "—"}</span>
      <span className="ba-entry-a">{fmt(amtOf(a))}</span>
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
    <section className="dcard" id="sec-rehab">
      <div className="dcard-h">
        <Icon name="hammer" /> Rehab budget by line
        <span className="dcard-r">{RL.kind === "milestones" ? "from the milestones (SOW)" : RL.kind === "items" ? "from the itemized estimate" : "one total amount"}</span>
      </div>
      {RL.kind === "total" && (
        <div className="ba-hint">
          Read a contractor's SOW or itemize the rehab estimate to track the budget line by line.{" "}
          <button className="link-btn" onClick={() => onGo("underwrite")}>
            Open the rehab estimate
          </button>
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
              <th style={{ width: "24%" }}>Used</th>
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
                        {[RL.kind === "milestones" ? (l.status === "done" ? "Done" : l.status === "doing" ? "In progress" : "To do") : l.group || "", l.entries.length ? `${l.entries.length} expense${l.entries.length === 1 ? "" : "s"}` : ""]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  </td>
                  <td className="num">{l.budget ? fmt(l.budget) : <span className="dt-mute">—</span>}</td>
                  <td className="num">{l.actual ? fmt(l.actual) : <span className="dt-mute">—</span>}</td>
                  <td className="num">{varCell(l.budget, l.actual)}</td>
                  <td>{l.budget > 0 && <BudgetBar spent={l.actual} budget={l.budget} work={RL.kind === "milestones" && l.status !== "todo" ? (l.status === "done" ? 100 : 50) : null} />}</td>
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
              <td className="num">{fmt(rSpent)}</td>
              <td className="num">{varCell(lineBudgetTotal, rSpent)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {RL.kind !== "total" && Math.abs(lineBudgetTotal - (P.repair || 0)) >= 1 && (
        <div className="ba-hint">
          The lines add up to {fmt(lineBudgetTotal)}; the {baseline ? "original" : "current"} rehab budget is {fmt(P.repair || 0)}.
        </div>
      )}
    </section>
  );
}

// ---------- the screen ----------
function ExpensesDocs(p) {
  const { actuals, setActuals, mgmt, m, uwBaseline, arv, stage, actualSale, setActualSale, actualsTotal } = p;
  const [filter, setFilter] = useState(null);
  const [q, setQ] = useState("");
  const [openItems, setOpenItems] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [viewer, setViewer] = useState(null); // source document slide-over: { kind: "buy" | "sell" | "sow" }
  const [win, setWin] = useState(null); // expense window: { id, back } | { group: true }
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const P = uwBaseline ? uwBaseline.m : m;
  const cats = budgetCats(P, actuals, forecastScenario(mgmt, stage));
  // the forecast scenario's result, as on the Forecast tab, for the rail's projected profit
  const fcRail = (() => {
    const fsc = forecastScenario(mgmt, stage);
    if (!fsc || !p.position) return null;
    const today = todayISO();
    const uw = p.position.uw;
    const P2 = positionToday({ actuals, mgmt, uw, m, stage, today });
    const { sc, f } = fcMain({ P: P2, actuals, mgmt, uw, m, sellingAt: p.position.sellingAt, position: p.position, today, uwBaseline, holdMonths: uw.holdMonths, grade: "", purchase: m.purchase });
    return { name: sc.name || "scenario", price: f.price, saleDate: f.saleDate, profit: f.profit, total: f.total };
  })();
  const src = docSources(mgmt);
  const msById = Object.fromEntries((mgmt.rehab.milestones || []).map((x) => [x.id, x]));
  const sorted = [...actuals].sort((a, b) => {
    const da = a.date || "",
      db = b.date || "";
    if (da !== db) return db.localeCompare(da);
    return (b.id || 0) - (a.id || 0);
  });
  const eff = filter && actuals.some((a) => a.cat === filter) ? filter : filter && cats.some((c) => c.cat === filter) ? filter : null;
  const toks = searchTokens(q);
  const matches = toks.length ? new Map(actuals.map((a) => [a.id, matchEntry(a, toks)])) : null;
  const unpaidN = actuals.filter((a) => a.unpaid).length;
  const onlyUnpaid = unpaidOnly && unpaidN > 0;
  const byCat = (eff ? sorted.filter((a) => a.cat === eff) : sorted).filter((a) => !onlyUnpaid || a.unpaid);
  const list = matches ? byCat.filter((a) => matches.get(a.id).hit) : byCat;
  const unpaidTotal = actuals.filter((a) => a.unpaid).reduce((t, a) => t + amtOf(a), 0);
  // the category chips count what the search leaves
  const chipBase = matches ? sorted.filter((a) => matches.get(a.id).hit) : sorted;
  const presentCats = ACTUAL_CATS.filter((c) => actuals.some((a) => a.cat === c));
  const rows = ledgerRows(list);
  const listTotal = list.reduce((t, a) => t + amtOf(a), 0);
  const plan = P.netProfit != null ? P.netProfit : 0;
  const patchEntry = (id, patch) => setActuals((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const del = (a) => setActuals((prev) => prev.filter((x) => x.id !== a.id));
  const budgetLines = rehabBudgetLines({ milestones: mgmt.rehab.milestones, repairs: p.repairs, useRepairBuilder: p.useRepairBuilder, repairTotal: p.repairTotal }).lines;
  // opened from somewhere else (a cross-project search result): show that expense
  useEffect(() => {
    if (!p.focus) return;
    const a = actuals.find((x) => x.id === p.focus.id);
    if (a) {
      setFilter(null);
      setQ("");
      setWin({ id: a.id, item: p.focus.item || null });
    }
    p.onFocused && p.onFocused();
  }, [p.focus && p.focus.n]);
  const add = (e) => p.pushActuals([e]);
  // ---- the slide-over, built from the live data each render ----
  const linesOf = (pred) =>
    actuals
      .filter(pred)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
      .map((a) => ({ label: entryTitle(a).title, meta: [a.date ? fmtDate(a.date) : "", catShort(a.cat)].filter(Boolean).join(" · "), amount: amtOf(a) }));
  const docFile = (an) => (an && an.driveFileId ? [{ type: "drive_file", driveFileId: an.driveFileId, name: an.fileName }] : []);
  const viewFor = (v) => {
    if (!v) return null;
    if (v.kind === "buy" || v.kind === "sell") {
      const an = v.kind === "buy" ? src.buy : src.sell;
      const tags = v.kind === "buy" ? ["stmt_buy", STMT_CREDIT_TAG, "purchase_price"] : ["stmt_sell"];
      return {
        kicker: "HUD-1",
        title: v.kind === "buy" ? "Purchase closing statement" : "Sale closing statement",
        sub: an ? `${an.fileName || "Document"}${an.appliedAt ? `, applied ${fmtDate(isoOf(new Date(an.appliedAt)))}` : ""}` : "",
        files: docFile(an),
        noDoc: an ? "The document itself wasn't kept with the deal. The lines it produced are on the right." : "No statement has been applied yet.",
        lines: linesOf((a) => tags.includes(a.tag)),
        analysis: an,
      };
    }
    if (v.kind === "sow") {
      const an = src.sow;
      const ms = (mgmt.rehab.milestones || []).filter((x) => x.src === "sow");
      return {
        kicker: `SOW v${src.sowCount}`,
        title: "Scope of work",
        sub: an ? `${an.fileName || "Document"}${an.result && an.result.contractor ? `, ${an.result.contractor}` : ""}` : "",
        files: docFile(an),
        noDoc: "The SOW document wasn't kept with the deal. Its milestones are on the right.",
        linesTitle: "Milestones from the SOW",
        lines: ms.map((x) => ({ label: x.label, meta: x.status === "done" ? "Done" : x.status === "doing" ? "In progress" : "To do", amount: num(x.budget) })),
        analysis: an,
      };
    }
    return null;
  };
  const view = viewFor(viewer);
  const read = (k, source) => {
    if (k === "buy" || k === "sell") p.onImportClosing(k, source);
    else if (k === "sow") p.onImportSow(source);
    else p.onReadInvoice(source);
  };
  const showDocs = () => {
    const el = document.getElementById("sec-docs");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  // a source pill opens the document (HUD-1, SOW); for other entries it opens the expense itself
  const openSource = (a) => {
    const sv = entrySource(a, src, msById);
    if (sv.kind === "hud") setViewer({ kind: sv.side });
    else if (sv.kind === "sow") setViewer({ kind: "sow" });
    else setWin({ id: a.id });
  };
  const rowFor = (a, child) => (
    <EntryRow
      key={a.id}
      a={a}
      child={child}
      toks={toks}
      src={entrySource(a, src, msById)}
      itemsOpen={!!openItems[a.id] || !!(matches && matches.get(a.id).items.length)}
      onOpen={() => setWin({ id: a.id, back: child ? "group" : null })}
      onDelete={() => del(a)}
      onToggleItems={() => setOpenItems((o) => ({ ...o, [a.id]: !o[a.id] }))}
      onSource={() => openSource(a)}
    />
  );
  const winEntry = win && win.id != null ? actuals.find((x) => x.id === win.id) : null;
  const purchaseGroup = ledgerRows(sorted).find((r) => r.group);
  return (
    <div className="xd">
      <div className="xd-main">
        <DocDropzone stage={stage} src={src} analysesCount={(mgmt.analyses || []).length} onRead={read} onOpenSource={(k) => setViewer({ kind: k })} onShowDocs={showDocs} />
        {p.pmPanel}
        <section className="dcard xd-ledger">
          <div className="dcard-h">
            <Icon name="receipt" /> Ledger
            {p.position && (
              <button className="link-btn xd-pos" onClick={() => setPosOpen(true)}>
                Position today <Icon name="chevron" size={13} />
              </button>
            )}
            <span className="dcard-r">
              {list.length !== actuals.length ? `${list.length} of ` : ""}
              {actuals.length} {actuals.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          {actuals.length > 0 && (
            <div className="lg-tools">
              <div className="lg-search">
                <Icon name="search" size={14} />
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} placeholder="Search this ledger, sub-items too" aria-label="Search this ledger" />
                {q && (
                  <button className="lg-search-x" onClick={() => setQ("")} aria-label="Clear the search">
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
              {p.onSearchAll && (
                <button className="link-btn lg-all" onClick={() => p.onSearchAll(q)} title="Find this expense in every project">
                  Search all projects
                </button>
              )}
              <div className="lg-chips" role="group" aria-label="Filter by category">
                <button className={"lg-chip" + (!eff ? " on" : "")} onClick={() => setFilter(null)} aria-pressed={!eff}>
                  All <em>{chipBase.length}</em>
                </button>
                {presentCats.map((c) => {
                  const n = chipBase.filter((a) => a.cat === c).length;
                  return (
                    <button key={c} className={"lg-chip" + (eff === c ? " on" : "") + (n === 0 ? " zero" : "")} onClick={() => setFilter(eff === c ? null : c)} aria-pressed={eff === c} title={`${c}: ${fmt(sumActuals(actuals, c))}`}>
                      {catShort(c)} <em>{n}</em>
                    </button>
                  );
                })}
                {unpaidN > 0 && (
                  <button className={"lg-chip unpaid" + (onlyUnpaid ? " on" : "")} onClick={() => setUnpaidOnly(!onlyUnpaid)} aria-pressed={onlyUnpaid} title={`Not paid yet: ${fmt(unpaidTotal)}`}>
                    Not paid <em>{chipBase.filter((a) => a.unpaid).length}</em>
                  </button>
                )}
              </div>
            </div>
          )}
          <AddExpenseRow onAdd={add} defaultCat={eff || undefined} />
          {actuals.length === 0 ? (
            <div className="dcard-empty">No expenses logged yet. Drop a closing statement or an invoice above, or add a line.</div>
          ) : list.length === 0 ? (
            <div className="dcard-empty">
              {toks.length ? `Nothing in this ledger matches “${q.trim()}”${eff ? ` under ${catShort(eff)}` : ""}.` : `No ${catShort(eff).toLowerCase()} expenses yet.`}{" "}
              {toks.length && p.onSearchAll ? (
                <button className="link-btn" onClick={() => p.onSearchAll(q)}>
                  Search all projects
                </button>
              ) : null}
            </div>
          ) : (
            <div className="lg-list">
              {rows.map((r) =>
                r.group ? (
                  <div key={r.id} className={"lg-group" + (openGroups[r.id] ? " open" : "")}>
                    <div className="ledger-row lg-parent" role="button" tabIndex={0} onClick={() => setWin({ group: true })} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setWin({ group: true })} title="Open the purchase">
                      <div className="lg-main">
                        <span className="lg-title">
                          <button
                            className="lg-chev"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenGroups((o) => ({ ...o, [r.id]: !o[r.id] }));
                            }}
                            aria-expanded={!!openGroups[r.id]}
                            aria-label={openGroups[r.id] ? "Hide the linked entries" : "Show the linked entries"}
                          >
                            <Icon name="chevron" size={13} style={{ transform: openGroups[r.id] ? "rotate(90deg)" : "none" }} />
                          </button>
                          Purchase price
                        </span>
                        <span className="lg-meta">
                          <span>{r.date ? fmtDate(r.date) : ""}</span>
                          <span>Acquisition</span>
                          <span className="lg-detail">
                            {r.kids.length} linked entries: {r.kids.map((k) => (isEmdEntry(k) ? `${fmt(amtOf(k))} EMD` : `${fmt(amtOf(k))} at closing`)).join(" + ")}
                          </span>
                        </span>
                      </div>
                      <span />
                      <span className="lg-amt static">{fmt(r.amount)}</span>
                      <span />
                    </div>
                    {openGroups[r.id] && <div className="lg-kids">{r.kids.map((a) => rowFor(a, true))}</div>}
                  </div>
                ) : (
                  rowFor(r.entry, false)
                ),
              )}
            </div>
          )}
          {actuals.length > 0 && (
            <div className="lg-total">
              <span>{toks.length ? `${list.length} matching ${list.length === 1 ? "entry" : "entries"}` : onlyUnpaid ? "Not paid yet" : eff ? `${catShort(eff)} total` : unpaidN > 0 ? "Total recorded" : "Total spent"}</span>
              <b>{fmt(eff || toks.length || onlyUnpaid ? listTotal : actualsTotal)}</b>
            </div>
          )}
          {actuals.length > 0 && unpaidN > 0 && !onlyUnpaid && !eff && !toks.length && (
            <div className="lg-total sub">
              <span>of which not paid yet</span>
              <b>{fmt(unpaidTotal)}</b>
            </div>
          )}
        </section>
        <RehabLines
          P={P}
          actuals={actuals}
          setActuals={setActuals}
          mgmt={mgmt}
          repairs={p.repairs}
          useRepairBuilder={p.useRepairBuilder}
          repairTotal={p.repairTotal}
          baseline={!!uwBaseline}
          onGo={p.onGo}
        />
        <section className="dcard" id="sec-docs">
          <div className="dcard-h">
            <Icon name="folder" /> Documents
            <span className="dcard-r">{(mgmt.docs || []).length} files</span>
          </div>
          <div className="dcard-b">
            <div className="xd-sub-h">Read with AI</div>
            <AnalysesList
              analyses={mgmt.analyses}
              onOpen={p.onOpenAnalysis}
              onView={(a) => p.openAttachment({ type: "drive_file", driveFileId: a.driveFileId })}
              onDelete={p.onDeleteAnalysis}
              empty="Drop a closing statement or SOW above. Claude reads it and you approve each line before anything changes. Every analysis is kept here and reopens for free."
            />
          </div>
          <DocsPanel docs={mgmt.docs} upd={p.upd} onUploadDoc={p.onUploadDoc} openAttachment={p.openAttachment} connected={p.connected} uploading={p.docUploading} stage={stage} plain />
        </section>
      </div>
      <BudgetRail
        cats={cats}
        actualsTotal={actualsTotal}
        actualSale={actualSale}
        arv={uwBaseline ? uwBaseline.inputs.arv || arv : arv}
        plan={plan}
        baselineDate={uwBaseline ? uwBaseline.date : null}
        filter={eff}
        onFilter={setFilter}
        setActualSale={setActualSale}
        onReadSale={() => p.onImportClosing("sell")}
        fc={fcRail}
      />
      {posOpen && p.position && <PositionWindow {...p.position} actuals={actuals} mgmt={mgmt} m={m} stage={stage} setActuals={setActuals} setMgmt={p.setMgmt} onClose={() => setPosOpen(false)} />}
      {view && <DocViewer key={JSON.stringify(viewer)} view={view} onClose={() => setViewer(null)} onOpenAnalysis={(a) => (setViewer(null), p.onOpenAnalysis(a))} />}
      {win && win.group && purchaseGroup && <ExpenseWindow key="grp" group={purchaseGroup} onClose={() => setWin(null)} onOpenEntry={(id) => setWin({ id, back: "group" })} />}
      {winEntry && (
        <ExpenseWindow
          key={winEntry.id}
          a={winEntry}
          src={entrySource(winEntry, src, msById)}
          budgetLines={budgetLines}
          focusItem={win.item || null}
          onPatch={patchEntry}
          onDelete={(id) => setActuals((prev) => prev.filter((x) => x.id !== id))}
          onClose={() => setWin(null)}
          onBack={win.back === "group" && purchaseGroup ? () => setWin({ group: true }) : null}
          onOpenSource={(k) => {
            setWin(null);
            setViewer({ kind: k });
          }}
          entryTools={p.entryTools}
        />
      )}
    </div>
  );
}

// ---------- contractor invoice → one ledger entry ----------
const INVOICE_CATS = { rehab: "Rehab / Construction", holding: "Holding", services: "Services", selling: "Selling", acquisition: "Acquisition", financing: "Financing", other: "Other" };
const INVOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "vendor", "invoice_number", "date", "total", "description", "category", "property_address"],
  properties: {
    document_type: { type: "string" },
    vendor: { type: "string" },
    invoice_number: { type: "string" },
    date: { type: "string" },
    total: { type: "number" },
    description: { type: "string" },
    category: { type: "string", enum: Object.keys(INVOICE_CATS) },
    property_address: { type: "string" },
  },
};
const INVOICE_PROMPT = `You are reading a contractor invoice, a draw request or a store receipt for a fix-and-flip of a single-family house.

Return one ledger entry for it:
- vendor: the company or person who issued it ("" if not shown). invoice_number: as printed ("" if none).
- date: the invoice or payment date as YYYY-MM-DD ("" if not shown).
- total: the total amount due or paid, including tax. Never invent amounts; 0 if no total is printed.
- description: what was billed, max 60 characters, e.g. "Roof replacement, draw 2 of 3" or "Lumber and drywall".
- category: rehab (labor, materials, contractor draws, permits, dumpsters), holding (utilities, insurance, property taxes, lawn care), services (project management, inspections, legal, bookkeeping), selling (staging, photography, listing), acquisition (purchase costs), financing (interest, lender fees) or other.
- property_address: as printed ("" if not shown). document_type: a short name of the document.
Return only the JSON object.`;
async function extractInvoice(apiKey, payload) {
  const out = await callClaudeDocWithFallback(apiKey, payload, INVOICE_PROMPT, INVOICE_SCHEMA);
  if (!out || typeof out !== "object") throw new Error("Couldn't read an invoice in this document");
  return {
    vendor: String(out.vendor || "").trim(),
    number: String(out.invoice_number || "").trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(out.date || "")) ? out.date : "",
    total: Math.round(num(out.total) * 100) / 100,
    description: String(out.description || "").trim().slice(0, 80),
    cat: INVOICE_CATS[out.category] || "Rehab / Construction",
    address: String(out.property_address || "").trim(),
    docType: String(out.document_type || "").trim(),
  };
}
function InvoiceImportModal({ apiKey, initialSource, ctx, budgetLines, onApply, onClose, onOpenSettings, driveApi }) {
  const [source, setSource] = useState(initialSource || null);
  const [step, setStep] = useState("pick"); // pick | loading | review | error
  const [err, setErr] = useState("");
  const [f, setF] = useState({ date: todayISO(), cat: "Rehab / Construction", vendor: "", label: "", amount: 0, bl: "", keep: true });
  const [read, setRead] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const run = async (s) => {
    const use = s || source;
    if (!use) return;
    setStep("loading");
    setErr("");
    try {
      const payload = await loadPayload(use, driveApi);
      const o = await extractInvoice(apiKey, payload);
      setRead(o);
      setF((x) => ({ ...x, date: o.date || x.date, cat: o.cat, vendor: o.vendor, label: o.description, amount: o.total }));
      setStep("review");
    } catch (e) {
      setErr(e.message || String(e));
      setStep("error");
    }
  };
  useEffect(() => {
    if (initialSource && apiKey) run(initialSource);
  }, []);
  const label = [f.vendor.trim(), f.label.trim()].filter(Boolean).join(": ");
  const apply = () =>
    onApply({
      entry: { date: f.date || todayISO(), cat: f.cat, label: label || "Invoice", amount: Math.round((parseFloat(f.amount) || 0) * 100) / 100, bl: f.cat === "Rehab / Construction" && f.bl ? f.bl : undefined },
      source,
      keep: !!source && f.keep,
    });
  const showLines = f.cat === "Rehab / Construction" && budgetLines && budgetLines.length > 1;
  return (
    <Modal
      kicker="Contractor invoice or receipt"
      title={step === "review" ? "Check the entry" : "Read an invoice"}
      onClose={onClose}
      width={560}
      footer={
        step === "review" ? (
          <React.Fragment>
            <button onClick={onClose} style={btnGhost()}>
              Cancel
            </button>
            <button onClick={apply} disabled={!(parseFloat(f.amount) || label)} style={btnPrimary()}>
              Add to ledger
            </button>
          </React.Fragment>
        ) : step === "loading" ? null : (
          <React.Fragment>
            <button onClick={onClose} style={btnGhost()}>
              Cancel
            </button>
            <button onClick={() => setStep("review")} style={btnGhost()} title="Type the amount yourself; the file is still attached">
              Fill in by hand
            </button>
            {apiKey && (
              <button onClick={() => run()} disabled={!source} style={btnPrimary()}>
                Read invoice
              </button>
            )}
          </React.Fragment>
        )
      }
    >
      {(step === "pick" || step === "error") && (
        <React.Fragment>
          {!apiKey && <ApiKeyNote onOpenSettings={onOpenSettings} />}
          {step === "error" && readErrorNote(err, onOpenSettings)}
          <DocSourcePicker source={source} onSource={setSource} connected={ctx.connected} driveApi={driveApi} dealDocs={ctx.dealDocs} />
        </React.Fragment>
      )}
      {step === "loading" && (
        <div style={{ padding: "28px 0", textAlign: "center" }}>
          <div className="spin" />
          <div style={{ fontSize: 13, color: T.txtDim, marginTop: 12 }}>Claude is reading {source ? source.name : "the invoice"}…</div>
        </div>
      )}
      {step === "review" && (
        <React.Fragment>
          {read ? (
            <Note>
              Read from <b>{source && source.name}</b>
              {read.number ? `, invoice ${read.number}` : ""}
              {read.address ? `, for ${read.address}` : ""}. Check each field before it goes into the ledger.
            </Note>
          ) : (
            <Note>Type the invoice's details.{source ? ` ${source.name} is attached to the entry.` : ""}</Note>
          )}
          <div className="field-grid-2" style={grid2}>
            <TextIn label="Date" type="date" value={f.date} onChange={set("date")} />
            <SelectIn label="Category" value={f.cat} onChange={set("cat")} options={ACTUAL_CATS} />
            <TextIn label="Vendor" value={f.vendor} onChange={set("vendor")} placeholder="Contractor or store" />
            <Field label="Amount" value={parseFloat(f.amount) || 0} onChange={set("amount")} prefix="$" step={50} />
          </div>
          <TextIn label="Description" value={f.label} onChange={set("label")} placeholder="What was billed" />
          {showLines && <SelectIn label="Rehab budget line" value={f.bl} onChange={set("bl")} placeholder="Unassigned" options={budgetLines.map((l) => [l.key, l.label])} />}
          {source && (
            <CheckRow checked={f.keep} onChange={set("keep")}>
              Keep {source.name} with the deal and attach it to the entry{source.kind === "local" ? " (uploaded to the deal's Drive folder)" : ""}
            </CheckRow>
          )}
          <div className="inv-preview">
            Ledger line: <b>{label || "Invoice"}</b>, {catShort(f.cat)}, {f.date ? fmtDate(f.date) : "today"}, <b>{fmt(parseFloat(f.amount) || 0)}</b>
          </div>
        </React.Fragment>
      )}
    </Modal>
  );
}
