// ============================================================================
// v59 — TASKS: the open checklist tasks of every active project on one screen, and a notifications bell
// ============================================================================
// Tasks are the stage checklists (mgmt.checklists.contract / rehab / market). A deal's open tasks are the
// open items of its current stage's checklist, plus utility and hand-added tasks still open from an earlier
// stage (they don't stop mattering when the deal moves on). A sold deal keeps its open utility tasks (stop
// the services). A task is "new" from when it became live: when it was added (addedAt) or, for a stage's
// own checklist, when the deal entered that stage (stageHistory). What you have seen is kept per browser.
const TASK_INDEX_KEY = "kappa_task_index_v1";
const TASK_SEEN_KEY = "kappa_tasks_seen_v1";
const TASK_CKS = ["contract", "rehab", "market"];
const TASK_CK_LABEL = { contract: "Under contract", rehab: "Rehab", market: "On market" };
const TASK_STAGES = ["contract", "rehab", "market", "sold"];
const readTaskIndex = () => {
  try {
    return JSON.parse(localStorage.getItem(TASK_INDEX_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const writeTaskIndex = (ix) => {
  try {
    localStorage.setItem(TASK_INDEX_KEY, JSON.stringify(ix));
  } catch {}
};
// the first time, tasks that went live in the last week count as new
const readTasksSeen = () => {
  try {
    const v = localStorage.getItem(TASK_SEEN_KEY);
    if (v) return v;
  } catch {}
  return new Date(Date.now() - 7 * 86400000).toISOString();
};
const writeTasksSeen = (v) => {
  try {
    localStorage.setItem(TASK_SEEN_KEY, v);
  } catch {}
};

// ---------- when a task is due to be worked on ----------
// A task reaches the board when it makes sense to do it: stop-the-service tasks once the sale has closed;
// a task that follows another once that one is done; the last steps before a purchase closing in the days
// before it. Everything else, and anything added by hand, from when its stage starts.
const TASK_AFTER = {
  "Inspection completed": ["Inspection scheduled"],
  "Title commitment reviewed": ["Title ordered"],
  "Listing live on MLS": ["Listing agent signed", "Professional photos"],
};
const TASK_BEFORE_CLOSING = { "Investor funds confirmed": 14, "Insurance bound": 14, "Final walkthrough": 3, "Closing funds wired": 3 };
const UTIL_START_LEAD = 10; // days before the purchase closing to set up the utilities
// { ok } now, or { ok: false, why } with when it will be; `at`: when it became workable, if later than its stage
function taskGate(i, ck, mg, st, today) {
  const t = today || todayISO();
  if (i.custom) return { ok: true };
  if (ck === "market" && i.ut) return st === "sold" ? { ok: true } : { ok: false, why: "after the sale closes" };
  const pre = TASK_AFTER[i.label];
  if (pre) {
    const list = (mg.checklists && mg.checklists[ck]) || [];
    const deps = pre.map((l) => list.find((x) => x.label === l)).filter(Boolean);
    const open = deps.filter((x) => !x.done);
    if (open.length) return { ok: false, why: `after ${open.map((x) => `"${x.label}"`).join(" and ")}` };
    return { ok: true, at: deps.map((x) => x.doneAt || "").sort().pop() || "" };
  }
  if (ck === "contract" && st === "contract") {
    const c = mg.contract && mg.contract.expectedClosing;
    const lead = i.ut ? UTIL_START_LEAD : TASK_BEFORE_CLOSING[i.label];
    if (lead && c) {
      const from = addDaysISO(c, -lead);
      return from <= t ? { ok: true, at: from } : { ok: false, from, why: `from ${fmtDate(from)}, ${lead} days before closing` };
    }
  }
  return { ok: true };
}

// The open (and recently done) tasks of one deal: { st, open: [...], done: [...] }
function dealTasks(d, today) {
  const t = today || todayISO();
  const st = inferStage(d);
  const mg = mergeMgmt(d.mgmt);
  const cur = st === "sold" ? "sold" : CHECKLIST_OF[st];
  if (!cur || st === "dead" || st === "analyzing") return { st, open: [], done: [] };
  // a sold deal: its open stop-the-service tasks, for 90 days after the sale
  if (st === "sold" && mg.sale.date && mg.sale.date < addDaysISO(t, -90)) return { st, open: [], done: [] };
  const hist = Array.isArray(d.stageHistory) ? d.stageHistory : [];
  const entered = (s) => {
    const h = hist.filter((x) => x.stage === s).pop();
    return (h && (h.ts || h.date)) || { contract: mg.contract.date, rehab: mg.closing.date, market: mg.listing.date, sold: mg.sale.date }[s] || "";
  };
  const upto = cur === "sold" ? 3 : TASK_CKS.indexOf(cur) + 1;
  const weekAgo = addDaysISO(t, -14);
  const open = [],
    done = [];
  TASK_CKS.slice(0, upto).forEach((ck) => {
    const carried = ck !== cur;
    (mg.checklists[ck] || []).forEach((i) => {
      // past stages: only what still matters after the stage (utilities, tasks someone added by hand)
      if (carried && !(i.ut || i.custom)) return;
      if (cur === "sold" && (ck !== "market" || !i.ut)) return;
      const base = { id: i.id, ck, label: i.label, note: i.note || "", url: i.url || "", ut: i.ut || "", custom: !!i.custom, carried };
      if (i.done) {
        if (i.doneAt && i.doneAt.slice(0, 10) >= weekAgo) done.push({ ...base, doneAt: i.doneAt, by: i.by || "" });
        return;
      }
      // not time for it yet: it stays in the deal's checklist and reaches the board when it is
      const g = taskGate(i, ck, mg, st, t);
      if (!g.ok) return;
      // no date of its own: contract tasks are due by the purchase closing
      const due = i.due || (ck === "contract" && st === "contract" ? mg.contract.expectedClosing || "" : "");
      const live = cur === "sold" ? entered("sold") : entered(ck);
      const at = i.addedAt || (g.at && g.at > (live || "") ? g.at : live) || "";
      open.push({ ...base, due, dueSet: !!i.due, at });
    });
  });
  return { st, open, done };
}
const taskIndexEntry = (d, mt, name) => {
  const x = dealTasks(d);
  return { mt, name: name || "", address: d.address || "", st: x.st, open: x.open, done: x.done };
};
const taskDueState = (t, today) => (!t.due ? "none" : t.due < today ? "overdue" : t.due <= addDaysISO(today, 3) ? "soon" : t.due <= addDaysISO(today, 7) ? "week" : "later");
const taskDueLabel = (t, today) => {
  if (!t.due) return "";
  const n = daysBetween(today, t.due);
  const pre = t.dueSet ? "" : "by closing, ";
  if (n < 0) return `${pre}${-n} day${n === -1 ? "" : "s"} late`;
  if (n === 0) return `${pre}due today`;
  if (n === 1) return `${pre}due tomorrow`;
  return `${pre}due ${fmtDate(t.due)}`;
};
const agoLabel = (iso) => {
  if (!iso) return "";
  const n = daysBetween(iso.slice(0, 10), todayISO());
  return n <= 0 ? "today" : n === 1 ? "yesterday" : n < 30 ? `${n} days ago` : fmtDate(iso.slice(0, 10));
};
// every open task across the deals: index entries, with the open deal's live state in place of its entry
function collectTasks(index, files, live) {
  const ids = new Set(files.map((f) => f.id));
  const out = [];
  const add = (fid, e) =>
    e.open.forEach((t) => out.push({ ...t, fid, key: fid + ":" + t.id, address: e.address || (e.name || "").replace(/\.json$/i, ""), st: e.st }));
  Object.entries(index).forEach(([fid, e]) => {
    if (!ids.has(fid) || (live && live.id === fid) || !e || !e.open) return;
    add(fid, e);
  });
  if (live && live.entry) add(live.id || "live", live.entry);
  return out;
}
const sortTasks = (a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : (a.at || "") < (b.at || "") ? 1 : -1;

// ---------- the bell in the header ----------
function TaskBell({ tasks, seenAt, onSeen, onOpenTask, onOpenAll }) {
  const [open, setOpen] = useState(false);
  const [since, setSince] = useState(seenAt);
  const today = todayISO();
  const fresh = tasks.filter((t) => t.at && t.at > seenAt);
  const overdue = tasks.filter((t) => taskDueState(t, today) === "overdue");
  const soon = tasks.filter((t) => taskDueState(t, today) === "soon" && !(t.at && t.at > seenAt));
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.target.closest && e.target.closest(".bell-wrap")) return;
      setOpen(false);
      onSeen();
    };
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [open]);
  const toggle = () => {
    if (open) {
      setOpen(false);
      onSeen();
    } else {
      setSince(seenAt);
      setOpen(true);
    }
  };
  const row = (t, tone) => (
    <button
      key={t.key}
      className="bell-row"
      onClick={() => {
        setOpen(false);
        onSeen();
        onOpenTask(t);
      }}
    >
      <span className={"bell-dot " + tone} />
      <span className="bell-txt">
        <b>{t.label}</b>
        <em>
          {splitAddress(t.address)[0]} · {TASK_CK_LABEL[t.ck]}
          {t.due ? ` · ${taskDueLabel(t, today)}` : t.at ? ` · ${agoLabel(t.at)}` : ""}
        </em>
      </span>
    </button>
  );
  const newOnes = tasks.filter((t) => t.at && t.at > since).sort((a, b) => ((a.at || "") < (b.at || "") ? 1 : -1));
  const count = fresh.length;
  return (
    <div className="bell-wrap">
      <button className={"tb-bell" + (overdue.length ? " late" : "") + (open ? " on" : "")} onClick={toggle} aria-label={`Notifications: ${count} new task${count === 1 ? "" : "s"}${overdue.length ? `, ${overdue.length} overdue` : ""}`} aria-expanded={open} title="Tasks that need you">
        <Icon name="bell" size={17} />
        {count > 0 ? <em className="tb-bell-n">{count > 99 ? "99+" : count}</em> : overdue.length > 0 ? <em className="tb-bell-dot" /> : null}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label="Notifications">
          <div className="bell-h">
            <b>Notifications</b>
            <button className="link-btn" onClick={() => (setOpen(false), onSeen(), onOpenAll())}>
              All tasks
            </button>
          </div>
          <div className="bell-body">
            {newOnes.length === 0 && overdue.length === 0 && soon.length === 0 && <div className="bell-empty">You're up to date. No new or overdue tasks.</div>}
            {newOnes.length > 0 && (
              <div className="bell-sec">
                <div className="bell-k">New tasks</div>
                {newOnes.slice(0, 8).map((t) => row(t, "new"))}
                {newOnes.length > 8 && <div className="bell-more">{newOnes.length - 8} more on the Tasks screen</div>}
              </div>
            )}
            {overdue.length > 0 && (
              <div className="bell-sec">
                <div className="bell-k">Overdue</div>
                {overdue.sort(sortTasks).slice(0, 6).map((t) => row(t, "late"))}
              </div>
            )}
            {soon.length > 0 && (
              <div className="bell-sec">
                <div className="bell-k">Due in the next 3 days</div>
                {soon.sort(sortTasks).slice(0, 6).map((t) => row(t, "soon"))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- the Tasks screen ----------
const TASK_FILTERS = [
  ["all", "All open"],
  ["new", "New this week"],
  ["overdue", "Overdue"],
  ["week", "Due this week"],
];
function TasksScreen({ tasks, done, files, busy, onSeen, onToggle, onDue, onAdd, onOpen, focus }) {
  const today = todayISO();
  const weekAgo = addDaysISO(today, -7);
  const [filter, setFilter] = useState("all");
  const [proj, setProj] = useState("");
  const [draft, setDraft] = useState({ fid: "", label: "", due: "" });
  const [busyKey, setBusyKey] = useState(null);
  const [dueEdit, setDueEdit] = useState(null); // the task whose due date is being set
  const [err, setErr] = useState("");
  useEffect(() => {
    const t = setTimeout(onSeen, 1500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector(`[data-task="${focus.key}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.classList.add("hit");
      setTimeout(() => el.classList.remove("hit"), 2400);
    }
  }, [focus]);
  // "New" on this screen: went live in the last 7 days (the bell's count is what you haven't looked at yet)
  const isNew = (t) => !!t.at && t.at.slice(0, 10) >= weekAgo;
  const pass = (t) =>
    (!proj || t.fid === proj) &&
    (filter === "all" || (filter === "new" && isNew(t)) || (filter === "overdue" && taskDueState(t, today) === "overdue") || (filter === "week" && ["overdue", "soon", "week"].includes(taskDueState(t, today))));
  const counts = {
    all: tasks.filter((t) => !proj || t.fid === proj).length,
    new: tasks.filter((t) => (!proj || t.fid === proj) && isNew(t)).length,
    overdue: tasks.filter((t) => (!proj || t.fid === proj) && taskDueState(t, today) === "overdue").length,
    week: tasks.filter((t) => (!proj || t.fid === proj) && ["overdue", "soon", "week"].includes(taskDueState(t, today))).length,
  };
  const shown = tasks.filter(pass);
  // group by project, the projects with the most urgent task first
  const groups = [];
  shown
    .slice()
    .sort(sortTasks)
    .forEach((t) => {
      let g = groups.find((x) => x.fid === t.fid);
      if (!g) groups.push((g = { fid: t.fid, address: t.address, st: t.st, items: [] }));
      g.items.push(t);
    });
  // projects that can take a new task: active deals
  const projects = [];
  tasks.forEach((t) => !projects.some((p) => p.fid === t.fid) && projects.push({ fid: t.fid, address: t.address, st: t.st }));
  files.forEach((f) => f.st && ["contract", "rehab", "market"].includes(f.st) && !projects.some((p) => p.fid === f.id) && projects.push({ fid: f.id, address: f.address, st: f.st }));
  projects.sort((a, b) => (a.address < b.address ? -1 : 1));
  const run = async (key, fn) => {
    setBusyKey(key);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message || "Could not save the change. Try again.");
    }
    setBusyKey(null);
  };
  const add = () => {
    const fid = draft.fid || proj || (projects[0] && projects[0].fid);
    if (!fid || !draft.label.trim()) return;
    run("add", () => onAdd(fid, draft.label.trim(), draft.due)).then(() => setDraft({ fid: draft.fid, label: "", due: "" }));
  };
  const doneShown = (done || []).filter((t) => !proj || t.fid === proj).sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));
  return (
    <div className="tasks">
      <div className="pf-head">
        <div>
          <h1 className="pf-title">Tasks</h1>
          <div className="pf-sub">Open tasks across the projects: each stage's checklist, plus utility and added tasks still open from an earlier stage.</div>
        </div>
      </div>
      <div className="tk-bar">
        <div className="lg-chips" role="group" aria-label="Show">
          {TASK_FILTERS.map(([k, l]) => (
            <button key={k} className={"lg-chip" + (filter === k ? " on" : "") + (k === "overdue" && counts.overdue ? " late" : "")} onClick={() => setFilter(k)} aria-pressed={filter === k}>
              {l} <em>{counts[k]}</em>
            </button>
          ))}
        </div>
        <select className="tk-proj" value={proj} onChange={(e) => setProj(e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.fid} value={p.fid}>
              {splitAddress(p.address)[0]}
            </option>
          ))}
        </select>
      </div>
      {projects.length > 0 && (
        <div className="tk-add">
          <select value={draft.fid || proj || (projects[0] && projects[0].fid) || ""} onChange={(e) => setDraft({ ...draft, fid: e.target.value })} aria-label="Add to project">
            {projects.map((p) => (
              <option key={p.fid} value={p.fid}>
                {splitAddress(p.address)[0]}
              </option>
            ))}
          </select>
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New task, e.g. Confirm the electric account is in the LLC's name" aria-label="New task" />
          <input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} aria-label="Due date" title="Due date (optional)" />
          <button style={btnPrimary()} onClick={add} disabled={busyKey === "add" || !draft.label.trim()}>
            <Icon name="plus" size={14} /> Add task
          </button>
        </div>
      )}
      {err && <div className="tk-err">{err}</div>}
      {busy && <div className="tk-busy">Reading the projects' checklists… {busy.done} of {busy.total}</div>}
      {groups.length === 0 && !busy && (
        <div className="dcard tk-empty">{tasks.length ? "Nothing matches this filter." : "No open tasks. Tasks come from each project's stage checklist (Stages and milestones), and you can add one above."}</div>
      )}
      {groups.map((g) => (
        <section key={g.fid} className="dcard tk-group">
          <div className="dcard-h">
            <span className="tk-addr">{splitAddress(g.address)[0]}</span>
            <span className="tk-st">{stageMeta(g.st).label}</span>
            <span className="dcard-r">{g.items.length} open</span>
            <button className="dcard-link" onClick={() => onOpen(g.fid)}>
              Open project <Icon name="chevron" size={14} />
            </button>
          </div>
          <div className="tk-list">
            {g.items.map((t) => {
              const ds = taskDueState(t, today);
              return (
                <div key={t.key} className={"tk-row" + (busyKey === t.key ? " busy" : "")} data-task={t.key}>
                  <input type="checkbox" checked={false} disabled={busyKey === t.key} onChange={() => run(t.key, () => onToggle(t, true))} aria-label={`Done: ${t.label}`} />
                  <div className="tk-main">
                    <span className="tk-l">
                      {isNew(t) && <span className="tk-new">New</span>}
                      {t.label}
                      {t.url && (
                        <a href={t.url} target="_blank" rel="noopener noreferrer" className="ck-link">
                          Open <Icon name="link" size={12} />
                        </a>
                      )}
                    </span>
                    <span className="tk-meta">
                      {TASK_CK_LABEL[t.ck]} checklist{t.carried ? ", still open from that stage" : ""}
                      {t.ut ? " · Utilities" : ""}
                      {t.note ? ` · ${t.note}` : ""}
                    </span>
                  </div>
                  <span className={"tk-due " + ds}>{taskDueLabel(t, today)}</span>
                  {t.dueSet || dueEdit === t.key ? (
                    <input
                      type="date"
                      className="tk-date"
                      autoFocus={dueEdit === t.key && !t.dueSet}
                      value={t.dueSet ? t.due : ""}
                      onChange={(e) => (setDueEdit(null), run(t.key, () => onDue(t, e.target.value)))}
                      onBlur={() => dueEdit === t.key && setDueEdit(null)}
                      aria-label={`Due date: ${t.label}`}
                      title="Change the due date; clear it to remove"
                    />
                  ) : (
                    <button className="tk-setdue" onClick={() => setDueEdit(t.key)} aria-label={`Set a due date: ${t.label}`}>
                      <Icon name="cal" size={13} /> Due date
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {doneShown.length > 0 && (
        <details className="tk-done">
          <summary>Done in the last two weeks ({doneShown.length})</summary>
          {doneShown.map((t) => (
            <div key={t.key} className="tk-row done">
              <input type="checkbox" checked onChange={() => run(t.key, () => onToggle(t, false))} aria-label={`Not done: ${t.label}`} />
              <div className="tk-main">
                <span className="tk-l">{t.label}</span>
                <span className="tk-meta">
                  {splitAddress(t.address)[0]} · {agoLabel(t.doneAt)}
                  {t.by ? `, ${nameOnly(t.by)}` : ""}
                </span>
              </div>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
