// v78: Contacts — the team's directory, a file in the deals folder; deals pick from it and stay in sync with it.
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const pad = (n) => String(n).padStart(2, "0");
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const txn = () => {
  const b = {};
  ["escrow", "recording", "realtor", "transfer", "warranty", "staging", "marketing", "misc"].forEach((k) => (b[k] = { on: false, val: 0 }));
  return b;
};
const deal = (address, contacts) => ({
  address, sqft: 1000, holdMonths: 4, arv: 200000, yearBuilt: 1950, purchase: 110000, repairs: [], useRepairBuilder: false, manualRepair: 30000,
  loanOnPurchasePct: 0.8, loanOnRehabPct: 1, intRatePurchase: 0.12, intRateRehab: 0.12, points: 0, investorAmount: 0, investorAuto: false, investorRate: 0.09,
  analysisDate: day(-60), taxAnnual: 2000, insMonthly: 100, utilGas: 50, utilWater: 50, utilElec: 50, hoaMonthly: 0, miscHold: 0,
  buyTxn: txn(), sellTxn: txn(), actualSale: 0, stage: "rehab", uwBaseline: null, actuals: [],
  mgmt: { closing: { date: day(-30), price: 110000 }, rehab: { startDate: day(-25) }, contacts },
});
const GC = { id: "c1", role: "Contractor", name: "Mauricio Ferrer", company: "Your Choice Remodels LLC", phone: "317-555-0101", email: "yourchoice@example.com" };

(async () => {
  const drive = makeDrive();
  const fa = drive.add("10 Maple St, Indianapolis, IN 46205.json", deal("10 Maple St, Indianapolis, IN 46205", [GC, { id: "c2", role: "Title company", name: "", company: "Chicago Title", phone: "317-555-0200", email: "" }]));
  const fb = drive.add("22 Oak Ave, Indianapolis, IN 46201.json", deal("22 Oak Ave, Indianapolis, IN 46201", [{ ...GC, id: "c9", phone: "" }]));
  const t = await boot({ drive, settings: { clientId: "c", folderId: "f" } });
  const { doc, win, click, btn, setVal, settle, sleep, nav, errors } = t;
  win.confirm = () => true;
  const dirFile = () => Object.values(drive.files).find((f) => f.name === "Deal Breaker contacts.json");
  const dir = () => JSON.parse(dirFile().content).contacts;
  const rows = () => [...doc.querySelectorAll(".ct-list .ct-row")];
  const orphRows = () => [...doc.querySelectorAll(".ct-orph .ct-row")];
  const wait = async () => {
    await sleep(40);
    await settle(10);
  };

  console.log("1. The Contacts screen: nothing in the directory yet, the people on the projects below");
  await click(btn("Connect Google", doc.querySelector(".pf-empty")));
  await wait();
  await click(nav(/^Contacts/));
  await wait();
  assert(doc.querySelector(".ct .pf-title").textContent === "Contacts" && /No contacts yet/.test(doc.querySelector(".ct-list").textContent), "the Contacts screen, with an empty directory");
  assert(orphRows().length === 2, "two people on the projects: the contractor (on both, one row) and the title company");
  const gcRow = orphRows().find((r) => /Mauricio Ferrer/.test(r.textContent));
  assert(gcRow.querySelectorAll(".ct-proj").length === 2 && /317-555-0101/.test(gcRow.textContent), "the contractor shows both projects, and the phone from the one that has it");

  console.log("2. Add all: the directory file is created in the deals folder, and isn't a deal");
  await click(btn("Add all", doc.querySelector(".ct-orph")));
  await wait();
  assert(dirFile() && dir().length === 2 && dir().every((c) => c.id), "the file holds the two contacts");
  assert(rows().length === 2 && !doc.querySelector(".ct-orph"), "both are in the list; nothing left to bring in");
  assert(rows().some((r) => /Chicago Title/.test(r.textContent) && /Title company/.test(r.textContent)), "the title company, with its role");
  assert(nav(/^Active projects/).querySelector("em").textContent === "2" && nav(/^Contacts/).querySelector("em").textContent === "2", "still two deals (the contacts file isn't one); the rail counts two contacts");

  console.log("3. Add a new contact");
  await click(btn(/Add contact/, doc.querySelector(".pf-band")));
  const form = doc.querySelector(".ct-new");
  await setVal(form.querySelector('[aria-label="Role"]'), "Lender");
  await setVal(form.querySelector('[aria-label="Name"]'), "Dana Cole");
  await setVal(form.querySelector('[aria-label="Company"]'), "Bridgeit LLC");
  await setVal(form.querySelector('[aria-label="Email"]'), "not-an-email");
  await click(btn("Save contact", form));
  assert(/doesn't look right/.test(form.textContent) && dir().length === 2, "a bad email is caught before saving");
  await setVal(form.querySelector('[aria-label="Email"]'), "dana@bridgeit.com");
  await setVal(form.querySelector('[aria-label="Phone"]'), "216-555-0300");
  await click(btn("Save contact", form));
  await wait();
  assert(dir().length === 3 && dir().some((c) => c.name === "Dana Cole" && c.role === "Lender" && c.email === "dana@bridgeit.com"), "saved to the file: Dana Cole, lender");
  assert(rows().length === 3 && /Dana Cole added/.test(doc.querySelector(".ct-msg").textContent), "listed, with a confirmation");

  console.log("4. Search and role filter");
  await setVal(doc.querySelector('[aria-label="Search contacts"]'), "bridgeit");
  assert(rows().length === 1 && /Dana Cole/.test(rows()[0].textContent), "search by company");
  await setVal(doc.querySelector('[aria-label="Search contacts"]'), "5550101");
  assert(rows().length === 1 && /Mauricio/.test(rows()[0].textContent), "search by phone digits");
  await setVal(doc.querySelector('[aria-label="Search contacts"]'), "");
  await click(btn(/^Contractor/, doc.querySelector(".ct-bar")));
  assert(rows().length === 1 && /Mauricio/.test(rows()[0].textContent), "the Contractor chip shows the contractor only");
  await click(btn(/^All/, doc.querySelector(".ct-bar")));

  console.log("5. Edit: a new phone number");
  const gcId = dir().find((c) => c.name === "Mauricio Ferrer").id;
  await click(doc.querySelector(`[data-contact="${gcId}"] [aria-label="Edit Mauricio Ferrer"]`));
  const ed = doc.querySelector(".ct-row.editing");
  await setVal(ed.querySelector('[aria-label="Phone"]'), "317-555-0999");
  await click(btn("Save contact", ed));
  await wait();
  assert(dir().find((c) => c.id === gcId).phone === "317-555-0999" && dir().find((c) => c.id === gcId).role === "Contractor" && dir().length === 3, "the file has the new phone; the role is kept");

  console.log("6. Open a project from the contact: its copy takes the new phone and links to the directory");
  const chip = [...doc.querySelector(`[data-contact="${gcId}"]`).querySelectorAll(".ct-proj")].find((b) => /10 Maple/.test(b.textContent));
  await click(chip);
  await wait();
  await sleep(1600); // autosave
  await settle(10);
  const card = () => doc.querySelector(".ov-contacts");
  assert(card() && /317-555-0999/.test(card().textContent) && !/317-555-0101/.test(card().textContent), "the deal's Contacts card shows the new phone");
  const saved = () => JSON.parse(drive.files[fa].content).mgmt.contacts;
  assert(saved().find((c) => c.name === "Mauricio Ferrer").phone === "317-555-0999" && saved().find((c) => c.name === "Mauricio Ferrer").dirId === gcId, "and the deal file is saved with it, linked by id");

  console.log("7. On the deal: pick someone from the team's contacts, or add someone new (who joins the directory)");
  await click(btn("+ Add", card()));
  const pick = card().querySelector('[aria-label="From the team\'s contacts"]');
  assert(pick && [...pick.querySelectorAll("option")].map((o) => o.textContent).join("|") === "From the team's contacts…|Dana Cole, Bridgeit LLC", "the picker offers only who isn't on the deal yet: Dana Cole");
  const danaId = dir().find((c) => c.name === "Dana Cole").id;
  await setVal(pick, danaId);
  assert(/Dana Cole/.test(card().textContent) && !card().querySelector('[aria-label="From the team\'s contacts"]'), "Dana Cole is on the deal");
  await click(btn("+ Add", card()));
  const inputs = [...card().querySelectorAll("input")];
  await setVal(inputs[0], "Sam Ortiz"); // name
  await setVal(inputs[1], "Ortiz Inspections"); // company
  await click(btn("Save contact", card()));
  await wait();
  assert(dir().length === 4 && dir().some((c) => c.name === "Sam Ortiz" && c.company === "Ortiz Inspections"), "Sam Ortiz joined the team's contacts");
  await sleep(1600);
  await settle(10);
  assert(saved().some((c) => c.name === "Dana Cole" && c.dirId === danaId) && saved().some((c) => c.name === "Sam Ortiz" && c.dirId), "the deal saves both, linked to the directory");

  console.log("8. Remove from the directory: the project keeps its copy");
  await click(btn(/All contacts/, card()));
  await wait();
  const samId = dir().find((c) => c.name === "Sam Ortiz").id;
  await click(doc.querySelector(`[data-contact="${samId}"] [aria-label="Remove Sam Ortiz"]`));
  await wait();
  assert(dir().length === 3 && !dir().some((c) => c.name === "Sam Ortiz"), "gone from the file");
  assert(orphRows().some((r) => /Sam Ortiz/.test(r.textContent)), "and listed again under the projects, where he still is");

  console.log("9. Someone else changed the file: the next refresh reads it");
  const f = dirFile();
  const content = JSON.parse(f.content);
  content.contacts = content.contacts.map((c) => (c.name === "Dana Cole" ? { ...c, phone: "216-555-7777" } : c));
  f.content = JSON.stringify(content);
  drive.touch(f.id, "Partner");
  await click(btn(/Add contact/, doc.querySelector(".pf-band")));
  const form2 = doc.querySelector(".ct-new");
  await setVal(form2.querySelector('[aria-label="Name"]'), "Lee Park");
  await click(btn("Save contact", form2));
  await wait();
  assert(dir().length === 4 && dir().find((c) => c.name === "Dana Cole").phone === "216-555-7777", "a save reads the latest file first: the partner's change is kept");

  assert(!errors.filter((e) => !/act\(|Warning/.test(e)).length, "no errors: " + errors.slice(0, 3).join(" | "));
  console.log("\nALL CONTACTS TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
