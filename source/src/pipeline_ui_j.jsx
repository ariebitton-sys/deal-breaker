// ============================================================================
// v54 — FINANCING: what came in from the lender and the investors, what it costs, and what is owed today
// ============================================================================
// mgmt.financing = { lender?, investors?, payoffDate? }. Until someone enters the real terms, each part is
// derived from the Flip analysis (and says so); the first edit to a part saves it as the deal's own terms.
// Lender releases after closing (holdbacks, rehab draws) are mgmt.draws rows, the same rows as the draws panel.
const FIN_ACCRUAL = [
  ["full", "The full note, from closing"],
  ["funded", "Only what was released, from each release"],
];
const FIN_BASIS = [
  ["flat", "Flat"],
  ["annual", "Per year"],
];

function finLenderOf(fin, uw, m, mgmt) {
  if (fin && fin.lender) return { fees: [], ...fin.lender, real: true };
  const draws = uw.rehabFunding === "draws";
  return {
    real: false,
    name: "",
    note: Math.round((m.loanAmountPurchase || 0) + (draws ? m.loanAmountRehab || 0 : 0)),
    funded: Math.round(m.loanAmountPurchase || 0),
    start: (mgmt.closing && mgmt.closing.date) || "",
    rate: uw.intRatePurchase || 0,
    accrual: draws ? "funded" : "full",
    maturity: "",
    defaultRate: 0,
    paidInterest: 0,
    fees: uw.points > 0 ? [{ id: "pts", label: "Points / lender fees", amount: Math.round(uw.points), paid: true }] : [],
  };
}
function finInvestorsOf(fin, uw, m, mgmt) {
  if (fin && Array.isArray(fin.investors)) return fin.investors;
  return m.investorAmount > 0 ? [{ id: "inv", name: "Investors", amount: Math.round(m.investorAmount), date: (mgmt.closing && mgmt.closing.date) || "", rate: uw.investorRate || 0, basis: "flat", paidBack: "" }] : [];
}
const finDays = (a, b) => Math.max(0, daysBetween(a, b) || 0);

// Where the deal stands on `asOf`: principal received, interest accrued (at the default rate past maturity),
// fees, what the lender is owed, and each investor's return.
function finPosition(L, investors, draws, asOf) {
  const releases = (draws || [])
    .filter((d) => d.received && num(d.amount) > 0)
    .map((d) => ({ id: d.id, date: d.received, amount: num(d.amount), fee: num(d.fee) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const started = !!L.start && L.start <= asOf;
  const tranches = started ? [{ id: "close", date: L.start, amount: num(L.funded), atClosing: true }, ...releases.filter((r) => r.date <= asOf)] : [];
  const principal = tranches.reduce((s, t) => s + t.amount, 0);
  const base = !started ? [] : L.accrual === "full" ? [{ date: L.start, amount: Math.max(num(L.note), principal) }] : tranches;
  const rate = num(L.rate),
    defRate = num(L.defaultRate);
  const mat = L.maturity || "";
  const pastMaturity = started && !!mat && asOf > mat;
  let interest = 0,
    defInterest = 0;
  base.forEach((t) => {
    if (pastMaturity && defRate > 0) {
      const split = mat > t.date ? mat : t.date;
      interest += (t.amount * rate * finDays(t.date, split)) / 365;
      defInterest += (t.amount * defRate * finDays(split, asOf)) / 365;
    } else interest += (t.amount * rate * finDays(t.date, asOf)) / 365;
  });
  const accrued = interest + defInterest;
  const paidInterest = Math.min(num(L.paidInterest), accrued);
  const interestDue = accrued - paidInterest;
  const fees = L.fees || [];
  const drawFees = releases.filter((r) => r.date <= asOf).reduce((s, r) => s + r.fee, 0);
  const feesPaid = fees.filter((f) => f.paid).reduce((s, f) => s + num(f.amount), 0) + drawFees;
  const feesDue = fees.filter((f) => !f.paid).reduce((s, f) => s + num(f.amount), 0);
  const curRate = pastMaturity && defRate > 0 ? defRate : rate;
  const perMonth = (base.reduce((s, t) => s + t.amount, 0) * curRate) / 12;
  const inv = (investors || []).map((x) => {
    const isIn = !x.date || x.date <= asOf;
    const end = x.paidBack && x.paidBack < asOf ? x.paidBack : asOf;
    const ret = !isIn ? 0 : x.basis === "annual" ? (num(x.amount) * num(x.rate) * finDays(x.date, end)) / 365 : num(x.amount) * num(x.rate);
    const open = isIn && !x.paidBack;
    return { ...x, isIn, ret, open, due: open ? num(x.amount) + ret : 0 };
  });
  const invIn = inv.filter((x) => x.isIn).reduce((s, x) => s + num(x.amount), 0);
  const invReturn = inv.reduce((s, x) => s + x.ret, 0);
  const invDue = inv.reduce((s, x) => s + x.due, 0);
  const invPerMonth = inv.filter((x) => x.open && x.basis === "annual").reduce((s, x) => s + (num(x.amount) * num(x.rate)) / 12, 0);
  const lenderPayoff = started ? principal + interestDue + feesDue : 0;
  return {
    started, releases, tranches, principal, undrawn: Math.max(0, num(L.note) - principal), interest, defInterest, accrued, paidInterest, interestDue,
    feesPaid, feesDue, lenderPayoff, pastMaturity, curRate, perMonth, daysToMaturity: mat ? daysBetween(asOf, mat) : null,
    inv, invIn, invReturn, invDue, invPerMonth,
    received: principal + invIn,
    owed: lenderPayoff + invDue,
    cost: accrued + feesPaid + feesDue + invReturn,
    accruing: perMonth + invPerMonth,
  };
}
// The payoff date to project to: the sale closing when one is set, else the plan's exit, else a month out.
function finPayoffDefault(fin, mgmt, uw, today) {
  if (fin && fin.payoffDate) return fin.payoffDate;
  const c = (mgmt.buyer && mgmt.buyer.expectedClosing) || "";
  if (c && c >= today) return c;
  const plan = mgmt.closing && mgmt.closing.date ? addMonthsISO(mgmt.closing.date, uw.holdMonths || 0) : "";
  return plan && plan > today ? plan : addDaysISO(today, 30);
}
const finPctLabel = (r) => `${+(num(r) * 100).toFixed(2)}%`;
function finMaturityLine(L, pos) {
  if (!L.maturity) return null;
  const d = pos.daysToMaturity;
  if (pos.pastMaturity) return { tone: "neg", text: `Past maturity (${fmtDate(L.maturity)}) by ${-d} day${d === -1 ? "" : "s"}${num(L.defaultRate) > 0 ? `, default rate ${finPctLabel(num(L.defaultRate) / 12)}/mo` : ""}` };
  if (d <= 30) return { tone: "warn", text: `Matures ${fmtDate(L.maturity)}, in ${d} day${d === 1 ? "" : "s"}` };
  return { tone: "", text: `Matures ${fmtDate(L.maturity)}, in ${d} days` };
}

// ---------- the overview card ----------
function FinancingCard({ L, investors, pos, onOpen, soldOn }) {
  const none = !(num(L.note) > 0) && !investors.length;
  if (soldOn != null && !none)
    return (
      <OvCard icon="bank" title="Financing" onOpen={onOpen} openLabel="Details" className="fin-card">
        <div className="ov-pair">
          <OvStat k="Financing cost" v={fmt(pos.cost)} big />
          <OvStat k="Received" v={fmt(pos.received)} />
        </div>
        <div className="ov-note">{soldOn ? `Paid off at the sale on ${fmtDate(soldOn)}` : "Paid off at the sale"}</div>
        <div className="ov-list">
          <div>
            <span>Lender interest</span>
            <em>{fmt(pos.accrued)}</em>
          </div>
          <div>
            <span>Lender fees</span>
            <em>{fmt(pos.feesPaid + pos.feesDue)}</em>
          </div>
          {investors.length > 0 && (
            <div>
              <span>Investor return</span>
              <em>{fmt(pos.invReturn)}</em>
            </div>
          )}
        </div>
      </OvCard>
    );
  const mat = finMaturityLine(L, pos);
  const term = L.maturity && L.start ? daysBetween(L.start, L.maturity) : 0;
  const gone = L.start ? finDays(L.start, todayISO()) : 0;
  return (
    <OvCard icon="bank" title="Financing" onOpen={onOpen} openLabel="Details" className="fin-card">
      {none ? (
        <div className="dcard-empty">
          No lender or investors on this deal.{" "}
          <button className="link-btn" onClick={onOpen}>
            Add financing
          </button>
        </div>
      ) : !pos.started ? (
        <React.Fragment>
          <div className="ov-pair">
            <OvStat k="Loan" v={fmt(num(L.note))} h={num(L.rate) > 0 ? `${finPctLabel(L.rate)} per year` : undefined} big />
            <OvStat k="Investors" v={fmt(investors.reduce((s, x) => s + num(x.amount), 0))} />
          </div>
          <div className="ov-note">{L.start ? `Funds at closing on ${fmtDate(L.start)}` : "Funds at closing"}</div>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div className="ov-pair">
            <OvStat k="Owed today" v={fmt(pos.owed)} big />
            <OvStat k="Received" v={fmt(pos.received)} />
          </div>
          {term > 0 && <BudgetBar spent={gone} budget={term} />}
          <div className={"ov-note" + (mat && mat.tone ? " " + mat.tone : "")}>{mat ? mat.text : `Accruing ${fmt(pos.accruing)} a month`}</div>
          <div className="ov-list">
            <div>
              <span>Lender{L.name ? `, ${L.name}` : ""}</span>
              <em>{fmt(pos.principal)}</em>
            </div>
            <div>
              <span>Interest to date{pos.defInterest > 0 ? " (incl. default)" : ""}</span>
              <em className={pos.defInterest > 0 ? "neg" : ""}>{fmt(pos.interestDue)}</em>
            </div>
            {pos.feesDue > 0 && (
              <div>
                <span>Lender fees due</span>
                <em>{fmt(pos.feesDue)}</em>
              </div>
            )}
            {investors.length > 0 && (
              <div>
                <span>Investors, in + return</span>
                <em>
                  {fmt(pos.invIn)} + {fmt(pos.invReturn)}
                </em>
              </div>
            )}
          </div>
        </React.Fragment>
      )}
      {!L.real && !none && <div className="fin-derived">From the Flip analysis. Open Details to enter the real terms.</div>}
    </OvCard>
  );
}

// ---------- inputs that commit on blur or Enter ----------
function FinNum({ value, onCommit, pct, prefix, suffix, label, ...rest }) {
  // amounts read with thousands separators; typing them is optional (they are stripped on commit)
  const shown = (v) => (v == null || v === "" ? "" : pct ? String(+(num(v) * 100).toFixed(4)) : (+num(v).toFixed(2)).toLocaleString("en-US"));
  const [t, setT] = useState(shown(value));
  useEffect(() => setT(shown(value)), [value]);
  const commit = () => {
    const n = parseFloat(String(t).replace(/[$,%\s]/g, ""));
    const v = Number.isFinite(n) ? (pct ? n / 100 : n) : 0;
    if (Math.abs(v - num(value)) > 1e-9) onCommit(v);
    else setT(shown(value));
  };
  return (
    <span className="fin-in">
      {prefix && <i>{prefix}</i>}
      <input
        inputMode="decimal"
        aria-label={label}
        value={t}
        onChange={(e) => setT(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => (e.key === "Enter" ? e.currentTarget.blur() : e.key === "Escape" ? (e.stopPropagation(), setT(shown(value))) : null)}
        {...rest}
      />
      {suffix && <i className="suf">{suffix}</i>}
    </span>
  );
}
function FinText({ value, onCommit, ...rest }) {
  const [t, setT] = useState(value || "");
  useEffect(() => setT(value || ""), [value]);
  const commit = () => (t !== (value || "") ? onCommit(t) : null);
  return <input value={t} onChange={(e) => setT(e.target.value)} onBlur={commit} onKeyDown={(e) => (e.key === "Enter" ? e.currentTarget.blur() : e.key === "Escape" ? (e.stopPropagation(), setT(value || "")) : null)} {...rest} />;
}

// ---------- the details window ----------
function FinancingWindow({ L, investors, draws, today, payoffDate, setFinancing, setDraws, addLog, onClose }) {
  const pos = finPosition(L, investors, draws, today);
  const at = finPosition(L, investors, draws, payoffDate || today);
  const [rel, setRel] = useState({ date: today, amount: "" });
  const [fee, setFee] = useState({ label: "", amount: "", paid: false });
  useEffect(() => {
    const k = (e) => (e.key === "Escape" ? onClose() : null);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  const lenderNow = () => {
    const x = { ...L };
    delete x.real;
    return x;
  };
  const setL = (patch) => setFinancing((f) => ({ ...f, lender: { ...(f.lender || lenderNow()), ...patch } }));
  const setInv = (list) => setFinancing((f) => ({ ...f, investors: list }));
  const updInv = (id, patch) => setInv(investors.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addRelease = () => {
    const amount = parseFloat(String(rel.amount).replace(/[$,\s]/g, ""));
    if (!(amount > 0) || !rel.date) return;
    setDraws((d) => [...d, { id: uid(), requested: rel.date, received: rel.date, amount, fee: 0 }]);
    addLog(`Lender released ${fmt(amount)} on ${fmtDate(rel.date)}`);
    setRel({ date: today, amount: "" });
  };
  const addFee = () => {
    const amount = parseFloat(String(fee.amount).replace(/[$,\s]/g, ""));
    if (!(amount > 0)) return;
    setL({ fees: [...(L.fees || []), { id: uid(), label: fee.label.trim() || "Lender fee", amount, paid: fee.paid }] });
    setFee({ label: "", amount: "", paid: false });
  };
  const addInvestor = () => setInv([...investors, { id: uid(), name: "", amount: 0, date: today, rate: 0.09, basis: "flat", paidBack: "" }]);
  const sumRow = (label, v, cls, sign) => (
    <div className={"xw-item fin-row" + (cls ? " " + cls : "")}>
      <span className="xw-item-l">{label}</span>
      <span className="xw-item-a">
        {sign || ""}
        {fmt2(v)}
      </span>
    </div>
  );
  const mat = finMaturityLine(L, pos);
  const diff = at.owed - pos.owed;
  return (
    <div className="xw-back no-print" onClick={onClose}>
      <div className="xw fin-w" role="dialog" aria-label="Financing" onClick={(e) => e.stopPropagation()}>
        <header className="xw-h">
          <div className="xw-h-txt">
            <span className="xw-k">Financing</span>
            <h3>Lender and investors</h3>
            <p className="xw-sub">{L.real ? "Interest accrues daily on the terms below. Change any field and it saves with the deal." : "These terms come from the Flip analysis. Change any field to record this deal's real loan; it saves with the deal."}</p>
          </div>
          <button className="dv-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="xw-hero">
          <div>
            <span>Owed today</span>
            <b>{fmt2(pos.owed)}</b>
          </div>
          <div>
            <span>Received</span>
            <b>{fmt(pos.received)}</b>
          </div>
          <div>
            <span>Cost so far</span>
            <b>{fmt(pos.cost)}</b>
          </div>
          <div>
            <span>Accruing</span>
            <b>{fmt(pos.accruing)}/mo</b>
          </div>
        </div>
        <div className="xw-body">
          <section className="xw-sec">
            <div className="xw-sec-h">
              Lender {mat && <em className={mat.tone}>{mat.text}</em>}
            </div>
            <div className="xw-form">
              <label>
                Lender
                <FinText value={L.name} onCommit={(v) => setL({ name: v })} placeholder="Name" aria-label="Lender name" />
              </label>
              <label>
                Note amount
                <FinNum value={L.note} onCommit={(v) => setL({ note: v })} prefix="$" label="Note amount" />
              </label>
              <label>
                Released at closing
                <FinNum value={L.funded} onCommit={(v) => setL({ funded: v })} prefix="$" label="Released at closing" />
              </label>
              <label>
                Closing date
                <input type="date" value={L.start || ""} onChange={(e) => setL({ start: e.target.value })} aria-label="Closing date" />
              </label>
              <label>
                Interest rate
                <FinNum value={L.rate} onCommit={(v) => setL({ rate: v })} pct suffix="% / yr" label="Interest rate" />
                <span className="fin-hint">{finPctLabel(num(L.rate) / 12)} a month</span>
              </label>
              <label>
                Interest is charged on
                <select value={L.accrual || "full"} onChange={(e) => setL({ accrual: e.target.value })} aria-label="Interest is charged on">
                  {FIN_ACCRUAL.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Maturity date
                <input type="date" value={L.maturity || ""} onChange={(e) => setL({ maturity: e.target.value })} aria-label="Maturity date" />
              </label>
              <label>
                Default rate
                <FinNum value={L.defaultRate} onCommit={(v) => setL({ defaultRate: v })} pct suffix="% / yr" label="Default rate" />
                <span className="fin-hint">{num(L.defaultRate) > 0 ? `${finPctLabel(num(L.defaultRate) / 12)} a month, after maturity` : "charged after maturity"}</span>
              </label>
              <label>
                Interest paid so far
                <FinNum value={L.paidInterest} onCommit={(v) => setL({ paidInterest: v })} prefix="$" label="Interest paid so far" />
              </label>
            </div>

            <div className="fin-sub">Money received</div>
            <div className="xw-items">
              <div className="xw-item fin-rel">
                <span className="xw-item-n">{L.start ? fmtDate(L.start) : "—"}</span>
                <span className="xw-item-l">At closing</span>
                <span className="xw-item-a">{fmt2(num(L.funded))}</span>
                <span />
              </div>
              {pos.releases.map((r) => (
                <div key={r.id} className="xw-item fin-rel">
                  <span className="xw-item-n">{fmtDate(r.date)}</span>
                  <span className="xw-item-l">Release{r.fee > 0 ? `, fee ${fmt(r.fee)}` : ""}</span>
                  <span className="xw-item-a">{fmt2(r.amount)}</span>
                  <button className="fin-x" aria-label="Remove release" onClick={() => setDraws((d) => d.filter((x) => x.id !== r.id))}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              <div className="xw-item fin-rel sum">
                <span />
                <span className="xw-item-l">Received{pos.undrawn > 0 ? `, ${fmt(pos.undrawn)} of the note not released yet` : ""}</span>
                <span className="xw-item-a">{fmt2(pos.principal)}</span>
                <span />
              </div>
            </div>
            <div className="fin-add">
              <input type="date" value={rel.date} onChange={(e) => setRel({ ...rel, date: e.target.value })} aria-label="Release date" />
              <span className="fin-in">
                <i>$</i>
                <input inputMode="decimal" placeholder="Amount" value={rel.amount} onChange={(e) => setRel({ ...rel, amount: e.target.value })} onKeyDown={(e) => (e.key === "Enter" ? addRelease() : null)} aria-label="Release amount" />
              </span>
              <button style={btnGhost()} onClick={addRelease}>
                <Icon name="plus" size={13} /> Add release
              </button>
            </div>

            <div className="fin-sub">Lender fees</div>
            {(L.fees || []).length > 0 && (
              <div className="xw-items">
                {(L.fees || []).map((f) => (
                  <div key={f.id} className="xw-item fin-fee">
                    <span className="xw-item-l">{f.label}</span>
                    <button className={"fin-st" + (f.paid ? " paid" : "")} onClick={() => setL({ fees: L.fees.map((x) => (x.id === f.id ? { ...x, paid: !x.paid } : x)) })} title="Switch between paid and due at payoff">
                      {f.paid ? "Paid" : "Due at payoff"}
                    </button>
                    <span className="xw-item-a">{fmt2(num(f.amount))}</span>
                    <button className="fin-x" aria-label="Remove fee" onClick={() => setL({ fees: L.fees.filter((x) => x.id !== f.id) })}>
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="fin-add">
              <input placeholder="Fee, e.g. Extension fee" value={fee.label} onChange={(e) => setFee({ ...fee, label: e.target.value })} aria-label="Fee name" />
              <span className="fin-in">
                <i>$</i>
                <input inputMode="decimal" placeholder="Amount" value={fee.amount} onChange={(e) => setFee({ ...fee, amount: e.target.value })} onKeyDown={(e) => (e.key === "Enter" ? addFee() : null)} aria-label="Fee amount" />
              </span>
              <select value={fee.paid ? "paid" : "due"} onChange={(e) => setFee({ ...fee, paid: e.target.value === "paid" })} aria-label="Fee status">
                <option value="due">Due at payoff</option>
                <option value="paid">Paid</option>
              </select>
              <button style={btnGhost()} onClick={addFee}>
                <Icon name="plus" size={13} /> Add fee
              </button>
            </div>

            <div className="fin-sub">Owed to the lender today</div>
            <div className="xw-items">
              {sumRow("Principal received", pos.principal)}
              {sumRow(`Interest at ${finPctLabel(L.rate)} a year${L.accrual === "full" && pos.undrawn > 0 ? ", on the full note" : ""}`, pos.interest)}
              {pos.defInterest > 0 && sumRow(`Default interest since ${fmtDate(L.maturity)}`, pos.defInterest, "neg")}
              {pos.paidInterest > 0 && sumRow("Interest already paid", pos.paidInterest, "", "−")}
              {pos.feesDue > 0 && sumRow("Fees due at payoff", pos.feesDue)}
              {sumRow("Payoff today", pos.lenderPayoff, "sum")}
            </div>
          </section>

          <section className="xw-sec">
            <div className="xw-sec-h">
              Investors <em>{investors.length ? `${investors.length} position${investors.length === 1 ? "" : "s"}` : ""}</em>
            </div>
            {investors.length > 0 && (
              <div className="fin-inv">
                <div className="fin-inv-h">
                  <span>Investor</span>
                  <span>Amount</span>
                  <span>Money in</span>
                  <span>Return</span>
                  <span>Paid on</span>
                  <span>Return owed</span>
                  <span />
                </div>
                {pos.inv.map((x) => (
                  <div key={x.id} className={"fin-inv-r" + (x.paidBack ? " closed" : "")}>
                    <FinText value={x.name} onCommit={(v) => updInv(x.id, { name: v })} placeholder="Name" aria-label="Investor name" />
                    <FinNum value={x.amount} onCommit={(v) => updInv(x.id, { amount: v })} prefix="$" label="Investor amount" />
                    <input type="date" value={x.date || ""} onChange={(e) => updInv(x.id, { date: e.target.value })} aria-label="Money in" />
                    <span className="fin-ret">
                      <FinNum value={x.rate} onCommit={(v) => updInv(x.id, { rate: v })} pct suffix="%" label="Investor return" />
                      <select value={x.basis || "flat"} onChange={(e) => updInv(x.id, { basis: e.target.value })} aria-label="Return basis">
                        {FIN_BASIS.map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </span>
                    <input type="date" value={x.paidBack || ""} onChange={(e) => (updInv(x.id, { paidBack: e.target.value }), e.target.value && !x.paidBack ? addLog(`Investor paid back: ${x.name || "investor"}, ${fmt(num(x.amount) + x.ret)}`) : null)} aria-label="Paid back on" title="The date this investor was paid back" />
                    <b>{fmt2(x.ret)}</b>
                    <button className="fin-x" aria-label="Remove investor" onClick={() => setInv(investors.filter((y) => y.id !== x.id))}>
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="link-btn fin-addinv" onClick={addInvestor}>
              <Icon name="plus" size={13} /> Add investor
            </button>
            {investors.length > 0 && (
              <div className="xw-items" style={{ marginTop: 12 }}>
                {sumRow("Invested", pos.invIn)}
                {sumRow("Return owed", pos.invReturn)}
                {sumRow("Owed to investors today", pos.invDue, "sum")}
              </div>
            )}
          </section>

          <section className="xw-sec">
            <div className="xw-sec-h">If everyone is paid off on</div>
            <div className="fin-payoff">
              <input type="date" value={payoffDate} onChange={(e) => setFinancing((f) => ({ ...f, payoffDate: e.target.value }))} aria-label="Payoff date" />
              <span>{payoffDate > today ? `${daysBetween(today, payoffDate)} days from today` : payoffDate < today ? "a past date" : "today"}</span>
            </div>
            <div className="xw-items">
              {sumRow(`Lender: principal ${fmt(at.principal)}, interest ${fmt(at.interestDue)}${at.feesDue > 0 ? `, fees ${fmt(at.feesDue)}` : ""}`, at.lenderPayoff)}
              {at.defInterest > 0 && sumRow(`of which default interest after ${fmtDate(L.maturity)}`, at.defInterest, "neg")}
              {investors.length > 0 && sumRow(`Investors: ${fmt(at.invIn)} back plus ${fmt(at.invReturn)} return`, at.invDue)}
              {sumRow(diff > 0.5 ? `Total, ${fmt(diff)} more than today` : "Total", at.owed, "sum")}
            </div>
          </section>
        </div>
        <footer className="xw-f">
          <span className="fin-foot">Interest accrues daily: annual rate ÷ 365.</span>
          <button style={btnPrimary()} onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
