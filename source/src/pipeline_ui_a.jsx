// ============================================================================
// v26 — PIPELINE UI (part A): primitives, stage bar, transitions, conflicts
// ============================================================================
const lblSt = () => ({
  display: "block",
  fontSize: 12,
  color: T.txtDim,
  marginBottom: 5,
  letterSpacing: "0",
  fontWeight: 500,
});
const inSt = () => ({
  width: "100%",
  padding: "9px 10px",
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  fontSize: 13.5,
  fontFamily: FONT,
  background: T.inputBg,
  color: T.txt,
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "light",
});
const subHead = (color) => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0",
  color: color || T.tealLt,
  margin: "4px 0 8px",
});
const smallBtn = (bg, color) => ({ ...bs(bg, color), fontSize: 11.5, padding: "6px 11px" });
const iconBtn = (color) => ({
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  color: color || T.txtMute,
  padding: "2px 5px",
  lineHeight: 1,
});

function TextIn({ label, value, onChange, type = "text", placeholder, hint, style, onKeyDown, autoFocus }) {
  return (
    <label style={{ display: "block", marginBottom: 12, ...style }}>
      {label && <span style={lblSt()}>{label}</span>}
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        style={{ ...inSt(), fontFamily: type === "date" ? MONO : FONT, fontSize: type === "date" ? 12.5 : 13.5 }}
      />
      {hint && <span style={{ display: "block", fontSize: 10.5, color: T.txtMute, marginTop: 4, fontFamily: MONO }}>{hint}</span>}
    </label>
  );
}
function SelectIn({ label, value, onChange, options, style, placeholder }) {
  return (
    <label style={{ display: "block", marginBottom: 12, ...style }}>
      {label && <span style={lblSt()}>{label}</span>}
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={{ ...inSt(), cursor: "pointer" }}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const [v, l] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}
function Chip({ color, children, solid, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: solid ? color : `${color}12`,
        color: solid ? "#fff" : color,
        border: "none",
      }}
    >
      {children}
    </span>
  );
}
function Bar({ pct, color, h = 6, marker }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <div style={{ position: "relative", height: h, background: "#EEF0F3", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${p}%`, height: "100%", background: color, transition: "width .3s" }} />
      {marker != null && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.max(0, Math.min(100, marker))}%`, width: 2, background: T.marker }} />}
    </div>
  );
}
function Modal({ kicker, title, children, onClose, width = 480, footer }) {
  return (
    <div
      className="no-print"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,.36)",
        backdropFilter: "blur(2px)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={gp({
          padding: "22px 24px",
          maxWidth: width,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 0 0 1px rgba(17,24,39,.06), 0 24px 60px rgba(17,24,39,.22)",
          borderRadius: 14,
          background: "#fff",
        })}
      >
        {kicker && (
          <div style={{ fontSize: 12.5, color: T.txtDim, fontWeight: 500 }}>{kicker}</div>
        )}
        {title && <h3 style={{ margin: "4px 0 16px", fontSize: 20, fontWeight: 600, color: T.txt }}>{title}</h3>}
        {children}
        {footer && <div style={{ display: "flex", gap: 9, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}
function Note({ children, tone }) {
  const c = tone || T.teal;
  return (
    <div
      style={{
        fontSize: 12,
        lineHeight: 1.55,
        color: T.txtDim,
        background: `${c}0d`,
        border: `1px solid ${c}2b`,
        borderRadius: 8,
        padding: "9px 11px",
        margin: "4px 0 12px",
      }}
    >
      {children}
    </div>
  );
}
function CheckRow({ checked, onChange, children, disabled }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: 12.5,
        color: disabled ? T.txtMute : T.txt,
        margin: "6px 0",
        cursor: disabled ? "default" : "pointer",
        lineHeight: 1.45,
      }}
    >
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span>{children}</span>
    </label>
  );
}
const grid2 = { display: "grid", gap: 12 };

// ---------- Stage bar (deal workspace) ----------
const NEXT_ACTION_LABEL = {
  contract: "Mark under contract",
  rehab: "Mark purchase closed",
  market: "List on market",
  sold: "Mark as sold",
};
// Stage actions live in the project header on every project page: the next stage, plus
// "Move back" and "Mark dead" under More. A dead deal offers "Restore deal".
function StageActions({ stage, mgmt, onAction }) {
  const dead = stage === "dead";
  const curIdx = dead ? Math.max(0, stageIdx((mgmt.dead && mgmt.dead.fromStage) || "analyzing")) : Math.max(0, stageIdx(stage));
  const next = !dead && curIdx < STAGES.length - 1 ? STAGES[curIdx + 1] : null;
  const prev = !dead && curIdx > 0 ? STAGES[curIdx - 1] : null;
  if (dead)
    return (
      <button onClick={() => onAction("restore")} className="band-btn primary">
        Restore deal
      </button>
    );
  return (
    <React.Fragment>
      {next && (
        <button onClick={() => onAction(next.key)} className="band-btn primary">
          {NEXT_ACTION_LABEL[next.key]}
        </button>
      )}
      {(prev || stage !== "sold") && <StageMenu prev={prev} canKill={stage !== "sold"} onAction={onAction} />}
    </React.Fragment>
  );
}
function StageMenu({ prev, canKill, onAction }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} className="band-btn" aria-expanded={open} aria-label="More stage actions">
        More <Icon name="down" size={14} />
      </button>
      {open && (
        <div className="menu" onMouseLeave={() => setOpen(false)}>
          {prev && (
            <button onClick={() => (setOpen(false), onAction("back"))}>
              <Icon name="back" /> Move back to {prev.label.toLowerCase()}
            </button>
          )}
          {canKill && (
            <button onClick={() => (setOpen(false), onAction("dead"))} style={{ color: T.red }}>
              <Icon name="x" /> Mark dead
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Stage transition modal ----------
function TransitionModal({ kind, ctx, onConfirm, onClose }) {
  const { mgmt, purchase, arv, holdMonths, m, actuals, stage, preview, rehabFunding, intRateRehab, intRatePurchase } = ctx;
  const t = todayISO();
  const hasTag = (tag) => (actuals || []).some((a) => a.tag === tag);
  const [f, setF] = useState(() => {
    switch (kind) {
      case "contract":
        return {
          date: t,
          price: purchase || 0,
          expectedClosing: mgmt.contract.expectedClosing || addDaysISO(t, 30),
          inspectionEnd: mgmt.contract.inspectionEnd || addDaysISO(t, 10),
          emd: num(mgmt.contract.emd),
          updatePurchase: true,
        };
      case "rehab": {
        const ec = mgmt.contract.expectedClosing;
        const cd = ec && ec <= t ? ec : t;
        return {
          closingDate: cd,
          price: num(mgmt.contract.price) || purchase || 0,
          started: false,
          startDate: cd,
          targetEnd: addMonthsISO(cd, Math.max(1, (holdMonths || 4) - 2)),
          logPurchase: !hasTag("purchase_price"),
          readStmt: !hasTag("stmt_buy"),
        };
      }
      case "market":
        return { listDate: t, listPrice: num(mgmt.listing.price) || arv || 0, agent: mgmt.listing.agent || "", rehabEnd: mgmt.rehab.endDate || t, rehabStart: mgmt.rehab.startDate || "" };
      case "sold": {
        const be = mgmt.buyer.expectedClosing;
        const saleDate = be && be <= t ? be : t;
        // the investors' return from the deal's financing terms when they were entered, else the plan's
        const realInv = mgmt.financing && Array.isArray(mgmt.financing.investors) ? mgmt.financing.investors : null;
        const invRet = realInv ? finPosition({}, realInv, [], saleDate).inv.filter((x) => !x.paidBack).reduce((s, x) => s + x.ret, 0) : m.investorInterest || 0;
        return {
          saleDate,
          salePrice: num(mgmt.buyer.price) || num(mgmt.listing.price) || arv || 0,
          addInvestor: !hasTag("investor_return") && invRet > 0,
          investorAmt: Math.round(invRet),
          addRehabInt: rehabFunding !== "draws" && !hasTag("rehab_loan_interest") && m.loanAmountRehab > 0,
          rehabIntAmt: null,
          addPurchInt: false,
          purchIntAmt: null,
          readStmt: !hasTag("stmt_sell"),
        };
      }
      case "dead":
        return { reason: DEAD_REASONS[0], note: "" };
      default:
        return {};
    }
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const meta = stageMeta(kind === "back" || kind === "restore" || kind === "dead" ? stage : kind);
  // sold: interest actually accrued from purchase closing to the sale
  const heldFrom = mgmt.closing.date || mgmt.contract.expectedClosing || mgmt.contract.date;
  const heldMonths = kind === "sold" ? monthsBetween(heldFrom, f.saleDate) : null;
  const autoRehabInt = heldMonths != null ? Math.round(((m.loanAmountRehab || 0) * intRateRehab) / 12 * Math.max(0, heldMonths)) : 0;
  const autoPurchInt = heldMonths != null ? Math.round(((m.loanAmountPurchase || 0) * intRatePurchase) / 12 * Math.max(0, heldMonths)) : 0;
  const rehabIntAmt = f.rehabIntAmt == null ? autoRehabInt : f.rehabIntAmt;
  const purchIntAmt = f.purchIntAmt == null ? autoPurchInt : f.purchIntAmt;
  let valid = true,
    title = "",
    body = null,
    cta = "Confirm";
  if (kind === "contract") {
    valid = !!f.date && f.price > 0 && !!f.expectedClosing;
    const pv = preview(f.updatePurchase ? f.price : purchase);
    title = "Move to under contract";
    cta = "Move to under contract";
    body = (
      <React.Fragment>
        <div className="field-grid-2" style={grid2}>
          <TextIn label="Contract date" type="date" value={f.date} onChange={set("date")} />
          <Field label="Contract price" value={f.price} onChange={set("price")} prefix="$" step={1000} accent={meta.color} />
          <TextIn label="Inspection period ends" type="date" value={f.inspectionEnd} onChange={set("inspectionEnd")} />
          <TextIn label="Expected closing" type="date" value={f.expectedClosing} onChange={set("expectedClosing")} />
          <Field label="Earnest money (EMD)" value={f.emd} onChange={set("emd")} prefix="$" step={500} />
        </div>
        {f.price !== purchase && (
          <CheckRow checked={f.updatePurchase} onChange={set("updatePurchase")}>
            Update the underwriting purchase price from {fmt(purchase)} to {fmt(f.price)}
          </CheckRow>
        )}
        <Note>
          The underwriting will be saved as the <b>original underwriting</b> ({pv.grade}, {fmt(pv.netProfit)} projected profit). Later edits
          update the current forecast only; the final results always compare against this snapshot.
        </Note>
      </React.Fragment>
    );
  } else if (kind === "rehab") {
    valid = !!f.closingDate && f.price > 0;
    title = "Closed on the purchase";
    cta = "Move to rehab";
    body = (
      <React.Fragment>
        <div className="field-grid-2" style={grid2}>
          <TextIn label="Actual closing date" type="date" value={f.closingDate} onChange={set("closingDate")} />
          <Field label="Final purchase price" value={f.price} onChange={set("price")} prefix="$" step={1000} accent={meta.color} />
          <TextIn label="Target completion" type="date" value={f.targetEnd} onChange={set("targetEnd")} />
          {f.started && <TextIn label="Rehab started on" type="date" value={f.startDate} onChange={set("startDate")} />}
        </div>
        <CheckRow checked={f.started} onChange={set("started")}>
          Work has already started
        </CheckRow>
        {!f.started && (
          <Note>
            The rehab clock starts when work does. Until then the deal shows the days since closing as waiting time; mark the start in the Rehab
            section when the crew begins.
          </Note>
        )}
        <CheckRow checked={f.logPurchase} onChange={set("logPurchase")} disabled={hasTag("purchase_price")}>
          Log the purchase price ({fmt(f.price)}) in the Actuals Ledger as Acquisition
          {ledgerEmd(actuals) > 0 && !hasTag("purchase_price") ? `: ${fmt(f.price - ledgerEmd(actuals))} at closing, since the ${fmt(ledgerEmd(actuals))} EMD is already logged` : ""}
          {hasTag("purchase_price") ? " — already logged" : ""}
        </CheckRow>
        <CheckRow checked={f.readStmt} onChange={set("readStmt")}>
          Next, read the purchase closing statement (HUD-1 / settlement statement) with AI and add its lines to the Actuals Ledger
          {hasTag("stmt_buy") ? " — one was already imported" : ""}
        </CheckRow>
        <Note>Buying costs in Flip analysis stay as your estimate; the actual closing costs go to the ledger.</Note>
      </React.Fragment>
    );
  } else if (kind === "market") {
    valid = !!f.listDate && f.listPrice > 0;
    title = "List the property";
    cta = "Move to on market";
    body = (
      <div className="field-grid-2" style={grid2}>
        <TextIn label="List date" type="date" value={f.listDate} onChange={set("listDate")} />
        <Field label="List price" value={f.listPrice} onChange={set("listPrice")} prefix="$" step={1000} accent={meta.color} />
        {!mgmt.rehab.startDate && (
          <TextIn label="Rehab started on" type="date" value={f.rehabStart} onChange={set("rehabStart")} hint="not marked yet: needed to measure the rehab time" />
        )}
        <TextIn label="Rehab completed on" type="date" value={f.rehabEnd} onChange={set("rehabEnd")} />
        <TextIn label="Listing agent" value={f.agent} onChange={set("agent")} placeholder="Name / brokerage" />
      </div>
    );
  } else if (kind === "sold") {
    valid = !!f.saleDate && f.salePrice > 0;
    title = "Record the final sale";
    cta = "Mark as sold";
    body = (
      <React.Fragment>
        <div className="field-grid-2" style={grid2}>
          <TextIn label="Sale closing date" type="date" value={f.saleDate} onChange={set("saleDate")} />
          <Field label="Final sale price (gross)" value={f.salePrice} onChange={set("salePrice")} prefix="$" step={1000} accent={meta.color} />
        </div>
        <div style={subHead(T.violet)}>Financing costs not on the closing statement</div>
        {m.investorInterest > 0 && (
          <CheckRow checked={f.addInvestor} onChange={set("addInvestor")} disabled={hasTag("investor_return")}>
            Log investor return {fmt(f.investorAmt)} (Financing){hasTag("investor_return") ? " — already logged" : ""}
          </CheckRow>
        )}
        {rehabFunding !== "draws" && m.loanAmountRehab > 0 && (
          <CheckRow checked={f.addRehabInt} onChange={set("addRehabInt")} disabled={hasTag("rehab_loan_interest")}>
            Log internal rehab-loan interest {fmt(rehabIntAmt)} — {fmt(m.loanAmountRehab)} at {(intRateRehab * 100).toFixed(2).replace(/\.?0+$/, "")}% for{" "}
            {heldMonths != null ? heldMonths.toFixed(1) : "?"} months{hasTag("rehab_loan_interest") ? " — already logged" : ""}
          </CheckRow>
        )}
        {m.loanAmountPurchase > 0 && (
          <CheckRow checked={f.addPurchInt} onChange={set("addPurchInt")} disabled={hasTag("purchase_loan_interest")}>
            Log lender interest {fmt(purchIntAmt)} for {heldMonths != null ? heldMonths.toFixed(1) : "?"} months — only if it isn't on the sale
            closing statement or already logged monthly
          </CheckRow>
        )}
        {(f.addRehabInt || f.addPurchInt) && (
          <div className="field-grid-2" style={grid2}>
            {f.addRehabInt && <Field label="Rehab-loan interest" value={rehabIntAmt} onChange={set("rehabIntAmt")} prefix="$" />}
            {f.addPurchInt && <Field label="Lender interest" value={purchIntAmt} onChange={set("purchIntAmt")} prefix="$" />}
          </div>
        )}
        <CheckRow checked={f.readStmt} onChange={set("readStmt")}>
          Next, read the sale closing statement with AI so commissions, title and transfer fees go to the Actuals Ledger
          {hasTag("stmt_sell") ? " — one was already imported" : ""}
        </CheckRow>
      </React.Fragment>
    );
  } else if (kind === "dead") {
    title = "Mark this deal as dead";
    cta = "Mark as dead";
    valid = !!f.reason;
    body = (
      <React.Fragment>
        <SelectIn label="Reason" value={f.reason} onChange={set("reason")} options={DEAD_REASONS} />
        <TextIn label="Note (optional)" value={f.note} onChange={set("note")} placeholder="What happened?" />
        <Note>Nothing is deleted. The deal moves to the Dead archive and can be restored at any time.</Note>
      </React.Fragment>
    );
  } else if (kind === "back") {
    const prev = STAGES[stageIdx(stage) - 1];
    title = `Move back to ${prev ? prev.label.toLowerCase() : ""}?`;
    cta = "Move back";
    body = (
      <Note tone={T.amber}>
        Dates and details you've recorded stay as they are.
        {prev && prev.key === "analyzing"
          ? " The Original Underwriting snapshot will be cleared and re-taken the next time the deal goes under contract."
          : ""}
      </Note>
    );
  } else if (kind === "restore") {
    const to = stageMeta((mgmt.dead && mgmt.dead.fromStage) || "analyzing");
    title = `Restore this deal to ${to.label.toLowerCase()}?`;
    cta = "Restore";
    body = <Note>The deal returns to {to.label} with everything it had before.</Note>;
  }
  return (
    <Modal
      kicker={kind === "dead" || kind === "back" || kind === "restore" ? "Deal stage" : `Stage ${stageIdx(kind) + 1} of 5`}
      title={title}
      onClose={onClose}
      width={kind === "sold" ? 560 : 500}
      footer={
        <React.Fragment>
          <button onClick={onClose} style={bs(T.glass, T.txtDim)}>
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => onConfirm({ ...f, rehabIntAmt, purchIntAmt })}
            style={{
              ...bs(valid ? (kind === "dead" ? T.red : meta.color) : T.glass, valid ? "#fff" : T.txtMute),
              border: "none",
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            {cta}
          </button>
        </React.Fragment>
      }
    >
      {body}
    </Modal>
  );
}

// ---------- Save conflict modal ----------
function ConflictModal({ conflict, onOverwrite, onOpenTheirs, onClose }) {
  const who = (conflict.meta && conflict.meta.lastModifyingUser && (conflict.meta.lastModifyingUser.displayName || conflict.meta.lastModifyingUser.emailAddress)) || "someone";
  const when = conflict.meta && conflict.meta.modifiedTime ? fmtTs(conflict.meta.modifiedTime) : "";
  const exists = conflict.type === "exists";
  return (
    <Modal
      kicker="Save to Drive"
      title={exists ? "A deal with this address already exists" : "This deal changed since you opened it"}
      onClose={onClose}
      footer={
        <React.Fragment>
          <button onClick={onClose} style={bs(T.glass, T.txtDim)}>
            Cancel
          </button>
          <button onClick={onOpenTheirs} style={bs(T.glass, T.teal)}>
            {exists ? "Open the existing deal" : "Open their version"}
          </button>
          <button onClick={onOverwrite} style={{ ...bs(T.red, "#fff"), border: "none" }}>
            Overwrite with mine
          </button>
        </React.Fragment>
      }
    >
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.txtDim, margin: 0 }}>
        {exists ? (
          <React.Fragment>
            “{conflict.name.replace(/\.json$/, "")}” is already in Drive — last saved by <b>{who}</b> {when ? `on ${when}` : ""}. Saving now would replace
            it with this analysis.
          </React.Fragment>
        ) : (
          <React.Fragment>
            <b>{who}</b> saved this deal {when ? `on ${when}` : ""} after you opened it. Saving now would overwrite their changes. Opening their version
            discards your unsaved edits.
          </React.Fragment>
        )}
      </p>
    </Modal>
  );
}

// ---------- Original-underwriting banner (Underwrite tab) ----------
function BaselineBanner({ uwBaseline, current, grade, stage, onRefreeze, onFreeze }) {
  // a deal past analysis that never froze a plan (it skipped "under contract", or predates v40)
  if (!uwBaseline)
    return stage && stage !== "analyzing" && stage !== "dead" && onFreeze ? (
      <div className="no-print baseline">
        <div style={{ flex: "1 1 300px", fontSize: 13.5, color: T.txtDim, lineHeight: 1.5 }}>
          <b style={{ color: T.txt, fontWeight: 600 }}>No original plan is saved for this deal.</b> Save the current numbers ({fmt(current)}, {grade}) as the plan first, then update the forecast; the overview and dashboards will show the change against it.
        </div>
        <button onClick={onFreeze} title="Freeze the current underwriting as this deal's original plan" style={btnGhost()}>
          <Icon name="save" size={14} /> Save as original plan
        </button>
      </div>
    ) : null;
  const diff = current - uwBaseline.m.netProfit;
  const changed = Math.abs(diff) >= 1;
  return (
    <div className="no-print baseline">
      <div style={{ flex: "1 1 300px", fontSize: 13.5, color: T.txtDim, lineHeight: 1.5 }}>
        <b style={{ color: T.txt, fontWeight: 600 }}>Original underwriting</b>, frozen {fmtDate(uwBaseline.date)}
        {uwBaseline.by ? ` by ${nameOnly(uwBaseline.by)}` : ""}: <b style={{ color: T.txt, fontWeight: 600 }}>{fmt(uwBaseline.m.netProfit)}</b> ({uwBaseline.grade}).
        {changed ? (
          <React.Fragment>
            {" "}
            The current forecast is <b style={{ color: T.txt, fontWeight: 600 }}>{fmt(current)}</b> ({grade}),{" "}
            <b style={{ color: diff >= 0 ? T.green : T.red, fontWeight: 600 }}>
              {fmt(Math.abs(diff))} {diff >= 0 ? "better" : "worse"}
            </b>
            .
          </React.Fragment>
        ) : (
          " The current forecast matches it."
        )}
      </div>
      {stage === "contract" && (
        <button onClick={onRefreeze} title="Renegotiated during the contract period? Replace the original underwriting with the current numbers." style={btnGhost()}>
          <Icon name="refresh" size={14} /> Re-freeze with current numbers
        </button>
      )}
    </div>
  );
}
