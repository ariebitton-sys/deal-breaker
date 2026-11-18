const { boot, makeDrive } = require("./harness");
(async()=>{
  const drive=makeDrive();
  const st={address:"77 Old Draft Rd, Cleveland, OH",arv:180000,purchase:90000,holdMonths:4,manualRepair:25000,acquired:false,actuals:[],actualSale:0};
  const t=await boot({drive,settings:{clientId:"c",folderId:"f"},anthropic:async()=>({}),localStorageInit:{kappa_draft_v1:JSON.stringify({state:st,baseline:"x",ts:Date.now()})}});
  const ok=(c,m)=>{if(!c){console.log("FAIL",m);process.exit(1)}console.log("  ✓",m)};
  ok(t.text().includes("Your flip portfolio"),"opens on Portfolio");
  const cur=t.doc.querySelector(".sb-project");
  ok(cur && cur.textContent.includes("77 Old Draft Rd"),"sidebar shows the open draft");
  await t.click(cur);
  ok(t.doc.querySelector('input[placeholder="Property address"]').value===st.address,"v25 draft restored into the deal workspace");
  ok(!!t.btn("Mark under contract"),"v25 draft treated as Analyzing");
  ok(t.errors.length===0,"no errors "+t.errors.join("|"));
  process.exit(0);
})().catch(e=>{console.log(e);process.exit(1)});
