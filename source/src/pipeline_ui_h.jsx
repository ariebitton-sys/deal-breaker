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
  if (a.tag === "purchase_price") return { title: "Purchase price", detail: raw.replace(/^Purchase price\s*,?\s*/i, "") };
  if (isEmdEntry(a)) return { title: "Earnest money deposit", detail: /^(earnest money( deposit)?|emd)$/i.test(raw) ? "" : raw };
  if (p) {
    const head = LEDGER_TITLES[p[0]] || p[0];
    return { title: head, detail: /^\d+ items$/.test(p[1]) ? "" : p[1] };
  }
  return { title: LEDGER_TITLES[raw] || raw, detail: "" };
}
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
function budgetCats(P, actuals) {
  return [
    ["Acquisition", (P.purchase || 0) + (P.totalBuying || 0), "purchase price and buying costs"],
    ["Rehab / Construction", P.repair || 0, "rehab estimate"],
    ["Financing", P.totalFinancing || 0, "interest, points, investor return"],
    ["Holding", P.totalHolding || 0, "taxes, insurance, utilities"],
    ["Selling", P.totalSelling || 0, "commission, title, transfer"],
    ["Services", P.pmFee || 0, "project manager"],
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

// ---------- ledger rows ----------
function EntryEdit({ a, focus, onSave, onCancel }) {
  const [d, setD] = useState({ date: a.date || todayISO(), cat: a.cat, label: a.label || "", amount: amtOf(a) });
  const done = useRef(false);
  const save = () => {
    if (done.current) return;
    done.current = true;
    onSave({ date: d.date, cat: d.cat, label: d.label, amount: Number.isFinite(parseFloat(d.amount)) ? parseFloat(d.amount) : 0 });
  };
  const cancel = () => {
    done.current = true;
    onCancel();
  };
  return (
    <div
      className="ledger-row editing"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        } else if (e.key === "Escape") cancel();
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) save();
      }}
    >
      <div className="lg-edit">
        <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} aria-label="Date" />
        <select value={d.cat} onChange={(e) => setD({ ...d, cat: e.target.value })} aria-label="Category">
          {ACTUAL_CATS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input className="lg-in-label" value={d.label} autoFocus={focus !== "amount"} onChange={(e) => setD({ ...d, label: e.target.value })} aria-label="Description" />
        <input
          className="lg-in-amt"
          type="number"
          step="0.01"
          value={d.amount}
          autoFocus={focus === "amount"}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setD({ ...d, amount: e.target.value })}
          aria-label="Amount"
        />
      </div>
      <div className="lg-edit-foot">
        <span>Tab to move, Enter to save, Esc to cancel</span>
        <button onMouseDown={(e) => e.preventDefault()} onClick={save} className="lg-save">
          Save
        </button>
      </div>
    </div>
  );
}
function EntryRow({ a, src, child, editing, itemsOpen, onEdit, onSave, onCancel, onDelete, onToggleItems, onSource }) {
  const { title, detail } = entryTitle(a);
  const amt = amtOf(a);
  const items = Array.isArray(a.items) && a.items.length > 1 ? a.items : null;
  return (
    <div className={"lg-entry" + (child ? " child" : "")}>
      {editing ? (
        <EntryEdit a={a} focus={editing} onSave={onSave} onCancel={onCancel} />
      ) : (
        <div className="ledger-row">
          <div className="lg-main">
            <button className="lg-title" onClick={() => onEdit("label")} title={`${a.label || ""}\nClick to edit`}>
              {title}
            </button>
            <span className="lg-meta">
              <span>{a.date ? fmtDate(a.date) : "No date"}</span>
              <span>{catShort(a.cat)}</span>
              {items && (
                <button className={"ledger-items-btn" + (itemsOpen ? " open" : "")} onClick={onToggleItems} aria-expanded={itemsOpen} title={itemsOpen ? "Hide the breakdown" : `Show the ${items.length} items`}>
                  <Icon name="down" size={12} />
                  {items.length} items
                </button>
              )}
              {detail && <span className="lg-detail">{detail}</span>}
            </span>
          </div>
          <SourcePill src={src} onClick={onSource} />
          <button className={"lg-amt" + (amt < 0 ? " neg" : "")} onClick={() => onEdit("amount")} title="Click to edit">
            {amt < 0 ? <span className="ledger-neg">−{fmt(-amt)} credit</span> : fmt(amt)}
          </button>
          <button className="lg-del" onClick={onDelete} title="Delete entry" aria-label="Delete entry">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {items && itemsOpen && !editing && (
        <div className="ledger-items">
          {items.map((it, i) => (
            <div key={i} className="ledger-item">
              <span>{it.label}</span>
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
function AddExpenseRow({ onAdd, defaultCat }) {
  const blank = (cat) => ({ date: todayISO(), cat: cat || "Rehab / Construction", label: "", amount: "" });
  const [d, setD] = useState(() => blank(defaultCat));
  const add = () => {
    const amount = parseFloat(d.amount) || 0;
    if (!d.label.trim() && !amount) return;
    onAdd({ date: d.date || todayISO(), cat: d.cat, label: d.label.trim(), amount });
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
    </div>
  );
}

// ---------- right rail: live budget burn ----------
const BASIS_KEY = "kappa_ledger_basis";
function BudgetRail({ cats, actualsTotal, actualSale, arv, plan, baselineDate, filter, onFilter, setActualSale, onReadSale }) {
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
  const saleBasis = sold ? actualSale : arv;
  const totBudget = cats.reduce((t, c) => t + c.budget, 0);
  const totProjected = cats.reduce((t, c) => t + c.projected, 0);
  const remaining = Math.max(0, totProjected - actualsTotal);
  const projProfit = saleBasis - totProjected;
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
              {fmt(saleBasis)} {sold ? "sale" : "ARV"} less {fmt(actualsTotal)} spent and {fmt(remaining)} still budgeted
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
  const [edit, setEdit] = useState(null); // { id, focus }
  const [openItems, setOpenItems] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [viewer, setViewer] = useState(null); // { kind, ref }
  const P = uwBaseline ? uwBaseline.m : m;
  const cats = budgetCats(P, actuals);
  const src = docSources(mgmt);
  const msById = Object.fromEntries((mgmt.rehab.milestones || []).map((x) => [x.id, x]));
  const sorted = [...actuals].sort((a, b) => {
    const da = a.date || "",
      db = b.date || "";
    if (da !== db) return db.localeCompare(da);
    return (b.id || 0) - (a.id || 0);
  });
  const eff = filter && actuals.some((a) => a.cat === filter) ? filter : filter && cats.some((c) => c.cat === filter) ? filter : null;
  const list = eff ? sorted.filter((a) => a.cat === eff) : sorted;
  const rows = ledgerRows(list);
  const listTotal = list.reduce((t, a) => t + amtOf(a), 0);
  const plan = P.netProfit != null ? P.netProfit : 0;
  const save = (id, patch) => {
    setActuals((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setEdit(null);
  };
  const del = (a) => setActuals((prev) => prev.filter((x) => x.id !== a.id));
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
    const a = actuals.find((x) => x.id === v.id);
    if (!a) return null;
    const s = entrySource(a, src, msById);
    if (s.kind === "hud") return viewFor({ kind: s.side });
    if (s.kind === "sow") {
      const base = viewFor({ kind: "sow" });
      return { ...base, entry: a, files: [...(a.files || []), ...base.files] };
    }
    const t = entryTitle(a);
    return {
      kicker: s.label,
      title: t.title,
      sub: [a.date ? fmtDate(a.date) : "", a.cat, t.detail].filter(Boolean).join(" · "),
      files: a.files || [],
      noDoc: "No receipt or invoice attached yet. Upload one below.",
      linesTitle: "Ledger entry",
      lines: [{ label: a.label || t.title, meta: catShort(a.cat), amount: amtOf(a) }],
      entry: a,
    };
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
  const rowFor = (a, child) => (
    <EntryRow
      key={a.id}
      a={a}
      child={child}
      src={entrySource(a, src, msById)}
      editing={edit && edit.id === a.id ? edit.focus : null}
      itemsOpen={!!openItems[a.id]}
      onEdit={(focus) => setEdit({ id: a.id, focus })}
      onSave={(patch) => save(a.id, patch)}
      onCancel={() => setEdit(null)}
      onDelete={() => del(a)}
      onToggleItems={() => setOpenItems((o) => ({ ...o, [a.id]: !o[a.id] }))}
      onSource={() => setViewer({ kind: "entry", id: a.id })}
    />
  );
  return (
    <div className="xd">
      <div className="xd-main">
        <DocDropzone stage={stage} src={src} analysesCount={(mgmt.analyses || []).length} onRead={read} onOpenSource={(k) => setViewer({ kind: k })} onShowDocs={showDocs} />
        {p.pmPanel}
        <section className="dcard xd-ledger">
          <div className="dcard-h">
            <Icon name="receipt" /> Ledger
            <span className="dcard-r">
              {actuals.length} {actuals.length === 1 ? "entry" : "entries"}
            </span>
            {eff && (
              <button className="xd-filter" onClick={() => setFilter(null)} title="Show every category">
                {catShort(eff)} <Icon name="x" size={12} />
              </button>
            )}
          </div>
          <AddExpenseRow onAdd={add} defaultCat={eff || undefined} />
          {actuals.length === 0 ? (
            <div className="dcard-empty">No expenses logged yet. Drop a closing statement or an invoice above, or add a line.</div>
          ) : list.length === 0 ? (
            <div className="dcard-empty">No {catShort(eff).toLowerCase()} expenses yet.</div>
          ) : (
            <div className="lg-list">
              {rows.map((r) =>
                r.group ? (
                  <div key={r.id} className={"lg-group" + (openGroups[r.id] ? " open" : "")}>
                    <div className="ledger-row lg-parent">
                      <div className="lg-main">
                        <button className="lg-title" onClick={() => setOpenGroups((o) => ({ ...o, [r.id]: !o[r.id] }))} aria-expanded={!!openGroups[r.id]}>
                          <Icon name="chevron" size={13} style={{ transform: openGroups[r.id] ? "rotate(90deg)" : "none" }} /> Purchase price
                        </button>
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
              <span>{eff ? `${catShort(eff)} total` : "Total spent"}</span>
              <b>{fmt(eff ? listTotal : actualsTotal)}</b>
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
      />
      {view && <DocViewer key={JSON.stringify(viewer)} view={view} onClose={() => setViewer(null)} onOpenAnalysis={(a) => (setViewer(null), p.onOpenAnalysis(a))} entryTools={p.entryTools} />}
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
