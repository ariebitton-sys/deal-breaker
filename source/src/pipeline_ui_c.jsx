// ============================================================================
// v26 — PIPELINE UI (part C): Flip Management tab
// ============================================================================
function solveArvForProfit(inputs, goal) {
  let lo = 0,
    hi = Math.max(inputs.arv || 0, inputs.purchase || 0, 1) * 3;
  if (calcDeal({ ...inputs, arv: hi }).netProfit < goal) return null;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (calcDeal({ ...inputs, arv: mid }).netProfit >= goal) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}
// While on the market, carrying costs run on the REAL hold (purchase closing → expected sale
// closing; 30 days from today if there's no buyer yet), not the planned one.
function marketProjection(mgmt, dealInputs) {
  const closeBy = mgmt.buyer.expectedClosing || addDaysISO(todayISO(), 30);
  const held = monthsBetween(mgmt.closing.date, closeBy);
  const projHold = held != null ? Math.max(dealInputs.holdMonths || 0, Math.round(held * 10) / 10) : dealInputs.holdMonths || 0;
  return { projHold, inputs: { ...dealInputs, holdMonths: projHold }, assumed: !mgmt.buyer.expectedClosing };
}
function StageSection({ st, open, onToggle, summary, current, children }) {
  const meta = stageMeta(st);
  return (
    <section className={"stg" + (current ? " cur" : "") + (open ? " open" : "")} style={stageVars(st)}>
      <button className="stg-head" onClick={onToggle} aria-expanded={open}>
        <span className="stg-ico">
          <Icon name={meta.icon || "scan"} size={18} stroke={2} />
        </span>
        <span className="stg-title">{meta.label}</span>
        {current && <span className="stg-cur">Current stage</span>}
        <span className="stg-sum">{!open ? summary : ""}</span>
        <span className="stg-chev">
          <Icon name="chevron" size={18} />
        </span>
      </button>
      {open && <div className="stg-body">{children}</div>}
    </section>
  );
}
function Checklist({ items, onChange, by, gate }) {
  const [draft, setDraft] = useState("");
  const done = items.filter((i) => i.done).length;
  const toggle = (id) =>
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done, doneAt: !i.done ? new Date().toISOString() : "", by: !i.done ? by : "" } : i)));
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, { id: uid(), label: draft.trim(), done: false, custom: true, addedAt: new Date().toISOString() }]);
    setDraft("");
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, ...subHead() }}>
        <span>Checklist</span>
        <span style={{ fontFamily: MONO, color: T.txtMute, letterSpacing: 0 }}>
          {done}/{items.length}
        </span>
        <div style={{ flex: 1 }}>
          <Bar pct={items.length ? (done / items.length) * 100 : 0} color={T.green} h={5} />
        </div>
      </div>
      {items.map((i) => (
        <div key={i.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
          <input type="checkbox" checked={!!i.done} onChange={() => toggle(i.id)} style={{ cursor: "pointer" }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: i.done ? T.txtMute : T.txt, textDecoration: i.done ? "line-through" : "none" }}>{i.label}</span>
            {i.note && !i.done && <span style={{ display: "block", fontSize: 12, color: T.txtMute, marginTop: 1 }}>{i.note}</span>}
            {i.due && !i.done && <span style={{ display: "block", fontSize: 12, color: i.due < todayISO() ? T.red : T.txtMute, marginTop: 1 }}>Due {fmtDate(i.due)}</span>}
            {gate && !i.done && (() => {
              const g = gate(i);
              return g && !g.ok ? <span className="ck-later">On the task board {g.why}</span> : null;
            })()}
          </span>
          {i.url && (
            <a href={i.url} target="_blank" rel="noopener noreferrer" className="ck-link" title="Open the provider's page">
              Open <Icon name="link" size={12} />
            </a>
          )}
          {i.done && i.doneAt && (
            <span style={{ fontSize: 10, color: T.txtMute, fontFamily: MONO }}>
              {fmtDateShort(isoOf(new Date(i.doneAt)))}
              {i.by ? `, ${nameOnly(i.by)}` : ""}
            </span>
          )}
          <button onClick={() => onChange(items.filter((x) => x.id !== i.id))} title="Remove" aria-label="Remove item" style={iconBtn()}>
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a checklist item…"
          style={{ ...inSt(), fontSize: 12.5, padding: "7px 9px" }}
        />
        <button onClick={add} style={smallBtn(T.teal, "#fff")}>
          +
        </button>
      </div>
    </div>
  );
}
function MiniRow({ label, value, color, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: `1px solid ${T.border}`, gap: 10 }}>
      <span style={{ fontSize: 12.5, color: strong ? T.txt : T.txtDim, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: strong ? 14 : 13, fontFamily: MONO, fontWeight: strong ? 800 : 600, color: color || T.txt, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ----- Analyzing: source & offers we sent -----
// `past`: the deal has moved beyond analyzing, so the offers are history and the form stays folded.
function OffersMade({ mgmt, upd, addLog, past }) {
  const [d, setD] = useState({ date: todayISO(), amount: 0, status: "Sent", note: "" });
  const [adding, setAdding] = useState(!past);
  const add = () => {
    if (!(d.amount > 0)) return;
    upd("offers", [...mgmt.offers, { ...d, id: uid() }]);
    addLog(`Offer ${d.status.toLowerCase()}: ${fmt(d.amount)}${d.note ? ` — ${d.note}` : ""}`);
    setD({ date: todayISO(), amount: 0, status: "Sent", note: "" });
  };
  const setRow = (id, k, v) => upd("offers", mgmt.offers.map((o) => (o.id === id ? { ...o, [k]: v } : o)));
  return (
    <div>
      <SelectIn label="Deal source" value={mgmt.source} onChange={(v) => upd("source", v)} options={DEAL_SOURCES} placeholder="— select —" style={{ maxWidth: 280 }} />
      <div style={subHead()}>Offers we made</div>
      {mgmt.offers.length === 0 && <div style={{ fontSize: 12, color: T.txtMute, marginBottom: 8 }}>{past ? "No offers were logged for this deal." : "No offers logged yet."}</div>}
      {mgmt.offers.map((o) => (
        <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.txtMute, width: 74 }}>{fmtDateShort(o.date)}</span>
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, width: 96 }}>{fmt(num(o.amount))}</span>
          <select value={o.status} onChange={(e) => setRow(o.id, "status", e.target.value)} style={{ ...inSt(), width: 120, padding: "4px 6px", fontSize: 12 }}>
            {OFFER_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span style={{ flex: 1, fontSize: 12, color: T.txtDim, minWidth: 80 }}>{o.note}</span>
          <button onClick={() => upd("offers", mgmt.offers.filter((x) => x.id !== o.id))} style={iconBtn()}>
            ×
          </button>
        </div>
      ))}
      {!adding ? (
        <button className="link-btn" onClick={() => setAdding(true)} style={{ marginTop: 8, fontSize: 12.5 }}>
          Log an offer
        </button>
      ) : (
      <div className="offer-add" style={{ display: "grid", gap: 8, gridTemplateColumns: "130px 120px 120px 1fr auto", marginTop: 10, alignItems: "end" }}>
        <TextIn type="date" value={d.date} onChange={(v) => setD({ ...d, date: v })} style={{ marginBottom: 0 }} />
        <Field label="" value={d.amount} onChange={(v) => setD({ ...d, amount: v })} prefix="$" step={1000} />
        <SelectIn value={d.status} onChange={(v) => setD({ ...d, status: v })} options={OFFER_STATUSES} style={{ marginBottom: 12 }} />
        <TextIn value={d.note} onChange={(v) => setD({ ...d, note: v })} placeholder="Note (terms, agent…)" onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} style={{ ...smallBtn(T.teal, "#fff"), marginBottom: 12, height: 38 }}>
          + Offer
        </button>
      </div>
      )}
    </div>
  );
}

// ----- Rehab: draws tracker (only when funding = lender draws) -----
function DrawsPanel({ draws, upd, m, drawFee, addLog }) {
  const [d, setD] = useState({ requested: todayISO(), amount: Math.round(m.drawAmount || 0), fee: drawFee || 0 });
  const loan = m.loanAmountRehab || 0;
  const received = draws.filter((x) => x.received).reduce((s, x) => s + num(x.amount), 0);
  const pending = draws.filter((x) => !x.received).reduce((s, x) => s + num(x.amount), 0);
  const fees = draws.reduce((s, x) => s + num(x.fee), 0);
  const add = () => {
    if (!(d.amount > 0)) return;
    upd("draws", [...draws, { id: uid(), requested: d.requested, amount: d.amount, fee: d.fee, received: "" }]);
    addLog(`Draw #${draws.length + 1} requested: ${fmt(d.amount)}`);
  };
  const setRow = (id, k, v) => upd("draws", draws.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  return (
    <div style={{ marginTop: 14 }}>
      <div style={subHead(T.violet)}>Lender draws</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.txtDim, marginBottom: 4 }}>
        <span>
          Received <b style={{ fontFamily: MONO, color: T.txt }}>{fmt(received)}</b> of {fmt(loan)} rehab loan
          {pending > 0 && (
            <React.Fragment>
              {" "}
              , pending <b style={{ fontFamily: MONO, color: T.txt }}>{fmt(pending)}</b>
            </React.Fragment>
          )}
        </span>
        <span style={{ fontFamily: MONO }}>fees {fmt(fees)}</span>
      </div>
      <Bar pct={loan > 0 ? (received / loan) * 100 : 0} color={T.violet} marker={loan > 0 ? ((received + pending) / loan) * 100 : null} />
      <div style={{ marginTop: 8 }}>
        {draws.map((x, i) => (
          <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 12, width: 24, color: T.violet }}>#{i + 1}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.txtMute, width: 64 }}>{fmtDateShort(x.requested)}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, width: 90 }}>{fmt(num(x.amount))}</span>
            <span style={{ fontSize: 11, color: T.txtMute }}>received</span>
            <input
              type="date"
              value={x.received || ""}
              onChange={(e) => {
                setRow(x.id, "received", e.target.value);
                if (e.target.value && !x.received) addLog(`Draw #${i + 1} received: ${fmt(num(x.amount))}`);
              }}
              style={{ ...inSt(), width: 140, padding: "4px 6px", fontSize: 11.5, fontFamily: MONO }}
            />
            {num(x.fee) > 0 && <span style={{ fontSize: 11, color: T.txtMute, fontFamily: MONO }}>fee {fmt(num(x.fee))}</span>}
            <span style={{ flex: 1 }} />
            <Chip color={x.received ? T.green : T.txtMute}>{x.received ? "Received" : "Pending"}</Chip>
            <button onClick={() => upd("draws", draws.filter((y) => y.id !== x.id))} style={iconBtn()}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="draw-add" style={{ display: "grid", gap: 8, gridTemplateColumns: "130px 1fr 1fr auto", marginTop: 10, alignItems: "end" }}>
        <TextIn label="Requested" type="date" value={d.requested} onChange={(v) => setD({ ...d, requested: v })} style={{ marginBottom: 12 }} />
        <Field label="Amount" value={d.amount} onChange={(v) => setD({ ...d, amount: v })} prefix="$" step={500} accent={T.violet} />
        <Field label="Draw fee" value={d.fee} onChange={(v) => setD({ ...d, fee: v })} prefix="$" step={25} />
        <button onClick={add} style={{ ...smallBtn(T.violet, "#fff"), marginBottom: 12, height: 38 }}>
          + Draw
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: T.txtMute }}>Log the draw fees in the Actuals Ledger (Financing) when they're charged.</div>
    </div>
  );
}

// ----- Project manager payments (Expenses page) -----
// The fee comes from Flip analysis; it's paid in installments tied to steps of the flip. Paying one
// logs it in the ledger under Services.
function PmPayments({ mgmt, upd, actuals, pushActuals, fee, feeNote, addLog, onEditFee }) {
  const today = todayISO();
  const plan = pmPlan(mgmt, actuals, fee, today);
  const list = (mgmt.pm && mgmt.pm.installments) || [];
  const [pay, setPay] = useState(null); // { id, date, amount }
  const setPm = (patch) => upd("pm", { ...(mgmt.pm || {}), ...patch });
  const setList = (next) => setPm({ installments: next });
  const edit = (id, patch) => setList(list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const n = list.length;
  const ms = (mgmt.rehab.milestones || []).filter((x) => x.label);
  const summary = () => list.map((x) => `${+(parseFloat(x.pct) || 0).toFixed(2)}% ${pmWhenLabel(x.when, mgmt, x).toLowerCase()}`).join(", ");
  const agree = () => {
    setPm({ terms: "agreed", agreedAt: today });
    addLog(`Project manager payment terms agreed (${fmt(fee)}): ${summary()}`);
  };
  const reopen = () => {
    setPm({ terms: "open" });
    addLog("Project manager payment terms reopened: nothing is due until they are agreed again");
  };
  const doPay = (r) => {
    const amt = Math.round((parseFloat(pay.amount) || 0) * 100) / 100;
    if (!(amt > 0)) return;
    pushActuals([
      {
        cat: "Services",
        label: `Project manager: installment ${r.i + 1} of ${n} (${pmWhenLabel(r.inst.when, mgmt, r.inst).toLowerCase()})`,
        amount: amt,
        date: pay.date || today,
        tag: "pm_fee",
        pmInst: r.inst.id,
      },
    ]);
    // paying means the terms were agreed
    if (!plan.agreed) setPm({ terms: "agreed", agreedAt: today });
    addLog(`Project manager paid ${fmt(amt)}: installment ${r.i + 1} of ${n}`);
    setPay(null);
  };
  const stTxt = (r) =>
    r.status === "paid"
      ? `Paid ${fmtDateShort(r.paid.date)}`
      : r.status === "due"
        ? `Due since ${fmtDateShort(r.due)}`
        : r.status === "draft"
          ? "Draft"
          : r.due
            ? `Due ${fmtDateShort(r.due)}`
            : "Not due yet";
  return (
    <section className="pm-pay" id="pm-payments">
      <div className="pm-pay-head">
        <span className="dp-ico t-violet">
          <Icon name="users" size={18} stroke={2} />
        </span>
        <div className="pm-pay-t">
          <h3>Project manager payments</h3>
          <p>
            Fee {fmt(fee)} ({feeNote}), paid out of pocket.{" "}
            <button className="pm-link" onClick={onEditFee}>
              Change the fee
            </button>
          </p>
        </div>
        <div className="pm-pay-sum">
          <b>{fmt(plan.paidTotal)}</b>
          <span>paid of {fmt(fee)}</span>
        </div>
      </div>
      {plan.agreed ? (
        <div className="pm-terms ok">
          <span>
            <Icon name="check" size={14} /> Terms agreed{mgmt.pm && mgmt.pm.agreedAt ? ` ${fmtDate(mgmt.pm.agreedAt)}` : ""}. Each payment comes up on the task board when it falls due.
          </span>
          <button className="pm-link" onClick={reopen}>
            Edit terms
          </button>
        </div>
      ) : (
        <div className="pm-terms open">
          <div className="pm-terms-t">
            <b>Payment terms not agreed yet.</b> Nothing is due and no reminders go out until you confirm them. Pick a schedule or set the installments below, then confirm.
          </div>
          <div className="pm-terms-a">
            {PM_PRESETS(mgmt).map(([k, l, mk]) => (
              <button key={k} className="pm-preset" onClick={() => setList(mk())}>
                {l}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button onClick={agree} style={smallBtn(T.blue, "#fff")} disabled={!list.length || Math.abs(plan.pctTotal - 100) > 0.01} title={Math.abs(plan.pctTotal - 100) > 0.01 ? "The installments must add up to 100%" : "Confirm these payment terms"}>
              Terms agreed
            </button>
          </div>
        </div>
      )}
      <div className="pm-inst-list">
        {plan.rows.map((r) => (
          <div key={r.inst.id} className={"pm-inst is-" + r.status}>
            <span className="pm-inst-n">{r.i + 1}</span>
            <span className="pm-inst-when">
              <select
                value={r.inst.when}
                onChange={(e) => edit(r.inst.id, { when: e.target.value, ...(e.target.value === "date" && !r.inst.on ? { on: today } : {}) })}
                aria-label={`Installment ${r.i + 1}: when it's due`}
                disabled={!!r.paid}
              >
                {PM_WHEN.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
                <option value="date">On a date</option>
                {ms.length > 0 && (
                  <optgroup label="When a rehab milestone is done">
                    {ms.map((x) => (
                      <option key={x.id} value={"ms:" + x.id}>
                        {x.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {r.inst.when === "date" && !r.paid && <input type="date" value={r.inst.on || ""} onChange={(e) => edit(r.inst.id, { on: e.target.value })} aria-label={`Installment ${r.i + 1}: date`} />}
            </span>
            <label className="pm-inst-pct">
              <input
                type="number"
                min="0"
                max="100"
                value={r.inst.pct}
                onChange={(e) => edit(r.inst.id, { pct: e.target.value === "" ? "" : Math.max(0, parseFloat(e.target.value) || 0) })}
                aria-label={`Installment ${r.i + 1}: share of the fee`}
                disabled={!!r.paid}
              />
              %
            </label>
            <span className="pm-inst-amt">{fmt(r.paid ? parseFloat(r.paid.amount) || 0 : r.amount)}</span>
            <span className="pm-inst-st">{stTxt(r)}</span>
            {r.paid ? (
              <span className="pm-inst-act" />
            ) : pay && pay.id === r.inst.id ? (
              <span className="pm-inst-act pm-pay-form">
                <input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} aria-label="Payment date" />
                <input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} aria-label="Amount paid" />
                <button onClick={() => doPay(r)} style={smallBtn(T.green, "#fff")}>
                  Log
                </button>
                <button onClick={() => setPay(null)} style={smallBtn(T.glass, T.txtDim)}>
                  Cancel
                </button>
              </span>
            ) : (
              <span className="pm-inst-act">
                <button onClick={() => setPay({ id: r.inst.id, date: today, amount: r.amount })} style={smallBtn(r.status === "due" ? T.green : T.glass, r.status === "due" ? "#fff" : T.txtDim)}>
                  Log payment
                </button>
                <button className="pm-x" onClick={() => setList(list.filter((x) => x.id !== r.inst.id))} title="Remove installment" aria-label={`Remove installment ${r.i + 1}`}>
                  ×
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="pm-pay-foot">
        <button onClick={() => setList([...list, { id: uid(), when: "sold", pct: Math.max(0, 100 - plan.pctTotal) }])} style={smallBtn(T.glass, T.blue)}>
          + Add installment
        </button>
        {Math.abs(plan.pctTotal - 100) > 0.01 && <span className="pm-warn">Installments add up to {+plan.pctTotal.toFixed(2)}% of the fee, not 100%.</span>}
      </div>
    </section>
  );
}

// ----- Rehab section -----
function RehabSection({ mgmt, upd, m, uwBaseline, actuals, rehabFunding, drawFee, addLog, by, onImportSow, onSchedule }) {
  const today = todayISO();
  const r = mgmt.rehab;
  const budget = uwBaseline ? uwBaseline.m.repair : m.repair;
  const spent = sumActuals(actuals, "Rehab / Construction");
  const spentPct = budget > 0 ? (spent / budget) * 100 : null;
  const mp = milestonePct(r.milestones);
  const msBudget = r.milestones.reduce((t, x) => t + (num(x.budget) || 0), 0);
  const rc = rehabClock(mgmt, today);
  const plan = rc.plan;
  const elapsed = rc.day;
  const [ms, setMs] = useState("");
  const [startOn, setStartOn] = useState(today);
  const cycle = (id) =>
    upd(
      "rehab.milestones",
      r.milestones.map((x) => {
        if (x.id !== id) return x;
        const next = x.status === "todo" ? "doing" : x.status === "doing" ? "done" : "todo";
        if (next === "done") addLog(`Milestone done: ${x.label}`);
        return { ...x, status: next, doneAt: next === "done" ? new Date().toISOString() : "", by: next === "done" ? by : "" };
      }),
    );
  const STATUS = {
    todo: ["To do", T.txtMute],
    doing: ["In progress", T.txt],
    done: ["Done", T.green],
  };
  return (
    <div>
      <div className="field-grid-2" style={grid2}>
        <TextIn label="Purchase closed on" type="date" value={mgmt.closing.date} onChange={(v) => upd("closing.date", v)} />
        <Field label="Final purchase price" value={num(mgmt.closing.price)} onChange={(v) => upd("closing.price", v)} prefix="$" step={1000} />
        <TextIn label="Rehab start" type="date" value={r.startDate} onChange={(v) => upd("rehab.startDate", v)} />
        <TextIn label="Target completion" type="date" value={r.targetEnd} onChange={(v) => upd("rehab.targetEnd", v)} />
        <TextIn label="Actual completion" type="date" value={r.endDate} onChange={(v) => upd("rehab.endDate", v)} hint={r.endDate ? "" : "set when work is done"} />
      </div>
      {rc.waiting ? (
        <div className="rehab-wait">
          <div>
            <b>The rehab hasn't started.</b>{" "}
            {rc.gap != null ? `${rc.gap} day${rc.gap === 1 ? "" : "s"} since closing. ` : ""}
            These days are measured on their own: they count as hold time, not rehab time.
          </div>
          <span className="rehab-wait-act">
            <input type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} aria-label="Rehab start date" />
            <button
              onClick={() => {
                const d = startOn || today;
                const g = mgmt.closing.date ? Math.max(0, daysBetween(mgmt.closing.date, d)) : null;
                upd("rehab.startDate", d);
                addLog(`Rehab started on ${fmtDate(d)}${g != null ? `, ${g} day${g === 1 ? "" : "s"} after closing` : ""}`);
              }}
              style={smallBtn("#d97706", "#fff")}
            >
              Mark rehab started
            </button>
          </span>
        </div>
      ) : (
        rc.gap != null && (
          <div className="rehab-gap">
            Started {rc.gap} day{rc.gap === 1 ? "" : "s"} after closing{rc.day != null ? `; ${rc.day} day${rc.day === 1 ? "" : "s"} of rehab${r.endDate ? "" : " so far"}` : ""}.
          </div>
        )
      )}
      <div className="field-grid-2" style={{ ...grid2, marginTop: 4, marginBottom: 6 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.txtDim, marginBottom: 4 }}>
            <span>Schedule</span>
            <span style={{ fontFamily: MONO, color: plan != null && elapsed > plan ? T.red : T.txt }}>
              {elapsed != null ? `day ${Math.max(0, elapsed)}` : "not started"}
              {plan != null ? ` of ${plan}` : ""}
            </span>
          </div>
          <Bar pct={plan > 0 ? (elapsed / plan) * 100 : 0} color={plan != null && elapsed > plan ? T.red : T.txt} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.txtDim, marginBottom: 4 }}>
            <span>Budget {uwBaseline ? "(original)" : ""}</span>
            <span style={{ fontFamily: MONO, color: spentPct > 110 ? T.red : spentPct > 100 ? T.amber : T.txt }}>
              {fmt(spent)} / {fmt(budget)}
            </span>
          </div>
          <Bar pct={spentPct} color={spentPct > 110 ? "#DC2626" : spentPct > 100 ? "#F59E0B" : T.txt} marker={mp} />
          <div style={{ fontSize: 10.5, color: T.txtMute, marginTop: 3 }}>
            {fmt(budget - spent)} {budget - spent >= 0 ? "remaining" : "over"}, bar = spent, line = work done ({mp != null ? mp : 0}%)
          </div>
        </div>
      </div>
      <div style={{ ...subHead(), display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>Milestones</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {msBudget > 0 && (
            <span style={{ fontFamily: MONO, color: T.txtDim, letterSpacing: 0, textTransform: "none" }} title="Sum of milestone budgets (from the SOW)">
              SOW budget {fmt(msBudget)}
            </span>
          )}
          <span style={{ fontFamily: MONO, color: T.txtMute, letterSpacing: 0 }} title={milestonesWeighted(r.milestones) ? "Weighted by milestone budget" : "Each milestone counts the same"}>
            {mp != null ? mp : 0}% complete{milestonesWeighted(r.milestones) ? " (by $)" : ""}
          </span>
          {onSchedule && (
            <button onClick={onSchedule} style={{ ...smallBtn(T.glass, T.txt), textTransform: "none", letterSpacing: 0 }} title="Durations, dependencies and dates on a Gantt chart">
              Schedule
            </button>
          )}
          {onImportSow && (
            <button onClick={onImportSow} style={{ ...smallBtn(T.glass, T.violet), textTransform: "none", letterSpacing: 0 }}>
              Read SOW
            </button>
          )}
        </span>
      </div>
      <div className="milestones" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 6 }}>
        {r.milestones.map((x) => {
          const [lbl, c] = STATUS[x.status] || STATUS.todo;
          return (
            <div
              key={x.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 4,
                border: `1px solid ${x.status === "done" ? T.green + "55" : T.border}`,
                background: x.status === "done" ? `${T.green}0d` : x.status === "doing" ? "#F3F4F6" : "transparent",
              }}
            >
              <button
                onClick={() => cycle(x.id)}
                title="Click to change status"
                style={{
                  border: `1px solid ${c}66`,
                  background: `${c}18`,
                  color: c,
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: FONT,
                }}
              >
                {lbl}
              </button>
              <span style={{ flex: 1, minWidth: 0 }} title={x.scope || ""}>
                <span style={{ display: "block", fontSize: 12, color: x.status === "done" ? T.txtDim : T.txt }}>{x.label}</span>
                {(num(x.budget) > 0 || x.scope) && (
                  <span style={{ display: "block", fontSize: 10.5, color: T.txtMute, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {num(x.budget) > 0 && <b style={{ fontFamily: MONO, color: T.txtDim }}>{fmt(num(x.budget))}</b>}
                    {num(x.budget) > 0 && x.scope ? ", " : ""}
                    {x.scope}
                  </span>
                )}
              </span>
              <button onClick={() => upd("rehab.milestones", r.milestones.filter((y) => y.id !== x.id))} style={iconBtn()}>
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input
          value={ms}
          onChange={(e) => setMs(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ms.trim()) {
              upd("rehab.milestones", [...r.milestones, { id: uid(), label: ms.trim(), status: "todo" }]);
              setMs("");
            }
          }}
          placeholder="Add a milestone…"
          style={{ ...inSt(), fontSize: 12.5, padding: "7px 9px" }}
        />
        <button
          onClick={() => {
            if (!ms.trim()) return;
            upd("rehab.milestones", [...r.milestones, { id: uid(), label: ms.trim(), status: "todo" }]);
            setMs("");
          }}
          style={smallBtn(T.teal, "#fff")}
        >
          +
        </button>
      </div>
      {rehabFunding === "draws" && <DrawsPanel draws={mgmt.draws} upd={upd} m={m} drawFee={drawFee} addLog={addLog} />}
    </div>
  );
}

// ----- On Market section -----
function MarketSection({ mgmt, upd, m, dealInputs, addLog }) {
  const today = todayISO();
  const L = mgmt.listing;
  const B = mgmt.buyer;
  const [np, setNp] = useState({ date: today, price: 0 });
  const [off, setOff] = useState({ date: today, buyer: "", amount: 0, financing: "Cash", status: "Received" });
  const listPrice = num(L.price);
  const proj = marketProjection(mgmt, dealInputs);
  const atList = listPrice > 0 ? calcDeal({ ...proj.inputs, arv: listPrice }).netProfit : null;
  const breakeven = solveArvForProfit(proj.inputs, 0);
  const carry = (m.monthlyInterest || 0) + (m.totalMonthlyHold || 0);
  const dom = daysBetween(L.date, B.date || today);
  const changePrice = () => {
    if (!(np.price > 0)) return;
    const prices = L.prices.length ? L.prices : listPrice > 0 ? [{ date: L.date || today, price: listPrice }] : [];
    upd("listing", { ...L, price: np.price, prices: [...prices, { date: np.date, price: np.price }] });
    addLog(`List price ${np.price < listPrice ? "reduced" : "changed"}: ${fmt(listPrice)} → ${fmt(np.price)}`);
    setNp({ date: today, price: 0 });
  };
  const addOffer = () => {
    if (!(off.amount > 0)) return;
    upd("listing.offers", [...L.offers, { ...off, id: uid() }]);
    addLog(`Offer received: ${fmt(off.amount)} (${off.financing})${off.buyer ? ` from ${off.buyer}` : ""}`);
    setOff({ date: today, buyer: "", amount: 0, financing: "Cash", status: "Received" });
  };
  const acceptOffer = (o) => {
    upd("buyer", { ...B, date: today, price: num(o.amount), financing: o.financing, expectedClosing: B.expectedClosing || addDaysISO(today, 30) });
    upd("listing.offers", L.offers.map((x) => (x.id === o.id ? { ...x, status: "Accepted" } : x)));
    addLog(`Accepted offer ${fmt(num(o.amount))} — sale pending`);
  };
  return (
    <div>
      <div className="field-grid-2" style={grid2}>
        <TextIn label="List date" type="date" value={L.date} onChange={(v) => upd("listing.date", v)} />
        <TextIn label="Listing agent" value={L.agent} onChange={(v) => upd("listing.agent", v)} placeholder="Name / brokerage" />
      </div>
      <div style={{ background: T.inputBg, borderRadius: 4, padding: "10px 14px", marginBottom: 10 }}>
        <MiniRow label="Current list price" value={fmt(listPrice)} strong />
        <MiniRow label={`Days on market${B.date ? " (until contract)" : ""}`} value={dom != null ? String(dom) : "—"} color={dom > 60 ? T.red : dom > 30 ? T.amber : null} />
        <MiniRow
          label={`Profit at list price (${proj.projHold} mo hold${proj.assumed ? ", if it closes in 30 days" : ""})`}
          value={atList != null ? fmt(atList) : "—"}
          color={atList >= 0 ? T.green : T.red}
        />
        <MiniRow label="Break-even sale price" value={breakeven != null ? fmt(breakeven) : "—"} />
        <MiniRow label="Each extra month costs" value={fmt(carry)} />
      </div>
      <div style={subHead(STAGES[3].color)}>Price changes</div>
      {L.prices.map((p, i) => {
        const prevP = i > 0 ? num(L.prices[i - 1].price) : null;
        const dlt = prevP != null ? num(p.price) - prevP : null;
        return (
          <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontFamily: MONO, color: T.txtMute, width: 74 }}>{fmtDateShort(p.date)}</span>
            <span style={{ fontFamily: MONO, fontWeight: 700 }}>{fmt(num(p.price))}</span>
            {dlt != null && <span style={{ fontFamily: MONO, color: dlt < 0 ? T.red : T.green }}>{(dlt >= 0 ? "+" : "") + fmt(dlt)}</span>}
            {i === 0 && <span style={{ color: T.txtMute }}>original</span>}
          </div>
        );
      })}
      <div className="price-add" style={{ display: "grid", gap: 8, gridTemplateColumns: "130px 1fr auto", marginTop: 8, alignItems: "end" }}>
        <TextIn type="date" value={np.date} onChange={(v) => setNp({ ...np, date: v })} />
        <Field label="" value={np.price} onChange={(v) => setNp({ ...np, price: v })} prefix="$" step={1000} hint={np.price > 0 ? `profit at this price: ${fmt(calcDeal({ ...proj.inputs, arv: np.price }).netProfit)}` : undefined} />
        <button onClick={changePrice} style={{ ...smallBtn(STAGES[3].color, "#fff"), marginBottom: 12, height: 38 }}>
          Change price
        </button>
      </div>

      <div style={subHead(STAGES[3].color)}>Offers received</div>
      {L.offers.length === 0 && <div style={{ fontSize: 12, color: T.txtMute, marginBottom: 6 }}>No offers yet.</div>}
      {L.offers.map((o) => (
        <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.txtMute, width: 64 }}>{fmtDateShort(o.date)}</span>
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, width: 92 }}>{fmt(num(o.amount))}</span>
          <span style={{ fontSize: 12, color: T.txtDim }}>{o.financing}</span>
          <span style={{ flex: 1, fontSize: 12, color: T.txtDim, minWidth: 60 }}>{o.buyer}</span>
          <select
            value={o.status}
            onChange={(e) => upd("listing.offers", L.offers.map((x) => (x.id === o.id ? { ...x, status: e.target.value } : x)))}
            style={{ ...inSt(), width: 112, padding: "4px 6px", fontSize: 12 }}
          >
            {["Received", "Countered", "Accepted", "Rejected"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {!B.date && o.status !== "Rejected" && (
            <button onClick={() => acceptOffer(o)} style={smallBtn(`${T.green}1a`, T.green)}>
              Accept
            </button>
          )}
          <button onClick={() => upd("listing.offers", L.offers.filter((x) => x.id !== o.id))} style={iconBtn()}>
            ×
          </button>
        </div>
      ))}
      <div className="offer-in-add" style={{ display: "grid", gap: 8, gridTemplateColumns: "130px 1fr 120px 1fr auto", marginTop: 8, alignItems: "end" }}>
        <TextIn type="date" value={off.date} onChange={(v) => setOff({ ...off, date: v })} />
        <Field label="" value={off.amount} onChange={(v) => setOff({ ...off, amount: v })} prefix="$" step={1000} />
        <SelectIn value={off.financing} onChange={(v) => setOff({ ...off, financing: v })} options={BUYER_FINANCING} />
        <TextIn value={off.buyer} onChange={(v) => setOff({ ...off, buyer: v })} placeholder="Buyer / agent" onKeyDown={(e) => e.key === "Enter" && addOffer()} />
        <button onClick={addOffer} style={{ ...smallBtn(T.teal, "#fff"), marginBottom: 12, height: 38 }}>
          + Offer
        </button>
      </div>

      <div style={{ ...subHead(T.green), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Buyer under contract {B.date ? "(sale pending)" : ""}</span>
        {B.date && (
          <button
            onClick={() => {
              upd("buyer", { date: "", price: 0, expectedClosing: "", financing: "", inspectionEnd: "" });
              addLog("Buyer contract cancelled — back on market");
            }}
            style={smallBtn(T.glass, T.red)}
          >
            Contract fell through
          </button>
        )}
      </div>
      <div className="field-grid-2" style={grid2}>
        <TextIn label="Contract date" type="date" value={B.date} onChange={(v) => upd("buyer.date", v)} />
        <Field label="Contract price" value={num(B.price)} onChange={(v) => upd("buyer.price", v)} prefix="$" step={1000} accent={T.green} />
        <TextIn label="Buyer inspection ends" type="date" value={B.inspectionEnd} onChange={(v) => upd("buyer.inspectionEnd", v)} />
        <TextIn label="Expected closing" type="date" value={B.expectedClosing} onChange={(v) => upd("buyer.expectedClosing", v)} />
        <SelectIn label="Buyer financing" value={B.financing} onChange={(v) => upd("buyer.financing", v)} options={BUYER_FINANCING} placeholder="—" />
      </div>
    </div>
  );
}

// ----- Sold: original underwriting vs actual -----
function SoldSection({ mgmt, upd, m, uwBaseline, actuals, actualSale, setActualSale, arv, holdMonths, purchase }) {
  const cat = (c) => sumActuals(actuals, c);
  const plan = uwBaseline ? uwBaseline.m : m;
  const planArv = uwBaseline ? uwBaseline.inputs.arv : arv;
  const planHold = uwBaseline ? uwBaseline.inputs.holdMonths : holdMonths;
  const spent = sumActuals(actuals);
  const actualProfit = actualSale - spent;
  const actualHold = monthsBetween(mgmt.closing.date, mgmt.sale.date);
  const fg = gradeDeal({
    repair: cat("Rehab / Construction"),
    holdMonths: actualHold || 0,
    netProfit: actualProfit,
    purchase: num(mgmt.closing.price) || purchase,
    arv: actualSale,
  });
  const rows = [
    ["Sale price", planArv, actualSale, 1],
    ["Acquisition (price + closing)", plan.purchase + plan.totalBuying, cat("Acquisition"), -1],
    ["Rehab", plan.repair, cat("Rehab / Construction"), -1],
    ["Financing", plan.totalFinancing, cat("Financing"), -1],
    ["Holding", plan.totalHolding, cat("Holding"), -1],
    ["Selling", plan.totalSelling, cat("Selling"), -1],
    ["Services & other", plan.pmFee || 0, cat("Services") + cat("Other"), -1],
  ];
  const cell = { fontFamily: MONO, fontSize: 12.5, textAlign: "right", padding: "6px 4px" };
  return (
    <div>
      <div className="field-grid-2" style={grid2}>
        <TextIn label="Sale closed on" type="date" value={mgmt.sale.date} onChange={(v) => upd("sale.date", v)} />
        <Field label="Final sale price (gross)" value={actualSale} onChange={setActualSale} prefix="$" step={1000} accent={T.green} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
          <thead>
            <tr style={{ fontSize: 12, fontWeight: 500, color: T.txtMute }}>
              <th style={{ textAlign: "left", padding: "4px" }}></th>
              <th style={{ textAlign: "right", padding: "4px" }}>{uwBaseline ? "Original plan" : "Plan (current)"}</th>
              <th style={{ textAlign: "right", padding: "4px" }}>Actual</th>
              <th style={{ textAlign: "right", padding: "4px" }}>Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([l, p, a, dir]) => {
              const v = a - p;
              const good = dir > 0 ? v >= 0 : v <= 0;
              return (
                <tr key={l} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ fontSize: 12.5, color: T.txtDim, padding: "6px 4px" }}>{l}</td>
                  <td style={cell}>{fmt(p)}</td>
                  <td style={cell}>{fmt(a)}</td>
                  <td style={{ ...cell, fontWeight: 700, color: Math.abs(v) < 1 ? T.txtMute : good ? T.green : T.red }}>{(v > 0 ? "+" : "") + fmt(v)}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: `2px solid ${T.borderHi}` }}>
              <td style={{ fontSize: 13.5, fontWeight: 800, padding: "8px 4px" }}>Net profit</td>
              <td style={{ ...cell, fontWeight: 800 }}>{fmt(plan.netProfit)}</td>
              <td style={{ ...cell, fontWeight: 800, color: actualProfit >= 0 ? T.green : T.red }}>{fmt(actualProfit)}</td>
              <td style={{ ...cell, fontWeight: 800, color: actualProfit - plan.netProfit >= 0 ? T.green : T.red }}>
                {(actualProfit - plan.netProfit > 0 ? "+" : "") + fmt(actualProfit - plan.netProfit)}
              </td>
            </tr>
            <tr style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ fontSize: 12.5, color: T.txtDim, padding: "6px 4px" }}>Hold time, closing to sale</td>
              <td style={cell}>{planHold} mo</td>
              <td style={cell}>{actualHold != null ? actualHold.toFixed(1) + " mo" : "—"}</td>
              <td style={{ ...cell, color: actualHold != null ? (actualHold <= planHold ? T.green : T.red) : T.txtMute }}>
                {actualHold != null ? (actualHold - planHold > 0 ? "+" : "") + (actualHold - planHold).toFixed(1) + " mo" : ""}
              </td>
            </tr>
            {(() => {
              // the hold split: waiting for the rehab to start, then the rehab itself
              const g = mgmt.closing.date && mgmt.rehab.startDate ? Math.max(0, daysBetween(mgmt.closing.date, mgmt.rehab.startDate)) : null;
              const rd = mgmt.rehab.startDate && mgmt.rehab.endDate ? Math.max(0, daysBetween(mgmt.rehab.startDate, mgmt.rehab.endDate)) : null;
              const rp = mgmt.rehab.startDate && mgmt.rehab.targetEnd ? daysBetween(mgmt.rehab.startDate, mgmt.rehab.targetEnd) : null;
              return (
                <React.Fragment>
                  <tr style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ fontSize: 12.5, color: T.txtDim, padding: "6px 4px" }}>Closing to rehab start</td>
                    <td style={cell}>—</td>
                    <td style={cell}>{g != null ? `${g} days` : "—"}</td>
                    <td style={cell}></td>
                  </tr>
                  <tr style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ fontSize: 12.5, color: T.txtDim, padding: "6px 4px" }}>Rehab time, start to completion</td>
                    <td style={cell}>{rp != null ? `${rp} days` : "—"}</td>
                    <td style={cell}>{rd != null ? `${rd} days` : "—"}</td>
                    <td style={{ ...cell, color: rd != null && rp != null ? (rd <= rp ? T.green : T.red) : T.txtMute }}>
                      {rd != null && rp != null ? (rd - rp > 0 ? "+" : "") + (rd - rp) + " days" : ""}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })()}
            <tr style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ fontSize: 12.5, color: T.txtDim, padding: "6px 4px" }}>Grade</td>
              <td style={{ ...cell, fontWeight: 800, color: gradeColorOf(uwBaseline ? uwBaseline.grade : null) }}>{uwBaseline ? uwBaseline.grade : "—"}</td>
              <td style={{ ...cell, fontWeight: 800, color: fg.gradeColor }}>{fg.grade}</td>
              <td style={cell}></td>
            </tr>
          </tbody>
        </table>
      </div>
      {actualHold == null && <Note tone={T.amber}>Set the purchase closing date (Rehab section) and the sale closing date to measure the real hold time and final grade.</Note>}
      <label style={{ display: "block", marginTop: 12 }}>
        <span style={lblSt()}>Lessons learned</span>
        <textarea
          value={mgmt.lessons}
          onChange={(e) => upd("lessons", e.target.value)}
          rows={3}
          placeholder="What would we do differently next time?"
          style={{ ...inSt(), resize: "vertical", lineHeight: 1.5 }}
        />
      </label>
    </div>
  );
}

// ----- Right column panels -----
function KeyDates({ mgmt, analysisDate }) {
  const today = todayISO();
  const c = mgmt.contract;
  const rows = [
    ["Analyzed", analysisDate],
    ["Contract signed", c.date],
    ["Inspection period ends", c.inspectionEnd],
    [mgmt.closing.date ? null : "Expected closing", c.expectedClosing],
    ["Purchase closed", mgmt.closing.date],
    ["Rehab started", mgmt.rehab.startDate],
    [mgmt.rehab.endDate ? null : "Rehab target", mgmt.rehab.targetEnd],
    ["Rehab completed", mgmt.rehab.endDate],
    ["Listed", mgmt.listing.date],
    ["Buyer under contract", mgmt.buyer.date],
    ["Buyer inspection ends", mgmt.buyer.inspectionEnd],
    [mgmt.sale.date ? null : "Expected sale closing", mgmt.buyer.expectedClosing],
    ["Sold", mgmt.sale.date],
  ]
    .filter(([l, d]) => l && d)
    .sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <Panel title="Key Dates" accent={T.teal} icon="cal" tone="blue">
      {rows.length === 0 && <div style={{ fontSize: 12, color: T.txtMute }}>Dates appear here as the deal moves forward.</div>}
      {rows.map(([l, d]) => {
        const dd = daysBetween(today, d);
        const future = dd > 0;
        return (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: future ? "#D1D5DB" : T.txt, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, color: T.txt }}>{l}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.txtDim }}>{fmtDate(d)}</span>
            {future && dd <= 30 && <span style={{ fontSize: 10.5, color: dd <= 7 ? T.txt : T.txtMute, fontWeight: 700 }}>{relDays(dd)}</span>}
          </div>
        );
      })}
    </Panel>
  );
}
function ContactsPanel({ contacts, upd }) {
  const blank = { role: CONTACT_ROLES[0], name: "", company: "", phone: "", email: "" };
  const [d, setD] = useState(blank);
  const [adding, setAdding] = useState(false);
  const add = () => {
    if (!d.name.trim() && !d.company.trim()) return;
    upd("contacts", [...contacts, { ...d, id: uid() }]);
    setD(blank);
    setAdding(false);
  };
  return (
    <OvCard
      icon="users"
      title="Contacts"
      className="ov-contacts"
      right={
        !adding && (
          <button onClick={() => setAdding(true)} style={smallBtn(T.glass, T.blue)}>
            + Add
          </button>
        )
      }
    >
      {contacts.length === 0 && !adding && <div style={{ fontSize: 12, color: T.txtMute }}>Title company, lender, agents, contractor…</div>}
      {contacts.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${T.border}`, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: T.txtMute }}>{c.role}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {c.name}
              {c.company && <span style={{ fontWeight: 400, color: T.txtDim }}>, {c.company}</span>}
            </div>
            <div style={{ fontSize: 11.5, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {c.phone && (
                <a href={`tel:${c.phone}`} style={{ color: T.teal, textDecoration: "none", fontFamily: MONO }}>
                  {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} style={{ color: T.teal, textDecoration: "none" }}>
                  {c.email}
                </a>
              )}
            </div>
          </div>
          <button onClick={() => upd("contacts", contacts.filter((x) => x.id !== c.id))} style={iconBtn()}>
            ×
          </button>
        </div>
      ))}
      {adding && (
        <div style={{ marginTop: 8 }}>
          <div className="field-grid-2" style={grid2}>
            <SelectIn label="Role" value={d.role} onChange={(v) => setD({ ...d, role: v })} options={CONTACT_ROLES} />
            <TextIn label="Name" value={d.name} onChange={(v) => setD({ ...d, name: v })} autoFocus />
            <TextIn label="Company" value={d.company} onChange={(v) => setD({ ...d, company: v })} />
            <TextIn label="Phone" value={d.phone} onChange={(v) => setD({ ...d, phone: v })} />
          </div>
          <TextIn label="Email" value={d.email} onChange={(v) => setD({ ...d, email: v })} onKeyDown={(e) => e.key === "Enter" && add()} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(false)} style={smallBtn(T.glass, T.txtDim)}>
              Cancel
            </button>
            <button onClick={add} style={smallBtn(T.blue, "#fff")}>
              Save contact
            </button>
          </div>
        </div>
      )}
    </OvCard>
  );
}
// Files and links kept with the deal (Drive uploads or URLs). Lives under Expenses & Documents.
function DocsPanel({ docs, upd, onUploadDoc, openAttachment, connected, uploading }) {
  const fileRef = useRef(null);
  const [link, setLink] = useState({ name: "", url: "" });
  const [adding, setAdding] = useState(false);
  const addLink = () => {
    if (!link.url.trim()) return;
    const url = /^https?:\/\//i.test(link.url.trim()) ? link.url.trim() : "https://" + link.url.trim();
    upd("docs", [...docs, { id: uid(), type: "link", url, name: link.name.trim() || url.replace(/^https?:\/\//, "").slice(0, 40), date: todayISO() }]);
    setLink({ name: "", url: "" });
    setAdding(false);
  };
  return (
    <div className="dcard-b xd-files">
      <div className="xd-sub-h">Files and links</div>
      {docs.length === 0 && <div className="dcard-empty">No files yet. Upload a file to the deal's Drive folder or add a link.</div>}
      {docs.map((f) => (
        <div key={f.id} className="doc-row">
          <span className="doc-ic">
            <Icon name={f.type === "link" ? "link" : "file"} />
          </span>
          <div className="doc-txt">
            <b>{f.name}</b>
            {(f.kind || f.date) && <span>{[f.kind, f.date ? fmtDate(f.date) : ""].filter(Boolean).join(" · ")}</span>}
          </div>
          <button onClick={() => openAttachment(f)} style={smallBtn("#FFFFFF", T.blue)}>
            Open
          </button>
          <button onClick={() => upd("docs", docs.filter((x) => x.id !== f.id))} title="Remove from this deal (the Drive file stays)" aria-label="Remove file" style={iconBtn()}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        style={{ display: "none" }}
        onChange={(e) => {
          const fl = e.target.files && e.target.files[0];
          if (fl) onUploadDoc(fl);
          e.target.value = "";
        }}
      />
      {adding ? (
        <div style={{ marginTop: 10 }}>
          <TextIn label="Link" value={link.url} onChange={(v) => setLink({ ...link, url: v })} placeholder="Drive / Docs / Dropbox URL" autoFocus />
          <TextIn label="Name" value={link.name} onChange={(v) => setLink({ ...link, name: v })} placeholder="e.g. Purchase contract" onKeyDown={(e) => e.key === "Enter" && addLink()} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setAdding(false)} style={btnGhost()}>
              Cancel
            </button>
            <button onClick={addLink} style={btnPrimary()}>
              Add link
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button disabled={!connected || uploading} onClick={() => fileRef.current && fileRef.current.click()} style={btnGhost(connected ? T.txt : T.txtMute)}>
            <Icon name="download" /> {uploading ? "Uploading…" : "Upload file"}
          </button>
          <button onClick={() => setAdding(true)} style={btnGhost()}>
            <Icon name="link" /> Add link
          </button>
        </div>
      )}
      {!connected && <div style={{ fontSize: 11.5, color: T.amber, marginTop: 6 }}>Connect Google Drive to upload files</div>}
    </div>
  );
}
function ActivityLog({ log, upd, addLog, userEmail }) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const add = () => {
    if (!text.trim()) return;
    const l = link.trim() ? (/^https?:\/\//i.test(link.trim()) ? link.trim() : "https://" + link.trim()) : "";
    addLog(text.trim(), l);
    setText("");
    setLink("");
    setShowLink(false);
  };
  return (
    <Panel title="Activity Log" kicker={`${log.length}`} icon="pulse" tone="gray">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add();
        }}
        rows={2}
        placeholder="Site visit, contractor update, call with the title company…"
        style={{ ...inSt(), resize: "vertical", lineHeight: 1.5, fontSize: 12.5 }}
      />
      {showLink && (
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Photo / document link (optional)" style={{ ...inSt(), marginTop: 6, fontSize: 12 }} />
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "space-between" }}>
        <button onClick={() => setShowLink((s) => !s)} style={smallBtn(T.glass, T.txtDim)}>
          {showLink ? "Remove link" : "Add link"}
        </button>
        <button onClick={add} disabled={!text.trim()} style={smallBtn(text.trim() ? T.txt : T.glass, text.trim() ? "#fff" : T.txtMute)}>
          Add update
        </button>
      </div>
      <div style={{ marginTop: 10, maxHeight: 420, overflowY: "auto" }}>
        {log.length === 0 && <div style={{ fontSize: 12, color: T.txtMute }}>Every stage change and update lands here, with who and when.</div>}
        {log.map((e) => (
          <div key={e.id} style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 10.5, fontFamily: MONO, color: T.txtMute }}>{fmtTs(e.ts)}</span>
              {e.by && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.teal }}>{nameOnly(e.by)}</span>}
              <span style={{ flex: 1 }} />
              {(!e.by || e.by === userEmail) && (
                <button onClick={() => upd("log", log.filter((x) => x.id !== e.id))} title="Delete" style={{ ...iconBtn(), fontSize: 12 }}>
                  ×
                </button>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: e.auto ? T.txtDim : T.txt, lineHeight: 1.45, whiteSpace: "pre-wrap", fontStyle: e.auto ? "italic" : "normal" }}>
              {e.text}
            </div>
            {e.link && (
              <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: T.teal }}>
                {e.link.replace(/^https?:\/\//, "").slice(0, 48)}
              </a>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ----- The tab -----
function ManagementTab(p) {
  const { stage, mgmt, setMgmt, m, deal, uwBaseline, actuals, actualSale, dealInputs, userEmail, analysisDate } = p;
  const today = todayISO();
  const dead = stage === "dead";
  const curKey = dead ? (mgmt.dead && mgmt.dead.fromStage) || "analyzing" : stage;
  const curIdx = Math.max(0, stageIdx(curKey));
  const [open, setOpen] = useState(() => ({ [curKey]: true }));
  useEffect(() => setOpen((o) => ({ ...o, [curKey]: true })), [curKey]);
  const upd = (path, val) => setMgmt((mm) => setIn(mm, path, val));
  const addLog = (text, link) =>
    setMgmt((mm) => ({ ...mm, log: [{ id: uid(), ts: new Date().toISOString(), by: userEmail || "", text, link: link || "" }, ...mm.log] }));
  const spent = sumActuals(actuals);
  const rehabSpent = sumActuals(actuals, "Rehab / Construction");
  const budget = uwBaseline ? uwBaseline.m.repair : m.repair;
  const mp = milestonePct(mgmt.rehab.milestones);
  const c = mgmt.contract;
  const kpis = (() => {
    if (dead)
      return [
        ["Status", "Dead", T.red, mgmt.dead ? mgmt.dead.reason : ""],
        ["Since", fmtDate(mgmt.dead && mgmt.dead.date), T.txtDim],
        ["Was in", stageMeta(curKey).label, stageMeta(curKey).color],
        ["Projected profit", deal.incomplete ? "—" : fmt(m.netProfit), T.txtDim],
      ];
    if (stage === "analyzing") {
      const lo = mgmt.offers[mgmt.offers.length - 1];
      return [
        ["Deal grade", deal.grade === "REJECT" ? "Reject" : deal.grade, deal.grade === "REJECT" ? T.red : T.txt, deal.tier],
        ["Projected profit", deal.incomplete ? "—" : fmt(m.netProfit), m.netProfit > 0 ? T.green : T.red],
        ["Max allowable offer", p.mao.target == null ? "—" : fmt(p.mao.target), T.teal, p.mao.walk != null ? `walk away above ${fmt(p.mao.walk)}` : ""],
        ["Last offer", lo ? fmt(num(lo.amount)) : "—", T.blue, lo ? `${lo.status}, ${fmtDateShort(lo.date)}` : "none sent"],
      ];
    }
    if (stage === "contract") {
      const dc = daysBetween(today, c.expectedClosing);
      const di = daysBetween(today, c.inspectionEnd);
      return [
        ["Closing", dc == null ? "—" : dc < 0 ? `${-dc}d overdue` : `${dc} days`, dc != null && dc < 0 ? T.red : dc != null && dc <= 7 ? T.amber : T.blue, fmtDate(c.expectedClosing)],
        ["Inspection period", di == null ? "—" : di < 0 ? "ended" : `${di} days left`, di != null && di >= 0 && di <= 3 ? T.amber : T.txtDim, fmtDate(c.inspectionEnd)],
        ["Contract price", fmt(num(c.price)), T.txt],
        ["Earnest money", fmt(num(c.emd)), T.violet],
      ];
    }
    if (stage === "rehab") {
      const rc = rehabClock(mgmt, today);
      const el = rc.day;
      const plan = rc.plan;
      const sp = budget > 0 ? Math.round((rehabSpent / budget) * 100) : null;
      return [
        rc.waiting
          ? ["Rehab", "Not started", rc.gap > 30 ? T.red : rc.gap > 14 ? T.amber : T.txt, rc.gap != null ? `${rc.gap} days since closing` : ""]
          : ["Rehab day", el == null ? "—" : String(el), plan != null && el > plan ? T.red : T.txt, (plan != null ? `of ${plan} planned` : "") + (rc.gap != null ? `${plan != null ? ", " : ""}started ${rc.gap}d after closing` : "")],
        ["Budget used", sp == null ? "—" : `${sp}%`, sp > 110 ? T.red : sp > 100 ? T.amber : T.txt, `${fmt(rehabSpent)} of ${fmt(budget)}`],
        ["Work complete", mp == null ? "—" : `${mp}%`, T.green],
        ["Forecast profit", fmt(m.netProfit), m.netProfit > 0 ? T.green : T.red, uwBaseline ? `original ${fmt(uwBaseline.m.netProfit)}` : ""],
      ];
    }
    if (stage === "market") {
      const dom = daysBetween(mgmt.listing.date, mgmt.buyer.date || today);
      const lp = num(mgmt.listing.price);
      const proj = marketProjection(mgmt, dealInputs);
      const atList = lp > 0 ? calcDeal({ ...proj.inputs, arv: lp }).netProfit : null;
      return [
        ["Days on market", dom == null ? "—" : String(dom), dom > 60 ? T.red : dom > 30 ? T.amber : T.violet, mgmt.buyer.date ? "sale pending" : ""],
        ["List price", fmt(lp), T.txt, mgmt.listing.prices.length > 1 ? `original ${fmt(num(mgmt.listing.prices[0].price))}` : ""],
        ["Profit at list", atList == null ? "—" : fmt(atList), atList >= 0 ? T.green : T.red, `${proj.projHold} mo actual hold`],
        ["Extra month costs", fmt((m.monthlyInterest || 0) + (m.totalMonthlyHold || 0)), T.txt, "interest plus holding"],
      ];
    }
    // sold
    const ap = actualSale - spent;
    const plan = uwBaseline ? uwBaseline.m.netProfit : m.netProfit;
    const hold = monthsBetween(mgmt.closing.date, mgmt.sale.date);
    return [
      ["Actual profit", fmt(ap), ap >= 0 ? T.green : T.red],
      [uwBaseline ? "vs original plan" : "vs plan", (ap - plan >= 0 ? "+" : "") + fmt(ap - plan), ap - plan >= 0 ? T.green : T.red, `plan ${fmt(plan)}`],
      ["Hold time", hold == null ? "—" : `${hold.toFixed(1)} mo`, T.violet, uwBaseline ? `planned ${uwBaseline.inputs.holdMonths} mo` : ""],
      ["Sale price", fmt(actualSale), T.blue],
    ];
  })();
  const sectionSummary = {
    analyzing: `${mgmt.source ? `Source: ${mgmt.source}` : "Source not set"}, ${mgmt.offers.length ? `${mgmt.offers.length} offer${mgmt.offers.length === 1 ? "" : "s"} logged` : "no offers logged"}`,
    contract: `${fmt(num(c.price))}, contract ${fmtDateShort(c.date)}, EMD ${fmt(num(c.emd))}`,
    rehab: `closed ${fmtDateShort(mgmt.closing.date)}, ${fmt(rehabSpent)} spent, ${mp || 0}% done`,
    market: `listed ${fmtDateShort(mgmt.listing.date)} at ${fmt(num(mgmt.listing.price))}`,
    sold: `${fmt(actualSale)}, ${fmtDateShort(mgmt.sale.date)}`,
  };
  const sections = STAGES.slice(0, curIdx + 1).reverse();
  return (
    <React.Fragment>
      <div className="pf-strip strip-4 stg-strip">
        {kpis.map(([l, v, tone, hint]) => {
          const [icon, look] = tileLook(l);
          const bad = tone === T.red || tone === T.amber;
          return (
            <div key={l} className={"pf-tile t-" + look}>
              <span className="pf-ico">
                <Icon name={icon} size={22} stroke={2} />
              </span>
              <div className="pf-tile-b">
                <span>{l}</span>
                <b style={bad ? { color: tone } : undefined}>{v}</b>
                {hint ? <em className={"pill p-" + (tone === T.red ? "red" : tone === T.amber ? "amber" : "gray")}>{hint}</em> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="actuals-two-col" style={{ display: "grid", gap: 16, alignItems: "start" }}>
        <div>
          {sections.map((s) => (
            <StageSection
              key={s.key}
              st={s.key}
              current={s.key === curKey && !dead}
              open={!!open[s.key]}
              onToggle={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}
              summary={sectionSummary[s.key]}
            >
              {s.key === "analyzing" && <OffersMade mgmt={mgmt} upd={upd} addLog={addLog} past={curKey !== "analyzing"} />}
              {s.key === "contract" && (
                <React.Fragment>
                  <div className="field-grid-2" style={grid2}>
                    <TextIn label="Contract date" type="date" value={c.date} onChange={(v) => upd("contract.date", v)} />
                    <Field label="Contract price" value={num(c.price)} onChange={(v) => upd("contract.price", v)} prefix="$" step={1000} />
                    <TextIn label="Inspection period ends" type="date" value={c.inspectionEnd} onChange={(v) => upd("contract.inspectionEnd", v)} />
                    <TextIn label="Expected closing" type="date" value={c.expectedClosing} onChange={(v) => upd("contract.expectedClosing", v)} />
                    <Field label="Earnest money (EMD)" value={num(c.emd)} onChange={(v) => upd("contract.emd", v)} prefix="$" step={500} />
                  </div>
                  <Checklist items={mgmt.checklists.contract || []} onChange={(v) => upd("checklists.contract", v)} by={userEmail} gate={(i) => taskGate(i, "contract", mgmt, stage)} />
                </React.Fragment>
              )}
              {s.key === "rehab" && (
                <React.Fragment>
                  <RehabSection
                    mgmt={mgmt}
                    upd={upd}
                    m={m}
                    uwBaseline={uwBaseline}
                    actuals={actuals}
                    rehabFunding={p.rehabFunding}
                    drawFee={dealInputs.drawFee}
                    addLog={addLog}
                    by={userEmail}
                    onImportSow={p.onImportSow}
                    onSchedule={p.onSchedule}
                  />
                  <div style={{ marginTop: 14 }}>
                    <Checklist items={mgmt.checklists.rehab || []} onChange={(v) => upd("checklists.rehab", v)} by={userEmail} gate={(i) => taskGate(i, "rehab", mgmt, stage)} />
                  </div>
                </React.Fragment>
              )}
              {s.key === "market" && (
                <React.Fragment>
                  <MarketSection mgmt={mgmt} upd={upd} m={m} dealInputs={dealInputs} addLog={addLog} />
                  <div style={{ marginTop: 14 }}>
                    <Checklist items={mgmt.checklists.market || []} onChange={(v) => upd("checklists.market", v)} by={userEmail} gate={(i) => taskGate(i, "market", mgmt, stage)} />
                  </div>
                </React.Fragment>
              )}
              {s.key === "sold" && (
                <SoldSection
                  mgmt={mgmt}
                  upd={upd}
                  m={m}
                  uwBaseline={uwBaseline}
                  actuals={actuals}
                  actualSale={actualSale}
                  setActualSale={p.setActualSale}
                  arv={p.arv}
                  holdMonths={p.holdMonths}
                  purchase={p.purchase}
                />
              )}
            </StageSection>
          ))}
          {dead && (
            <Panel title="Why it died" accent={T.red} icon="alert" tone="red">
              <SelectIn label="Reason" value={mgmt.dead && mgmt.dead.reason} onChange={(v) => upd("dead.reason", v)} options={DEAD_REASONS} />
              <TextIn label="Note" value={mgmt.dead && mgmt.dead.note} onChange={(v) => upd("dead.note", v)} />
            </Panel>
          )}
        </div>
        <div>
          <KeyDates mgmt={mgmt} analysisDate={analysisDate} />
          <ActivityLog log={mgmt.log} upd={upd} addLog={addLog} userEmail={userEmail} />
        </div>
      </div>
    </React.Fragment>
  );
}
