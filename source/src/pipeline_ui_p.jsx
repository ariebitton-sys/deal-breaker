// ---------- Contacts: the team's directory (v78) ----------
// One list for the whole team, kept as a JSON file in the deals folder next to the deal files (and left out of
// the deal list). Each deal still keeps its own copy of the people on it (mgmt.contacts); a copy linked to the
// directory (dirId, or the same email / name and company) takes the directory's details when the deal is open.
const CONTACTS_FILE = "Deal Breaker contacts.json";
const DIR_CACHE_KEY = "kappa_contacts_dir_v1";
const readDirCache = () => {
  try {
    const o = JSON.parse(localStorage.getItem(DIR_CACHE_KEY) || "null");
    return o && Array.isArray(o.contacts) ? o : null;
  } catch (e) {
    return null;
  }
};
const writeDirCache = (d) => {
  try {
    localStorage.setItem(DIR_CACHE_KEY, JSON.stringify(d));
  } catch (e) {}
};
const ctNorm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const ctDigits = (s) => String(s || "").replace(/\D/g, "");
// The same contact: the same email when both have one; else the same phone; else the same name and company,
// where a contact with only one of the two ("Your Choice Remodels LLC") matches a person at that company.
const ctMatch = (a, b) => {
  if (!a || !b) return false;
  const ea = ctNorm(a.email),
    eb = ctNorm(b.email);
  if (ea && eb) return ea === eb;
  const pa = ctDigits(a.phone),
    pb = ctDigits(b.phone);
  if (pa.length >= 7 && pb.length >= 7 && pa === pb) return true;
  const na = ctNorm(a.name),
    nb = ctNorm(b.name),
    ca = ctNorm(a.company),
    cb = ctNorm(b.company);
  if (!(na || ca) || !(nb || cb)) return false;
  if (na === nb && ca === cb) return true;
  const one = (n, c) => (n && c ? "" : n || c); // the single label of a contact with a name or a company only
  const oa = one(na, ca),
    ob = one(nb, cb);
  if (oa && !ob) return oa === cb || oa === nb;
  if (ob && !oa) return ob === ca || ob === na;
  return false;
};
const ctLabel = (c) => c.name || c.company || c.email || c.phone || "Unnamed";
const ctInitials = (c) =>
  (ctLabel(c)
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("") || "?").toUpperCase();
const CT_FIELDS = ["name", "company", "phone", "email"];
// A deal's contacts brought up to date from the directory; null when nothing changes.
// The directory wins where it has a value; a blank there keeps what the deal has.
function syncDealContacts(list, dir) {
  if (!Array.isArray(list) || !list.length || !Array.isArray(dir) || !dir.length) return null;
  let changed = false;
  const out = list.map((c) => {
    const d = (c.dirId && dir.find((x) => x.id === c.dirId)) || dir.find((x) => ctMatch(x, c));
    if (!d) return c;
    const n = { ...c, dirId: d.id };
    CT_FIELDS.forEach((k) => (n[k] = d[k] || c[k] || ""));
    if (n.dirId !== c.dirId || CT_FIELDS.some((k) => (n[k] || "") !== (c[k] || ""))) {
      changed = true;
      return n;
    }
    return c;
  });
  return changed ? out : null;
}
// The role's color, as in the rest of the app
const CT_TONE = {
  Contractor: "amber",
  "Title company": "blue",
  Lender: "orange",
  "Seller's agent": "violet",
  "Listing agent": "violet",
  "Buyer's agent": "violet",
  Inspector: "teal",
  Insurance: "green",
  Investor: "green",
};
const ctTone = (role) => CT_TONE[role] || "gray";
const CT_BLANK = { role: "Contractor", name: "", company: "", phone: "", email: "", notes: "" };
const ctEmailOk = (s) => !String(s || "").trim() || /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(String(s).trim());

function ContactForm({ value, onSave, onCancel, busy, title }) {
  const [d, setD] = useState(() => ({ ...CT_BLANK, ...(value || {}) }));
  const [err, setErr] = useState("");
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const save = () => {
    if (!d.name.trim() && !d.company.trim()) return setErr("Enter a name or a company.");
    if (!ctEmailOk(d.email)) return setErr("That email doesn't look right.");
    setErr("");
    const clean = {};
    Object.keys(CT_BLANK).forEach((k) => (clean[k] = String(d[k] || "").trim()));
    onSave(clean);
  };
  const key = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") onCancel();
  };
  return (
    <div className="ct-form" onKeyDown={key}>
      {title && <div className="ct-form-t">{title}</div>}
      <div className="ct-form-g">
        <label>
          Role
          <select value={d.role} onChange={set("role")} aria-label="Role">
            {CONTACT_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input value={d.name} onChange={set("name")} placeholder="Mauricio Ferrer" aria-label="Name" autoFocus />
        </label>
        <label>
          Company
          <input value={d.company} onChange={set("company")} placeholder="Your Choice Remodels LLC" aria-label="Company" />
        </label>
        <label>
          Phone
          <input value={d.phone} onChange={set("phone")} placeholder="317-555-0100" aria-label="Phone" inputMode="tel" />
        </label>
        <label>
          Email
          <input value={d.email} onChange={set("email")} placeholder="name@company.com" aria-label="Email" inputMode="email" />
        </label>
        <label className="wide">
          Notes
          <input value={d.notes} onChange={set("notes")} placeholder="Trade, license, how we work with them…" aria-label="Notes" />
        </label>
      </div>
      <div className="ct-form-f">
        {err && <span className="ct-err">{err}</span>}
        <button className="ct-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="ct-btn primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save contact"}
        </button>
      </div>
    </div>
  );
}

// The Contacts screen. `projects`: [{ fid, address, st, contacts }] from the cross-project index (the open deal live).
function ContactsScreen({ directory, projects, busy, connected, onSave, onOpenProject, onConnect }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [form, setForm] = useState(null); // null | "new" | contact id
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const list = (directory && directory.contacts) || [];
  const say = (t) => {
    setMsg(t);
    if (t && !/^Couldn't/.test(t)) setTimeout(() => setMsg((m) => (m === t ? "" : m)), 3000);
  };
  // where each directory contact appears, and the people on projects the directory doesn't have yet
  const onProjects = (c) => projects.filter((p) => p.contacts.some((x) => (x.dirId && x.dirId === c.id) || ctMatch(x, c)));
  const orphans = [];
  projects.forEach((p) =>
    p.contacts.forEach((x) => {
      if (!(x.name || x.company)) return;
      if (list.some((c) => (x.dirId && x.dirId === c.id) || ctMatch(x, c))) return;
      const o = orphans.find((y) => ctMatch(y.c, x));
      if (o) {
        if (!o.projects.some((pp) => pp.fid === p.fid)) o.projects.push(p);
        CT_FIELDS.forEach((k) => (o.c[k] = o.c[k] || x[k] || ""));
      } else orphans.push({ c: { ...CT_BLANK, role: x.role || "Other", name: x.name || "", company: x.company || "", phone: x.phone || "", email: x.email || "" }, projects: [p] });
    }),
  );
  const counts = {};
  list.forEach((c) => (counts[c.role || "Other"] = (counts[c.role || "Other"] || 0) + 1));
  const roles = CONTACT_ROLES.filter((r) => counts[r]);
  const qq = ctNorm(q);
  const shown = list
    .filter((c) => role === "all" || (c.role || "Other") === role)
    .filter((c) => !qq || [c.name, c.company, c.email, c.phone, c.role, c.notes].some((v) => ctNorm(v).includes(qq)) || (ctDigits(q).length >= 3 && ctDigits(c.phone).includes(ctDigits(q))))
    .sort((a, b) => ctLabel(a).localeCompare(ctLabel(b)));
  const run = async (fn, done) => {
    setSaving(true);
    try {
      await onSave(fn);
      setForm(null);
      if (done) say(done);
    } catch (e) {
      say("Couldn't save the contacts: " + e.message);
    }
    setSaving(false);
  };
  const stamp = () => new Date().toISOString();
  const addNew = (c) => run((cur) => [...cur, { ...c, id: uid(), addedAt: stamp() }], `${ctLabel(c)} added`);
  const update = (id, c) => run((cur) => cur.map((x) => (x.id === id ? { ...x, ...c, updatedAt: stamp() } : x)), `${ctLabel(c)} updated`);
  const remove = (c) => {
    const n = onProjects(c).length;
    if (!window.confirm(`Remove ${ctLabel(c)} from the team's contacts?${n ? ` The ${n === 1 ? "project keeps its" : `${n} projects keep their`} copy.` : ""}`)) return;
    run((cur) => cur.filter((x) => x.id !== c.id), `${ctLabel(c)} removed`);
  };
  const addOrphans = (os) =>
    run(
      (cur) => [...cur, ...os.filter((o) => !cur.some((x) => ctMatch(x, o.c))).map((o) => ({ ...o.c, id: uid(), addedAt: stamp() }))],
      os.length === 1 ? `${ctLabel(os[0].c)} added` : `${os.length} contacts added`,
    );
  const chips = (ps) => (
    <span className="ct-projs">
      {ps.map((p) => (
        <button key={p.fid} className="ct-proj" style={stageVars(p.st)} onClick={() => onOpenProject(p.fid)} title={`Open ${p.address}`}>
          {splitAddress(p.address)[0]}
        </button>
      ))}
    </span>
  );
  const sub = "Contractors, title companies, lenders, agents and everyone else Kappa works with. Shared with the team through the deals folder.";
  if (!connected)
    return (
      <div className="ct">
        <DashHead title="Contacts" sub={sub} />
        <section className="dcard ct-empty">
          <b>Connect Google to see the team's contacts.</b>
          <span>The list is kept in the deals folder, so everyone on the team works from the same one.</span>
          {onConnect && (
            <button className="ct-btn primary" onClick={onConnect}>
              Connect Google
            </button>
          )}
        </section>
      </div>
    );
  return (
    <div className="ct">
      <DashHead
        title="Contacts"
        sub={sub}
        right={
          <button className="band-btn primary" onClick={() => setForm("new")} disabled={saving}>
            <Icon name="plus" size={15} /> Add contact
          </button>
        }
      />
      {msg && <div className={"ct-msg" + (/^Couldn't/.test(msg) ? " bad" : "")}>{msg}</div>}
      {form === "new" && (
        <section className="dcard ct-new">
          <ContactForm title="New contact" onSave={addNew} onCancel={() => setForm(null)} busy={saving} />
        </section>
      )}
      <div className="ct-bar">
        <div className="lg-chips" role="group" aria-label="Role">
          <button className={"lg-chip" + (role === "all" ? " on" : "")} onClick={() => setRole("all")} aria-pressed={role === "all"}>
            All <em>{list.length}</em>
          </button>
          {roles.map((r) => (
            <button key={r} className={"lg-chip" + (role === r ? " on" : "")} onClick={() => setRole(r)} aria-pressed={role === r}>
              {r} <em>{counts[r]}</em>
            </button>
          ))}
        </div>
        <span className="pf-search ct-search">
          <Icon name="search" size={15} />
          <input placeholder="Search name, company, phone, email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
        </span>
      </div>
      <section className="dcard ct-list">
        <div className="dcard-h">
          <span className="dp-ico t-teal">
            <Icon name="users" size={18} stroke={2} />
          </span>
          Team contacts
          <span className="dcard-r">{shown.length === list.length ? `${list.length} ${list.length === 1 ? "contact" : "contacts"}` : `${shown.length} of ${list.length}`}</span>
        </div>
        {list.length === 0 ? (
          <div className="ct-none">
            No contacts yet. Add the people you work with{orphans.length ? ", or bring in the ones already on your projects below" : ""}.
          </div>
        ) : shown.length === 0 ? (
          <div className="ct-none">No contact matches that search.</div>
        ) : (
          <div className="ct-rows">
            {shown.map((c) =>
              form === c.id ? (
                <div key={c.id} className="ct-row editing">
                  <ContactForm value={c} title={`Edit ${ctLabel(c)}`} onSave={(v) => update(c.id, v)} onCancel={() => setForm(null)} busy={saving} />
                </div>
              ) : (
                <div key={c.id} className="ct-row" data-contact={c.id}>
                  <span className={"ct-av t-" + ctTone(c.role)}>{ctInitials(c)}</span>
                  <div className="ct-who">
                    <b>{c.name || c.company}</b>
                    {c.name && c.company && <span>{c.company}</span>}
                    {c.notes && <em>{c.notes}</em>}
                  </div>
                  <span className={"ct-role t-" + ctTone(c.role)}>{c.role || "Other"}</span>
                  <div className="ct-reach">
                    {c.phone && (
                      <a href={`tel:${c.phone}`}>
                        <Icon name="phone" size={13} /> {c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`}>
                        <Icon name="mail" size={13} /> {c.email}
                      </a>
                    )}
                  </div>
                  {chips(onProjects(c))}
                  <span className="ct-acts">
                    <button className="ct-ib" onClick={() => setForm(c.id)} title="Edit" aria-label={`Edit ${ctLabel(c)}`} disabled={saving}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="ct-ib del" onClick={() => remove(c)} title="Remove from the team's contacts" aria-label={`Remove ${ctLabel(c)}`} disabled={saving}>
                      <Icon name="x" size={14} />
                    </button>
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </section>
      {(orphans.length > 0 || busy) && (
        <section className="dcard ct-orph">
          <div className="dcard-h">
            <span className="dp-ico t-amber">
              <Icon name="briefcase" size={18} stroke={2} />
            </span>
            On projects, not in the directory
            <span className="dcard-r">{busy ? `Reading the projects… ${busy.done} of ${busy.total}` : `${orphans.length}`}</span>
            {orphans.length > 1 && (
              <button className="dcard-link" onClick={() => addOrphans(orphans)} disabled={saving}>
                Add all
              </button>
            )}
          </div>
          <div className="ct-rows">
            {orphans.map((o, i) => (
              <div key={i} className="ct-row orphan">
                <span className={"ct-av t-" + ctTone(o.c.role)}>{ctInitials(o.c)}</span>
                <div className="ct-who">
                  <b>{o.c.name || o.c.company}</b>
                  {o.c.name && o.c.company && <span>{o.c.company}</span>}
                </div>
                <span className={"ct-role t-" + ctTone(o.c.role)}>{o.c.role}</span>
                <div className="ct-reach">
                  {o.c.phone && <span>{o.c.phone}</span>}
                  {o.c.email && <span>{o.c.email}</span>}
                </div>
                {chips(o.projects)}
                <span className="ct-acts">
                  <button className="ct-btn" onClick={() => addOrphans([o])} disabled={saving}>
                    Add
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
