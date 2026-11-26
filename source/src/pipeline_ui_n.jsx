// ============================================================================
// v68 — SCHEDULE: a Gantt chart of the rehab milestones
// ============================================================================
// The tasks are the rehab milestones themselves (mgmt.rehab.milestones), so ticking one complete here is the
// same as marking it done on the Stages tab: the % of work done and any project manager payment tied to that
// milestone follow. Each milestone may also carry:
//   dur   work days (0 = a milestone diamond; missing = 5)
//   after predecessor ids (missing = the task above it; [] = none, it starts with the project)
//   auto  false = locked to its own start date; otherwise it starts when its predecessors finish
//   start the locked start date (only read when auto is false)
//   who   assigned to
//   group the id of a group in mgmt.rehab.groups = [{ id, label }]
// mgmt.rehab.sched = { workdays: 5 | 6 | 7, start } — start is the planned start while the rehab hasn't started.
const GT_STAGES = ["contract", "rehab", "market", "sold"];
const GT_DEFAULT_DUR = 5;
const GT_ANCHOR = "2000-01-03"; // a Monday: day numbers count from it, so (dn mod 7) is the weekday, 0 = Monday
const GT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const gtDn = (iso) => daysBetween(GT_ANCHOR, iso);
const gtIso = (dn) => addDaysISO(GT_ANCHOR, dn);
const gtDow = (dn) => ((dn % 7) + 7) % 7;
// work-day index with wd work days a week (5 Mon–Fri, 6 Mon–Sat, 7 every day); a day off maps to the next work day
const gtToW = (dn, wd) => {
  const w = Math.floor(dn / 7),
    d = dn - 7 * w;
  return d >= wd ? (w + 1) * wd : w * wd + d;
};
const gtFromW = (wi, wd) => {
  const w = Math.floor(wi / wd);
  return w * 7 + (wi - w * wd);
};
const gtDur = (x) => {
  const n = x && x.dur !== "" && x.dur != null ? Number(x.dur) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : GT_DEFAULT_DUR;
};
const gtWorkdays = (r) => {
  const w = Number(r && r.sched && r.sched.workdays);
  return w === 6 || w === 7 ? w : 5;
};
const GT_WEEKS = [
  [5, "Mon–Fri"],
  [6, "Mon–Sat"],
  [7, "7 days"],
];
// The schedule counts as set up once someone has worked on it (a duration, a dependency, a lock, a group, the
// work week or a planned start): until then its dates are only the 5-day defaults. Its tasks then go on the
// Tasks board, unless that was switched off.
const gtIsSet = (r) => !!r && (((r.groups || []).length > 0) || !!r.sched || (r.milestones || []).some((x) => x.dur != null || Array.isArray(x.after) || x.auto === false));
const gtOnBoard = (r) => (r && r.sched && r.sched.board === false ? false : gtIsSet(r));
const gtPatch = (x, p) => {
  const o = { ...x, ...p };
  Object.keys(p).forEach((k) => p[k] === undefined && delete o[k]);
  return o;
};

// Display order: the milestones in their saved order, except that a group's tasks sit together where the
// group's first task is. Empty groups come last.
function gtRows(r) {
  const ms = (r && r.milestones) || [];
  const groups = ((r && r.groups) || []).filter((g) => g && g.id);
  const gset = new Set(groups.map((g) => g.id));
  const gOf = (x) => (x.group && gset.has(x.group) ? x.group : "");
  const order = [],
    gOrder = [],
    seen = new Set();
  ms.forEach((x) => {
    const g = gOf(x);
    if (!g) order.push(x);
    else if (!seen.has(g)) {
      seen.add(g);
      gOrder.push(g);
      ms.forEach((y) => gOf(y) === g && order.push(y));
    }
  });
  groups.forEach((g) => !seen.has(g.id) && gOrder.push(g.id));
  return { order, gOf, groups: gOrder.map((id) => groups.find((g) => g.id === id)) };
}

// Where the schedule starts: the actual rehab start; else the planned start; else the purchase closing (or the
// expected one) if it is still ahead; else today.
function gtAnchor(mg, t) {
  const r = mg.rehab || {},
    sc = r.sched || {};
  if (r.startDate) return { iso: r.startDate, from: "rehab" };
  if (sc.start) return { iso: sc.start, from: "plan" };
  const cd = mg.closing && mg.closing.date,
    ec = mg.contract && mg.contract.expectedClosing;
  const c = cd || ec;
  if (c && c > t) return { iso: c, from: cd ? "closing" : "expected" };
  return { iso: t, from: "today" };
}

// The schedule: every task's start and end, the critical path, and how it compares with today.
function schedOf(mg, today) {
  const t = today || todayISO();
  const r = (mg && mg.rehab) || {};
  const wd = gtWorkdays(r);
  const anchor = gtAnchor(mg, t);
  const p0 = gtToW(gtDn(anchor.iso), wd);
  const { order, gOf, groups } = gtRows(r);
  const byId = {};
  order.forEach((x) => (byId[x.id] = x));
  const preds = {};
  order.forEach((x, i) => {
    preds[x.id] = Array.isArray(x.after) ? [...new Set(x.after)].filter((id) => id !== x.id && byId[id]) : i > 0 ? [order[i - 1].id] : [];
  });
  // a dependency that would close a loop is ignored (and reported)
  const state = {},
    topo = [],
    dropped = [];
  const visit = (id) => {
    state[id] = 1;
    preds[id] = preds[id].filter((p) => {
      if (state[p] === 1) {
        dropped.push([p, id]);
        return false;
      }
      if (!state[p]) visit(p);
      return true;
    });
    state[id] = 2;
    topo.push(id);
  };
  order.forEach((x) => !state[x.id] && visit(x.id));
  const K = {};
  topo.forEach((id) => {
    const x = byId[id];
    const dur = gtDur(x);
    const locked = x.auto === false && !!parseISO(x.start);
    const es = Math.max(p0, ...preds[id].map((p) => K[p].e));
    // a milestone (0 days) is a point in time: reached at the end of its day, so it sits where the tasks before it end
    const s = locked ? gtToW(gtDn(x.start) + (dur ? 0 : 1), wd) : es;
    K[id] = { id, dur, auto: !locked, s, e: s + dur, es, preds: preds[id], succ: [] };
  });
  topo.forEach((id) => K[id].preds.forEach((p) => K[p].succ.push(id)));
  const F = order.length ? Math.max(...order.map((x) => K[x.id].e)) : p0;
  [...topo].reverse().forEach((id) => {
    const k = K[id];
    const lf = k.succ.length ? Math.min(...k.succ.map((s) => K[s].ls)) : F;
    k.ls = lf - k.dur;
    k.slack = k.ls - k.s;
  });
  const todayDn = gtDn(t);
  const tasks = order.map((x) => {
    const k = K[x.id];
    const atEnd = !k.dur && k.s > p0;
    const sDn = gtFromW(atEnd ? k.s - 1 : k.s, wd);
    const lastDn = k.dur ? gtFromW(k.e - 1, wd) : sDn;
    const status = x.status || "todo";
    const done = status === "done";
    return {
      ...k,
      x,
      atEnd,
      label: x.label || "",
      status,
      done,
      group: gOf(x),
      sDn,
      lastDn,
      start: gtIso(sDn),
      end: gtIso(lastDn),
      critical: k.slack <= 0,
      conflict: !k.auto && k.s < k.es,
      late: !done && lastDn < todayDn,
      behind: !done && status === "todo" && sDn < todayDn && !(lastDn < todayDn),
    };
  });
  const gs = groups.map((g) => {
    const kids = tasks.filter((k) => k.group === g.id);
    if (!kids.length) return { ...g, kids, n: 0, nDone: 0 };
    const s = Math.min(...kids.map((k) => k.s)),
      e = Math.max(...kids.map((k) => k.e));
    const sDn = Math.min(...kids.map((k) => k.sDn)),
      lastDn = Math.max(...kids.map((k) => k.lastDn));
    return { ...g, kids, n: kids.length, nDone: kids.filter((k) => k.done).length, s, e, dur: e - s, sDn, lastDn, start: gtIso(sDn), end: gtIso(lastDn) };
  });
  const endDn = tasks.length ? Math.max(...tasks.map((k) => k.lastDn)) : null;
  return {
    wd,
    anchor,
    startDn: gtFromW(p0, wd),
    start: gtIso(gtFromW(p0, wd)),
    tasks,
    groups: gs,
    endDn,
    end: endDn != null ? gtIso(endDn) : "",
    workDays: F - p0,
    dropped,
    todayDn,
  };
}

// ---------- templates ----------
// [key, group, label, work days, after keys]; [] after = starts with the project
const GT_TEMPLATES = {
  cosmetic: {
    label: "Cosmetic rehab",
    note: "Paint, floors, kitchen and bath refresh: about 5 weeks",
    groups: [
      ["prep", "Prep"],
      ["ext", "Exterior"],
      ["int", "Interior"],
    ],
    tasks: [
      ["clean", "prep", "Cleanout & trash-out", 2, []],
      ["demo", "prep", "Light demo & prep", 2, ["clean"]],
      ["yard", "ext", "Yard cleanup & landscaping", 3, ["clean"]],
      ["extpaint", "ext", "Exterior paint & touch-ups", 4, ["yard"]],
      ["gutters", "ext", "Gutters & minor exterior repairs", 2, ["extpaint"]],
      ["repairs", "int", "Drywall patch & minor repairs", 3, ["demo"]],
      ["paint", "int", "Interior paint", 5, ["repairs"]],
      ["kitchen", "int", "Kitchen refresh (cabinets, counters, hardware)", 4, ["paint"]],
      ["bath", "int", "Bathroom refresh", 3, ["paint"]],
      ["floor", "int", "Flooring", 4, ["kitchen", "bath"]],
      ["fixtures", "int", "Lighting, fixtures & hardware", 2, ["floor"]],
      ["punch", "int", "Final clean & punch list", 2, ["fixtures", "gutters"]],
      ["ready", "", "Ready to list", 0, ["punch"]],
    ],
  },
  full: {
    label: "Full rehab",
    note: "Systems, drywall, kitchen and baths: about 11 weeks",
    groups: [
      ["pre", "Pre-construction"],
      ["ext", "Exterior"],
      ["sys", "Structure & systems"],
      ["int", "Interior"],
    ],
    tasks: [
      ["permits", "pre", "Permits pulled", 5, []],
      ["demo", "pre", "Demo & cleanout", 5, []],
      ["roof", "ext", "Roof", 4, ["demo"]],
      ["windows", "ext", "Windows & exterior doors", 3, ["roof"]],
      ["siding", "ext", "Siding / exterior paint", 5, ["windows"]],
      ["concrete", "ext", "Concrete, gutters & landscaping", 4, ["siding"]],
      ["framing", "sys", "Framing & structural repairs", 4, ["demo"]],
      ["plumb", "sys", "Plumbing rough-in", 4, ["framing", "permits"]],
      ["elec", "sys", "Electrical rough-in", 4, ["framing", "permits"]],
      ["hvac", "sys", "HVAC rough-in", 3, ["framing", "permits"]],
      ["roughinsp", "sys", "Rough-in inspections", 2, ["plumb", "elec", "hvac"]],
      ["insul", "int", "Insulation", 2, ["roughinsp"]],
      ["drywall", "int", "Drywall hang & finish", 8, ["insul"]],
      ["paint", "int", "Interior paint", 5, ["drywall"]],
      ["kitchen", "int", "Kitchen cabinets & counters", 6, ["paint"]],
      ["bath", "int", "Bathrooms (tile, vanities, fixtures)", 7, ["drywall"]],
      ["floor", "int", "Flooring", 5, ["kitchen", "bath"]],
      ["trim", "int", "Trim & interior doors", 3, ["floor"]],
      ["finals", "int", "Fixtures, lighting & appliances", 3, ["trim"]],
      ["finalinsp", "int", "Final inspections", 2, ["finals"]],
      ["punch", "int", "Final clean & punch list", 3, ["finalinsp", "concrete"]],
      ["ready", "", "Ready to list", 0, ["punch"]],
    ],
  },
};
// mode "replace": the template's tasks become the schedule; "append": added after the current ones (the
// template's first tasks then follow the current last task)
function gtApplyTemplate(r, key, mode) {
  const tp = GT_TEMPLATES[key];
  const gid = {},
    tid = {};
  tp.groups.forEach(([k, label]) => (gid[k] = { id: uid(), label }));
  tp.tasks.forEach(([k]) => (tid[k] = uid()));
  const cur = (r && r.milestones) || [];
  const last = mode === "append" && cur.length ? gtRows(r).order.slice(-1)[0] : null;
  const tasks = tp.tasks.map(([k, g, label, dur, after]) => {
    const x = { id: tid[k], label, status: "todo", dur, after: after.length ? after.map((a) => tid[a]) : last ? [last.id] : [] };
    if (g) x.group = gid[g].id;
    return x;
  });
  const groups = Object.values(gid);
  return mode === "append" ? { milestones: [...cur, ...tasks], groups: [...((r && r.groups) || []), ...groups] } : { milestones: tasks, groups };
}

// ---------- view settings (per browser) ----------
const GT_VIEW_KEY = "kappa_gantt_view_v1";
const GT_ZOOMS = [3, 5, 8, 12, 18, 26, 38, 54];
const GT_VIEW0 = { dayW: 18, crit: false, hideWe: false, collapsed: {} };
const gtReadView = () => {
  try {
    const v = JSON.parse(localStorage.getItem(GT_VIEW_KEY) || "{}");
    return { ...GT_VIEW0, ...(v && typeof v === "object" ? v : {}) };
  } catch (e) {
    return { ...GT_VIEW0 };
  }
};
const GT_ROW = 34;
const GT_COLS = [
  ["name", "Task", 214],
  ["start", "Start", 112],
  ["dur", "Days", 52],
  ["who", "Assigned to", 100],
  ["auto", "Auto", 40],
  ["done", "Done", 42],
  ["act", "", 76],
];
const GT_PRINT_COLS = [
  ["name", "Task", 236],
  ["start", "Start", 70],
  ["dur", "Days", 40],
  ["who", "Assigned to", 98],
  ["done", "Done", 42],
];
const gtWidth = (cols) => cols.reduce((t, c) => t + c[2], 0);

function GtNum({ value, onCommit, ...rest }) {
  const [t, setT] = useState(String(value));
  const esc = useRef(false);
  useEffect(() => setT(String(value)), [value]);
  const commit = () => {
    if (esc.current) {
      esc.current = false;
      setT(String(value));
      return;
    }
    const n = Math.round(parseFloat(t));
    if (Number.isFinite(n) && n >= 0 && n !== value) onCommit(Math.min(n, 999));
    else setT(String(value));
  };
  return (
    <input
      inputMode="numeric"
      value={t}
      onChange={(e) => setT(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") {
          e.stopPropagation();
          esc.current = true;
          e.currentTarget.blur();
        }
      }}
      {...rest}
    />
  );
}

function GanttTab({ mgmt, setMgmt, addLog, userEmail, address, stage, today }) {
  const t0 = today || todayISO();
  const r = mgmt.rehab;
  const S = schedOf(mgmt, t0);
  const [view, setViewRaw] = useState(gtReadView);
  const setView = (p) =>
    setViewRaw((v) => {
      const n = { ...v, ...p };
      try {
        localStorage.setItem(GT_VIEW_KEY, JSON.stringify(n));
      } catch (e) {}
      return n;
    });
  const [sel, setSel] = useState(null);
  const [panel, setPanel] = useState(null); // { kind: "task" | "group", id }
  const [full, setFull] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [drag, setDrag] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [flash, setFlash] = useState(null); // "Deleted …" next to Undo, for a few seconds
  const hist = useRef({ undo: [], redo: [] });
  const [, bump] = useState(0);
  const scrollRef = useRef(null);
  const ro = printing;

  // ---------- changes, with undo ----------
  const snap = () => ({ milestones: r.milestones, groups: r.groups || [], sched: r.sched || {}, targetEnd: r.targetEnd || "" });
  const commit = (fn, log) => {
    const h = hist.current;
    h.undo.push(snap());
    if (h.undo.length > 80) h.undo.shift();
    h.redo = [];
    setMgmt((mm) => ({ ...mm, rehab: { ...mm.rehab, ...fn(mm.rehab) } }));
    if (log) addLog(log);
    bump((n) => n + 1);
  };
  const restore = (from, to) => {
    const h = hist.current;
    if (!h[from].length) return;
    const s = h[from].pop();
    h[to].push(snap());
    setMgmt((mm) => ({ ...mm, rehab: { ...mm.rehab, ...s } }));
    bump((n) => n + 1);
  };
  const undo = () => restore("undo", "redo");
  const redo = () => restore("redo", "undo");
  const setTask = (id, patch) => commit((rh) => ({ milestones: rh.milestones.map((x) => (x.id === id ? gtPatch(x, patch) : x)) }));
  const setStatus = (k, st) => {
    if (k.status === st) return;
    commit(
      (rh) => ({
        milestones: rh.milestones.map((y) =>
          y.id === k.id ? { ...y, status: st, doneAt: st === "done" ? new Date().toISOString() : "", by: st === "done" ? userEmail || "" : "" } : y,
        ),
      }),
      st === "done" ? `Milestone done: ${k.label}` : null,
    );
  };
  const addTask = (afterId, group) => {
    const ref = afterId ? r.milestones.find((x) => x.id === afterId) : null;
    const g = ref ? S.tasks.find((k) => k.id === afterId).group : group || "";
    const nt = { id: uid(), label: "New task", status: "todo", dur: GT_DEFAULT_DUR };
    if (g) nt.group = g;
    commit((rh) => {
      const ms = [...rh.milestones];
      let at = ms.length;
      if (afterId) at = ms.findIndex((x) => x.id === afterId) + 1;
      else if (g) {
        const idx = ms.map((x, i) => (x.group === g ? i : -1)).filter((i) => i >= 0);
        if (idx.length) at = idx[idx.length - 1] + 1;
      }
      ms.splice(at, 0, nt);
      return { milestones: ms };
    });
    if (g && view.collapsed[g]) setView({ collapsed: { ...view.collapsed, [g]: false } });
    setFocusId(nt.id);
    setSel(nt.id);
  };
  const addGroup = () => {
    const g = { id: uid(), label: "New group" };
    commit((rh) => ({ groups: [...(rh.groups || []), g] }));
    setPanel({ kind: "group", id: g.id });
  };
  const move = (id, dir) =>
    commit((rh) => {
      const { order, gOf } = gtRows(rh);
      const x = rh.milestones.find((y) => y.id === id);
      const sib = order.filter((y) => gOf(y) === gOf(x));
      const other = sib[sib.findIndex((y) => y.id === id) + dir];
      if (!other) return {};
      const ms = rh.milestones.filter((y) => y.id !== id);
      const k = ms.findIndex((y) => y.id === other.id);
      ms.splice(dir < 0 ? k : k + 1, 0, x);
      return { milestones: ms };
    });
  const setGroup = (id, g) =>
    commit((rh) => {
      const x = gtPatch(
        rh.milestones.find((y) => y.id === id),
        { group: g || undefined },
      );
      const ms = rh.milestones.filter((y) => y.id !== id);
      const idx = ms.map((y, i) => (g && y.group === g ? i : -1)).filter((i) => i >= 0);
      ms.splice(idx.length ? idx[idx.length - 1] + 1 : ms.length, 0, x);
      return { milestones: ms };
    });
  const delTask = (id) => {
    const k = S.tasks.find((y) => y.id === id);
    if (!k) return;
    const pmRef = ((mgmt.pm && mgmt.pm.installments) || []).some((i) => i.when === "ms:" + id);
    if (pmRef && !window.confirm(`"${k.label}" triggers a project manager payment. Delete it anyway?`)) return;
    // tasks that waited for it now wait for what it waited for
    commit((rh) => ({
      milestones: rh.milestones
        .filter((y) => y.id !== id)
        .map((y) => (Array.isArray(y.after) && y.after.includes(id) ? { ...y, after: [...new Set([...y.after.filter((a) => a !== id), ...k.preds])] } : y)),
    }));
    setPanel(null);
    setSel(null);
    setFlash(`Deleted “${k.label}”`);
  };
  const delGroup = (gid) => {
    const g = S.groups.find((x) => x.id === gid);
    setFlash(`Deleted the group “${g ? g.label : ""}”${g && g.n ? `; its ${g.n} task${g.n === 1 ? " stays" : "s stay"}` : ""}`);
    commit((rh) => ({ groups: (rh.groups || []).filter((g) => g.id !== gid), milestones: rh.milestones.map((y) => (y.group === gid ? gtPatch(y, { group: undefined }) : y)) }));
    setPanel(null);
  };
  const setGroupLabel = (gid, label) => commit((rh) => ({ groups: (rh.groups || []).map((g) => (g.id === gid ? { ...g, label } : g)) }));
  const setSched = (p) => commit((rh) => ({ sched: { ...(rh.sched || {}), ...p } }));
  const anyLocked = S.tasks.some((k) => !k.auto);
  const autoAll = () => commit((rh) => ({ milestones: rh.milestones.map((x) => (x.auto === false || x.start ? gtPatch(x, { auto: undefined, start: undefined }) : x)) }));
  const applyTemplate = (key, mode) => {
    const tp = GT_TEMPLATES[key];
    const n = r.milestones.length;
    if (mode === "replace" && n) {
      const done = S.tasks.filter((k) => k.done).length;
      const pm = ((mgmt.pm && mgmt.pm.installments) || []).some((i) => String(i.when || "").startsWith("ms:"));
      const msg = `Replace the ${n} current task${n === 1 ? "" : "s"} with the ${tp.label} template?${done ? ` ${done} of them ${done === 1 ? "is" : "are"} marked done.` : ""}${
        pm ? " Project manager payments tied to a milestone will need a new one." : ""
      } You can undo this.`;
      if (!window.confirm(msg)) return;
    }
    commit((rh) => gtApplyTemplate(rh, key, mode), `Schedule: ${mode === "append" ? "added" : "applied"} the ${tp.label} template`);
    setTplOpen(false);
    setPanel(null);
  };

  // ---------- keyboard: undo / redo, Escape ----------
  useEffect(() => {
    const k = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if (e.key === "Escape") {
        if (panel) setPanel(null);
        else if (tplOpen) setTplOpen(false);
        else if (full) setFull(false);
        return;
      }
      if (!typing && e.key === "Delete" && sel && !ro && S.tasks.some((k) => k.id === sel)) {
        e.preventDefault();
        delTask(sel);
        return;
      }
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const key = String(e.key).toLowerCase();
      if (key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  });

  // ---------- Download PDF: the browser's print, landscape, only the chart ----------
  useEffect(() => {
    if (!printing) return;
    const st = document.createElement("style");
    st.textContent = "@page{size:landscape;margin:8mm}";
    document.head.appendChild(st);
    document.body.classList.add("gt-printing");
    let over = false;
    const done = () => {
      if (over) return;
      over = true;
      document.body.classList.remove("gt-printing");
      st.remove();
      window.removeEventListener("afterprint", done);
      setPrinting(false);
    };
    window.addEventListener("afterprint", done);
    const tm = setTimeout(() => {
      try {
        window.print();
      } catch (e) {}
      setTimeout(done, 300);
    }, 80);
    return () => {
      clearTimeout(tm);
      if (!over) {
        document.body.classList.remove("gt-printing");
        st.remove();
        window.removeEventListener("afterprint", done);
      }
    };
  }, [printing]);

  useEffect(() => {
    if (!flash) return;
    const tm = setTimeout(() => setFlash(null), 7000);
    return () => clearTimeout(tm);
  }, [flash]);

  useEffect(() => {
    if (focusId) {
      const el = document.querySelector(`.gt-r[data-id="${focusId}"] .gt-name`);
      if (el) {
        el.focus();
        el.select && el.select();
      }
      setFocusId(null);
    }
  }, [focusId]);

  // ---------- geometry ----------
  const cols = ro ? GT_PRINT_COLS : GT_COLS;
  const gridW = gtWidth(cols);
  const hideWe = !!view.hideWe && S.wd < 7;
  const targetDn = r.targetEnd && parseISO(r.targetEnd) ? gtDn(r.targetEnd) : null;
  const firstDn = S.tasks.length ? Math.min(...S.tasks.map((k) => k.sDn)) : S.startDn;
  let lo = Math.min(firstDn, S.startDn, S.todayDn) - 3;
  lo -= gtDow(lo);
  const hiCore = Math.max(S.endDn != null ? S.endDn : S.startDn, targetDn != null ? targetDn : -Infinity, S.todayDn);
  const hi = hiCore + (ro ? 9 : 14);
  const unitOf = (dn) => (hideWe ? gtToW(dn, S.wd) : dn);
  const u0 = unitOf(lo);
  const unitsTo = (dn) => unitOf(dn + 1) - u0;
  const printW = 990 - gridW;
  const dayW = ro ? Math.max(1.5, Math.min(40, printW / unitsTo(hi))) : Math.max(1.5, num(view.dayW) || 18);
  const px = (dn) => (unitOf(dn) - u0) * dayW;
  const chartW = Math.ceil(px(hi + 1));
  const zoom = (dir) => {
    const cur = dayW;
    const next = dir > 0 ? GT_ZOOMS.find((z) => z > cur + 0.01) : [...GT_ZOOMS].reverse().find((z) => z < cur - 0.01);
    if (next) setView({ dayW: next });
  };
  const fit = () => {
    const w = (scrollRef.current && scrollRef.current.clientWidth) || 1000;
    const span = unitOf(hiCore + 3) - unitOf(Math.min(firstDn, S.todayDn) - 2);
    setView({ dayW: Math.max(1.5, Math.min(60, (w - gridW - 8) / Math.max(1, span))) });
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  };

  // open with today in view
  const scrolledEl = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || scrolledEl.current === el) return;
    scrolledEl.current = el;
    const visible = el.clientWidth - gridW;
    if (todayX != null && visible > 120 && todayX > visible * 0.7) el.scrollLeft = Math.max(0, todayX - visible * 0.35);
  });

  // rows on screen
  const collapsed = view.collapsed || {};
  const rows = [];
  const seenG = new Set();
  S.tasks.forEach((k) => {
    if (!k.group) return rows.push({ kind: "task", k });
    if (seenG.has(k.group)) return;
    seenG.add(k.group);
    const g = S.groups.find((x) => x.id === k.group);
    rows.push({ kind: "group", g });
    if (!collapsed[g.id]) g.kids.forEach((kk) => rows.push({ kind: "task", k: kk, child: true }));
  });
  S.groups.filter((g) => !g.n).forEach((g) => rows.push({ kind: "group", g }));
  const bodyH = Math.max(rows.length, 1) * GT_ROW;
  const rowOf = {};
  rows.forEach((row, i) => row.kind === "task" && (rowOf[row.k.id] = i));
  const kOf = {};
  S.tasks.forEach((k) => (kOf[k.id] = k));

  // header scale
  const dayMode = dayW >= 16;
  const months = [];
  for (let d = lo; d <= hi; ) {
    const dt = parseISO(gtIso(d));
    const next = Math.min(gtDn(isoOf(new Date(dt.getFullYear(), dt.getMonth() + 1, 1))), hi + 1);
    const w = px(next) - px(d);
    if (w > 0) months.push({ d, x: px(d), w, label: w >= 58 ? `${GT_MONTHS[dt.getMonth()]} ${dt.getFullYear()}` : w >= 26 ? GT_MONTHS[dt.getMonth()] : "" });
    d = next;
  }
  const ticks = [];
  const weekend = [];
  for (let d = lo; d <= hi; d++) {
    const work = gtDow(d) < S.wd;
    if (!work && !hideWe) {
      const last = weekend[weekend.length - 1];
      if (last && last.to === d - 1) last.to = d;
      else weekend.push({ from: d, to: d });
    }
    if (hideWe && !work) continue;
    if (dayMode) ticks.push({ d, x: px(d), w: dayW, label: String(Number(gtIso(d).slice(8, 10))), we: !work, today: d === S.todayDn });
    else if (gtDow(d) === 0) {
      const w = px(d + 7) - px(d);
      ticks.push({ d, x: px(d), w, label: w >= 36 ? fmtDateShort(gtIso(d)) : "", week: true });
    }
  }
  const mondays = [];
  for (let d = lo; d <= hi; d += 7) mondays.push(px(d));
  const xd = (k) => px(k.atEnd ? k.sDn + 1 : k.sDn); // a milestone's point
  const xs = (k) => (k.dur ? px(k.sDn) : xd(k));
  const xe = (k) => (k.dur ? px(k.lastDn + 1) : xd(k));
  const todayX = S.todayDn >= lo && S.todayDn <= hi ? px(S.todayDn) + (hideWe && gtDow(S.todayDn) >= S.wd ? 0 : dayW / 2) : null;
  const targetX = targetDn != null && targetDn >= lo && targetDn <= hi ? px(targetDn + 1) : null;

  // dependency arrows (finish → start)
  const arrows = [];
  S.tasks.forEach((k) => {
    if (rowOf[k.id] == null) return;
    k.preds.forEach((p) => {
      if (rowOf[p] == null) return;
      const a = kOf[p];
      const x1 = xe(a) + (a.dur ? 0 : 7),
        y1 = rowOf[p] * GT_ROW + GT_ROW / 2,
        x2 = xs(k) - (k.dur ? 0 : 7),
        y2 = rowOf[k.id] * GT_ROW + GT_ROW / 2;
      const g = 6;
      const d =
        x2 - x1 >= 2 * g
          ? `M${x1},${y1}H${x1 + g}V${y2}H${x2 - 1}`
          : `M${x1},${y1}H${x1 + g}V${y1 + (y2 > y1 ? GT_ROW / 2 : -GT_ROW / 2)}H${x2 - g}V${y2}H${x2 - 1}`;
      arrows.push({ key: p + ">" + k.id, d, crit: view.crit && a.critical && k.critical });
    });
  });

  // drag a bar: move it (locks its start) or stretch its end (changes its days)
  const snapPx = drag ? Math.round(drag.dx / dayW) * dayW : 0;
  const onBarDown = (e, k) => {
    if (ro || (e.button != null && e.button > 0)) return;
    const resize = !!(e.target && e.target.closest && e.target.closest(".gt-grip"));
    try {
      if (e.pointerId != null && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
    } catch (er) {}
    setDrag({ id: k.id, mode: resize && k.dur ? "resize" : "move", x0: e.clientX, dx: 0 });
    setSel(k.id);
    e.preventDefault();
  };
  const onBarMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    setDrag((d) => (d ? { ...d, dx } : d));
  };
  const onBarUp = (e, k) => {
    if (!drag) return;
    const n = Math.round((e.clientX - drag.x0) / dayW);
    const mode = drag.mode;
    setDrag(null);
    if (!n) return;
    if (mode === "move") setTask(k.id, { auto: false, start: gtIso(hideWe ? gtFromW(gtToW(k.sDn, S.wd) + n, S.wd) : k.sDn + n) });
    else setTask(k.id, { dur: Math.max(1, hideWe ? k.dur + n : gtToW(k.lastDn + n + 1, S.wd) - k.s) });
  };

  // ---------- summary ----------
  const nDone = S.tasks.filter((k) => k.done).length;
  const nLate = S.tasks.filter((k) => k.late).length;
  const nBehind = S.tasks.filter((k) => k.behind).length;
  const tgtGap = r.targetEnd && S.end ? daysBetween(r.targetEnd, S.end) : null;
  const fromNote = { rehab: "the rehab started", plan: "planned", closing: "the purchase closing", expected: "the expected closing", today: "today: the rehab hasn't started" }[S.anchor.from];
  const contacts = (mgmt.contacts || []).filter((c) => c && c.name);
  const whoList = [...new Set([...contacts.map((c) => c.name), ...r.milestones.map((x) => x.who).filter(Boolean)])];
  const pt = panel && panel.kind === "task" ? S.tasks.find((k) => k.id === panel.id) : null;
  const pg = panel && panel.kind === "group" ? S.groups.find((g) => g.id === panel.id) : null;
  const empty = !S.tasks.length && !S.groups.length;
  const statusDot = (k) => (k.done ? "done" : k.late ? "late" : k.behind ? "behind" : k.status === "doing" ? "doing" : "todo");
  const dotTitle = { done: "Done", late: "Late: should have been finished", behind: "Behind: should have started", doing: "In progress", todo: "To do" };

  const cell = (key, child) => {
    const c = cols.find((x) => x[0] === key);
    return c ? (
      <div className={"gt-c gt-c-" + key} style={{ width: c[2] }}>
        {child}
      </div>
    ) : null;
  };
  const taskRow = (k, child) => {
    const st = statusDot(k);
    return (
      <div key={k.id} data-id={k.id} className={"gt-r task" + (sel === k.id ? " sel" : "") + (k.done ? " is-done" : "")} onMouseDown={() => setSel(k.id)}>
        {cell(
          "name",
          <React.Fragment>
            <span className={"gt-dot keep-color " + st} title={dotTitle[st]} style={{ marginLeft: child ? 16 : 0 }} />
            {ro ? <span className="gt-ro gt-ro-name">{k.label}</span> : <FinText className="gt-in gt-name" value={k.label} onCommit={(v) => setTask(k.id, { label: v.trim() || k.label })} aria-label="Task name" />}
          </React.Fragment>,
        )}
        {cell(
          "start",
          ro ? (
            <span className="gt-ro">{fmtDateShort(k.start)}</span>
          ) : (
            <input
              type="date"
              className={"gt-in gt-date" + (k.auto ? "" : " locked") + (k.conflict ? " conflict" : "")}
              value={k.start}
              title={k.auto ? "Starts when its predecessors finish. Pick a date to lock it." : k.conflict ? "Locked to this date, before its predecessors finish" : "Locked to this date"}
              onChange={(e) => e.target.value && setTask(k.id, { auto: false, start: e.target.value })}
              aria-label="Start date"
            />
          ),
        )}
        {cell(
          "dur",
          ro ? (
            <span className="gt-ro">{k.dur ? `${k.dur}d` : "◆"}</span>
          ) : (
            <span className="gt-dur">
              <GtNum className="gt-in gt-num" value={k.dur} onCommit={(v) => setTask(k.id, { dur: v })} aria-label="Work days" title="Work days (0 = a milestone)" />
              <i>d</i>
            </span>
          ),
        )}
        {cell("who", ro ? <span className="gt-ro">{k.x.who || ""}</span> : <FinText className="gt-in" value={k.x.who || ""} onCommit={(v) => setTask(k.id, { who: v.trim() || undefined })} list="gt-who" placeholder="—" aria-label="Assigned to" />)}
        {cell(
          "auto",
          <input
            type="checkbox"
            className="gt-chk"
            checked={k.auto}
            onChange={(e) => setTask(k.id, e.target.checked ? { auto: undefined, start: undefined } : { auto: false, start: k.start })}
            title={k.auto ? "Auto: starts when its predecessors finish" : "Locked to its start date"}
            aria-label="Auto schedule"
          />,
        )}
        {cell(
          "done",
          ro ? (
            <span className="gt-ro">{k.done ? "✓" : ""}</span>
          ) : (
            <input type="checkbox" className="gt-chk gt-done" checked={k.done} onChange={(e) => setStatus(k, e.target.checked ? "done" : "todo")} aria-label="Complete" />
          ),
        )}
        {cell(
          "act",
          <span className="gt-acts">
            <button className="gt-ib" title="Add a task after this one" aria-label="Add a task after this one" onClick={() => addTask(k.id)}>
              <Icon name="plus" size={14} />
            </button>
            <button className="gt-ib" title="Details: dependencies, group, move" aria-label="Task details" onClick={() => setPanel({ kind: "task", id: k.id })}>
              <Icon name="more" size={14} stroke={2.6} />
            </button>
            <button className="gt-ib gt-ib-del" title="Delete task (or the Delete key)" aria-label="Delete task" onClick={() => delTask(k.id)}>
              <Icon name="trash" size={14} />
            </button>
          </span>,
        )}
      </div>
    );
  };
  const groupRow = (g) => (
    <div key={"g" + g.id} data-gid={g.id} className="gt-r grp">
      {cell(
        "name",
        <React.Fragment>
          <button className="gt-caret" aria-label={collapsed[g.id] ? "Expand group" : "Collapse group"} onClick={() => setView({ collapsed: { ...collapsed, [g.id]: !collapsed[g.id] } })}>
            <Icon name={collapsed[g.id] ? "chevron" : "down"} size={13} stroke={2.2} />
          </button>
          {ro ? <span className="gt-ro gt-ro-name">{g.label}</span> : <FinText className="gt-in gt-gname" value={g.label} onCommit={(v) => setGroupLabel(g.id, v.trim() || g.label)} aria-label="Group name" />}
          <em className="gt-gcount">{g.n}</em>
        </React.Fragment>,
      )}
      {cell("start", <span className="gt-ro">{g.n ? fmtDateShort(g.start) : ""}</span>)}
      {cell("dur", <span className="gt-ro">{g.n ? `${g.dur}d` : ""}</span>)}
      {cell("who", null)}
      {cell("auto", null)}
      {cell("done", <span className="gt-ro gt-gdone">{g.n ? `${g.nDone}/${g.n}` : ""}</span>)}
      {cell(
        "act",
        <span className="gt-acts">
          <button className="gt-ib" title="Add a task to this group" aria-label="Add a task to this group" onClick={() => addTask(null, g.id)}>
            <Icon name="plus" size={14} />
          </button>
          <button className="gt-ib" title="Group" aria-label="Group details" onClick={() => setPanel({ kind: "group", id: g.id })}>
            <Icon name="more" size={14} stroke={2.6} />
          </button>
          <button className="gt-ib gt-ib-del" title="Delete the group (its tasks stay)" aria-label="Delete group" onClick={() => delGroup(g.id)}>
            <Icon name="trash" size={14} />
          </button>
        </span>,
      )}
    </div>
  );

  const bar = (row, i) => {
    const top = i * GT_ROW;
    if (row.kind === "group") {
      const g = row.g;
      if (!g.n) return null;
      const x = px(g.sDn),
        w = Math.max(4, px(g.lastDn + 1) - x);
      return <div key={"gb" + g.id} className="gt-gbar keep-color" style={{ left: x, width: w, top: top + 11 }} title={`${g.label}: ${fmtDate(g.start)} – ${fmtDate(g.end)}`} />;
    }
    const k = row.k;
    const dragging = drag && drag.id === k.id;
    const cls = (k.done ? " done" : k.status === "doing" ? " doing" : "") + (view.crit && k.critical ? " crit" : "") + (sel === k.id ? " sel" : "") + (dragging ? " dragging" : "");
    const tip = `${k.label}\n${fmtDate(k.start)}${k.dur ? ` – ${fmtDate(k.end)} (${k.dur} work day${k.dur === 1 ? "" : "s"})` : " (milestone)"}${k.x.who ? `\n${k.x.who}` : ""}${
      view.crit ? (k.critical ? "\nOn the critical path" : `\n${k.slack} work day${k.slack === 1 ? "" : "s"} of slack`) : ""
    }`;
    const handlers = ro
      ? {}
      : {
          onPointerDown: (e) => onBarDown(e, k),
          onPointerMove: onBarMove,
          onPointerUp: (e) => onBarUp(e, k),
          onPointerCancel: () => setDrag(null),
          onDoubleClick: () => setPanel({ kind: "task", id: k.id }),
        };
    if (!k.dur) {
      const x = xd(k) + (dragging && drag.mode === "move" ? snapPx : 0);
      return (
        <React.Fragment key={"b" + k.id}>
          <div data-id={k.id} className={"gt-dia keep-color" + cls} style={{ left: x - 7, top: top + GT_ROW / 2 - 7 }} title={tip} {...handlers} />
          <span className={"gt-blabel" + (k.late ? " late" : "")} style={{ left: x + 12, top: top + 8 }}>
            {k.label}
            {k.late ? <b> · late</b> : null}
          </span>
        </React.Fragment>
      );
    }
    let x = xs(k),
      w = Math.max(3, xe(k) - x);
    if (dragging && drag.mode === "move") x += snapPx;
    if (dragging && drag.mode === "resize") w = Math.max(dayW, w + snapPx);
    return (
      <React.Fragment key={"b" + k.id}>
        <div data-id={k.id} className={"gt-bar keep-color" + cls} style={{ left: x, width: w, top: top + 8 }} title={tip} {...handlers}>
          {(k.done || k.status === "doing") && <i className="keep-color" style={{ width: k.done ? "100%" : "50%" }} />}
          {!ro && <span className="gt-grip" />}
        </div>
        <span className={"gt-blabel" + (k.late ? " late" : "")} style={{ left: x + w + 6, top: top + 8 }}>
          {k.label}
          {k.late ? <b> · late</b> : null}
          {k.x.who ? <em> · {k.x.who}</em> : null}
        </span>
      </React.Fragment>
    );
  };

  const tool = (label, icon, onClick, opt = {}) => (
    <button className={"gt-tb" + (opt.on ? " on" : "")} onClick={onClick} disabled={!!opt.disabled} title={opt.title || label} aria-label={label} aria-pressed={opt.on == null ? undefined : !!opt.on}>
      <Icon name={icon} size={15} />
      {!opt.iconOnly && <span>{label}</span>}
    </button>
  );

  const body = (
    <div className={"gantt" + (full || printing ? " gt-full gt-portal" : "") + (printing ? " gt-printmode" : "")}>
      <div className="gt-head">
        <span className="dp-ico t-blue page-ico gt-noprint">
          <Icon name="gantt" size={20} stroke={2} />
        </span>
        <div className="page-head-t">
          <h2>
            Schedule{(full || printing) && address ? <span className="gt-h2-addr"> · {address}</span> : null}
          </h2>
          <p className="gt-noprint">
            The rehab milestones on a timeline. A task set to Auto starts when the tasks before it finish, so changing one moves everything after it. Done here is done everywhere.
          </p>
          {printing && (
            <p className="gt-print-sub">
              Rehab schedule, printed {fmtDate(t0)}
            </p>
          )}
        </div>
      </div>

      <section className="dcard gt-sum">
        <div className="gt-sum-i">
          <span>Start</span>
          {r.startDate || ro ? (
            <b>{fmtDate(S.start)}</b>
          ) : (
            <input type="date" className="gt-sum-date" value={(r.sched && r.sched.start) || ""} onChange={(e) => setSched({ start: e.target.value || undefined })} aria-label="Planned start" />
          )}
          <em>{r.startDate ? "the rehab started" : r.sched && r.sched.start ? "planned start" : `from ${fromNote}`}</em>
        </div>
        <div className="gt-sum-i">
          <span>Finish</span>
          <b className="gt-finish">{S.end ? fmtDate(S.end) : "—"}</b>
          <em>{S.tasks.length ? `${S.workDays} work days` : "no tasks"}</em>
        </div>
        <div className="gt-sum-i">
          <span>Target completion</span>
          <b>{r.targetEnd ? fmtDate(r.targetEnd) : "Not set"}</b>
          <em className={"gt-tgt" + (tgtGap > 0 ? " neg" : tgtGap != null ? " pos" : "")}>
            {tgtGap == null ? (S.end ? "set one from the schedule" : "") : tgtGap > 0 ? `the schedule runs ${tgtGap} day${tgtGap === 1 ? "" : "s"} late` : tgtGap < 0 ? `${-tgtGap} day${tgtGap === -1 ? "" : "s"} to spare` : "on target"}
          </em>
        </div>
        <div className="gt-sum-i">
          <span>Progress</span>
          <b>
            {nDone} of {S.tasks.length} done
          </b>
          <em className={nLate || nBehind ? "neg" : ""}>{nLate || nBehind ? [nLate ? `${nLate} late` : "", nBehind ? `${nBehind} behind` : ""].filter(Boolean).join(", ") : S.tasks.length ? "on schedule" : ""}</em>
        </div>
        {!ro && stage === "rehab" && (
          <div className="gt-sum-i gt-board">
            <span>Tasks board</span>
            <label>
              <input type="checkbox" checked={gtOnBoard(r)} onChange={(e) => setSched({ board: e.target.checked })} aria-label="Put the schedule's tasks on the Tasks board" />
              <b>{gtOnBoard(r) ? "On" : "Off"}</b>
            </label>
            <em>
              {!gtOnBoard(r)
                ? gtIsSet(r)
                  ? "switched off"
                  : "once the schedule is set up"
                : !r.startDate
                  ? "from the rehab start"
                  : (() => {
                      const n = S.tasks.filter((k) => !k.done && k.start <= t0).length;
                      return `${n} task${n === 1 ? "" : "s"} there now, each from its start`;
                    })()}
            </em>
          </div>
        )}
        {!ro && S.end && S.end !== r.targetEnd && (
          <button
            className="gt-use"
            style={btnGhost()}
            onClick={() => commit(() => ({ targetEnd: S.end }), `Target completion set to ${fmtDate(S.end)} from the schedule`)}
          >
            Use {fmtDateShort(S.end)} as the target
          </button>
        )}
        {!ro && (
          <label className="gt-week">
            <span>Work week</span>
            <select value={S.wd} onChange={(e) => setSched({ workdays: Number(e.target.value) })} aria-label="Work week">
              {GT_WEEKS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      <section className="dcard gt-card" style={panel ? { minHeight: 560 } : undefined}>
        <div className="gt-tools">
          {tool("Undo", "undo", undo, { disabled: !hist.current.undo.length, title: "Undo (Ctrl+Z)" })}
          {tool("Redo", "redo", redo, { disabled: !hist.current.redo.length, title: "Redo (Ctrl+Y)" })}
          {flash && (
            <span className="gt-flash" role="status">
              {flash} ·{" "}
              <button
                className="link-btn"
                onClick={() => {
                  undo();
                  setFlash(null);
                }}
              >
                Undo
              </button>
            </span>
          )}
          <span className="gt-sep" />
          {tool("Auto schedule", "bolt", autoAll, { disabled: !anyLocked, title: anyLocked ? "Unlock every task: each starts when its predecessors finish" : "Every task is already on auto" })}
          {tool("Critical path", "path", () => setView({ crit: !view.crit }), { on: view.crit, title: "Show the tasks that set the finish date: a day lost on any of them is a day lost on the rehab" })}
          {tool("Hide weekends", "eyeoff", () => setView({ hideWe: !view.hideWe }), { on: hideWe, disabled: S.wd === 7, title: S.wd === 7 ? "The work week is 7 days" : "Show work days only" })}
          <span className="gt-sep" />
          {tool("Zoom to fit", "fit", fit, { title: "Fit the whole schedule in view" })}
          {tool("Zoom out", "zout", () => zoom(-1), { iconOnly: true, disabled: dayW <= GT_ZOOMS[0] })}
          {tool("Zoom in", "zin", () => zoom(1), { iconOnly: true, disabled: dayW >= GT_ZOOMS[GT_ZOOMS.length - 1] })}
          <span className="gt-sep" />
          {tool(full ? "Exit full screen" : "Full screen", "expand", () => setFull(!full))}
          <span className="gt-tpl-wrap">
            {tool("Templates", "template", () => setTplOpen(!tplOpen), { on: tplOpen })}
            {tplOpen && (
              <div className="gt-tpl" role="menu">
                {Object.entries(GT_TEMPLATES).map(([key, tp]) => (
                  <div key={key} className="gt-tpl-i">
                    <b>{tp.label}</b>
                    <span>
                      {tp.note} ({tp.tasks.length} tasks)
                    </span>
                    <div>
                      <button className="link-btn" onClick={() => applyTemplate(key, "replace")}>
                        {r.milestones.length ? "Replace current" : "Use"}
                      </button>
                      {r.milestones.length > 0 && (
                        <button className="link-btn" onClick={() => applyTemplate(key, "append")}>
                          Add after current
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </span>
          {tool("Download PDF", "download", () => {
            setPanel(null);
            setTplOpen(false);
            setPrinting(true);
          }, { disabled: empty, title: "Print or save as PDF (landscape)" })}
        </div>

        {empty ? (
          <div className="gt-empty">
            <b>No tasks yet.</b> Start from a template, or add the first task.
            <div className="gt-empty-acts">
              {Object.entries(GT_TEMPLATES).map(([key, tp]) => (
                <button key={key} style={btnGhost()} onClick={() => applyTemplate(key, "replace")}>
                  <Icon name="template" size={14} /> {tp.label}
                </button>
              ))}
              <button style={btnGhost()} onClick={() => addTask(null, "")}>
                <Icon name="plus" size={14} /> Add a task
              </button>
            </div>
          </div>
        ) : (
          <div className="gt-scroll" ref={scrollRef}>
            <div className="gt-canvas" style={{ width: gridW + chartW }}>
              <div className="gt-hrow">
                <div className="gt-hcells" style={{ width: gridW }}>
                  {cols.map(([k, l, w]) => (
                    <div key={k} className={"gt-h gt-h-" + k} style={{ width: w }}>
                      {l}
                    </div>
                  ))}
                </div>
                <div className="gt-scale" style={{ width: chartW }}>
                  {months.map((m) => (
                    <div key={m.d} className="gt-mon" style={{ left: m.x, width: m.w }}>
                      <span style={{ left: gridW + 6 }}>{m.label}</span>
                    </div>
                  ))}
                  {ticks.map((tk) => (
                    <div key={tk.d} className={"gt-tick" + (tk.we ? " we" : "") + (tk.today ? " today" : "")} style={{ left: tk.x, width: tk.w }}>
                      {tk.label}
                    </div>
                  ))}
                  {targetX != null && (
                    <div className="gt-hmark tgt keep-color" style={{ left: targetX }} title={`Target completion ${fmtDate(r.targetEnd)}`}>
                      Target
                    </div>
                  )}
                  {todayX != null && !dayMode && (
                    <div className="gt-hmark today keep-color" style={{ left: todayX }}>
                      Today
                    </div>
                  )}
                </div>
              </div>
              <div className="gt-body">
                <div className="gt-grid" style={{ width: gridW }}>
                  {rows.map((row) => (row.kind === "group" ? groupRow(row.g) : taskRow(row.k, row.child)))}
                  {!ro && (
                    <div className="gt-r gt-addrow">
                      <button className="link-btn" onClick={() => addTask(null, "")}>
                        <Icon name="plus" size={13} /> Task
                      </button>
                      <button className="link-btn" onClick={addGroup}>
                        <Icon name="plus" size={13} /> Group
                      </button>
                    </div>
                  )}
                </div>
                <div
                  className="gt-chart"
                  style={{
                    width: chartW,
                    height: bodyH + (ro ? 0 : GT_ROW),
                    backgroundImage: dayMode ? "linear-gradient(to right, var(--line) 1px, transparent 1px)" : "none",
                    backgroundSize: `${dayW}px 100%`,
                  }}
                >
                  {weekend.map((w) => (
                    <div key={"we" + w.from} className="gt-we" style={{ left: px(w.from), width: px(w.to + 1) - px(w.from) }} />
                  ))}
                  {mondays.map((x) => (
                    <div key={"m" + x} className="gt-vl" style={{ left: x }} />
                  ))}
                  {rows.map((row, i) => (
                    <div
                      key={"band" + i}
                      className={"gt-band" + (row.kind === "group" ? " grp" : "") + (row.kind === "task" && sel === row.k.id ? " sel" : "")}
                      style={{ top: i * GT_ROW }}
                    />
                  ))}
                  <svg className="gt-arrows" width={chartW} height={bodyH} aria-hidden="true">
                    <defs>
                      <marker id="gt-ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M0,0L8,4L0,8z" fill="#9CA3AF" />
                      </marker>
                      <marker id="gt-ah-c" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                        <path d="M0,0L8,4L0,8z" fill="#DC2626" />
                      </marker>
                    </defs>
                    {arrows.map((a) => (
                      <path key={a.key} d={a.d} className={a.crit ? "crit" : ""} markerEnd={`url(#${a.crit ? "gt-ah-c" : "gt-ah"})`} />
                    ))}
                  </svg>
                  {rows.map(bar)}
                  {targetX != null && <div className="gt-target" style={{ left: targetX }} />}
                  {todayX != null && <div className="gt-today" style={{ left: todayX }} />}
                </div>
              </div>
            </div>
          </div>
        )}

        {pt && (
          <div className="gt-panel" role="dialog" aria-label="Task">
            <div className="gt-panel-h">
              <b>Task</b>
              <button className="gt-ib" aria-label="Close" onClick={() => setPanel(null)}>
                <Icon name="x" size={15} />
              </button>
            </div>
            <label className="gt-f">
              <span>Name</span>
              <FinText className="gt-pin" value={pt.label} onCommit={(v) => setTask(pt.id, { label: v.trim() || pt.label })} />
            </label>
            <div className="gt-f">
              <span>Status</span>
              <div className="gt-seg">
                {[
                  ["todo", "To do"],
                  ["doing", "In progress"],
                  ["done", "Done"],
                ].map(([v, l]) => (
                  <button key={v} className={pt.status === v ? "on" : ""} onClick={() => setStatus(pt, v)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="gt-f2">
              <label className="gt-f">
                <span>Start</span>
                <input type="date" className="gt-pin" value={pt.start} onChange={(e) => e.target.value && setTask(pt.id, { auto: false, start: e.target.value })} />
              </label>
              <label className="gt-f">
                <span>Work days</span>
                <GtNum className="gt-pin" value={pt.dur} onCommit={(v) => setTask(pt.id, { dur: v })} />
              </label>
            </div>
            <label className="gt-check">
              <input type="checkbox" checked={pt.auto} onChange={(e) => setTask(pt.id, e.target.checked ? { auto: undefined, start: undefined } : { auto: false, start: pt.start })} />
              Auto: start when the tasks before it finish
            </label>
            <p className={"gt-hint" + (pt.conflict ? " neg" : "")}>
              {pt.dur ? `Ends ${fmtDate(pt.end)}.` : "0 days: a milestone (a diamond on the chart)."}{" "}
              {pt.conflict ? "It's locked to a date before the tasks it follows finish." : !pt.auto ? `Locked to ${fmtDate(pt.start)}.` : ""}
              {view.crit ? (pt.critical ? " On the critical path." : ` ${pt.slack} work day${pt.slack === 1 ? "" : "s"} of slack.`) : ""}
            </p>
            <label className="gt-f">
              <span>Assigned to</span>
              <FinText className="gt-pin" value={pt.x.who || ""} onCommit={(v) => setTask(pt.id, { who: v.trim() || undefined })} list="gt-who" placeholder="Contractor, trade or person" />
            </label>
            <label className="gt-f">
              <span>Group</span>
              <select className="gt-pin" value={pt.group} onChange={(e) => setGroup(pt.id, e.target.value)}>
                <option value="">No group</option>
                {S.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="gt-f">
              <span>Starts after</span>
              <label className="gt-check">
                <input type="radio" name="gt-after" checked={!Array.isArray(pt.x.after)} onChange={() => setTask(pt.id, { after: undefined })} />
                The task above
                {(() => {
                  const i = S.tasks.findIndex((k) => k.id === pt.id);
                  return i > 0 ? <em>({S.tasks[i - 1].label})</em> : <em>(none: it starts with the project)</em>;
                })()}
              </label>
              <label className="gt-check">
                <input type="radio" name="gt-after" checked={Array.isArray(pt.x.after)} onChange={() => setTask(pt.id, { after: pt.preds })} />
                These tasks
              </label>
              {Array.isArray(pt.x.after) && (
                <div className="gt-plist">
                  {S.tasks
                    .filter((k) => k.id !== pt.id)
                    .map((k) => (
                      <label key={k.id} className="gt-check">
                        <input
                          type="checkbox"
                          checked={pt.x.after.includes(k.id)}
                          onChange={(e) => setTask(pt.id, { after: e.target.checked ? [...pt.x.after, k.id] : pt.x.after.filter((a) => a !== k.id) })}
                        />
                        {k.label}
                      </label>
                    ))}
                  {!pt.x.after.length && <p className="gt-hint">None ticked: it starts with the project.</p>}
                </div>
              )}
              {S.dropped.some(([, b]) => b === pt.id) && <p className="gt-hint neg">A loop was ignored: a task can't come both before and after this one.</p>}
            </div>
            {(num(pt.x.budget) > 0 || pt.x.scope) && (
              <p className="gt-hint">
                {num(pt.x.budget) > 0 && <b>{fmt(num(pt.x.budget))}</b>}
                {num(pt.x.budget) > 0 && pt.x.scope ? " · " : ""}
                {pt.x.scope}
              </p>
            )}
            <div className="gt-panel-f">
              <button className="link-btn" onClick={() => move(pt.id, -1)}>
                Move up
              </button>
              <button className="link-btn" onClick={() => move(pt.id, 1)}>
                Move down
              </button>
              <button className="link-btn gt-del" onClick={() => delTask(pt.id)}>
                Delete task
              </button>
            </div>
          </div>
        )}
        {pg && (
          <div className="gt-panel" role="dialog" aria-label="Group">
            <div className="gt-panel-h">
              <b>Group</b>
              <button className="gt-ib" aria-label="Close" onClick={() => setPanel(null)}>
                <Icon name="x" size={15} />
              </button>
            </div>
            <label className="gt-f">
              <span>Name</span>
              <FinText className="gt-pin" value={pg.label} onCommit={(v) => setGroupLabel(pg.id, v.trim() || pg.label)} />
            </label>
            <p className="gt-hint">
              {pg.n ? `${pg.n} task${pg.n === 1 ? "" : "s"}, ${fmtDate(pg.start)} – ${fmtDate(pg.end)}. ` : "No tasks yet. "}
              To put a task in this group, open the task and pick the group.
            </p>
            <div className="gt-panel-f">
              <button className="link-btn" onClick={() => (addTask(null, pg.id), setPanel(null))}>
                Add a task
              </button>
              <button className="link-btn gt-del" onClick={() => delGroup(pg.id)}>
                Delete group (keeps its tasks)
              </button>
            </div>
          </div>
        )}
      </section>
      <datalist id="gt-who">
        {whoList.map((w) => (
          <option key={w} value={w} />
        ))}
      </datalist>
    </div>
  );
  return full || printing ? ReactDOM.createPortal(body, document.body) : body;
}
