// ============================================================================
// v26 — PIPELINE UI (part B): Portfolio home screen
// ============================================================================
function cardRows(s, today) {
  const st = s.st;
  if (st === "analyzing")
    return [
      ["Projected profit", fmt(s.np), s.np > 0 ? T.green : T.red],
      ["Buy / ARV", `${fmtK(s.pp)} / ${fmtK(s.arv)}`],
      s.oa ? ["Last offer", `${fmt(s.oa)}${s.os ? `, ${s.os}` : ""}`] : ["Source", s.src || "—"],
    ];
  if (st === "contract") {
    const dc = daysBetween(today, s.ecd);
    return [
      ["Closing", s.ecd ? `${fmtDateShort(s.ecd)}, ${relDays(dc)}` : "—", dc != null && dc < 0 ? T.red : dc != null && dc <= 7 ? T.amber : null],
      ["Contract price", fmt(s.cp || s.pp)],
      ["Projected profit", fmt(s.np), s.np > 0 ? T.green : T.red],
    ];
  }
  if (st === "market") {
    const dom = daysBetween(s.ld, today);
    return [
      ["On market", dom != null ? `${dom} day${dom === 1 ? "" : "s"}` : "—", dom > 60 ? T.red : dom > 30 ? T.amber : null],
      ["List price", s.olp && s.olp !== s.lp ? `${fmt(s.lp)} (was ${fmtK(s.olp)})` : fmt(s.lp)],
      s.bcd ? ["Sale pending", s.bec ? `closing ${fmtDateShort(s.bec)}` : "under contract", T.green] : ["Projected profit", fmt(s.np), s.np > 0 ? T.green : T.red],
    ];
  }
  if (st === "sold") {
    const plan = s.bnp != null ? s.bnp : s.np;
    const v = s.ap != null && plan != null ? s.ap - plan : null;
    const months = s.acd && s.sd ? monthsBetween(s.acd, s.sd) : null;
    return [
      ["Actual profit", s.ap != null ? fmt(s.ap) : "—", s.ap > 0 ? T.green : T.red],
      ["vs plan", v != null ? (v >= 0 ? "+" : "") + fmt(v) : "—", v != null ? (v >= 0 ? T.green : T.red) : null],
      ["Sold", `${fmtDate(s.sd)}${months != null ? `, ${months.toFixed(1)} mo` : ""}`],
    ];
  }
  if (st === "dead")
    return [
      ["Reason", s.dr || "—"],
      ["Since", fmtDate(s.dd)],
      ["Was", stageMeta(s.dfs || "analyzing").label],
    ];
  return [];
}
function DealCard({ d, today, onOpen }) {
  const s = d.s;
  if (!s)
    return (
      <div className="deal-card is-loading">
        <div className="dc-street">{d.street}</div>
        <div className="dc-city">{d.city}</div>
        <div className="dc-foot">Reading…</div>
      </div>
    );
  const meta = stageMeta(s.st);
  const att = d.att;
  const spentPct = s.rb > 0 ? Math.round(((s.rsp || 0) / s.rb) * 100) : null;
  const rehabDay = s.st === "rehab" ? daysBetween(s.rs || s.acd, today) : null;
  const rehabPlan = s.st === "rehab" ? daysBetween(s.rs || s.acd, s.rte) : null;
  const u = d.f.lastModifyingUser;
  const red = att.some((a) => a.lvl === "red");
  return (
    <button onClick={() => onOpen(d.f)} className="deal-card">
      <div className="dc-top">
        <span className="dc-stage">
          <i style={{ background: meta.color }} />
          {meta.label}
        </span>
        {att.length > 0 && (
          <span className={"dc-alert" + (red ? " red" : "")} title={att.map((a) => a.text).join("\n")}>
            {att.length} {att.length === 1 ? "alert" : "alerts"}
          </span>
        )}
        <span className="dc-grade" style={{ color: s.gr === "REJECT" ? T.red : T.txt }}>
          {s.gr === "REJECT" ? "Reject" : s.gr}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="dc-street">{d.street}</div>
        <div className="dc-city">{d.city || " "}</div>
      </div>
      {s.st === "rehab" ? (
        <div className="dc-rows">
          <div className="dc-meter">
            <div className="dc-row">
              <span>Budget used</span>
              <b style={{ color: spentPct > 110 ? T.red : spentPct > 100 ? T.amber : undefined }}>
                {spentPct != null ? `${fmtK(s.rsp || 0)} of ${fmtK(s.rb)}` : "—"}
              </b>
            </div>
            <Bar pct={spentPct} color={spentPct > 110 ? T.red : spentPct > 100 ? T.amber : T.navy} marker={s.mp} h={4} />
          </div>
          <div className="dc-meter">
            <div className="dc-row">
              <span>Work complete</span>
              <b>{s.mp != null ? `${s.mp}%` : "—"}</b>
            </div>
            <Bar pct={s.mp} color={T.green} h={4} />
          </div>
          <div className="dc-row">
            <span>Schedule</span>
            <b style={{ color: rehabPlan != null && rehabDay > rehabPlan ? T.red : undefined }}>
              {rehabDay != null ? `Day ${Math.max(0, rehabDay)}${rehabPlan ? ` of ${rehabPlan}` : ""}` : "—"}
            </b>
          </div>
        </div>
      ) : (
        <div className="dc-rows">
          {cardRows(s, today).map(([k, v, c]) => (
            <div key={k} className="dc-row">
              <span>{k}</span>
              <b style={{ color: c === T.green ? undefined : c || undefined }}>{v}</b>
            </div>
          ))}
        </div>
      )}
      <div className="dc-foot">
        Updated {d.f.modifiedTime ? fmtDateShort(isoOf(new Date(d.f.modifiedTime))) : "—"}
        {u && (u.displayName || u.emailAddress) ? ` by ${u.displayName || nameOnly(u.emailAddress)}` : ""}
      </div>
    </button>
  );
}
