const fs=require("fs"),vm=require("vm"),babel=require("@babel/core");
const compile=(src)=>babel.transformSync(src,{babelrc:false,configFile:false,sourceType:"script",presets:[["@babel/preset-react",{runtime:"classic"}]]}).code;
const ctxOf=(file)=>{const src=fs.readFileSync(file,"utf8");const cut=src.indexOf("function App()");const c={React:{useState(){},useMemo(){},useEffect(){},useRef(){},createElement(){},Fragment:"F"},window:{},localStorage:{getItem:()=>null,setItem(){}},console};vm.createContext(c);vm.runInContext(compile(src.slice(0,cut))+";this.__x={calcDeal,solvePurchaseFor,typeof_gradeDeal:typeof gradeDeal,dTxn,T};",c);return c;};
const v25=ctxOf(__dirname + "/reference_v25.jsx").__x; // original v25 source (decompiled)
const C=ctxOf(__dirname + "/../dist/app.jsx"); const v26=C.__x;
vm.runInContext("this.__y={gradeDeal,summarizeDeal,summaryToProps,propsToSummary,attentionFor,inputsFromState,stmtLinesForSide,stmtPriceForSide,makeUwSnapshot,milestonePct,monthsBetween};",C); const Y=C.__y;
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;}else{fail++;console.log("FAIL:",m);}};
const near=(a,b,e=0.005)=>Math.abs(a-b)<=e;
// 1. regression: random deals, points = 0 → identical numbers to v25
const rnd=(a,b)=>a+Math.random()*(b-a);
for(let k=0;k<500;k++){
  const i={purchase:rnd(30e3,400e3),repair:rnd(0,200e3),holdMonths:Math.round(rnd(1,12)),arv:rnd(60e3,700e3),points:0,loanOnPurchasePct:rnd(0,.9),loanOnRehabPct:rnd(0,1),intRatePurchase:rnd(.08,.2),intRateRehab:rnd(.08,.2),investorAuto:Math.random()<.7,investorAmount:rnd(0,80e3),investorRate:.09,taxAnnual:rnd(0,5e3),insMonthly:120,utilGas:75,utilWater:75,utilElec:50,hoaMonthly:0,miscHold:rnd(0,200),
   buyTxn:v26.dTxn({escrow:{on:true,val:1200},transfer:{on:true,val:.45},realtor:{on:Math.random()<.3,val:rnd(0,3000)}}),sellTxn:v26.dTxn({escrow:{on:true,val:1500},realtor:{on:true,val:6},transfer:{on:true,val:.4},staging:{on:true,val:1500}}),sqft:1200};
  const a=v25.calcDeal(i),b=v26.calcDeal({...i,rehabFunding:"internal"});
  ["netProfit","totalCosts","interest","investorAmount","totalFinancing","roi","cashIn","totalBuying","totalSelling","totalHolding"].forEach(f=>ok(near(a[f],b[f],1e-6)||(isNaN(a[f])&&isNaN(b[f])),`regression ${f} ${a[f]} vs ${b[f]}`));
  // MAO identical
  ok(v25.solvePurchaseFor(i,30000)===v26.solvePurchaseFor({...i,rehabFunding:"internal"},30000),"MAO regression");
}
// 2. points now funded by investor (auto): investor amount rises by points; profit falls by points*rate
{const i={purchase:100e3,repair:40e3,holdMonths:5,arv:200e3,points:2000,loanOnPurchasePct:.8,loanOnRehabPct:1,intRatePurchase:.18,intRateRehab:.16,investorAuto:true,investorRate:.09,taxAnnual:0,insMonthly:120,utilGas:75,utilWater:75,utilElec:50,hoaMonthly:0,miscHold:0,buyTxn:v26.dTxn({escrow:{on:true,val:1200},transfer:{on:true,val:.45}}),sellTxn:v26.dTxn({escrow:{on:true,val:1500},realtor:{on:true,val:6},transfer:{on:true,val:.4},staging:{on:true,val:1500}})};
 const a=v25.calcDeal(i),b=v26.calcDeal(i);
 ok(near(b.investorAmount,a.investorAmount+2000),"investor gap includes lender fees");
 ok(near(b.netProfit,a.netProfit-180),"net profit -$180 (9% on $2,000)");
 ok(near(b.cashIn,a.cashIn-2000),"Kappa cash-in no longer includes points (investor pays them)");
 ok(near(b.netProfit,28154.8333,0.01),"sample net profit 28,154.83");
// 3. draws
 const d=v26.calcDeal({...i,rehabFunding:"draws",drawCount:4,drawMonths:3,drawFee:150});
 ok(near(d.rehabMonthsOutstanding,3.125),"draws: avg months outstanding 3.125");
 ok(near(d.interestRehab,40000*.16/12*3.125),"draws: rehab interest = 1,666.67");
 const explicit=[0.75,1.5,2.25,3].reduce((s,t)=>s+10000*.16/12*(5-t),0);
 ok(near(d.interestRehab,explicit),"draws: matches explicit per-draw sum");
 ok(near(d.drawFees,600),"draws: 4 x $150 fees");
 ok(near(d.totalFinancing,b.totalFinancing-(b.interestRehab-d.interestRehab)+600),"draws: financing = internal - interest saved + fees");
 const d1=v26.calcDeal({...i,rehabFunding:"draws",drawCount:1,drawMonths:0});
 ok(near(d1.interestRehab,b.interestRehab),"draws: 1 draw at day 0 equals internal loan");
 const d9=v26.calcDeal({...i,rehabFunding:"draws",drawCount:4,drawMonths:9});
 ok(near(d9.rehabMonthsOutstanding,5-5*5/8),"draws: rehab period capped at hold time");
}
// 4. grading
ok(Y.gradeDeal({repair:40000,holdMonths:0,netProfit:50000,purchase:1,arv:1}).incomplete,"hold 0 → not graded");
const g=Y.gradeDeal({repair:40000,holdMonths:5,netProfit:28154.83,purchase:100000,arv:200000});
ok(g.grade==="C"&&g.riskLevel===3,`sample grade C risk 3 (70% of $40k) (got ${g.grade} r${g.riskLevel})`);
ok(Y.gradeDeal({repair:10000,holdMonths:2,netProfit:25000,purchase:100000,arv:200000}).grade==="A","speed bonus: 25k/20k=125% → A-, +1 → A");
// 5. summary encode/decode incl. unicode
const st={address:"12 Café Ln, Ohio",arv:200000,purchase:100000,holdMonths:5,manualRepair:40000,stage:"rehab",mgmt:{source:"Wholesaler — ‘Mike’",rehab:{startDate:"2026-11-01",targetEnd:"2027-02-01",milestones:[{id:1,label:"x",status:"done"},{id:2,label:"y",status:"doing"}]}},actuals:[{cat:"Rehab / Construction",amount:12000}],savedAt:"2026-11-17T00:00:00Z"};
const sum=Y.summarizeDeal(st); const props=Y.summaryToProps(sum,true);
ok(Object.entries(props).every(([k,v])=>Buffer.byteLength(k+(v||""))<=124),"props within 124 bytes");
ok(Object.keys(props).length<=30,"≤ 30 props");
ok(JSON.stringify(Y.propsToSummary(props))===JSON.stringify(sum),"summary roundtrip with unicode");
ok(sum.mp===75&&sum.rsp===12000&&sum.st==="rehab","summary fields");
// big summary still fits
const big={...st,mgmt:{...st.mgmt,offers:[{amount:1,status:"Countered"}],contract:{date:"2026-01-01",price:123456,expectedClosing:"2026-02-01",inspectionEnd:"2026-01-10",emd:5000},closing:{date:"2026-02-01",price:123456},listing:{date:"2026-05-01",price:250000,prices:[{date:"2026-05-01",price:260000}]},buyer:{date:"2026-06-01",price:245000,expectedClosing:"2026-07-01"},sale:{date:"2026-07-01"},dead:{reason:"Financing fell through",date:"2026-07-02",fromStage:"market"}},uwBaseline:{m:{netProfit:30000,repair:40000},grade:"B+"},actualSale:250000};
const bp=Y.summaryToProps(Y.summarizeDeal(big),false); ok(bp && Object.keys(bp).length<=26,"full summary fits ("+(bp?bp.sn:"null")+" chunks)");
// 6. attention
const A=(s)=>Y.attentionFor(s,"2026-11-17").map(a=>a.text).join("|");
ok(/Closing in 3 days/.test(A({st:"contract",ecd:"2026-11-20"})),"closing soon");
ok(/passed 2 days/.test(A({st:"contract",ecd:"2026-11-15"})),"closing overdue");
ok(/over budget by 25%/.test(A({st:"rehab",rb:40000,rsp:50000})),"over budget");
ok(/Spent 75% of budget, work 30% done/.test(A({st:"rehab",rb:40000,rsp:30000,mp:30})),"spend ahead of work");
ok(/45 days on market/.test(A({st:"market",ld:"2026-10-03"})),"DOM");
ok(/No update in 20 days/.test(A({st:"rehab",lu:"2026-10-28",rb:1,rsp:0})),"stale");
ok(A({st:"analyzing",lu:"2026-01-01"})==="","no attention for analyzing");
// 7. statement mapping
const out={price:98000,lines:[{description:"Price",category:"price",buyer_debit:98000,buyer_credit:0,seller_debit:0,seller_credit:98000},{description:"Commission",category:"commission",buyer_debit:0,buyer_credit:0,seller_debit:11760,seller_credit:0},{description:"Taxes",category:"tax_proration",buyer_debit:0,buyer_credit:900,seller_debit:900,seller_credit:0},{description:"Payoff",category:"payoff",buyer_debit:0,buyer_credit:0,seller_debit:60000,seller_credit:0},{description:"Inspection",category:"inspection",buyer_debit:450,buyer_credit:0,seller_debit:0,seller_credit:0}]};
const sl=Y.stmtLinesForSide(out,"sell"); const bl=Y.stmtLinesForSide(out,"buy");
ok(Y.stmtPriceForSide(out,"sell")===98000&&Y.stmtPriceForSide(out,"buy")===98000,"price both sides");
ok(sl.find(l=>l.description==="Commission").target==="txn:realtor"&&sl.find(l=>l.description==="Payoff").include===false,"sell: commission→realtor, payoff skipped");
ok(sl.find(l=>l.description==="Taxes").amount===900&&bl.find(l=>l.description==="Taxes").amount===-900,"tax proration: seller cost / buyer credit");
ok(bl.find(l=>l.description==="Inspection").target==="txn:staging"&&!sl.find(l=>l.description==="Inspection"),"buy inspections → Inspections row");
vm.runInContext("this.__z={driveIdFromLink,checkDocSize,extractSowShape:typeof extractSow,stmtLinesForSide};",C); const Z=C.__z;
ok(Z.driveIdFromLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing")==="1AbCdEfGhIjKlMnOpQrStUv","drive file link");
ok(Z.driveIdFromLink("https://docs.google.com/document/d/1ZyXwVuTsRqPoNmLkJiHgFe/edit")==="1ZyXwVuTsRqPoNmLkJiHgFe","google doc link");
ok(Z.driveIdFromLink("https://drive.google.com/open?id=1QwErTyUiOpAsDfGhJkLzXc")==="1QwErTyUiOpAsDfGhJkLzXc","open?id link");
ok(Z.driveIdFromLink("hello world")===null,"non-link rejected");
const thr=(f)=>{try{f();return null}catch(e){return e.message}};
ok(thr(()=>Z.checkDocSize("application/pdf",23*1048576,"a"))===null,"23MB pdf ok");
ok(/24 MB/.test(thr(()=>Z.checkDocSize("application/pdf",25*1048576,"a"))),"25MB pdf rejected");
ok(/5 MB/.test(thr(()=>Z.checkDocSize("image/jpeg",6*1048576,"a"))),"6MB image rejected");
ok(/unsupported|image\/heic/.test(thr(()=>Z.checkDocSize("image/heic",1000,"a"))),"HEIC rejected with message");
vm.runInContext("this.__w={milestonePct};",C);
ok(C.__w.milestonePct([{status:"done",budget:9000},{status:"todo",budget:1000}])===90,"budget-weighted % (90)");
ok(C.__w.milestonePct([{status:"done",budget:9000},{status:"todo"}])===50,"mixed budgets → equal weights (50)");
ok(C.__w.milestonePct([{status:"doing",budget:4000},{status:"done",budget:6000}])===80,"in-progress counts half (80)");
console.log(`calc tests: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
