// ============================================================================
// v62 — FORECAST: what-if scenarios after the purchase
// ============================================================================
// The Flip analysis stays the plan made before buying. A scenario starts from where the deal actually is
// (Position today: everything paid, owed and estimated so far, interest under the real loan terms) and adds
// what is still to come under its own assumptions: the sale price and date, the total rehab, the project
// manager's fee and any other changes. mgmt.scenarios = [{ id, name, price, saleDate, rehab, pm, extras,
// main }]; until one is saved, an "Expected" scenario is derived from the analysis and the deal's dates.
const FC_MAX = 4;
const FC_STAGES = ["contract", "rehab", "market"];
// v69: a scenario's sale date can follow the rehab schedule (saleFrom: "schedule"): the rehab's finish on the
// Schedule tab (or its actual completion) plus the days to sell (sellDays: listing, days on market, closing).
// It applies under contract and in rehab, once the schedule is set up; after that the stored date stands.
const FC_SELL_DAYS = 60;
function fcSchedSale(ctx, days) {
  const st = ctx.P && ctx.P.stage;
  const r = ctx.mgmt && ctx.mgmt.rehab;
  if (!["contract", "rehab"].includes(st) || !gtIsSet(r) || !(r.milestones || []).length) return null;
  const end = r.endDate || schedOf(ctx.mgmt, ctx.today).end;
  if (!end) return null;
  const d = Math.max(0, Math.round(days == null || days === "" ? FC_SELL_DAYS : num(days)));
  return { rehabEnd: end, actual: !!r.endDate, days: d, date: addDaysISO(end, d) };
}

function fcDefaults(ctx) {
  const { m, mgmt, uw, today, position, actuals } = ctx;
  const rehabIn = actuals.filter((a) => a.cat === "Rehab / Construction").reduce((t, a) => t + amtOf(a), 0);
  const fromSched = fcSchedSale(ctx);
  return {
    price: Math.round(num(position && position.defaultPrice) || num(m.arv) || 0),
    saleDate: fromSched ? fromSched.date : finPayoffDefault(mgmt.financing || {}, mgmt, uw, today),
    saleFrom: fromSched ? "schedule" : undefined,
    sellDays: fromSched ? FC_SELL_DAYS : undefined,
    rehab: Math.round(Math.max(num(m.repair), rehabIn)),
    pm: Math.round(num(m.pmFee)),
    extras: [],
  };
}
function fcScenarios(ctx) {
  // a scenario that follows the schedule gets its sale date from it (sched: how it was worked out)
  const link = (s) => {
    if (s.saleFrom !== "schedule") return s;
    const x = fcSchedSale(ctx, s.sellDays);
    return x ? { ...s, saleDate: x.date, sched: x } : s;
  };
  const saved = ctx.mgmt.scenarios;
  if (Array.isArray(saved) && saved.length) {
    const d = fcDefaults(ctx);
    delete d.saleFrom;
    delete d.sellDays;
    return saved.map((s, i) => link({ ...d, ...s, main: saved.some((x) => x.main) ? !!s.main : i === 0 }));
  }
  return [link({ id: "expected", name: "Expected", ...fcDefaults(ctx), main: true, derived: true })];
}

// One scenario's numbers: cost by category, profit, return, break-even, months held and grade.
function fcCompute(sc, ctx) {
  const { P, actuals, mgmt, uw, sellingAt, today } = ctx;
  const catOf = (c) => P.cats.find((x) => x.cat === c) || { paid: 0, owed: 0, est: 0 };
  const tot = (c) => {
    const x = catOf(c);
    return x.paid + x.owed + x.est;
  };
  const price = num(sc.price);
  const saleDate = sc.saleDate && sc.saleDate > today ? sc.saleDate : today;
  const toSale = finDays(today, saleDate);
  const rehabIn = tot("Rehab / Construction");
  const pmIn = actuals.filter((a) => a.tag === "pm_fee").reduce((t, a) => t + amtOf(a), 0);
  const rehabToCome = Math.max(0, num(sc.rehab) - rehabIn);
  const pmToCome = Math.max(0, num(sc.pm) - pmIn);
  const months = 30.4375;
  const holdDay = num(uw.taxAnnual) / 365 + (num(uw.insMonthly) + num(uw.utilGas) + num(uw.utilWater) + num(uw.utilElec) + num(uw.hoaMonthly) + num(uw.miscHold)) / months;
  const holdToCome = holdDay * toSale;
  const extras = (sc.extras || []).reduce((t, x) => t + num(x.amount), 0);
  // interest from today to the sale under the real loan terms, plus interest on money still to be spent
  // (spread evenly until the sale) when it is borrowed: a Kappa loan, or a note not fully released yet
  const fp = P.fp;
  const fpSale = finPosition(P.L, P.inv, mgmt.draws, saleDate, P.spend);
  const borrowedToCome = P.L.kind === "kappa" ? rehabToCome + pmToCome + holdToCome + Math.max(0, extras) : P.L.accrual === "funded" ? fp.undrawn : 0;
  const futureInt = fp.started || P.L.kind === "kappa" ? (borrowedToCome * num(fp.curRate || P.L.rate) * (toSale / 2)) / 365 : 0;
  const finToCome = Math.max(0, fpSale.interestDue - fp.interestDue) + Math.max(0, fpSale.invReturn - fp.invReturn) + futureInt;
  const sellRecorded = tot("Selling");
  const sellAt = sellingAt ? sellingAt(price) : 0;
  const selling = Math.max(sellAt, sellRecorded);
  const rows = {
    acquisition: tot("Acquisition"),
    rehab: rehabIn + rehabToCome,
    pm: pmIn + pmToCome,
    holding: tot("Holding") + holdToCome,
    financing: tot("Financing") + finToCome,
    selling,
    other: tot("Services") - pmIn + tot("Other") + extras,
  };
  const total = Object.values(rows).reduce((t, v) => t + v, 0);
  const profit = price - total;
  const out = saleOutlook({ committed: total - selling + sellRecorded }, actuals, sellingAt, price);
  const close = mgmt.closing && mgmt.closing.date;
  const held = close ? finDays(close, saleDate) / months : 0;
  const g = gradeDeal({ repair: rows.rehab, holdMonths: Math.round(held * 10) / 10, netProfit: profit, purchase: num(mgmt.closing && mgmt.closing.price) || ctx.purchase, arv: price });
  return {
    price, saleDate, rows, total, profit, roc: total > 0 ? profit / total : 0, breakEven: out.breakEven, held, grade: g.grade,
    toCome: { rehab: rehabToCome, pm: pmToCome, holding: holdToCome, financing: finToCome, selling: Math.max(0, sellAt - sellRecorded), extras },
    rehabIn, pmIn,
  };
}
function fcPlan(ctx) {
  const { uwBaseline, m, holdMonths, arv, grade } = ctx;
  const p = uwBaseline ? uwBaseline.m : m;
  const rows = {
    acquisition: num(p.purchase) + num(p.totalBuying),
    rehab: num(p.repair),
    pm: num(p.pmFee),
    holding: num(p.totalHolding),
    financing: num(p.totalFinancing),
    selling: num(p.totalSelling),
    other: 0,
  };
  const total = Object.values(rows).reduce((t, v) => t + v, 0);
  const price = uwBaseline ? num(uwBaseline.inputs.arv) : num(arv);
  return { price, breakEven: saleOutlook({ committed: total - rows.selling }, [], ctx.sellingAt, price).breakEven, rows, total, profit: num(p.netProfit), roc: total > 0 ? num(p.netProfit) / total : 0, held: uwBaseline ? num(uwBaseline.inputs.holdMonths) : num(holdMonths), grade: uwBaseline ? uwBaseline.grade : grade, saved: !!uwBaseline };
}
// the scenario marked as the deal's forecast (or the derived one): what the overview's numbers strip shows
function fcMain(ctx) {
  const list = fcScenarios(ctx);
  const sc = list.find((s) => s.main) || list[0];
  return { sc, f: fcCompute(sc, ctx) };
}

const FC_ROWS = [
  ["acquisition", "Purchase and closing"],
  ["rehab", "Rehab"],
  ["pm", "Project management"],
  ["holding", "Holding"],
  ["financing", "Financing"],
  ["selling", "Selling"],
  ["other", "Other"],
];
const fcPct = (v) => `${(v * 100).toFixed(1)}%`;
const fcSigned = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));

function ForecastTab({ ctx, setMgmt, addLog }) {
  const today = ctx.today;
  const list = fcScenarios(ctx);
  const plan = fcPlan(ctx);
  const res = list.map((sc) => ({ sc, f: fcCompute(sc, ctx) }));
  const main = res.find((r) => r.sc.main) || res[0];
  // the first change saves the scenarios with the deal (the derived "Expected" one included)
  const save = (fn) =>
    setMgmt((mm) => {
      const cur = Array.isArray(mm.scenarios) && mm.scenarios.length ? mm.scenarios : list.map(({ derived, sched, ...s }) => ({ ...s, id: s.id === "expected" ? uid() : s.id }));
      return { ...mm, scenarios: fn(cur) };
    });
  const upd = (i, patch) => save((cur) => cur.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  // a new scenario starts from the forecast one; Duplicate copies the one it is on
  const add = (from) =>
    save((cur) => {
      if (cur.length >= FC_MAX) return cur;
      const base = { ...(from || main.sc) };
      delete base.derived;
      delete base.sched;
      const names = ["Conservative", "Best case", "Worst case", "Scenario"];
      const name = from ? `${from.name} (copy)` : names.find((n) => !cur.some((s) => s.name === n)) || `Scenario ${cur.length + 1}`;
      return [...cur, { ...base, id: uid(), name, main: false, extras: (base.extras || []).map((x) => ({ ...x, id: uid() })) }];
    });
  const remove = (i) =>
    save((cur) => {
      const next = cur.filter((_, j) => j !== i);
      if (next.length && !next.some((s) => s.main)) next[0] = { ...next[0], main: true };
      return next;
    });
  const setMain = (i) => {
    save((cur) => cur.map((s, j) => ({ ...s, main: j === i })));
    addLog && addLog(`Forecast set to the "${list[i].name}" scenario`);
  };
  const reset = (i) => upd(i, fcDefaults(ctx));
  const schedAvail = fcSchedSale(ctx);
  // sensitivity of the forecast scenario: sale price × rehab
  const priceSteps = [-0.1, -0.05, 0, 0.05];
  const rehabSteps = [0, 0.1, 0.2];
  const grid = rehabSteps.map((r) => priceSteps.map((p) => fcCompute({ ...main.sc, price: main.f.price * (1 + p), rehab: num(main.sc.rehab) * (1 + r) }, ctx).profit));
  const perK = fcCompute({ ...main.sc, price: main.f.price - 5000 }, ctx).profit - main.f.profit;
  const perDay = fcCompute({ ...main.sc, saleDate: addDaysISO(main.f.saleDate, 30) }, ctx).profit - main.f.profit;
  return (
    <div className="fc">
      <div className="fc-head">
        <span className="dp-ico t-green fc-head-ico">
          <Icon name="trend" size={20} stroke={2} />
        </span>
        <div className="fc-head-t">
          <h2>Forecast</h2>
          <p>What the deal makes from here: the actual costs so far, plus each scenario's assumptions until the sale. The Flip analysis stays the plan you bought on.</p>
        </div>
        {list.length < FC_MAX && (
          <button style={btnGhost()} onClick={() => add(null)}>
            <Icon name="plus" size={14} /> Add scenario
          </button>
        )}
      </div>

      <div className="fc-cards">
        {res.map(({ sc, f }, i) => (
          <section key={sc.id} className={"dcard fc-card" + (sc.main ? " main" : "")}>
            <div className="fc-card-h">
              <FinText value={sc.name} onCommit={(v) => upd(i, { name: v || sc.name })} aria-label="Scenario name" className="fc-name" />
              {sc.main ? (
                <span className="fc-main">Forecast</span>
              ) : (
                <button className="link-btn fc-use" onClick={() => setMain(i)} title="Show this scenario on the project overview">
                  Use as forecast
                </button>
              )}
            </div>
            <div className={"fc-profit " + gradeTone(f.grade)}>
              <span>Net profit</span>
              <b className={f.profit < 0 ? "neg" : ""}>{fmt(f.profit)}</b>
              <em className={f.profit - plan.profit < 0 ? "neg" : "pos"}>{fcSigned(f.profit - plan.profit)} vs plan · grade {f.grade}</em>
            </div>
            <div className="fc-fields">
              <label>
                Sale price
                <FinNum value={sc.price} onCommit={(v) => upd(i, { price: v })} prefix="$" label="Sale price" />
              </label>
              <label>
                Sale date
                <input type="date" value={sc.saleDate || ""} onChange={(e) => e.target.value && upd(i, { saleDate: e.target.value, saleFrom: undefined })} aria-label="Sale date" />
              </label>
              {sc.sched ? (
                <div className="fc-sched on">
                  <Icon name="gantt" size={14} />
                  <span>
                    Rehab {sc.sched.actual ? "finished" : "ends"} {fmtDateShort(sc.sched.rehabEnd)}
                    {sc.sched.actual ? "" : " on the schedule"} +
                  </span>
                  <FinNum value={sc.sched.days} onCommit={(v) => upd(i, { sellDays: Math.max(0, Math.round(v)) })} suffix="days" label="Days to sell" />
                  <span>to sell</span>
                  <button className="link-btn fc-sched-off" onClick={() => upd(i, { saleFrom: undefined, saleDate: sc.saleDate })} title="Keep this date and stop following the schedule">
                    Unlink
                  </button>
                </div>
              ) : schedAvail ? (
                <div className="fc-sched">
                  <Icon name="gantt" size={14} />
                  <button
                    className="link-btn fc-sched-use"
                    onClick={() => upd(i, { saleFrom: "schedule", sellDays: num(sc.sellDays) > 0 ? sc.sellDays : FC_SELL_DAYS, saleDate: fcSchedSale(ctx, num(sc.sellDays) > 0 ? sc.sellDays : FC_SELL_DAYS).date })}
                  >
                    From the schedule: {fmtDate(fcSchedSale(ctx, num(sc.sellDays) > 0 ? sc.sellDays : FC_SELL_DAYS).date)}
                  </button>
                  <span>
                    rehab ends {fmtDateShort(schedAvail.rehabEnd)} + {num(sc.sellDays) > 0 ? sc.sellDays : FC_SELL_DAYS} days to sell
                  </span>
                </div>
              ) : null}
              <label>
                Rehab, total
                <FinNum value={sc.rehab} onCommit={(v) => upd(i, { rehab: v })} prefix="$" label="Rehab, total" />
                <span className="fin-hint">{fmt(f.rehabIn)} spent so far{num(sc.rehab) < f.rehabIn ? ", more than this" : ""}</span>
              </label>
              <label>
                Project management
                <FinNum value={sc.pm} onCommit={(v) => upd(i, { pm: v })} prefix="$" label="Project management" />
                <span className="fin-hint">{fmt(f.pmIn)} paid so far</span>
              </label>
            </div>
            <div className="fc-extras">
              {(sc.extras || []).map((x) => (
                <div key={x.id} className="fc-extra">
                  <FinText value={x.label} onCommit={(v) => upd(i, { extras: sc.extras.map((y) => (y.id === x.id ? { ...y, label: v } : y)) })} placeholder="What changes" aria-label="Change" />
                  <FinNum value={x.amount} onCommit={(v) => upd(i, { extras: sc.extras.map((y) => (y.id === x.id ? { ...y, amount: v } : y)) })} prefix="$" label="Change amount" />
                  <button className="fin-x" aria-label="Remove change" onClick={() => upd(i, { extras: sc.extras.filter((y) => y.id !== x.id) })}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              <button className="link-btn fc-addx" onClick={() => upd(i, { extras: [...(sc.extras || []), { id: uid(), label: "", amount: 0 }] })}>
                <Icon name="plus" size={13} /> Other change (a cost, or a negative amount for a saving)
              </button>
            </div>
            <div className="fc-card-f">
              {!sc.derived && (
                <button className="link-btn" onClick={() => reset(i)} title="Back to the Flip analysis numbers and the deal's dates">
                  Reset
                </button>
              )}
              {list.length < FC_MAX && (
                <button className="link-btn" onClick={() => add(sc)}>
                  Duplicate
                </button>
              )}
              {list.length > 1 && (
                <button className="link-btn fc-del" onClick={() => remove(i)}>
                  Delete
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="dcard fc-cmp">
        <div className="dcard-h">
          <Icon name="calc" /> Compare
          <span className="dcard-r">{plan.saved ? "against the plan saved at analysis" : "against the current Flip analysis (no plan saved)"}</span>
        </div>
        <div className="fc-tbl-wrap">
          <table className="fc-tbl">
            <thead>
              <tr>
                <th />
                <th>Plan</th>
                {res.map(({ sc }) => (
                  <th key={sc.id} className={sc.main ? "main" : ""}>
                    {sc.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="fc-price">
                <td>Sale price</td>
                <td>{fmt(plan.price)}</td>
                {res.map(({ sc, f }) => (
                  <td key={sc.id}>{fmt(f.price)}</td>
                ))}
              </tr>
              {FC_ROWS.map(([k, l]) => (
                <tr key={k}>
                  <td>{l}</td>
                  <td>{plan.rows[k] ? fmt(plan.rows[k]) : "—"}</td>
                  {res.map(({ sc, f }) => {
                    const d = f.rows[k] - plan.rows[k];
                    return (
                      <td key={sc.id}>
                        {f.rows[k] ? fmt(f.rows[k]) : "—"}
                        {Math.abs(d) >= 1 && <em className={d > 0 ? "neg" : "pos"}>{fcSigned(d)}</em>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="fc-sum">
                <td>Total cost</td>
                <td>{fmt(plan.total)}</td>
                {res.map(({ sc, f }) => (
                  <td key={sc.id}>{fmt(f.total)}</td>
                ))}
              </tr>
              <tr className="fc-net">
                <td>Net profit</td>
                <td>{fmt(plan.profit)}</td>
                {res.map(({ sc, f }) => (
                  <td key={sc.id} className={f.profit < 0 ? "neg" : ""}>
                    {fmt(f.profit)}
                    <em className={f.profit - plan.profit < 0 ? "neg" : "pos"}>{fcSigned(f.profit - plan.profit)}</em>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Return on cost</td>
                <td>{fcPct(plan.roc)}</td>
                {res.map(({ sc, f }) => (
                  <td key={sc.id}>{fcPct(f.roc)}</td>
                ))}
              </tr>
              <tr>
                <td>Break-even sale price</td>
                <td>{fmt(plan.breakEven)}</td>
                {res.map(({ sc, f }) => (
                  <td key={sc.id}>{fmt(f.breakEven)}</td>
                ))}
              </tr>
              <tr>
                <td>Months held</td>
                <td>{plan.held.toFixed(1)}</td>
                {res.map(({ sc, f }) => (
                  <td key={sc.id}>
                    {f.held.toFixed(1)}
                    <em className="dim">sale {fmtDate(f.saleDate)}</em>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Grade</td>
                <td>
                  <span className={"fc-grade " + gradeTone(plan.grade)}>{plan.grade}</span>
                </td>
                {res.map(({ sc, f }) => (
                  <td key={sc.id}>
                    <span className={"fc-grade " + gradeTone(f.grade)}>{f.grade}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="fc-note">
          Costs so far are the actual ones (paid, owed, and estimates for holding costs not recorded). From today each scenario adds the rehab and project management still to pay, holding and interest
          until its sale date (interest under the deal's Financing terms), and selling costs at its price.
        </div>
      </section>

      <section className="dcard fc-sens">
        <div className="dcard-h">
          <Icon name="chart" /> Sensitivity: {main.sc.name}
          <span className="dcard-r">net profit</span>
        </div>
        <div className="fc-tbl-wrap">
          <table className="fc-tbl fc-grid">
            <thead>
              <tr>
                <th>Rehab ↓ · Sale price →</th>
                {priceSteps.map((p) => (
                  <th key={p}>
                    {fmt(main.f.price * (1 + p))}
                    <em>{p ? `${p > 0 ? "+" : "−"}${Math.abs(p * 100)}%` : "as set"}</em>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rehabSteps.map((r, ri) => (
                <tr key={r}>
                  <td>
                    {fmt(num(main.sc.rehab) * (1 + r))}
                    <em>{r ? `+${r * 100}%` : "as set"}</em>
                  </td>
                  {grid[ri].map((v, pi) => (
                    <td key={pi} className={(v < 0 ? "neg " : v < plan.profit * 0.5 ? "warn " : "") + (r === 0 && priceSteps[pi] === 0 ? "base" : "")}>
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fc-note">
          Each $5,000 off the sale price costs {fmt(Math.abs(perK))} of profit; selling 30 days later than {fmtDate(main.f.saleDate)} costs {fmt(Math.abs(perDay))} in interest and holding.
        </div>
      </section>
    </div>
  );
}
