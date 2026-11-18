const { boot, makeDrive } = require("./harness");
(async()=>{
  const drive=makeDrive();
  const GOOD="sk-ant-api03-"+"A1b2C3d4E5f6G7h8".repeat(6)+"-xyzAA";
  const seen=[];
  const anthropic=async(body,opts)=>{seen.push(opts.headers["x-api-key"]);return {ok:false,status:401,json:async()=>({error:{message:"invalid x-api-key"}})};};
  const t=await boot({drive,settings:{clientId:"c",folderId:"f"},anthropic});
  // models endpoint is GET → goes through anthropic mock only for POST? route all api.anthropic.com
  t.win.fetch=(orig=>async(url,opts={})=>{ if(String(url).includes("/v1/models")){ seen.push(opts.headers["x-api-key"]); return {ok:opts.headers["x-api-key"]===GOOD,status:opts.headers["x-api-key"]===GOOD?200:401,json:async()=>({error:{message:"invalid x-api-key"}})}; } return orig(url,opts);})(t.win.fetch);
  const ok=(c,m)=>{if(!c){console.log("FAIL",m);process.exit(1)}console.log("  ✓",m)};
  await t.click(t.btn(/^\s*Settings$/));
  const inp=t.doc.querySelector('input[name="anthropic-api-key"]');
  await t.setVal(inp,"sk-ant-api03-AbCd...wxyz"); // shortened copy from the keys list
  ok(/doesn't look like a full key/.test(t.text()),"shortened key flagged");
  await t.click(t.btn("Test key")); await t.sleep(20); await t.settle();
  ok(/Rejected \(401\)/.test(t.text()),"test shows 401 explanation");
  await t.setVal(inp,'  "'+GOOD.slice(0,30)+"​"+GOOD.slice(30)+'"\n ');
  ok(!/doesn.t look like a full key/.test(t.text()) && t.text().includes("characters"),"pasted key with quotes/zero-width/newline cleaned");
  await t.click(t.btn("Test key")); await t.sleep(20); await t.settle();
  ok(seen[seen.length-1]===GOOD,"cleaned key sent");
  ok(/Key works/.test(t.text()),"test shows key works");
  await t.click(t.btn("Save settings")); await t.settle();
  ok(JSON.parse(t.win.localStorage.getItem("kappa_settings")).anthropicKey===GOOD,"clean key saved");
  ok(t.errors.length===0,"no errors "+t.errors.join("|"));
  process.exit(0);
})().catch(e=>{console.log(e);process.exit(1)});
