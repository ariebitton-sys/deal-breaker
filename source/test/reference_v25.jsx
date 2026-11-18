const {
  useState,
  useMemo,
  useEffect,
  useRef
} = React;
const LOGO = window._KAPPA_LOGO;
const fmt = n => isFinite(n) ? n.toLocaleString("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
}) : "—";
const fmt1 = n => isFinite(n) ? n.toLocaleString("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
}) : "—";
const pct = n => isFinite(n) ? (n * 100).toFixed(1) + "%" : "—";
const fmtK = n => {
  if (!isFinite(n)) return "—";
  const a = Math.abs(n),
    s = n < 0 ? "-" : "";
  if (a >= 999500) return s + "$" + (a / 1e6).toFixed(a >= 9.95e6 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 9950) return s + "$" + Math.round(a / 1e3) + "K";
  if (a >= 1000) return s + "$" + (a / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return s + "$" + Math.round(a);
};
const DEFAULT_REPAIRS = [{
  group: "Exterior",
  label: "Clean Landscape",
  price: 500,
  lump: true,
  qty: 1
}, {
  group: "Exterior",
  label: "All new landscape",
  price: 2000,
  lump: true,
  qty: 0
}, {
  group: "Exterior",
  label: "Windows ($600 ea)",
  price: 600,
  lump: false,
  qty: 0
}, {
  group: "Exterior",
  label: "New Garage Door",
  price: 1700,
  lump: false,
  qty: 0
}, {
  group: "Interior",
  label: "Kitchen",
  price: 12000,
  lump: true,
  qty: 1
}, {
  group: "Interior",
  label: "Light Kitchen Update",
  price: 6000,
  lump: true,
  qty: 0
}, {
  group: "Interior",
  label: "Full Bathroom ($4k ea)",
  price: 4000,
  lump: false,
  qty: 1
}, {
  group: "Interior",
  label: "Half Bathroom ($3k ea)",
  price: 3000,
  lump: false,
  qty: 0
}, {
  group: "Interior",
  label: "Flooring",
  price: 5000,
  lump: true,
  qty: 1
}, {
  group: "Interior",
  label: "Tile Work",
  price: 3500,
  lump: true,
  qty: 0
}, {
  group: "Interior",
  label: "Interior Paint",
  price: 5000,
  lump: true,
  qty: 1
}, {
  group: "Interior",
  label: "Exterior Paint",
  price: 4000,
  lump: true,
  qty: 0
}, {
  group: "Interior",
  label: "New doors and trim",
  price: 3000,
  lump: true,
  qty: 0
}, {
  group: "Mechanicals",
  label: "Furnace and A/C",
  price: 7000,
  lump: true,
  qty: 0
}, {
  group: "Mechanicals",
  label: "Roof",
  price: 6000,
  lump: true,
  qty: 0
}, {
  group: "Mechanicals",
  label: "All new lighting",
  price: 1500,
  lump: true,
  qty: 1
}, {
  group: "Mechanicals",
  label: "New Panel",
  price: 3000,
  lump: true,
  qty: 0
}, {
  group: "Mechanicals",
  label: "New Hot Water Tank",
  price: 1000,
  lump: true,
  qty: 0
}, {
  group: "Other",
  label: "Finish Basement",
  price: 8000,
  lump: true,
  qty: 0
}, {
  group: "Other",
  label: "Cosmetic Demo",
  price: 2500,
  lump: true,
  qty: 1
}, {
  group: "Other",
  label: "Cleaning",
  price: 350,
  lump: true,
  qty: 1
}, {
  group: "Other",
  label: "Miscellaneous",
  price: 5000,
  lump: true,
  qty: 1
}];
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
  shadow: "0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)"
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
  shadow: "0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)"
};
let T = DARK_T;
const FONT = "'Inter',system-ui,-apple-system,sans-serif";
const MONO = "'JetBrains Mono','SF Mono',ui-monospace,monospace";
const BUY_LABEL_OVERRIDES = {
  staging: "Inspections"
};
const BUY_TYPE_OVERRIDES = {
  realtor: "flat"
};
const RISK_LEVELS = [{
  level: 1,
  target: 20000,
  color: "#16a34a",
  criteria: "Rehab under $20k \u00b7 hold \u2264 3 months"
}, {
  level: 2,
  target: 30000,
  color: "#65a30d",
  criteria: "Rehab $20k\u2013$50k \u00b7 hold 3\u20134 months"
}, {
  level: 3,
  target: 40000,
  color: "#d97706",
  criteria: "Rehab $50k\u2013$100k \u00b7 hold 4\u20136 months"
}, {
  level: 4,
  target: 55000,
  color: "#7c3aed",
  criteria: "Rehab $100k\u2013$175k \u00b7 hold 6\u20139 months"
}, {
  level: 5,
  target: 75000,
  color: "#dc2626",
  criteria: "Rehab over $175k \u00b7 hold over 9 months"
}];
const GRADE_BANDS = [{
  g: "A+",
  label: "\u2265 160%"
}, {
  g: "A",
  label: "140\u2013159%"
}, {
  g: "A-",
  label: "125\u2013139%"
}, {
  g: "B+",
  label: "110\u2013124%"
}, {
  g: "B",
  label: "100\u2013109%"
}, {
  g: "B-",
  label: "90\u201399%"
}, {
  g: "C+",
  label: "80\u201389%"
}, {
  g: "C",
  label: "70\u201379%"
}, {
  g: "C-",
  label: "60\u201369%"
}, {
  g: "Reject",
  label: "< 60%"
}];
function GradeExplainer({
  deal,
  repair,
  holdMonths,
  netProfit,
  visible
}) {
  return <div className={"grade-explain no-print" + (visible ? " is-on" : "")}><div className="ge-title">Why is this deal <b style={{
        color: deal.gradeColor
      }}>{deal.grade}</b>?</div><div className="ge-sec"><div className="ge-h">Step 1 — Risk level</div><div className="ge-note">Risk is the <b>higher</b> of the rehab-cost tier and the hold-time tier. Each level sets a minimum target profit.</div>{RISK_LEVELS.map(rl => <div key={rl.level} className={"ge-row" + (rl.level === deal.riskLevel ? " is-active" : "")}><span className="ge-badge" style={{
          background: rl.color + "22",
          color: rl.color
        }}>{rl.level}</span><span className="ge-body"><span className="ge-crit">{rl.criteria}</span><span className="ge-sub">target {fmt(rl.target)}</span></span></div>)}<div className="ge-calc">rehab {fmt(repair)} → tier {deal.rehabLvl}<br />hold {holdMonths} mo → tier {deal.holdLvl}<br />= <b>Risk {deal.riskLevel}</b> · target <b>{fmt(deal.threshold)}</b></div></div><div className="ge-sec"><div className="ge-h">Step 2 — Profit vs target</div><div className="ge-calc">{fmt(netProfit)} ÷ {fmt(deal.threshold)} = <b>{Math.round(deal.ratio * 100)}%</b> → <b>{deal.initialGrade}</b></div><div className="ge-bands">{GRADE_BANDS.map(b => <span key={b.g} className={"ge-band" + (b.g === deal.initialGrade ? " is-active" : "")}><span className="ge-bg">{b.g}</span><span className="ge-bl">{b.label}</span></span>)}</div></div><div className="ge-sec"><div className="ge-h">Step 3 — Adjustments</div>{deal.adj.length === 0 ? <div className="ge-note">None apply to this deal.</div> : deal.adj.map((a, i) => <div key={i} className="ge-adj"><span className={a.delta > 0 ? "ge-up" : "ge-down"}>{a.delta > 0 ? "▲ +" + a.delta : "▼ " + a.delta}</span><span className="ge-adjlabel">{a.label}</span></div>)}<div className="ge-rules">Hold ≤2 mo <b>+1</b> · hold 7–9 mo <b>−1</b>{" · hold >9 mo "}<b>−2</b>{" · purchase >$300k with rehab under 10% and hold ≤3 mo "}<b>+1</b>{" · rehab >$150k with hold >6 mo and profit under $60k "}<b>−1</b></div></div><div className="ge-final"><span className="ge-fl">Final grade</span><span className="ge-fg" style={{
        color: deal.gradeColor
      }}>{deal.grade}</span></div></div>;
}
const TXN_TEMPLATE = [{
  key: "escrow",
  label: "Escrow / Attorney Fees",
  type: "flat"
}, {
  key: "recording",
  label: "Recording Fees",
  type: "flat"
}, {
  key: "realtor",
  label: "Realtor Fees",
  type: "pct"
}, {
  key: "transfer",
  label: "Transfer & Conveyance",
  type: "pct"
}, {
  key: "warranty",
  label: "Home Warranty",
  type: "flat"
}, {
  key: "staging",
  label: "Staging Costs",
  type: "flat"
}, {
  key: "marketing",
  label: "Marketing Costs",
  type: "flat"
}, {
  key: "misc",
  label: "Miscellaneous",
  type: "flat"
}];
const gp = e => ({
  background: T.glass,
  backdropFilter: "blur(16px) saturate(140%)",
  WebkitBackdropFilter: "blur(16px) saturate(140%)",
  border: `1px solid ${T.border}`,
  borderRadius: 18,
  boxShadow: T.shadow,
  ...e
});
const bs = (bg, color) => ({
  padding: "9px 14px",
  borderRadius: 10,
  border: `1px solid ${T.border}`,
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: FONT,
  background: bg,
  color,
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)"
});
const ss = {
  width: "100%",
  padding: "9px 10px",
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  fontSize: 14,
  fontFamily: FONT,
  background: "rgba(0,0,0,0.22)",
  color: T.txt,
  outline: "none",
  boxSizing: "border-box"
};
function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  hint,
  accent
}) {
  const [focus, setFocus] = useState(false);
  const [draft, setDraft] = useState(null);
  const clean = Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : "";
  const shown = focus && draft !== null ? draft : clean;
  return <label style={{
    display: "block",
    marginBottom: 12
  }}><span style={{
      display: "block",
      fontSize: 11,
      color: T.txtDim,
      marginBottom: 5,
      letterSpacing: ".04em",
      textTransform: "uppercase",
      fontWeight: 600
    }}>{label}</span><div style={{
      display: "flex",
      alignItems: "stretch",
      border: `1px solid ${focus ? accent || T.teal : T.border}`,
      borderRadius: 11,
      overflow: "hidden",
      background: T.inputBg,
      transition: "border-color .15s",
      boxShadow: focus ? `0 0 0 3px ${accent || T.teal}33` : "none"
    }}>{prefix && <span style={{
        padding: "9px 9px",
        color: T.txtMute,
        fontSize: 13,
        fontFamily: MONO,
        display: "flex",
        alignItems: "center"
      }}>{prefix}</span>}<input type="number" value={shown} step={step} onFocus={e => {
        setFocus(true);
        e.target.select();
      }} onBlur={() => {
        setFocus(false);
        setDraft(null);
      }} onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(raw === "" ? 0 : parseFloat(raw));
      }} style={{
        flex: 1,
        border: "none",
        outline: "none",
        padding: "9px 8px",
        fontSize: 15,
        fontFamily: MONO,
        background: "transparent",
        color: T.txt,
        minWidth: 0
      }} />{suffix && <span style={{
        padding: "9px 10px",
        color: T.txtMute,
        fontSize: 12,
        display: "flex",
        alignItems: "center"
      }}>{suffix}</span>}</div>{hint && <span style={{
      display: "block",
      fontSize: 10.5,
      color: T.txtMute,
      marginTop: 4,
      fontFamily: MONO
    }}>{hint}</span>}</label>;
}
function LR({
  label,
  value,
  strong,
  accent,
  neg
}) {
  return <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    padding: "6px 0",
    borderBottom: `1px solid ${T.border}`
  }}><span style={{
      fontSize: strong ? 13.5 : 12.5,
      color: strong ? T.txt : T.txtDim,
      fontWeight: strong ? 700 : 400
    }}>{neg && <span style={{
        color: T.txtMute
      }}>− </span>}{label}</span><span style={{
      fontSize: strong ? 15 : 13.5,
      fontWeight: strong ? 700 : 500,
      color: accent || T.txt,
      fontFamily: MONO
    }}>{value}</span></div>;
}
function Panel({
  title,
  kicker,
  children,
  accent,
  right
}) {
  return <section style={gp({
    padding: "18px 20px",
    marginBottom: 16
  })}><div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 15
    }}><div style={{
        display: "flex",
        alignItems: "center",
        gap: 9
      }}><span style={{
          width: 7,
          height: 7,
          borderRadius: 2,
          background: accent || T.teal,
          boxShadow: `0 0 10px ${accent || T.teal}`
        }} /><h2 style={{
          margin: 0,
          fontSize: 12.5,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: T.txt,
          fontWeight: 700
        }}>{title}</h2>{kicker && <span style={{
          fontSize: 11,
          color: T.txtMute,
          fontFamily: MONO
        }}>{kicker}</span>}</div>{right}</div>{children}</section>;
}
function Kpi({
  label,
  value,
  tone,
  big,
  hint,
  desc
}) {
  return <div className={desc ? "kpi-tooltip" : undefined} data-tip={desc} style={gp({
    padding: "13px 15px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    borderRadius: 14
  })}><div style={{
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: ".06em",
      color: T.txtDim,
      fontWeight: 700,
      marginBottom: 5
    }}>{label}</div><div style={{
      fontSize: big ? 23 : 19,
      fontWeight: 800,
      color: tone,
      fontFamily: MONO,
      letterSpacing: "-0.01em"
    }}>{value}</div>{hint && <div style={{
      fontSize: 10,
      color: T.txtMute,
      marginTop: 3,
      fontFamily: MONO
    }}>{hint}</div>}</div>;
}
function TxnEditor({
  side,
  items,
  setItems,
  basis,
  basisLabel,
  accent,
  excludeKeys = [],
  typeOverrides = {},
  labelOverrides = {}
}) {
  const update = (key, patch) => setItems(p => ({
    ...p,
    [key]: {
      ...p[key],
      ...patch
    }
  }));
  return <div><div style={{
      display: "grid",
      gridTemplateColumns: "1fr 70px 88px",
      gap: 8,
      padding: "0 2px 6px",
      fontSize: 10,
      color: T.txtMute,
      textTransform: "uppercase",
      letterSpacing: ".05em",
      fontWeight: 700
    }}><span>{side} item</span><span style={{
        textAlign: "center"
      }}>On/Off</span><span style={{
        textAlign: "right"
      }}>Value</span></div>{TXN_TEMPLATE.filter(t => !excludeKeys.includes(t.key)).map(t => {
      const it = items[t.key];
      if (!it) return null;
      const effType = it.type || typeOverrides[t.key] || t.type;
      const computed = it.on ? effType === "pct" ? it.val / 100 * basis : it.val : 0;
      return <div key={t.key} style={{
        display: "grid",
        gridTemplateColumns: "1fr 70px 88px",
        gap: 8,
        alignItems: "center",
        padding: "5px 2px",
        borderBottom: `1px solid ${T.border}`,
        opacity: it.on ? 1 : 0.62
      }}><span style={{
          fontSize: 12.5,
          color: T.txt
        }}>{labelOverrides[t.key] || t.label}</span><button onClick={() => update(t.key, {
          on: !it.on
        })} style={{
          justifySelf: "center",
          width: 38,
          height: 22,
          borderRadius: 11,
          border: it.on ? "none" : `1px solid ${T.border}`,
          cursor: "pointer",
          position: "relative",
          background: it.on ? "#0f172a" : "#e7ecf1",
          transition: "background .15s, border .15s"
        }}><span style={{
            position: "absolute",
            top: 2,
            left: it.on ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: it.on ? "0 1px 2px rgba(0,0,0,.25)" : "0 0 0 1px rgba(15,23,42,.08)",
            transition: "left .15s"
          }} /></button><div style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          justifySelf: "end"
        }}><input type="number" onFocus={e => e.target.select()} value={it.val} step={effType === "pct" ? 0.1 : 100} onChange={e => {
            const v = parseFloat(e.target.value) || 0;
            update(t.key, v > 0 && !it.on ? {
              val: v,
              on: true
            } : {
              val: v
            });
          }} style={{
            width: 56,
            padding: "5px 6px",
            border: `1px solid ${T.border}`,
            borderRadius: 7,
            fontSize: 12,
            fontFamily: MONO,
            background: T.inputBg,
            color: T.txt,
            textAlign: "right"
          }} /><button onClick={() => update(t.key, {
            type: effType === "pct" ? "flat" : "pct"
          })} title={effType === "pct" ? "Percentage \u2014 click to switch to a flat $ amount" : "Flat $ amount \u2014 click to switch to a percentage"} style={{
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
            lineHeight: 1
          }}>{effType === "pct" ? "%" : "$"}</button></div>{it.on && effType === "pct" && <span style={{
          gridColumn: "1 / -1",
          fontSize: 10,
          color: T.txtMute,
          fontFamily: MONO,
          textAlign: "right",
          marginTop: -2
        }}>= {fmt(computed)} ({basisLabel})</span>}</div>;
    })}</div>;
}
const dTxn = o => {
  const b = {};
  TXN_TEMPLATE.forEach(t => {
    b[t.key] = {
      on: false,
      val: 0
    };
  });
  return {
    ...b,
    ...o
  };
};
async function driveList(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType='application/json' and trashed=false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!r.ok) {
    const e = new Error(`Drive list: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return (await r.json()).files || [];
}
async function driveRead(token, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!r.ok) {
    const e = new Error(`Drive read: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
async function driveCreate(token, folderId, name, data) {
  const boundary = 'kappa_bnd';
  const meta = JSON.stringify({
    name,
    mimeType: 'application/json',
    parents: [folderId]
  });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body
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
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!r.ok) {
    const e = new Error(`Drive update: ${r.status}`);
    e.status = r.status;
    throw e;
  }
}
async function driveDelete(token, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!r.ok && r.status !== 404) {
    const e = new Error(`Drive delete: ${r.status}`);
    e.status = r.status;
    throw e;
  }
}
async function driveUploadFile(token, folderId, file) {
  const arrayBuffer = await file.arrayBuffer();
  const boundary = 'kappa_file_bnd_xyz';
  const meta = JSON.stringify({
    name: file.name,
    mimeType: file.type,
    parents: [folderId]
  });
  const enc = new TextEncoder();
  const part1 = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`);
  const part2 = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(part1.length + arrayBuffer.byteLength + part2.length);
  body.set(part1, 0);
  body.set(new Uint8Array(arrayBuffer), part1.length);
  body.set(part2, part1.length + arrayBuffer.byteLength);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`
    },
    body
  });
  if (!r.ok) {
    const e = new Error(`File upload: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}
function SettingsModal({
  settings,
  onSave,
  onClose
}) {
  const [cid, setCid] = useState(settings.clientId || "");
  const [fid, setFid] = useState(settings.folderId || "");
  const [mapsKey, setMapsKey] = useState(settings.mapsApiKey || "");
  return <div style={{
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  }}><div style={gp({
      padding: 28,
      maxWidth: 500,
      width: "100%",
      borderRadius: 20,
      border: `1px solid ${T.borderHi}`
    })}><h2 style={{
        fontSize: 16,
        fontWeight: 800,
        marginBottom: 20,
        color: T.teal
      }}>⚙ Settings</h2><label style={{
        display: "block",
        marginBottom: 14
      }}><span style={{
          display: "block",
          fontSize: 11,
          color: T.txtDim,
          marginBottom: 5,
          textTransform: "uppercase",
          fontWeight: 600,
          letterSpacing: ".04em"
        }}>Google Client ID</span><input value={cid} onChange={e => setCid(e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" style={{
          ...ss,
          fontFamily: MONO,
          fontSize: 12
        }} /></label><label style={{
        display: "block",
        marginBottom: 14
      }}><span style={{
          display: "block",
          fontSize: 11,
          color: T.txtDim,
          marginBottom: 5,
          textTransform: "uppercase",
          fontWeight: 600,
          letterSpacing: ".04em"
        }}>Shared Drive Folder ID</span><input value={fid} onChange={e => setFid(e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" style={{
          ...ss,
          fontFamily: MONO,
          fontSize: 12
        }} /><span style={{
          display: "block",
          fontSize: 10.5,
          color: T.txtMute,
          marginTop: 4
        }}>From Drive URL: drive.google.com/drive/folders/<strong>THIS_PART</strong></span></label><label style={{
        display: "block",
        marginBottom: 22
      }}><span style={{
          display: "block",
          fontSize: 11,
          color: T.txtDim,
          marginBottom: 5,
          textTransform: "uppercase",
          fontWeight: 600,
          letterSpacing: ".04em"
        }}>Google Maps API Key</span><input value={mapsKey} onChange={e => setMapsKey(e.target.value)} placeholder="AIzaSy..." style={{
          ...ss,
          fontFamily: MONO,
          fontSize: 12
        }} /><span style={{
          display: "block",
          fontSize: 10.5,
          color: T.txtMute,
          marginTop: 4
        }}>Enable "Maps Embed API" for this key — free, no billing card required.</span></label><div style={{
        display: "flex",
        gap: 10,
        justifyContent: "flex-end"
      }}><button onClick={onClose} style={bs(T.glass, T.txtDim)}>Cancel</button><button onClick={() => onSave({
          clientId: cid.trim(),
          folderId: fid.trim(),
          mapsApiKey: mapsKey.trim()
        })} style={bs(T.teal, "#06262a")}>💾 Save Settings</button></div></div></div>;
}
function PropertyMapCard({
  address,
  apiKey
}) {
  const [debounced, setDebounced] = useState(address);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(address), 700);
    return () => clearTimeout(t);
  }, [address]);
  const wrap = inner => <div className="map-card" style={gp({
    padding: 0,
    overflow: "hidden",
    height: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  })}>{inner}</div>;
  if (!apiKey) {
    return wrap(<div style={{
      padding: 20,
      textAlign: "center",
      color: T.txtMute,
      fontSize: 12,
      lineHeight: 1.6
    }}>🗺️ Add a Google Maps API key in Settings (⚙) to preview the property location here.</div>);
  }
  if (!debounced || !debounced.trim()) {
    return wrap(<div style={{
      padding: 20,
      textAlign: "center",
      color: T.txtMute,
      fontSize: 12
    }}>Enter a property address above to preview the map.</div>);
  }
  const src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(debounced)}`;
  return wrap(<iframe title="Property location" width="100%" height="260" style={{
    border: 0,
    display: "block"
  }} loading="lazy" src={src} />);
}
function ResourcesPanel({
  address,
  photosUrl,
  setPhotosUrl
}) {
  const trimmed = (address || "").trim();
  const zillowUrl = trimmed ? `https://www.zillow.com/homes/${encodeURIComponent(trimmed)}_rb/` : null;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(photosUrl || "");
  React.useEffect(() => {
    setDraft(photosUrl || "");
  }, [photosUrl]);
  const normalize = u => {
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
    borderRadius: 12,
    border: `1px solid ${T.border}`,
    textDecoration: "none",
    color: T.txt,
    background: T.inputBg,
    transition: "border-color .15s"
  };
  return <div style={gp({
    padding: "16px 18px",
    minHeight: 260,
    display: "flex",
    flexDirection: "column"
  })}><div style={{
      display: "flex",
      alignItems: "center",
      gap: 9,
      marginBottom: 14
    }}><span style={{
        width: 7,
        height: 7,
        borderRadius: 2,
        background: T.blue,
        boxShadow: `0 0 10px ${T.blue}`
      }} /><h2 style={{
        margin: 0,
        fontSize: 12.5,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: T.txt,
        fontWeight: 700
      }}>Resources</h2></div><div style={{
      display: "flex",
      flexDirection: "column",
      gap: 10,
      flex: 1,
      justifyContent: "center"
    }}>{zillowUrl ? <a href={zillowUrl} target="_blank" rel="noopener noreferrer" style={linkCardStyle}><span style={{
          fontSize: 30
        }}>🏠</span><div style={{
          minWidth: 0
        }}><div style={{
            fontWeight: 700,
            fontSize: 15
          }}>View on Zillow</div><div style={{
            fontSize: 12,
            color: T.txtMute,
            marginTop: 3
          }}>{"Comps, listing history & Zestimate"}</div></div></a> : <div style={{
        color: T.txtMute,
        fontSize: 12,
        textAlign: "center",
        padding: "0 10px"
      }}>Enter a property address to see resource links.</div>}{editing ? <div style={{
        ...linkCardStyle,
        gap: 10
      }}><span style={{
          fontSize: 30
        }}>📷</span><div style={{
          flex: 1,
          minWidth: 0
        }}><input autoFocus={true} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(photosUrl || "");
              setEditing(false);
            }
          }} placeholder="Paste photos folder link (Drive, Dropbox…)" style={{
            width: "100%",
            background: T.glass,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.txt,
            padding: "7px 9px",
            fontSize: 12.5,
            boxSizing: "border-box"
          }} /></div><button onClick={save} style={{
          ...bs(T.teal, "#06262a"),
          fontSize: 11,
          padding: "6px 11px"
        }}>Save</button><button onClick={() => {
          setDraft(photosUrl || "");
          setEditing(false);
        }} style={{
          ...bs(T.glass, T.txtDim),
          fontSize: 11,
          padding: "6px 9px"
        }}>✕</button></div> : photosUrl ? <div style={{
        ...linkCardStyle,
        gap: 14
      }}><a href={photosUrl} target="_blank" rel="noopener noreferrer" style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          textDecoration: "none",
          color: T.txt,
          flex: 1,
          minWidth: 0
        }}><span style={{
            fontSize: 30
          }}>📷</span><div style={{
            minWidth: 0
          }}><div style={{
              fontWeight: 700,
              fontSize: 15
            }}>Photos folder</div><div style={{
              fontSize: 12,
              color: T.txtMute,
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>{photosUrl.replace(/^https?:\/\//, "")}</div></div></a><button onClick={() => setEditing(true)} title="Edit link" style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: T.txtMute,
          padding: 2
        }}>✏️</button><button onClick={() => setPhotosUrl("")} title="Remove" style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 15,
          color: T.txtMute,
          padding: 2
        }}>×</button></div> : <button onClick={() => setEditing(true)} style={{
        ...linkCardStyle,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        borderStyle: "dashed"
      }}><span style={{
          fontSize: 30,
          opacity: 0.7
        }}>📷</span><div style={{
          minWidth: 0
        }}><div style={{
            fontWeight: 700,
            fontSize: 15,
            color: T.txtDim
          }}>Add photos folder</div><div style={{
            fontSize: 12,
            color: T.txtMute,
            marginTop: 3
          }}>Link a Drive / Dropbox folder of property photos</div></div></button>}</div></div>;
}
function ProfitBar({
  m,
  arv
}) {
  if (!arv || arv <= 0) return null;
  const segs = [{
    l: "Purchase",
    v: Math.max(0, m.purchase || 0),
    c: T.amber
  }, {
    l: "Repairs",
    v: Math.max(0, m.repair || 0),
    c: T.violet
  }, {
    l: "Financing",
    v: Math.max(0, m.totalFinancing),
    c: T.blue
  }, {
    l: "Holding",
    v: Math.max(0, m.totalHolding),
    c: "#7a8893"
  }, {
    l: "Txn",
    v: Math.max(0, m.totalBuying + m.totalSelling),
    c: "#566069"
  }, {
    l: "Profit",
    v: Math.max(0, m.netProfit),
    c: T.green
  }];
  const loss = m.netProfit < 0 ? -m.netProfit : 0;
  const total = Math.max(arv, segs.reduce((s, x) => s + x.v, 0)) || 1;
  const arvPct = Math.min(100, arv / total * 100);
  const chip = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    color: T.txtDim
  };
  return <div style={{
    marginTop: 14
  }}><div style={{
      position: "relative",
      display: "flex",
      height: 12,
      borderRadius: 6,
      overflow: "hidden",
      background: T.inputBg
    }}>{segs.map((s, i) => s.v > 0 && <div key={i} title={`${s.l}: ${fmt(s.v)}`} style={{
        width: `${s.v / total * 100}%`,
        background: s.c
      }} />)}{loss > 0 && <div title={`Loss: ${fmt(loss)} \u2014 costs exceed ARV`} style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${arvPct}%`,
        right: 0,
        background: `repeating-linear-gradient(135deg, ${T.red}dd 0 5px, ${T.red}77 5px 10px)`
      }} />}{loss > 0 && <div title={`ARV ${fmt(arv)}`} style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${arvPct}%`,
        width: 2,
        marginLeft: -1,
        background: "#ffffff"
      }} />}</div><div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 8
    }}>{segs.map((s, i) => s.v > 0 && <span key={i} style={chip}><span style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: s.c
        }} />{s.l}<span style={{
          fontFamily: MONO,
          color: T.txtMute
        }}>{Math.round(s.v / arv * 100)}%</span></span>)}{loss > 0 && <span style={{
        ...chip,
        color: T.red,
        fontWeight: 700
      }}><span style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: T.red
        }} />Loss {fmt(loss)}</span>}</div></div>;
}
const sumTxnPure = (items, basis, typeOverrides = {}) => TXN_TEMPLATE.reduce((s, t) => {
  const it = items && items[t.key];
  if (!it || !it.on) return s;
  const val = parseFloat(it.val) || 0;
  const effType = it.type || typeOverrides[t.key] || t.type;
  return s + (effType === "pct" ? val / 100 * basis : val);
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
  const interest = loanAmountPurchase * i.intRatePurchase / 12 * h + loanAmountRehab * i.intRateRehab / 12 * h;
  const totalBuying = sumTxnPure(i.buyTxn, purchase, BUY_TYPE_OVERRIDES);
  const totalSelling = sumTxnPure(i.sellTxn, arv);
  const investorAmount = i.investorAuto ? Math.max(0, purchase + repair + totalBuying - loanAmount) : i.investorAmount || 0;
  const investorInterest = investorAmount * i.investorRate;
  const totalFinancing = points + interest + investorInterest;
  const totalMonthlyHold = (i.taxAnnual || 0) / 12 + (i.insMonthly || 0) + (i.hoaMonthly || 0) + (i.utilGas || 0) + (i.utilWater || 0) + (i.utilElec || 0) + (i.miscHold || 0);
  const totalHolding = totalMonthlyHold * h;
  const totalCosts = purchase + repair + totalFinancing + totalHolding + totalBuying + totalSelling;
  const netProfit = arv - totalCosts;
  const cashIn = Math.max(0, purchase + repair + totalBuying - loanAmount - investorAmount) + points + interest + totalHolding;
  const roi = totalCosts > 0 ? netProfit / totalCosts : NaN;
  return {
    purchase,
    repair,
    loanAmount,
    interest,
    investorAmount,
    investorInterest,
    monthlyInterest: h ? interest / h : NaN,
    totalFinancing,
    totalMonthlyHold,
    totalHolding,
    totalBuying,
    totalSelling,
    totalCosts,
    netProfit,
    cashIn,
    roi,
    roiAnnual: h > 0 ? roi * 12 / h : NaN,
    cashOnCashAnnual: cashIn > 0 && h > 0 ? netProfit / cashIn * 12 / h : NaN,
    costPerSqft: i.sqft ? (purchase + repair) / i.sqft : NaN
  };
}
function solvePurchaseFor(inputs, goal) {
  if (!(inputs.arv > 0) || !Number.isFinite(goal)) return null;
  const at = p => calcDeal({
    ...inputs,
    purchase: p
  }).netProfit;
  if (at(0) < goal) return null;
  let lo = 0,
    hi = Math.max(inputs.arv, inputs.purchase || 0) * 2;
  if (at(hi) >= goal) return Math.floor(hi);
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (at(mid) >= goal) lo = mid;else hi = mid;
  }
  return Math.floor(lo);
}
function App() {
  T = LIGHT_T;
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
  const [buyTxn, setBuyTxn] = useState(dTxn({
    escrow: {
      on: true,
      val: 1200
    },
    transfer: {
      on: true,
      val: 0.45
    }
  }));
  const [sellTxn, setSellTxn] = useState(dTxn({
    escrow: {
      on: true,
      val: 1500
    },
    realtor: {
      on: true,
      val: 6
    },
    transfer: {
      on: true,
      val: 0.4
    },
    staging: {
      on: true,
      val: 1500
    }
  }));
  const [investorAmount, setInvestorAmount] = useState(0);
  const [investorAuto, setInvestorAuto] = useState(true);
  const [investorRate, setInvestorRate] = useState(0.09);
  const [analysisDate, setAnalysisDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [cmaFiles, setCmaFiles] = useState([]);
  const cmaFileInputRef = useRef(null);
  const [linkInputFor, setLinkInputFor] = useState(null);
  const [linkInputUrl, setLinkInputUrl] = useState("");
  const [linkInputName, setLinkInputName] = useState("");
  const [acquired, setAcquired] = useState(false);
  const [actuals, setActuals] = useState([]);
  const [actualSale, setActualSale] = useState(0);
  const [newItem, setNewItem] = useState({
    cat: "Acquisition",
    label: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10)
  });
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kappa_settings") || "{}");
    } catch {
      return {};
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [userEmail, setUserEmail] = useState(() => {
    try {
      return localStorage.getItem("kappa_user_email") || null;
    } catch {
      return null;
    }
  });
  const [driveFiles, setDriveFiles] = useState([]);
  const [driveMsg, setDriveMsg] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const afterSaveRef = useRef(null);
  const [photosUrl, setPhotosUrl] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState("All");
  const [gradeHover, setGradeHover] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const fileIdMap = useRef({});
  const pendingSave = useRef(false);
  const saveSettings = s => {
    localStorage.setItem("kappa_settings", JSON.stringify(s));
    setSettings(s);
    setShowSettings(false);
    setAccessToken(null);
    setUserEmail(null);
    try {
      localStorage.removeItem("kappa_user_email");
    } catch {}
    setDriveFiles([]);
  };
  const getFreshToken = () => new Promise((resolve, reject) => {
    if (!settings.clientId) {
      reject(new Error("No client ID configured"));
      return;
    }
    if (!window.google) {
      reject(new Error("Google script not loaded"));
      return;
    }
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: settings.clientId,
      scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
      hint: userEmail || undefined,
      callback: resp => {
        if (resp.error) {
          reject(new Error(resp.error));
          return;
        }
        setAccessToken(resp.access_token);
        resolve(resp.access_token);
      }
    });
    tc.requestAccessToken({
      prompt: ""
    });
  });
  const withAuthRetry = async (action, token) => {
    try {
      return await action(token || accessToken);
    } catch (err) {
      if (err && err.status === 401) {
        const freshToken = await getFreshToken();
        return await action(freshToken);
      }
      throw err;
    }
  };
  useEffect(() => {
    if (!accessToken) return;
    const id = setInterval(() => {
      getFreshToken().catch(() => {});
    }, 45 * 60 * 1000);
    return () => clearInterval(id);
  }, [accessToken, settings.clientId, userEmail]);
  const refreshFiles = async token => {
    if (!settings.folderId) return;
    try {
      const files = await withAuthRetry(tok => driveList(token || tok, settings.folderId));
      setDriveFiles(files);
      const m = {};
      files.forEach(f => {
        m[f.name] = f.id;
      });
      fileIdMap.current = m;
    } catch (e) {
      console.error(e);
    }
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
    const tc = google.accounts.oauth2.initTokenClient({
      client_id: settings.clientId,
      scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email",
      hint: userEmail || undefined,
      callback: async resp => {
        if (resp.error) {
          setDriveMsg("❌ " + resp.error);
          pendingSave.current = false;
          afterSaveRef.current = null;
          return;
        }
        setAccessToken(resp.access_token);
        try {
          const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
              Authorization: `Bearer ${resp.access_token}`
            }
          }).then(r => r.json());
          setUserEmail(info.email);
          try {
            localStorage.setItem("kappa_user_email", info.email || "");
          } catch {}
          await refreshFiles(resp.access_token);
          setDriveMsg("✓ Connected");
          setTimeout(() => setDriveMsg(""), 2000);
        } catch (e) {
          setDriveMsg("❌ " + e.message);
        }
        if (pendingSave.current) {
          pendingSave.current = false;
          const ok = await doSave(resp.access_token);
          const cb = afterSaveRef.current;
          afterSaveRef.current = null;
          if (ok && cb) cb(resp.access_token);
        }
      }
    });
    tc.requestAccessToken({
      prompt: ""
    });
  };
  const doSave = async token => {
    if (!address.trim()) {
      setDriveMsg("⚠ Enter address first");
      setTimeout(() => setDriveMsg(""), 3000);
      return false;
    }
    const savedKey = dealKey;
    setDriveLoading(true);
    try {
      const name = address.trim().replace(/[\/\\:*?"<>|]/g, "_") + ".json";
      const data = getState();
      await withAuthRetry(async tok => {
        const existingId = fileIdMap.current[name];
        if (existingId) {
          await driveUpdate(tok, existingId, data);
        } else {
          const c = await driveCreate(tok, settings.folderId, name, data);
          fileIdMap.current[name] = c.id;
        }
        await refreshFiles(tok);
      }, token);
      setBaseline(savedKey);
      setDriveMsg("✓ Saved to Drive");
      setTimeout(() => setDriveMsg(""), 2500);
      return true;
    } catch (e) {
      setDriveMsg(e.message.includes("expired") ? "❌ " + e.message : "❌ " + e.message + " — your data is safe, try Save again");
      return false;
    } finally {
      setDriveLoading(false);
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
    setBuyTxn(dTxn({
      escrow: {
        on: true,
        val: 1200
      },
      transfer: {
        on: true,
        val: 0.45
      }
    }));
    setSellTxn(dTxn({
      escrow: {
        on: true,
        val: 1500
      },
      realtor: {
        on: true,
        val: 6
      },
      transfer: {
        on: true,
        val: 0.4
      },
      staging: {
        on: true,
        val: 1500
      }
    }));
    setAcquired(false);
    setActuals([]);
    setActualSale(0);
    setCmaFiles([]);
    setPhotosUrl("");
    setLedgerFilter("All");
    setAnalysisDate(new Date().toISOString().slice(0, 10));
  };
  const resetDeal = () => {
    resetFields();
    markClean();
    setMode("underwrite");
    setDriveMsg("\u2728 New deal \u2014 fresh start");
    setTimeout(() => setDriveMsg(""), 2500);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };
  const proceed = (action, token) => {
    if (!action) return;
    if (action.kind === "load") openDeal(action.file, token);else resetDeal();
  };
  const requestNewDeal = () => {
    if (dirty) setPendingAction({
      kind: "new"
    });else resetDeal();
  };
  const saveThenProceed = async () => {
    const action = pendingAction;
    setPendingAction(null);
    await saveDeal(token => proceed(action, token));
  };
  const discardThenProceed = () => {
    const action = pendingAction;
    setPendingAction(null);
    proceed(action);
  };
  const saveDeal = async onSuccess => {
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
      setDriveMsg("🔄 Reconnecting…");
      signIn();
      return;
    }
    const ok = await doSave(accessToken);
    if (ok && cb) cb(accessToken);
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
    savedAt: new Date().toISOString()
  });
  const applyState = d => {
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
    if (d.intRatePurchase !== undefined) setIntRatePurchase(d.intRatePurchase);else if (d.intRate !== undefined) setIntRatePurchase(d.intRate);
    if (d.intRateRehab !== undefined) setIntRateRehab(d.intRateRehab);else if (d.intRate !== undefined) setIntRateRehab(d.intRate);
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
    if (d.acquired !== undefined) setAcquired(d.acquired);
    if (d.actuals !== undefined) setActuals(d.actuals);
    if (d.actualSale !== undefined) setActualSale(d.actualSale);
    if (d.cmaFiles !== undefined) setCmaFiles(d.cmaFiles);
    setPhotosUrl(d.photosUrl || "");
    setLedgerFilter("All");
  };
  const dealKey = JSON.stringify({
    ...getState(),
    savedAt: undefined,
    investorAmount: investorAuto ? null : investorAmount
  });
  const [baseline, setBaseline] = useState(null);
  const [cleanTick, setCleanTick] = useState(0);
  const restoreBaselineRef = useRef(undefined);
  const markClean = () => setCleanTick(t => t + 1);
  useEffect(() => {
    if (cleanTick === 0) return;
    if (restoreBaselineRef.current !== undefined) {
      setBaseline(restoreBaselineRef.current);
      restoreBaselineRef.current = undefined;
    } else setBaseline(dealKey);
  }, [cleanTick]);
  const dirty = baseline !== null && dealKey !== baseline;
  useEffect(() => {
    let draft = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    } catch {}
    if (draft && draft.state) {
      applyState(draft.state);
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
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          state: getState(),
          baseline,
          ts: Date.now()
        }));
      } catch {}
    }, 600);
    return () => clearTimeout(id);
  }, [dealKey, baseline]);
  useEffect(() => {
    if (!dirty) return;
    const h = e => {
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
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (saveRef.current) saveRef.current();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const loadDeal = file => {
    setLoadOpen(false);
    if (dirty) setPendingAction({
      kind: "load",
      file
    });else openDeal(file);
  };
  const openDeal = async (file, token) => {
    if (!(token || accessToken)) return;
    setDriveLoading(true);
    try {
      const data = await withAuthRetry(tok => driveRead(tok, file.id), token);
      resetFields();
      applyState(data);
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
      await withAuthRetry(tok => driveDelete(tok, file.id));
      delete fileIdMap.current[file.name];
      await refreshFiles();
    } catch (e) {
      setDriveMsg("❌ " + e.message);
    }
  };
  const repairTotal = useMemo(() => {
    if (!useRepairBuilder) return manualRepair;
    return repairs.reduce((s, r) => s + (r.lump ? r.qty > 0 ? r.price : 0 : r.qty * r.price), 0);
  }, [repairs, useRepairBuilder, manualRepair]);
  const sumTxn = (items, basis, typeOverrides = {}) => TXN_TEMPLATE.reduce((s, t) => {
    const it = items[t.key];
    if (!it || !it.on) return s;
    const effType = it.type || typeOverrides[t.key] || t.type;
    return s + (effType === "pct" ? it.val / 100 * basis : it.val);
  }, 0);
  const dealInputs = {
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
    sqft
  };
  const m = useMemo(() => calcDeal(dealInputs), [repairTotal, purchase, loanOnPurchasePct, loanOnRehabPct, intRatePurchase, intRateRehab, points, investorAmount, investorAuto, investorRate, holdMonths, taxAnnual, insMonthly, hoaMonthly, utilGas, utilWater, utilElec, miscHold, buyTxn, sellTxn, arv, sqft]);
  useEffect(() => {
    if (!investorAuto) return;
    setInvestorAmount(calcDeal({
      ...dealInputs,
      investorAuto: true
    }).investorAmount);
  }, [investorAuto, purchase, repairTotal, loanOnPurchasePct, loanOnRehabPct, buyTxn]);
  const deal = useMemo(() => {
    const r = m.repair,
      h = holdMonths,
      p = m.netProfit;
    let rehabLvl;
    if (r < 20000) rehabLvl = 1;else if (r <= 50000) rehabLvl = 2;else if (r <= 100000) rehabLvl = 3;else if (r <= 175000) rehabLvl = 4;else rehabLvl = 5;
    let holdLvl;
    if (h <= 3) holdLvl = 1;else if (h <= 4) holdLvl = 2;else if (h <= 6) holdLvl = 3;else if (h <= 9) holdLvl = 4;else holdLvl = 5;
    const riskLevel = Math.max(rehabLvl, holdLvl);
    const TARGETS = [20000, 30000, 40000, 55000, 75000];
    const target = TARGETS[riskLevel - 1];
    const ratio = p / target;
    const LADDER = ["Reject", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
    let idx;
    if (ratio >= 1.6) idx = 9;else if (ratio >= 1.4) idx = 8;else if (ratio >= 1.25) idx = 7;else if (ratio >= 1.1) idx = 6;else if (ratio >= 1.0) idx = 5;else if (ratio >= 0.9) idx = 4;else if (ratio >= 0.8) idx = 3;else if (ratio >= 0.7) idx = 2;else if (ratio >= 0.6) idx = 1;else idx = 0;
    const initialGrade = LADDER[idx];
    const adj = [];
    if (h <= 2) {
      idx += 1;
      adj.push({
        label: "Speed bonus (\u22642 mo)",
        delta: 1
      });
    } else if (h > 6 && h <= 9) {
      idx -= 1;
      adj.push({
        label: "Long hold (7\u20139 mo)",
        delta: -1
      });
    } else if (h > 9) {
      idx -= 2;
      adj.push({
        label: "Very long hold (>9 mo)",
        delta: -2
      });
    }
    if (purchase > 300000 && r < purchase * 0.1 && h <= 3) {
      idx += 1;
      adj.push({
        label: "Capital efficiency",
        delta: 1
      });
    }
    if (r > 150000 && h > 6 && p < 60000) {
      idx += -1;
      adj.push({
        label: "Heavy construction risk",
        delta: -1
      });
    }
    idx = Math.max(0, Math.min(9, idx));
    const finalLetter = LADDER[idx];
    const grade = idx === 0 ? "REJECT" : finalLetter;
    const gradeColor = idx === 0 ? T.red : idx >= 7 ? T.green : idx >= 4 ? T.lime : T.amber;
    const RISK_COLORS = [T.green, T.lime, T.amber, T.violet, T.red];
    const tierColor = RISK_COLORS[riskLevel - 1];
    const tier = `Risk ${riskLevel}`;
    const pctTxt = `${Math.round(ratio * 100)}%`;
    let verdict = `Profit is ${pctTxt} of the Risk ${riskLevel} target (${fmt(target)}) \u2192 ${initialGrade}.`;
    if (adj.length) {
      verdict += ` ${adj.map(a => `${a.label} ${a.delta > 0 ? "+" : ""}${a.delta}`).join(", ")} \u2192 ${finalLetter}.`;
    }
    if (idx === 0) verdict += ` ${fmt(Math.max(0, target * 0.6 - p))} more profit needed to clear Reject.`;
    const incomplete = !(arv > 0 && purchase > 0);
    return {
      tier,
      tierColor,
      grade: incomplete ? "\u2014" : grade,
      gradeColor: incomplete ? T.txtMute : gradeColor,
      verdict: incomplete ? "Enter ARV and purchase price to grade this deal." : verdict,
      incomplete,
      threshold: target,
      riskLevel,
      ratio,
      initialGrade,
      finalLetter,
      adj,
      rehabLvl,
      holdLvl
    };
  }, [m.repair, m.netProfit, holdMonths, purchase, arv]);
  const mao = useMemo(() => ({
    target: solvePurchaseFor(dealInputs, deal.threshold),
    walk: solvePurchaseFor(dealInputs, deal.threshold * 0.6)
  }), [m, deal.threshold]);
  const groups = ["Exterior", "Interior", "Mechanicals", "Other"];
  const updateRepair = (i, f, v) => setRepairs(p => p.map((r, idx) => idx === i ? {
    ...r,
    [f]: v
  } : r));
  const actualsTotal = actuals.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const actualProfit = actualSale - actualsTotal;
  const variance = actualProfit - m.netProfit;
  const salePending = !(actualSale > 0);
  const spendBudget = m.totalCosts - m.totalSelling;
  const actualCats = ["Acquisition", "Rehab / Construction", "Holding", "Services", "Selling", "Other"];
  const addActual = () => {
    if (!newItem.label && !newItem.amount) return;
    setActuals(p => [...p, {
      ...newItem,
      date: newItem.date || new Date().toISOString().slice(0, 10),
      id: Date.now(),
      files: []
    }]);
    setNewItem({
      cat: newItem.cat,
      label: "",
      amount: 0,
      date: new Date().toISOString().slice(0, 10)
    });
  };
  const catTotals = actualCats.map(c => ({
    cat: c,
    total: actuals.filter(a => a.cat === c).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
  })).filter(x => x.total > 0);
  const sortedActuals = [...actuals].sort((a, b) => {
    const da = a.date || "",
      db = b.date || "";
    if (da !== db) return db.localeCompare(da);
    return (b.id || 0) - (a.id || 0);
  });
  const effFilter = ledgerFilter !== "All" && actuals.some(a => a.cat === ledgerFilter) ? ledgerFilter : "All";
  const filteredActuals = effFilter === "All" ? sortedActuals : sortedActuals.filter(a => a.cat === effFilter);
  const filteredTotal = filteredActuals.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const gradeCardRef = useRef(null);
  const [showStickyGrade, setShowStickyGrade] = useState(false);
  useEffect(() => {
    const el = gradeCardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setShowStickyGrade(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: "-8px 0px 0px 0px"
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [mode]);
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
  const toggleStickyGrade = e => {
    if (e && e.type === "click" && e.currentTarget) e.currentTarget.blur();
    setStickyCollapsed(c => !c);
  };
  const stickyKey = e => {
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
    if (t) t.focus({
      preventScroll: true
    });
  }, [stickyCollapsed]);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [fileUploading, setFileUploading] = useState(null);
  const fileInputRef = useRef(null);
  const pendingEntryId = useRef(null);
  const handleFileSelect = async e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const entryId = pendingEntryId.current;
    if (!entryId) return;
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
      const uploaded = await withAuthRetry(async tok => {
        const results = [];
        for (const file of files) {
          const result = await driveUploadFile(tok, settings.folderId, file);
          results.push({
            type: "drive_file",
            driveFileId: result.id,
            name: result.name,
            mimeType: result.mimeType,
            size: result.size
          });
        }
        return results;
      });
      setActuals(prev => prev.map(a => a.id === entryId ? {
        ...a,
        files: [...(a.files || []), ...uploaded]
      } : a));
      setDriveMsg(`✓ ${uploaded.length} file(s) uploaded`);
      setTimeout(() => setDriveMsg(""), 2500);
    } catch (err) {
      setDriveMsg("❌ " + err.message);
    } finally {
      setFileUploading(null);
      e.target.value = "";
    }
  };
  const removeAttachment = async (entryId, fileRef) => {
    if (fileRef.driveFileId && accessToken) {
      try {
        await withAuthRetry(tok => driveDelete(tok, fileRef.driveFileId));
      } catch {}
    }
    setActuals(prev => prev.map(a => a.id === entryId ? {
      ...a,
      files: (a.files || []).filter(f => f !== fileRef)
    } : a));
  };
  const openAttachment = f => {
    if (f.type === "link") window.open(f.url, "_blank");else window.open(`https://drive.google.com/file/d/${f.driveFileId}/view`, "_blank");
  };
  const confirmLink = targetId => {
    if (!linkInputUrl.trim()) return;
    const name = linkInputName.trim() || linkInputUrl.replace(/.*\//, "").slice(0, 40) || "Google Link";
    const entry = {
      type: "link",
      url: linkInputUrl.trim(),
      name
    };
    if (targetId === "cma") {
      setCmaFiles(prev => [...prev, entry]);
    } else {
      setActuals(prev => prev.map(a => a.id === targetId ? {
        ...a,
        files: [...(a.files || []), entry]
      } : a));
    }
    setLinkInputFor(null);
    setLinkInputUrl("");
    setLinkInputName("");
  };
  const handleCMAFileSelect = async e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (!accessToken) {
      setDriveMsg("⚠ Connect Google Drive first");
      setTimeout(() => setDriveMsg(""), 3000);
      return;
    }
    setDriveLoading(true);
    try {
      const uploaded = await withAuthRetry(async tok => {
        const results = [];
        for (const file of files) {
          const result = await driveUploadFile(tok, settings.folderId, file);
          results.push({
            type: "drive_file",
            driveFileId: result.id,
            name: result.name,
            mimeType: result.mimeType,
            size: result.size
          });
        }
        return results;
      });
      setCmaFiles(prev => [...prev, ...uploaded]);
      setDriveMsg(`✓ CMA uploaded`);
      setTimeout(() => setDriveMsg(""), 2000);
    } catch (err) {
      setDriveMsg("❌ " + err.message);
    } finally {
      setDriveLoading(false);
      e.target.value = "";
    }
  };
  const startEdit = a => {
    setEditingId(a.id);
    setEditDraft({
      cat: a.cat,
      label: a.label,
      amount: a.amount,
      date: a.date || new Date().toISOString().slice(0, 10)
    });
  };
  const saveEdit = id => {
    setActuals(prev => prev.map(a => a.id === id ? {
      ...a,
      ...editDraft
    } : a));
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);
  const exportCSV = () => {
    const n = v => typeof v === "number" && isFinite(v) ? Math.round(v * 100) / 100 : "";
    const pc = v => typeof v === "number" && isFinite(v) ? (v * 100).toFixed(1) + "%" : "";
    const txnRows = (items, basis, typeOv = {}, labelOv = {}) => TXN_TEMPLATE.filter(t => items[t.key] && items[t.key].on).map(t => {
      const it = items[t.key];
      const typ = it.type || typeOv[t.key] || t.type;
      const val = parseFloat(it.val) || 0;
      return [labelOv[t.key] || t.label, typ === "pct" ? val + "%" : "flat", n(typ === "pct" ? val / 100 * basis : val)];
    });
    const repairRows = useRepairBuilder ? repairs.filter(r => r.qty > 0).map(r => [r.group, r.label, r.lump ? "lump" : r.qty, n(r.price), n(r.lump ? r.price : r.qty * r.price)]) : [["Manual total", "", "", "", n(manualRepair)]];
    const zillow = address.trim() ? `https://www.zillow.com/homes/${encodeURIComponent(address.trim())}_rb/` : "";
    const rows = [["KAPPA REAL ESTATE \u2014 Deal Breaker"], ["Property", address], ["Analysis date", analysisDate, "Exported", new Date().toISOString().slice(0, 10)], ["Year built", yearBuilt || "", "Sq ft", sqft || "", "Hold (months)", holdMonths], [], ["GRADE"], ["Grade", deal.grade, "Risk level", deal.riskLevel, "Target profit", n(deal.threshold)], ["Profit vs target", pc(deal.ratio), "Base grade", deal.initialGrade, "Adjustments", deal.adj.map(a => `${a.label} ${a.delta > 0 ? "+" : ""}${a.delta}`).join("; ") || "none"], ["Verdict", deal.verdict], [], ["KEY METRICS"], ["Net profit", n(m.netProfit), "ROI", pc(m.roi), "ROI annualized", pc(m.roiAnnual)], ["Cash-on-cash (ann.)", pc(m.cashOnCashAnnual), "Kappa cash in", n(m.cashIn), "Loan amount", n(m.loanAmount)], ["Max allowable offer", n(mao.target), "Walk-away price", n(mao.walk), "Cost per sq ft", n(m.costPerSqft)], [], ["PROFIT & LOSS"], ["After repair value", n(arv)], ["Purchase price", n(-purchase)], ["Repairs", n(-m.repair)], ["Financing", n(-m.totalFinancing), "interest", n(m.interest), "investor return", n(m.investorInterest), "points", n(points)], ["Holding", n(-m.totalHolding), "per month", n(m.totalMonthlyHold)], ["Buying costs", n(-m.totalBuying)], ["Selling costs", n(-m.totalSelling)], ["NET PROFIT", n(m.netProfit)], [], ["FINANCING"], ["Loan on purchase", pc(loanOnPurchasePct), "Purchase rate", pc(intRatePurchase)], ["Loan on rehab", pc(loanOnRehabPct), "Rehab rate", pc(intRateRehab)], ["Investor amount", n(m.investorAmount), "Investor return", pc(investorRate)], [], ["HOLDING (monthly)"], ["Property taxes", n(taxAnnual / 12), "Insurance", n(insMonthly), "HOA", n(hoaMonthly)], ["Gas", n(utilGas), "Water", n(utilWater), "Electric", n(utilElec), "Misc", n(miscHold)], [], ["BUYING TRANSACTION COSTS", "basis", "amount"], ...txnRows(buyTxn, purchase, BUY_TYPE_OVERRIDES, BUY_LABEL_OVERRIDES), [], ["SELLING TRANSACTION COSTS", "basis", "amount"], ...txnRows(sellTxn, arv), [], ["REPAIRS", "item", "qty", "unit price", "total"], ...repairRows, ["Total repairs", "", "", "", n(m.repair)], [], ["ACTUALS LEDGER", "category", "description", "amount"], ...[...actuals].sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(a => [a.date || "", a.cat, a.label, n(parseFloat(a.amount) || 0)]), ["Total spent", "", "", n(actualsTotal)], ["Actual sale price", "", "", salePending ? "pending" : n(actualSale)], ["Actual profit", "", "", salePending ? "pending" : n(actualProfit)], ["Variance vs underwrite", "", "", salePending ? "pending" : n(variance)], [], ["LINKS"], ["Zillow", zillow], ["Photos folder", photosUrl || ""]];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;"
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
  return <div className="kappa-root" onFocus={e => {
    if (e.target && e.target.tagName === "INPUT" && e.target.type === "number") {
      e.target.select();
    }
  }} style={{
    background: T.bg,
    color: T.txt,
    minHeight: "100vh",
    fontFamily: FONT,
    padding: "26px 20px",
    transition: "background .3s"
  }}>{mode === "underwrite" && <GradeExplainer deal={deal} repair={m.repair} holdMonths={holdMonths} netProfit={m.netProfit} visible={gradeHover && !deal.incomplete} />}{mode === "underwrite" && <div ref={stickyFullRef} className="no-print sticky-grade" role="button" tabIndex={stickyFullOn ? 0 : -1} aria-hidden={!stickyFullOn} aria-label="Collapse the Deal Grade panel to the side" title="Click to collapse to the side" onClick={toggleStickyGrade} onKeyDown={stickyKey} style={{
      position: "fixed",
      left: 18,
      top: "50%",
      transform: `translateY(-50%) translateX(${stickyFullOn ? "0" : "-24px"})`,
      zIndex: 60,
      width: 190,
      opacity: stickyFullOn ? 1 : 0,
      pointerEvents: stickyFullOn ? "auto" : "none",
      cursor: "pointer",
      transition: "opacity .25s ease, transform .25s ease"
    }}><div style={gp({
        padding: "16px 16px",
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${deal.gradeColor}66`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.45), 0 0 0 1px ${deal.gradeColor}22`
      })}><div style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(160px 100px at 90% 6%, ${deal.gradeColor}2e, transparent)`
        }} /><div style={{
          position: "relative"
        }}><div style={{
            fontSize: 9.5,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.txtDim,
            fontWeight: 700
          }}>Deal Grade</div><div style={{
            fontSize: 40,
            fontWeight: 900,
            lineHeight: 1,
            color: deal.gradeColor,
            letterSpacing: "-0.04em",
            textShadow: `0 0 18px ${deal.gradeColor}55`,
            marginTop: 4
          }}>{deal.grade}</div><div style={{
            marginTop: 6
          }}><span style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 16,
              background: `${deal.tierColor}26`,
              color: deal.tierColor,
              fontSize: 10,
              fontWeight: 700
            }}>{deal.tier}</span></div><div style={{
            height: 1,
            background: T.border,
            margin: "12px 0 10px"
          }} /><div style={{
            fontSize: 9.5,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.txtDim,
            fontWeight: 700
          }}>Net Profit</div><div style={{
            fontSize: 22,
            fontWeight: 800,
            lineHeight: 1.1,
            marginTop: 4,
            fontFamily: MONO,
            color: deal.incomplete ? T.txtMute : m.netProfit > 0 ? T.green : T.red
          }}>{deal.incomplete ? "\u2014" : fmt(m.netProfit)}</div></div><div className="sg-chev" aria-hidden={true} style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 22,
          height: 22,
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: T.inputBg,
          border: `1px solid ${T.border}`,
          color: T.txtDim,
          transition: "background .15s, color .15s"
        }}><svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="7.5 2.5 4 6 7.5 9.5" /></svg></div></div></div>}{mode === "underwrite" && <div ref={stickyTabRef} className="no-print sticky-grade-tab" role="button" tabIndex={stickyTabOn ? 0 : -1} aria-hidden={!stickyTabOn} aria-label={`Deal Grade ${deal.grade}, Net Profit ${deal.incomplete ? "not available" : fmt(m.netProfit)}. Expand the panel`} title={`Deal Grade ${deal.grade} \u00b7 Net Profit ${deal.incomplete ? "\u2014" : fmt(m.netProfit)}\nClick to expand`} onClick={toggleStickyGrade} onKeyDown={stickyKey} style={{
      position: "fixed",
      left: 0,
      top: "50%",
      transform: `translateY(-50%) translateX(${stickyTabOn ? "0" : "-110%"})`,
      zIndex: 60,
      width: 38,
      opacity: stickyTabOn ? 1 : 0,
      pointerEvents: stickyTabOn ? "auto" : "none",
      cursor: "pointer",
      transition: "opacity .25s ease, transform .25s ease, box-shadow .15s",
      background: T.glassHi,
      border: `1px solid ${deal.gradeColor}66`,
      borderLeft: "none",
      borderRadius: "0 12px 12px 0",
      boxShadow: `0 6px 20px rgba(15,23,42,.14), 0 0 0 1px ${deal.gradeColor}1f`,
      padding: "11px 0 8px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      fontFamily: FONT,
      userSelect: "none"
    }}><div style={deal.grade.length > 2 ? {
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
        fontSize: 10.5,
        fontWeight: 900,
        letterSpacing: ".12em",
        lineHeight: 1,
        color: deal.gradeColor
      } : {
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color: deal.gradeColor,
        textShadow: `0 0 12px ${deal.gradeColor}44`
      }}>{deal.grade}</div><div style={{
        width: 18,
        height: 1,
        background: T.border
      }} /><div style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: deal.incomplete ? T.txtMute : m.netProfit > 0 ? T.green : T.red
      }}>{deal.incomplete ? "\u2014" : fmtK(m.netProfit)}</div><div className="sg-chev-tab" aria-hidden={true} style={{
        display: "flex",
        color: T.txtMute,
        marginTop: 1,
        transition: "color .15s"
      }}><svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="4.5 2.5 8 6 4.5 9.5" /></svg></div></div>}{pendingAction && <div className="no-print" style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.55)",
      backdropFilter: "blur(4px)",
      zIndex: 200,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }} onClick={() => setPendingAction(null)}><div onClick={e => e.stopPropagation()} style={gp({
        padding: "26px 28px",
        maxWidth: 460,
        width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)"
      })}><div style={{
          fontSize: 11,
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.txtDim,
          fontWeight: 700
        }}>{pendingAction.kind === "load" ? "Open Saved Deal" : "Start New Deal"}</div><h3 style={{
          margin: "8px 0 6px",
          fontSize: 19,
          fontWeight: 800,
          color: T.txt
        }}>Save the current deal first?</h3><p style={{
          margin: "0 0 20px",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: T.txtDim
        }}>{(address.trim() ? `\u201c${address.trim()}\u201d has changes that aren't saved to Drive.` : "This analysis has unsaved work \u2014 add an address to save it.") + (pendingAction.kind === "load" ? ` Save before opening \u201c${pendingAction.file.name.replace(/\.json$/, "")}\u201d, or discard them.` : " Save before clearing, or discard and start fresh.")}</p><div style={{
          display: "flex",
          gap: 9,
          flexWrap: "wrap"
        }}><button onClick={saveThenProceed} disabled={!address.trim()} style={{
            ...bs(address.trim() ? T.teal + "1f" : T.glass, address.trim() ? T.teal : T.txtMute),
            fontWeight: 700,
            cursor: address.trim() ? "pointer" : "not-allowed",
            flex: "1 1 auto"
          }}>{pendingAction.kind === "load" ? "💾 Save & Open" : "💾 Save & Start New"}</button><button onClick={discardThenProceed} style={{
            ...bs(T.glass, T.red),
            fontWeight: 700,
            flex: "1 1 auto"
          }}>{pendingAction.kind === "load" ? "Discard & Open" : "Discard & Start New"}</button><button onClick={() => setPendingAction(null)} style={{
            ...bs(T.glass, T.txtDim),
            flex: "0 0 auto"
          }}>Cancel</button></div></div></div>}{showSettings && <SettingsModal settings={settings} onSave={saveSettings} onClose={() => setShowSettings(false)} />}<div style={{
      maxWidth: 1240,
      margin: "0 auto"
    }}><header className="no-print" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 22
      }}><div style={{
          display: "flex",
          alignItems: "center",
          gap: 18
        }}><img src={LOGO} alt="Kappa" style={{
            height: 58,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))"
          }} /><div style={{
            borderLeft: `1px solid ${T.border}`,
            paddingLeft: 18
          }}><div style={{
              fontSize: 12,
              letterSpacing: ".28em",
              textTransform: "uppercase",
              color: T.teal,
              fontWeight: 700
            }}>Deal Breaker</div><input placeholder="Enter property address…" value={address} onChange={e => setAddress(e.target.value)} style={{
              display: "block",
              marginTop: 4,
              border: "none",
              borderBottom: `1px solid ${T.border}`,
              background: "transparent",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.01em",
              color: address ? T.txt : T.txtMute,
              outline: "none",
              width: 420,
              maxWidth: "100%",
              padding: "3px 0",
              fontFamily: FONT
            }} /><input type="date" value={analysisDate} onChange={e => setAnalysisDate(e.target.value)} style={{
              marginTop: 4,
              border: "none",
              borderBottom: `1px solid ${T.border}`,
              background: "transparent",
              fontSize: 13,
              fontWeight: 600,
              color: T.txtDim,
              outline: "none",
              padding: "2px 0",
              fontFamily: MONO,
              colorScheme: "dark"
            }} /></div></div><div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center"
        }}>{!accessToken ? <React.Fragment><button onClick={signIn} style={bs(`${T.teal}22`, T.tealLt)}>🔗 Connect Google{dirty && <span title="Unsaved changes" style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.amber,
                marginLeft: 8,
                verticalAlign: "middle"
              }} />}</button><button onClick={() => setShowSettings(true)} style={bs(T.glass, T.txtDim)}>⚙</button></React.Fragment> : <React.Fragment><div style={{
              position: "relative"
            }}><button onClick={() => {
                setLoadOpen(o => {
                  if (!o) {
                    refreshFiles();
                    setDealSearch("");
                  }
                  return !o;
                });
              }} style={bs(T.glass, T.txtDim)}>📂 Saved Deals {driveFiles.length > 0 && <span style={{
                  marginLeft: 4,
                  padding: "1px 6px",
                  borderRadius: 8,
                  background: T.teal,
                  color: "#06262a",
                  fontSize: 10,
                  fontWeight: 800
                }}>{driveFiles.length}</span>}</button>{loadOpen && <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 320,
                zIndex: 99,
                ...gp({
                  padding: "10px",
                  borderRadius: 14,
                  border: `1px solid ${T.borderHi}`
                })
              }}><div style={{
                  position: "relative",
                  marginBottom: 8
                }}><span style={{
                    position: "absolute",
                    left: 9,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13,
                    color: T.txtMute,
                    pointerEvents: "none"
                  }}>🔍</span><input autoFocus={true} placeholder="Search deals…" value={dealSearch} onChange={e => setDealSearch(e.target.value)} style={{
                    width: "100%",
                    padding: "8px 10px 8px 30px",
                    border: `1px solid ${T.border}`,
                    borderRadius: 9,
                    fontSize: 12.5,
                    fontFamily: FONT,
                    background: T.inputBg,
                    color: T.txt,
                    outline: "none",
                    boxSizing: "border-box"
                  }} />{dealSearch && <button onClick={() => setDealSearch("")} style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: T.txtMute,
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1
                  }}>✕</button>}</div><div style={{
                  maxHeight: 280,
                  overflowY: "auto"
                }}>{(() => {
                    const filtered = driveFiles.filter(f => f.name.replace(".json", "").toLowerCase().includes(dealSearch.toLowerCase().trim()));
                    if (driveFiles.length === 0) return <div style={{
                      padding: "12px 10px",
                      color: T.txtMute,
                      fontSize: 12
                    }}>No saved deals yet.</div>;
                    if (filtered.length === 0) return <div style={{
                      padding: "12px 10px",
                      color: T.txtMute,
                      fontSize: 12,
                      textAlign: "center"
                    }}>No matches for "{dealSearch}"</div>;
                    return filtered.map(f => {
                      const name = f.name.replace(".json", "");
                      const q = dealSearch.toLowerCase().trim();
                      const idx = name.toLowerCase().indexOf(q);
                      const highlighted = q && idx >= 0 ? <span>{name.slice(0, idx)}<mark style={{
                          background: `${T.teal}44`,
                          color: T.teal,
                          borderRadius: 2,
                          padding: "0 1px"
                        }}>{name.slice(idx, idx + q.length)}</mark>{name.slice(idx + q.length)}</span> : <span>{name}</span>;
                      return <div key={f.id} onClick={() => {
                        loadDeal(f);
                        setDealSearch("");
                      }} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: T.txt
                      }} onMouseEnter={e => e.currentTarget.style.background = T.glassHi} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><div><div style={{
                            fontFamily: MONO,
                            fontSize: 12
                          }}>{highlighted}</div><div style={{
                            fontSize: 10,
                            color: T.txtMute,
                            marginTop: 2
                          }}>{new Date(f.modifiedTime).toLocaleDateString()}</div></div><button onClick={e => deleteDeal(f, e)} style={{
                          background: "transparent",
                          border: "none",
                          color: T.red,
                          cursor: "pointer",
                          fontSize: 14,
                          padding: "2px 6px",
                          flexShrink: 0
                        }}>✕</button></div>;
                    });
                  })()}</div>{driveFiles.length > 0 && <div style={{
                  borderTop: `1px solid ${T.border}`,
                  marginTop: 6,
                  paddingTop: 6,
                  fontSize: 10,
                  color: T.txtMute,
                  textAlign: "center",
                  fontFamily: MONO
                }}>{dealSearch ? `${driveFiles.filter(f => f.name.toLowerCase().includes(dealSearch.toLowerCase())).length} of ${driveFiles.length} deals` : `${driveFiles.length} deal${driveFiles.length !== 1 ? "s" : ""} total`}</div>}</div>}</div><button onClick={saveDeal} disabled={driveLoading} title={dirty ? "Unsaved changes \u2014 save to Drive (Ctrl+S)" : "Save to Drive (Ctrl+S)"} style={bs(T.teal, "#06262a")}>{driveLoading ? "⏳" : "💾"} Save Deal{dirty && !driveLoading && <span title="Unsaved changes" style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: T.amber,
                marginLeft: 8,
                verticalAlign: "middle",
                boxShadow: "0 0 0 2px rgba(255,255,255,.7)"
              }} />}</button><button onClick={() => setShowSettings(true)} style={bs(T.glass, T.txtDim)}>⚙</button><span style={{
              fontSize: 11,
              color: T.txtMute,
              fontFamily: MONO
            }} title={userEmail}>🟢 {userEmail}</span></React.Fragment>}{driveMsg && <span style={{
            fontSize: 12,
            fontFamily: MONO,
            color: driveMsg.startsWith("✓") ? T.green : driveMsg.startsWith("⚠") ? T.amber : T.red
          }}>{driveMsg}</span>}<div style={{
            width: 1,
            height: 28,
            background: T.border
          }} /><div style={gp({
            display: "flex",
            borderRadius: 13,
            padding: 4,
            gap: 4
          })}>{[["underwrite", "Underwrite"], ["actuals", "Actuals Ledger"]].map(([k, lbl]) => <button key={k} onClick={() => setMode(k)} style={{
              padding: "9px 18px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONT,
              background: mode === k ? T.teal : "transparent",
              color: mode === k ? "#06262a" : T.txtDim,
              transition: "all .15s"
            }}>{lbl}</button>)}</div><div style={{
            width: 1,
            height: 28,
            background: T.border
          }} /><button onClick={requestNewDeal} title="Clear all fields and start a new deal" style={{
            ...bs(T.glass, T.teal),
            fontWeight: 700
          }}>✨ New Deal</button><button onClick={exportCSV} style={bs(T.glass, T.txtDim)}>⬇ CSV</button><button onClick={() => window.print()} style={bs(T.glass, T.txtDim)}>🖨 PDF</button></div></header>{mode === "underwrite" ? <React.Fragment><div className="top-summary-grid" style={{
          display: "grid",
          gap: 16,
          marginBottom: 12
        }}><div ref={gradeCardRef} onMouseEnter={() => setGradeHover(true)} onMouseLeave={() => setGradeHover(false)} title="Hover for a full breakdown of how this grade was calculated" style={gp({
            padding: "20px 22px",
            position: "relative",
            overflow: "hidden",
            border: `1px solid ${deal.gradeColor}66`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            cursor: "help"
          })}><div style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(220px 130px at 88% 8%, ${deal.gradeColor}26, transparent)`
            }} /><div style={{
              position: "relative"
            }}><div style={{
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: T.txtDim,
                fontWeight: 700
              }}>Deal Grade</div><div style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 6
              }}><div style={{
                  fontSize: 56,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: deal.gradeColor,
                  letterSpacing: "-0.04em",
                  textShadow: `0 0 24px ${deal.gradeColor}55`
                }}>{deal.grade}</div><div style={{
                  paddingTop: 6
                }}><span style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: `${deal.tierColor}26`,
                    color: deal.tierColor,
                    fontSize: 11.5,
                    fontWeight: 700
                  }}>{deal.tier}</span><div style={{
                    fontSize: 11,
                    color: T.txtMute,
                    marginTop: 5,
                    fontFamily: MONO
                  }}>target {deal.threshold ? fmt(deal.threshold) : "manual"}</div></div></div></div></div><div className="kpi-row-3" style={{
            display: "grid",
            gap: 12
          }}><Kpi label="Net Profit" value={deal.incomplete ? "\u2014" : fmt(m.netProfit)} tone={deal.incomplete ? T.txtDim : m.netProfit > 0 ? T.green : T.red} big={true} desc="Sale price (ARV) minus purchase, repairs, financing, holding and all buying and selling costs." /><Kpi label="ROI" value={deal.incomplete ? "\u2014" : pct(m.roi)} tone={deal.incomplete ? T.txtDim : m.roi > 0 ? T.green : T.red} hint={deal.incomplete ? undefined : `annualized ${pct(m.roiAnnual)}`} desc="Net profit divided by the total all-in project cost (purchase, repairs, financing, holding and transaction costs). Annualized scales it by hold time." /><Kpi label="Cash-on-Cash (ann.)" value={deal.incomplete || !Number.isFinite(m.cashOnCashAnnual) ? "\u2014" : m.cashOnCashAnnual > 9.99 ? "999%+" : pct(m.cashOnCashAnnual)} tone={deal.incomplete ? T.txtDim : m.netProfit > 0 ? T.green : T.red} hint={deal.incomplete ? undefined : `on ${fmt(m.cashIn)} Kappa cash`} desc="Annualized return on Kappa's own out-of-pocket cash only. With lender and investor funding most of the deal, this is naturally very high." /><Kpi label="Max Allowable Offer" value={deal.incomplete ? "\u2014" : mao.target == null ? "Not reachable" : fmt(mao.target)} tone={deal.incomplete || mao.target == null ? T.txtDim : purchase <= mao.target ? T.green : mao.walk != null && purchase <= mao.walk ? T.amber : T.red} hint={deal.incomplete ? undefined : mao.walk != null ? `walk away above ${fmt(mao.walk)}` : "misses Reject line at any price"} desc={`Highest purchase price that still earns the Risk ${deal.riskLevel} target profit (${fmt(deal.threshold)}), solved exactly against financing, investor return and transaction costs. Above the walk-away price the deal grades Reject.`} /><Kpi label="Loan Amount" value={fmt(m.loanAmount)} tone={T.violet} desc="Total lender financing across the purchase and rehab portions combined." /><Kpi label="Kappa Cash In" value={deal.incomplete ? "\u2014" : fmt(m.cashIn)} tone={T.txtDim} hint={deal.incomplete ? undefined : "points + carry + equity gap"} desc="Kappa's own out-of-pocket cash: points, interest, holding costs and any equity the lender and investor don't cover. Selling costs and the investor's return come out of sale proceeds, so they're not included." /></div></div><div className="map-resources-grid" style={{
          display: "grid",
          gap: 12,
          marginBottom: 18
        }}><PropertyMapCard address={address} apiKey={settings.mapsApiKey} /><ResourcesPanel address={address} photosUrl={photosUrl} setPhotosUrl={setPhotosUrl} /></div><div className="main-two-col" style={{
          display: "grid",
          gap: 16,
          alignItems: "start"
        }}><div><Panel title="Valuation" accent={T.teal}><Field label="After Repair Value (ARV)" value={arv} onChange={setArv} prefix="$" step={1000} /><div className="field-grid-2" style={{
                display: "grid",
                gap: 12
              }}><Field label="Year Built" value={yearBuilt} onChange={setYearBuilt} step={1} hint="reference only" /><Field label="Purchase Price" value={purchase} onChange={setPurchase} prefix="$" step={1000} accent={T.amber} /></div><div className="field-grid-2" style={{
                display: "grid",
                gap: 12
              }}><Field label="Square Footage" value={sqft} onChange={setSqft} suffix="sf" /><Field label="Hold Time" value={holdMonths} onChange={setHoldMonths} suffix="months" accent={T.amber} /></div><div style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: `1px solid ${T.border}`
              }}><div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8
                }}><span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    color: T.tealLt
                  }}>CMA / Comps</span><div style={{
                    display: "flex",
                    gap: 6
                  }}><button onClick={() => cmaFileInputRef.current.click()} style={{
                      ...bs(`${T.teal}22`, T.tealLt),
                      fontSize: 11,
                      padding: "4px 10px"
                    }}>⬆ Upload</button><button onClick={() => {
                      setLinkInputFor("cma");
                      setLinkInputUrl("");
                      setLinkInputName("");
                    }} style={{
                      ...bs(T.glass, T.txtDim),
                      fontSize: 11,
                      padding: "4px 10px"
                    }}>🔗 Add Link</button></div></div><input ref={cmaFileInputRef} type="file" accept="image/*,.pdf" multiple={true} style={{
                  display: "none"
                }} onChange={handleCMAFileSelect} />{linkInputFor === "cma" && <div style={{
                  background: T.inputBg,
                  borderRadius: 9,
                  padding: "10px",
                  marginBottom: 8,
                  border: `1px solid ${T.border}`
                }}><input placeholder="Google Drive / Docs URL" value={linkInputUrl} onChange={e => setLinkInputUrl(e.target.value)} style={{
                    ...ss,
                    marginBottom: 6,
                    fontSize: 12
                  }} /><div style={{
                    display: "flex",
                    gap: 6
                  }}><input placeholder="Label (optional)" value={linkInputName} onChange={e => setLinkInputName(e.target.value)} onKeyDown={e => {
                      if (e.key === "Enter") confirmLink("cma");
                    }} style={{
                      ...ss,
                      flex: 1,
                      fontSize: 12
                    }} /><button onClick={() => confirmLink("cma")} style={bs(T.teal, "#06262a")}>Add</button><button onClick={() => setLinkInputFor(null)} style={bs(T.glass, T.txtDim)}>✕</button></div></div>}{cmaFiles.length === 0 ? <div style={{
                  fontSize: 11,
                  color: T.txtMute,
                  fontStyle: "italic"
                }}>No CMA attached yet</div> : cmaFiles.map((f, i) => <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 0",
                  borderBottom: `1px solid ${T.border}`
                }}><span style={{
                    fontSize: 12
                  }}>{f.type === "link" ? "🔗" : f.mimeType === "application/pdf" ? "📄" : "🖼"}</span><span style={{
                    flex: 1,
                    fontSize: 12,
                    color: T.txt,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>{f.name}</span><button onClick={() => {
                    f.type === "link" ? window.open(f.url, "_blank") : window.open(`https://drive.google.com/file/d/${f.driveFileId}/view`, "_blank");
                  }} style={{
                    ...bs(`${T.teal}22`, T.tealLt),
                    fontSize: 11,
                    padding: "3px 8px"
                  }}>Open</button><button onClick={() => setCmaFiles(prev => prev.filter((_, j) => j !== i))} style={{
                    background: "transparent",
                    border: "none",
                    color: T.red,
                    cursor: "pointer",
                    fontSize: 13
                  }}>✕</button></div>)}</div></Panel><Panel title="Repair Estimator" accent={T.teal} right={<div style={{
              fontFamily: MONO,
              fontSize: 17,
              fontWeight: 800,
              color: T.teal
            }}>{fmt(repairTotal)}</div>}><div style={{
                display: "flex",
                gap: 14,
                marginBottom: 14
              }}>{[["Manual total", false], ["Itemized", true]].map(([lbl, val]) => <button key={lbl} onClick={() => setUseRepairBuilder(val)} style={{
                  padding: "7px 16px",
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: FONT,
                  border: `1px solid ${useRepairBuilder === val ? T.teal : T.border}`,
                  background: useRepairBuilder === val ? `${T.teal}26` : "transparent",
                  color: useRepairBuilder === val ? T.tealLt : T.txtDim
                }}>{lbl}</button>)}</div>{!useRepairBuilder ? <div style={{
                maxWidth: 320
              }}><Field label="Total repair estimate" value={manualRepair} onChange={setManualRepair} prefix="$" step={500} /></div> : <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: 20
              }}>{groups.map(g => <div key={g}><div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: T.tealLt,
                    marginBottom: 8,
                    paddingBottom: 5,
                    borderBottom: `1px solid ${T.border}`
                  }}>{g}</div>{repairs.map((r, i) => r.group === g && <div key={i} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 0",
                    borderBottom: `1px solid ${T.border}44`
                  }}><input type="number" onFocus={e => e.target.select()} value={r.qty} min={0} onChange={e => updateRepair(i, "qty", e.target.value === "" ? 0 : parseFloat(e.target.value))} style={{
                      width: 40,
                      padding: "4px 5px",
                      border: `1px solid ${T.border}`,
                      borderRadius: 7,
                      fontSize: 12,
                      fontFamily: MONO,
                      background: T.inputBg,
                      color: T.txt,
                      textAlign: "center"
                    }} /><span style={{
                      flex: 1,
                      fontSize: 12,
                      color: r.qty > 0 ? T.txt : T.txtMute,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>{r.label}</span><div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      flexShrink: 0
                    }} title="Unit price — click to edit"><span style={{
                        fontSize: 9,
                        color: T.txtMute
                      }}>$</span><input type="number" onFocus={e => e.target.select()} value={r.price} min={0} step={100} onChange={e => updateRepair(i, "price", parseFloat(e.target.value) || 0)} style={{
                        width: 66,
                        padding: "3px 5px",
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: MONO,
                        background: T.inputBg,
                        color: T.txtDim,
                        textAlign: "right"
                      }} /></div><span style={{
                      fontSize: 12,
                      color: r.qty > 0 ? T.teal : T.txtMute,
                      fontFamily: MONO,
                      width: 54,
                      textAlign: "right",
                      flexShrink: 0
                    }}>{fmt(r.lump ? r.qty > 0 ? r.price : 0 : r.qty * r.price)}</span></div>)}</div>)}</div>}</Panel><Panel title="Financing" kicker="split: purchase vs rehab" accent={T.violet}><div className="field-grid-2" style={{
                display: "grid",
                gap: 12
              }}><Field label="Loan on Purchase" value={loanOnPurchasePct * 100} onChange={v => setLoanOnPurchasePct(v / 100)} suffix="%" step={5} accent={T.violet} hint={`= ${fmt(purchase * loanOnPurchasePct)}`} /><Field label="Loan on Rehab" value={loanOnRehabPct * 100} onChange={v => setLoanOnRehabPct(v / 100)} suffix="%" step={5} accent={T.violet} hint={`= ${fmt(m.repair * loanOnRehabPct)}`} /></div><div className="field-grid-2" style={{
                display: "grid",
                gap: 12
              }}><Field label="Purchase Rate" value={intRatePurchase * 100} onChange={v => setIntRatePurchase(v / 100)} suffix="%" step={0.25} accent={T.violet} /><Field label="Rehab Rate" value={intRateRehab * 100} onChange={v => setIntRateRehab(v / 100)} suffix="%" step={0.25} accent={T.violet} /></div><Field label="Points / Lender Fees" value={points} onChange={setPoints} prefix="$" /><div style={{
                marginTop: 4,
                paddingTop: 12,
                borderTop: `1px solid ${T.border}`
              }}><div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10
                }}><span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: T.violet
                  }}>Investor Capital</span>{investorAuto ? <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: ".05em",
                    padding: "2px 7px",
                    borderRadius: 20,
                    background: `${T.violet}22`,
                    color: T.violet
                  }}>AUTO</span> : <button onClick={() => setInvestorAuto(true)} title="Re-enable automatic calculation" style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: ".05em",
                    padding: "2px 7px",
                    borderRadius: 20,
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    color: T.txtMute,
                    cursor: "pointer"
                  }}>↺ AUTO</button>}</div><div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "6px 10px",
                  marginBottom: 10,
                  background: T.inputBg,
                  borderRadius: 9
                }}><span style={{
                    fontSize: 11,
                    color: T.txtDim
                  }}>Buying Transaction Costs <span style={{
                      color: T.txtMute
                    }}>(mirrored, funded by investor)</span></span><span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.violet,
                    fontFamily: MONO
                  }}>{fmt(m.totalBuying)}</span></div><div className="field-grid-2" style={{
                  display: "grid",
                  gap: 12
                }}><Field label="Investor Amount" value={investorAmount} onChange={v => {
                    setInvestorAmount(v);
                    setInvestorAuto(false);
                  }} prefix="$" step={5000} accent={T.violet} hint={investorAuto ? "= cash gap incl. buying costs, after lender loan" : investorAmount > 0 ? `Flat return: ${fmt(m.investorInterest)}` : "manual override"} /><Field label="Investor Return %" value={investorRate * 100} onChange={v => setInvestorRate(v / 100)} suffix="%" step={0.5} accent={T.violet} /></div></div><div style={{
                background: T.inputBg,
                borderRadius: 12,
                padding: "10px 14px",
                marginTop: 4
              }}><LR label="Total Loan Amount" value={fmt(m.loanAmount)} accent={T.violet} /><LR label={`Lender interest (${holdMonths} mo)`} value={fmt(m.interest)} />{investorAmount > 0 && <LR label="Investor flat return" value={fmt(m.investorInterest)} />}<LR label="Total Financing Cost" value={fmt(m.totalFinancing)} strong={true} accent={T.violet} /></div></Panel><Panel title="Holding Costs" kicker="monthly" accent={T.amber}><Field label="Property Taxes (annual)" value={taxAnnual} onChange={setTaxAnnual} prefix="$" hint={`${fmt(taxAnnual / 12)}/mo`} /><div className="field-grid-2" style={{
                display: "grid",
                gap: 12
              }}><Field label="Insurance /mo" value={insMonthly} onChange={setInsMonthly} prefix="$" /><Field label="HOA /mo" value={hoaMonthly} onChange={setHoaMonthly} prefix="$" /></div><div className="field-grid-3" style={{
                display: "grid",
                gap: 10
              }}><Field label="Gas" value={utilGas} onChange={setUtilGas} prefix="$" /><Field label="Water" value={utilWater} onChange={setUtilWater} prefix="$" /><Field label="Electric" value={utilElec} onChange={setUtilElec} prefix="$" /></div><Field label="Misc holding /mo" value={miscHold} onChange={setMiscHold} prefix="$" /><div style={{
                background: T.inputBg,
                borderRadius: 12,
                padding: "10px 14px"
              }}><LR label="Monthly holding" value={fmt(m.totalMonthlyHold)} /><LR label={`Total holding × ${holdMonths} mo`} value={fmt(m.totalHolding)} strong={true} accent={T.amber} /></div></Panel></div><div><Panel title="Buying Transaction Costs" kicker="% of purchase" accent={T.blue} right={<span style={{
              fontFamily: MONO,
              fontWeight: 800,
              color: T.blue
            }}>{fmt(m.totalBuying)}</span>}><TxnEditor side="Buying" items={buyTxn} setItems={setBuyTxn} basis={purchase} basisLabel="of purchase" accent={T.blue} typeOverrides={BUY_TYPE_OVERRIDES} labelOverrides={BUY_LABEL_OVERRIDES} /></Panel><Panel title="Selling Transaction Costs" kicker="% of ARV" accent={T.blue} right={<span style={{
              fontFamily: MONO,
              fontWeight: 800,
              color: T.blue
            }}>{fmt(m.totalSelling)}</span>}><TxnEditor side="Selling" items={sellTxn} setItems={setSellTxn} basis={arv} basisLabel="of ARV" accent={T.blue} /></Panel><Panel title="Profit Waterfall" accent={T.green}><LR label="After Repair Value" value={fmt(arv)} accent={T.green} /><LR label="Purchase Price" value={fmt(purchase)} neg={true} /><LR label="Repairs" value={fmt(m.repair)} neg={true} /><LR label="Financing" value={fmt(m.totalFinancing)} neg={true} /><LR label="Holding" value={fmt(m.totalHolding)} neg={true} /><LR label="Buying Costs" value={fmt(m.totalBuying)} neg={true} /><LR label="Selling Costs" value={fmt(m.totalSelling)} neg={true} /><div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: `2px solid ${T.borderHi}`
              }}><div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline"
                }}><span style={{
                    fontSize: 14,
                    fontWeight: 800
                  }}>NET PROFIT</span><span style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: m.netProfit > 0 ? T.green : T.red,
                    fontFamily: MONO
                  }}>{fmt(m.netProfit)}</span></div></div><ProfitBar m={m} arv={arv} /></Panel></div></div></React.Fragment> : <React.Fragment><div className="kpi-grid-4" style={{
          display: "grid",
          gap: 12,
          marginBottom: 18
        }}><Kpi label="Total Spent (actual)" value={fmt(actualsTotal)} tone={T.amber} big={true} desc="Sum of every real expense logged in the Actuals Ledger below, across all categories." /><Kpi label="Actual Sale Price" value={fmt(actualSale)} tone={T.blue} desc="The real, final sale price the property closed for." /><Kpi label="Actual Net Profit" value={salePending ? "Pending sale" : fmt(actualProfit)} tone={salePending ? T.txtDim : actualProfit > 0 ? T.green : T.red} big={true} desc="Actual sale price minus total actual spend — the real profit realized on this deal." /><Kpi label="Variance vs Underwrite" value={salePending ? "Pending sale" : (variance >= 0 ? "+" : "") + fmt(variance)} tone={salePending ? T.txtDim : variance >= 0 ? T.green : T.red} hint={salePending ? `spent ${fmt(actualsTotal)} of ${fmt(spendBudget)} budget` : `proj. ${fmt(m.netProfit)}`} desc="Difference between actual net profit and the originally underwritten projection. Positive means you outperformed the plan." /></div><div className="actuals-two-col" style={{
          display: "grid",
          gap: 16,
          alignItems: "start"
        }}><Panel title="Expense Ledger" kicker={`${actuals.length} entries`} accent={T.amber}><input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple={true} style={{
              display: "none"
            }} onChange={handleFileSelect} /><div className="ledger-add-row" style={{
              display: "grid",
              gap: 8,
              marginBottom: 14,
              alignItems: "center"
            }}><input type="date" value={newItem.date || ""} onChange={e => setNewItem({
                ...newItem,
                date: e.target.value
              })} title="Expense date" style={{
                ...ss,
                fontFamily: MONO,
                fontSize: 12,
                colorScheme: "light"
              }} /><select value={newItem.cat} onChange={e => setNewItem({
                ...newItem,
                cat: e.target.value
              })} style={ss}>{actualCats.map(c => <option key={c} style={{
                  color: "#000"
                }}>{c}</option>)}</select><input placeholder="Description" value={newItem.label} onChange={e => setNewItem({
                ...newItem,
                label: e.target.value
              })} onKeyDown={e => e.key === "Enter" && addActual()} style={ss} /><input type="number" onFocus={e => e.target.select()} placeholder="$ amount" value={newItem.amount || ""} onChange={e => setNewItem({
                ...newItem,
                amount: parseFloat(e.target.value) || 0
              })} onKeyDown={e => e.key === "Enter" && addActual()} style={{
                ...ss,
                fontFamily: MONO
              }} /><button onClick={addActual} style={{
                background: T.teal,
                border: "none",
                borderRadius: 10,
                color: "#06262a",
                fontSize: 20,
                fontWeight: 800,
                cursor: "pointer",
                height: 38
              }}>+</button></div>{actuals.length > 0 && <div className="no-print" style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              margin: "2px 0 12px"
            }}>{["All", ...actualCats].map(c => {
                const active = effFilter === c;
                const count = c === "All" ? actuals.length : actuals.filter(a => a.cat === c).length;
                if (c !== "All" && count === 0) return null;
                return <button key={c} onClick={() => setLedgerFilter(c)} style={{
                  padding: "4px 11px",
                  borderRadius: 16,
                  border: `1px solid ${active ? T.teal : T.border}`,
                  background: active ? `${T.teal}22` : T.glass,
                  color: active ? T.teal : T.txtDim,
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all .12s"
                }}>{c}<span style={{
                    marginLeft: 5,
                    opacity: 0.6,
                    fontSize: 10
                  }}>{count}</span></button>;
              })}{effFilter !== "All" && <span style={{
                marginLeft: "auto",
                fontSize: 12,
                fontFamily: MONO,
                color: T.txtDim
              }}>{filteredActuals.length} item{filteredActuals.length === 1 ? "" : "s"} · <b style={{
                  color: T.txt
                }}>{fmt(filteredTotal)}</b></span>}</div>}{actuals.length === 0 ? <div style={{
              textAlign: "center",
              padding: "30px 0",
              color: T.txtMute,
              fontSize: 13
            }}>No expenses logged yet.</div> : <div>{filteredActuals.map(a => {
                const fileCount = (a.files || []).length;
                const isExpanded = expandedEntry === a.id;
                const isUploading = fileUploading === a.id;
                const isEditing = editingId === a.id;
                return <div key={a.id}>{isEditing ? <div className="ledger-edit-row" style={{
                    display: "grid",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 0",
                    borderBottom: `1px solid ${T.border}`,
                    background: `${T.teal}0a`,
                    borderRadius: 8
                  }}><input type="date" value={editDraft.date || ""} onChange={e => setEditDraft(d => ({
                      ...d,
                      date: e.target.value
                    }))} style={{
                      ...ss,
                      fontSize: 12,
                      fontFamily: MONO,
                      colorScheme: "light"
                    }} /><select value={editDraft.cat} onChange={e => setEditDraft(d => ({
                      ...d,
                      cat: e.target.value
                    }))} style={{
                      ...ss,
                      fontSize: 12
                    }}>{actualCats.map(c => <option key={c} style={{
                        color: "#000"
                      }}>{c}</option>)}</select><input value={editDraft.label} onChange={e => setEditDraft(d => ({
                      ...d,
                      label: e.target.value
                    }))} onKeyDown={e => {
                      if (e.key === "Enter") saveEdit(a.id);
                      if (e.key === "Escape") cancelEdit();
                    }} style={{
                      ...ss,
                      fontSize: 13
                    }} autoFocus={true} /><input type="number" onFocus={e => e.target.select()} value={editDraft.amount || ""} onChange={e => setEditDraft(d => ({
                      ...d,
                      amount: parseFloat(e.target.value) || 0
                    }))} onKeyDown={e => {
                      if (e.key === "Enter") saveEdit(a.id);
                    }} style={{
                      ...ss,
                      fontFamily: MONO,
                      fontSize: 13
                    }} /><div style={{
                      display: "flex",
                      gap: 5
                    }}><button onClick={() => saveEdit(a.id)} style={{
                        ...bs(T.teal, "#06262a"),
                        fontSize: 11,
                        padding: "5px 10px"
                      }}>✓</button><button onClick={cancelEdit} style={{
                        ...bs(T.glass, T.txtDim),
                        fontSize: 11,
                        padding: "5px 10px"
                      }}>✕</button></div></div> : <div className="ledger-row" style={{
                    display: "grid",
                    gap: 6,
                    alignItems: "center",
                    padding: "7px 0",
                    borderBottom: isExpanded ? "none" : `1px solid ${T.border}`
                  }}><span style={{
                      fontSize: 11,
                      fontFamily: MONO,
                      color: T.txtMute,
                      whiteSpace: "nowrap"
                    }}>{a.date ? a.date.slice(5).replace("-", "/") : "—"}</span><span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.amber,
                      textTransform: "uppercase",
                      letterSpacing: ".03em"
                    }}>{a.cat}</span><span style={{
                      fontSize: 13,
                      color: T.txt
                    }}>{a.label || "—"}</span><span style={{
                      fontSize: 13.5,
                      fontFamily: MONO,
                      color: T.txt,
                      textAlign: "right"
                    }}>{fmt(parseFloat(a.amount) || 0)}</span><button onClick={() => startEdit(a)} title="Edit" style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: T.txtMute,
                      padding: "2px"
                    }}>✏️</button><button onClick={() => {
                      setExpandedEntry(isExpanded ? null : a.id);
                      setLinkInputFor(null);
                    }} title="Attachments" style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      padding: "2px",
                      color: fileCount > 0 ? T.teal : T.txtMute,
                      position: "relative"
                    }}>📎{fileCount > 0 && <span style={{
                        position: "absolute",
                        top: -3,
                        right: -3,
                        background: T.teal,
                        color: "#06262a",
                        borderRadius: "50%",
                        width: 13,
                        height: 13,
                        fontSize: 8,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>{fileCount}</span>}</button><button onClick={() => setActuals(p => p.filter(x => x.id !== a.id))} style={{
                      background: "transparent",
                      border: "none",
                      color: T.txtMute,
                      cursor: "pointer",
                      fontSize: 15
                    }}>×</button></div>}{isExpanded && !isEditing && <div style={{
                    background: `${T.teal}08`,
                    border: `1px solid ${T.teal}33`,
                    borderRadius: "0 0 10px 10px",
                    padding: "10px 12px",
                    marginBottom: 6
                  }}>{(a.files || []).length === 0 ? <div style={{
                      fontSize: 12,
                      color: T.txtMute,
                      marginBottom: 8
                    }}>No attachments yet.</div> : <div style={{
                      marginBottom: 8
                    }}>{(a.files || []).map((f, fi) => <div key={fi} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 0",
                        borderBottom: `1px solid ${T.border}`
                      }}><span style={{
                          fontSize: 12
                        }}>{f.type === "link" ? "🔗" : f.mimeType === "application/pdf" ? "📄" : "🖼"}</span><span style={{
                          flex: 1,
                          fontSize: 12,
                          color: T.txt,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>{f.name}</span>{f.size && <span style={{
                          fontSize: 10,
                          color: T.txtMute,
                          fontFamily: MONO
                        }}>{(f.size / 1024).toFixed(0)}KB</span>}<button onClick={() => openAttachment(f)} style={{
                          ...bs(`${T.teal}22`, T.tealLt),
                          fontSize: 11,
                          padding: "3px 8px"
                        }}>Open</button><button onClick={() => removeAttachment(a.id, f)} style={{
                          background: "transparent",
                          border: "none",
                          color: T.red,
                          cursor: "pointer",
                          fontSize: 13
                        }}>✕</button></div>)}</div>}{linkInputFor === a.id ? <div style={{
                      background: T.inputBg,
                      borderRadius: 9,
                      padding: "9px",
                      marginBottom: 8,
                      border: `1px solid ${T.border}`
                    }}><input placeholder="Google Drive / Docs URL" value={linkInputUrl} onChange={e => setLinkInputUrl(e.target.value)} style={{
                        ...ss,
                        marginBottom: 6,
                        fontSize: 12
                      }} /><div style={{
                        display: "flex",
                        gap: 6
                      }}><input placeholder="Label (optional)" value={linkInputName} onChange={e => setLinkInputName(e.target.value)} onKeyDown={e => {
                          if (e.key === "Enter") confirmLink(a.id);
                        }} style={{
                          ...ss,
                          flex: 1,
                          fontSize: 12
                        }} /><button onClick={() => confirmLink(a.id)} style={bs(T.teal, "#06262a")}>Add</button><button onClick={() => setLinkInputFor(null)} style={bs(T.glass, T.txtDim)}>✕</button></div></div> : null}<div style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap"
                    }}><button disabled={isUploading} onClick={() => {
                        pendingEntryId.current = a.id;
                        fileInputRef.current.click();
                      }} style={{
                        ...bs(isUploading ? T.glass : T.teal, isUploading ? T.txtMute : "#06262a"),
                        fontSize: 11,
                        padding: "6px 12px"
                      }}>{isUploading ? "⏳ Uploading…" : "⬆ Upload File"}</button><button onClick={() => {
                        setLinkInputFor(linkInputFor === a.id ? null : a.id);
                        setLinkInputUrl("");
                        setLinkInputName("");
                      }} style={{
                        ...bs(T.glass, T.txtDim),
                        fontSize: 11,
                        padding: "6px 12px"
                      }}>🔗 Add Google Link</button></div>{!accessToken && <div style={{
                      fontSize: 10,
                      color: T.amber,
                      marginTop: 6
                    }}>⚠ Connect Google Drive to upload files</div>}</div>}</div>;
              })}<div style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0 0",
                fontWeight: 800
              }}><span>TOTAL SPENT</span><span style={{
                  fontFamily: MONO,
                  color: T.amber,
                  fontSize: 16
                }}>{fmt(actualsTotal)}</span></div></div>}</Panel><div><Panel title={"Sale & Result"} accent={T.green}><label style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
                fontSize: 13,
                cursor: "pointer",
                color: T.txtDim
              }}><input type="checkbox" checked={acquired} onChange={e => setAcquired(e.target.checked)} />Property acquired</label><Field label="Final Sale Price" value={actualSale} onChange={setActualSale} prefix="$" step={1000} accent={T.green} /><div style={{
                background: T.inputBg,
                borderRadius: 12,
                padding: "12px 14px"
              }}><LR label="Sale price" value={fmt(actualSale)} accent={T.green} /><LR label="Total spent" value={fmt(actualsTotal)} neg={true} /><LR label="Actual profit" value={salePending ? "Pending sale" : fmt(actualProfit)} strong={true} accent={salePending ? T.txtDim : actualProfit > 0 ? T.green : T.red} /><LR label="vs. underwritten" value={salePending ? "Pending sale" : (variance >= 0 ? "+" : "") + fmt(variance)} accent={salePending ? T.txtDim : variance >= 0 ? T.green : T.red} /></div></Panel>{catTotals.length > 0 && <Panel title="Spend by Category" accent={T.amber}>{catTotals.map(c => <div key={c.cat} style={{
                marginBottom: 10
              }}><div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 3
                }}><span style={{
                    color: T.txtDim
                  }}>{c.cat}</span><span style={{
                    fontFamily: MONO,
                    color: T.txt
                  }}>{fmt(c.total)}</span></div><div style={{
                  height: 6,
                  background: T.inputBg,
                  borderRadius: 4,
                  overflow: "hidden"
                }}><div style={{
                    width: `${c.total / actualsTotal * 100}%`,
                    height: "100%",
                    background: T.amber,
                    borderRadius: 4
                  }} /></div></div>)}</Panel>}</div></div></React.Fragment>}<footer style={{
        textAlign: "center",
        fontSize: 11,
        color: T.txtMute,
        marginTop: 14,
        fontFamily: MONO
      }}>KAPPA REAL ESTATE INVESTMENTS · Deal Breaker</footer></div></div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);