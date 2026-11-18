// jsdom harness: loads the built single-file app with local React, a mock Google Drive,
// mock OAuth and a mock Anthropic API. Exposes helpers for interaction tests.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const REACT = fs.readFileSync(path.join(__dirname,"../node_modules/react/umd/react.production.min.js"), "utf8");
const REACTDOM = fs.readFileSync(path.join(__dirname,"../node_modules/react-dom/umd/react-dom.production.min.js"), "utf8");

function makeDrive() {
  const rejected = new Set();
  const files = {};
  let seq = 1,
    clock = Date.parse("2026-11-10T10:00:00Z");
  const tick = () => new Date((clock += 60000)).toISOString();
  const calls = [];
  const add = (name, content, extra = {}) => {
    const id = "f" + seq++;
    files[id] = { id, name, content: JSON.stringify(content), modifiedTime: tick(), appProperties: {}, lastModifyingUser: { displayName: "Partner", emailAddress: "partner@kappainv.com" }, ...extra };
    return id;
  };
  const bins = {};
  const addBinary = (name, mimeType, text) => {
    const id = "b" + seq++;
    bins[id] = { id, name, mimeType, bytes: Buffer.from(text), modifiedTime: tick(), size: String(Buffer.byteLength(text)) };
    return id;
  };
  const meta = (f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, appProperties: f.appProperties, lastModifyingUser: f.lastModifyingUser });
  const parseMultipart = (body) => {
    const text = typeof body === "string" ? body : Buffer.from(body).toString("utf8");
    const parts = text.split(/--[^\r\n]+\r\n/).filter((p) => p.includes("\r\n\r\n"));
    const get = (p) => p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n--[^\r\n]+--\s*$/, "").replace(/\r\n$/, "");
    return { meta: JSON.parse(get(parts[0])), content: parts[1] ? get(parts[1]) : "" };
  };
  const applyProps = (f, ap) => {
    if (!ap) return;
    Object.keys(ap).forEach((k) => (ap[k] === null ? delete f.appProperties[k] : (f.appProperties[k] = ap[k])));
  };
  const handle = async (url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const auth = (opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || "";
    calls.push({ method, url, auth });
    const u = new URL(url);
    const json = (o, status = 200) => ({ ok: status < 400, status, json: async () => o, text: async () => JSON.stringify(o) });
    if (rejected.has(String(auth).replace(/^Bearer\s+/, ""))) return json({ error: { code: 401, message: "Invalid Credentials" } }, 401);
    const bin = (b) => ({ ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) });
    if (u.pathname === "/drive/v3/files" && method === "GET" && /application\/pdf/.test(u.searchParams.get("q") || "")) {
      const nm = ((u.searchParams.get("q") || "").match(/name contains '([^']*)'/) || [])[1];
      const list = Object.values(bins).filter((b) => !nm || b.name.toLowerCase().includes(nm.toLowerCase()));
      return json({ files: list.map((b) => ({ id: b.id, name: b.name, mimeType: b.mimeType, size: b.size, modifiedTime: b.modifiedTime })) });
    }
    let mb = u.pathname.match(/^\/drive\/v3\/files\/(b\d+)(\/export)?$/);
    if (mb && method === "GET") {
      const b = bins[mb[1]];
      if (!b) return json({ error: "nf" }, 404);
      if (mb[2] || u.searchParams.get("alt") === "media") return bin(b.bytes);
      return json({ id: b.id, name: b.name, mimeType: b.mimeType, size: b.size, modifiedTime: b.modifiedTime });
    }
    if (u.hostname === "www.googleapis.com" && u.pathname === "/oauth2/v3/userinfo") return json({ email: "arie@kappainv.com" });
    if (u.pathname === "/drive/v3/files" && method === "GET") {
      const list = Object.values(files).sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)).map(meta);
      return json({ files: list });
    }
    let m = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (m && method === "GET") {
      const f = files[m[1]];
      if (!f) return json({ error: "nf" }, 404);
      if (u.searchParams.get("alt") === "media") return json(JSON.parse(f.content));
      return json(meta(f));
    }
    if (m && method === "DELETE") {
      delete files[m[1]];
      return json({});
    }
    if (u.pathname === "/upload/drive/v3/files" && method === "POST") {
      const { meta: md, content } = parseMultipart(opts.body);
      const id = "f" + seq++;
      files[id] = { id, name: md.name, content, modifiedTime: tick(), appProperties: {}, lastModifyingUser: { displayName: "Arie", emailAddress: "arie@kappainv.com" }, mimeType: md.mimeType };
      applyProps(files[id], md.appProperties);
      return json({ id, name: md.name, modifiedTime: files[id].modifiedTime, mimeType: md.mimeType, size: content.length });
    }
    m = u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (m && method === "PATCH") {
      const f = files[m[1]];
      if (!f) return json({ error: "nf" }, 404);
      if (u.searchParams.get("uploadType") === "multipart") {
        const { meta: md, content } = parseMultipart(opts.body);
        if (md.name) f.name = md.name;
        applyProps(f, md.appProperties);
        f.content = content;
      } else f.content = opts.body;
      f.modifiedTime = tick();
      f.lastModifyingUser = { displayName: "Arie", emailAddress: "arie@kappainv.com" };
      return json({ id: f.id, name: f.name, modifiedTime: f.modifiedTime });
    }
    throw new Error("Unhandled fetch " + method + " " + url);
  };
  return { files, bins, addBinary, add, handle, calls, rejected, touch: (id, by) => ((files[id].modifiedTime = tick()), (files[id].lastModifyingUser = { displayName: by || "Partner", emailAddress: "partner@kappainv.com" })) };
}

// Default answers from the free map services, for a property at 4623 Carrollton Ave, Indianapolis.
const GEO_FIXTURE = {
  census: {
    result: {
      addressMatches: [
        {
          matchedAddress: "4623 CARROLLTON AVE, INDIANAPOLIS, IN, 46205",
          coordinates: { x: -86.1419, y: 39.8393 },
          addressComponents: { city: "INDIANAPOLIS", state: "IN", zip: "46205" },
          geographies: { "Incorporated Places": [{ NAME: "Indianapolis city (balance)", BASENAME: "Indianapolis" }], Counties: [{ NAME: "Marion County", BASENAME: "Marion" }] },
        },
      ],
    },
  },
  layers: {
    "maps.nccs.nasa.gov/26": [{ name: "INDIANAPOLIS POWER & LIGHT CO", telephone: "317-261-8261", website: "https://www.aesindiana.com", customers: 500000 }],
    "maps.nccs.nasa.gov/29": [{ name: "CITIZENS GAS", total_cust: 270000 }],
    "services.arcgis.com/Water_System_Boundaries": [{ PWS_Name: "CITIZENS WATER", Population_Served_Count: 800000 }],
    "gis.indy.gov/SolidWaste": [{ HAULER: "LRS", DISTRICT: 7, DAY_: "TUESDAY" }],
  },
};
async function boot({ drive, settings, anthropic, localStorageInit, geo, gisInit } = {}) {
  const gis = { requests: 0, hints: [], fail: null, expiresIn: 3599, ...(gisInit || {}) };
  const G = geo || GEO_FIXTURE;
  const geoCalls = [];
  let html = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
  html = html
    .replace('<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>', () => "<script>" + REACT + "</script>")
    .replace('<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>', () => "<script>" + REACTDOM + "</script>")
    .replace('<script src="https://accounts.google.com/gsi/client" async></script>', "");
  const errors = [];
  const anthropicCalls = [];
  const dom = new JSDOM(html, {
    url: "https://cheerful-fairy-529475.netlify.app/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(win) {
      win.localStorage.setItem("kappa_settings", JSON.stringify(settings || {}));
      Object.entries(localStorageInit || {}).forEach(([k, v]) => win.localStorage.setItem(k, v));
      win.IntersectionObserver = class {
        constructor() {}
        observe() {}
        disconnect() {}
      };
      win.scrollTo = () => {};
      win.confirm = () => true;
      win.alert = () => {};
      win.open = () => {};
      win.HTMLElement.prototype.scrollIntoView = () => {};
      win.google = {
        accounts: {
          oauth2: {
            initTokenClient: (cfg) => ({
              requestAccessToken: () => {
                gis.requests++;
                gis.hints.push(cfg.login_hint || null);
                setTimeout(() => {
                  if (gis.fail) cfg.error_callback && cfg.error_callback({ type: gis.fail });
                  else cfg.callback({ access_token: "tok" + gis.requests, expires_in: gis.expiresIn });
                }, 0);
              },
            }),
          },
        },
      };
      win.__jsonpMock = async (url) => {
        geoCalls.push(url);
        if (/geocoding\.geo\.census\.gov/.test(url)) {
          if (G.census instanceof Error) throw G.census;
          return G.census;
        }
        throw new Error("jsonp not mocked: " + url);
      };
      win.fetch = async (url, opts) => {
        const su = String(url);
        const geoHit =
          /maps\.nccs\.nasa\.gov\/.*FeatureServer\/26\//.test(su) ? "maps.nccs.nasa.gov/26" :
          /maps\.nccs\.nasa\.gov\/.*FeatureServer\/29\//.test(su) ? "maps.nccs.nasa.gov/29" :
          /Water_System_Boundaries/.test(su) ? "services.arcgis.com/Water_System_Boundaries" :
          /indy\.gov\/.*SolidWaste/.test(su) ? "gis.indy.gov/SolidWaste" :
          /tims\.dot\.state\.oh\.us\/.*PUCO_Electric/.test(su) ? "puco" :
          /eedgis\.pnnl\.gov/.test(su) ? "pnnl" :
          /\/api\/utility_rates\/v3/.test(su) ? "nrel" :
          /services1\.arcgis\.com|nominatim\.openstreetmap\.org/.test(su) ? "other" : null;
        if (geoHit) {
          geoCalls.push(su);
          const rows = G.layers && G.layers[geoHit];
          if (rows instanceof Error || rows === undefined) throw rows || new Error("offline");
          if (geoHit === "nrel") return { ok: true, status: 200, json: async () => ({ outputs: { utility_name: rows } }) };
          return { ok: true, status: 200, json: async () => (geoHit === "other" ? [] : { features: rows.map((a) => ({ attributes: a })) }) };
        }
        if (String(url).startsWith("https://api.anthropic.com")) {
          anthropicCalls.push({ url, opts, body: JSON.parse(opts.body) });
          return anthropic(JSON.parse(opts.body), opts);
        }
        return drive.handle(String(url), opts);
      };
      const origErr = win.console.error;
      win.console.error = (...a) => {
        errors.push(a.map(String).join(" "));
      };
      win.addEventListener("error", (e) => errors.push("window.error: " + (e.error && e.error.stack ? e.error.stack : e.message)));
    },
  });
  const win = dom.window,
    doc = win.document;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = async (n = 6) => {
    for (let i = 0; i < n; i++) await sleep(5);
  };
  const text = () => { const r = doc.getElementById("root"); return r ? r.textContent : ""; };
  const btn = (re, root) => {
    const all = [...(root || doc).querySelectorAll("button")];
    const b = all.find((x) => (re instanceof RegExp ? re.test(x.textContent) : x.textContent.includes(re)));
    if (!b) throw new Error("button not found: " + re);
    return b;
  };
  const click = async (el) => {
    el.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await settle();
  };
  const setVal = async (el, v) => {
    el.dispatchEvent(new win.FocusEvent("focusin", { bubbles: true }));
    const proto = el.tagName === "SELECT" ? win.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, String(v));
    el.dispatchEvent(new win.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    await settle(2);
  };
  // Field components: find the <label> whose caption matches, then its input
  const field = (caption, root) => {
    const labels = [...(root || doc).querySelectorAll("label")];
    const l = labels.find((x) => {
      const s = x.querySelector("span");
      return s && s.textContent.trim().toLowerCase() === caption.toLowerCase();
    });
    if (!l) throw new Error("field not found: " + caption);
    return l.querySelector("input,select,textarea");
  };
  const modal = () => {
    const ms = [...doc.querySelectorAll("div")].filter((d) => d.style.position === "fixed" && d.style.zIndex === "300");
    return ms[ms.length - 1] || null;
  };
  await settle(10);
  return { dom, win, doc, errors, anthropicCalls, geoCalls, gis, settle, sleep, text, btn, click, setVal, field, modal };
}
module.exports = { boot, makeDrive, GEO_FIXTURE };
