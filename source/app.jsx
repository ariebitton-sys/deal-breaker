const { useState, useMemo, useEffect, useRef } = React;
const LOGO = window._KAPPA_LOGO;
const fmt = (n) =>
  isFinite(n)
    ? n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";
const fmt1 = (n) =>
  isFinite(n)
    ? n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      })
    : "—";
const pct = (n) => (isFinite(n) ? (n * 100).toFixed(1) + "%" : "—");
const fmtK = (n) => {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n),
    s = n < 0 ? "-" : "";
  if (a >= 999500) return s + "$" + (a / 1e6).toFixed(a >= 9.95e6 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 9950) return s + "$" + Math.round(a / 1e3) + "K";
  if (a >= 1000) return s + "$" + (a / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return s + "$" + Math.round(a);
};
const DEFAULT_REPAIRS = [
  {
    group: "Exterior",
    label: "Clean Landscape",
    price: 500,
    lump: true,
    qty: 1,
  },
  {
    group: "Exterior",
    label: "All new landscape",
    price: 2000,
    lump: true,
    qty: 0,
  },
  {
    group: "Exterior",
    label: "Windows ($600 ea)",
    price: 600,
    lump: false,
    qty: 0,
  },
  {
    group: "Exterior",
    label: "New Garage Door",
    price: 1700,
    lump: false,
    qty: 0,
  },
  {
    group: "Interior",
    label: "Kitchen",
    price: 12000,
    lump: true,
    qty: 1,
  },
  {
    group: "Interior",
    label: "Light Kitchen Update",
    price: 6000,
    lump: true,
    qty: 0,
  },
  {
    group: "Interior",
    label: "Full Bathroom ($4k ea)",
    price: 4000,
    lump: false,
    qty: 1,
  },
  {
    group: "Interior",
    label: "Half Bathroom ($3k ea)",
    price: 3000,
    lump: false,
    qty: 0,
  },
  {
    group: "Interior",
    label: "Flooring",
    price: 5000,
    lump: true,
    qty: 1,
  },
  {
    group: "Interior",
    label: "Tile Work",
    price: 3500,
    lump: true,
    qty: 0,
  },
  {
    group: "Interior",
    label: "Interior Paint",
    price: 5000,
    lump: true,
    qty: 1,
  },
  {
    group: "Interior",
    label: "Exterior Paint",
    price: 4000,
    lump: true,
    qty: 0,
  },
  {
    group: "Interior",
    label: "New doors and trim",
    price: 3000,
    lump: true,
    qty: 0,
  },
  {
    group: "Mechanicals",
    label: "Furnace and A/C",
    price: 7000,
    lump: true,
    qty: 0,
  },
  {
    group: "Mechanicals",
    label: "Roof",
    price: 6000,
    lump: true,
    qty: 0,
  },
  {
    group: "Mechanicals",
    label: "All new lighting",
    price: 1500,
    lump: true,
    qty: 1,
  },
  {
    group: "Mechanicals",
    label: "New Panel",
    price: 3000,
    lump: true,
    qty: 0,
  },
  {
    group: "Mechanicals",
    label: "New Hot Water Tank",
    price: 1000,
    lump: true,
    qty: 0,
  },
  {
    group: "Other",
    label: "Finish Basement",
    price: 8000,
    lump: true,
    qty: 0,
  },
  {
    group: "Other",
    label: "Cosmetic Demo",
    price: 2500,
    lump: true,
    qty: 1,
  },
  {
    group: "Other",
    label: "Cleaning",
    price: 350,
    lump: true,
    qty: 1,
  },
  {
    group: "Other",
    label: "Miscellaneous",
    price: 5000,
    lump: true,
    qty: 1,
  },
];
const DARK_T = {
  teal: "#21b0bf",
  tealLt: "#46d0dd",
  txt: "#f3f7f9",
  txtDim: "#a7b4be",
  txtMute: "#6f7d88",
  green: "#34d99b",
  lime: "#bdf04a",
  amber: "#f5b53d",
  red: "#ff6b61",
  violet: "#9d8bf5",
  blue: "#5ab0ff",
  glass: "rgba(255,255,255,0.06)",
  glassHi: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.12)",
  borderHi: "rgba(255,255,255,0.22)",
  inputBg: "rgba(0,0,0,0.22)",
  bg: "radial-gradient(1100px 700px at 78% -12%, #2a4d52, #10171c 60%, #0a0e12)",
  shadow: "0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
};
const LIGHT_T = {
  teal: "#0b7a85",
  tealLt: "#0b7a85",
  txt: "#1e293b",
  txtDim: "#475569",
  txtMute: "#94a3b8",
  green: "#15803d",
  lime: "#4d7c0f",
  amber: "#b45309",
  red: "#dc2626",
  violet: "#6d28d9",
  blue: "#1d4ed8",
  glass: "rgba(255,255,255,0.92)",
  glassHi: "rgba(255,255,255,1)",
  border: "rgba(0,0,0,0.10)",
  borderHi: "rgba(0,0,0,0.18)",
  inputBg: "rgba(0,0,0,0.04)",
  bg: "linear-gradient(150deg,#e8f4f8 0%,#f0f9ff 40%,#f8fafc 100%)",
  shadow: "0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
};
// v50 "Deal room" palette: neutral slate ink on an airy canvas. Emerald only for credits, verified
// documents and positive variance; amber / crimson only for overruns and overdue items.
const ELEV = "0 0 0 1px rgba(17,24,39,.05), 0 1px 2px rgba(17,24,39,.04), 0 2px 6px rgba(17,24,39,.03)";
const SITE_T = {
  teal: "#2563EB",
  tealLt: "#1D4ED8",
  txt: "#111827",
  txtDim: "#4B5563",
  txtMute: "#6B7280",
  green: "#047857",
  lime: "#047857",
  amber: "#B45309",
  red: "#B91C1C",
  violet: "#2563EB",
  blue: "#2563EB",
  glass: "#FFFFFF",
  glassHi: "#F9FAFB",
  border: "#E5E7EB",
  borderHi: "#D1D5DB",
  inputBg: "#FFFFFF",
  bg: "#FAFAFB",
  shadow: ELEV,
  marker: "#111827",
  navy: "#111827",
};
let T = SITE_T;
const FONT = "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif";
const MONO = FONT; // numbers use tabular figures (set globally in CSS) instead of a monospace face
const LFONT = FONT;
const txnSummary = (items, basisLabel) => {
  const on = TXN_TEMPLATE.filter((t) => items && items[t.key] && items[t.key].on).length;
  return on ? `${on} of ${TXN_TEMPLATE.length} lines on, % ${basisLabel}` : "No lines turned on";
};
const BUY_LABEL_OVERRIDES = {
  staging: "Inspections",
};
const BUY_TYPE_OVERRIDES = {
  realtor: "flat",
};
const RISK_LEVELS = [
  {
    level: 1,
    target: 20000,
    color: "#16a34a",
    criteria: "Rehab under $20k, hold \u2264 3 months",
  },
  {
    level: 2,
    target: 30000,
    color: "#65a30d",
    criteria: "Rehab $20k\u2013$50k, hold 3\u20134 months",
  },
  {
    level: 3,
    target: 40000,
    color: "#d97706",
    criteria: "Rehab $50k\u2013$100k, hold 4\u20136 months",
  },
  {
    level: 4,
    target: 55000,
    color: "#7c3aed",
    criteria: "Rehab $100k\u2013$175k, hold 6\u20139 months",
  },
  {
    level: 5,
    target: 75000,
    color: "#dc2626",
    criteria: "Rehab over $175k, hold over 9 months",
  },
];
const GRADE_BANDS = [
  {
    g: "A+",
    label: "\u2265 160%",
  },
  {
    g: "A",
    label: "140\u2013159%",
  },
  {
    g: "A-",
    label: "125\u2013139%",
  },
  {
    g: "B+",
    label: "110\u2013124%",
  },
  {
    g: "B",
    label: "100\u2013109%",
  },
  {
    g: "B-",
    label: "90\u201399%",
  },
  {
    g: "C+",
    label: "80\u201389%",
  },
  {
    g: "C",
    label: "70\u201379%",
  },
  {
    g: "C-",
    label: "60\u201369%",
  },
  {
    g: "Reject",
    label: "< 60%",
  },
];
function GradeExplainer({ deal, repair, holdMonths, netProfit, visible, anchorRef }) {
  // Open beside the results rail (to its left) so the explanation sits next to the grade it explains.
  let pos;
  if (visible && anchorRef && anchorRef.current && typeof window !== "undefined" && window.innerWidth > 980) {
    const rail = anchorRef.current.closest(".rail") || anchorRef.current;
    const r = rail.getBoundingClientRect();
    pos = { left: Math.max(16, r.left - 296 - 14) };
  }
  return (
    <div className={"grade-explain no-print" + (visible ? " is-on" : "")} style={pos}>
      <div className="ge-title">
        Why is this deal{" "}
        <b
          style={{
            color: deal.gradeColor,
          }}
        >
          {deal.grade}
        </b>
        ?
      </div>
      <div className="ge-sec">
        <div className="ge-h">1. Risk level</div>
        <div className="ge-note">
          Risk is the <b>higher</b> of the rehab-cost tier and the hold-time tier. Each level sets a minimum target profit.
        </div>
        {RISK_LEVELS.map((rl) => (
          <div key={rl.level} className={"ge-row" + (rl.level === deal.riskLevel ? " is-active" : "")}>
            <span
              className="ge-badge"
              style={{
                background: rl.color + "22",
                color: rl.color,
              }}
            >
              {rl.level}
            </span>
            <span className="ge-body">
              <span className="ge-crit">{rl.criteria}</span>
              <span className="ge-sub">target {fmt(rl.target)}</span>
            </span>
          </div>
        ))}
        <div className="ge-calc">
          rehab {fmt(repair)} → tier {deal.rehabLvl}
          <br />
          hold {holdMonths} mo → tier {deal.holdLvl}
          <br />= <b>Risk {deal.riskLevel}</b>, target <b>{fmt(deal.threshold)}</b>
        </div>
      </div>
      <div className="ge-sec">
        <div className="ge-h">2. Profit against the target</div>
        <div className="ge-calc">
          {fmt(netProfit)} ÷ {fmt(deal.threshold)} = <b>{Math.round(deal.ratio * 100)}%</b> → <b>{deal.initialGrade}</b>
        </div>
        <div className="ge-bands">
          {GRADE_BANDS.map((b) => (
            <span key={b.g} className={"ge-band" + (b.g === deal.initialGrade ? " is-active" : "")}>
              <span className="ge-bg">{b.g}</span>
              <span className="ge-bl">{b.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="ge-sec">
        <div className="ge-h">3. Adjustments</div>
        {deal.adj.length === 0 ? (
          <div className="ge-note">None apply to this deal.</div>
        ) : (
          deal.adj.map((a, i) => (
            <div key={i} className="ge-adj">
              <span className={a.delta > 0 ? "ge-up" : "ge-down"}>{a.delta > 0 ? "▲ +" + a.delta : "▼ " + a.delta}</span>
              <span className="ge-adjlabel">{a.label}</span>
            </div>
          ))
        )}
        <div className="ge-rules">
          Hold ≤2 mo <b>+1</b>; hold 7–9 mo <b>−1</b>
          {"; hold >9 mo "}
          <b>−2</b>
          {"; purchase >$300k with rehab under 10% and hold ≤3 mo "}
          <b>+1</b>
          {"; rehab >$150k with hold >6 mo and profit under $60k "}
          <b>−1</b>
        </div>
      </div>
      <div className="ge-final">
        <span className="ge-fl">Final grade</span>
        <span
          className="ge-fg"
          style={{
            color: deal.gradeColor,
          }}
        >
          {deal.grade}
        </span>
      </div>
    </div>
  );
}
const TXN_TEMPLATE = [
  {
    key: "escrow",
    label: "Escrow / Attorney Fees",
    type: "flat",
  },
  {
    key: "recording",
    label: "Recording Fees",
    type: "flat",
  },
  {
    key: "realtor",
    label: "Realtor Fees",
    type: "pct",
  },
  {
    key: "transfer",
    label: "Transfer & Conveyance",
    type: "pct",
  },
  {
    key: "warranty",
    label: "Home Warranty",
    type: "flat",
  },
  {
    key: "staging",
    label: "Staging Costs",
    type: "flat",
  },
  {
    key: "marketing",
    label: "Marketing Costs",
    type: "flat",
  },
  {
    key: "misc",
    label: "Miscellaneous",
    type: "flat",
  },
];
const gp = (e) => ({
  background: "#FFFFFF",
  border: "none",
  borderRadius: 10,
  boxShadow: ELEV,
  ...e,
});
const bs = (bg, color) => ({
  padding: "7px 12px",
  borderRadius: 6,
  border: `1px solid ${T.border}`,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
  background: bg === T.glass ? "#FFFFFF" : bg,
  color,
  lineHeight: 1.25,
});
const ss = {
  width: "100%",
  padding: "8px 10px",
  border: `1px solid ${SITE_T.border}`,
  borderRadius: 6,
  fontSize: 13.5,
  fontFamily: FONT,
  background: SITE_T.inputBg,
  color: SITE_T.txt,
  outline: "none",
  boxSizing: "border-box",
};
function Field({ label, value, onChange, prefix, suffix, step = 1, hint, accent }) {
  const [focus, setFocus] = useState(false);
  const [draft, setDraft] = useState(null);
  const clean = Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : "";
  const shown = focus && draft !== null ? draft : clean;
  return (
    <label
      style={{
        display: "block",
        marginBottom: 12,
      }}
    >
      {label ? (
        <span
          style={{
            display: "block",
            fontSize: 12.5,
            color: T.txtDim,
            marginBottom: 5,
            fontWeight: 500,
            fontFamily: LFONT,
          }}
        >
          {sentenceCase(label)}
        </span>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          border: `1px solid ${focus ? T.teal : T.border}`,
          borderRadius: 6,
          overflow: "hidden",
          background: "#FFFFFF",
          transition: "border-color .15s, box-shadow .15s",
          boxShadow: focus ? `0 0 0 3px ${T.teal}1f` : "none",
        }}
      >
        {prefix && (
          <span
            style={{
              padding: "9px 9px",
              color: T.txtMute,
              fontSize: 13,
              fontFamily: MONO,
              display: "flex",
              alignItems: "center",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={shown}
          step={step}
          onFocus={(e) => {
            setFocus(true);
            e.target.select();
          }}
          onBlur={() => {
            setFocus(false);
            setDraft(null);
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            onChange(raw === "" ? 0 : parseFloat(raw));
          }}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            padding: "8px 8px",
            fontSize: 15,
            fontWeight: 500,
            fontFamily: MONO,
            background: "transparent",
            color: T.txt,
            minWidth: 0,
          }}
        />
        {suffix && (
          <span
            style={{
              padding: "9px 10px",
              color: T.txtMute,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <span
          style={{
            display: "block",
            fontSize: 10.5,
            color: T.txtMute,
            marginTop: 4,
            fontFamily: MONO,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
function LR({ label, value, strong, accent, neg }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "6px 0",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: strong ? T.txt : T.txtDim,
          fontWeight: strong ? 600 : 400,
        }}
      >
        {neg && (
          <span
            style={{
              color: T.txtMute,
            }}
          >
            −{" "}
          </span>
        )}
        {sentenceCase(label)}
      </span>
      <span
        style={{
          fontSize: strong ? 15 : 13.5,
          fontWeight: strong ? 700 : 500,
          color: accent || T.txt,
          fontFamily: MONO,
        }}
      >
        {value}
      </span>
    </div>
  );
}
function Panel({ title, kicker, children, accent, right }) {
  return (
    <section
      style={gp({
        padding: "18px 22px",
        marginBottom: 16,
      })}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            minWidth: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 15.5,
              color: T.txt,
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            {sentenceCase(title)}
          </h2>
          {kicker && (
            <span
              style={{
                fontSize: 12.5,
                color: T.txtMute,
              }}
            >
              {kicker}
            </span>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
function Kpi({ label, value, tone, big, hint, desc }) {
  return (
    <div
      className={desc ? "kpi-tooltip" : undefined}
      data-tip={desc}
      style={gp({
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      })}
    >
      <div
        style={{
          fontSize: 12.5,
          color: T.txtDim,
          fontWeight: 500,
          marginBottom: 4,
          fontFamily: LFONT,
        }}
      >
        {sentenceCase(label)}
      </div>
      <div
        style={{
          fontSize: big ? 23 : 19,
          fontWeight: 700,
          color: tone === T.txtDim ? T.txt : tone,
          fontFamily: MONO,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11.5,
            color: T.txtMute,
            marginTop: 3,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
function TxnEditor({ side, items, setItems, basis, basisLabel, accent, excludeKeys = [], typeOverrides = {}, labelOverrides = {} }) {
  const update = (key, patch) =>
    setItems((p) => ({
      ...p,
      [key]: {
        ...p[key],
        ...patch,
      },
    }));
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 70px 88px",
          gap: 8,
          padding: "0 2px 6px",
          fontSize: 10,
          color: T.txtMute,
          letterSpacing: "0",
          fontWeight: 700,
        }}
      >
        <span>{side} item</span>
        <span
          style={{
            textAlign: "center",
          }}
        >
          On/Off
        </span>
        <span
          style={{
            textAlign: "right",
          }}
        >
          Value
        </span>
      </div>
      {TXN_TEMPLATE.filter((t) => !excludeKeys.includes(t.key)).map((t) => {
        const it = items[t.key];
        if (!it) return null;
        const effType = it.type || typeOverrides[t.key] || t.type;
        const computed = it.on ? (effType === "pct" ? (it.val / 100) * basis : it.val) : 0;
        return (
          <div
            key={t.key}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 88px",
              gap: 8,
              alignItems: "center",
              padding: "5px 2px",
              borderBottom: `1px solid ${T.border}`,
              opacity: it.on ? 1 : 0.62,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                color: T.txt,
              }}
            >
              {labelOverrides[t.key] || t.label}
            </span>
            <button
              onClick={() =>
                update(t.key, {
                  on: !it.on,
                })
              }
              style={{
                justifySelf: "center",
                width: 38,
                height: 22,
                borderRadius: 4,
                border: it.on ? "none" : `1px solid ${T.border}`,
                cursor: "pointer",
                position: "relative",
                background: it.on ? "#0f172a" : "#e7ecf1",
                transition: "background .15s, border .15s",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: it.on ? 18 : 2,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: it.on ? "0 1px 2px rgba(0,0,0,.25)" : "0 0 0 1px rgba(15,23,42,.08)",
                  transition: "left .15s",
                }}
              />
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                justifySelf: "end",
              }}
            >
              <input
                type="number"
                onFocus={(e) => e.target.select()}
                value={it.val}
                step={effType === "pct" ? 0.1 : 100}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  update(
                    t.key,
                    v > 0 && !it.on
                      ? {
                          val: v,
                          on: true,
                        }
                      : {
                          val: v,
                        },
                  );
                }}
                style={{
                  width: 56,
                  padding: "5px 6px",
                  border: `1px solid ${T.border}`,
                  borderRadius: 7,
                  fontSize: 12,
                  fontFamily: MONO,
                  background: T.inputBg,
                  color: T.txt,
                  textAlign: "right",
                }}
              />
              <button
                onClick={() =>
                  update(t.key, {
                    type: effType === "pct" ? "flat" : "pct",
                  })
                }
                title={
                  effType === "pct" ? "Percentage \u2014 click to switch to a flat $ amount" : "Flat $ amount \u2014 click to switch to a percentage"
                }
                style={{
                  width: 20,
                  height: 20,
                  padding: 0,
                  flexShrink: 0,
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: T.glass,
                  color: effType === "pct" ? accent : T.txtDim,
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: MONO,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                {effType === "pct" ? "%" : "$"}
              </button>
            </div>
            {it.on && effType === "pct" && (
              <span
                style={{
                  gridColumn: "1 / -1",
                  fontSize: 10,
                  color: T.txtMute,
                  fontFamily: MONO,
                  textAlign: "right",
                  marginTop: -2,
                }}
              >
                = {fmt(computed)} ({basisLabel})
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
const dTxn = (o) => {
  const b = {};
  TXN_TEMPLATE.forEach((t) => {
    b[t.key] = {
      on: false,
      val: 0,
    };
  });
  return {
    ...b,
    ...o,
  };
};
async function driveList(token, folderId) {
  // Paginates (the API returns at most 100 files per page by default) and pulls each file's
  // appProperties, where v26 keeps a compact deal summary for the Portfolio screen.
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType='application/json' and trashed=false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,modifiedTime,appProperties,lastModifyingUser(displayName,emailAddress))");
  let files = [],
    pageToken = "";
  do {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${encodeURIComponent("modifiedTime desc")}&pageSize=1000${
        pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""
      }`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!r.ok) {
      const e = new Error(`Drive list: ${r.status}`);
      e.status = r.status;
      throw e;
    }
    const j = await r.json();
    files = files.concat(j.files || []);
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return files;
}
async function driveRead(token, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok) {
    const e = new Error(`Drive read: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
async function driveCreate(token, folderId, name, data, appProperties) {
  const boundary = "kappa_bnd";
  const meta = JSON.stringify({
    name,
    mimeType: "application/json",
    parents: [folderId],
    ...(appProperties ? { appProperties } : {}),
  });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=" + encodeURIComponent("id,name,modifiedTime"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary="${boundary}"`,
    },
    body,
  });
  if (!r.ok) {
    const e = new Error(`Drive create: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
async function driveUpdate(token, fileId, data) {
  const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const e = new Error(`Drive update: ${r.status}`);
    e.status = r.status;
    throw e;
  }
}
async function driveDelete(token, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!r.ok && r.status !== 404) {
    const e = new Error(`Drive delete: ${r.status}`);
    e.status = r.status;
    throw e;
  }
}
async function driveUploadFile(token, folderId, file) {
  const arrayBuffer = await file.arrayBuffer();
  const boundary = "kappa_file_bnd_xyz";
  const meta = JSON.stringify({
    name: file.name,
    mimeType: file.type,
    parents: [folderId],
  });
  const enc = new TextEncoder();
  const part1 = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
  );
  const part2 = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(part1.length + arrayBuffer.byteLength + part2.length);
  body.set(part1, 0);
  body.set(new Uint8Array(arrayBuffer), part1.length);
  body.set(part2, part1.length + arrayBuffer.byteLength);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary="${boundary}"`,
    },
    body,
  });
  if (!r.ok) {
    const e = new Error(`File upload: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
function SettingsModal({ settings, connected, team, onSave, onClose }) {
  const [cid, setCid] = useState(settings.clientId || "");
  const [fid, setFid] = useState(settings.folderId || "");
  const [mapsKey, setMapsKey] = useState(settings.mapsApiKey || "");
  const [aiKey, setAiKey] = useState(settings.anthropicKey || "");
  const [keyTest, setKeyTest] = useState(null);
  const [share, setShare] = useState(true);
  const cleanKey = cleanApiKey(aiKey);
  const formKeys = { anthropicKey: cleanKey, mapsApiKey: mapsKey.trim() };
  const teamKeys = settings.teamKeys || {};
  const hasKeys = !!(formKeys.anthropicKey || formKeys.mapsApiKey);
  const differs = TEAM_KEYS.some((k) => formKeys[k] && formKeys[k] !== (teamKeys[k] || ""));
  const canShare = connected && !!fid.trim() && fid.trim() === (settings.folderId || "") && hasKeys && (!team || differs);
  const teamDate = team && team.modifiedTime ? fmtDate(isoOf(new Date(team.modifiedTime))) : "";
  const builtIn = cid.trim() === KAPPA_CLIENT_ID;
  const [copied, setCopied] = useState(null); // null | "ok" | link text when the clipboard isn't available
  const link = settings.folderId ? inviteLink(settings.folderId) : "";
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("ok");
    } catch (e) {
      setCopied(link);
    }
  };
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={gp({
          padding: 28,
          maxWidth: 500,
          width: "100%",
          borderRadius: 20,
          border: `1px solid ${T.borderHi}`,
        })}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 800,
            marginBottom: 20,
            color: T.teal,
          }}
        >
          Settings
        </h2>
        <details className="set-conn" open={!builtIn}>
          <summary>
            <span>Google connection</span>
            <small>{builtIn ? "Kappa's sign-in is built in. " : ""}{fid ? "Deals folder set." : "The deals folder is found when you connect Google."}</small>
          </summary>
        <label
          style={{
            display: "block",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: T.txtDim,
              marginBottom: 5,
              fontWeight: 600,
              letterSpacing: "0",
            }}
          >
            Google Client ID
          </span>
          <input
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
            style={{
              ...ss,
              fontFamily: MONO,
              fontSize: 12,
            }}
          />
        </label>
        <label
          style={{
            display: "block",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: T.txtDim,
              marginBottom: 5,
              fontWeight: 600,
              letterSpacing: "0",
            }}
          >
            Shared Drive Folder ID
          </span>
          <input
            value={fid}
            onChange={(e) => setFid(e.target.value)}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            style={{
              ...ss,
              fontFamily: MONO,
              fontSize: 12,
            }}
          />
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              color: T.txtMute,
              marginTop: 4,
            }}
          >
            From Drive URL: drive.google.com/drive/folders/<strong>THIS_PART</strong>
          </span>
        </label>
        </details>
        <label
          style={{
            display: "block",
            marginBottom: 22,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: T.txtDim,
              marginBottom: 5,
              fontWeight: 600,
              letterSpacing: "0",
            }}
          >
            Google Maps API Key
          </span>
          <input
            value={mapsKey}
            onChange={(e) => setMapsKey(e.target.value)}
            placeholder="AIzaSy..."
            style={{
              ...ss,
              fontFamily: MONO,
              fontSize: 12,
            }}
          />
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              color: T.txtMute,
              marginTop: 4,
            }}
          >
            Enable "Maps Embed API" for this key — free, no billing card required.
          </span>
        </label>
        <label
          style={{
            display: "block",
            marginBottom: 22,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: T.txtDim,
              marginBottom: 5,
              fontWeight: 600,
              letterSpacing: "0",
            }}
          >
            Anthropic API Key (closing statement import)
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="password"
              name="anthropic-api-key"
              value={aiKey}
              onChange={(e) => {
                setAiKey(e.target.value);
                setKeyTest(null);
              }}
              placeholder="sk-ant-..."
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              spellCheck={false}
              style={{
                ...ss,
                fontFamily: MONO,
                fontSize: 12,
              }}
            />
            <button
              type="button"
              disabled={!cleanKey || (keyTest && keyTest.busy)}
              onClick={async () => {
                setKeyTest({ busy: true, text: "Testing\u2026" });
                setKeyTest(await testAnthropicKey(cleanKey));
              }}
              style={{ ...bs(T.glass, T.teal), whiteSpace: "nowrap", fontSize: 12, padding: "6px 12px" }}
            >
              Test key
            </button>
          </div>
          {cleanKey && (
            <span style={{ display: "block", fontSize: 10.5, color: looksLikeAnthropicKey(cleanKey) ? T.txtMute : T.red, marginTop: 4, fontFamily: MONO }}>
              {maskKey(cleanKey)}
              {!looksLikeAnthropicKey(cleanKey) &&
                " \u2014 doesn't look like a full key. Keys start with sk-ant- and are about 100 characters; the keys list in the Console shows only a shortened version."}
            </span>
          )}
          {keyTest && (
            <span
              style={{
                display: "block",
                fontSize: 11.5,
                fontWeight: 700,
                marginTop: 4,
                color: keyTest.busy ? T.txtDim : keyTest.ok ? T.green : T.red,
              }}
            >
              {keyTest.text}
            </span>
          )}
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              color: T.txtMute,
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            Create one at console.anthropic.com → API Keys. Kept in this browser, and in the deals folder if you share it with the team below. Each statement costs a few cents to read.
          </span>
        </label>
        <div className="set-team">
          <div className="set-team-h">Kappa team</div>
          {!connected ? (
            <p>Connect Google to share these keys with the team. Team members then only connect Google: no codes to type.</p>
          ) : !team ? (
            <React.Fragment>
              <label className="set-check">
                <input type="checkbox" checked={share && hasKeys} disabled={!hasKeys} onChange={(e) => setShare(e.target.checked)} />
                <span>Share the Maps and Anthropic keys with the team</span>
              </label>
              <p>
                Saved as “{TEAM_FILE.replace(/\.json$/, "")}” in the deals folder. Anyone you share that folder with gets the keys and the
                folder when they connect Google, with nothing to type. Anyone with access to the folder can read the keys.
              </p>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <p>
                Shared with the team{teamDate ? `, last updated ${teamDate}` : ""}
                {team.by ? ` by ${team.by}` : ""}. Members who connect Google get the keys and the deals folder automatically.
              </p>
              {differs ? (
                <label className="set-check">
                  <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
                  <span>Update the team's keys with these (everyone gets them on their next visit)</span>
                </label>
              ) : (
                <p className="set-ok">The team uses these keys.</p>
              )}
            </React.Fragment>
          )}
          {link && (
            <div className="set-invite">
              <button type="button" onClick={copyInvite} style={{ ...bs(T.glass, T.teal), fontSize: 12, padding: "6px 12px" }}>
                {copied === "ok" ? "Invite link copied" : "Copy invite link"}
              </button>
              <span>For a new member: share the deals folder with their Kappa Google account, then send them this link.</span>
              {copied && copied !== "ok" && <input readOnly value={copied} onFocus={(e) => e.target.select()} />}
            </div>
          )}
          {!builtIn && cid.trim() && (
            <p className="set-warn">New team members sign in with the app's built-in Client ID, which isn't the one above, so they can't connect yet. Ask Claude to update the built-in one.</p>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button onClick={onClose} style={bs(T.glass, T.txtDim)}>
            Cancel
          </button>
          <button
            onClick={() =>
              onSave(
                {
                  clientId: cid.trim(),
                  folderId: fid.trim(),
                  mapsApiKey: mapsKey.trim(),
                  anthropicKey: cleanKey,
                },
                { share: canShare && share },
              )
            }
            style={bs(T.teal, "#FFFFFF")}
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
function PropertyMapCard({ address, apiKey }) {
  const [debounced, setDebounced] = useState(address);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(address), 700);
    return () => clearTimeout(t);
  }, [address]);
  const wrap = (inner) => (
    <div
      className="map-card"
      style={gp({
        padding: 0,
        overflow: "hidden",
        height: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      {inner}
    </div>
  );
  if (!apiKey) {
    return wrap(
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: T.txtMute,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        Add a Google Maps API key in Settings to see the property on a map.
      </div>,
    );
  }
  if (!debounced || !debounced.trim()) {
    return wrap(
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: T.txtMute,
          fontSize: 12,
        }}
      >
        Enter a property address above to preview the map.
      </div>,
    );
  }
  const src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(debounced)}`;
  return wrap(
    <iframe
      title="Property location"
      width="100%"
      height="260"
      style={{
        border: 0,
        display: "block",
      }}
      loading="lazy"
      src={src}
    />,
  );
}
function ResourcesPanel({ address, photosUrl, setPhotosUrl }) {
  const trimmed = (address || "").trim();
  const zillowUrl = trimmed ? `https://www.zillow.com/homes/${encodeURIComponent(trimmed)}_rb/` : null;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(photosUrl || "");
  React.useEffect(() => {
    setDraft(photosUrl || "");
  }, [photosUrl]);
  const normalize = (u) => {
    const t = (u || "").trim();
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : "https://" + t;
  };
  const save = () => {
    setPhotosUrl(normalize(draft));
    setEditing(false);
  };
  const linkCardStyle = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    borderRadius: 4,
    border: `1px solid ${T.border}`,
    textDecoration: "none",
    color: T.txt,
    background: T.inputBg,
    transition: "border-color .15s",
  };
  return (
    <div
      style={gp({
        padding: "16px 18px",
        minHeight: 260,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 2,
            background: T.blue,
            boxShadow: `0 0 10px ${T.blue}`,
          }}
        />
        <h2
          style={{
            margin: 0,
            fontSize: 12.5,
            letterSpacing: "0",
            color: T.txt,
            fontWeight: 700,
          }}
        >
          Resources
        </h2>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flex: 1,
          justifyContent: "center",
        }}
      >
        {zillowUrl ? (
          <a href={zillowUrl} target="_blank" rel="noopener noreferrer" style={linkCardStyle}>
            <span
              style={{
                fontSize: 30,
              }}
            >
              <Icon name="link" size={24} stroke={1.5} />
            </span>
            <div
              style={{
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                View on Zillow
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.txtMute,
                  marginTop: 3,
                }}
              >
                {"Comps, listing history & Zestimate"}
              </div>
            </div>
          </a>
        ) : (
          <div
            style={{
              color: T.txtMute,
              fontSize: 12,
              textAlign: "center",
              padding: "0 10px",
            }}
          >
            Enter a property address to see resource links.
          </div>
        )}
        {editing ? (
          <div
            style={{
              ...linkCardStyle,
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 30,
              }}
            >
              <Icon name="camera" size={26} stroke={1.5} />
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <input
                autoFocus={true}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") {
                    setDraft(photosUrl || "");
                    setEditing(false);
                  }
                }}
                placeholder="Paste photos folder link (Drive, Dropbox…)"
                style={{
                  width: "100%",
                  background: T.glass,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  color: T.txt,
                  padding: "7px 9px",
                  fontSize: 12.5,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={save}
              style={{
                ...bs(T.teal, "#FFFFFF"),
                fontSize: 11,
                padding: "6px 11px",
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setDraft(photosUrl || "");
                setEditing(false);
              }}
              style={{
                ...bs(T.glass, T.txtDim),
                fontSize: 11,
                padding: "6px 9px",
              }}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ) : photosUrl ? (
          <div
            style={{
              ...linkCardStyle,
              gap: 14,
            }}
          >
            <a
              href={photosUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                textDecoration: "none",
                color: T.txt,
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 30,
                }}
              >
                <Icon name="camera" size={26} stroke={1.5} />
              </span>
              <div
                style={{
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  Photos folder
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: T.txtMute,
                    marginTop: 3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {photosUrl.replace(/^https?:\/\//, "")}
                </div>
              </div>
            </a>
            <button
              onClick={() => setEditing(true)}
              title="Edit link"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: T.txtMute,
                padding: 2,
              }}
            >
              <Icon name="edit" size={14} />
            </button>
            <button
              onClick={() => setPhotosUrl("")}
              title="Remove"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                color: T.txtMute,
                padding: 2,
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={{
              ...linkCardStyle,
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              borderStyle: "dashed",
            }}
          >
            <span
              style={{
                fontSize: 30,
                opacity: 0.7,
              }}
            >
              <Icon name="camera" size={26} stroke={1.5} />
            </span>
            <div
              style={{
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: T.txtDim,
                }}
              >
                Add photos folder
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.txtMute,
                  marginTop: 3,
                }}
              >
                Link a Drive / Dropbox folder of property photos
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
function ProfitBar({ m, arv }) {
  if (!arv || arv <= 0) return null;
  const segs = [
    {
      l: "Purchase",
      v: Math.max(0, m.purchase || 0),
      c: T.amber,
    },
    {
      l: "Repairs",
      v: Math.max(0, m.repair || 0),
      c: T.violet,
    },
    {
      l: "Financing",
      v: Math.max(0, m.totalFinancing),
      c: T.blue,
    },
    {
      l: "Holding",
      v: Math.max(0, m.totalHolding),
      c: "#7a8893",
    },
    {
      l: "PM",
      v: Math.max(0, m.pmFee || 0),
      c: "#94a3b8",
    },
    {
      l: "Txn",
      v: Math.max(0, m.totalBuying + m.totalSelling),
      c: "#566069",
    },
    {
      l: "Profit",
      v: Math.max(0, m.netProfit),
      c: T.green,
    },
  ];
  const loss = m.netProfit < 0 ? -m.netProfit : 0;
  const total =
    Math.max(
      arv,
      segs.reduce((s, x) => s + x.v, 0),
    ) || 1;
  const arvPct = Math.min(100, (arv / total) * 100);
  const chip = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    color: T.txtDim,
  };
  return (
    <div
      style={{
        marginTop: 14,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          height: 12,
          borderRadius: 6,
          overflow: "hidden",
          background: T.inputBg,
        }}
      >
        {segs.map(
          (s, i) =>
            s.v > 0 && (
              <div
                key={i}
                title={`${s.l}: ${fmt(s.v)}`}
                style={{
                  width: `${(s.v / total) * 100}%`,
                  background: s.c,
                }}
              />
            ),
        )}
        {loss > 0 && (
          <div
            title={`Loss: ${fmt(loss)} \u2014 costs exceed ARV`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${arvPct}%`,
              right: 0,
              background: `repeating-linear-gradient(135deg, ${T.red}dd 0 5px, ${T.red}77 5px 10px)`,
            }}
          />
        )}
        {loss > 0 && (
          <div
            title={`ARV ${fmt(arv)}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${arvPct}%`,
              width: 2,
              marginLeft: -1,
              background: "#ffffff",
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 8,
        }}
      >
        {segs.map(
          (s, i) =>
            s.v > 0 && (
              <span key={i} style={chip}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: s.c,
                  }}
                />
                {s.l}
                <span
                  style={{
                    fontFamily: MONO,
                    color: T.txtMute,
                  }}
                >
                  {Math.round((s.v / arv) * 100)}%
                </span>
              </span>
            ),
        )}
        {loss > 0 && (
          <span
            style={{
              ...chip,
              color: T.red,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: T.red,
              }}
            />
            Loss {fmt(loss)}
          </span>
        )}
      </div>
    </div>
  );
}
const sumTxnPure = (items, basis, typeOverrides = {}) =>
  TXN_TEMPLATE.reduce((s, t) => {
    const it = items && items[t.key];
    if (!it || !it.on) return s;
    const val = parseFloat(it.val) || 0;
    const effType = it.type || typeOverrides[t.key] || t.type;
    return s + (effType === "pct" ? (val / 100) * basis : val);
  }, 0);
const DRAFT_KEY = "kappa_draft_v1";
function calcDeal(i) {
  const purchase = i.purchase || 0,
    repair = i.repair || 0,
    h = i.holdMonths || 0,
    arv = i.arv || 0,
    points = i.points || 0;
  const loanAmountPurchase = purchase * i.loanOnPurchasePct;
  const loanAmountRehab = repair * i.loanOnRehabPct;
  const loanAmount = loanAmountPurchase + loanAmountRehab;
  const interestPurchase = ((loanAmountPurchase * i.intRatePurchase) / 12) * h;
  // Rehab funding: "internal" = Kappa internal loan advanced in full at closing (interest on the full
  // amount for the whole hold). "draws" = lender reimburses in N equal draws spread over the rehab
  // period; each draw accrues interest only from its draw date until the sale.
  const isDraws = i.rehabFunding === "draws";
  const drawCount = Math.max(1, Math.round(i.drawCount || 1));
  const drawMonths = Math.max(0, Math.min(i.drawMonths || 0, h));
  const rehabMonthsOutstanding = isDraws ? Math.max(0, h - (drawMonths * (drawCount + 1)) / (2 * drawCount)) : h;
  const interestRehab = ((loanAmountRehab * i.intRateRehab) / 12) * rehabMonthsOutstanding;
  const drawFees = isDraws && loanAmountRehab > 0 ? drawCount * (i.drawFee || 0) : 0;
  const interest = interestPurchase + interestRehab;
  const totalBuying = sumTxnPure(i.buyTxn, purchase, BUY_TYPE_OVERRIDES);
  const totalSelling = sumTxnPure(i.sellTxn, arv);
  // Investor funds everything due at closing that the lender doesn't: down payment, closing costs
  // and lender fees/points (rehab is covered by the internal loan or the lender's draws).
  const investorAmount = i.investorAuto ? Math.max(0, purchase + repair + totalBuying + points - loanAmount) : i.investorAmount || 0;
  const investorInterest = investorAmount * i.investorRate;
  const totalFinancing = points + interest + investorInterest + drawFees;
  const totalMonthlyHold =
    (i.taxAnnual || 0) / 12 +
    (i.insMonthly || 0) +
    (i.hoaMonthly || 0) +
    (i.utilGas || 0) +
    (i.utilWater || 0) +
    (i.utilElec || 0) +
    (i.miscHold || 0);
  const totalHolding = totalMonthlyHold * h;
  // project manager: not part of the rehab budget (so it doesn't move the deal's size class);
  // paid out of pocket in installments, no interest
  const pmFee = pmFeeOf(i.pm, repair);
  const totalCosts = purchase + repair + totalFinancing + totalHolding + totalBuying + totalSelling + pmFee;
  const netProfit = arv - totalCosts;
  const cashIn = Math.max(0, purchase + repair + totalBuying + points - loanAmount - investorAmount) + interest + drawFees + totalHolding + pmFee;
  const roi = totalCosts > 0 ? netProfit / totalCosts : NaN;
  return {
    purchase,
    repair,
    loanAmount,
    loanAmountPurchase,
    loanAmountRehab,
    interest,
    interestPurchase,
    interestRehab,
    drawFees,
    drawAmount: isDraws ? loanAmountRehab / drawCount : 0,
    rehabMonthsOutstanding,
    investorAmount,
    investorInterest,
    monthlyInterest: ((loanAmountPurchase * i.intRatePurchase) / 12) + ((loanAmountRehab * i.intRateRehab) / 12),
    totalFinancing,
    totalMonthlyHold,
    totalHolding,
    pmFee,
    totalBuying,
    totalSelling,
    totalCosts,
    netProfit,
    cashIn,
    roi,
    roiAnnual: h > 0 ? (roi * 12) / h : NaN,
    cashOnCashAnnual: cashIn > 0 && h > 0 ? ((netProfit / cashIn) * 12) / h : NaN,
    costPerSqft: i.sqft ? (purchase + repair) / i.sqft : NaN,
  };
}
function solvePurchaseFor(inputs, goal) {
  if (!(inputs.arv > 0) || !Number.isFinite(goal)) return null;
  const at = (p) =>
    calcDeal({
      ...inputs,
      purchase: p,
    }).netProfit;
  if (at(0) < goal) return null;
  let lo = 0,
    hi = Math.max(inputs.arv, inputs.purchase || 0) * 2;
  if (at(hi) >= goal) return Math.floor(hi);
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (at(mid) >= goal) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}
// Comps (CMA) used to have their own list under Flip analysis; they now sit in the deal's documents.
function compsIntoDocs(mg, cma) {
  if (!Array.isArray(cma) || !cma.length) return mg;
  const docs = Array.isArray(mg.docs) ? mg.docs : [];
  const same = (a, b) => (a.driveFileId && a.driveFileId === b.driveFileId) || (a.url && a.url === b.url);
  const list = cma.filter((f) => f && (f.driveFileId || f.url));
  // a comps file already filed with the documents gets the Comps label instead of a second copy
  const labeled = docs.map((x) => (!x.kind && list.some((f) => same(x, f)) ? { ...x, kind: "Comps" } : x));
  const add = list.filter((f) => !docs.some((x) => same(x, f))).map((f) => ({ ...f, id: uid(), kind: "Comps", date: f.date || "" }));
  return { ...mg, docs: [...labeled, ...add] };
}
// ---- Kappa team setup ----
// Kappa's Google sign-in app. Not a secret: it's in every Google sign-in page, and Google lets only
// kappainv.com accounts through (Internal app). Built in so a team member doesn't type it.
const KAPPA_CLIENT_ID = "297783038765-bhfkd9b5ik3phs5pi1r4kdv8mqcpqj3o.apps.googleusercontent.com";
// The Maps and Anthropic keys are shared through a small file in the deals folder; whoever the folder is
// shared with finds it when they connect Google, and with it the folder itself. Never in this public code.
const TEAM_FILE = "Deal Breaker team settings.json";
const TEAM_KEYS = ["anthropicKey", "mapsApiKey"];
const withBuiltIns = (s) => ({ ...s, clientId: (s && s.clientId) || KAPPA_CLIENT_ID });
async function driveFindTeamFile(token) {
  const q = encodeURIComponent(`name='${TEAM_FILE}' and trashed=false`);
  const fields = encodeURIComponent("files(id,name,parents,modifiedTime,appProperties,lastModifyingUser(displayName,emailAddress))");
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=${encodeURIComponent("modifiedTime desc")}&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) {
    const e = new Error(`Drive search: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  const j = await r.json();
  const list = (j.files || []).filter((f) => f.parents && f.parents.length);
  return list.find((f) => f.appProperties && f.appProperties.dbTeam === "1") || list[0] || null;
}
// Invite link: …/deal-breaker/#join=<deals folder ID>. The folder ID isn't a secret (Drive only opens it
// for people it's shared with); with it the app opens the folder directly instead of searching Drive.
const INVITE_KEY = "kappa_invite_folder";
const inviteLink = (folderId) => window.location.origin + window.location.pathname + "#join=" + encodeURIComponent(folderId);
(function readInvite() {
  try {
    const m = String(window.location.hash || "").match(/^#join=([\w-]{4,})$/);
    if (!m) return;
    const cur = JSON.parse(localStorage.getItem("kappa_settings") || "{}") || {};
    if (!cur.folderId) localStorage.setItem(INVITE_KEY, m[1]); // someone already set up keeps their folder
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  } catch (e) {}
})();
const pendingInvite = () => {
  try {
    return localStorage.getItem(INVITE_KEY) || null;
  } catch (e) {
    return null;
  }
};
// No team file yet: the deals themselves show where the folder is (saved deals carry summary properties).
async function driveFindDealsFolder(token) {
  const q = encodeURIComponent("appProperties has { key='sv' and value='2' } and trashed=false");
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${encodeURIComponent("files(id,parents)")}&pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const e = new Error(`Drive search: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  const n = {};
  ((await r.json()).files || []).forEach((f) => (f.parents || []).slice(0, 1).forEach((p) => (n[p] = (n[p] || 0) + 1)));
  const best = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
  return best || null;
}
const TOKEN_KEY = "kappa_google_token";
function readStoredToken(clientId) {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    if (t && t.token && t.cid === clientId && t.exp - Date.now() > 60 * 1000) return t;
  } catch (e) {}
  return null;
}
function storeToken(clientId, token, exp) {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp, cid: clientId }));
  } catch (e) {}
}
function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}
function App() {
  T = SITE_T;
  const [mode, setMode] = useState("underwrite");
  const [address, setAddress] = useState("");
  const [sqft, setSqft] = useState(0);
  const [holdMonths, setHoldMonths] = useState(0);
  const [arv, setArv] = useState(0);
  const [yearBuilt, setYearBuilt] = useState(0);
  const [purchase, setPurchase] = useState(0);
  const [repairs, setRepairs] = useState(DEFAULT_REPAIRS);
  const [useRepairBuilder, setUseRepairBuilder] = useState(false);
  const [manualRepair, setManualRepair] = useState(0);
  const [loanOnPurchasePct, setLoanOnPurchasePct] = useState(0.8);
  const [loanOnRehabPct, setLoanOnRehabPct] = useState(1.0);
  const [intRatePurchase, setIntRatePurchase] = useState(0.18);
  const [intRateRehab, setIntRateRehab] = useState(0.16);
  const [points, setPoints] = useState(0);
  const [taxAnnual, setTaxAnnual] = useState(0);
  const [insMonthly, setInsMonthly] = useState(120);
  const [utilGas, setUtilGas] = useState(75);
  const [utilWater, setUtilWater] = useState(75);
  const [utilElec, setUtilElec] = useState(50);
  const [hoaMonthly, setHoaMonthly] = useState(0);
  const [miscHold, setMiscHold] = useState(0);
  const [buyTxn, setBuyTxn] = useState(
    dTxn({
      escrow: {
        on: true,
        val: 1200,
      },
      transfer: {
        on: true,
        val: 0.45,
      },
    }),
  );
  const [sellTxn, setSellTxn] = useState(
    dTxn({
      escrow: {
        on: true,
        val: 1500,
      },
      realtor: {
        on: true,
        val: 6,
      },
      transfer: {
        on: true,
        val: 0.4,
      },
      staging: {
        on: true,
        val: 1500,
      },
    }),
  );
  const [investorAmount, setInvestorAmount] = useState(0);
  const [investorAuto, setInvestorAuto] = useState(true);
  const [investorRate, setInvestorRate] = useState(0.09);
  const [analysisDate, setAnalysisDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cmaFiles, setCmaFiles] = useState([]);
  const cmaFileInputRef = useRef(null);
  const [actuals, setActuals] = useState([]);
  // ---- v26 pipeline state ----
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("kappa_view") === "deal" ? "deal" : "portfolio";
    } catch {
      return "portfolio";
    }
  });
  const [stage, setStage] = useState("analyzing");
  const [stageHistory, setStageHistory] = useState([]);
  const [uwBaseline, setUwBaseline] = useState(null);
  const [mgmt, setMgmt] = useState(emptyMgmt);
  const [rehabFunding, setRehabFunding] = useState(DEFAULTS.rehabFunding);
  const [purchaseLender, setPurchaseLender] = useState(DEFAULTS.purchaseLender);
  const [drawCount, setDrawCount] = useState(DEFAULTS.drawCount);
  const [drawMonths, setDrawMonths] = useState(DEFAULTS.drawMonths);
  const [drawFee, setDrawFee] = useState(DEFAULTS.drawFee);
  const [pm, setPm] = useState(DEFAULTS.pm);
  const [transition, setTransition] = useState(null);
  const [aiModal, setAiModal] = useState(null); // {kind:'closing'|'sow', side, origin, existing}
  const setImportSide = (sd, origin) => setAiModal(sd ? { kind: "closing", side: sd, origin: origin || "" } : null);
  const [conflict, setConflict] = useState(null);
  const [summaries, setSummaries] = useState(() => {
    const c = loadSummaryCache();
    const out = {};
    Object.keys(c).forEach((id) => (out[id] = c[id].sum));
    return out;
  });
  const summaryCacheRef = useRef(loadSummaryCache());
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const loadedRef = useRef(null); // Drive file this deal was opened from: {id, name, modifiedTime}
  const acquired = ["rehab", "market", "sold"].includes(stage) || (stage === "dead" && mgmt.dead && ["rehab", "market"].includes(mgmt.dead.fromStage));
  const [actualSale, setActualSale] = useState(0);
  const [settings, setSettings] = useState(() => {
    try {
      return withBuiltIns(JSON.parse(localStorage.getItem("kappa_settings") || "{}") || {});
    } catch {
      return withBuiltIns({});
    }
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const persistSettings = (s) => {
    try {
      localStorage.setItem("kappa_settings", JSON.stringify(s));
    } catch (e) {}
    settingsRef.current = s;
    setSettings(s);
  };
  const [teamFile, setTeamFile] = useState(null); // the team settings file in the deals folder: {id, modifiedTime, by}
  const [teamSetup, setTeamSetup] = useState(null); // signed in without a deals folder: {status: "searching"|"notfound"|"error"}
  const [showSettings, setShowSettings] = useState(false);
  // Google access token: valid for about an hour. Kept in localStorage with its expiry so a refresh,
  // an app update or a second tab doesn't disconnect; renewed on the user's next click near expiry.
  const [accessToken, setAccessToken] = useState(() => {
    const t = readStoredToken(settings.clientId);
    return t ? t.token : null;
  });
  const [userEmail, setUserEmail] = useState(() => {
    try {
      return localStorage.getItem("kappa_user_email") || null;
    } catch {
      return null;
    }
  });
  const [driveFiles, setDriveFiles] = useState([]);
  const [pfFilter, setPfFilterRaw] = useState(() => {
    try {
      return normDash(localStorage.getItem("kappa_pf_filter") || "overview");
    } catch (e) {
      return "overview";
    }
  });
  const setPfFilter = (k) => {
    setPfFilterRaw(normDash(k));
    try {
      localStorage.setItem("kappa_pf_filter", k);
    } catch (e) {}
  };
  const [driveMsg, setDriveMsg] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const afterSaveRef = useRef(null);
  const [photosUrl, setPhotosUrl] = useState("");
  const [gradeHover, setGradeHover] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [autoSave, setAutoSave] = useState({ status: "idle" }); // idle | saving | saved | error | conflict | exists
  const fileIdMap = useRef({});
  const pendingSave = useRef(false);
  const saveSettings = (form, opts = {}) => {
    const s = withBuiltIns({ ...settings, ...form });
    const authChanged = s.clientId !== settings.clientId || s.folderId !== settings.folderId;
    persistSettings(s);
    setShowSettings(false);
    if (opts.share && accessToken && s.folderId && !authChanged) shareTeamKeys(s);
    if (!authChanged) return; // e.g. only the Maps or Anthropic key changed — stay connected
    clearStoredToken();
    setAccessToken(null);
    setUserEmail(null);
    try {
      localStorage.removeItem("kappa_user_email");
    } catch {}
    setDriveFiles([]);
  };
  const tokenRef = useRef({ exp: (readStoredToken(settings.clientId) || {}).exp || 0, inflight: null, connecting: null });
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const userEmailRef = useRef(userEmail);
  userEmailRef.current = userEmail;
  const dropToken = () => {
    tokenRef.current.exp = 0;
    clearStoredToken();
    setAccessToken(null);
  };
  // One token request at a time: a click that renews and a Connect button pressed together share it.
  // Google opens its window only from a click; anywhere else the browser blocks it (error_callback).
  const requestToken = () => {
    const r = tokenRef.current;
    if (r.inflight) return r.inflight;
    if (!settings.clientId) return Promise.reject(new Error("No client ID configured"));
    if (!window.google || !google.accounts || !google.accounts.oauth2) return Promise.reject(new Error("Google script not loaded"));
    const p = new Promise((resolve, reject) => {
      const hint = userEmailRef.current || undefined;
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: settings.clientId,
        scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
        login_hint: hint,
        hint,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(resp.error));
            return;
          }
          const exp = Date.now() + (Number(resp.expires_in) || 3599) * 1000;
          tokenRef.current.exp = exp;
          storeToken(settings.clientId, resp.access_token, exp);
          setAccessToken(resp.access_token);
          accessTokenRef.current = resp.access_token;
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(new Error(err && err.type === "popup_failed_to_open" ? "popup_blocked" : (err && err.type) || "auth_failed")),
      });
      tc.requestAccessToken({ prompt: "" });
    });
    r.inflight = p;
    p.then(
      () => (r.inflight = null),
      () => (r.inflight = null),
    );
    return p;
  };
  const getFreshToken = requestToken;
  const withAuthRetry = async (action, token) => {
    let tok = token || accessTokenRef.current;
    const r = tokenRef.current;
    // a renewal is already under way (e.g. started by this click): wait for it
    if (!token && r.inflight) tok = await r.inflight.catch(() => tok);
    try {
      return await action(tok);
    } catch (err) {
      if (err && err.status === 401) {
        let fresh;
        try {
          fresh = await requestToken();
        } catch (e) {
          dropToken();
          throw new Error("Google sign-in expired. Click anywhere to reconnect.");
        }
        return await action(fresh);
      }
      throw err;
    }
  };
  // Take the team's keys from the team file. A key this browser got from the team (or doesn't have)
  // follows the team's; a key someone typed in themselves stays theirs. Returns true if a key changed.
  const applyTeam = (content, meta) => {
    const s = { ...settingsRef.current };
    const last = s.teamKeys || {};
    let changed = false;
    TEAM_KEYS.forEach((k) => {
      const tv = String((content && content[k]) || "").trim();
      if (!tv) return;
      if (!s[k] || s[k] === last[k]) {
        if (s[k] !== tv) changed = true;
        s[k] = tv;
      }
    });
    s.teamKeys = { anthropicKey: String(content.anthropicKey || "").trim(), mapsApiKey: String(content.mapsApiKey || "").trim() };
    s.teamSync = meta.modifiedTime;
    if (!s.folderId) {
      s.folderId = String(content.folderId || "").trim() || (meta.parents || [])[0];
      changed = true;
    }
    persistSettings(withBuiltIns(s));
    setTeamFile({ id: meta.id, modifiedTime: meta.modifiedTime, by: meta.lastModifyingUser ? meta.lastModifyingUser.displayName || meta.lastModifyingUser.emailAddress : "" });
    return changed;
  };
  const refreshFiles = async (token) => {
    if (!settingsRef.current.folderId) return;
    try {
      const all = await withAuthRetry((tok) => driveList(token || tok, settingsRef.current.folderId));
      const team = all.find((f) => f.name === TEAM_FILE);
      const files = all.filter((f) => f.name !== TEAM_FILE);
      if (!team) setTeamFile(null);
      else if (team.modifiedTime === settingsRef.current.teamSync)
        setTeamFile({ id: team.id, modifiedTime: team.modifiedTime, by: team.lastModifyingUser ? team.lastModifyingUser.displayName || team.lastModifyingUser.emailAddress : "" });
      else {
        try {
          const content = await withAuthRetry((tok) => driveRead(token || tok, team.id));
          if (applyTeam(content, team)) {
            setDriveMsg("✓ Team keys updated");
            setTimeout(() => setDriveMsg(""), 2500);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setDriveFiles(files);
      const m = {};
      files.forEach((f) => {
        m[f.name] = f.id;
      });
      fileIdMap.current = m;
    } catch (e) {
      console.error(e);
    }
  };
  const afterConnect = async (token) => {
    try {
      const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).then((r) => r.json());
      setUserEmail(info.email);
      userEmailRef.current = info.email;
      try {
        localStorage.setItem("kappa_user_email", info.email || "");
      } catch {}
      if (!settingsRef.current.folderId) await findTeamFolder(token); // says what it found
      else {
        await refreshFiles(token);
        setDriveMsg("✓ Connected");
        setTimeout(() => setDriveMsg(""), 2000);
      }
    } catch (e) {
      setDriveMsg("❌ " + e.message);
    }
    if (pendingSave.current) {
      pendingSave.current = false;
      const cb = afterSaveRef.current;
      afterSaveRef.current = null;
      await doSave(token, { cb });
    }
  };
  // Connect (or reconnect) once, however many clicks ask for it.
  const connect = () => {
    const r = tokenRef.current;
    if (r.connecting) return r.connecting;
    const p = requestToken().then(async (tok) => {
      await afterConnect(tok);
      return tok;
    });
    r.connecting = p;
    p.then(
      () => (r.connecting = null),
      () => (r.connecting = null),
    );
    return p;
  };
  const signIn = () => {
    if (!settings.clientId) {
      setDriveMsg("⚠ Configure settings first");
      setTimeout(() => setDriveMsg(""), 3000);
      return;
    }
    if (!window.google) {
      setDriveMsg("⚠ Google script not loaded");
      setTimeout(() => setDriveMsg(""), 3000);
      return;
    }
    connect().catch((e) => {
      setDriveMsg(e.message === "popup_blocked" ? "⚠ The browser blocked Google's sign-in window. Allow pop-ups for this site and try again." : "❌ " + e.message);
      pendingSave.current = false;
      afterSaveRef.current = null;
    });
  };
  // A team member's first sign-in: the team settings file shared with them points to the deals folder
  // and carries the keys, so there's nothing to type.
  const findTeamFolder = async (token) => {
    setTeamSetup({ status: "searching" });
    const useFolder = async (folderId) => {
      persistSettings(withBuiltIns({ ...settingsRef.current, folderId }));
      setTeamSetup(null);
      await refreshFiles(token); // the folder's listing brings the team file, and with it the keys
      const ok = !!settingsRef.current.teamSync;
      setDriveMsg(ok ? "✓ Kappa team settings loaded" : "✓ Deals folder found. The team keys aren't shared yet: Arie shares them from Settings");
      setTimeout(() => setDriveMsg(""), ok ? 3000 : 8000);
    };
    try {
      // 1. an invite link: open that folder directly
      const invite = pendingInvite();
      if (invite) {
        try {
          await withAuthRetry((tok) => driveGetMeta(token || tok, invite));
        } catch (e) {
          if (e.status === 404 || e.status === 403) return setTeamSetup({ status: "noaccess" });
          throw e;
        }
        try {
          localStorage.removeItem(INVITE_KEY);
        } catch (e) {}
        return await useFolder(invite);
      }
      // 2. the team settings file shared with this account
      const meta = await withAuthRetry((tok) => driveFindTeamFile(token || tok));
      if (meta) {
        const content = await withAuthRetry((tok) => driveRead(token || tok, meta.id));
        applyTeam(content, meta);
        setTeamSetup(null);
        await refreshFiles(token);
        setDriveMsg("✓ Kappa team settings loaded");
        setTimeout(() => setDriveMsg(""), 3000);
        return;
      }
      // 3. Kappa deals shared with this account
      const folder = await withAuthRetry((tok) => driveFindDealsFolder(token || tok));
      if (folder) return await useFolder(folder);
      setTeamSetup({ status: "notfound" });
    } catch (e) {
      console.error(e);
      setTeamSetup({ status: "error", msg: e.message });
    }
  };
  // Share this browser's Maps and Anthropic keys with the team: written to the team file in the deals folder.
  const shareTeamKeys = async (s) => {
    const data = {
      kind: "deal-breaker-team-settings",
      v: 1,
      note: "Read by Deal Breaker: team members get these keys when they connect Google. Anyone with access to this folder can read them.",
      folderId: s.folderId,
      anthropicKey: s.anthropicKey || "",
      mapsApiKey: s.mapsApiKey || "",
      updatedBy: userEmailRef.current || "",
      updatedAt: new Date().toISOString(),
    };
    try {
      const res = await withAuthRetry(async (tok) => {
        if (teamFile && teamFile.id) {
          try {
            return await driveUpdateFull(tok, teamFile.id, data, { name: TEAM_FILE });
          } catch (e) {
            if (e.status !== 404) throw e;
          }
        }
        return driveCreate(tok, s.folderId, TEAM_FILE, data, { dbTeam: "1" });
      });
      persistSettings({ ...settingsRef.current, teamKeys: { anthropicKey: data.anthropicKey, mapsApiKey: data.mapsApiKey }, teamSync: res.modifiedTime });
      setTeamFile({ id: res.id, modifiedTime: res.modifiedTime, by: userEmailRef.current || "" });
      setDriveMsg("✓ Keys shared with the Kappa team");
      setTimeout(() => setDriveMsg(""), 3000);
    } catch (e) {
      setDriveMsg("❌ Couldn't share the keys with the team: " + e.message);
    }
  };
  // A token saved by an earlier page load: load the deal list straight away.
  useEffect(() => {
    if (!accessToken) return;
    if (settings.folderId) refreshFiles(accessToken);
    else findTeamFolder(accessToken);
  }, []);
  // Renew on the user's click: when the hour is nearly up, or after it ran out for someone who was
  // connected before. A click is the only moment the browser lets Google open its window.
  const clickRenewRef = useRef(null);
  clickRenewRef.current = (e) => {
    if (!settings.clientId || !window.google || !google.accounts || showSettings) return;
    const r = tokenRef.current;
    if (r.inflight || r.connecting) return;
    const left = r.exp - Date.now();
    if (accessTokenRef.current) {
      if (r.exp && left < 10 * 60 * 1000) requestToken().catch(() => (left <= 0 ? dropToken() : null));
    } else if (userEmailRef.current && !(e.target && e.target.closest && e.target.closest("[data-no-autoconnect]"))) {
      connect().catch(() => {});
    }
  };
  useEffect(() => {
    const h = (e) => clickRenewRef.current && clickRenewRef.current(e);
    window.addEventListener("click", h, true);
    return () => window.removeEventListener("click", h, true);
  }, []);
  // Save with conflict protection: never silently overwrite a deal someone else saved after we
  // opened it, or a different deal that already uses this address. Renaming the address renames
  // the Drive file instead of leaving a duplicate behind.
  const doSave = async (token, opts = {}) => {
    const cb = typeof opts.cb === "function" ? opts.cb : null;
    const auto = !!opts.auto; // autosave: quiet, no toast, no full list reload
    if (!address.trim()) {
      if (!auto) {
        setDriveMsg("⚠ Enter address first");
        setTimeout(() => setDriveMsg(""), 3000);
      }
      return false;
    }
    const savedKey = dealKey;
    const before = loadedRef.current ? { ...loadedRef.current } : null;
    if (auto) setAutoSave({ status: "saving" });
    else setDriveLoading(true);
    try {
      const name = fileNameFor(address);
      const data = getState();
      const sum = summarizeDeal(data);
      const result = await withAuthRetry(async (tok) => {
        const loaded = loadedRef.current;
        let targetId = loaded && loaded.id ? loaded.id : null;
        const sameNameId = fileIdMap.current[name];
        if (sameNameId && sameNameId !== targetId) {
          if (!opts.force) return { conflict: { type: "exists", meta: await driveGetMeta(tok, sameNameId), name } };
          targetId = sameNameId;
        } else if (targetId && !opts.force) {
          let meta = null;
          try {
            meta = await driveGetMeta(tok, targetId);
          } catch (e) {
            if (e.status !== 404) throw e;
          }
          if (!meta) targetId = null; // deleted in Drive meanwhile → save as a new file
          else if (loaded.modifiedTime && meta.modifiedTime !== loaded.modifiedTime) return { conflict: { type: "changed", meta, name } };
        }
        const res = targetId
          ? await driveUpdateFull(tok, targetId, data, { name, appProperties: summaryToProps(sum, false) || { sv: null } })
          : await driveCreate(tok, settings.folderId, name, data, summaryToProps(sum, true) || undefined);
        return { res, tok };
      }, token);
      if (result.conflict) {
        // autosave: another deal already has this address → just say so (no popup on every pause in typing);
        // someone else saved this deal meanwhile → ask, as a manual save does
        if (auto && result.conflict.type === "exists") {
          setAutoSave({ status: "exists", key: savedKey, name });
          return false;
        }
        setConflict({ ...result.conflict, cb });
        if (auto) setAutoSave({ status: "conflict", key: savedKey });
        return false;
      }
      const res = result.res;
      if (loadedRef.current && loadedRef.current.name && loadedRef.current.name !== name && fileIdMap.current[loadedRef.current.name] === res.id)
        delete fileIdMap.current[loadedRef.current.name];
      loadedRef.current = { id: res.id, name, modifiedTime: res.modifiedTime };
      fileIdMap.current[name] = res.id;
      summaryCacheRef.current[res.id] = { modifiedTime: res.modifiedTime, sum };
      saveSummaryCache(summaryCacheRef.current);
      setSummaries((s) => ({ ...s, [res.id]: sum }));
      taskIndexPut({ id: res.id, name }, data, res.modifiedTime);
      // a new or renamed file changes the deal list; a plain update only changes this deal's entry
      if (!auto || !before || before.id !== res.id || before.name !== name) await refreshFiles(result.tok);
      else setDriveFiles((fs) => fs.map((f) => (f.id === res.id ? { ...f, name, modifiedTime: res.modifiedTime } : f)));
      setBaseline(savedKey);
      if (auto) setAutoSave({ status: "saved", at: Date.now() });
      else {
        setAutoSave({ status: "saved", at: Date.now() });
        setDriveMsg("✓ Saved to Drive");
        setTimeout(() => setDriveMsg(""), 2500);
      }
      if (cb) cb(result.tok);
      return true;
    } catch (e) {
      if (auto) setAutoSave({ status: "error", msg: e.message });
      else setDriveMsg(e.message.includes("expired") ? "❌ " + e.message : "❌ " + e.message + " — your data is safe, try Save again");
      return false;
    } finally {
      if (!auto) setDriveLoading(false);
    }
  };
  const resetFields = () => {
    setAddress("");
    setSqft(0);
    setHoldMonths(0);
    setArv(0);
    setYearBuilt(0);
    setPurchase(0);
    setRepairs(DEFAULT_REPAIRS);
    setUseRepairBuilder(false);
    setManualRepair(0);
    setLoanOnPurchasePct(0.8);
    setLoanOnRehabPct(1.0);
    setIntRatePurchase(0.18);
    setIntRateRehab(0.16);
    setPoints(0);
    setInvestorAmount(0);
    setInvestorAuto(true);
    setInvestorRate(0.09);
    setTaxAnnual(0);
    setInsMonthly(120);
    setUtilGas(75);
    setUtilWater(75);
    setUtilElec(50);
    setHoaMonthly(0);
    setMiscHold(0);
    setBuyTxn(
      dTxn({
        escrow: {
          on: true,
          val: 1200,
        },
        transfer: {
          on: true,
          val: 0.45,
        },
      }),
    );
    setSellTxn(
      dTxn({
        escrow: {
          on: true,
          val: 1500,
        },
        realtor: {
          on: true,
          val: 6,
        },
        transfer: {
          on: true,
          val: 0.4,
        },
        staging: {
          on: true,
          val: 1500,
        },
      }),
    );
    setActuals([]);
    setActualSale(0);
    setCmaFiles([]);
    setPhotosUrl("");
    setAnalysisDate(todayISO());
    setStage("analyzing");
    setStageHistory([]);
    setUwBaseline(null);
    setMgmt(emptyMgmt());
    setRehabFunding(DEFAULTS.rehabFunding);
    setPurchaseLender(DEFAULTS.purchaseLender);
    setDrawCount(DEFAULTS.drawCount);
    setDrawMonths(DEFAULTS.drawMonths);
    setDrawFee(DEFAULTS.drawFee);
    setPm(DEFAULTS.pm);
  };
  const resetDeal = () => {
    resetFields();
    loadedRef.current = null;
    setView("deal");
    markClean();
    setMode("underwrite");
    setDriveMsg("\u2728 New deal \u2014 fresh start");
    setTimeout(() => setDriveMsg(""), 2500);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };
  const proceed = (action, token) => {
    if (!action) return;
    if (action.kind === "load") openDeal(action.file, token);
    else resetDeal();
  };
  const requestNewDeal = async () => {
    if (dirty && !(await flushSave())) {
      if (!conflictRef.current) setPendingAction({ kind: "new" });
      return;
    }
    resetDeal();
  };
  const saveThenProceed = async () => {
    const action = pendingAction;
    setPendingAction(null);
    await saveDeal((token) => proceed(action, token));
  };
  const discardThenProceed = () => {
    const action = pendingAction;
    setPendingAction(null);
    proceed(action);
  };
  const saveDeal = async (onSuccess) => {
    const cb = typeof onSuccess === "function" ? onSuccess : null;
    if (!address.trim()) {
      setDriveMsg("⚠ Enter address first");
      setTimeout(() => setDriveMsg(""), 3000);
      return;
    }
    if (!accessToken) {
      if (!settings.clientId) {
        setDriveMsg("⚠ Configure settings first");
        setTimeout(() => setDriveMsg(""), 3000);
        return;
      }
      pendingSave.current = true;
      afterSaveRef.current = cb;
      setDriveMsg("Reconnecting…");
      signIn();
      return;
    }
    // let an autosave that's already running finish first, so the two never write at once
    while (savingRef.current) await new Promise((r) => setTimeout(r, 80));
    if (!dirtyRef.current && loadedRef.current) {
      setDriveMsg("✓ Saved to Drive");
      setTimeout(() => setDriveMsg(""), 2500);
      if (cb) cb(accessTokenRef.current || accessToken);
      return;
    }
    savingRef.current = true;
    try {
      await doSaveRef.current(accessTokenRef.current || accessToken, { cb });
    } finally {
      savingRef.current = false;
    }
  };
  const getState = () => ({
    address,
    sqft,
    holdMonths,
    arv,
    yearBuilt,
    purchase,
    repairs,
    useRepairBuilder,
    manualRepair,
    loanOnPurchasePct,
    loanOnRehabPct,
    intRatePurchase,
    intRateRehab,
    points,
    investorAmount,
    investorAuto,
    investorRate,
    analysisDate,
    taxAnnual,
    insMonthly,
    utilGas,
    utilWater,
    utilElec,
    hoaMonthly,
    miscHold,
    buyTxn,
    sellTxn,
    acquired,
    actuals,
    actualSale,
    cmaFiles,
    photosUrl,
    stage,
    stageHistory,
    uwBaseline,
    mgmt,
    rehabFunding,
    purchaseLender,
    drawCount,
    drawMonths,
    drawFee,
    pm,
    schema: 2,
    savedBy: userEmail || "",
    savedAt: new Date().toISOString(),
  });
  const applyState = (d) => {
    if (d.address !== undefined) setAddress(d.address);
    if (d.sqft !== undefined) setSqft(d.sqft);
    if (d.holdMonths !== undefined) setHoldMonths(d.holdMonths);
    if (d.arv !== undefined) setArv(d.arv);
    setYearBuilt(d.yearBuilt !== undefined ? d.yearBuilt : 0);
    if (d.purchase !== undefined) setPurchase(d.purchase);
    if (d.repairs !== undefined) setRepairs(d.repairs);
    if (d.useRepairBuilder !== undefined) setUseRepairBuilder(d.useRepairBuilder);
    if (d.manualRepair !== undefined) setManualRepair(d.manualRepair);
    if (d.loanOnPurchasePct !== undefined) setLoanOnPurchasePct(d.loanOnPurchasePct);
    if (d.loanOnRehabPct !== undefined) setLoanOnRehabPct(d.loanOnRehabPct);
    if (d.intRatePurchase !== undefined) setIntRatePurchase(d.intRatePurchase);
    else if (d.intRate !== undefined) setIntRatePurchase(d.intRate);
    if (d.intRateRehab !== undefined) setIntRateRehab(d.intRateRehab);
    else if (d.intRate !== undefined) setIntRateRehab(d.intRate);
    if (d.points !== undefined) setPoints(d.points);
    if (d.taxAnnual !== undefined) setTaxAnnual(d.taxAnnual);
    if (d.insMonthly !== undefined) setInsMonthly(d.insMonthly);
    if (d.utilGas !== undefined) setUtilGas(d.utilGas);
    if (d.utilWater !== undefined) setUtilWater(d.utilWater);
    if (d.utilElec !== undefined) setUtilElec(d.utilElec);
    if (d.hoaMonthly !== undefined) setHoaMonthly(d.hoaMonthly);
    if (d.miscHold !== undefined) setMiscHold(d.miscHold);
    if (d.buyTxn !== undefined) setBuyTxn(d.buyTxn);
    if (d.sellTxn !== undefined) setSellTxn(d.sellTxn);
    if (d.investorAmount !== undefined) setInvestorAmount(d.investorAmount);
    if (d.investorAuto !== undefined) setInvestorAuto(d.investorAuto);
    if (d.investorRate !== undefined) setInvestorRate(d.investorRate);
    if (d.analysisDate !== undefined) setAnalysisDate(d.analysisDate);
    if (d.actuals !== undefined) setActuals(d.actuals);
    if (d.actualSale !== undefined) setActualSale(d.actualSale);
    // v38: comps (CMA) live with the deal's other files in Documents
    setCmaFiles([]);
    setPhotosUrl(d.photosUrl || "");
    setStage(inferStage(d));
    setStageHistory(Array.isArray(d.stageHistory) ? d.stageHistory : []);
    setUwBaseline(d.uwBaseline || null);
    setMgmt(compsIntoDocs(mergeMgmt(d.mgmt), d.cmaFiles));
    setRehabFunding(d.rehabFunding || DEFAULTS.rehabFunding);
    setPurchaseLender(d.purchaseLender || DEFAULTS.purchaseLender);
    setDrawCount(d.drawCount !== undefined ? d.drawCount : DEFAULTS.drawCount);
    setDrawMonths(d.drawMonths !== undefined ? d.drawMonths : DEFAULTS.drawMonths);
    setDrawFee(d.drawFee !== undefined ? d.drawFee : DEFAULTS.drawFee);
    setPm(d.pm && typeof d.pm === "object" ? d.pm : DEFAULTS.pm);
  };
  const dealKey = JSON.stringify({
    ...getState(),
    savedAt: undefined,
    savedBy: undefined,
    investorAmount: investorAuto ? null : investorAmount,
  });
  const [baseline, setBaseline] = useState(null);
  const [cleanTick, setCleanTick] = useState(0);
  const restoreBaselineRef = useRef(undefined);
  const markClean = () => setCleanTick((t) => t + 1);
  useEffect(() => {
    if (cleanTick === 0) return;
    if (restoreBaselineRef.current !== undefined) {
      setBaseline(restoreBaselineRef.current);
      restoreBaselineRef.current = undefined;
    } else setBaseline(dealKey);
  }, [cleanTick]);
  const dirty = baseline !== null && dealKey !== baseline;
  // ---- Autosave: every change goes to Drive shortly after it's made ----
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const doSaveRef = useRef(null);
  doSaveRef.current = doSave;
  const conflictRef = useRef(null);
  conflictRef.current = conflict;
  const savingRef = useRef(false);
  const [retryTick, setRetryTick] = useState(0);
  // a new deal is created in Drive once its address looks complete (a number and a street), not mid-typing
  const addressReady = loadedRef.current ? !!address.trim() : /\d/.test(address) && /\s/.test(address.trim()) && address.trim().length >= 8;
  const canAutosave = !!accessToken && !!settings.folderId && addressReady && !conflict;
  const runSave = async () => {
    while (savingRef.current) await new Promise((r) => setTimeout(r, 80));
    if (!dirtyRef.current) return true;
    savingRef.current = true;
    try {
      return await doSaveRef.current(accessTokenRef.current, { auto: true });
    } finally {
      savingRef.current = false;
    }
  };
  // before switching to another deal: save what's pending; false when it can't be saved
  const flushSave = async () => {
    if (!dirtyRef.current) return true;
    if (!accessTokenRef.current || !settings.folderId || !addressReady || conflictRef.current || autoHeld) return false;
    return runSave();
  };
  // autosave holds off after a conflict until the next change, and after "address already used" until the address changes
  const autoHeld = (autoSave.status === "conflict" && autoSave.key === dealKey) || (autoSave.status === "exists" && autoSave.name === fileNameFor(address));
  useEffect(() => {
    if (!dirty || !canAutosave || autoHeld) return;
    // a new deal, or an address being edited (it renames the file), waits for a longer pause in typing
    const renaming = !loadedRef.current || fileNameFor(address) !== loadedRef.current.name;
    const id = setTimeout(runSave, renaming ? 4000 : 1500);
    return () => clearTimeout(id);
  }, [dealKey, baseline, canAutosave, retryTick]);
  // a failed autosave tries again after a while (and on the next change)
  useEffect(() => {
    if (autoSave.status !== "error") return;
    const id = setTimeout(() => setRetryTick((t) => t + 1), 20000);
    return () => clearTimeout(id);
  }, [autoSave]);

  useEffect(() => {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch {}
    if (draft && draft.state) {
      applyState(draft.state);
      loadedRef.current = draft.loaded || null;
      restoreBaselineRef.current = typeof draft.baseline === "string" ? draft.baseline : undefined;
      setDriveMsg("\u21ba Restored your last session");
      setTimeout(() => setDriveMsg(""), 3000);
    }
    markClean();
  }, []);
  useEffect(() => {
    if (baseline === null) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            state: getState(),
            baseline,
            loaded: loadedRef.current,
            ts: Date.now(),
          }),
        );
      } catch {}
    }, 600);
    return () => clearTimeout(id);
  }, [dealKey, baseline]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  const saveRef = useRef(null);
  saveRef.current = saveDeal;
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (saveRef.current) saveRef.current();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const loadDeal = async (file, opts) => {
    setLoadOpen(false);
    if (dirty && !(await flushSave())) {
      if (!conflictRef.current) setPendingAction({ kind: "load", file });
      return false;
    }
    return openDeal(file, null, opts);
  };
  const openDeal = async (file, token, opts) => {
    if (!(token || accessToken)) return;
    setDriveLoading(true);
    try {
      const [data, meta] = await withAuthRetry((tok) => Promise.all([driveRead(tok, file.id), driveGetMeta(tok, file.id)]), token);
      resetFields();
      applyState(data);
      loadedRef.current = { id: file.id, name: meta.name || file.name, modifiedTime: meta.modifiedTime };
      ledgerIndexPut(file, data, meta.modifiedTime);
      taskIndexPut(file, data, meta.modifiedTime);
      const st = inferStage(data);
      setMode((opts && opts.mode) || "overview");
      setView("deal");
      window.scrollTo({ top: 0 });
      markClean();
      setLoadOpen(false);
      setDriveMsg("✓ Loaded");
      setTimeout(() => setDriveMsg(""), 2000);
    } catch (e) {
      setDriveMsg("❌ " + e.message);
    } finally {
      setDriveLoading(false);
    }
  };
  const deleteDeal = async (file, e) => {
    e.stopPropagation();
    if (!accessToken) return;
    if (!confirm(`Delete "${file.name.replace(".json", "")}"?`)) return;
    try {
      await withAuthRetry((tok) => driveDelete(tok, file.id));
      delete fileIdMap.current[file.name];
      if (loadedRef.current && loadedRef.current.id === file.id) loadedRef.current = null;
      delete summaryCacheRef.current[file.id];
      saveSummaryCache(summaryCacheRef.current);
      await refreshFiles();
    } catch (e) {
      setDriveMsg("❌ " + e.message);
    }
  };
  const repairTotal = useMemo(() => {
    if (!useRepairBuilder) return manualRepair;
    return repairs.reduce((s, r) => s + (r.lump ? (r.qty > 0 ? r.price : 0) : r.qty * r.price), 0);
  }, [repairs, useRepairBuilder, manualRepair]);
  const dealInputs = {
    rehabFunding,
    purchaseLender,
    drawCount,
    drawMonths,
    drawFee,
    pm,
    arv,
    purchase,
    repair: repairTotal,
    holdMonths,
    loanOnPurchasePct,
    loanOnRehabPct,
    intRatePurchase,
    intRateRehab,
    points,
    investorAmount,
    investorAuto,
    investorRate,
    taxAnnual,
    insMonthly,
    hoaMonthly,
    utilGas,
    utilWater,
    utilElec,
    miscHold,
    buyTxn,
    sellTxn,
    sqft,
  };
  const m = useMemo(
    () => calcDeal(dealInputs),
    [
      repairTotal,
      purchase,
      loanOnPurchasePct,
      loanOnRehabPct,
      intRatePurchase,
      intRateRehab,
      points,
      investorAmount,
      investorAuto,
      investorRate,
      holdMonths,
      taxAnnual,
      insMonthly,
      hoaMonthly,
      utilGas,
      utilWater,
      utilElec,
      miscHold,
      buyTxn,
      sellTxn,
      arv,
      sqft,
      rehabFunding,
      purchaseLender,
      drawCount,
      drawMonths,
      drawFee,
      pm,
    ],
  );
  useEffect(() => {
    if (!investorAuto) return;
    setInvestorAmount(
      calcDeal({
        ...dealInputs,
        investorAuto: true,
      }).investorAmount,
    );
  }, [investorAuto, purchase, repairTotal, loanOnPurchasePct, loanOnRehabPct, buyTxn, points]);
  const deal = useMemo(
    () => gradeDeal({ repair: m.repair, holdMonths, netProfit: m.netProfit, purchase, arv }),
    [m.repair, m.netProfit, holdMonths, purchase, arv],
  );
  const mao = useMemo(
    () => ({
      target: solvePurchaseFor(dealInputs, deal.threshold),
      walk: solvePurchaseFor(dealInputs, deal.threshold * 0.6),
    }),
    [m, deal.threshold],
  );
  const pctNum = (x) => `${+((x || 0) * 100).toFixed(2)}%`;
  // the terms the Financing card and the Position today statement read
  const posUw = { intRatePurchase, intRateRehab, rehabFunding, purchaseLender, investorRate, points, holdMonths, taxAnnual, insMonthly, utilGas, utilWater, utilElec, hoaMonthly, miscHold };
  const positionProps = {
    uw: posUw,
    sellingAt: (price) => calcDeal({ ...dealInputs, arv: price }).totalSelling,
    defaultPrice: num(mgmt.buyer && mgmt.buyer.price) || num(mgmt.listing && mgmt.listing.price) || arv,
  };
  // Health of the open deal, from the same summary the dashboards use (so the two always agree).
  const liveHealth = useMemo(() => (view === "deal" ? healthOf(summarizeDeal(getState()), todayISO()) : null), [dealKey, view]);
  const financingSub = `${pctNum(loanOnPurchasePct)} purchase loan${purchaseLender === "kappa" ? " from Kappa" : ""}, rehab ${rehabFunding === "draws" ? `in ${drawCount} lender draws` : `on Kappa loan at ${pctNum(intRateRehab)}`}`;
  const dealContext = (() => {
    const t = todayISO();
    if (stage === "dead") return `Dead deal${mgmt.dead && mgmt.dead.reason ? `: ${mgmt.dead.reason}` : ""}`;
    if (stage === "sold") return mgmt.sale.date ? `Sold ${fmtDate(mgmt.sale.date)}` : "Sold";
    if (stage === "market") {
      if (mgmt.buyer.date) return `Sale pending${mgmt.buyer.expectedClosing ? `, closing ${fmtDate(mgmt.buyer.expectedClosing)}` : ""}`;
      const d = daysBetween(mgmt.listing.date, t);
      return d != null && d >= 0 ? `On market, ${d} day${d === 1 ? "" : "s"}` : "On market";
    }
    if (stage === "rehab") {
      const rc = rehabClock(mgmt, t);
      if (rc.waiting) return rc.gap != null ? `Closed ${rc.gap} day${rc.gap === 1 ? "" : "s"} ago, rehab not started` : "Rehab not started";
      if (rc.day != null) return rc.plan ? `Rehab, day ${rc.day} of ${rc.plan}` : `Rehab, day ${rc.day}`;
      return "Rehab";
    }
    if (stage === "contract") {
      const c = mgmt.contract.expectedClosing;
      return c ? `Under contract, closing ${fmtDate(c)}` : "Under contract";
    }
    return "Analyzing";
  })();
  const groups = ["Exterior", "Interior", "Mechanicals", "Other"];
  const updateRepair = (i, f, v) =>
    setRepairs((p) =>
      p.map((r, idx) =>
        idx === i
          ? {
              ...r,
              [f]: v,
            }
          : r,
      ),
    );
  const actualsTotal = actuals.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const actualProfit = actualSale - actualsTotal;
  // Variance is measured against the ORIGINAL underwriting (frozen at contract) when one exists,
  // so edits to the forecast during the flip can't hide a miss.
  const planNet = uwBaseline ? uwBaseline.m.netProfit : m.netProfit;
  const variance = actualProfit - planNet;
  const salePending = !(actualSale > 0);
  const spendBudget = uwBaseline ? uwBaseline.m.totalCosts - uwBaseline.m.totalSelling : m.totalCosts - m.totalSelling;
  const actualCats = ACTUAL_CATS;
  // ---------------- v26: pipeline actions ----------------
  useEffect(() => {
    try {
      localStorage.setItem("kappa_view", view);
    } catch {}
  }, [view]);
  // Portfolio summaries: Drive appProperties first, then the local cache, then read the file.
  // ---- cross-project expense index (Expense search): one compact ledger per deal, per file version ----
  const [ledgerIndex, setLedgerIndex] = useState(readLedgerIndex);
  const [indexBusy, setIndexBusy] = useState(null); // { done, total } while reading
  const [costQuery, setCostQuery] = useState("");
  const [ledgerFocus, setLedgerFocus] = useState(null); // { id, n }: open this expense on Expenses & Documents
  const ledgerIndexPut = (f, d, mt) => setLedgerIndex((ix) => ({ ...ix, [f.id]: ledgerIndexEntry(d, mt || f.modifiedTime, f.name) }));
  useEffect(() => {
    const t = setTimeout(() => writeLedgerIndex(ledgerIndex), 600);
    return () => clearTimeout(t);
  }, [ledgerIndex]);
  const costsOpen = view === "portfolio" && normDash(pfFilter) === "costs";
  useEffect(() => {
    if (!costsOpen || !accessToken || !driveFiles.length) return;
    const ids = new Set(driveFiles.map((f) => f.id));
    if (Object.keys(ledgerIndex).some((id) => !ids.has(id)))
      setLedgerIndex((ix) => Object.fromEntries(Object.entries(ix).filter(([id]) => ids.has(id)))); // deleted deals
    const toRead = driveFiles.filter((f) => !ledgerIndex[f.id] || ledgerIndex[f.id].mt !== f.modifiedTime);
    if (!toRead.length) return;
    let cancelled = false;
    const queue = [...toRead];
    let done = 0;
    setIndexBusy({ done: 0, total: toRead.length });
    (async () => {
      const worker = async () => {
        while (queue.length && !cancelled) {
          const f = queue.shift();
          try {
            const d = await withAuthRetry((tok) => driveRead(tok, f.id));
            if (!cancelled) ledgerIndexPut(f, d);
          } catch (e) {}
          done++;
          if (!cancelled) setIndexBusy({ done, total: toRead.length });
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      if (!cancelled) setIndexBusy(null);
    })();
    return () => {
      cancelled = true;
      setIndexBusy(null);
    };
  }, [costsOpen, accessToken, driveFiles]);
  const openCostResult = async (fid, entryId, item) => {
    const f = driveFiles.find((x) => x.id === fid);
    if (!f) return;
    if (!(loadedRef.current && loadedRef.current.id === fid)) await loadDeal(f, { mode: "expenses" });
    if (loadedRef.current && loadedRef.current.id === fid) {
      goProject("expenses");
      setLedgerFocus({ id: entryId, item: item || null, n: Date.now() });
    }
  };
  // ---- tasks: every active deal's open checklist tasks, per file version; the bell's "seen" mark ----
  const [taskIndex, setTaskIndex] = useState(readTaskIndex);
  const [taskBusy, setTaskBusy] = useState(null);
  const [tasksSeen, setTasksSeen] = useState(readTasksSeen);
  const [taskFocus, setTaskFocus] = useState(null);
  const taskIndexPut = (f, d, mt) => setTaskIndex((ix) => ({ ...ix, [f.id]: taskIndexEntry(d, mt || f.modifiedTime, f.name) }));
  useEffect(() => {
    const t = setTimeout(() => writeTaskIndex(taskIndex), 600);
    return () => clearTimeout(t);
  }, [taskIndex]);
  const markTasksSeen = () => {
    const now = new Date().toISOString();
    setTasksSeen(now);
    writeTasksSeen(now);
  };
  useEffect(() => {
    if (!accessToken || !driveFiles.length) return;
    const ids = new Set(driveFiles.map((f) => f.id));
    if (Object.keys(taskIndex).some((id) => !ids.has(id))) setTaskIndex((ix) => Object.fromEntries(Object.entries(ix).filter(([id]) => ids.has(id))));
    // read the deals that can have tasks (by their summary's stage) when their version isn't indexed yet
    const toRead = driveFiles.filter((f) => summaries[f.id] && TASK_STAGES.includes(summaries[f.id].st) && (!taskIndex[f.id] || taskIndex[f.id].mt !== f.modifiedTime || taskIndex[f.id].v !== TASK_INDEX_V));
    if (!toRead.length) return;
    let cancelled = false;
    const queue = [...toRead];
    let done = 0;
    setTaskBusy({ done: 0, total: toRead.length });
    (async () => {
      const worker = async () => {
        while (queue.length && !cancelled) {
          const f = queue.shift();
          try {
            const d = await withAuthRetry((tok) => driveRead(tok, f.id));
            if (!cancelled) taskIndexPut(f, d);
          } catch (e) {}
          done++;
          if (!cancelled) setTaskBusy({ done, total: toRead.length });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!cancelled) setTaskBusy(null);
    })();
    return () => {
      cancelled = true;
      setTaskBusy(null);
    };
  }, [accessToken, driveFiles, summaries]);
  // Change one deal's management data. The open deal changes in place (autosave writes it); any other deal is
  // read fresh from Drive, changed and written back with its summary, so nothing else in it is touched.
  const patchDealFile = async (fid, fn) => {
    if (loadedRef.current && loadedRef.current.id === fid) {
      setMgmt((mg) => fn(mg));
      return;
    }
    const f = driveFiles.find((x) => x.id === fid);
    if (!f) throw new Error("This project is no longer in the Drive folder.");
    const out = await withAuthRetry(async (tok) => {
      const d = await driveRead(tok, fid);
      const data = { ...d, mgmt: fn(withStandardTasks(mergeMgmt(d.mgmt), inferStage(d))), savedAt: new Date().toISOString(), savedBy: userEmail || d.savedBy || "" };
      const sum = summarizeDeal(data);
      const props = summaryToProps(sum, false);
      const res = await driveUpdateFull(tok, fid, data, { name: f.name, appProperties: props || { sv: null } });
      return { data, sum, props, res };
    });
    const mt = out.res.modifiedTime;
    summaryCacheRef.current[fid] = { modifiedTime: mt, sum: out.sum };
    saveSummaryCache(summaryCacheRef.current);
    setSummaries((s2) => ({ ...s2, [fid]: out.sum }));
    setDriveFiles((fs) => fs.map((x) => (x.id === fid ? { ...x, modifiedTime: mt, appProperties: out.props || x.appProperties } : x)));
    taskIndexPut(f, out.data, mt);
    ledgerIndexPut(f, out.data, mt);
  };
  const logLine = (text) => ({ id: uid(), ts: new Date().toISOString(), by: userEmail || "", text, auto: true });
  const setChecklistItem = (ck, id, patch) => (mg) => ({ ...mg, checklists: { ...mg.checklists, [ck]: (mg.checklists[ck] || []).map((i) => (i.id === id ? { ...i, ...patch } : i)) } });
  const toggleTaskAnywhere = (t, done) =>
    patchDealFile(t.fid, (mg) => {
      // a rehab schedule task is the milestone itself
      if (t.ck === "sched") {
        const ms = (mg.rehab.milestones || []).map((x) => (x.id === t.ms ? { ...x, status: done ? "done" : "todo", doneAt: done ? new Date().toISOString() : "", by: done ? userEmail || "" : "" } : x));
        return { ...mg, rehab: { ...mg.rehab, milestones: ms }, log: [logLine(done ? `Milestone done: ${t.label}` : `Milestone reopened: ${t.label}`), ...mg.log] };
      }
      const next = setChecklistItem(t.ck, t.id, { done, doneAt: done ? new Date().toISOString() : "", by: done ? userEmail || "" : "" })(mg);
      return { ...next, log: [logLine(done ? `Task done: ${t.label}` : `Task reopened: ${t.label}`), ...next.log] };
    });
  const setTaskDueAnywhere = (t, due) => patchDealFile(t.fid, setChecklistItem(t.ck, t.id, { due: due || undefined }));
  const addTaskAnywhere = (fid, label, due) => {
    const live = loadedRef.current && loadedRef.current.id === fid;
    const st = live ? stage : (summaries[fid] && summaries[fid].st) || (taskIndex[fid] && taskIndex[fid].st);
    const ck = CHECKLIST_OF[st];
    if (!ck || st === "sold") throw new Error("Tasks can be added to deals under contract, in rehab or on the market.");
    return patchDealFile(fid, (mg) => ({
      ...mg,
      checklists: { ...mg.checklists, [ck]: [...(mg.checklists[ck] || []), { id: uid(), label, done: false, custom: true, addedAt: new Date().toISOString(), ...(due ? { due } : {}) }] },
      log: [logLine(`Task added: ${label}`), ...mg.log],
    }));
  };
  const liveTasks = loadedRef.current && loadedRef.current.id && address.trim() ? { id: loadedRef.current.id, entry: taskIndexEntry(getState(), loadedRef.current.modifiedTime, "") } : null;
  const allTasks = collectTasks(taskIndex, driveFiles, liveTasks);
  const doneTasks = [];
  Object.entries(taskIndex).forEach(([fid, e]) => {
    if (!e || !e.done || (liveTasks && liveTasks.id === fid) || !driveFiles.some((f) => f.id === fid)) return;
    e.done.forEach((t) => doneTasks.push({ ...t, fid, key: fid + ":" + t.id, address: e.address || (e.name || "").replace(/\.json$/i, ""), st: e.st }));
  });
  if (liveTasks) liveTasks.entry.done.forEach((t) => doneTasks.push({ ...t, fid: liveTasks.id, key: liveTasks.id + ":" + t.id, address, st: stage }));
  const openTasksScreen = (t) => {
    setPfFilter("tasks");
    goPortfolio();
    if (t) setTaskFocus({ key: t.key, n: Date.now() });
  };
  // a project manager task opens that deal's payments panel on the Expenses page
  const openPmPanel = async (t) => {
    const scroll = () =>
      setTimeout(() => {
        const el = document.getElementById("pm-payments");
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 350);
    if (loadedRef.current && loadedRef.current.id === t.fid) {
      goProject("expenses");
      return scroll();
    }
    const f = driveFiles.find((x) => x.id === t.fid);
    if (f) {
      await loadDeal(f, { mode: "expenses" });
      scroll();
    }
  };
  const openTaskProject = async (fid, mode = "manage") => {
    if (loadedRef.current && loadedRef.current.id === fid) return goProject(mode);
    const f = driveFiles.find((x) => x.id === fid);
    if (f) await loadDeal(f, { mode });
  };
  const searchAllProjects = (q) => {
    setCostQuery(q || "");
    setPfFilter("costs");
    goPortfolio();
  };
  const summaryReadsRef = useRef(new Set());
  useEffect(() => {
    if (!accessToken || !driveFiles.length) return;
    const cache = summaryCacheRef.current;
    const next = {};
    const toRead = [];
    driveFiles.forEach((f) => {
      // summaries written before v50 have no paperwork flags (dk): re-read those deals once if the flags matter
      // and summaries before v65 don't know the forecast's rehab budget (fr): re-read the active deals once
      // and summaries before v71 don't say where an active deal's money came from (fs): re-read those once too
      const fresh = (sm) =>
        sm && (sm.dk !== undefined || !DOC_NEEDS[sm.st]) && ((sm.fr !== undefined && sm.fs !== undefined) || !["contract", "rehab", "market"].includes(sm.st));
      const fromProps = propsToSummary(f.appProperties);
      const cached = cache[f.id] && cache[f.id].modifiedTime === f.modifiedTime ? cache[f.id].sum : null;
      if (fresh(fromProps)) next[f.id] = fromProps;
      else if (fresh(cached)) next[f.id] = cached;
      else {
        if (fromProps || cached) next[f.id] = fromProps || cached; // show what's there while the file is read
        if (!summaryReadsRef.current.has(f.id + f.modifiedTime)) toRead.push(f);
      }
    });
    setSummaries((s) => ({ ...s, ...next }));
    if (!toRead.length) return;
    let cancelled = false;
    toRead.forEach((f) => summaryReadsRef.current.add(f.id + f.modifiedTime));
    setSummaryBusy(true);
    const queue = [...toRead];
    (async () => {
      const worker = async () => {
        while (queue.length && !cancelled) {
          const f = queue.shift();
          try {
            const d = await withAuthRetry((tok) => driveRead(tok, f.id));
            ledgerIndexPut(f, d);
            taskIndexPut(f, d);
            const sum = summarizeDeal(d);
            cache[f.id] = { modifiedTime: f.modifiedTime, sum };
            setSummaries((s) => ({ ...s, [f.id]: sum }));
          } catch (e) {
            summaryReadsRef.current.delete(f.id + f.modifiedTime);
          }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      saveSummaryCache(cache);
      if (!cancelled) setSummaryBusy(false);
    })();
    return () => {
      cancelled = true;
      queue.splice(0).forEach((f) => summaryReadsRef.current.delete(f.id + f.modifiedTime)); // let the next run pick these up
      setSummaryBusy(false);
    };
  }, [driveFiles, accessToken]);
  useEffect(() => {
    if (view === "portfolio" && accessToken) refreshFiles();
  }, [view, accessToken]);
  const addLogEntry = (text, extra) =>
    setMgmt((mm) => ({ ...mm, log: [{ id: uid(), ts: new Date().toISOString(), by: userEmail || "", text, auto: true, ...(extra || {}) }, ...mm.log] }));
  const pushActuals = (entries) => setActuals((p) => [...p, ...entries.map((e) => ({ files: [], ...e, id: numId() }))]);
  const snapshotFor = (overrides) => makeUwSnapshot({ ...dealInputs, ...(overrides || {}) }, userEmail, todayISO());
  const refreezeBaseline = () => {
    if (!confirm("Replace the original underwriting with the current numbers?")) return;
    const snap = snapshotFor();
    setUwBaseline({ ...snap, date: (uwBaseline && uwBaseline.date) || todayISO() });
    addLogEntry(`Original underwriting re-frozen: ${fmt(snap.m.netProfit)}, ${snap.grade}`);
  };
  // deals that reached a later stage without a frozen plan can freeze the current numbers as it
  const freezeBaseline = () => {
    if (uwBaseline) return;
    const snap = snapshotFor();
    setUwBaseline(snap);
    addLogEntry(`Original plan saved from the current numbers: ${fmt(snap.m.netProfit)}, ${snap.grade}`);
  };
  const applyTransition = (kind, f) => {
    const now = new Date().toISOString();
    const by = userEmail || "";
    const hist = (st, date) => setStageHistory((h) => [...h, { stage: st, date: date || todayISO(), ts: now, by }]);
    if (kind === "contract") {
      const p = f.updatePurchase ? f.price : purchase;
      if (f.updatePurchase && f.price !== purchase) setPurchase(f.price);
      setUwBaseline({ ...snapshotFor({ purchase: p }), date: f.date });
      setMgmt((mm) => ({
        ...mm,
        contract: { ...mm.contract, date: f.date, price: f.price, expectedClosing: f.expectedClosing, inspectionEnd: f.inspectionEnd, emd: f.emd },
        offers: mm.offers.length ? mm.offers.map((o, i) => (i === mm.offers.length - 1 && o.status !== "Accepted" ? { ...o, status: "Accepted" } : o)) : mm.offers,
      }));
      setStage("contract");
      hist("contract", f.date);
      addLogEntry(`Under contract at ${fmt(f.price)} — closing expected ${fmtDate(f.expectedClosing)}`);
    } else if (kind === "rehab") {
      // the final price is an actual: it goes to the closing record and the ledger, not to Flip analysis
      setMgmt((mm) => ({
        ...mm,
        closing: { date: f.closingDate, price: f.price },
        rehab: { ...mm.rehab, startDate: f.started ? f.startDate : "", targetEnd: f.targetEnd },
      }));
      if (f.logPurchase) {
        const emd = ledgerEmd(actuals);
        pushActuals([
          {
            cat: "Acquisition",
            label: emd > 0 ? `Purchase price ${fmt(f.price)}, paid at closing (EMD ${fmt(emd)} logged separately)` : "Purchase price",
            amount: Math.round((f.price - emd) * 100) / 100,
            date: f.closingDate,
            tag: "purchase_price",
          },
        ]);
      }
      setStage("rehab");
      hist("rehab", f.closingDate);
      addLogEntry(
        `Closed on ${fmtDate(f.closingDate)} at ${fmt(f.price)}` +
          (f.started && f.startDate ? `, rehab started ${fmtDate(f.startDate)}` : ", rehab not started yet"),
      );
    } else if (kind === "market") {
      setMgmt((mm) => ({
        ...mm,
        rehab: { ...mm.rehab, startDate: mm.rehab.startDate || f.rehabStart || "", endDate: mm.rehab.endDate || f.rehabEnd },
        listing: {
          ...mm.listing,
          date: f.listDate,
          price: f.listPrice,
          agent: f.agent,
          prices: mm.listing.prices.length ? [...mm.listing.prices, { date: f.listDate, price: f.listPrice }] : [{ date: f.listDate, price: f.listPrice }],
        },
      }));
      setStage("market");
      hist("market", f.listDate);
      addLogEntry(`Listed at ${fmt(f.listPrice)}${f.agent ? ` with ${f.agent}` : ""}`);
    } else if (kind === "sold") {
      setActualSale(f.salePrice);
      setMgmt((mm) => ({ ...mm, sale: { ...mm.sale, date: f.saleDate } }));
      const add = [];
      if (f.addInvestor && f.investorAmt > 0)
        add.push({ cat: "Financing", label: "Investor return", amount: f.investorAmt, date: f.saleDate, tag: "investor_return" });
      if (f.addRehabInt && f.rehabIntAmt > 0)
        add.push({ cat: "Financing", label: "Internal rehab-loan interest", amount: f.rehabIntAmt, date: f.saleDate, tag: "rehab_loan_interest" });
      if (f.addPurchInt && f.purchIntAmt > 0)
        add.push({ cat: "Financing", label: "Lender interest (purchase loan)", amount: f.purchIntAmt, date: f.saleDate, tag: "purchase_loan_interest" });
      if (add.length) pushActuals(add);
      setStage("sold");
      hist("sold", f.saleDate);
      addLogEntry(`Sold on ${fmtDate(f.saleDate)} for ${fmt(f.salePrice)}`);
    } else if (kind === "dead") {
      setMgmt((mm) => ({ ...mm, dead: { date: todayISO(), reason: f.reason, note: f.note, fromStage: stage } }));
      setStage("dead");
      hist("dead");
      addLogEntry(`Marked dead — ${f.reason}${f.note ? `: ${f.note}` : ""}`);
    } else if (kind === "back") {
      const prev = STAGES[stageIdx(stage) - 1];
      if (!prev) return;
      if (prev.key === "analyzing") setUwBaseline(null);
      if (stage === "sold") setActualSale(0);
      setStage(prev.key);
      hist(prev.key);
      addLogEntry(`Moved back from ${stageMeta(stage).label} to ${prev.label}`);
    } else if (kind === "restore") {
      const to = (mgmt.dead && mgmt.dead.fromStage) || "analyzing";
      setMgmt((mm) => ({ ...mm, dead: null }));
      setStage(to);
      hist(to);
      addLogEntry(`Restored to ${stageMeta(to).label}`);
    }
    setTransition(null);
    if (kind !== "dead" && kind !== "back" && kind !== "restore") setMode(kind === "analyzing" ? "underwrite" : "manage");
    // the actual closing costs come from the closing statement, into the ledger
    if (kind === "rehab" && f.readStmt) setImportSide("buy", "ledger");
    if (kind === "sold" && f.readStmt) setImportSide("sell", "ledger");
  };
  const uploadDealDoc = async (file, kind) => {
    if (!accessToken || !settings.folderId) {
      setDriveMsg("⚠ Connect Google Drive first");
      setTimeout(() => setDriveMsg(""), 3000);
      return null;
    }
    setDocUploading(true);
    try {
      const r = await withAuthRetry((tok) => driveUploadFile(tok, settings.folderId, file));
      const doc = { id: uid(), type: "drive_file", driveFileId: r.id, name: r.name, mimeType: r.mimeType, size: r.size, kind: kind || "", date: todayISO() };
      setMgmt((mm) => ({ ...mm, docs: [...mm.docs, doc] }));
      setDriveMsg("✓ File uploaded");
      setTimeout(() => setDriveMsg(""), 2000);
      return doc;
    } catch (e) {
      setDriveMsg("❌ " + e.message);
      return null;
    } finally {
      setDocUploading(false);
    }
  };
  // ---- saved AI analyses ----
  const saveAnalysis = (r) => {
    const rec = { id: uid(), date: new Date().toISOString(), by: userEmail || "", appliedAt: null, review: null, ...r };
    setMgmt((mm) => ({ ...mm, analyses: [rec, ...(mm.analyses || [])] }));
    return rec;
  };
  const updateAnalysis = (id, patch) =>
    id && setMgmt((mm) => ({ ...mm, analyses: (mm.analyses || []).map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const deleteAnalysis = (a) => {
    if (!confirm(`Delete the saved analysis of "${a.fileName}"? The document itself and anything already applied stay.`)) return;
    setMgmt((mm) => ({ ...mm, analyses: (mm.analyses || []).filter((x) => x.id !== a.id) }));
  };
  const openAnalysis = (a) => setAiModal({ kind: a.kind, side: a.side, existing: a });
  // Keep the analysed document with the deal: upload a local file, or list a Drive file under Documents.
  const attachSource = async (source, analysisId, kindLabel) => {
    if (!source) return;
    if (source.kind === "drive") {
      const f = source.file;
      setMgmt((mm) =>
        mm.docs.some((d) => d.driveFileId === f.id)
          ? mm
          : { ...mm, docs: [...mm.docs, { id: uid(), type: "drive_file", driveFileId: f.id, name: f.name, mimeType: f.mimeType, size: f.size, kind: kindLabel, date: todayISO() }] },
      );
      updateAnalysis(analysisId, { driveFileId: f.id });
    } else {
      const doc = await uploadDealDoc(source.file, kindLabel);
      if (doc) updateAnalysis(analysisId, { driveFileId: doc.driveFileId });
    }
  };
  const driveApi = {
    search: (q) => withAuthRetry((tok) => driveSearchDocs(tok, q)),
    info: (id) => withAuthRetry((tok) => driveFileInfo(tok, id)),
    download: (f) => withAuthRetry((tok) => payloadFromDrive(tok, f)),
  };
  // An invoice becomes one ledger entry; the file is kept with the deal and attached to it.
  const applyInvoice = async ({ entry, source, keep }) => {
    const id = numId();
    setActuals((p) => [...p, { ...entry, tag: "invoice", files: [], id }]);
    setAiModal(null);
    addLogEntry(`Invoice logged: ${entry.label}, ${fmt(entry.amount)}`);
    setDriveMsg("✓ Added to the ledger");
    setTimeout(() => setDriveMsg(""), 2500);
    if (!keep || !source) return;
    let ref = null;
    if (source.kind === "drive") {
      const f = source.file;
      ref = { type: "drive_file", driveFileId: f.id, name: f.name, mimeType: f.mimeType, size: f.size };
      setMgmt((mm) => (mm.docs.some((d) => d.driveFileId === f.id) ? mm : { ...mm, docs: [...mm.docs, { id: uid(), ...ref, kind: "Invoice", date: todayISO() }] }));
    } else {
      const doc = await uploadDealDoc(source.file, "Invoice");
      if (doc) ref = { type: "drive_file", driveFileId: doc.driveFileId, name: doc.name, mimeType: doc.mimeType, size: doc.size };
    }
    if (ref) setActuals((p) => p.map((a) => (a.id === id ? { ...a, files: [...(a.files || []), ref] } : a)));
  };
  const applySow = ({ analysisId, milestones, review, opts, repairTotal: rt, contractor, source, docType }) => {
    const fresh = milestones.map((x) => ({ id: uid(), label: x.name, status: "todo", budget: x.cost, scope: x.scope, trade: x.trade, src: "sow" }));
    setMgmt((mm) => {
      let next = { ...mm, rehab: { ...mm.rehab, milestones: opts.mode === "append" ? [...mm.rehab.milestones, ...fresh] : fresh } };
      if (opts.addContact && contractor && !mm.contacts.some((c) => (c.name || c.company || "").toLowerCase() === contractor.toLowerCase()))
        next = { ...next, contacts: [...next.contacts, { id: uid(), role: "Contractor", name: contractor, company: "", phone: "", email: "" }] };
      return next;
    });
    if (opts.setRepair && rt > 0) {
      setUseRepairBuilder(false);
      setManualRepair(Math.round(rt));
    }
    const total = milestones.reduce((t, x) => t + x.cost, 0);
    addLogEntry(
      `${opts.mode === "append" ? "Added" : "Created"} ${milestones.length} milestones from the SOW${contractor ? ` (${contractor})` : ""}${total > 0 ? ` — ${fmt(total)}` : ""}${
        opts.setRepair && rt > 0 ? `; rehab estimate set to ${fmt(rt)}` : ""
      }`,
    );
    updateAnalysis(analysisId, { review, appliedAt: new Date().toISOString(), appliedBy: userEmail || "" });
    setAiModal(null);
    if (opts.saveDoc && source) attachSource(source, analysisId, `Scope of Work${docType ? ` (${docType})` : ""}`);
    setDriveMsg("✓ Milestones created");
    setTimeout(() => setDriveMsg(""), 2500);
  };
  const applyImport = ({ analysisId, side, lines, review, price, purchaseEntry, credits, closingDate, opts, source, docType }) => {
    const date = closingDate || todayISO();
    // Flip analysis (the estimate) is never changed by a statement: only the actuals are.
    const fixPurchase = side === "buy" && purchaseEntry && (opts.addPurchase || opts.replacePurchase);
    if (opts.addLedger || fixPurchase) {
      const tag = `stmt_${side}`;
      let entries = [];
      if (opts.addLedger) {
        const items = lines.map((l) => ({ cat: ledgerCatForTarget(l.target, side), label: l.description, amount: Math.round(l.amount * 100) / 100 }));
        if (opts.combine && items.length > 1) {
          // one entry per category; a category with a single line keeps that line's text
          const name = {
            Acquisition: "Closing costs from the purchase statement",
            Selling: "Closing costs from the sale statement",
            Holding: "Prorations and adjustments from the statement",
            Financing: "Lender fees and interest from the statement",
          };
          const by = {};
          items.forEach((it) => (by[it.cat] = by[it.cat] || []).push(it));
          entries = Object.entries(by).map(([cat, its]) => ({
            cat,
            label: its.length === 1 ? its[0].label : `${name[cat] || "From the statement"} (${its.length} items)`,
            amount: Math.round(its.reduce((t, x) => t + x.amount, 0) * 100) / 100,
            items: its.length > 1 ? its.map((x) => ({ label: x.label, amount: x.amount })) : undefined,
            date,
            tag,
          }));
        } else entries = items.map((it) => ({ ...it, date, tag }));
      }
      if (fixPurchase)
        entries.unshift({
          cat: "Acquisition",
          label: purchaseEntry.label,
          amount: purchaseEntry.amount,
          items: purchaseEntry.items && purchaseEntry.items.length > 1 ? purchaseEntry.items : undefined,
          date,
          tag: "purchase_price",
        });
      setActuals((p) => [
        ...p.filter((a) => !(opts.addLedger && opts.replacePrev && a.tag === tag) && !(fixPurchase && a.tag === "purchase_price")),
        ...entries.map((e) => ({ files: [], ...e, id: numId() })),
      ]);
    }
    // the seller's credits count in the ledger as credits (a re-import replaces the previous ones)
    if (side === "buy" && opts.countCredits) {
      const add = (credits || []).filter((c) => c.amount > 0).map((c) => ({ files: [], ...creditEntryFor(c, date), id: numId() }));
      setActuals((p) => [...p.filter((a) => a.tag !== STMT_CREDIT_TAG), ...add]);
      // credits kept aside by v43-v47 are now covered by these entries: the migration must not add them again
      setMgmt((mm) => (mm.credits && mm.credits.length ? { ...mm, credits: mm.credits.map((c) => ({ ...c, used: null, counted: true })) } : mm));
    }
    if (side === "sell" && opts.setPrice && price > 0) {
      setActualSale(price);
      setMgmt((mm) => ({ ...mm, sale: { ...mm.sale, date: mm.sale.date || closingDate || "" } }));
    }
    const costs = lines.reduce((s, l) => s + l.amount, 0);
    addLogEntry(`Imported ${side === "buy" ? "purchase" : "sale"} closing statement — ${lines.length} lines, ${fmt(costs)} in costs`);
    updateAnalysis(analysisId, { side, review, appliedAt: new Date().toISOString(), appliedBy: userEmail || "" });
    setAiModal(null);
    if (opts.saveDoc && source) attachSource(source, analysisId, `${side === "buy" ? "Purchase" : "Sale"} closing statement${docType ? ` (${docType})` : ""}`);
    setDriveMsg("✓ Statement applied");
    setTimeout(() => setDriveMsg(""), 2500);
  };
  const openFromPortfolio = (f) => loadDeal(f);
  const navCounts = stageCounts(driveFiles, summaries);
  // standard tasks a purchased property gets (insurance), as soon as the deal is in rehab
  useEffect(() => {
    setMgmt((mg) => withStandardTasks(mg, stage));
  }, [stage, mgmt.checklists]);
  // the Forecast tab is for deals between contract and sale
  useEffect(() => {
    if ((mode === "forecast" && !FC_STAGES.includes(stage)) || (mode === "schedule" && !GT_STAGES.includes(stage))) setMode("overview");
  }, [mode, stage]);
  const goProject = (k, anchor) => {
    setView("deal");
    setMode(normMode(k));
    if (anchor)
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 60);
    else window.scrollTo({ top: 0 });
  };
  const [railCollapsed, setRailCollapsed] = useState(readRailCollapsed);
  const toggleRail = () =>
    setRailCollapsed((c) => {
      try {
        localStorage.setItem(RAIL_KEY, c ? "0" : "1");
      } catch (e) {}
      return !c;
    });
  const goPortfolio = () => {
    setLoadOpen(false);
    setView("portfolio");
    window.scrollTo({ top: 0 });
  };
  // ---- Back / Forward: each screen (dashboard, deal + tab) is a browser history entry ----
  // The URL doesn't change; the screen lives in history.state, with the scroll position.
  const loadedId = loadedRef.current ? loadedRef.current.id : null;
  const screen = view === "deal" ? { v: "deal", f: loadedId, m: mode } : { v: "portfolio", d: normDash(pfFilter) };
  const screenKey = JSON.stringify(screen);
  const navRef = useRef({ ready: false, target: null, timer: null });
  const [navIndex, setNavIndex] = useState(0);
  useEffect(() => {
    const n = navRef.current;
    const hs = window.history.state || {};
    const st = { ...screen, key: screenKey, i: hs.i || 0, y: 0 };
    try {
      if (!n.ready) {
        // first render (or a reload): keep the position in the history stack
        n.ready = true;
        try {
          window.history.scrollRestoration = "manual";
        } catch (e) {}
        window.history.replaceState({ ...st, y: hs.key === screenKey ? hs.y || 0 : 0 }, "");
        setNavIndex(st.i);
        return;
      }
      if (n.target) {
        // restoring an entry after Back / Forward: update it, don't add one
        window.history.replaceState({ ...st, y: hs.y || 0 }, "");
        if (n.target === screenKey) n.target = null;
        return;
      }
      if (hs.key === screenKey) return;
      // a new deal that was just saved for the first time is still the same screen
      if (hs.v === "deal" && !hs.f && screen.v === "deal" && screen.f && hs.m === screen.m) {
        window.history.replaceState({ ...st, y: hs.y || 0 }, "");
        return;
      }
      window.history.pushState({ ...st, i: (hs.i || 0) + 1 }, "");
      setNavIndex((hs.i || 0) + 1);
    } catch (e) {}
  }, [screenKey]);
  // remember the scroll position of the current entry
  useEffect(() => {
    let t = null;
    const h = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        try {
          const hs = window.history.state;
          if (hs && hs.key) window.history.replaceState({ ...hs, y: Math.round(window.scrollY) }, "");
        } catch (e) {}
      }, 400);
    };
    window.addEventListener("scroll", h, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", h);
    };
  }, []);
  const popRef = useRef(null);
  popRef.current = (e) => {
    const s = e.state;
    if (!s || !s.v) return;
    const n = navRef.current;
    const restoreScroll = () => setTimeout(() => window.scrollTo(0, s.y || 0), 60);
    const settle = () => {
      clearTimeout(n.timer);
      n.timer = setTimeout(() => (n.target = null), 3000);
    };
    setNavIndex(s.i || 0);
    if (s.v === "portfolio") {
      n.target = s.key;
      setLoadOpen(false);
      setView("portfolio");
      setPfFilter(s.d);
      restoreScroll();
      return;
    }
    const cur = loadedRef.current ? loadedRef.current.id : null;
    if (s.f === cur) {
      n.target = s.key;
      setView("deal");
      setMode(normMode(s.m));
      restoreScroll();
      return;
    }
    // a different deal: open it from Drive (asking first if this one has unsaved changes)
    const file = s.f ? driveFiles.find((x) => x.id === s.f) : null;
    if (!file || !accessToken) {
      n.target = JSON.stringify({ v: "portfolio", d: normDash(pfFilter) });
      setView("portfolio");
      return;
    }
    const go = () => {
      n.target = s.key;
      openDeal(file).then(() => {
        if (loadedRef.current && loadedRef.current.id === s.f && s.m !== "overview") setMode(normMode(s.m));
        settle();
      });
    };
    if (!dirty) return go();
    const here = { ...screen, key: screenKey, i: (s.i || 0) + 1, y: Math.round(window.scrollY) };
    flushSave().then((ok) => {
      if (ok) return go();
      // can't save: stay on this deal until the user decides; put its entry back
      try {
        window.history.pushState(here, "");
        setNavIndex(here.i);
      } catch (err) {}
      if (!conflictRef.current) setPendingAction({ kind: "load", file });
    });
  };
  useEffect(() => {
    const h = (e) => popRef.current && popRef.current(e);
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);
  const goBack = () => window.history.back();
  const gradeCardRef = useRef(null);
  const [showStickyGrade, setShowStickyGrade] = useState(false);
  useEffect(() => {
    const el = gradeCardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setShowStickyGrade(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: "-8px 0px 0px 0px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [mode, view]);
  const STICKY_COLLAPSED_KEY = "kappa_sticky_grade_collapsed";
  const [stickyCollapsed, setStickyCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STICKY_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STICKY_COLLAPSED_KEY, stickyCollapsed ? "1" : "0");
    } catch {}
  }, [stickyCollapsed]);
  const stickyFullRef = useRef(null);
  const stickyTabRef = useRef(null);
  const stickyViaKey = useRef(false);
  const stickyFullOn = showStickyGrade && !stickyCollapsed;
  const stickyTabOn = showStickyGrade && stickyCollapsed;
  const toggleStickyGrade = (e) => {
    if (e && e.type === "click" && e.currentTarget) e.currentTarget.blur();
    setStickyCollapsed((c) => !c);
  };
  const stickyKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      stickyViaKey.current = true;
      toggleStickyGrade();
    }
  };
  useEffect(() => {
    if (!stickyViaKey.current) return;
    stickyViaKey.current = false;
    const t = stickyCollapsed ? stickyTabRef.current : stickyFullRef.current;
    if (t)
      t.focus({
        preventScroll: true,
      });
  }, [stickyCollapsed]);
  // Deals from v43-v47 kept the seller's credit aside for the tax bill. It counts in the ledger now:
  // an unused one becomes a credit entry (once), a used one is already inside its tax bill entry.
  // A credit already in the ledger (a later statement import re-adds them) is never added twice; and a credit
  // entry the migration added beside an identical imported one (v48-v52 could do that) is removed once.
  useEffect(() => {
    const credits = mgmt.credits || [];
    if (!credits.length) return;
    const same = (e, c) => e.tag === STMT_CREDIT_TAG && Math.abs(num(e.amount) + Math.abs(num(c.amount))) < 0.005 && e.label === creditEntryFor(c, "").label;
    const twin = (e, c) => actuals.find((x) => x.id !== e.id && same(x, c));
    const dupes = credits.map((c) => { const e = c.used && actuals.find((x) => x.id === c.used && same(x, c)); return e && twin(e, c) ? { c, e, keep: twin(e, c) } : null; }).filter(Boolean);
    const open = credits.filter((c) => !c.counted && (!c.used || !actuals.some((x) => x.id === c.used)));
    const found = open.map((c) => actuals.find((x) => same(x, c)) || null);
    if (!dupes.length && !open.length) return;
    const add = open.map((c, i) => (found[i] ? null : { files: [], ...creditEntryFor(c, c.date || todayISO()), id: numId() }));
    const drop = new Set(dupes.map((x) => x.e.id));
    // the kept entry takes over any files attached to the one removed
    const moveFiles = (x) => { const d = dupes.find((y) => y.keep.id === x.id && (y.e.files || []).length); return d ? { ...x, files: [...(x.files || []), ...d.e.files] } : x; };
    setActuals((p) => [...p.filter((x) => !drop.has(x.id)).map(moveFiles), ...add.filter(Boolean)]);
    setMgmt((mm) => ({
      ...mm,
      credits: (mm.credits || []).map((x) => {
        const d = dupes.find((y) => y.c.id === x.id);
        if (d) return { ...x, used: d.keep.id, counted: true };
        const i = open.findIndex((c) => c.id === x.id);
        return i < 0 ? x : { ...x, used: (found[i] || add[i]).id, counted: true };
      }),
    }));
    dupes.forEach((d) => addLogEntry(`Removed a duplicate ledger entry: ${d.e.label} (${fmt2(d.e.amount)})`));
  }, [mgmt.credits]);
  const [fileUploading, setFileUploading] = useState(null);
  // attach files to a ledger entry (from the document viewer)
  const uploadEntryFiles = async (entryId, files) => {
    if (!files.length || !entryId) return;
    if (!accessToken) {
      setDriveMsg("⚠ Connect Google Drive first");
      setTimeout(() => setDriveMsg(""), 3000);
      return;
    }
    if (!settings.folderId) {
      setDriveMsg("⚠ Set folder ID first");
      setTimeout(() => setDriveMsg(""), 3000);
      return;
    }
    setFileUploading(entryId);
    try {
      const uploaded = await withAuthRetry(async (tok) => {
        const results = [];
        for (const file of files) {
          const result = await driveUploadFile(tok, settings.folderId, file);
          results.push({ type: "drive_file", driveFileId: result.id, name: result.name, mimeType: result.mimeType, size: result.size });
        }
        return results;
      });
      setActuals((prev) => prev.map((a) => (a.id === entryId ? { ...a, files: [...(a.files || []), ...uploaded] } : a)));
      setDriveMsg(`✓ ${uploaded.length} file(s) uploaded`);
      setTimeout(() => setDriveMsg(""), 2500);
    } catch (err) {
      setDriveMsg("❌ " + err.message);
    } finally {
      setFileUploading(null);
    }
  };
  const addEntryLink = (entryId, url, label) => {
    const u = String(url || "").trim();
    if (!u) return;
    const href = /^https?:\/\//i.test(u) ? u : "https://" + u;
    const entry = { type: "link", url: href, name: String(label || "").trim() || href.replace(/.*\//, "").slice(0, 40) || "Link" };
    setActuals((prev) => prev.map((a) => (a.id === entryId ? { ...a, files: [...(a.files || []), entry] } : a)));
  };
  const removeAttachment = async (entryId, fileRef) => {
    if (fileRef.driveFileId && accessToken) {
      try {
        await withAuthRetry((tok) => driveDelete(tok, fileRef.driveFileId));
      } catch {}
    }
    setActuals((prev) =>
      prev.map((a) =>
        a.id === entryId
          ? {
              ...a,
              files: (a.files || []).filter((f) => f !== fileRef),
            }
          : a,
      ),
    );
  };
  const openAttachment = (f) => {
    if (f.type === "link") window.open(f.url, "_blank");
    else window.open(`https://drive.google.com/file/d/${f.driveFileId}/view`, "_blank");
  };
  const handleCMAFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (!accessToken) {
      setDriveMsg("⚠ Connect Google Drive first");
      setTimeout(() => setDriveMsg(""), 3000);
      return;
    }
    setDriveLoading(true);
    try {
      const uploaded = await withAuthRetry(async (tok) => {
        const results = [];
        for (const file of files) {
          const result = await driveUploadFile(tok, settings.folderId, file);
          results.push({
            type: "drive_file",
            driveFileId: result.id,
            name: result.name,
            mimeType: result.mimeType,
            size: result.size,
          });
        }
        return results;
      });
      setCmaFiles((prev) => [...prev, ...uploaded]);
      setDriveMsg(`✓ CMA uploaded`);
      setTimeout(() => setDriveMsg(""), 2000);
    } catch (err) {
      setDriveMsg("❌ " + err.message);
    } finally {
      setDriveLoading(false);
      e.target.value = "";
    }
  };
  const exportCSV = () => {
    const n = (v) => (typeof v === "number" && isFinite(v) ? Math.round(v * 100) / 100 : "");
    const pc = (v) => (typeof v === "number" && isFinite(v) ? (v * 100).toFixed(1) + "%" : "");
    const txnRows = (items, basis, typeOv = {}, labelOv = {}) =>
      TXN_TEMPLATE.filter((t) => items[t.key] && items[t.key].on).map((t) => {
        const it = items[t.key];
        const typ = it.type || typeOv[t.key] || t.type;
        const val = parseFloat(it.val) || 0;
        return [labelOv[t.key] || t.label, typ === "pct" ? val + "%" : "flat", n(typ === "pct" ? (val / 100) * basis : val)];
      });
    const repairRows = useRepairBuilder
      ? repairs.filter((r) => r.qty > 0).map((r) => [r.group, r.label, r.lump ? "lump" : r.qty, n(r.price), n(r.lump ? r.price : r.qty * r.price)])
      : [["Manual total", "", "", "", n(manualRepair)]];
    const zillow = address.trim() ? `https://www.zillow.com/homes/${encodeURIComponent(address.trim())}_rb/` : "";
    const rows = [
      ["KAPPA REAL ESTATE \u2014 Deal Breaker"],
      ["Property", address],
      ["Stage", stageMeta(stage).label, "Source", mgmt.source || ""],
      ["Analysis date", analysisDate, "Exported", new Date().toISOString().slice(0, 10)],
      ["Year built", yearBuilt || "", "Sq ft", sqft || "", "Hold (months)", holdMonths],
      [],
      ["GRADE"],
      ["Grade", deal.grade, "Risk level", deal.riskLevel, "Target profit", n(deal.threshold)],
      [
        "Profit vs target",
        pc(deal.ratio),
        "Base grade",
        deal.initialGrade,
        "Adjustments",
        deal.adj.map((a) => `${a.label} ${a.delta > 0 ? "+" : ""}${a.delta}`).join("; ") || "none",
      ],
      ["Verdict", deal.verdict],
      [],
      ["KEY METRICS"],
      ["Net profit", n(m.netProfit), "ROI", pc(m.roi), "ROI annualized", pc(m.roiAnnual)],
      ["Cash-on-cash (ann.)", pc(m.cashOnCashAnnual), "Kappa cash in", n(m.cashIn), "Loan amount", n(m.loanAmount)],
      ["Max allowable offer", n(mao.target), "Walk-away price", n(mao.walk), "Cost per sq ft", n(m.costPerSqft)],
      [],
      ["PROFIT & LOSS"],
      ["After repair value", n(arv)],
      ["Purchase price", n(-purchase)],
      ["Repairs", n(-m.repair)],
      ["Financing", n(-m.totalFinancing), "interest", n(m.interest), "investor return", n(m.investorInterest), "points", n(points)],
      ["Holding", n(-m.totalHolding), "per month", n(m.totalMonthlyHold)],
      ["Project manager", n(-(m.pmFee || 0)), pm.type === "flat" ? "fixed amount" : `${pm.val || 0}% of rehab`],
      ["Buying costs", n(-m.totalBuying)],
      ["Selling costs", n(-m.totalSelling)],
      ["NET PROFIT", n(m.netProfit)],
      [],
      ["FINANCING"],
      ["Loan on purchase", pc(loanOnPurchasePct), "Purchase rate", pc(intRatePurchase)],
      [
        "Loan on rehab",
        pc(loanOnRehabPct),
        "Rehab rate",
        pc(intRateRehab),
        "Funding",
        rehabFunding === "draws" ? `Lender draws (${drawCount} over ${drawMonths} mo, fee ${n(drawFee)})` : "Kappa internal loan",
      ],
      ["Purchase loan from", purchaseLender === "kappa" ? "Kappa internal loan" : "Outside lender"],
      ["Investor amount", n(m.investorAmount), "Investor return", pc(investorRate)],
      [],
      ["HOLDING (monthly)"],
      ["Property taxes", n(taxAnnual / 12), "Insurance", n(insMonthly), "HOA", n(hoaMonthly)],
      ["Gas", n(utilGas), "Water", n(utilWater), "Electric", n(utilElec), "Misc", n(miscHold)],
      [],
      ["BUYING TRANSACTION COSTS", "basis", "amount"],
      ...txnRows(buyTxn, purchase, BUY_TYPE_OVERRIDES, BUY_LABEL_OVERRIDES),
      [],
      ["SELLING TRANSACTION COSTS", "basis", "amount"],
      ...txnRows(sellTxn, arv),
      [],
      ["REPAIRS", "item", "qty", "unit price", "total"],
      ...repairRows,
      ["Total repairs", "", "", "", n(m.repair)],
      [],
      ["ACTUALS LEDGER", "category", "description", "amount"],
      ...[...actuals]
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        .map((a) => [a.date || "", a.cat, a.label, n(parseFloat(a.amount) || 0)]),
      ["Total spent", "", "", n(actualsTotal)],
      ["Actual sale price", "", "", salePending ? "pending" : n(actualSale)],
      ["Actual profit", "", "", salePending ? "pending" : n(actualProfit)],
      [uwBaseline ? "Variance vs original underwriting" : "Variance vs underwrite", "", "", salePending ? "pending" : n(variance)],
      [],
      ["ORIGINAL UNDERWRITING"],
      uwBaseline
        ? ["Frozen", uwBaseline.date, "Net profit", n(uwBaseline.m.netProfit), "Grade", uwBaseline.grade, "By", uwBaseline.by || ""]
        : ["Not frozen yet (taken when the deal goes under contract)"],
      [],
      ["FLIP TIMELINE", "date"],
      ["Contract signed", mgmt.contract.date || "", "price", n(num(mgmt.contract.price))],
      ["Inspection period ends", mgmt.contract.inspectionEnd || ""],
      ["Expected closing", mgmt.contract.expectedClosing || "", "EMD", n(num(mgmt.contract.emd))],
      ["Purchase closed", mgmt.closing.date || "", "price", n(num(mgmt.closing.price))],
      ["Rehab start", mgmt.rehab.startDate || "", "target", mgmt.rehab.targetEnd || "", "completed", mgmt.rehab.endDate || ""],
      ["Milestones complete", (milestonePct(mgmt.rehab.milestones) || 0) + "%"],
      ["Listed", mgmt.listing.date || "", "list price", n(num(mgmt.listing.price))],
      ...mgmt.listing.prices.map((p, i) => [i === 0 ? "Original list price" : "Price change", p.date, "", n(num(p.price))]),
      ["Buyer under contract", mgmt.buyer.date || "", "price", n(num(mgmt.buyer.price)), "expected closing", mgmt.buyer.expectedClosing || ""],
      ["Sold", mgmt.sale.date || "", "price", salePending ? "" : n(actualSale)],
      ...(rehabFunding === "draws" ? [[], ["DRAWS", "requested", "received", "amount", "fee"], ...mgmt.draws.map((d, i) => [`#${i + 1}`, d.requested, d.received || "pending", n(num(d.amount)), n(num(d.fee))])] : []),
      [],
      ["ACTIVITY LOG", "when", "by"],
      ...mgmt.log.map((l) => [l.text, l.ts ? l.ts.slice(0, 16).replace("T", " ") : "", l.by || ""]),
      [],
      ["LINKS"],
      ["Zillow", zillow],
      ["Photos folder", photosUrl || ""],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kappa_${(address || "deal").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <div
      className="kappa-root"
      onFocus={(e) => {
        if (e.target && e.target.tagName === "INPUT" && e.target.type === "number") {
          e.target.select();
        }
      }}
      style={{
        background: T.bg,
        color: T.txt,
        minHeight: "100vh",
        fontFamily: FONT,
      }}
    >
      {view === "deal" && mode === "underwrite" && (
        <GradeExplainer deal={deal} repair={m.repair} holdMonths={holdMonths} netProfit={m.netProfit} visible={gradeHover && !deal.incomplete} anchorRef={gradeCardRef} />
      )}
      {pendingAction && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.55)",
            backdropFilter: "blur(4px)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setPendingAction(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={gp({
              padding: "26px 28px",
              maxWidth: 460,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
            })}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0",
                color: T.txtDim,
                fontWeight: 700,
              }}
            >
              {pendingAction.kind === "load" ? "Open Saved Deal" : "Start New Deal"}
            </div>
            <h3
              style={{
                margin: "8px 0 6px",
                fontSize: 19,
                fontWeight: 800,
                color: T.txt,
              }}
            >
              Save the current deal first?
            </h3>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 13.5,
                lineHeight: 1.55,
                color: T.txtDim,
              }}
            >
              {(address.trim()
                ? `\u201c${address.trim()}\u201d has changes that aren't saved to Drive.`
                : "This analysis has unsaved work \u2014 add an address to save it.") +
                (pendingAction.kind === "load"
                  ? ` Save before opening \u201c${pendingAction.file.name.replace(/\.json$/, "")}\u201d, or discard them.`
                  : " Save before clearing, or discard and start fresh.")}
            </p>
            <div
              style={{
                display: "flex",
                gap: 9,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={saveThenProceed}
                disabled={!address.trim()}
                style={{
                  ...bs(address.trim() ? T.teal + "1f" : T.glass, address.trim() ? T.teal : T.txtMute),
                  fontWeight: 700,
                  cursor: address.trim() ? "pointer" : "not-allowed",
                  flex: "1 1 auto",
                }}
              >
                {pendingAction.kind === "load" ? "Save and open" : "Save and start new"}
              </button>
              <button
                onClick={discardThenProceed}
                style={{
                  ...bs(T.glass, T.red),
                  fontWeight: 700,
                  flex: "1 1 auto",
                }}
              >
                {pendingAction.kind === "load" ? "Discard and open" : "Discard and start new"}
              </button>
              <button
                onClick={() => setPendingAction(null)}
                style={{
                  ...bs(T.glass, T.txtDim),
                  flex: "0 0 auto",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          connected={!!accessToken}
          team={teamFile}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {transition && (
        <TransitionModal
          kind={transition}
          ctx={{
            mgmt,
            purchase,
            arv,
            holdMonths,
            m,
            actuals,
            stage,
            rehabFunding,
            purchaseLender,
            intRateRehab,
            intRatePurchase,
            preview: (p) => {
              const s = snapshotFor({ purchase: p });
              return { netProfit: s.m.netProfit, grade: s.grade };
            },
          }}
          onConfirm={(f) => applyTransition(transition, f)}
          onClose={() => setTransition(null)}
        />
      )}
      {conflict && (
        <ConflictModal
          conflict={conflict}
          onClose={() => setConflict(null)}
          onOverwrite={() => {
            const c = conflict;
            setConflict(null);
            doSave(accessToken, { force: true, cb: c.cb });
          }}
          onOpenTheirs={() => {
            const c = conflict;
            setConflict(null);
            openDeal({ id: c.meta.id, name: c.meta.name || c.name, modifiedTime: c.meta.modifiedTime });
          }}
        />
      )}
      {aiModal && aiModal.kind === "closing" && (
        <ClosingImportModal
          initialSide={aiModal.side}
          initialSource={aiModal.source || null}
          existing={aiModal.existing || null}
          apiKey={settings.anthropicKey}
          driveApi={driveApi}
          ctx={{
            stage,
            actuals,
            address,
            purchase,
            origin: aiModal.origin,
            analyses: mgmt.analyses,
            dealDocs: mgmt.docs,
            connected: !!accessToken && !!settings.folderId,
            hasBaseline: !!uwBaseline,
          }}
          onAnalyzed={saveAnalysis}
          onApply={applyImport}
          onClose={() => setAiModal(null)}
          onOpenSettings={() => {
            setAiModal(null);
            setShowSettings(true);
          }}
        />
      )}
      {aiModal && aiModal.kind === "sow" && (
        <SowImportModal
          initialSource={aiModal.source || null}
          existing={aiModal.existing || null}
          apiKey={settings.anthropicKey}
          driveApi={driveApi}
          ctx={{
            stage,
            address,
            repair: repairTotal,
            milestones: mgmt.rehab.milestones,
            contacts: mgmt.contacts,
            analyses: mgmt.analyses,
            dealDocs: mgmt.docs,
            connected: !!accessToken && !!settings.folderId,
            hasBaseline: !!uwBaseline,
          }}
          onAnalyzed={saveAnalysis}
          onApply={applySow}
          onClose={() => setAiModal(null)}
          onOpenSettings={() => {
            setAiModal(null);
            setShowSettings(true);
          }}
        />
      )}
      {aiModal && aiModal.kind === "invoice" && (
        <InvoiceImportModal
          apiKey={settings.anthropicKey}
          initialSource={aiModal.source || null}
          driveApi={driveApi}
          ctx={{ connected: !!accessToken && !!settings.folderId, dealDocs: mgmt.docs }}
          budgetLines={rehabBudgetLines({ milestones: mgmt.rehab.milestones, repairs, useRepairBuilder, repairTotal }).lines}
          onApply={applyInvoice}
          onClose={() => setAiModal(null)}
          onOpenSettings={() => {
            setAiModal(null);
            setShowSettings(true);
          }}
        />
      )}
      {driveMsg && (
        <div className="toast no-print" role="status">
          <i style={{ background: driveMsg.startsWith("✓") ? "#6FD3A0" : driveMsg.startsWith("⚠") ? "#F4C430" : "#FF8A80" }} />
          {driveMsg.replace(/^[✓⚠❌]\s*/, "")}
        </div>
      )}
      <div className={"app-shell" + (railCollapsed ? " rail-collapsed" : "")}>
        <Sidebar
          logo={LOGO}
          view={view}
          filter={normDash(pfFilter)}
          onFilter={(k) => {
            setPfFilter(k);
            goPortfolio();
          }}
          counts={{ ...navCounts, tasks: allTasks.length }}
          project={
            view !== "deal" && address.trim()
              ? {
                  name: splitAddress(address)[0],
                  mode,
                  dirty,
                  go: goProject,
                }
              : null
          }
          onNew={requestNewDeal}
          onSettings={() => setShowSettings(true)}
          collapsed={railCollapsed}
          onToggle={toggleRail}
        />
        <main className="app-main">
          <TopBar
            crumbs={
              view === "portfolio"
                ? [{ label: "Dashboards" }, { label: DASH_META[normDash(pfFilter)].title }]
                : [
                    {
                      label: DASH_META[dashOfStage(stage)].title,
                      onClick: () => {
                        setPfFilter(dashOfStage(stage));
                        goPortfolio();
                      },
                    },
                    { label: address.trim() ? splitAddress(address)[0] : "New deal", switcher: true },
                  ]
            }
            connected={!!accessToken}
            userEmail={userEmail}
            onConnect={signIn}
            onBack={navIndex > 0 ? goBack : null}
            finder={{ files: driveFiles, summaries, onOpen: (f) => loadDeal(f), onDelete: deleteDeal, onRefresh: () => refreshFiles() }}
            bell={accessToken ? <TaskBell tasks={allTasks} seenAt={tasksSeen} onSeen={markTasksSeen} onOpenTask={openTasksScreen} onOpenAll={() => openTasksScreen(null)} /> : null}
            tabs={view === "deal" ? <ProjectTabs mode={mode} go={goProject} counts={{ expenses: actuals.length }} hide={[...(FC_STAGES.includes(stage) ? [] : ["forecast"]), ...(GT_STAGES.includes(stage) ? [] : ["schedule"])]} /> : null}
          />
          <div className={"app-main-inner" + (view === "deal" && mode === "schedule" ? " wide" : "")}>
        {view === "portfolio" && normDash(pfFilter) === "tasks" ? (
          <TasksScreen
            tasks={allTasks}
            done={doneTasks}
            files={driveFiles.map((f) => ({ id: f.id, address: f.name.replace(/\.json$/i, ""), st: summaries[f.id] && summaries[f.id].st }))}
            busy={taskBusy}
            onSeen={markTasksSeen}
            onToggle={toggleTaskAnywhere}
            onDue={setTaskDueAnywhere}
            onAdd={addTaskAnywhere}
            onOpen={openTaskProject}
            onOpenPm={openPmPanel}
            onOpenSchedule={(t) => openTaskProject(t.fid, "schedule")}
            focus={taskFocus}
          />
        ) : view === "portfolio" && normDash(pfFilter) === "costs" ? (
          <CostSearch
            files={driveFiles}
            index={ledgerIndex}
            live={
              loadedRef.current && address.trim()
                ? { ...ledgerIndexEntry({ address, actuals, mgmt, stage }, loadedRef.current.modifiedTime, ""), st: stage, id: loadedRef.current.id }
                : null
            }
            busy={indexBusy}
            query={costQuery}
            setQuery={setCostQuery}
            onOpen={openCostResult}
          />
        ) : view === "portfolio" ? (
          <React.Fragment>
          <Dashboard
            filter={pfFilter}
            files={driveFiles}
            summaries={summaries}
            busy={summaryBusy}
            connected={!!accessToken}
            hasClientId={!!settings.clientId}
            teamSetup={accessToken && !settings.folderId ? teamSetup || { status: "searching" } : null}
            userEmail={userEmail}
            onRetrySetup={() => findTeamFolder()}
            invited={!!pendingInvite()}
            onConnect={signIn}
            onOpenSettings={() => setShowSettings(true)}
            onOpen={openFromPortfolio}
            onNew={requestNewDeal}
            onRefresh={() => refreshFiles()}
          />
          </React.Fragment>
        ) : (
        <React.Fragment>
        <ProjectHeader
          address={address}
          setAddress={setAddress}
          stage={stage}
          health={liveHealth}
          context={dealContext}
          dirty={dirty}
          saving={driveLoading}
          autoSave={dirty && canAutosave && !autoHeld ? (autoSave.status === "error" ? autoSave : { status: "saving" }) : autoSave}
          autoBlocked={
            !dirty
              ? null
              : !accessToken
                ? "connect"
                : !addressReady
                  ? "address"
                  : !settings.folderId
                    ? "folder"
                    : conflict || autoSave.status === "conflict"
                      ? "conflict"
                      : autoHeld && autoSave.status === "exists"
                        ? "exists"
                        : null
          }
          onSave={saveDeal}
          onExportCsv={exportCSV}
          onPrint={() => window.print()}
          actions={<StageActions stage={stage} mgmt={mgmt} onAction={(k) => setTransition(k)} />}
        />
        {mode === "overview" ? (
          <ProjectOverview
            address={address}
            mapsKey={settings.mapsApiKey}
            folderId={settings.folderId}
            photosUrl={photosUrl}
            setPhotosUrl={setPhotosUrl}
            sqft={sqft}
            yearBuilt={yearBuilt}
            arv={arv}
            purchase={purchase}
            stage={stage}
            mgmt={mgmt}
            setMgmt={setMgmt}
            m={m}
            deal={deal}
            mao={mao}
            uwBaseline={uwBaseline}
            actuals={actuals}
            actualSale={actualSale}
            analysisDate={analysisDate}
            health={liveHealth}
            onGo={goProject}
            userEmail={userEmail}
            addLog={addLogEntry}
            onUploadDoc={(f, kind) => uploadDealDoc(f, kind)}
            openAttachment={openAttachment}
            connected={!!accessToken && !!settings.folderId}
            uw={posUw}
            setActuals={setActuals}
            position={positionProps}
          />
        ) : mode === "underwrite" ? (
          <React.Fragment>
            <BaselineBanner uwBaseline={uwBaseline} current={m.netProfit} grade={deal.grade} stage={stage} onRefreeze={refreezeBaseline} onFreeze={freezeBaseline} />
            <div className="uw-layout">
              <div className="uw-main">
                <section className="uw-basics">
                  <div className="uw-basics-head">
                    <h2>The deal</h2>
                    <span>{arv > 0 && sqft > 0 ? `${fmt(arv / sqft)} per sq ft after repair` : ""}</span>
                  </div>
                  <div className="uw-basics-grid">
                    <Field label="After repair value (ARV)" value={arv} onChange={setArv} prefix="$" step={1000} />
                    <Field label="Purchase price" value={purchase} onChange={setPurchase} prefix="$" step={1000} />
                    <Field label="Hold time" value={holdMonths} onChange={setHoldMonths} suffix="months" />
                    <Field label="Square footage" value={sqft} onChange={setSqft} suffix="sq ft" />
                    <Field label="Year built" value={yearBuilt} onChange={setYearBuilt} step={1} hint="reference only" />
                    <TextIn label="Analysis date" type="date" value={analysisDate} onChange={setAnalysisDate} />
                  </div>
                </section>
                <Group
                  id="rehab"
                  title="Rehab estimate"
                  sub={useRepairBuilder ? `${repairs.filter((r) => r.qty > 0).length} line items` : "One total amount"}
                  total={fmt(repairTotal)}
                  actions={
                    <button className="no-print grp-btn" onClick={() => setAiModal({ kind: "sow" })} title="Read a contractor's scope of work: milestones and rehab budget">
                      Read SOW
                    </button>
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      marginBottom: 14,
                    }}
                  >
                    {[
                      ["Manual total", false],
                      ["Itemized", true],
                    ].map(([lbl, val]) => (
                      <button
                        key={lbl}
                        onClick={() => setUseRepairBuilder(val)}
                        style={{
                          padding: "7px 16px",
                          borderRadius: 4,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: FONT,
                          border: `1px solid ${useRepairBuilder === val ? T.teal : T.border}`,
                          background: useRepairBuilder === val ? `${T.teal}26` : "transparent",
                          color: useRepairBuilder === val ? T.tealLt : T.txtDim,
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {!useRepairBuilder ? (
                    <div
                      style={{
                        maxWidth: 320,
                      }}
                    >
                      <Field label="Total repair estimate" value={manualRepair} onChange={setManualRepair} prefix="$" step={500} />
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                        gap: 20,
                      }}
                    >
                      {groups.map((g) => (
                        <div key={g}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0",
                              color: T.tealLt,
                              marginBottom: 8,
                              paddingBottom: 5,
                              borderBottom: `1px solid ${T.border}`,
                            }}
                          >
                            {g}
                          </div>
                          {repairs.map(
                            (r, i) =>
                              r.group === g && (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "4px 0",
                                    borderBottom: `1px solid ${T.border}44`,
                                  }}
                                >
                                  <input
                                    type="number"
                                    onFocus={(e) => e.target.select()}
                                    value={r.qty}
                                    min={0}
                                    onChange={(e) => updateRepair(i, "qty", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                                    style={{
                                      width: 40,
                                      padding: "4px 5px",
                                      border: `1px solid ${T.border}`,
                                      borderRadius: 7,
                                      fontSize: 12,
                                      fontFamily: MONO,
                                      background: T.inputBg,
                                      color: T.txt,
                                      textAlign: "center",
                                    }}
                                  />
                                  <span
                                    style={{
                                      flex: 1,
                                      fontSize: 12,
                                      color: r.qty > 0 ? T.txt : T.txtMute,
                                      minWidth: 0,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {r.label}
                                  </span>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                      flexShrink: 0,
                                    }}
                                    title="Unit price — click to edit"
                                  >
                                    <span
                                      style={{
                                        fontSize: 9,
                                        color: T.txtMute,
                                      }}
                                    >
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      onFocus={(e) => e.target.select()}
                                      value={r.price}
                                      min={0}
                                      step={100}
                                      onChange={(e) => updateRepair(i, "price", parseFloat(e.target.value) || 0)}
                                      style={{
                                        width: 66,
                                        padding: "3px 5px",
                                        border: `1px solid ${T.border}`,
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontFamily: MONO,
                                        background: T.inputBg,
                                        color: T.txtDim,
                                        textAlign: "right",
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: r.qty > 0 ? T.teal : T.txtMute,
                                      fontFamily: MONO,
                                      width: 54,
                                      textAlign: "right",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {fmt(r.lump ? (r.qty > 0 ? r.price : 0) : r.qty * r.price)}
                                  </span>
                                </div>
                              ),
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                                </Group>
                <Group
                  id="pm"
                  title="Project manager"
                  sub={!(m.pmFee > 0) ? "No fee" : pm.type === "flat" ? "Fixed amount, paid out of pocket" : `${+(pm.val || 0)}% of the rehab estimate, paid out of pocket`}
                  total={fmt(m.pmFee || 0)}
                >
                  <div className="pm-row">
                    <div className="seg" role="group" aria-label="How the fee is set">
                      <button className={pm.type !== "flat" ? "on" : ""} onClick={() => setPm({ type: "pct", val: pm.type === "flat" ? 0 : pm.val })}>
                        % of rehab
                      </button>
                      <button className={pm.type === "flat" ? "on" : ""} onClick={() => setPm({ type: "flat", val: pm.type === "flat" ? pm.val : 0 })}>
                        Fixed amount
                      </button>
                    </div>
                    {pm.type === "flat" ? (
                      <Field label="Fee for this project" value={pm.val || 0} onChange={(v) => setPm({ type: "flat", val: v })} prefix="$" step={500} />
                    ) : (
                      <Field
                        label="Fee"
                        value={pm.val || 0}
                        onChange={(v) => setPm({ type: "pct", val: v })}
                        suffix="% of rehab"
                        step={1}
                        hint={`${fmt(m.pmFee || 0)} on a ${fmt(m.repair || 0)} rehab`}
                      />
                    )}
                  </div>
                  <p className="pm-note">
                    Paid out of pocket in installments as the flip moves along (set them on the Expenses page), so no interest. It isn't part of the rehab
                    budget, so it doesn't change the deal's size class; it does lower the profit, ROI and grade.
                  </p>
                </Group>
                <Group id="financing" title="Financing" sub={financingSub} total={fmt(m.totalFinancing)}>
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ display: "block", fontSize: 11, color: T.txtDim, marginBottom: 5, fontWeight: 600 }}>Purchase loan from</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="Purchase loan from">
                      {[
                        ["lender", "Outside lender"],
                        ["kappa", "Kappa internal loan"],
                      ].map(([k, l]) => (
                        <button
                          key={k}
                          aria-pressed={purchaseLender === k}
                          onClick={() => {
                            setPurchaseLender(k);
                            // the deal's own loan terms, if entered, follow the choice
                            setMgmt((mm) => {
                              const L = mm.financing && mm.financing.lender;
                              if (!L) return mm;
                              const name = k === "kappa" ? "Kappa internal loan" : L.name === "Kappa internal loan" ? "" : L.name;
                              return { ...mm, financing: { ...mm.financing, lender: { ...L, kind: k, name } } };
                            });
                          }}
                          style={{
                            padding: "7px 14px",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: FONT,
                            border: `1px solid ${purchaseLender === k ? T.violet : T.border}`,
                            background: purchaseLender === k ? `${T.violet}1a` : "transparent",
                            color: purchaseLender === k ? T.violet : T.txtDim,
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    {purchaseLender === "kappa" && (
                      <span style={{ display: "block", fontSize: 10.5, color: T.txtMute, marginTop: 4, fontFamily: MONO }}>
                        the Financing card tracks Kappa's balance: what is spent, from each payment's date
                      </span>
                    )}
                  </div>
                  <div
                    className="field-grid-2"
                    style={{
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <Field
                      label="Loan on Purchase"
                      value={loanOnPurchasePct * 100}
                      onChange={(v) => setLoanOnPurchasePct(v / 100)}
                      suffix="%"
                      step={5}
                      accent={T.violet}
                      hint={`= ${fmt(purchase * loanOnPurchasePct)}`}
                    />
                    <Field
                      label="Loan on Rehab"
                      value={loanOnRehabPct * 100}
                      onChange={(v) => setLoanOnRehabPct(v / 100)}
                      suffix="%"
                      step={5}
                      accent={T.violet}
                      hint={`= ${fmt(m.repair * loanOnRehabPct)}`}
                    />
                  </div>
                  <div
                    className="field-grid-2"
                    style={{
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <Field
                      label="Purchase Rate"
                      value={intRatePurchase * 100}
                      onChange={(v) => setIntRatePurchase(v / 100)}
                      suffix="%"
                      step={0.25}
                      accent={T.violet}
                    />
                    <Field
                      label="Rehab Rate"
                      value={intRateRehab * 100}
                      onChange={(v) => setIntRateRehab(v / 100)}
                      suffix="%"
                      step={0.25}
                      accent={T.violet}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: T.txtDim,
                        marginBottom: 5,
                        letterSpacing: "0",
                        fontWeight: 600,
                      }}
                    >
                      Rehab funding
                    </span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        ["internal", "Kappa internal loan"],
                        ["draws", "Lender draws"],
                      ].map(([k, l]) => (
                        <button
                          key={k}
                          onClick={() => setRehabFunding(k)}
                          style={{
                            padding: "7px 14px",
                            borderRadius: 4,
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: FONT,
                            border: `1px solid ${rehabFunding === k ? T.violet : T.border}`,
                            background: rehabFunding === k ? `${T.violet}1a` : "transparent",
                            color: rehabFunding === k ? T.violet : T.txtDim,
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <span style={{ display: "block", fontSize: 10.5, color: T.txtMute, marginTop: 4, fontFamily: MONO }}>
                      {rehabFunding === "draws"
                        ? `interest only from each draw date, avg ${Number.isFinite(m.rehabMonthsOutstanding) ? m.rehabMonthsOutstanding.toFixed(1) : "—"} of ${holdMonths} mo outstanding`
                        : `full rehab amount advanced at closing, interest for all ${holdMonths} mo`}
                    </span>
                  </div>
                  {rehabFunding === "draws" && (
                    <div className="field-grid-3" style={{ display: "grid", gap: 10 }}>
                      <Field label="No. of draws" value={drawCount} onChange={(v) => setDrawCount(Math.max(1, Math.round(v || 1)))} step={1} accent={T.violet} />
                      <Field
                        label="Rehab period"
                        value={drawMonths}
                        onChange={setDrawMonths}
                        suffix="mo"
                        step={0.5}
                        accent={T.violet}
                        hint={drawMonths > holdMonths ? "capped at hold time" : undefined}
                      />
                      <Field
                        label="Fee per draw"
                        value={drawFee}
                        onChange={setDrawFee}
                        prefix="$"
                        step={25}
                        hint={m.drawAmount > 0 ? `${fmt(m.drawAmount)} per draw` : undefined}
                      />
                    </div>
                  )}
                  <Field label="Points / Lender Fees" value={points} onChange={setPoints} prefix="$" hint="paid at closing, funded by the investor (auto)" />
                  <div
                    style={{
                      marginTop: 4,
                      paddingTop: 12,
                      borderTop: `1px solid ${T.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0",
                          color: T.violet,
                        }}
                      >
                        Investor Capital
                      </span>
                      {investorAuto ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: "0",
                            padding: "2px 7px",
                            borderRadius: 20,
                            background: `${T.violet}22`,
                            color: T.violet,
                          }}
                        >
                          AUTO
                        </span>
                      ) : (
                        <button
                          onClick={() => setInvestorAuto(true)}
                          title="Re-enable automatic calculation"
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: "0",
                            padding: "2px 7px",
                            borderRadius: 20,
                            background: "transparent",
                            border: `1px solid ${T.border}`,
                            color: T.txtMute,
                            cursor: "pointer",
                          }}
                        >
                          ↺ AUTO
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        padding: "6px 10px",
                        marginBottom: 10,
                        background: T.inputBg,
                        borderRadius: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: T.txtDim,
                        }}
                      >
                        Buying Costs + Lender Fees{" "}
                        <span
                          style={{
                            color: T.txtMute,
                          }}
                        >
                          (mirrored, funded by investor)
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.violet,
                          fontFamily: MONO,
                        }}
                      >
                        {fmt(m.totalBuying + points)}
                      </span>
                    </div>
                    <div
                      className="field-grid-2"
                      style={{
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      <Field
                        label="Investor Amount"
                        value={investorAmount}
                        onChange={(v) => {
                          setInvestorAmount(v);
                          setInvestorAuto(false);
                        }}
                        prefix="$"
                        step={5000}
                        accent={T.violet}
                        hint={
                          investorAuto
                            ? "= down payment + closing costs + lender fees"
                            : investorAmount > 0
                              ? `Flat return: ${fmt(m.investorInterest)}`
                              : "manual override"
                        }
                      />
                      <Field
                        label="Investor Return %"
                        value={investorRate * 100}
                        onChange={(v) => setInvestorRate(v / 100)}
                        suffix="%"
                        step={0.5}
                        accent={T.violet}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      background: T.inputBg,
                      borderRadius: 4,
                      padding: "10px 14px",
                      marginTop: 4,
                    }}
                  >
                    <LR label="Total Loan Amount" value={fmt(m.loanAmount)} accent={T.violet} />
                    <LR label={`Purchase-loan interest (${holdMonths} mo)`} value={fmt(m.interestPurchase)} />
                    <LR
                      label={rehabFunding === "draws" ? `Rehab draws interest (avg ${m.rehabMonthsOutstanding.toFixed(1)} mo)` : `Rehab-loan interest (${holdMonths} mo)`}
                      value={fmt(m.interestRehab)}
                    />
                    {points > 0 && <LR label="Points / lender fees" value={fmt(points)} />}
                    {m.drawFees > 0 && <LR label="Draw fees" value={fmt(m.drawFees)} />}
                    {investorAmount > 0 && <LR label="Investor flat return" value={fmt(m.investorInterest)} />}
                    <LR label="Total Financing Cost" value={fmt(m.totalFinancing)} strong={true} accent={T.violet} />
                  </div>
                                </Group>
                <Group id="holding" title="Holding costs" sub={`${fmt(m.totalMonthlyHold)} a month for ${holdMonths || 0} months`} total={fmt(m.totalHolding)}>
                  <Field label="Property Taxes (annual)" value={taxAnnual} onChange={setTaxAnnual} prefix="$" hint={`${fmt(taxAnnual / 12)}/mo`} />
                  <div
                    className="field-grid-2"
                    style={{
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <Field label="Insurance /mo" value={insMonthly} onChange={setInsMonthly} prefix="$" />
                    <Field label="HOA /mo" value={hoaMonthly} onChange={setHoaMonthly} prefix="$" />
                  </div>
                  <div
                    className="field-grid-3"
                    style={{
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <Field label="Gas" value={utilGas} onChange={setUtilGas} prefix="$" />
                    <Field label="Water" value={utilWater} onChange={setUtilWater} prefix="$" />
                    <Field label="Electric" value={utilElec} onChange={setUtilElec} prefix="$" />
                  </div>
                  <Field label="Misc holding /mo" value={miscHold} onChange={setMiscHold} prefix="$" />
                  <div
                    style={{
                      background: T.inputBg,
                      borderRadius: 4,
                      padding: "10px 14px",
                    }}
                  >
                    <LR label="Monthly holding" value={fmt(m.totalMonthlyHold)} />
                    <LR label={`Total holding × ${holdMonths} mo`} value={fmt(m.totalHolding)} strong={true} />
                  </div>
                                </Group>
                <Group
                  id="buying"
                  title="Buying costs"
                  sub={txnSummary(buyTxn, "of purchase")}
                  total={fmt(m.totalBuying)}
                >
                  <TxnEditor
                    side="Buying"
                    items={buyTxn}
                    setItems={setBuyTxn}
                    basis={purchase}
                    basisLabel="of purchase"
                    accent={T.blue}
                    typeOverrides={BUY_TYPE_OVERRIDES}
                    labelOverrides={BUY_LABEL_OVERRIDES}
                  />
                                </Group>
                <Group
                  id="selling"
                  title="Selling costs"
                  sub={txnSummary(sellTxn, "of ARV")}
                  total={fmt(m.totalSelling)}
                >
                  <TxnEditor side="Selling" items={sellTxn} setItems={setSellTxn} basis={arv} basisLabel="of ARV" accent={T.blue} />
                                </Group>
              </div>
              <ResultsRail
                deal={deal}
                m={m}
                mao={mao}
                purchase={purchase}
                arv={arv}
                investorAmount={m.investorAmount}
                sqft={sqft}
                gradeRef={gradeCardRef}
                onGradeHover={setGradeHover}
              />
            </div>
          </React.Fragment>
        ) : mode === "forecast" && FC_STAGES.includes(stage) ? (
          <ForecastTab
            ctx={{
              P: positionToday({ actuals, mgmt, uw: posUw, m, stage, today: todayISO() }),
              actuals,
              mgmt,
              uw: posUw,
              m,
              sellingAt: positionProps.sellingAt,
              position: positionProps,
              today: todayISO(),
              uwBaseline,
              holdMonths,
              arv,
              grade: deal.grade,
              purchase,
            }}
            setMgmt={setMgmt}
            addLog={addLogEntry}
          />
        ) : mode === "schedule" && GT_STAGES.includes(stage) ? (
          <GanttTab key={(loadedRef.current && loadedRef.current.id) || "new"} mgmt={mgmt} setMgmt={setMgmt} addLog={addLogEntry} userEmail={userEmail} address={address} stage={stage} />
        ) : mode === "manage" ? (
          <ManagementTab
            stage={stage}
            mgmt={mgmt}
            setMgmt={setMgmt}
            m={m}
            deal={deal}
            mao={mao}
            uwBaseline={uwBaseline}
            actuals={actuals}
            actualSale={actualSale}
            setActualSale={setActualSale}
            purchase={purchase}
            arv={arv}
            holdMonths={holdMonths}
            dealInputs={dealInputs}
            rehabFunding={rehabFunding}
            userEmail={userEmail}
            analysisDate={analysisDate}
            onImport={(sd) => setImportSide(sd)}
            onImportSow={() => setAiModal({ kind: "sow" })}
            onSchedule={GT_STAGES.includes(stage) ? () => goProject("schedule") : null}
            onOpenAnalysis={openAnalysis}
            onDeleteAnalysis={deleteAnalysis}
            onUploadDoc={(f) => uploadDealDoc(f, "")}
            openAttachment={openAttachment}
            connected={!!accessToken && !!settings.folderId}
            docUploading={docUploading}
          />
        ) : (
          <ExpensesDocs
            actuals={actuals}
            setActuals={setActuals}
            pushActuals={pushActuals}
            actualsTotal={actualsTotal}
            actualSale={actualSale}
            setActualSale={setActualSale}
            m={m}
            uwBaseline={uwBaseline}
            arv={arv}
            stage={stage}
            mgmt={mgmt}
            upd={(path, val) => setMgmt((mm) => setIn(mm, path, val))}
            repairs={repairs}
            useRepairBuilder={useRepairBuilder}
            repairTotal={repairTotal}
            onGo={goProject}
            onImportClosing={(sd, source) => setAiModal({ kind: "closing", side: sd, origin: "ledger", source: source || null })}
            onImportSow={(source) => setAiModal({ kind: "sow", origin: "ledger", source: source || null })}
            onReadInvoice={(source) => setAiModal({ kind: "invoice", source: source || null })}
            onOpenAnalysis={openAnalysis}
            onDeleteAnalysis={deleteAnalysis}
            onUploadDoc={(f) => uploadDealDoc(f, "")}
            openAttachment={openAttachment}
            connected={!!accessToken && !!settings.folderId}
            docUploading={docUploading}
            entryTools={{ upload: uploadEntryFiles, addLink: addEntryLink, remove: removeAttachment, uploading: fileUploading, connected: !!accessToken && !!settings.folderId }}
            focus={ledgerFocus}
            onFocused={() => setLedgerFocus(null)}
            position={positionProps}
            setMgmt={setMgmt}
            onSearchAll={accessToken ? searchAllProjects : null}
            pmPanel={
              pmFeeFor(mgmt, stage, m) > 0 || actuals.some((a) => a.tag === "pm_fee") ? (
                <PmPayments
                  mgmt={mgmt}
                  upd={(path, val) => setMgmt((mm) => setIn(mm, path, val))}
                  actuals={actuals}
                  pushActuals={pushActuals}
                  fee={pmFeeFor(mgmt, stage, m)}
                  feeNote={
                    forecastScenario(mgmt, stage)
                      ? `from the forecast (${forecastScenario(mgmt, stage).name || "scenario"})`
                      : pm.type === "flat"
                        ? "fixed amount"
                        : `${+(pm.val || 0)}% of the ${fmt(m.repair || 0)} rehab estimate`
                  }
                  addLog={addLogEntry}
                  onEditFee={() => {
                    // with a forecast the fee is the forecast's: change it there
                    if (forecastScenario(mgmt, stage)) return goProject("forecast");
                    // open the Project manager group in Flip analysis and bring it into view
                    try {
                      localStorage.setItem(GROUPS_KEY, JSON.stringify({ ...loadGroups(), pm: true }));
                    } catch (e) {}
                    setMode("underwrite");
                    setTimeout(() => {
                      const el = document.getElementById("grp-pm");
                      if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
                    }, 60);
                  }}
                />
              ) : null
            }
          />
        )}
        </React.Fragment>
        )}
        <footer
          style={{
            textAlign: "center",
            fontSize: 11,
            color: T.txtMute,
            marginTop: 14,
            fontFamily: MONO,
          }}
        >
          Kappa Real Estate Investments, Deal Breaker {typeof APP_VERSION !== "undefined" ? APP_VERSION : ""}
        </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
