// Team access: a Kappa member only connects Google. The Client ID is built in; the deals folder and the
// Maps / Anthropic keys come from the team settings file in the deals folder.
const { boot, makeDrive } = require("./harness");
const assert = (c, msg) => {
  if (!c) throw new Error("ASSERT: " + msg);
  console.log("  ✓ " + msg);
};
const KAPPA_CID = "297783038765-bhfkd9b5ik3phs5pi1r4kdv8mqcpqj3o.apps.googleusercontent.com";
const TEAM = "Deal Breaker team settings.json";
const AI1 = "sk-ant-api03-" + "a".repeat(90);
const AI2 = "sk-ant-api03-" + "b".repeat(90);
const deal = (address) => ({ address, stage: "analyzing", purchase: 100000, arv: 200000, holdMonths: 4, manualRepair: 30000, actuals: [] });
(async () => {
  const drive = makeDrive();
  drive.add("100 Alpha St, Cleveland, OH 44102.json", deal("100 Alpha St, Cleveland, OH 44102"), { parents: ["kappa"] });
  drive.add("200 Beta Ave, Cleveland, OH 44103.json", deal("200 Beta Ave, Cleveland, OH 44103"), { parents: ["kappa"] });
  const rows = (t) => [...t.doc.querySelectorAll("tr.dt-row")].map((r) => r.textContent);
  const ls = (t) => JSON.parse(t.win.localStorage.getItem("kappa_settings") || "{}");
  const teamFile = () => Object.values(drive.files).find((f) => f.name === TEAM);
  const openSettings = async (t) => {
    await t.click(t.doc.querySelector(".sidebar .sb-link[data-no-autoconnect]"));
    await t.settle(4);
    return t.doc.querySelector(".set-team");
  };
  const saveSettings = async (t) => {
    await t.click(t.btn("Save settings"));
    await t.sleep(40);
    await t.settle(10);
  };

  console.log("1. Arie shares his keys with the team");
  let t = await boot({ drive, settings: { folderId: "kappa", anthropicKey: AI1, mapsApiKey: "AIzaMAPS1" } });
  await t.click(t.btn("Connect Google", t.doc.querySelector(".pf-empty")));
  await t.sleep(40); await t.settle(10);
  assert(rows(t).length === 2, "connected with the built-in Client ID; two deals listed");
  let box = await openSettings(t);
  assert(box && /Share the Maps and Anthropic keys with the team/.test(box.textContent) && box.querySelector("input[type=checkbox]").checked, "Settings: team box offers to share (ticked)");
  assert(t.doc.querySelector("details.set-conn") && !t.doc.querySelector("details.set-conn").open, "Google connection folded away (built in)");
  await saveSettings(t);
  let tf = teamFile();
  let tc = tf && JSON.parse(tf.content);
  assert(tc && tc.anthropicKey === AI1 && tc.mapsApiKey === "AIzaMAPS1" && tc.folderId === "kappa" && tf.parents[0] === "kappa", "team file written in the deals folder with both keys");
  assert(/Keys shared with the Kappa team/.test(t.text()), "confirmation shown");
  await t.click([...t.doc.querySelectorAll(".sidebar button")].find((b) => /^Overview/.test(b.textContent.trim())) || t.doc.body);
  assert(rows(t).length === 2 && !rows(t).some((r) => /team settings/i.test(r)), "the team file isn't listed as a deal");
  box = await openSettings(t);
  assert(/Shared with the team/.test(box.textContent) && /The team uses these keys/.test(box.textContent), "Settings now says the team uses these keys");
  await t.click(t.btn("Cancel"));
  await t.settle(4);
  assert(t.errors.length === 0, "no errors " + t.errors.join(" | "));
  t.win.close();

  console.log("2. A new member: nothing typed, only Connect Google");
  t = await boot({ drive, settings: {} });
  const empty = t.doc.querySelector(".pf-empty");
  assert(empty && t.btn("Connect Google", empty) && !/Open settings/.test(empty.textContent), "first visit offers Connect Google, not Settings");
  await t.click(t.btn("Connect Google", empty));
  await t.sleep(80); await t.settle(12);
  let s = ls(t);
  assert(s.clientId === KAPPA_CID && s.folderId === "kappa", "deals folder found through the team file");
  assert(s.anthropicKey === AI1 && s.mapsApiKey === "AIzaMAPS1", "Maps and Anthropic keys loaded");
  assert(rows(t).length === 2, "the team's deals are listed");
  assert(/Kappa team settings loaded/.test(t.text()), "confirmation shown");
  const memberStore = { ...Object.fromEntries(Object.keys(t.win.localStorage).map((k) => [k, t.win.localStorage.getItem(k)])) };
  assert(t.errors.length === 0, "no errors " + t.errors.join(" | "));
  t.win.close();

  console.log("3. Arie replaces the Anthropic key: the member gets it on the next visit; a key the member typed stays theirs");
  t = await boot({ drive, settings: { folderId: "kappa", anthropicKey: AI1, mapsApiKey: "AIzaMAPS1", teamKeys: { anthropicKey: AI1, mapsApiKey: "AIzaMAPS1" }, teamSync: teamFile().modifiedTime } });
  await t.click(t.btn("Connect Google", t.doc.querySelector(".pf-empty")));
  await t.sleep(40); await t.settle(10);
  box = await openSettings(t);
  await t.setVal(t.doc.querySelector('input[name="anthropic-api-key"]'), AI2);
  box = t.doc.querySelector(".set-team");
  assert(/Update the team's keys with these/.test(box.textContent) && box.querySelector("input[type=checkbox]").checked, "changed key → offer to update the team (ticked)");
  await saveSettings(t);
  assert(JSON.parse(teamFile().content).anthropicKey === AI2, "team file updated");
  t.win.close();
  const ms = JSON.parse(memberStore.kappa_settings);
  ms.mapsApiKey = "AIzaMINE"; // the member typed their own Maps key
  memberStore.kappa_settings = JSON.stringify(ms);
  delete memberStore.kappa_settings;
  t = await boot({ drive, settings: ms, localStorageInit: memberStore });
  await t.sleep(60); await t.settle(12);
  s = ls(t);
  assert(s.anthropicKey === AI2, "member's Anthropic key follows the team's new one");
  assert(s.mapsApiKey === "AIzaMINE", "member's own Maps key kept");
  assert(/Team keys updated/.test(t.text()), "member told the keys were updated");
  t.win.close();

  console.log("4. Folder not shared yet: a clear message and Try again");
  const d2 = makeDrive();
  d2.add("300 Gamma Rd, Cleveland, OH 44104.json", deal("300 Gamma Rd, Cleveland, OH 44104"), { parents: ["kappa"] });
  t = await boot({ drive: d2, settings: {} });
  await t.click(t.btn("Connect Google", t.doc.querySelector(".pf-empty")));
  await t.sleep(60); await t.settle(10);
  assert(/Kappa's deals folder wasn't found/.test(t.text()) && /arie@kappainv\.com/.test(t.text()) && t.btn("Try again"), "not found → names the account and offers Try again");
  d2.add(TEAM, { kind: "deal-breaker-team-settings", v: 1, folderId: "kappa", anthropicKey: AI1, mapsApiKey: "AIzaMAPS1" }, { parents: ["kappa"], appProperties: { dbTeam: "1" } });
  await t.click(t.btn("Try again"));
  await t.sleep(60); await t.settle(12);
  assert(rows(t).length === 1 && ls(t).folderId === "kappa", "after Arie shares → Try again loads the deals");
  assert(t.errors.length === 0, "no errors " + t.errors.join(" | "));
  t.win.close();

  console.log("\nALL TEAM TESTS PASSED");
  process.exit(0);
})().catch((e) => {
  console.log("FAILED:", e);
  process.exit(1);
});
