// ============================================================================
// Utilities: find who serves a property (electric, gas, water, sewer, trash) and
// turn the answer into transfer tasks on the stage checklists.
//
// Sources, all free and keyless:
//  - US Census geocoder (JSONP; it does not allow CORS) → coordinates, city, county.
//    Fallback: OpenStreetMap Nominatim. Last resort: the city/state typed in the address.
//  - Public service-area maps (ArcGIS point queries): electric retail territories and natural
//    gas territories (former HIFLD Open layers), EPA public water system service areas,
//    and the City of Indianapolis solid waste collection areas.
//  - A small directory of verified providers (links, phones, notes) and Marion County city rules.
// Map answers are marked "service-area map" until someone confirms them.
// ============================================================================
const UTIL_TYPES = [
  ["electric", "Electric"],
  ["gas", "Gas"],
  ["water", "Water"],
  ["sewer", "Sewer"],
  ["trash", "Trash"],
];
const UTIL_LABEL = Object.fromEntries(UTIL_TYPES);
const UTILITY_DIR = [
  {
    id: "aes-indiana",
    name: "AES Indiana",
    types: ["electric"],
    state: "IN",
    match: /aes indiana|indianapolis power/i,
    start: "https://www.aesindiana.com/homes",
    stop: "https://www.aesindiana.com/homes",
    business: "https://www.aesindiana.com/businesses",
    phone: "317-261-8222",
    buy: "A business account may need a cash deposit unless credit is established.",
    sell: "Stop service effective on the sale closing date.",
  },
  {
    id: "citizens",
    name: "Citizens Energy Group",
    types: ["gas", "water", "sewer"],
    state: "IN",
    match: /citizens|indianapolis water/i,
    start: "https://www.citizensenergygroup.com/My-Account/Start-Stop-Transfer?Type=Start",
    stop: "https://www.citizensenergygroup.com/My-Account/Start-Stop-Transfer?Type=Stop",
    phone: "317-924-3311",
    buy: "One online form starts water, sewer and gas together. Start appointments run Monday to Saturday.",
    sell: "One online form stops all three. Stop appointments run Monday to Friday.",
  },
  {
    id: "indy-trash",
    name: "City of Indianapolis",
    types: ["trash"],
    state: "IN",
    match: /^$/,
    lookup: "https://www.indy.gov/workflow/trash-pickup",
    phone: "317-327-4622",
    noAccount: true,
    buy: "Nothing to open: city collection comes with the property.",
  },
];
// Cities and towns inside Marion County that run some utilities themselves.
const INDY_OWN_UTILITIES = {
  lawrence: { water: "Lawrence Utilities", sewer: "Lawrence Utilities" },
  speedway: { water: "Town of Speedway (water)" },
  "beech grove": { sewer: "City of Beech Grove", trash: "City of Beech Grove" },
};
const UTIL_LAYERS = {
  electric: [
    "https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/energy/FeatureServer/26",
    "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Retail_Service_Territories/FeatureServer/0",
  ],
  gas: ["https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/energy/FeatureServer/29"],
  water: ["https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Water_System_Boundaries/FeatureServer/0"],
  indyTrash: [
    "https://gis.indy.gov/server/rest/services/OpenData/OpenData_SolidWasteCollectionAreasFS/FeatureServer/0",
    "https://xmaps.indy.gov/arcgis/rest/services/OpenData/OpenData_SolidWasteCollectionAreasFS/MapServer/0",
  ],
};
const US_STATES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
const titleCase = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Llc|Inc|Co|Ii|Iii)\b/g, (m) => (m === "Co" ? "Co" : m.toUpperCase()))
    .replace(/\bOf\b/g, "of")
    .replace(/\bAnd\b/g, "and");
const HAULERS = { LRS: "LRS (Lakeshore Recycling Systems)", DPW: "Indy DPW", "INDY DPW": "Indy DPW", WM: "WM", REPUBLIC: "Republic Services" };
const haulerLabel = (h) => HAULERS[String(h || "").trim().toUpperCase()] || titleCase(h);
const searchLink = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const utilSlug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
// "…, Indianapolis, IN 46205" → { city: "Indianapolis", state: "IN" }
function parseCityState(address) {
  const parts = String(address || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const out = { city: "", state: "" };
  if (parts.length < 2) return out;
  const codes = Object.values(US_STATES);
  const last = parts[parts.length - 1];
  const prev = parts.length >= 3 ? parts[parts.length - 2] : "";
  let m = last.match(/^([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
  if (m && codes.includes(m[1].toUpperCase())) return { state: m[1].toUpperCase(), city: prev };
  m = last.match(/^(.*?)\s+([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
  if (m && codes.includes(m[2].toUpperCase())) return { state: m[2].toUpperCase(), city: m[1] };
  const full = last.replace(/\s+\d{5}(-\d{4})?$/, "").toLowerCase();
  if (US_STATES[full]) return { state: US_STATES[full], city: prev };
  return out;
}
// JSONP: the Census geocoder only answers browsers this way.
function utilJsonp(url, cbParam = "callback", timeout = 15000) {
  if (typeof window !== "undefined" && window.__jsonpMock) return window.__jsonpMock(url);
  return new Promise((resolve, reject) => {
    const name = "__dbcb" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    let timer;
    const done = (fn, v) => {
      clearTimeout(timer);
      try {
        delete window[name];
      } catch (e) {
        window[name] = undefined;
      }
      if (s.parentNode) s.parentNode.removeChild(s);
      fn(v);
    };
    window[name] = (data) => done(resolve, data);
    s.onerror = () => done(reject, new Error("JSONP load failed"));
    timer = setTimeout(() => done(reject, new Error("JSONP timeout")), timeout);
    s.src = url + (url.includes("?") ? "&" : "?") + cbParam + "=" + name;
    document.head.appendChild(s);
  });
}
async function utilGetJson(url, { jsonp, timeout = 12000 } = {}) {
  try {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
    const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
    if (t) clearTimeout(t);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    if (jsonp) return utilJsonp(url, jsonp, timeout);
    throw e;
  }
}
// Point-in-polygon against an ArcGIS layer. Returns attribute rows, [] if the point is outside
// every polygon, or null if no copy of the layer answered.
async function utilPointQuery(urls, lat, lon) {
  for (const base of urls) {
    const q = `${base}/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
    try {
      const j = await utilGetJson(q, { jsonp: "callback" });
      if (j && Array.isArray(j.features)) return j.features.map((f) => f.attributes || {});
    } catch (e) {
      /* try the next copy */
    }
  }
  return null;
}
const attr = (a, ...keys) => {
  for (const k of keys) {
    const hit = Object.keys(a || {}).find((x) => x.toLowerCase() === k.toLowerCase());
    if (hit && a[hit] != null && String(a[hit]).trim() && String(a[hit]).trim().toUpperCase() !== "NOT AVAILABLE") return String(a[hit]).trim();
  }
  return "";
};
async function utilGeocode(address, warn) {
  const q = encodeURIComponent(address);
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${q}&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=jsonp`;
    const j = await utilJsonp(url, "callback");
    const m = j && j.result && j.result.addressMatches && j.result.addressMatches[0];
    if (m && m.coordinates) {
      const g = m.geographies || {};
      const first = (re) => {
        const k = Object.keys(g).find((x) => re.test(x));
        return k && g[k] && g[k][0] ? g[k][0] : null;
      };
      const place = first(/^Incorporated Places/i) || first(/Consolidated Cities/i);
      const county = first(/^Counties/i);
      return {
        lat: m.coordinates.y,
        lon: m.coordinates.x,
        matched: m.matchedAddress || "",
        state: ((m.addressComponents && m.addressComponents.state) || "").toUpperCase(),
        city: titleCase((m.addressComponents && m.addressComponents.city) || ""),
        place: place ? place.NAME || place.BASENAME || "" : "",
        county: county ? county.NAME || county.BASENAME || "" : "",
        source: "US Census geocoder",
      };
    }
    warn.push("The Census geocoder didn't recognize the address.");
  } catch (e) {
    warn.push("The Census geocoder didn't answer.");
  }
  try {
    const j = await utilGetJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=1&q=${q}`);
    const r = Array.isArray(j) && j[0];
    if (r) {
      const a = r.address || {};
      const iso = a["ISO3166-2-lvl4"] || "";
      return {
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        matched: r.display_name || "",
        state: iso.startsWith("US-") ? iso.slice(3) : US_STATES[(a.state || "").toLowerCase()] || "",
        city: a.city || a.town || a.village || "",
        place: a.city || a.town || a.village || "",
        county: a.county || "",
        source: "OpenStreetMap",
      };
    }
  } catch (e) {
    /* fall through */
  }
  warn.push("Couldn't place the address on a map; providers below come from the city in the address.");
  return null;
}
const dirFor = (type, name, state) => UTILITY_DIR.find((d) => d.types.includes(type) && (!d.state || !state || d.state === state) && d.match.test(name || ""));
function makeUtilItem(type, name, source, extra) {
  const d = name ? dirFor(type, name, extra && extra.state) : null;
  return {
    type,
    id: d ? d.id : name ? "x-" + utilSlug(name) : "",
    name: d ? d.name : name ? titleCase(name) : "",
    source, // "map" | "city" | "manual"
    confirmed: false,
    account: "",
    phone: (d && d.phone) || (extra && extra.phone) || "",
    website: (extra && extra.website) || "",
    alt: (extra && extra.alt) || [],
    note: (extra && extra.note) || "",
  };
}
async function findUtilities(address) {
  const warn = [];
  const geo = await utilGeocode(address, warn);
  const typed = parseCityState(address);
  const state = (geo && geo.state) || typed.state;
  const placeName = ((geo && geo.place) || (geo && geo.city) || typed.city || "")
    .replace(/\s+(city|town|village)(\s*\(balance\))?$/i, "")
    .replace(/\s*\(balance\)$/i, "")
    .trim();
  const placeKey = placeName.toLowerCase();
  const inMarion = /marion/i.test((geo && geo.county) || "") || placeKey === "indianapolis";
  const own = state === "IN" && inMarion ? INDY_OWN_UTILITIES[placeKey] || null : null;
  const indy = state === "IN" && inMarion;
  const indyCity = indy && (placeKey === "indianapolis" || (!own && placeKey === ""));
  const ll = geo && isFinite(geo.lat) && isFinite(geo.lon);
  const [el, gas, water, trash] = ll
    ? await Promise.all([
        utilPointQuery(UTIL_LAYERS.electric, geo.lat, geo.lon),
        utilPointQuery(UTIL_LAYERS.gas, geo.lat, geo.lon),
        utilPointQuery(UTIL_LAYERS.water, geo.lat, geo.lon),
        indyCity ? utilPointQuery(UTIL_LAYERS.indyTrash, geo.lat, geo.lon) : Promise.resolve(null),
      ])
    : [null, null, null, null];
  const items = [];
  const fromMap = (type, rows, nameKeys, weightKeys) => {
    if (!rows || !rows.length) return null;
    const sorted = [...rows].sort((a, b) => (parseFloat(attr(b, ...weightKeys)) || 0) - (parseFloat(attr(a, ...weightKeys)) || 0));
    const names = [...new Set(sorted.map((r) => attr(r, ...nameKeys)).filter(Boolean))];
    if (!names.length) return null;
    const top = sorted.find((r) => attr(r, ...nameKeys) === names[0]);
    return makeUtilItem(type, names[0], "map", {
      state,
      phone: attr(top, "telephone"),
      website: attr(top, "website"),
      alt: names.slice(1, 3).map(titleCase),
    });
  };
  // electric
  let e = fromMap("electric", el, ["name"], ["customers", "total_mwh"]);
  if (!e && indy && !own) e = makeUtilItem("electric", "AES Indiana", "city", { state, note: "AES Indiana serves most of Marion County; check near the county line." });
  if (el === null && ll) warn.push("The electric service-area map didn't answer.");
  items.push(e || makeUtilItem("electric", "", "map"));
  // gas
  let g = fromMap("gas", gas, ["name"], ["total_cust", "res_cust"]);
  if (!g && indy) g = makeUtilItem("gas", "Citizens Energy Group", "city", { state });
  if (gas === null && ll) warn.push("The natural gas service-area map didn't answer.");
  items.push(g || makeUtilItem("gas", "", "map"));
  // water
  let w = own && own.water ? makeUtilItem("water", own.water, "city", { state }) : fromMap("water", water, ["PWS_Name"], ["Population_Served_Count"]);
  if (!w && indy && !own) w = makeUtilItem("water", "Citizens Energy Group", "city", { state });
  if (water === null && ll) warn.push("The EPA water service-area map didn't answer.");
  items.push(w || makeUtilItem("water", "", "map"));
  // sewer: no national map — city rules, otherwise follow the water utility when it also runs sewer
  let sw = null;
  if (own && own.sewer) sw = makeUtilItem("sewer", own.sewer, "city", { state });
  else if (indy) sw = makeUtilItem("sewer", "Citizens Energy Group", "city", { state });
  else if (w && w.id && (UTILITY_DIR.find((d) => d.id === w.id) || { types: [] }).types.includes("sewer")) sw = makeUtilItem("sewer", w.name, "city", { state });
  items.push(sw || { ...makeUtilItem("sewer", "", "city"), note: "Sewer is billed by the city or the water utility. A recent bill from the seller shows which." });
  // trash
  let tr = null;
  if (own && own.trash) tr = makeUtilItem("trash", own.trash, "city", { state });
  else if (indyCity) {
    const row = trash && trash[0];
    const hauler = row ? attr(row, "HAULER") : "";
    const district = row ? attr(row, "DISTRICT") : "";
    const day = row ? attr(row, "DAY_", "DAY", "TRASH") : "";
    tr = {
      ...makeUtilItem("trash", "", "city"),
      id: "indy-trash",
      name: "City of Indianapolis",
      phone: "317-327-4622",
      source: row ? "map" : "city",
      note: row ? [hauler && `collected by ${haulerLabel(hauler)}`, district && `district ${district}`, day && `pickup on ${titleCase(day)}`].filter(Boolean).join(", ") : "",
    };
    if (indyCity && trash === null && ll) warn.push("The Indianapolis trash map didn't answer; use the city's lookup.");
  }
  items.push(tr || { ...makeUtilItem("trash", "", "city"), note: "Trash is usually a city service or a private hauler. Ask the city or the seller." });
  return {
    at: new Date().toISOString(),
    address,
    matched: geo ? geo.matched : "",
    place: placeName,
    county: geo ? geo.county : "",
    state,
    geocoder: geo ? geo.source : "",
    items,
    warn,
  };
}
// ---------- tasks ----------
const utilGroups = (u) => {
  const groups = [];
  (u.items || []).forEach((it) => {
    if (!it.name) return;
    const key = it.id || "x-" + utilSlug(it.name);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, it, dir: UTILITY_DIR.find((d) => d.id === it.id) || null, types: [] };
      groups.push(g);
    }
    g.types.push(it.type);
  });
  return groups;
};
const joinTypes = (types) => {
  const order = ["water", "sewer", "gas", "electric", "trash"];
  const t = [...types].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((x) => UTIL_LABEL[x].toLowerCase());
  return t.length <= 1 ? t[0] || "" : t.slice(0, -1).join(", ") + " and " + t[t.length - 1];
};
function utilityTasks(u) {
  const buy = [
    {
      ut: "verify:buy",
      label: "Confirm the utility providers and final meter readings with the seller or title",
      note: "The seller's latest bill for each service shows the provider and account for this address.",
    },
  ];
  const sell = [];
  utilGroups(u).forEach(({ key, it, dir, types }) => {
    const what = joinTypes(types);
    const phone = it.phone ? ` Phone ${it.phone}.` : "";
    if ((dir && dir.noAccount) || types.every((t) => t === "trash")) {
      buy.push({
        ut: `${key}:buy`,
        label: `${it.name}: confirm trash pickup${it.note ? ` (${it.note})` : ""}`,
        url: (dir && dir.lookup) || it.website || searchLink(`${it.name} trash pickup ${u.place || ""}`),
        note: ((dir && dir.buy) || "Confirm the hauler and pickup day.") + phone,
      });
      return;
    }
    buy.push({
      ut: `${key}:buy`,
      label: `${it.name}: start ${what} in the LLC's name from the closing date`,
      url: (dir && dir.start) || it.website || searchLink(`${it.name} start service`),
      note: ((dir && dir.buy) || "Ask for service to start on the closing date.") + phone,
    });
    sell.push({
      ut: `${key}:sell`,
      label: `${it.name}: stop ${what} on the sale closing date`,
      url: (dir && dir.stop) || it.website || searchLink(`${it.name} stop service`),
      note: ((dir && dir.sell) || "Ask for a final meter reading on the closing date.") + phone,
    });
  });
  return { buy, sell };
}
// Adds the tasks that aren't there yet; replaces open utility tasks that no longer match.
function applyUtilityTasks(mg, u) {
  const { buy, sell } = utilityTasks(u);
  const merge = (list, add) => {
    const keep = (list || []).filter((i) => !i.ut || i.done || add.some((a) => a.ut === i.ut));
    const fresh = add.filter((a) => !keep.some((i) => i.ut === a.ut)).map((a) => ({ id: uid(), done: false, ...a }));
    return { list: [...keep, ...fresh], added: fresh.length };
  };
  const c = merge(mg.checklists.contract, buy);
  const mk = merge(mg.checklists.market, sell);
  // the generic rehab item is replaced by the provider-specific tasks
  const rehab = (mg.checklists.rehab || []).filter((i) => !(i.label === "Utilities transferred" && !i.done && !i.custom));
  return {
    mgmt: { ...mg, utilities: u, checklists: { ...mg.checklists, contract: c.list, market: mk.list, rehab } },
    added: { contract: c.added, market: mk.added },
  };
}
const utilStatus = (mg, key) => {
  const find = (list, ut) => (list || []).find((i) => i.ut === ut);
  const b = find(mg.checklists.contract, `${key}:buy`);
  const s = find(mg.checklists.market, `${key}:sell`);
  if (s && s.done) return { label: "Stopped", tone: "done" };
  if (b && b.done) return { label: "Set up", tone: "done" };
  if (b) return { label: "To do", tone: "todo" };
  return { label: "No task", tone: "none" };
};
// ---------- card ----------
function UtilitiesCard({ address, stage, mgmt, setMgmt }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState(null);
  const u = mgmt.utilities;
  const mgmtRef = useRef(mgmt);
  mgmtRef.current = mgmt;
  const run = async () => {
    if (!address.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await findUtilities(address.trim());
      const { added } = applyUtilityTasks(mgmtRef.current, res);
      setMgmt((mg) => applyUtilityTasks(mg, res).mgmt);
      setMsg(
        added.contract || added.market
          ? `Added ${added.contract} task${added.contract === 1 ? "" : "s"} to Under contract and ${added.market} to On market.`
          : "The checklists already have these tasks.",
      );
    } catch (e) {
      setMsg("Couldn't look up utilities: " + e.message);
    }
    setBusy(false);
  };
  const updItem = (type, patch, retask) =>
    setMgmt((mg) => {
      const items = mg.utilities.items.map((x) => (x.type === type ? { ...x, ...patch } : x));
      const nu = { ...mg.utilities, items };
      return retask ? applyUtilityTasks(mg, nu).mgmt : { ...mg, utilities: nu };
    });
  const stale = u && u.address && address.trim() && u.address.trim().toLowerCase() !== address.trim().toLowerCase();
  const groupsByType = {};
  if (u) utilGroups(u).forEach((g) => g.types.forEach((t) => (groupsByType[t] = g)));
  return (
    <section className="dcard util">
      <div className="dcard-h">
        <Icon name="plug" /> Utilities
        {u && !busy && (
          <button className="dcard-link" onClick={run} title="Look the address up again and refresh the open tasks">
            <Icon name="refresh" size={14} /> Check again
          </button>
        )}
      </div>
      {!u ? (
        <div className="util-empty">
          <p>Find the electric, gas, water, sewer and trash providers for this address, then add the transfer tasks to the stage checklists.</p>
          <button onClick={run} disabled={busy || !address.trim()} style={btnPrimary()}>
            {busy ? "Looking up…" : "Find utilities"}
          </button>
          {!address.trim() && <span className="util-hint">Add the property address first.</span>}
        </div>
      ) : (
        <React.Fragment>
          {stale && (
            <div className="util-warn">
              The address changed since the last lookup.{" "}
              <button className="link-btn" onClick={run}>
                Check again
              </button>
            </div>
          )}
          <div className="dt-wrap flush">
            <table className="dt util-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Provider</th>
                  <th>Start or stop</th>
                  <th>Task</th>
                  <th>Account #</th>
                </tr>
              </thead>
              <tbody>
                {u.items.map((it) => {
                  const g = groupsByType[it.type];
                  const dir = g && g.dir;
                  const st = g ? utilStatus(mgmt, g.key) : null;
                  const isEdit = edit && edit.type === it.type;
                  return (
                    <tr key={it.type}>
                      <td className="util-type">{UTIL_LABEL[it.type]}</td>
                      <td>
                        {isEdit ? (
                          <div className="util-edit">
                            <input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Provider name" aria-label={`${UTIL_LABEL[it.type]} provider`} />
                            <input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="Phone" aria-label="Phone" />
                            <button
                              onClick={() => {
                                const nm = edit.name.trim();
                                const d = nm ? dirFor(it.type, nm, u.state) : null;
                                updItem(
                                  it.type,
                                  { name: d ? d.name : nm, id: d ? d.id : nm ? "x-" + utilSlug(nm) : "", phone: edit.phone.trim() || (d && d.phone) || "", source: "manual", confirmed: !!nm, alt: [] },
                                  true,
                                );
                                setEdit(null);
                              }}
                              style={btnPrimary()}
                            >
                              Save
                            </button>
                            <button onClick={() => setEdit(null)} style={btnGhost()}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="util-prov">
                            <b>{it.name || <span className="dt-mute">Not found</span>}</b>
                            <span>
                              {it.confirmed ? (
                                <em className="util-ok">Confirmed</em>
                              ) : it.name ? (
                                <em className="util-src">{it.source === "map" ? "Service-area map" : it.source === "manual" ? "Entered by hand" : "City default"}, verify</em>
                              ) : null}
                              {it.alt && it.alt.length > 0 && <> Also possible: {it.alt.join(", ")}.</>}
                              {it.note && <> {it.note.charAt(0).toUpperCase() + it.note.slice(1)}.</>}
                            </span>
                            <span className="util-actions">
                              {it.name && !it.confirmed && (
                                <button className="link-btn" onClick={() => updItem(it.type, { confirmed: true })}>
                                  Mark confirmed
                                </button>
                              )}
                              <button className="link-btn" onClick={() => setEdit({ type: it.type, name: it.name || "", phone: it.phone || "" })}>
                                {it.name ? "Change" : "Add provider"}
                              </button>
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        {it.name ? (
                          <div className="util-links">
                            {dir && dir.noAccount ? (
                              <a href={dir.lookup} target="_blank" rel="noopener noreferrer">
                                Pickup lookup <Icon name="link" size={12} />
                              </a>
                            ) : (
                              <a href={(dir && dir.start) || it.website || searchLink(`${it.name} start service`)} target="_blank" rel="noopener noreferrer">
                                {dir ? "Start or transfer" : it.website ? "Website" : "Search"} <Icon name="link" size={12} />
                              </a>
                            )}
                            {dir && dir.business && (
                              <a href={dir.business} target="_blank" rel="noopener noreferrer">
                                Business accounts <Icon name="link" size={12} />
                              </a>
                            )}
                            {it.phone && <span>{it.phone}</span>}
                          </div>
                        ) : (
                          <span className="dt-mute">—</span>
                        )}
                      </td>
                      <td>{st ? <span className={"util-st " + st.tone}>{st.label}</span> : <span className="dt-mute">—</span>}</td>
                      <td>
                        {it.name && !(dir && dir.noAccount) ? (
                          <input className="util-acct" value={it.account || ""} onChange={(e) => updItem(it.type, { account: e.target.value })} placeholder="—" aria-label={`${UTIL_LABEL[it.type]} account number`} />
                        ) : (
                          <span className="dt-mute">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="util-foot">
            <span>
              {u.matched ? `Matched ${u.matched}` : `Address ${u.address}`}
              {u.place ? `, ${u.place}` : ""}
              {u.county ? `, ${u.county}` : ""}. Looked up {fmtDateShort(isoOf(new Date(u.at)))}.
              {u.warn && u.warn.length ? ` ${u.warn.join(" ")}` : ""}
            </span>
            <span className="util-msg">{msg || "Tasks are on the Under contract and On market checklists."}</span>
          </div>
        </React.Fragment>
      )}
      {busy && u && <div className="util-busy">Looking up {address.trim()}…</div>}
    </section>
  );
}
