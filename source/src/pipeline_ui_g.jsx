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
//  - A small directory of verified providers (links, phones, notes) and local rules for
//    Marion County (Indianapolis) and Cuyahoga County (Cleveland and its suburbs).
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
    links: [{ label: "Business accounts", url: "https://www.aesindiana.com/businesses" }],
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
  // ---- Ohio (Cleveland / Northeast Ohio) ----
  // FirstEnergy's Ohio companies share one start / stop / move form.
  {
    id: "illuminating",
    name: "The Illuminating Company (FirstEnergy)",
    types: ["electric"],
    state: "OH",
    match: /illuminating|cleveland electric illum/i,
    start: "https://www.firstenergycorp.com/service_requests/moving_customer_survey.html",
    stop: "https://www.firstenergycorp.com/service_requests/moving_customer_survey.html",
    links: [{ label: "Service area", url: "https://www.firstenergycorp.com/help/making_service_requests/our_service_area.html" }],
    phone: "800-589-3101",
    buy: "Start, stop and move are one online form. Have the LLC's taxpayer ID and the start date ready, and allow two business days.",
    sell: "Ask at least one business day ahead; stops happen on business days only.",
  },
  {
    id: "ohio-edison",
    name: "Ohio Edison (FirstEnergy)",
    types: ["electric"],
    state: "OH",
    match: /ohio edison/i,
    start: "https://www.firstenergycorp.com/service_requests/moving_customer_survey.html",
    stop: "https://www.firstenergycorp.com/service_requests/moving_customer_survey.html",
    links: [{ label: "Service area", url: "https://www.firstenergycorp.com/help/making_service_requests/our_service_area.html" }],
    phone: "800-633-4766",
    buy: "Start, stop and move are one online form. Have the LLC's taxpayer ID and the start date ready, and allow two business days.",
    sell: "Ask at least one business day ahead; stops happen on business days only.",
  },
  {
    id: "cpp",
    name: "Cleveland Public Power",
    types: ["electric"],
    state: "OH",
    match: /cleveland public power|city of cleveland|cleveland,? city\b/i,
    start: "https://www.cpp.org/Residential/Start-Service",
    stop: "https://www.cpp.org/Residential/Stop-Service",
    links: [
      { label: "Transfer", url: "https://www.cpp.org/Residential/Transfer-Service" },
      { label: "Business accounts", url: "https://www.cpp.org/Business" },
    ],
    phone: "216-664-4600",
    buy: "The city's own electric utility. Start, transfer and stop are online forms on cpp.org.",
    sell: "Use the stop service form for the sale closing date.",
  },
  {
    id: "enbridge-ohio",
    name: "Enbridge Gas Ohio",
    types: ["gas"],
    state: "OH",
    match: /enbridge|east ohio gas|dominion/i,
    start: "https://www.enbridgegas.com/ohio/start-stop-service/start-service",
    stop: "https://www.enbridgegas.com/ohio/start-stop-service/stop-service",
    links: [{ label: "Landlords", url: "https://www.enbridgegas.com/ohio/start-stop-service/property-managers-and-landlords" }],
    phone: "800-362-7557",
    buy: "Formerly Dominion Energy Ohio. New customers register online; a deposit may be required based on credit.",
    sell: "Stop service effective on the sale closing date.",
  },
  {
    id: "columbia-gas-oh",
    name: "Columbia Gas of Ohio",
    types: ["gas"],
    state: "OH",
    match: /columbia gas/i,
    start: "https://www.columbiagasohio.com/services/start-stop-or-move-service",
    stop: "https://www.columbiagasohio.com/services/start-stop-or-move-service",
    phone: "800-344-4077",
    buy: "Start, stop and move are one online form, open around the clock.",
    sell: "Stop service effective on the sale closing date.",
  },
  {
    id: "cleveland-water",
    name: "Cleveland Water",
    types: ["water"],
    state: "OH",
    match: /cleveland/i,
    start: "https://www.clevelandwater.com/customer-service/faqs",
    stop: "https://www.clevelandwater.com/customer-service/faqs",
    startLabel: "Buying or selling",
    links: [{ label: "Account services", url: "https://www.clevelandwater.com/customer-service/account-services" }],
    phone: "216-664-3130",
    after: true,
    buyLabel: "open the {what} account in the LLC's name after the deed records",
    sellLabel: "close the {what} account after the buyer's deed records",
    buy: "Call once the deed is recorded. The LLC is responsible from the title transfer date, not for the seller's balance.",
    sell: "Call once the buyer's deed is recorded; the final bill runs to the transfer date.",
  },
  {
    id: "neorsd",
    name: "NEORSD (Sewer District)",
    types: ["sewer"],
    state: "OH",
    match: /neorsd|northeast ohio regional sewer/i,
    start: "https://www.neorsd.org/",
    stop: "https://www.neorsd.org/",
    startLabel: "Website",
    phone: "216-881-8247",
    after: true,
    buyLabel: "check the sewer account moved to the LLC with the water account",
    sellLabel: "check the final sewer bill closes with the water account",
    buy: "The Sewer District sends its own bill, and Cleveland Water handles that billing for its customers, so the account follows the water transfer.",
    sell: "The final sewer bill follows the water account's final reading.",
  },
  {
    id: "cleveland-waste",
    name: "City of Cleveland (Waste Collection)",
    types: ["trash"],
    state: "OH",
    match: /^$/,
    lookup: "https://www.clevelandohio.gov/city-hall/departments/public-works/divisions/waste-collection-recycling",
    links: [{ label: "Waste fee", url: "https://clevelandohio.gov/city-hall/departments/finance/divisions/assessments-licenses/waste-collection-fee" }],
    phone: "216-664-2000",
    noAccount: true,
    buy: "City collection comes with the property; the owner is billed a monthly waste collection fee per unit. City call center: 311.",
    extra: [
      {
        key: "fee",
        stage: "after",
        label: "City of Cleveland: file the waste collection fee exemption while the house is vacant",
        url: "https://clevelandohio.gov/city-hall/departments/finance/divisions/assessments-licenses/waste-collection-fee",
        note: "Owners can apply for vacancy or a change of ownership. File as soon as the first bill arrives; the form has a short deadline.",
      },
    ],
  },
  {
    id: "lakewood-utilities",
    name: "City of Lakewood (Utility Billing)",
    types: ["water", "sewer"],
    state: "OH",
    match: /lakewood/i,
    start: "https://lakewoodoh.gov/payment-taxes/pay-your-water-bill",
    stop: "https://lakewoodoh.gov/payment-taxes/pay-your-water-bill",
    startLabel: "Utility billing",
    phone: "216-529-6820",
    buy: "Call option 2 as soon as possible with the title transfer date, the title company and the new owner's name.",
    sell: "Call option 2 with the title transfer date, the title company and the buyer's name.",
  },
];
// Cities and towns inside Marion County that run some utilities themselves.
const INDY_OWN_UTILITIES = {
  lawrence: { water: "Lawrence Utilities", sewer: "Lawrence Utilities" },
  speedway: { water: "Town of Speedway (water)" },
  "beech grove": { sewer: "City of Beech Grove", trash: "City of Beech Grove" },
};
// Cuyahoga County municipalities, used when the geocoder can't name the county.
const CUYAHOGA_PLACES = new Set([
  "cleveland", "lakewood", "parma", "parma heights", "euclid", "cleveland heights", "east cleveland", "garfield heights", "maple heights",
  "shaker heights", "south euclid", "university heights", "warrensville heights", "bedford", "bedford heights", "brook park", "brooklyn",
  "brooklyn heights", "north olmsted", "north royalton", "strongsville", "westlake", "rocky river", "fairview park", "berea",
  "middleburg heights", "seven hills", "broadview heights", "mayfield heights", "lyndhurst", "richmond heights", "beachwood",
  "cuyahoga heights", "newburgh heights", "linndale", "bratenahl", "olmsted falls", "bay village", "brecksville", "highland heights",
  "pepper pike", "woodmere", "north randall", "highland hills", "valley view", "walton hills",
]);
// City-specific rules inside Cuyahoga County. Each type: dir (directory id) or name; own: overrides the map;
// note/alt: shown with the provider; hint: note/alt shown whatever the map says.
const CUYAHOGA_RULES = {
  cleveland: {
    electric: {
      dir: "illuminating",
      hint: {
        alt: ["The Illuminating Company (FirstEnergy)", "Cleveland Public Power"],
        note: "Each serves part of the city; the seller's bill or the meter shows which",
      },
    },
    water: { dir: "cleveland-water", own: true },
    sewer: { dir: "neorsd", own: true, note: "Separate bill from the water bill" },
    trash: { dir: "cleveland-waste", own: true },
  },
  lakewood: {
    water: { dir: "lakewood-utilities", own: true },
    sewer: { dir: "lakewood-utilities", own: true },
  },
  euclid: {
    sewer: { dir: "cleveland-water", own: true, note: "Euclid's sewer charge is on the Cleveland Water bill, so there's no separate account" },
  },
  "cleveland heights": {
    sewer: { dir: "neorsd", own: true, note: "Cleveland Heights also bills a local sewer charge itself" },
  },
};
// What the national maps can't tell (sewer, trash, city-run utilities) and the default provider
// when a map doesn't answer.
function localRules(state, county, placeKey, placeName) {
  if (state === "IN" && (/marion/i.test(county || "") || placeKey === "indianapolis")) {
    const own = INDY_OWN_UTILITIES[placeKey] || null;
    const r = { area: "indy" };
    if (!own) r.electric = { dir: "aes-indiana", note: "AES Indiana serves most of Marion County; check near the county line" };
    r.gas = { dir: "citizens" };
    if (own && own.water) r.water = { name: own.water, own: true };
    else if (!own) r.water = { dir: "citizens" };
    r.sewer = own && own.sewer ? { name: own.sewer, own: true } : { dir: "citizens", own: true };
    if (own && own.trash) r.trash = { name: own.trash, own: true };
    else if (placeKey === "indianapolis" || (!own && placeKey === "")) r.trash = { indyLayer: true };
    return r;
  }
  const inCuyahoga = county ? /cuyahoga/i.test(county) : CUYAHOGA_PLACES.has(placeKey);
  if (state === "OH" && inCuyahoga) {
    const r = {
      area: "cuyahoga",
      electric: { dir: "illuminating" },
      gas: { dir: "enbridge-ohio", alt: ["Columbia Gas of Ohio"], note: "Columbia Gas of Ohio serves some western and southern suburbs" },
      water: { dir: "cleveland-water" },
      sewer: {
        dir: "neorsd",
        note: "Most of Cuyahoga County is in the Sewer District; some cities also bill a local sewer charge or run their own. The seller's last bill shows which",
      },
      trash: placeName
        ? { name: `City of ${placeName}`, note: "Most suburbs collect trash as a city service or through a city contract. Confirm the pickup day with the city" }
        : {},
    };
    return { ...r, ...(CUYAHOGA_RULES[placeKey] || {}) };
  }
  return null;
}
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
const dirById = (id) => UTILITY_DIR.find((d) => d.id === id) || null;
// "CLEVELAND ELECTRIC ILLUM CO" → "The Illuminating Company (FirstEnergy)"
const dirName = (type, name, state) => {
  const d = name ? dirFor(type, name, state) : null;
  return d ? d.name : titleCase(name);
};
function ruleItem(type, rule, state) {
  if (!rule || (!rule.dir && !rule.name)) return null;
  const d = rule.dir ? dirById(rule.dir) : null;
  const base = d ? { ...makeUtilItem(type, "", "city"), id: d.id, name: d.name, phone: d.phone || "" } : makeUtilItem(type, rule.name, "city", { state });
  return { ...base, note: rule.note || "", alt: rule.alt || [] };
}
// Map answer vs local rule: a rule marked `own` wins (keeping "map" as the source when they agree);
// otherwise the map wins and the rule is the fallback. `hint` adds alternatives and a note either way.
function resolveUtil(type, mapItem, rule, state) {
  let it;
  if (rule && rule.own) {
    const r = ruleItem(type, rule, state);
    it = mapItem && r && mapItem.id === r.id ? { ...mapItem, note: r.note, alt: r.alt.length ? r.alt : mapItem.alt } : r;
  } else it = mapItem || ruleItem(type, rule, state);
  if (it && rule && rule.hint) {
    const alt = [...new Set([...(it.alt || []), ...(rule.hint.alt || [])])].filter((n) => n && n !== it.name);
    it = { ...it, alt: alt.slice(0, 3), note: [it.note, rule.hint.note].filter(Boolean).join(". ") };
  }
  return it;
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
  const rules = localRules(state, (geo && geo.county) || "", placeKey, placeName) || {};
  const ll = geo && isFinite(geo.lat) && isFinite(geo.lon);
  const [el, gas, water, trash] = ll
    ? await Promise.all([
        utilPointQuery(UTIL_LAYERS.electric, geo.lat, geo.lon),
        utilPointQuery(UTIL_LAYERS.gas, geo.lat, geo.lon),
        utilPointQuery(UTIL_LAYERS.water, geo.lat, geo.lon),
        rules.trash && rules.trash.indyLayer ? utilPointQuery(UTIL_LAYERS.indyTrash, geo.lat, geo.lon) : Promise.resolve(null),
      ])
    : [null, null, null, null];
  const items = [];
  const fromMap = (type, rows, nameKeys, weightKeys) => {
    if (!rows || !rows.length) return null;
    const sorted = [...rows].sort((a, b) => (parseFloat(attr(b, ...weightKeys)) || 0) - (parseFloat(attr(a, ...weightKeys)) || 0));
    const names = [...new Set(sorted.map((r) => attr(r, ...nameKeys)).filter(Boolean))];
    if (!names.length) return null;
    const top = sorted.find((r) => attr(r, ...nameKeys) === names[0]);
    const it = makeUtilItem(type, names[0], "map", {
      state,
      phone: attr(top, "telephone"),
      website: attr(top, "website"),
    });
    it.alt = [...new Set(names.slice(1).map((n) => dirName(type, n, state)))].filter((n) => n !== it.name).slice(0, 2);
    return it;
  };
  const empty = (type, note) => ({ ...makeUtilItem(type, "", "city"), note: note || "" });
  // electric
  items.push(resolveUtil("electric", fromMap("electric", el, ["name"], ["customers", "total_mwh"]), rules.electric, state) || makeUtilItem("electric", "", "map"));
  if (el === null && ll) warn.push("The electric service-area map didn't answer.");
  // gas
  items.push(resolveUtil("gas", fromMap("gas", gas, ["name"], ["total_cust", "res_cust"]), rules.gas, state) || makeUtilItem("gas", "", "map"));
  if (gas === null && ll) warn.push("The natural gas service-area map didn't answer.");
  // water
  const w = resolveUtil("water", fromMap("water", water, ["PWS_Name"], ["Population_Served_Count"]), rules.water, state);
  items.push(w || makeUtilItem("water", "", "map"));
  if (water === null && ll) warn.push("The EPA water service-area map didn't answer.");
  // sewer: no national map — local rules, otherwise the water utility when it also runs sewer
  let sw = resolveUtil("sewer", null, rules.sewer, state);
  if (!sw && w && w.id && (dirById(w.id) || { types: [] }).types.includes("sewer")) sw = makeUtilItem("sewer", w.name, "city", { state });
  items.push(sw || empty("sewer", "Sewer is billed by the city or the water utility. A recent bill from the seller shows which"));
  // trash
  let tr = null;
  if (rules.trash && rules.trash.indyLayer) {
    const row = trash && trash[0];
    const hauler = row ? attr(row, "HAULER") : "";
    const district = row ? attr(row, "DISTRICT") : "";
    const day = row ? attr(row, "DAY_", "DAY", "TRASH") : "";
    const facts = row ? [hauler && `collected by ${haulerLabel(hauler)}`, district && `district ${district}`, day && `pickup on ${titleCase(day)}`].filter(Boolean).join(", ") : "";
    tr = { ...ruleItem("trash", { dir: "indy-trash" }, state), source: row ? "map" : "city", note: facts, detail: facts };
    if (trash === null && ll) warn.push("The Indianapolis trash map didn't answer; use the city's lookup.");
  } else tr = resolveUtil("trash", null, rules.trash, state);
  items.push(tr || empty("trash", "Trash is usually a city service or a private hauler. Ask the city or the seller"));
  return {
    at: new Date().toISOString(),
    address,
    matched: geo ? geo.matched : "",
    place: placeName,
    county: geo ? geo.county : "",
    state,
    area: rules.area || "",
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
// Three task lists: before closing (Under contract), after closing (Rehab) and for the sale (On market).
function utilityTasks(u) {
  const buy = [
    {
      ut: "verify:buy",
      label: "Confirm the utility providers and final meter readings with the seller or title",
      note: "The seller's latest bill for each service shows the provider and account for this address.",
    },
  ];
  const after = [];
  const sell = [];
  utilGroups(u).forEach(({ key, it, dir, types }) => {
    const what = joinTypes(types);
    const phone = it.phone ? ` Phone ${it.phone}.` : "";
    const fill = (tpl) => tpl.replace("{what}", what);
    if ((dir && dir.noAccount) || types.every((t) => t === "trash")) {
      buy.push({
        ut: `${key}:buy`,
        label: `${it.name}: confirm trash pickup${it.detail ? ` (${it.detail})` : ""}`,
        url: (dir && dir.lookup) || it.website || searchLink(`${it.name} trash pickup ${u.place || ""}`),
        note: ((dir && dir.buy) || (it.note ? sentence(it.note) : "Confirm the hauler and pickup day.")) + phone,
      });
    } else {
      (dir && dir.after ? after : buy).push({
        ut: `${key}:buy`,
        label: `${it.name}: ${dir && dir.buyLabel ? fill(dir.buyLabel) : `start ${what} in the LLC's name from the closing date`}`,
        url: (dir && dir.start) || it.website || searchLink(`${it.name} start service`),
        note: ((dir && dir.buy) || "Ask for service to start on the closing date.") + phone,
      });
      sell.push({
        ut: `${key}:sell`,
        label: `${it.name}: ${dir && dir.sellLabel ? fill(dir.sellLabel) : `stop ${what} on the sale closing date`}`,
        url: (dir && dir.stop) || it.website || searchLink(`${it.name} stop service`),
        note: ((dir && dir.sell) || "Ask for a final meter reading on the closing date.") + phone,
      });
    }
    ((dir && dir.extra) || []).forEach((x) => {
      const t = { ut: `${key}:${x.key}`, label: x.label, url: x.url, note: x.note };
      (x.stage === "after" ? after : x.stage === "sell" ? sell : buy).push(t);
    });
  });
  return { buy, after, sell };
}
// Adds the tasks that aren't there yet; replaces open utility tasks that no longer match.
function applyUtilityTasks(mg, u) {
  const { buy, after, sell } = utilityTasks(u);
  const merge = (list, add) => {
    const keep = (list || []).filter((i) => !i.ut || i.done || add.some((a) => a.ut === i.ut));
    const fresh = add.filter((a) => !keep.some((i) => i.ut === a.ut)).map((a) => ({ id: uid(), done: false, ...a }));
    return { list: [...keep, ...fresh], added: fresh.length };
  };
  const c = merge(mg.checklists.contract, buy);
  // the generic rehab item is replaced by the provider-specific tasks
  const r = merge(
    (mg.checklists.rehab || []).filter((i) => !(i.label === "Utilities transferred" && !i.done && !i.custom)),
    after,
  );
  const mk = merge(mg.checklists.market, sell);
  return {
    mgmt: { ...mg, utilities: u, checklists: { ...mg.checklists, contract: c.list, rehab: r.list, market: mk.list } },
    added: { contract: c.added, rehab: r.added, market: mk.added },
  };
}
const addedMessage = (added) => {
  const parts = [
    [added.contract, "Under contract"],
    [added.rehab, "Rehab"],
    [added.market, "On market"],
  ].filter(([n]) => n);
  if (!parts.length) return "The checklists already have these tasks.";
  const txt = parts.map(([n, st], i) => (i === 0 ? `${n} task${n === 1 ? "" : "s"} to ${st}` : `${n} to ${st}`));
  return "Added " + (txt.length === 1 ? txt[0] : txt.slice(0, -1).join(", ") + " and " + txt[txt.length - 1]) + ".";
};
const utilStatus = (mg, key) => {
  const find = (list, ut) => (list || []).find((i) => i.ut === ut);
  const b = find(mg.checklists.contract, `${key}:buy`) || find(mg.checklists.rehab, `${key}:buy`);
  const s = find(mg.checklists.market, `${key}:sell`);
  if (s && s.done) return { label: "Stopped", tone: "done" };
  if (b && b.done) return { label: "Set up", tone: "done" };
  if (b) return { label: "To do", tone: "todo" };
  return { label: "No task", tone: "none" };
};
// "check near the county line" → "Check near the county line."
const sentence = (s) => {
  const t = String(s || "").trim().replace(/\.+$/, "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) + "." : "";
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
      setMsg(addedMessage(added));
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
  // Swap in one of the "also possible" providers; the one it replaces becomes the alternative.
  const useAlt = (it, name) => {
    const d = dirFor(it.type, name, u.state);
    updItem(
      it.type,
      {
        name: d ? d.name : name,
        id: d ? d.id : "x-" + utilSlug(name),
        phone: (d && d.phone) || "",
        website: "",
        source: "manual",
        confirmed: true,
        detail: "",
        alt: [it.name, ...(it.alt || []).filter((x) => x !== name)],
      },
      true,
    );
  };
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
                                  { name: d ? d.name : nm, id: d ? d.id : nm ? "x-" + utilSlug(nm) : "", phone: edit.phone.trim() || (d && d.phone) || "", website: "", source: "manual", confirmed: !!nm, alt: [], note: "", detail: "" },
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
                              {it.alt && it.alt.length > 0 && (
                                <>
                                  {" "}
                                  Also possible:{" "}
                                  {it.alt.map((a, i) => (
                                    <React.Fragment key={a}>
                                      {i ? ", " : ""}
                                      <button className="link-btn util-alt" onClick={() => useAlt(it, a)} title={`Use ${a} instead`}>
                                        {a}
                                      </button>
                                    </React.Fragment>
                                  ))}
                                  .
                                </>
                              )}
                              {it.note && <> {sentence(it.note)}</>}
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
                                {dir ? dir.startLabel || "Start or transfer" : it.website ? "Website" : "Search"} <Icon name="link" size={12} />
                              </a>
                            )}
                            {dir &&
                              (dir.links || []).map((l) => (
                                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
                                  {l.label} <Icon name="link" size={12} />
                                </a>
                              ))}
                            {it.phone && <span>{it.phone}</span>}
                          </div>
                        ) : (
                          <span className="dt-mute">—</span>
                        )}
                      </td>
                      <td>{st ? <span className={"util-st " + st.tone}>{st.label}</span> : <span className="dt-mute">—</span>}</td>
                      <td>
                        {it.name && !(dir && dir.noAccount) ? (
                          <input className="util-acct" value={it.account || ""} onChange={(e) => updItem(it.type, { account: e.target.value })} placeholder="Account #" aria-label={`${UTIL_LABEL[it.type]} account number`} />
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
            <span className="util-msg">{msg || "Tasks are on the stage checklists: before closing, after closing and for the sale."}</span>
          </div>
        </React.Fragment>
      )}
      {busy && u && <div className="util-busy">Looking up {address.trim()}…</div>}
    </section>
  );
}
