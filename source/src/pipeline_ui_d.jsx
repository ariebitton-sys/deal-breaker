// ============================================================================
// v28 — PIPELINE UI (part D): AI document import — closing statements & SOW
// ============================================================================

// ---------- Pick a document: from this computer or from Google Drive ----------
function DocSourcePicker({ source, onSource, connected, driveApi, dealDocs }) {
  const [tab, setTab] = useState(source && source.kind === "drive" ? "drive" : "local");
  const [q, setQ] = useState("");
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [link, setLink] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    if (tab !== "drive" || !connected) return;
    let alive = true;
    const h = setTimeout(async () => {
      setBusy(true);
      setErr("");
      try {
        const fs = await driveApi.search(q);
        if (alive) setFiles(fs);
      } catch (e) {
        if (alive) setErr(e.message || String(e));
      } finally {
        if (alive) setBusy(false);
      }
    }, q ? 350 : 0);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [tab, q, connected]);
  const pickLocal = (f) => f && onSource({ kind: "local", file: f, name: f.name, size: f.size, mimeType: f.type });
  const pickDrive = (f) => onSource({ kind: "drive", file: f, name: f.name, size: Number(f.size) || 0, mimeType: f.mimeType });
  const useLink = async () => {
    const id = driveIdFromLink(link);
    if (!id) {
      setErr("That doesn't look like a Google Drive link");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      pickDrive(await driveApi.info(id));
      setLink("");
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  const aiDocs = (dealDocs || []).filter((d) => d.type === "drive_file" && (AI_DOC_TYPES.includes(d.mimeType) || d.mimeType === GDOC_MIME));
  const sel = source && source.kind === "drive" ? source.file.id : null;
  const Row = ({ f, sub }) => (
    <button
      onClick={() => pickDrive(f)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "7px 9px",
        border: "none",
        borderBottom: `1px solid ${T.border}`,
        background: sel === f.id ? `${T.violet}14` : "transparent",
        cursor: "pointer",
        fontFamily: FONT,
      }}
    >
      <span>{docKindIcon(f.mimeType)}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.txt, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
      <span style={{ fontSize: 10.5, color: T.txtMute, fontFamily: MONO, whiteSpace: "nowrap" }}>{sub}</span>
      {sel === f.id && <span style={{ color: T.violet, fontWeight: 800 }}>✓</span>}
    </button>
  );
  const tabBtn = (k, l, disabled) => (
    <button
      onClick={() => !disabled && setTab(k)}
      style={{
        ...smallBtn(tab === k ? `${T.violet}1c` : T.glass, disabled ? T.txtMute : tab === k ? T.violet : T.txtDim),
        border: `1px solid ${tab === k ? T.violet : T.border}`,
        fontWeight: tab === k ? 800 : 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {l}
    </button>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        {tabBtn("local", "From computer")}
        {tabBtn("drive", "From Google Drive", !connected)}
        {!connected && <span style={{ fontSize: 11, color: T.txtMute }}>connect Google to pick from Drive</span>}
      </div>
      {tab === "local" ? (
        <React.Fragment>
          <input
            ref={fileRef}
            type="file"
            accept={AI_ACCEPT}
            style={{ display: "none" }}
            onChange={(e) => {
              pickLocal(e.target.files && e.target.files[0]);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pickLocal(e.dataTransfer.files && e.dataTransfer.files[0]);
            }}
            style={{
              width: "100%",
              padding: "20px 14px",
              borderRadius: 4,
              border: `2px dashed ${drag || (source && source.kind === "local") ? T.violet : T.border}`,
              background: source && source.kind === "local" ? `${T.violet}0a` : T.inputBg,
              cursor: "pointer",
              fontFamily: FONT,
              color: T.txt,
            }}
          >
            <div style={{ fontSize: 22 }}>{source && source.kind === "local" ? docKindIcon(source.mimeType) : <Icon name="file" size={22} />}</div>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 4 }}>
              {source && source.kind === "local" ? source.name : "Choose or drop a file"}
            </div>
            <div style={{ fontSize: 11.5, color: T.txtMute, marginTop: 2 }}>
              {source && source.kind === "local" ? `${Math.round(source.size / 1024)} KB, click to change` : "PDF, or a photo/scan (JPG, PNG)"}
            </div>
          </button>
        </React.Fragment>
      ) : (
        <div>
          <input placeholder="Search Drive by file name" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inSt(), marginBottom: 8 }} />
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, maxHeight: 250, overflowY: "auto", background: "#fff" }}>
            {aiDocs.length > 0 && !q && (
              <React.Fragment>
                <div style={{ ...subHead(T.violet), margin: 0, padding: "7px 9px 3px", fontSize: 10 }}>This deal's documents</div>
                {aiDocs.map((d) => (
                  <Row key={"d" + d.id} f={{ id: d.driveFileId, name: d.name, mimeType: d.mimeType, size: d.size }} sub={d.kind || fmtDateShort(d.date)} />
                ))}
                <div style={{ ...subHead(T.txtMute), margin: 0, padding: "7px 9px 3px", fontSize: 10 }}>Recent in Drive</div>
              </React.Fragment>
            )}
            {busy && <div style={{ padding: 10, fontSize: 12, color: T.txtMute }}>⏳ searching…</div>}
            {!busy && files && files.length === 0 && <div style={{ padding: 10, fontSize: 12, color: T.txtMute }}>No PDFs, images or Google Docs match.</div>}
            {!busy &&
              (files || []).map((f) => (
                <Row key={f.id} f={f} sub={`${f.modifiedTime ? fmtDateShort(isoOf(new Date(f.modifiedTime))) : ""}${f.size ? `, ${Math.round(f.size / 1024)} KB` : ""}`} />
              ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              placeholder="…or paste a Google Drive / Docs link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && useLink()}
              style={{ ...inSt(), fontSize: 12 }}
            />
            <button onClick={useLink} disabled={!link.trim()} style={{ ...smallBtn(link.trim() ? T.violet : T.glass, link.trim() ? "#fff" : T.txtMute), whiteSpace: "nowrap" }}>
              Use link
            </button>
          </div>
          {source && source.kind === "drive" && (
            <div style={{ fontSize: 12, marginTop: 8, color: T.violet, fontWeight: 700 }}>
              Selected: {docKindIcon(source.mimeType)} {source.name}
              {source.mimeType === GDOC_MIME ? <span style={{ color: T.txtMute, fontWeight: 400 }}> (Google Doc — read as PDF)</span> : null}
            </div>
          )}
        </div>
      )}
      {err && <div style={{ fontSize: 11.5, color: T.red, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// ---------- Saved analyses list (reopen without re-uploading or paying again) ----------
function AnalysesList({ analyses, kinds, onOpen, onView, onDelete, empty }) {
  const list = (analyses || []).filter((a) => !kinds || kinds.includes(analysisKey(a)));
  if (!list.length) return empty ? <div style={{ fontSize: 13, color: T.txtMute, lineHeight: 1.5 }}>{empty}</div> : null;
  return (
    <div className="analyses">
      {list.map((a) => {
        const k = analysisKey(a);
        const meta =
          a.kind === "sow"
            ? `${(a.result && a.result.milestones && a.result.milestones.length) || 0} milestones${a.result && a.result.total ? `, ${fmt(a.result.total)}` : ""}`
            : `${(a.result && a.result.lines && a.result.lines.length) || 0} lines${a.result && a.result.closing_date ? `, closed ${fmtDateShort(a.result.closing_date)}` : ""}`;
        return (
          <div key={a.id} className="analysis-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ color: T.txtMute, display: "flex" }}>
              <Icon name="file" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {ANALYSIS_LABEL[k]} <span style={{ fontWeight: 400, color: T.txtDim }}>{a.fileName}</span>
              </div>
              <div style={{ fontSize: 12, color: T.txtMute, marginTop: 1 }}>
                {meta}, read {fmtTs(a.date)}
                {a.by ? ` by ${nameOnly(a.by)}` : ""}.{" "}
                {a.appliedAt ? <span style={{ color: T.green, fontWeight: 600 }}>Applied {fmtDateShort(isoOf(new Date(a.appliedAt)))}</span> : <span style={{ color: T.amber, fontWeight: 600 }}>Not applied</span>}
              </div>
            </div>
            <button onClick={() => onOpen(a)} title="Review the mapping again: no upload, no new AI read" style={smallBtn("#FFFFFF", T.blue)}>
              Open
            </button>
            {a.driveFileId && onView && (
              <button onClick={() => onView(a)} title="View the document in Drive" style={smallBtn(T.glass, T.txtDim)}>
                View
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(a)} title="Delete this saved analysis" aria-label="Delete analysis" style={iconBtn()}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ApiKeyNote({ onOpenSettings }) {
  return (
    <Note tone={T.amber}>
      Reading a new document needs an Anthropic API key — add it in{" "}
      <button onClick={onOpenSettings} style={{ ...iconBtn(T.teal), fontSize: 12, fontWeight: 700, padding: 0 }}>
        Settings
      </button>
      . Saved analyses below open without a key.
    </Note>
  );
}
const loadPayload = (source, driveApi) => (source.kind === "local" ? payloadFromLocal(source.file) : driveApi.download(source.file));
const readErrorNote = (err, onOpenSettings) => (
  <Note tone={T.red}>
    <b>Couldn't read the document.</b> {err}
    {/401|authentication|invalid x-api-key/i.test(err) ? (
      <React.Fragment>
        {" "}
        — the key was rejected. Open{" "}
        <button onClick={onOpenSettings} style={{ ...iconBtn(T.teal), fontSize: 12, fontWeight: 700, padding: 0 }}>
          Settings
        </button>{" "}
        and press <b>Test key</b>.
      </React.Fragment>
    ) : null}
  </Note>
);
function SaveDocOption({ source, existing, opts, o, connected, dealDocs }) {
  if (!source) return null; // reopened analysis — the document was handled when it was first read
  if (source.kind === "drive") {
    const listed = (dealDocs || []).some((d) => d.driveFileId === source.file.id);
    if (listed) return null;
    return (
      <CheckRow checked={opts.saveDoc} onChange={o("saveDoc")}>
        List this Drive file under the deal's Documents
      </CheckRow>
    );
  }
  if (existing && existing.driveFileId) return null;
  return (
    <CheckRow checked={opts.saveDoc} onChange={o("saveDoc")} disabled={!connected}>
      Save the file to Drive and list it under the deal's Documents{!connected ? " — connect Google first" : ""}
    </CheckRow>
  );
}

// ---------- Closing statement ----------
function ClosingImportModal({ initialSide, apiKey, ctx, existing, onAnalyzed, onApply, onClose, onOpenSettings, driveApi }) {
  const [side, setSide] = useState((existing && existing.review && existing.review.side) || (existing && existing.side) || initialSide || "buy");
  const [source, setSource] = useState(null);
  const [step, setStep] = useState("pick"); // pick | loading | review | error
  const [err, setErr] = useState("");
  const [out, setOut] = useState(null);
  const [rec, setRec] = useState(existing || null);
  const [lines, setLines] = useState([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [price, setPrice] = useState(0);
  const [closingDate, setClosingDate] = useState("");
  const [opts, setOpts] = useState({});
  const sIdx = stageIdx(ctx.stage);
  const prevImported = (ctx.actuals || []).filter((a) => a.tag === `stmt_${side}`).length;
  const hasPurchaseEntry = (ctx.actuals || []).some((a) => a.tag === "purchase_price");
  const resetOpts = (sd) => {
    const advanced = sd === "buy" ? sIdx >= 1 || ctx.stage === "dead" : sIdx >= 3;
    setOpts({
      updateRows: true,
      turnOffMissing: false,
      addLedger: ctx.origin === "ledger" || advanced,
      replacePrev: true,
      setPrice: sd === "sell" ? true : advanced,
      addPurchase: sd === "buy" && (ctx.origin === "ledger" || advanced) && !hasPurchaseEntry,
      saveDoc: true,
    });
  };
  // Rebuild review lines; when reopening, restore the mapping that was last applied/edited.
  const build = (o, sd, review) => {
    let ls = stmtLinesForSide(o, sd);
    if (review && review.side === sd && Array.isArray(review.lines)) {
      const byId = Object.fromEntries(review.lines.map((r) => [r.id, r]));
      ls = ls.map((l) => (byId[l.id] ? { ...l, target: byId[l.id].target, include: byId[l.id].include, amount: byId[l.id].amount } : l));
    }
    setLines(ls);
    setPrice(review && review.side === sd && review.price != null ? review.price : stmtPriceForSide(o, sd));
    setClosingDate(review && review.closingDate != null ? review.closingDate : o.closing_date || "");
    resetOpts(sd);
  };
  const openRecord = (r) => {
    const sd = (r.review && r.review.side) || r.side || side;
    setRec(r);
    setSide(sd);
    setOut(r.result);
    build(r.result, sd, r.review);
    setStep("review");
  };
  useEffect(() => {
    if (existing) openRecord(existing);
  }, []);
  const run = async () => {
    if (!source) return;
    setStep("loading");
    setErr("");
    try {
      const payload = await loadPayload(source, driveApi);
      const o = await extractClosingStatement(apiKey, payload);
      const r = onAnalyzed({
        kind: "closing",
        side,
        fileName: payload.name,
        driveFileId: payload.driveSourceId || null,
        mimeType: payload.sourceMime || payload.mediaType,
        docType: o.document_type || "",
        result: o,
      });
      setRec(r);
      setOut(o);
      build(o, side);
      setStep("review");
    } catch (e) {
      setErr(e.message || String(e));
      setStep("error");
    }
  };
  const switchSide = (sd) => {
    setSide(sd);
    if (out) build(out, sd, rec && rec.review);
  };
  const setLine = (id, k, v) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [k]: v } : l)));
  const targets = STMT_TARGETS[side];
  const targetLabel = Object.fromEntries(targets);
  const relevant = lines.filter((l) => l.category !== "price");
  const shown = showSkipped ? relevant : relevant.filter((l) => l.target !== "ignore" || l.include);
  const skippedCount = relevant.filter((l) => l.target === "ignore" && !l.include).length;
  const included = relevant.filter((l) => l.include && l.target !== "ignore");
  const totalsBy = {};
  included.forEach((l) => (totalsBy[l.target] = (totalsBy[l.target] || 0) + l.amount));
  const closingCosts = included.filter((l) => l.target.startsWith("txn:") || l.target === "points").reduce((s, l) => s + l.amount, 0);
  const otherCosts = included.filter((l) => l.target === "holding" || l.target === "interest").reduce((s, l) => s + l.amount, 0);
  const dn = houseNo(out && out.property_address),
    an = houseNo(ctx.address);
  const addrMismatch = dn && an && dn !== an;
  const sideLabel = side === "buy" ? "Purchase" : "Sale";
  const o = (k) => (v) => setOpts((p) => ({ ...p, [k]: v }));
  const saved = (ctx.analyses || []).filter((a) => a.kind === "closing");
  const apply = () =>
    onApply({
      analysisId: rec && rec.id,
      side,
      lines: included,
      review: { side, price, closingDate, lines: lines.map((l) => ({ id: l.id, target: l.target, include: l.include, amount: l.amount })) },
      price,
      closingDate,
      opts,
      source,
      docType: out.document_type,
    });

  return (
    <Modal
      kicker="Closing statement import"
      title={step === "review" ? `${sideLabel} closing statement` : "Import a closing statement"}
      onClose={step === "loading" ? () => {} : onClose}
      width={step === "review" ? 760 : 560}
    >
      {(step === "pick" || step === "error") && (
        <React.Fragment>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              ["buy", "Purchase (we bought)"],
              ["sell", "Sale (we sold)"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSide(k)}
                style={{
                  ...smallBtn(side === k ? `${T.violet}1c` : T.glass, side === k ? T.violet : T.txtDim),
                  border: `1px solid ${side === k ? T.violet : T.border}`,
                  fontWeight: side === k ? 800 : 600,
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {saved.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={subHead(T.violet)}>Already analyzed for this deal</div>
              <AnalysesList analyses={saved} onOpen={openRecord} />
            </div>
          )}
          {!apiKey ? (
            <ApiKeyNote onOpenSettings={onOpenSettings} />
          ) : (
            <React.Fragment>
              <div style={subHead()}>New document</div>
              <DocSourcePicker source={source} onSource={setSource} connected={ctx.connected} driveApi={driveApi} dealDocs={ctx.dealDocs} />
            </React.Fragment>
          )}
          {step === "error" && readErrorNote(err, onOpenSettings)}
          <Note>
            Claude reads every line, then you review how each one maps to your cost rows before anything changes. Only the {side === "buy" ? "buyer's" : "seller's"} side
            is used. The result is saved on the deal, so you can reopen it later without uploading or paying again.
          </Note>
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={bs(T.glass, T.txtDim)}>
              Cancel
            </button>
            {apiKey && (
              <button
                onClick={run}
                disabled={!source}
                style={{ ...bs(source ? T.violet : T.glass, source ? "#fff" : T.txtMute), border: "none", cursor: source ? "pointer" : "not-allowed" }}
              >
                Read statement
              </button>
            )}
          </div>
        </React.Fragment>
      )}
      {step === "loading" && (
        <div style={{ textAlign: "center", padding: "26px 10px" }}>
          <div className="spin" />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Reading {source && source.name}…</div>
          <div style={{ fontSize: 12, color: T.txtMute, marginTop: 4 }}>Usually 15–40 seconds.</div>
        </div>
      )}
      {step === "review" && out && (
        <React.Fragment>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: T.txtDim, marginBottom: 8 }}>
            <Chip color={T.violet}>{out.document_type || "Statement"}</Chip>
            <span>{out.property_address || "address not found"}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11 }}>reading as</span>
            {[
              ["buy", "Purchase"],
              ["sell", "Sale"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => switchSide(k)}
                style={{
                  ...smallBtn(side === k ? `${T.violet}1c` : T.glass, side === k ? T.violet : T.txtDim),
                  border: `1px solid ${side === k ? T.violet : T.border}`,
                  padding: "4px 9px",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {rec && (
            <div style={{ fontSize: 11, color: T.txtMute, marginBottom: 8 }}>
              Saved analysis of <b>{rec.fileName}</b>, read {fmtTs(rec.date)}
              {rec.appliedAt ? `, last applied ${fmtTs(rec.appliedAt)}` : ""}
            </div>
          )}
          {addrMismatch && (
            <Note tone={T.red}>
              The statement's address ({out.property_address}) doesn't match this deal ({ctx.address}). Check you picked the right file.
            </Note>
          )}
          <div className="field-grid-2" style={grid2}>
            <Field label={`${sideLabel} price on statement`} value={price} onChange={setPrice} prefix="$" step={1000} />
            <TextIn label="Closing date" type="date" value={closingDate} onChange={setClosingDate} />
          </div>
          <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: T.inputBg, fontSize: 12, fontWeight: 500, color: T.txtMute }}>
                  <th style={{ padding: "6px 8px", width: 28 }}></th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Line on statement</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", width: 110 }}>{side === "buy" ? "Buyer pays" : "Seller pays"}</th>
                  <th style={{ padding: "6px 8px", textAlign: "left", width: 245 }}>Goes to</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id} style={{ borderTop: `1px solid ${T.border}`, opacity: l.include ? 1 : 0.5 }}>
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      <input type="checkbox" checked={l.include} onChange={(e) => setLine(l.id, "include", e.target.checked)} />
                    </td>
                    <td style={{ padding: "4px 8px" }}>{l.description}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={l.amount}
                        onChange={(e) => setLine(l.id, "amount", num(e.target.value))}
                        style={{ ...inSt(), width: 100, padding: "4px 6px", fontSize: 12, fontFamily: MONO, textAlign: "right", color: l.amount < 0 ? T.green : T.txt }}
                      />
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <select
                        value={l.target}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, target: v, include: v !== "ignore" } : x)));
                        }}
                        style={{ ...inSt(), padding: "4px 6px", fontSize: 12 }}
                      >
                        {targets.map(([v, lb]) => (
                          <option key={v} value={v}>
                            {lb}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: T.txtMute, margin: "6px 2px 10px", flexWrap: "wrap", gap: 6 }}>
            <span>Negative amounts are credits to us (they reduce the cost).</span>
            {skippedCount > 0 && (
              <button onClick={() => setShowSkipped((s) => !s)} style={{ ...iconBtn(T.teal), fontSize: 11.5 }}>
                {showSkipped ? "Hide" : "Show"} {skippedCount} skipped line{skippedCount === 1 ? "" : "s"} (price, loan, deposits, payoffs)
              </button>
            )}
          </div>
          <div style={{ background: T.inputBg, borderRadius: 4, padding: "8px 14px", marginBottom: 10 }}>
            {Object.keys(totalsBy).map((k) => (
              <MiniRow key={k} label={targetLabel[k]} value={fmt(totalsBy[k])} />
            ))}
            <MiniRow label={side === "buy" ? "Closing costs (cost rows + lender fees)" : "Closing costs (cost rows)"} value={fmt(closingCosts)} strong color={T.violet} />
            {otherCosts !== 0 && <MiniRow label="Prorations & interest (ledger only)" value={fmt(otherCosts)} />}
          </div>
          <div style={subHead(T.violet)}>Apply to this deal</div>
          <CheckRow checked={opts.updateRows} onChange={o("updateRows")}>
            Set the {side === "buy" ? "Buying" : "Selling"} Transaction Cost rows to these exact $ amounts{side === "buy" ? " (and Points / Lender Fees)" : ""}
          </CheckRow>
          {opts.updateRows && (
            <div style={{ paddingLeft: 22 }}>
              <CheckRow checked={opts.turnOffMissing} onChange={o("turnOffMissing")}>
                Turn off cost rows that aren't on the statement
              </CheckRow>
            </div>
          )}
          <CheckRow checked={opts.addLedger} onChange={o("addLedger")}>
            Add each line to the Actuals Ledger ({side === "buy" ? "Acquisition / Financing / Holding" : "Selling / Financing / Holding"}), dated{" "}
            {closingDate ? fmtDate(closingDate) : "today"}
          </CheckRow>
          {opts.addLedger && prevImported > 0 && (
            <div style={{ paddingLeft: 22 }}>
              <CheckRow checked={opts.replacePrev} onChange={o("replacePrev")}>
                Replace the {prevImported} ledger entr{prevImported === 1 ? "y" : "ies"} from the previous {side === "buy" ? "purchase" : "sale"} statement import
              </CheckRow>
            </div>
          )}
          {side === "buy" && price > 0 && (
            <CheckRow checked={opts.addPurchase} onChange={o("addPurchase")} disabled={hasPurchaseEntry}>
              Log the purchase price ({fmt(price)}) in the ledger as Acquisition{hasPurchaseEntry ? " — already logged" : ""}
            </CheckRow>
          )}
          {price > 0 && (
            <CheckRow checked={opts.setPrice} onChange={o("setPrice")}>
              {side === "buy" ? `Use ${fmt(price)} as the purchase price (current forecast)` : `Record ${fmt(price)} as the final sale price`}
              {side === "buy" && ctx.purchase && Math.abs(ctx.purchase - price) >= 1 ? ` — now ${fmt(ctx.purchase)}` : ""}
            </CheckRow>
          )}
          <SaveDocOption source={source} existing={rec} opts={opts} o={o} connected={ctx.connected} dealDocs={ctx.dealDocs} />
          {ctx.hasBaseline && <Note>The original underwriting stays frozen — these amounts update the current forecast and the actuals only.</Note>}
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={onClose} style={bs(T.glass, T.txtDim)}>
              Close
            </button>
            <button onClick={apply} disabled={!included.length && !opts.setPrice} style={{ ...bs(T.violet, "#fff"), border: "none" }}>
              Apply {included.length} line{included.length === 1 ? "" : "s"}
            </button>
          </div>
        </React.Fragment>
      )}
    </Modal>
  );
}

// ---------- Scope of Work → milestones ----------
function SowImportModal({ apiKey, ctx, existing, onAnalyzed, onApply, onClose, onOpenSettings, driveApi }) {
  const [source, setSource] = useState(null);
  const [step, setStep] = useState("pick");
  const [err, setErr] = useState("");
  const [out, setOut] = useState(null);
  const [rec, setRec] = useState(existing || null);
  const [items, setItems] = useState([]);
  const [opts, setOpts] = useState({});
  const hasProgress = (ctx.milestones || []).some((m) => m.status && m.status !== "todo");
  const build = (o, review) => {
    let its = o.milestones.map((m, i) => ({ id: i, include: true, name: m.name, scope: m.scope, cost: m.cost, trade: m.trade }));
    if (review && Array.isArray(review.items)) its = review.items.map((x) => ({ ...x }));
    setItems(its);
    const total = o.total || its.reduce((s, x) => s + x.cost, 0);
    setOpts({
      mode: hasProgress ? "append" : "replace",
      setRepair: ctx.stage === "analyzing" && total > 0 && Math.abs(total - (ctx.repair || 0)) >= 1,
      addContact: !!o.contractor && !(ctx.contacts || []).some((c) => (c.name || c.company || "").toLowerCase() === o.contractor.toLowerCase()),
      saveDoc: true,
    });
  };
  const openRecord = (r) => {
    setRec(r);
    setOut(r.result);
    build(r.result, r.review);
    setStep("review");
  };
  useEffect(() => {
    if (existing) openRecord(existing);
  }, []);
  const run = async () => {
    if (!source) return;
    setStep("loading");
    setErr("");
    try {
      const payload = await loadPayload(source, driveApi);
      const o = await extractSow(apiKey, payload);
      const r = onAnalyzed({
        kind: "sow",
        fileName: payload.name,
        driveFileId: payload.driveSourceId || null,
        mimeType: payload.sourceMime || payload.mediaType,
        docType: o.document_type || "",
        result: o,
      });
      setRec(r);
      setOut(o);
      build(o);
      setStep("review");
    } catch (e) {
      setErr(e.message || String(e));
      setStep("error");
    }
  };
  const setItem = (id, k, v) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const move = (idx, d) =>
    setItems((xs) => {
      const j = idx + d;
      if (j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[idx], c[j]] = [c[j], c[idx]];
      return c;
    });
  const included = items.filter((x) => x.include && x.name.trim());
  const sum = included.reduce((s, x) => s + num(x.cost), 0);
  const docTotal = out ? out.total : 0;
  const o = (k) => (v) => setOpts((p) => ({ ...p, [k]: v }));
  const dn = houseNo(out && out.property_address),
    an = houseNo(ctx.address);
  const addrMismatch = dn && an && dn !== an;
  const saved = (ctx.analyses || []).filter((a) => a.kind === "sow");
  const repairTarget = sum > 0 ? sum : docTotal;
  const apply = () =>
    onApply({
      analysisId: rec && rec.id,
      milestones: included.map((x) => ({ name: x.name.trim(), scope: x.scope, cost: num(x.cost), trade: x.trade })),
      review: { items },
      opts,
      repairTotal: repairTarget,
      contractor: out.contractor,
      source,
      docType: out.document_type,
    });
  return (
    <Modal kicker="Scope of Work" title={step === "review" ? "Milestones from the SOW" : "Create milestones from a Scope of Work"} onClose={step === "loading" ? () => {} : onClose} width={step === "review" ? 800 : 560}>
      {(step === "pick" || step === "error") && (
        <React.Fragment>
          {saved.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={subHead(T.violet)}>Already analyzed for this deal</div>
              <AnalysesList analyses={saved} onOpen={openRecord} />
            </div>
          )}
          {!apiKey ? (
            <ApiKeyNote onOpenSettings={onOpenSettings} />
          ) : (
            <React.Fragment>
              <div style={subHead()}>New document</div>
              <DocSourcePicker source={source} onSource={setSource} connected={ctx.connected} driveApi={driveApi} dealDocs={ctx.dealDocs} />
            </React.Fragment>
          )}
          {step === "error" && readErrorNote(err, onOpenSettings)}
          <Note>
            Claude groups the SOW line items into rehab milestones in the usual order of work, with a budget for each. You review and edit them before anything changes. The
            result is saved on the deal.
          </Note>
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={bs(T.glass, T.txtDim)}>
              Cancel
            </button>
            {apiKey && (
              <button
                onClick={run}
                disabled={!source}
                style={{ ...bs(source ? T.violet : T.glass, source ? "#fff" : T.txtMute), border: "none", cursor: source ? "pointer" : "not-allowed" }}
              >
                Read SOW
              </button>
            )}
          </div>
        </React.Fragment>
      )}
      {step === "loading" && (
        <div style={{ textAlign: "center", padding: "26px 10px" }}>
          <div className="spin" />
          <div style={{ fontWeight: 700, marginTop: 8 }}>Reading {source && source.name}…</div>
          <div style={{ fontSize: 12, color: T.txtMute, marginTop: 4 }}>Usually 20–60 seconds.</div>
        </div>
      )}
      {step === "review" && out && (
        <React.Fragment>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: T.txtDim, marginBottom: 6 }}>
            <Chip color={T.violet}>{out.document_type || "Scope of Work"}</Chip>
            {out.contractor && <b style={{ color: T.txt }}>{out.contractor}</b>}
            <span>{out.property_address}</span>
            <span style={{ flex: 1 }} />
            {docTotal > 0 && (
              <span>
                SOW total <b style={{ fontFamily: MONO, color: T.txt }}>{fmt(docTotal)}</b>
              </span>
            )}
          </div>
          {rec && (
            <div style={{ fontSize: 11, color: T.txtMute, marginBottom: 8 }}>
              Saved analysis of <b>{rec.fileName}</b>, read {fmtTs(rec.date)}
              {rec.appliedAt ? `, last applied ${fmtTs(rec.appliedAt)}` : ""}
            </div>
          )}
          {addrMismatch && <Note tone={T.red}>The SOW's address ({out.property_address}) doesn't match this deal ({ctx.address}). Check you picked the right file.</Note>}
          {out.payment_terms && <Note>Payment terms: {out.payment_terms}</Note>}
          <div style={{ overflowX: "auto", border: `1px solid ${T.border}`, borderRadius: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: T.inputBg, fontSize: 12, fontWeight: 500, color: T.txtMute }}>
                  <th style={{ padding: "6px 8px", width: 28 }}></th>
                  <th style={{ padding: "6px 4px", width: 46 }}>Order</th>
                  <th style={{ padding: "6px 8px", textAlign: "left", width: 245 }}>Milestone</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Scope</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", width: 110 }}>Budget</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x, i) => (
                  <tr key={x.id} style={{ borderTop: `1px solid ${T.border}`, opacity: x.include ? 1 : 0.5, verticalAlign: "top" }}>
                    <td style={{ padding: "6px 8px", textAlign: "center" }}>
                      <input type="checkbox" checked={x.include} onChange={(e) => setItem(x.id, "include", e.target.checked)} />
                    </td>
                    <td style={{ padding: "4px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...iconBtn(), fontSize: 11, padding: "1px 3px" }} title="Move up">
                        ▲
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === items.length - 1} style={{ ...iconBtn(), fontSize: 11, padding: "1px 3px" }} title="Move down">
                        ▼
                      </button>
                    </td>
                    <td style={{ padding: "4px 8px" }}>
                      <input value={x.name} onChange={(e) => setItem(x.id, "name", e.target.value)} style={{ ...inSt(), padding: "5px 7px", fontSize: 12.5, fontWeight: 700 }} />
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 11.5, color: T.txtDim, lineHeight: 1.45 }}>{x.scope}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={x.cost}
                        onChange={(e) => setItem(x.id, "cost", num(e.target.value))}
                        style={{ ...inSt(), width: 100, padding: "5px 6px", fontSize: 12, fontFamily: MONO, textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: T.inputBg, borderRadius: 4, padding: "8px 14px", margin: "10px 0" }}>
            <MiniRow label={`${included.length} milestones selected`} value={fmt(sum)} strong color={T.violet} />
            {docTotal > 0 && Math.abs(docTotal - sum) >= 1 && <MiniRow label="Difference from the SOW total" value={(sum - docTotal > 0 ? "+" : "") + fmt(sum - docTotal)} color={T.amber} />}
            <MiniRow label="Current rehab estimate (Underwrite)" value={fmt(ctx.repair || 0)} />
          </div>
          <div style={subHead(T.violet)}>Apply to this deal</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 6px" }}>
            {[
              ["replace", `Replace the ${(ctx.milestones || []).length} current milestones`],
              ["append", "Add to the current milestones"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setOpts((p) => ({ ...p, mode: k }))}
                style={{
                  ...smallBtn(opts.mode === k ? `${T.violet}1c` : T.glass, opts.mode === k ? T.violet : T.txtDim),
                  border: `1px solid ${opts.mode === k ? T.violet : T.border}`,
                  fontWeight: opts.mode === k ? 800 : 600,
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {opts.mode === "replace" && hasProgress && (
            <Note tone={T.amber}>Some current milestones already have progress — replacing removes them and their status.</Note>
          )}
          {repairTarget > 0 && (
            <CheckRow checked={opts.setRepair} onChange={o("setRepair")}>
              Set the rehab estimate to {fmt(repairTarget)} (now {fmt(ctx.repair || 0)}) — the Repair Estimator switches to a single amount
              {ctx.hasBaseline ? "; the original underwriting stays frozen" : ""}
            </CheckRow>
          )}
          {out.contractor && (
            <CheckRow checked={opts.addContact} onChange={o("addContact")}>
              Add {out.contractor} to Contacts as the contractor
            </CheckRow>
          )}
          <SaveDocOption source={source} existing={rec} opts={opts} o={o} connected={ctx.connected} dealDocs={ctx.dealDocs} />
          {stageIdx(ctx.stage) < 2 && <Note>Milestones show up in Flip Management once the deal reaches Rehab.</Note>}
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={onClose} style={bs(T.glass, T.txtDim)}>
              Close
            </button>
            <button onClick={apply} disabled={!included.length} style={{ ...bs(T.violet, "#fff"), border: "none" }}>
              Create {included.length} milestone{included.length === 1 ? "" : "s"}
            </button>
          </div>
        </React.Fragment>
      )}
    </Modal>
  );
}
