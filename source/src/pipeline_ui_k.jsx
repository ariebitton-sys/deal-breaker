// ============================================================================
// v56 — POSITION TODAY: every cost the deal is committed to as of today, paid or not
// ============================================================================
// Three layers: the ledger (each entry paid or marked "not paid"), what is owed under the financing terms
// (lender interest to date, lender fees due at payoff, investor returns), and estimates for holding costs
// nothing has been recorded for yet (property tax, insurance, utilities, HOA). Estimates can be left out.
const POS_SKIP_KEY = "positionSkip";
const isTaxEntry = (a) => /tax/i.test(a.label || "");
const isInsEntry = (a) => /insur/i.test(a.label || "");
const isUtilEntry = (a) => /util|electric|\bgas\b|water|sewer|trash/i.test(a.label || "");
const isHoaEntry = (a) => /\bhoa\b|association/i.test(a.label || "");

function positionToday({ actuals, mgmt, uw, m, stage, today }) {
  const sold = stage === "sold";
  const close = (mgmt.closing && mgmt.closing.date) || "";
  const skip = new Set((mgmt.position && mgmt.position[POS_SKIP_KEY]) || []);
  const byCat = {};
  const cat = (c) => (byCat[c] = byCat[c] || { cat: c, paid: 0, owed: 0, est: 0 });
  let paid = 0;
  const owed = [];
  actuals.forEach((a) => {
    const v = amtOf(a);
    if (a.unpaid) {
      cat(a.cat).owed += v;
      owed.push({ key: "e" + a.id, src: "Ledger", id: a.id, cat: a.cat, label: entryTitle(a).title, date: a.date || "", amount: v });
    } else {
      cat(a.cat).paid += v;
      paid += v;
    }
  });
  // owed under the financing terms (a sold deal's payoffs are on the sale statement, so not counted again)
  const fin = mgmt.financing || {};
  const L = finLenderOf(fin, uw, m, mgmt);
  const inv = finInvestorsOf(fin, uw, m, mgmt);
  const spend = finSpend(actuals);
  const fp = finPosition(L, inv, mgmt.draws, today, spend);
  if (!sold && fp.started) {
    if (fp.interestDue > 0.005) {
      owed.push({ key: "int", src: "Financing", cat: "Financing", label: `Lender interest to date${L.name ? `, ${L.name}` : ""}`, detail: fp.lines.map((x) => `${fmt(x.amount)} since ${fmtDate(x.date)}`).join(", "), amount: fp.interestDue });
      cat("Financing").owed += fp.interestDue;
    }
    if (fp.feesDue > 0.005) {
      owed.push({ key: "fees", src: "Financing", cat: "Financing", label: "Lender fees due at payoff", detail: (L.fees || []).filter((f) => !f.paid).map((f) => f.label).join(", "), amount: fp.feesDue });
      cat("Financing").owed += fp.feesDue;
    }
    fp.inv
      .filter((x) => x.open && x.ret > 0.005)
      .forEach((x) => {
        owed.push({ key: "inv" + x.id, src: "Financing", cat: "Financing", label: `Investor return${x.name ? `, ${x.name}` : ""}`, detail: `${fmt(num(x.amount))} at ${finPctLabel(x.rate)}${x.basis === "annual" ? " a year" : " flat"}`, amount: x.ret });
        cat("Financing").owed += x.ret;
      });
  }
  // holding costs nothing has been recorded for yet, from the Flip analysis, since the purchase closed
  const est = [];
  if (!sold && close && close <= today) {
    const days = finDays(close, today);
    const months = days / 30.4375;
    const H = actuals.filter((a) => a.cat === "Holding");
    const sum = (xs) => xs.reduce((t, a) => t + amtOf(a), 0);
    const credits = -sum(H.filter((a) => isTaxEntry(a) && amtOf(a) < 0));
    const taxPaid = sum(H.filter((a) => isTaxEntry(a) && amtOf(a) > 0 && (a.date || today) >= close));
    const own = (num(uw.taxAnnual) * days) / 365;
    const push = (key, label, amount, detail) => amount > 0.5 && est.push({ key, label, amount, detail, on: !skip.has(key) });
    push("tax", "Property tax owed, not billed yet", Math.max(0, own + credits - taxPaid), `${fmt(own)} for the ${days} days since closing${credits > 0 ? ` + ${fmt(credits)} the seller credited at closing for their share` : ""}${taxPaid > 0 ? ` − ${fmt(taxPaid)} paid` : ""}`);
    const ins = sum(H.filter((a) => isInsEntry(a) && amtOf(a) > 0));
    push("ins", "Insurance since closing", Math.max(0, num(uw.insMonthly) * months - ins), `${fmt(num(uw.insMonthly))} a month × ${months.toFixed(1)} months${ins > 0 ? ` − ${fmt(ins)} recorded` : ", nothing recorded"}`);
    const utilMonthly = num(uw.utilGas) + num(uw.utilWater) + num(uw.utilElec);
    const util = sum(H.filter((a) => isUtilEntry(a) && amtOf(a) > 0));
    push("util", "Utilities since closing", Math.max(0, utilMonthly * months - util), `${fmt(utilMonthly)} a month × ${months.toFixed(1)} months${util > 0 ? ` − ${fmt(util)} recorded` : ", nothing recorded"}`);
    const hoa = sum(H.filter((a) => isHoaEntry(a) && amtOf(a) > 0));
    push("hoa", "HOA since closing", Math.max(0, num(uw.hoaMonthly) * months - hoa), `${fmt(num(uw.hoaMonthly))} a month × ${months.toFixed(1)} months${hoa > 0 ? ` − ${fmt(hoa)} recorded` : ""}`);
    est.filter((e) => e.on).forEach((e) => (cat("Holding").est += e.amount));
  }
  const owedTotal = owed.reduce((t, x) => t + x.amount, 0);
  const estTotal = est.filter((e) => e.on).reduce((t, x) => t + x.amount, 0);
  const cats = ACTUAL_CATS.filter((c) => byCat[c]).map((c) => byCat[c]);
  return {
    sold, today, paid, owed, owedTotal, est, estTotal, cats, fp, L, inv, spend,
    committed: paid + owedTotal + estTotal,
    lenderIn: fp.principal,
    investorsIn: fp.invIn,
    kappaIn: paid - fp.principal - fp.invIn,
    unpaidLedger: owed.filter((x) => x.src === "Ledger").reduce((t, x) => t + x.amount, 0),
  };
}

// Against a sale price: selling costs still to come (Flip analysis rates, less what the ledger already has),
// profit if nothing more is spent, and the break-even price.
function saleOutlook(P, actuals, sellingAt, price) {
  const sellRecorded = actuals.filter((a) => a.cat === "Selling").reduce((t, a) => t + amtOf(a), 0);
  const sell = (v) => (sellingAt ? sellingAt(v) : 0);
  const sellToCome = Math.max(0, sell(price) - sellRecorded);
  const ref = price > 0 ? price : 100000;
  const a0 = sell(0),
    slope = (sell(ref) - a0) / ref;
  const breakEven = slope < 1 ? Math.max(P.committed, (P.committed + a0 - sellRecorded) / (1 - slope)) : P.committed;
  return { sellRecorded, sellToCome, left: price - sellToCome - P.committed, breakEven };
}

// ---------- the numbers strip at the top of the project overview ----------
function KpiStrip({ P, uw, m, uwBaseline, grade, actuals, position, mgmt, actualSale, stage, today }) {
  const close = (mgmt.closing && mgmt.closing.date) || "";
  if (!close || close > today || stage === "dead") return null;
  const plan = uwBaseline ? uwBaseline.m.netProfit : m.netProfit;
  const planGrade = uwBaseline ? uwBaseline.grade : grade;
  const planHint = uwBaseline ? `Grade ${planGrade}, saved ${fmtDate(uwBaseline.date)}` : `Grade ${planGrade}, current analysis, plan not saved`;
  const end = stage === "sold" && mgmt.sale.date ? mgmt.sale.date : today;
  const held = finDays(close, end);
  const plannedDays = Math.round(num(uw.holdMonths) * 30.4375);
  const heldHint = `Day ${held}${plannedDays ? ` of ${plannedDays} planned` : ""}`;
  const over = plannedDays > 0 && held > plannedDays;
  const signed = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));
  const tiles = [];
  const tile = (k, v, h, tone, htone) => tiles.push({ k, v, h, tone, htone });
  if (stage === "sold") {
    const spent = actuals.reduce((t, a) => t + amtOf(a), 0);
    const actual = num(actualSale) - spent;
    const finCost = actuals.filter((a) => a.cat === "Financing").reduce((t, a) => t + amtOf(a), 0);
    tile("Profit at analysis", fmt(plan), planHint);
    tile("Actual profit", fmt(actual), `${signed(actual - plan)} vs plan`, actual < 0 ? "neg" : "", actual - plan < 0 ? "neg" : "pos");
    tile("Sold for", num(actualSale) > 0 ? fmt(num(actualSale)) : "—", mgmt.sale.date ? fmtDate(mgmt.sale.date) : "");
    tile("Total spent", fmt(spent), `${actuals.length} ledger entries`);
    tile("Financing cost", fmt(finCost), "interest, fees and investor returns in the ledger");
    tile("Days held", String(held), plannedDays ? `${plannedDays} planned` : "", over ? "warn" : "");
  } else {
    const fp = P.fp;
    const months = 30.4375;
    const holdDay = num(uw.taxAnnual) / 365 + (num(uw.insMonthly) + num(uw.utilGas) + num(uw.utilWater) + num(uw.utilElec) + num(uw.hoaMonthly)) / months;
    const intDay = fp.started ? fp.perDay + fp.invPerMonth / months : 0;
    tile("Profit at analysis", fmt(plan), planHint);
    tile("Spent so far", fmt(P.paid), P.owedTotal > 0.5 ? `+ ${fmt(P.owedTotal)} owed, not paid yet` : "Nothing owed");
    tile("Paying interest on", fp.started && fp.accruingOn > 0 ? fmt(fp.accruingOn) : "—", fp.started && fp.accruingOn > 0 ? `${finPctLabel(fp.curRate / 12)} a month, ${fmt2(fp.perDay)} a day` : "No loan accruing", fp.pastMaturity ? "neg" : "");
    if (position) {
      // projected to the expected sale: what is committed today, plus the rehab budget not used yet (the current
      // Flip analysis estimate) and interest and holding costs from today to the sale date
      const price = num(position.defaultPrice);
      const saleOn = finPayoffDefault(mgmt.financing || {}, mgmt, uw, today);
      const toSale = finDays(today, saleOn);
      const rehabIn = actuals.filter((a) => a.cat === "Rehab / Construction").reduce((t, a) => t + amtOf(a), 0);
      const rehabToCome = mgmt.rehab && mgmt.rehab.endDate ? 0 : Math.max(0, num(m.repair) - rehabIn);
      const fpSale = finPosition(P.L, P.inv, mgmt.draws, saleOn, P.spend);
      const finToCome = Math.max(0, fpSale.interestDue - fp.interestDue) + Math.max(0, fpSale.invReturn - fp.invReturn);
      const holdToCome = holdDay * toSale;
      const out = saleOutlook({ ...P, committed: P.committed + rehabToCome + finToCome + holdToCome }, actuals, position.sellingAt, price);
      const why = `${fmt(price)} sale on ${fmtDate(saleOn)} − ${fmt(out.sellToCome)} selling − ${fmt(P.committed)} committed today${rehabToCome > 0 ? ` − ${fmt(rehabToCome)} rehab budget left` : ""} − ${fmt(finToCome + holdToCome)} interest and holding until the sale`;
      tiles.push({ k: "Projected profit at sale", v: fmt(out.left), h: `${signed(out.left - plan)} vs plan, sale ${fmtDate(saleOn)}`, tone: out.left < 0 ? "neg" : "", htone: out.left - plan < 0 ? "neg" : "pos", title: why });
      tile("Break-even price", fmt(out.breakEven), price > 0 ? `${signed(price - out.breakEven)} cushion at ${fmt(price)}` : "", "", price < out.breakEven ? "neg" : "");
    }
    tile("Each extra day costs", fmt(intDay + holdDay), heldHint, "", over ? "warn" : "");
  }
  return (
    <div className="kpi-strip" role="list">
      {tiles.map((x) => (
        <div key={x.k} className="kpi-tile" role="listitem" title={x.title}>
          <span className="kpi-k">{x.k}</span>
          <b className={"kpi-v" + (x.tone ? " " + x.tone : "")}>{x.v}</b>
          {x.h && <span className={"kpi-h" + (x.htone ? " " + x.htone : "")}>{x.h}</span>}
        </div>
      ))}
    </div>
  );
}

// ---------- the statement window ----------
function PositionWindow({ uw, sellingAt, defaultPrice, actuals, mgmt, m, stage, setActuals, setMgmt, onClose }) {
  const today = todayISO();
  const P = positionToday({ actuals, mgmt, uw, m, stage, today });
  const [price, setPrice] = useState(() => Math.round(defaultPrice || 0));
  useEffect(() => {
    const k = (e) => (e.key === "Escape" ? onClose() : null);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  const toggleEst = (key) =>
    setMgmt((mm) => {
      const cur = new Set((mm.position && mm.position[POS_SKIP_KEY]) || []);
      cur.has(key) ? cur.delete(key) : cur.add(key);
      return { ...mm, position: { ...(mm.position || {}), [POS_SKIP_KEY]: [...cur] } };
    });
  const markPaid = (id) => setActuals((prev) => prev.map((a) => (a.id === id ? { ...a, unpaid: undefined } : a)));
  // against the sale: selling costs at that price (Flip analysis rates) less what is already in the ledger
  const { sellRecorded, sellToCome, left, breakEven } = saleOutlook(P, actuals, sellingAt, price);
  const fp = P.fp;
  const lenderPay = P.sold ? 0 : fp.lenderPayoff;
  const invPay = P.sold ? 0 : fp.invDue;
  const cashBack = price - sellToCome - lenderPay - invPay - P.unpaidLedger - P.estTotal;
  const row = (label, v, cls, sign) => (
    <div className={"xw-item fin-row" + (cls ? " " + cls : "")}>
      <span className="xw-item-l">{label}</span>
      <span className="xw-item-a">
        {sign || ""}
        {fmt(Math.abs(v))}
      </span>
    </div>
  );
  return (
    <div className="xw-back no-print" onClick={onClose}>
      <div className="xw fin-w pos-w" role="dialog" aria-label="Position today" onClick={(e) => e.stopPropagation()}>
        <header className="xw-h">
          <div className="xw-h-txt">
            <span className="xw-k">Position today · {fmtDate(today)}</span>
            <h3>What the deal is committed to</h3>
            <p className="xw-sub">
              {P.sold ? "Everything in the ledger, paid or not. The deal is sold, so the payoffs are on the sale statement." : "Everything in the ledger, paid or not, plus what is owed under the financing terms and estimates for holding costs that nothing has been recorded for yet."}
            </p>
          </div>
          <button className="dv-x" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="xw-hero">
          <div>
            <span>Committed to date</span>
            <b>{fmt(P.committed)}</b>
          </div>
          <div>
            <span>Paid</span>
            <b>{fmt(P.paid)}</b>
          </div>
          <div>
            <span>Owed, not paid yet</span>
            <b>{fmt(P.owedTotal)}</b>
          </div>
          <div>
            <span>Estimated, not recorded</span>
            <b>{fmt(P.estTotal)}</b>
          </div>
        </div>
        <div className="xw-body">
          <section className="xw-sec">
            <div className="xw-sec-h">By category</div>
            <div className="pos-tbl">
              <div className="pos-tr pos-th">
                <span>Category</span>
                <span>Paid</span>
                <span>Not paid yet</span>
                <span>Estimated</span>
                <span>Total</span>
              </div>
              {P.cats.map((c) => (
                <div key={c.cat} className="pos-tr">
                  <span>{c.cat}</span>
                  <span>{c.paid ? fmt(c.paid) : "—"}</span>
                  <span className={c.owed ? "owed" : ""}>{c.owed ? fmt(c.owed) : "—"}</span>
                  <span>{c.est ? fmt(c.est) : "—"}</span>
                  <b>{fmt(c.paid + c.owed + c.est)}</b>
                </div>
              ))}
              <div className="pos-tr pos-tot">
                <span>Total</span>
                <span>{fmt(P.paid)}</span>
                <span>{fmt(P.owedTotal)}</span>
                <span>{fmt(P.estTotal)}</span>
                <b>{fmt(P.committed)}</b>
              </div>
            </div>
          </section>

          <section className="xw-sec">
            <div className="xw-sec-h">
              Owed, not paid yet <em>{P.owed.length ? fmt(P.owedTotal) : ""}</em>
            </div>
            {P.owed.length === 0 ? (
              <div className="dcard-empty">Nothing. Mark a ledger expense "Not paid yet" when a bill comes in before you pay it.</div>
            ) : (
              <div className="xw-items">
                {P.owed.map((x) => (
                  <div key={x.key} className="xw-item pos-owed">
                    <span className={"pos-src" + (x.src === "Ledger" ? "" : " fin")}>{x.src}</span>
                    <span className="xw-item-l">
                      {x.label}
                      <em>{x.detail || [x.date ? fmtDate(x.date) : "", catShort(x.cat)].filter(Boolean).join(" · ")}</em>
                    </span>
                    {x.src === "Ledger" ? (
                      <button className="link-btn pos-paid" onClick={() => markPaid(x.id)}>
                        Mark paid
                      </button>
                    ) : (
                      <span />
                    )}
                    <span className="xw-item-a">{fmt(x.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {!P.sold && (
            <section className="xw-sec">
              <div className="xw-sec-h">
                Estimated, not recorded <em>from the Flip analysis, since closing</em>
              </div>
              {P.est.length === 0 ? (
                <div className="dcard-empty">{mgmt.closing && mgmt.closing.date ? "Nothing to estimate: the holding costs are recorded." : "Starts once the purchase has closed."}</div>
              ) : (
                <div className="xw-items">
                  {P.est.map((x) => (
                    <label key={x.key} className={"xw-item pos-est" + (x.on ? "" : " off")}>
                      <input type="checkbox" checked={x.on} onChange={() => toggleEst(x.key)} aria-label={`Count ${x.label}`} />
                      <span className="xw-item-l">
                        {x.label}
                        <em>{x.detail}</em>
                      </span>
                      <span className="xw-item-a">{fmt(x.amount)}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="xw-hint">Record the real bill in the ledger (Holding) and the estimate drops by that amount. Untick a line to leave it out.</div>
            </section>
          )}

          <section className="xw-sec">
            <div className="xw-sec-h">Where the money paid so far came from</div>
            <div className="xw-items">
              {row(P.L.name || "Lender", P.lenderIn)}
              {row("Investors", P.investorsIn)}
              {P.kappaIn >= 0 ? row("Kappa", P.kappaIn) : row("Loan and investor money not spent yet", P.kappaIn, "", "−")}
              {row("Paid", P.paid, "sum")}
            </div>
          </section>

          {!P.sold && (
            <section className="xw-sec">
              <div className="xw-sec-h">Against the sale</div>
              <div className="fin-payoff">
                <span>Sale price</span>
                <FinNum value={price} onCommit={(v) => setPrice(v)} prefix="$" label="Sale price" />
              </div>
              <div className="xw-items">
                {row("Sale price", price)}
                {row(`Selling costs still to come${sellRecorded > 0 ? `, after ${fmt(sellRecorded)} recorded` : ""}`, sellToCome, "", "−")}
                {row("Committed to date", P.committed, "", "−")}
                {row(left >= 0 ? "Profit, if nothing more is spent" : "Loss, if nothing more is spent", left, "sum" + (left < 0 ? " neg" : ""), left < 0 ? "−" : "")}
              </div>
              <div className="pos-be">
                Break-even sale price today: <b>{fmt(breakEven)}</b>
              </div>
              <div className="xw-items" style={{ marginTop: 12 }}>
                {row("Pay the lender off today", lenderPay, "", "−")}
                {invPay > 0 && row("Pay the investors back", invPay, "", "−")}
                {P.unpaidLedger > 0 && row("Pay the open bills", P.unpaidLedger, "", "−")}
                {P.estTotal > 0 && row("Settle the estimated holding costs", P.estTotal, "", "−")}
                {row(`Cash back to Kappa${P.kappaIn > 0 ? ` (Kappa has put in ${fmt(P.kappaIn)})` : ""}`, cashBack, "sum" + (cashBack < 0 ? " neg" : ""), cashBack < 0 ? "−" : "")}
              </div>
              <div className="xw-hint">At this price, after the costs committed so far. Interest, holding costs and any rehab from today until the sale come off these numbers.</div>
            </section>
          )}
        </div>
        <footer className="xw-f">
          <span className="fin-foot">Paid and not paid come from the ledger; owed amounts from the Financing terms.</span>
          <button style={btnPrimary()} onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
