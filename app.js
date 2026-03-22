// ── FIREBASE ──────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey:"AIzaSyA7BoxdHTTbQyPQZEPje8c_IaaInbJUe8w",authDomain:"my-portal-fd675.firebaseapp.com",
  projectId:"my-portal-fd675",storageBucket:"my-portal-fd675.firebasestorage.app",
  messagingSenderId:"901831637749",appId:"1:901831637749:web:fa93c3208fff016036e3bc"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const DOC_ID = "finance";

const LS = {
  g: k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}},
  gA:k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}},
  s:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
};

async function loadFromFirebase() {
  try {
    const snap = await getDoc(doc(db,"portals",DOC_ID));
    if (snap.exists()) {
      const d = snap.data();
      overview    = d.overview    || {income:0,saveTarget:0};
      budget      = d.budget      || [];
      months      = d.months      || [];
      principles  = d.principles  || [];
      banks       = d.banks       || [];
      mmIncome    = d.mmIncome    || {salary:0,autosave:0,autoinvest:0};
      invMonthly  = d.invMonthly  || 0;
      allocClasses= d.allocClasses|| JSON.parse(JSON.stringify(DEFAULT_CLASSES));
      allocTotal  = d.allocTotal  || 1000000;
      library     = d.library     || migrateOldInvestments(d.investments||[]);
    } else {
      await migrateFromLS();
    }
  } catch(e) { console.warn("Firebase load failed:",e); }
}

function migrateOldInvestments(old) {
  return old.map(inv => ({
    id: inv.id||Date.now(), name: inv.name, ticker: inv.ticker||'',
    cat: inv.cat||'Equities', returnPct: inv.returnPct||'',
    desc: FUND_LEARN[inv.ticker]||inv.note||'', notes: inv.note||''
  }));
}

async function migrateFromLS() {
  const lsO = LS.g('fp_overview');
  if (lsO||LS.gA('mm_banks').length) {
    overview   = lsO||{income:0,saveTarget:0};
    budget     = LS.gA('fp_budget');
    months     = LS.gA('fp_months');
    principles = LS.gA('fp_principles');
    banks      = LS.gA('mm_banks');
    mmIncome   = LS.g('mm_income')||{salary:0,autosave:0,autoinvest:0};
    invMonthly = LS.g('fp_inv_monthly')||0;
    library    = migrateOldInvestments(LS.gA('fp_investments'));
    await save();
  }
}

async function saveToFirebase() {
  try {
    await setDoc(doc(db,"portals",DOC_ID),{
      overview,budget,months,principles,banks,mmIncome,
      invMonthly,allocClasses,allocTotal,library
    });
  } catch(e) {
    console.warn("Firebase save failed:",e);
    LS.s('fp_overview',overview); LS.s('fp_budget',budget);
    LS.s('fp_months',months); LS.s('fp_principles',principles);
    LS.s('mm_banks',banks); LS.s('mm_income',mmIncome);
    LS.s('fp_inv_monthly',invMonthly);
  }
}
const save = ()=>saveToFirebase();

// ── STATE ─────────────────────────────────────────────────────────
let overview    = {income:0,saveTarget:0};
let budget      = [];
let months      = [];
let principles  = [];
let banks       = [];
let mmIncome    = {salary:0,autosave:0,autoinvest:0};
let invMonthly  = 0;
let library     = [];
let allocTotal  = 1000000;
let allocBuilt  = false;

// Asset classes — 4 classes, no Hedges (merged into Alternatives/Gold)
const DEFAULT_CLASSES = [
  { id:'fixedincome',  label:'Fixed Income',  color:'#3b82f6', pct:30, desc:'Bonds and debt instruments. KFAFIX-A, K-APB-A(A).', products:[] },
  { id:'equities',     label:'Equities',      color:'#10b981', pct:55, desc:'Global stocks. CSPX, TDIV, VAPX, DXJ, EMXC.',       products:[] },
  { id:'alternatives', label:'Alternatives',  color:'#8b5cf6', pct:10, desc:'Commodities, infrastructure, trend-following. HGER, IGF, DBMF.', products:[] },
  { id:'gold',         label:'Gold',          color:'#f97316', pct:5,  desc:'Alternative / hedge for inflation and dollar risk.',  products:[] },
];

let allocClasses = JSON.parse(JSON.stringify(DEFAULT_CLASSES));

let editBankIdx=null, editPrincipleId=null, editProdId=null, editLibId=null, editProdClassId=null;
let bankFilter='all', selColor='#10b981', selType='fixed';

// ── CONSTANTS ─────────────────────────────────────────────────────
const BAHT = '\u0E3F';
const fmt  = n => BAHT+Math.round(n||0).toLocaleString();
const pct  = (a,b) => b>0?Math.round(a/b*100):0;
const v    = id => document.getElementById(id)?.value.trim()||'';
const sv   = (id,val) => { const e=document.getElementById(id); if(e) e.value=val||''; };
const el   = id => document.getElementById(id);
const fD   = s => { if(!s) return ''; return new Date(s+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
const fM   = s => { if(!s) return ''; const [y,m]=s.split('-'); return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}); };

const TYPE_LABELS = {fixed:'Fixed Deposit',checking:'Liquidity / Cash',fixedincome:'Fixed Income',investment:'Equities',alternatives:'Alternatives',gold:'Gold',savings:'Savings (legacy)',hedges:'Hedges (legacy)'};
const TYPE_COLORS = {fixed:'#06b6d4',checking:'#3b82f6',fixedincome:'#3b82f6',investment:'#10b981',alternatives:'#8b5cf6',gold:'#f97316',savings:'#10b981',hedges:'#f59e0b'};

const SPEND_CATS = [
  {key:'shopping',label:'Shopping & Clothes'},{key:'transport',label:'Transport'},
  {key:'health',label:'Health & Wellness'},{key:'entertainment',label:'Entertainment'},
  {key:'travel',label:'Travel'},{key:'rent',label:'Rent & Bills'},
  {key:'beauty',label:'Personal Care & Beauty'},{key:'food',label:'Eating Out & Cafes'},
  {key:'subs',label:'Subscriptions'}
];

const FUND_LEARN = {
  'KFAFIX-A':   'Fixed Income | 20% of portfolio. Thai investment-grade bond fund. Stable returns with low volatility. Portfolio anchor.',
  'K-APB-A(A)': 'Fixed Income | 10% of portfolio. KAsset Asia Pacific Bond Fund. Higher yield than pure Thai bonds.',
  'CSPX':       'Equities | 16% of portfolio. iShares Core S&P 500 — 500 largest US companies. Core long-term growth engine.',
  'TDIV':       'Equities | 16% of portfolio. VanEck Developed Markets Dividend Leaders — high-dividend global equities.',
  'VAPX':       'Equities | 10% of portfolio. Vanguard FTSE Asia Pacific ex Japan.',
  'DXJ':        'Equities | 7% of portfolio. WisdomTree Japan Hedged Equity — Japan equities, USD/JPY hedge removed.',
  'EMXC':       'Equities | 6% of portfolio. iShares MSCI Emerging Markets ex China.',
  'HGER':       'Alternatives | 5% of portfolio. Harbor Commodity All-Weather — broad commodities, inflation shield.',
  'IGF':        'Alternatives | 5% of portfolio. iShares Global Infrastructure — stable cash flows.',
  'DBMF':       'Alternatives | 5% of portfolio. iMGP DBi Managed Futures — trend-following, profits during crashes.'
};

const PORTFOLIO_TEMPLATE = {
  fixedincome:  [{name:'KFAFIX-A',ticker:'KFAFIX-A',pct:67,returnPct:3,desc:FUND_LEARN['KFAFIX-A'],notes:''},{name:'K-APB-A(A)',ticker:'K-APB-A(A)',pct:33,returnPct:4,desc:FUND_LEARN['K-APB-A(A)'],notes:''}],
  equities:     [{name:'CSPX',ticker:'CSPX',pct:29,returnPct:9,desc:FUND_LEARN['CSPX'],notes:''},{name:'TDIV',ticker:'TDIV',pct:29,returnPct:7,desc:FUND_LEARN['TDIV'],notes:''},{name:'VAPX',ticker:'VAPX',pct:18,returnPct:7,desc:FUND_LEARN['VAPX'],notes:''},{name:'DXJ',ticker:'DXJ',pct:13,returnPct:6,desc:FUND_LEARN['DXJ'],notes:''},{name:'EMXC',ticker:'EMXC',pct:11,returnPct:8,desc:FUND_LEARN['EMXC'],notes:''}],
  alternatives: [{name:'HGER',ticker:'HGER',pct:33,returnPct:5,desc:FUND_LEARN['HGER'],notes:''},{name:'IGF',ticker:'IGF',pct:33,returnPct:5,desc:FUND_LEARN['IGF'],notes:''},{name:'DBMF',ticker:'DBMF',pct:34,returnPct:4,desc:FUND_LEARN['DBMF'],notes:''}],
  gold:         []
};

// ── DERIVED ───────────────────────────────────────────────────────
const totalSavingsFromBanks  = ()=>banks.filter(b=>['savings','fixed','checking'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
const totalInvestedFromBanks = ()=>banks.filter(b=>['fixedincome','investment','alternatives','gold','hedges'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
const totalWealthFromBanks   = ()=>banks.reduce((s,b)=>s+b.amount,0);

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async ()=>{
  el('hdate').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.querySelectorAll('.panel').forEach(p=>p.style.opacity='0.4');
  await loadFromFirebase();
  document.querySelectorAll('.panel').forEach(p=>p.style.opacity='1');

  // Tabs
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); el('p-'+b.dataset.t)?.classList.add('active');
    if(b.dataset.t==='alloc') renderAllocPlanner();
  }));

  // Overlay
  el('ov').addEventListener('click',()=>{ document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open')); el('ov').classList.remove('open'); });
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeM(b.dataset.close)));

  // Color swatches
  el('color-row')?.addEventListener('click',e=>{ const sw=e.target.closest('.color-swatch'); if(!sw)return; document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('sel')); sw.classList.add('sel'); selColor=sw.dataset.color; });
  // Type pills
  el('type-pills')?.addEventListener('click',e=>{ const p=e.target.closest('.type-pill'); if(!p)return; document.querySelectorAll('.type-pill').forEach(x=>x.classList.remove('sel')); p.classList.add('sel'); selType=p.dataset.type; });
  // Bank filter
  el('bank-filter-bar')?.addEventListener('click',e=>{ const fc=e.target.closest('.fc'); if(!fc)return; document.querySelectorAll('#bank-filter-bar .fc').forEach(x=>x.classList.remove('active')); fc.classList.add('active'); bankFilter=fc.dataset.f; renderBanks(); });
  // Spending auto-sum
  SPEND_CATS.forEach(c=>{ el('ms-'+c.key)?.addEventListener('input',autoSumSpending); });

  // ── Overview ──
  el('btn-edit-overview')?.addEventListener('click',()=>{ sv('ov-income',overview.income||mmIncome.salary); sv('ov-save-target',overview.saveTarget); openM('m-overview'); });
  el('sv-overview')?.addEventListener('click',async()=>{ overview={income:+v('ov-income'),saveTarget:+v('ov-save-target')}; await save(); renderOverview(); closeM('m-overview'); });

  // ── Budget ──
  el('btn-set-income')?.addEventListener('click',()=>{ sv('inc-val',overview.income||mmIncome.salary); openM('m-income'); });
  el('sv-income')?.addEventListener('click',async()=>{ overview.income=+v('inc-val'); await save(); renderOverview(); renderBudget(); closeM('m-income'); });
  el('btn-add-budget')?.addEventListener('click',()=>openM('m-budget'));
  el('sv-budget')?.addEventListener('click',async()=>{ const name=v('bc-name'); if(!name)return; budget.push({id:Date.now(),name,emoji:el('bc-emoji').value.trim()||'*',amount:+v('bc-amount')||0,color:el('bc-color').value}); await save(); renderBudget(); renderOverview(); ['bc-name','bc-amount'].forEach(id=>sv(id,'')); closeM('m-budget'); });
  window.dBudget=async i=>{budget.splice(i,1);await save();renderBudget();renderOverview();};

  // ── Money Map ──
  el('btn-edit-mm-income')?.addEventListener('click',()=>{ sv('ic-salary',mmIncome.salary); sv('ic-autosave',mmIncome.autosave); sv('ic-autoinvest',mmIncome.autoinvest); openM('m-mm-income'); });
  el('sv-mm-income')?.addEventListener('click',async()=>{ mmIncome={salary:+v('ic-salary')||0,autosave:+v('ic-autosave')||0,autoinvest:+v('ic-autoinvest')||0}; await save(); renderMoneyMap(); renderOverview(); closeM('m-mm-income'); });
  el('btn-add-bank')?.addEventListener('click',()=>{ editBankIdx=null; selColor='#10b981'; selType='fixed'; document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('sel')); document.querySelector('.color-swatch[data-color="#10b981"]')?.classList.add('sel'); document.querySelectorAll('.type-pill').forEach(x=>x.classList.remove('sel')); document.querySelector('.type-pill[data-type="fixed"]')?.classList.add('sel'); el('m-bank-title').textContent='Add Account'; el('sv-bank').textContent='Save'; ['bk-name','bk-nick','bk-amount','bk-return','bk-purpose','bk-terms','bk-notes'].forEach(id=>sv(id,'')); openM('m-bank'); });
  el('sv-bank')?.addEventListener('click',async()=>{ const name=v('bk-name'); if(!name)return; const entry={name,nick:v('bk-nick'),type:selType,amount:+v('bk-amount')||0,purpose:v('bk-purpose'),terms:v('bk-terms'),color:selColor,notes:v('bk-notes'),returnPct:v('bk-return')}; if(editBankIdx!==null){banks[editBankIdx]={...banks[editBankIdx],...entry};editBankIdx=null;}else{banks.push({id:Date.now(),...entry});} el('m-bank-title').textContent='Add Account'; el('sv-bank').textContent='Save'; await save(); renderMoneyMap(); renderOverview(); ['bk-name','bk-nick','bk-amount','bk-return','bk-purpose','bk-terms','bk-notes'].forEach(id=>sv(id,'')); closeM('m-bank'); });
  el('sv-edit-bank')?.addEventListener('click',async()=>{ if(editBankIdx===null)return; banks[editBankIdx].amount=+v('eb-amount')||0; if(v('eb-notes'))banks[editBankIdx].notes=v('eb-notes'); await save(); renderMoneyMap(); renderOverview(); closeM('m-edit-bank'); editBankIdx=null; });
  window.editBank=i=>{ editBankIdx=i; const b=banks[i]; sv('bk-name',b.name); sv('bk-nick',b.nick||''); sv('bk-amount',b.amount); sv('bk-return',b.returnPct||''); sv('bk-purpose',b.purpose||''); sv('bk-terms',b.terms||''); sv('bk-notes',b.notes||''); selColor=b.color; selType=b.type; document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('sel')); document.querySelector(`.color-swatch[data-color="${b.color}"]`)?.classList.add('sel'); document.querySelectorAll('.type-pill').forEach(x=>x.classList.remove('sel')); document.querySelector(`.type-pill[data-type="${b.type}"]`)?.classList.add('sel'); el('m-bank-title').textContent='Edit Account'; el('sv-bank').textContent='Save Changes'; openM('m-bank'); };
  window.dBank=async i=>{banks.splice(i,1);await save();renderMoneyMap();renderOverview();};

  // ── Allocation planner ──
  el('btn-load-portfolio')?.addEventListener('click',async()=>{ if(!confirm('Load the 10-fund portfolio template? This will replace current products in each class.'))return; allocClasses.forEach(c=>{ c.products=(PORTFOLIO_TEMPLATE[c.id]||[]).map((p,i)=>({...p,id:Date.now()+i})); }); allocBuilt=true; await save(); renderAllocPlanner(); });
  el('btn-set-inv-budget')?.addEventListener('click',()=>{ sv('inv-monthly',invMonthly); openM('m-inv-budget'); });
  el('sv-inv-budget')?.addEventListener('click',async()=>{ invMonthly=+v('inv-monthly'); await save(); renderAllocPlanner(); closeM('m-inv-budget'); });
  window.onAllocTotalChange=async val=>{ allocTotal=parseFloat(val)||0; await save(); renderAllocPlanner(); };
  window.openAddProd=(classId)=>{ editProdId=null; editProdClassId=classId; el('m-prod-title').textContent='Add Product'; el('prod-class-id').value=classId; ['prod-name','prod-ticker','prod-pct','prod-return','prod-desc','prod-notes'].forEach(id=>sv(id,'')); openM('m-prod'); };
  window.openEditProd=(classId,prodId)=>{ const cls=allocClasses.find(c=>c.id===classId); const p=cls?.products.find(x=>x.id===prodId); if(!p)return; editProdId=prodId; editProdClassId=classId; el('m-prod-title').textContent='Edit Product'; el('prod-class-id').value=classId; sv('prod-name',p.name); sv('prod-ticker',p.ticker||''); sv('prod-pct',p.pct||''); sv('prod-return',p.returnPct||''); sv('prod-desc',p.desc||''); sv('prod-notes',p.notes||''); openM('m-prod'); };
  el('sv-prod')?.addEventListener('click',async()=>{ const name=v('prod-name'); if(!name)return; const classId=el('prod-class-id').value; const cls=allocClasses.find(c=>c.id===classId); if(!cls)return; const entry={name,ticker:v('prod-ticker'),pct:+v('prod-pct')||0,returnPct:v('prod-return'),desc:v('prod-desc'),notes:v('prod-notes')}; if(editProdId){const i=cls.products.findIndex(x=>x.id===editProdId); cls.products[i]={...cls.products[i],...entry};}else{cls.products.push({id:Date.now(),...entry});} await save(); renderAllocPlanner(); ['prod-name','prod-ticker','prod-pct','prod-return','prod-desc','prod-notes'].forEach(id=>sv(id,'')); closeM('m-prod'); });
  window.dProd=async(classId,prodId)=>{ const cls=allocClasses.find(c=>c.id===classId); if(cls){cls.products=cls.products.filter(x=>x.id!==prodId);} await save(); renderAllocPlanner(); };
  window.onClassPctChange=async(classId,val)=>{ const cls=allocClasses.find(c=>c.id===classId); if(cls){cls.pct=Math.min(100,Math.max(0,parseInt(val)||0));} await save(); renderAllocPlanner(); };

  // ── Library ──
  el('btn-add-lib')?.addEventListener('click',()=>{ editLibId=null; el('m-lib-title').textContent='Add to Library'; ['lib-name','lib-ticker','lib-return','lib-desc','lib-notes'].forEach(id=>sv(id,'')); openM('m-lib'); });
  el('sv-lib')?.addEventListener('click',async()=>{ const name=v('lib-name'); if(!name)return; const entry={name,ticker:v('lib-ticker'),cat:el('lib-cat').value,returnPct:v('lib-return'),desc:v('lib-desc'),notes:v('lib-notes')}; if(editLibId){const i=library.findIndex(x=>x.id===editLibId); library[i]={...library[i],...entry}; editLibId=null;}else{library.push({id:Date.now(),...entry});} await save(); renderLibrary(); closeM('m-lib'); });
  window.editLib=id=>{ editLibId=id; const p=library.find(x=>x.id===id); if(!p)return; el('m-lib-title').textContent='Edit Product'; sv('lib-name',p.name); sv('lib-ticker',p.ticker||''); sv('lib-return',p.returnPct||''); sv('lib-desc',p.desc||''); sv('lib-notes',p.notes||''); if(el('lib-cat'))el('lib-cat').value=p.cat||'Equities'; openM('m-lib'); };
  window.dLib=async id=>{ library=library.filter(x=>x.id!==id); await save(); renderLibrary(); };
  window.moveToAlloc=async id=>{ const p=library.find(x=>x.id===id); if(!p)return; const classId=p.cat==='Fixed Income'?'fixedincome':p.cat==='Equities'?'equities':p.cat==='Alternatives'?'alternatives':p.cat==='Gold'?'gold':'equities'; const cls=allocClasses.find(c=>c.id===classId); if(cls){cls.products.push({id:Date.now(),name:p.name,ticker:p.ticker||'',pct:0,returnPct:p.returnPct||'',desc:p.desc||'',notes:p.notes||''});} library=library.filter(x=>x.id!==id); await save(); renderLibrary(); renderAllocPlanner(); alert(`Moved ${p.name} to ${cls?.label||classId} in your Allocation Planner. Set its % there.`); };

  // ── Monthly Spending ──
  el('btn-add-month')?.addEventListener('click',()=>{ const now=new Date(); sv('ms-month',`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`); SPEND_CATS.forEach(c=>sv('ms-'+c.key,'')); sv('ms-total',''); openM('m-month'); });
  el('sv-month')?.addEventListener('click',async()=>{ const month=v('ms-month'); if(!month)return; const entry={month}; SPEND_CATS.forEach(c=>{entry[c.key]=+(el('ms-'+c.key)?.value||0);}); entry.total=SPEND_CATS.reduce((s,c)=>s+entry[c.key],0); const ex=months.findIndex(m=>m.month===month); if(ex>=0)months[ex]=entry;else months.push(entry); await save(); renderSpending(); renderOverview(); SPEND_CATS.forEach(c=>sv('ms-'+c.key,'')); sv('ms-total',''); closeM('m-month'); });
  window.dMonth=async month=>{months=months.filter(m=>m.month!==month);await save();renderSpending();renderOverview();};

  // ── Principles ──
  el('btn-add-principle')?.addEventListener('click',()=>{ editPrincipleId=null; el('pr-modal-title').textContent='Add Principle'; ['pr-title','pr-body','pr-tag'].forEach(id=>sv(id,'')); openM('m-principle'); });
  el('sv-principle')?.addEventListener('click',async()=>{ const title=v('pr-title'); if(!title)return; if(editPrincipleId){const p=principles.find(x=>x.id===editPrincipleId); if(p){p.title=title;p.body=v('pr-body');p.tag=v('pr-tag');}}else{principles.push({id:Date.now(),title,body:v('pr-body'),tag:v('pr-tag')});} await save(); renderPrinciples(); ['pr-title','pr-body','pr-tag'].forEach(id=>sv(id,'')); editPrincipleId=null; closeM('m-principle'); });
  window.editPrinciple=id=>{ editPrincipleId=id; const p=principles.find(x=>x.id===id); if(!p)return; el('pr-modal-title').textContent='Edit Principle'; sv('pr-title',p.title); sv('pr-body',p.body||''); sv('pr-tag',p.tag||''); openM('m-principle'); };
  window.dPrinciple=async id=>{principles=principles.filter(x=>x.id!==id);await save();renderPrinciples();};

  renderAll();
});

function openM(id){el('ov').classList.add('open');el(id)?.classList.add('open');}
function closeM(id){el('ov').classList.remove('open');el(id)?.classList.remove('open');}
function autoSumSpending(){const total=SPEND_CATS.reduce((s,c)=>s+(+(el('ms-'+c.key)?.value||0)),0);const t=el('ms-total');if(t)t.value=total||'';}

function renderAll(){
  renderOverview(); renderBudget(); renderSpending();
  renderMoneyMap(); renderAllocPlanner(); renderLibrary(); renderPrinciples();
}

// ══════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════
function renderOverview(){
  const income=overview.income||mmIncome.salary, saveTarget=overview.saveTarget;
  const savings=totalSavingsFromBanks(), invested=totalInvestedFromBanks(), total=totalWealthFromBanks();
  const rate=income>0?pct(saveTarget,income):0;
  const totalBudgeted=budget.reduce((s,b)=>s+b.amount,0);
  const remaining=income-totalBudgeted-saveTarget;
  el('kpi-overview').innerHTML=`
    <div class="kpi"><div class="kpi-lbl">Monthly Income</div><div class="kpi-val g-text">${fmt(income)}</div><div class="kpi-sub">from Money Map</div></div>
    <div class="kpi"><div class="kpi-lbl">Cash & Savings</div><div class="kpi-val">${fmt(savings)}</div><div class="kpi-sub">from accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">Invested</div><div class="kpi-val" style="color:var(--blue)">${fmt(invested)}</div><div class="kpi-sub">from accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">Net Worth</div><div class="kpi-val g-text">${fmt(total)}</div><div class="kpi-sub">all accounts</div></div>`;
  el('savings-rate-card').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div><div style="font-family:var(--font-d);font-size:15px;font-weight:700">Savings Rate</div><div style="font-size:11px;color:var(--t3);margin-top:1px">Target ${fmt(saveTarget)} / month</div></div>
      <div style="font-family:var(--font-d);font-size:30px;font-weight:800" class="g-text">${rate}%</div>
    </div>
    <div class="pbar-bg"><div class="pbar" style="width:${Math.min(rate,100)}%"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-top:8px">
      <span>Budgeted: ${fmt(totalBudgeted)}</span><span>Saved: ${fmt(saveTarget)}</span>
      <span style="color:${remaining>=0?'var(--green)':'var(--red)'}">${remaining>=0?'Unallocated':'Over'}: ${fmt(Math.abs(remaining))}</span>
    </div>`;
  const sorted=[...months].sort((a,b)=>b.month.localeCompare(a.month));
  const latest=sorted[0]||null, prev=sorted[1]||null;
  const ovMonth=el('overview-month');
  if(!latest){ovMonth.innerHTML='<div class="empty">No monthly data yet</div>';return;}
  const topCats=SPEND_CATS.filter(c=>latest[c.key]>0).sort((a,b)=>latest[b.key]-latest[a.key]).slice(0,4);
  ovMonth.innerHTML=`<div class="glass" style="padding:1.1rem"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-family:var(--font-d);font-size:14px;font-weight:700">${fM(latest.month)}</span><span style="font-family:var(--font-d);font-size:16px;font-weight:800" class="g-text">${fmt(latest.total)}</span></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">${topCats.map(c=>{const diff=prev?latest[c.key]-(prev[c.key]||0):null;return`<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><span style="font-size:12px;color:var(--t2);flex:1">${c.label}</span><div style="text-align:right"><div style="font-family:var(--font-d);font-size:12px;font-weight:700">${fmt(latest[c.key])}</div>${diff!==null&&diff!==0?`<div style="font-size:10px;color:${diff>0?'var(--red)':'var(--green)'};font-weight:600">${diff>0?'+':'-'} ${fmt(Math.abs(diff))}</div>`:''}</div></div>`;}).join('')}</div></div>`;
}

// ══════════════════════════════════════════════════════
// MONEY MAP — TABLE FORMAT
// ══════════════════════════════════════════════════════
function renderMoneyMap(){renderMMKPIs();renderIncomeFlow();renderBanks();renderPie();renderAllocSummary();}

function renderMMKPIs(){
  const savings=totalSavingsFromBanks(),invested=totalInvestedFromBanks(),total=totalWealthFromBanks();
  const spending=Math.max(mmIncome.salary-mmIncome.autosave-mmIncome.autoinvest,0);
  el('mm-kpi-grid').innerHTML=`
    <div class="kpi"><div class="kpi-lbl">Total Wealth</div><div class="kpi-val g-text">${fmt(total)}</div><div class="kpi-sub">all accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">Cash & Savings</div><div class="kpi-val">${fmt(savings)}</div><div class="kpi-sub">${pct(savings,total)}% of total</div></div>
    <div class="kpi"><div class="kpi-lbl">Invested</div><div class="kpi-val" style="color:var(--blue)">${fmt(invested)}</div><div class="kpi-sub">${pct(invested,total)}% of total</div></div>
    <div class="kpi"><div class="kpi-lbl">Monthly Salary</div><div class="kpi-val" style="color:var(--green)">${fmt(mmIncome.salary)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Spending Budget</div><div class="kpi-val" style="color:var(--amber)">${fmt(spending)}</div><div class="kpi-sub">after savings &amp; invest</div></div>`;
}

function renderIncomeFlow(){
  const{salary,autosave,autoinvest}=mmIncome;
  const spending=Math.max(salary-autosave-autoinvest,0);
  const wrap=el('income-flow');
  if(!salary){wrap.innerHTML='<div class="empty">Click "Edit Income" to set up your monthly salary flow</div>';return;}
  const rows=[{label:'Savings - auto-transfer on payday',amt:autosave,color:'#10b981'},{label:'Investments - auto-invest on payday',amt:autoinvest,color:'#3b82f6'},{label:'Monthly spending budget',amt:spending,color:'#f59e0b'}];
  wrap.innerHTML=`<div style="font-family:var(--font-d);font-size:13px;font-weight:700;margin-bottom:14px">Every month, the second your salary lands</div>
    ${rows.map(r=>`<div class="flow-row"><div class="flow-icon" style="background:${r.color}18;width:34px;height:34px;border-radius:10px;flex-shrink:0"></div><div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--t2)">${r.label}</div><div class="flow-bar"><div class="flow-bar-fill" style="background:${r.color};width:${pct(r.amt,salary)}%"></div></div></div><div style="text-align:right;flex-shrink:0"><div style="font-family:var(--font-d);font-size:14px;font-weight:700;color:${r.color}">${fmt(r.amt)}</div><div style="font-size:10px;color:var(--t3)">${pct(r.amt,salary)}%</div></div></div>`).join('')}
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0fdf4;display:flex;justify-content:space-between;font-size:11px;color:var(--t3)"><span>Total: ${fmt(salary)}</span><span style="color:${salary-autosave-autoinvest>=0?'var(--green)':'var(--red)'}">${salary-autosave-autoinvest>=0?'Balanced':'Over-allocated'}</span></div>`;
}

function renderBanks(){
  const total=totalWealthFromBanks();
  const filtered=bankFilter==='all'?banks:banks.filter(b=>b.type===bankFilter);
  const wrap=el('bank-table-wrap');
  if(!filtered.length){wrap.innerHTML='<div class="empty">No accounts yet - click "+ Add Account"</div>';return;}
  // Group by bank color for color-coding
  wrap.innerHTML=`
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="border-bottom:2px solid #f0fdf4">
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);width:16px"></th>
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">Bank</th>
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">Account / Type</th>
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">Purpose</th>
            <th style="text-align:center;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">Return</th>
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">Terms</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">Balance</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">% wealth</th>
            <th style="padding:8px 10px;width:80px"></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(b=>{
            const ri=banks.indexOf(b), p=pct(b.amount,total);
            const typeColor=TYPE_COLORS[b.type]||b.color;
            return `<tr style="border-bottom:1px solid #f5f0ff;transition:background .12s" onmouseover="this.style.background='rgba(168,85,247,.04)'" onmouseout="this.style.background=''">
              <td style="padding:10px 10px"><div style="width:14px;height:14px;border-radius:50%;background:${b.color};flex-shrink:0"></div></td>
              <td style="padding:10px 10px;font-weight:600;color:var(--t)">${b.name}</td>
              <td style="padding:10px 10px">
                <div style="font-size:12px;color:var(--t2)">${b.nick||'—'}</div>
                <span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:20px;background:${typeColor}18;color:${typeColor}">${TYPE_LABELS[b.type]||b.type}</span>
              </td>
              <td style="padding:10px 10px;font-size:12px;color:var(--t3)">${b.purpose||'—'}</td>
              <td style="padding:10px 10px;text-align:center">
                ${b.returnPct?`<span style="font-size:11px;font-weight:600;color:var(--green)">+${b.returnPct}% p.a.</span>`:`<span style="color:var(--t3)">—</span>`}
              </td>
              <td style="padding:10px 10px;font-size:12px;color:var(--t3)">${b.terms||'—'}</td>
              <td style="padding:10px 10px;text-align:right;font-family:var(--font-d);font-size:14px;font-weight:700;color:var(--t)">${fmt(b.amount)}</td>
              <td style="padding:10px 10px;text-align:right"><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:${typeColor}18;color:${typeColor}">${p}%</span></td>
              <td style="padding:10px 10px;text-align:right">
                <div style="display:flex;gap:4px;justify-content:flex-end">
                  <button class="btn btn-g btn-sm" onclick="editBank(${ri})" style="padding:4px 10px;font-size:11px">Edit</button>
                  <button class="btn btn-d" onclick="dBank(${ri})" style="padding:4px 8px;font-size:11px">x</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
          <tr style="border-top:2px solid #f0fdf4;background:rgba(16,185,129,.03)">
            <td colspan="6" style="padding:10px 10px;font-size:12px;font-weight:700;color:var(--t2)">Total</td>
            <td style="padding:10px 10px;text-align:right;font-family:var(--font-d);font-size:15px;font-weight:800" class="g-text">${fmt(total)}</td>
            <td style="padding:10px 10px;text-align:right;font-size:12px;font-weight:700;color:var(--t2)">100%</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function renderPie(){
  const total=totalWealthFromBanks();
  el('pie-center-val').textContent=fmt(total);
  const canvas=el('pie-canvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=200,H=200,cx=W/2,cy=H/2,R=88,RI=56;
  ctx.clearRect(0,0,W,H);
  const typeMap={};
  banks.filter(b=>b.amount>0).forEach(b=>{const label=TYPE_LABELS[b.type]||b.type;const color=TYPE_COLORS[b.type]||b.color;if(!typeMap[label])typeMap[label]={amount:0,color};typeMap[label].amount+=b.amount;});
  const segments=Object.entries(typeMap).map(([label,v])=>({label,amount:v.amount,color:v.color})).sort((a,b)=>b.amount-a.amount);
  if(!segments.length||total===0){ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fillStyle='#f0fdf4';ctx.fill();ctx.beginPath();ctx.arc(cx,cy,RI,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.95)';ctx.fill();el('pie-legend').innerHTML='<div style="font-size:12px;color:#a7f3d0;font-style:italic">Add accounts to see your wealth map</div>';return;}
  let startAngle=-Math.PI/2;
  segments.forEach(seg=>{const sliceAngle=seg.amount/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,startAngle,startAngle+sliceAngle);ctx.closePath();ctx.fillStyle=seg.color;ctx.fill();startAngle+=sliceAngle;});
  ctx.beginPath();ctx.arc(cx,cy,RI,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.95)';ctx.fill();
  el('pie-legend').innerHTML=segments.map(s=>`<div class="pie-leg-row"><div class="pie-dot" style="background:${s.color}"></div><span class="pie-leg-label">${s.label}</span><span class="pie-leg-amt">${fmt(s.amount)}</span><span class="pie-leg-pct">${pct(s.amount,total)}%</span></div>`).join('');
}

function renderAllocSummary(){
  const total=totalWealthFromBanks(); if(!banks.length){el('alloc-summary').innerHTML='';return;}
  const cashTypes=['fixed','checking','savings'];
  const invTypes=['fixedincome','investment','alternatives','gold','hedges'];
  const cashAmt=banks.filter(b=>cashTypes.includes(b.type)).reduce((s,b)=>s+b.amount,0);
  const invAmt=banks.filter(b=>invTypes.includes(b.type)).reduce((s,b)=>s+b.amount,0);
  const cashGroups=[{label:'Fixed Deposit',types:['fixed'],color:'#06b6d4'},{label:'Liquidity / Cash',types:['checking','savings'],color:'#3b82f6'}].map(g=>({...g,amount:banks.filter(b=>g.types.includes(b.type)).reduce((s,b)=>s+b.amount,0)})).filter(g=>g.amount>0);
  const invGroups=[{label:'Fixed Income',types:['fixedincome'],color:'#3b82f6'},{label:'Equities',types:['investment'],color:'#10b981'},{label:'Alternatives',types:['alternatives'],color:'#8b5cf6'},{label:'Gold',types:['gold'],color:'#f97316'}].map(g=>({...g,amount:banks.filter(b=>g.types.includes(b.type)).reduce((s,b)=>s+b.amount,0)})).filter(g=>g.amount>0);
  const mkSection=(title,amt,color,groups)=>!amt?'':`<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${color}">${title}</span><span style="font-family:var(--font-d);font-size:15px;font-weight:700;color:${color}">${fmt(amt)} <span style="font-size:11px;color:var(--t3)">${pct(amt,total)}%</span></span></div>${groups.map(g=>`<div style="display:flex;justify-content:space-between;align-items:center;padding-left:10px;margin-bottom:3px"><span style="font-size:12px;color:var(--t2)">${g.label}</span><span style="font-size:12px;font-weight:600;color:${g.color}">${fmt(g.amount)} - ${pct(g.amount,total)}%</span></div><div class="pbar-bg" style="margin:0 0 6px 10px"><div class="pbar" style="width:${pct(g.amount,total)}%;background:${g.color}"></div></div>`).join('')}</div>`;
  el('alloc-summary').innerHTML=`<div class="glass" style="padding:1.1rem">${mkSection('CASH',cashAmt,'#3b82f6',cashGroups)}${mkSection('INVESTMENT',invAmt,'#10b981',invGroups)}</div>`;
}

// ══════════════════════════════════════════════════════
// INVESTMENT ALLOCATION PLANNER
// ══════════════════════════════════════════════════════
function renderAllocPlanner(){
  if(!allocBuilt){
    // On first render, seed total from Money Map if available
    const mapTotal=totalWealthFromBanks();
    if(mapTotal>0&&allocTotal===1000000) allocTotal=mapTotal;
    allocBuilt=true;
  }
  const twEl=el('alloc-total-input'); if(twEl&&!twEl.value) twEl.value=allocTotal;
  const total=allocTotal||0;
  const classSum=allocClasses.reduce((s,c)=>s+c.pct,0);

  // Summary KPIs
  el('alloc-plan-stats').innerHTML=`
    <div class="kpi"><div class="kpi-lbl">Allocated</div><div class="kpi-val" style="color:${classSum===100?'var(--green)':classSum>100?'var(--red)':'var(--amber)'}">${classSum}%</div></div>
    <div class="kpi"><div class="kpi-lbl">Monthly Amount</div><div class="kpi-val g-text">${fmt(invMonthly)}</div></div>
    ${allocClasses.map(c=>`<div class="kpi"><div class="kpi-lbl" style="color:${c.color}">${c.label}</div><div class="kpi-val" style="color:${c.color}">${c.pct}%</div><div class="kpi-sub">${fmt(total*c.pct/100)}</div></div>`).join('')}
  `;

  // Balance message
  const msgEl=el('alloc-plan-msg');
  if(msgEl){
    if(classSum===100) msgEl.innerHTML=`<div style="font-size:12px;font-weight:600;color:var(--green)">Portfolio perfectly balanced at 100%</div>`;
    else if(classSum>100) msgEl.innerHTML=`<div style="font-size:12px;font-weight:600;color:var(--red)">Over-allocated by ${classSum-100}%</div>`;
    else msgEl.innerHTML=`<div style="font-size:12px;font-weight:600;color:var(--amber)">${100-classSum}% unallocated</div>`;
  }

  // Two visualization bars
  const vizEl=el('alloc-viz'); if(vizEl){
    // Bar 1: Asset class percentages
    const bar1=allocClasses.filter(c=>c.pct>0).map(c=>`<div style="height:12px;background:${c.color};width:${c.pct}%;min-width:2px;transition:width .3s" title="${c.label}: ${c.pct}%"></div>`).join('');
    const unalloc=100-classSum;

    // Bar 2: Individual products across all classes
    const allProds=allocClasses.flatMap(c=>c.products.map(p=>({...p,classColor:c.color,classPct:c.pct,absW:c.pct*p.pct/100})));
    const bar2=allProds.filter(p=>p.absW>0).map(p=>`<div style="height:12px;background:${p.classColor};opacity:${0.5+0.5*(p.pct/100)};width:${p.absW}%;min-width:1px;transition:width .3s" title="${p.ticker||p.name}: ${p.absW.toFixed(1)}% of portfolio"></div>`).join('');

    vizEl.innerHTML=`
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:6px">By asset class</div>
        <div style="display:flex;height:12px;border-radius:20px;overflow:hidden;gap:1px">
          ${bar1}${unalloc>0?`<div style="flex:1;background:#f0fdf4;min-width:0"></div>`:''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${allocClasses.filter(c=>c.pct>0).map(c=>`<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--t2)"><div style="width:8px;height:8px;border-radius:50%;background:${c.color}"></div>${c.label} ${c.pct}%</div>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:6px">By individual product (% of total portfolio)</div>
        <div style="display:flex;height:12px;border-radius:20px;overflow:hidden;gap:1px">
          ${bar2||`<div style="flex:1;background:#f0fdf4;border-radius:20px"></div>`}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${allProds.filter(p=>p.absW>0).map(p=>`<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--t2)"><div style="width:8px;height:8px;border-radius:50%;background:${p.classColor}"></div>${p.ticker||p.name} ${p.absW.toFixed(1)}%</div>`).join('')}
        </div>
      </div>`;
  }

  // Asset class sections with products
  const classesEl=el('alloc-classes'); if(!classesEl)return;
  classesEl.innerHTML=allocClasses.map(c=>{
    const monthlyForClass=invMonthly*c.pct/100;
    const prodSum=c.products.reduce((s,p)=>s+p.pct,0);
    return `
    <div class="glass" style="padding:1.1rem;margin-bottom:.8rem">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
        <div style="width:14px;height:14px;border-radius:50%;background:${c.color};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-d);font-size:16px;font-weight:700;color:var(--t)">${c.label}</div>
          <div style="font-size:11px;color:var(--t3)">${c.desc}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <input type="number" min="0" max="100" step="1" value="${c.pct}"
            style="width:64px;padding:5px 8px;border:1.5px solid ${c.color}40;border-radius:10px;font-family:var(--font-d);font-size:15px;font-weight:700;color:${c.color};text-align:center;background:#f0fdf4"
            oninput="onClassPctChange('${c.id}',this.value)">
          <span style="font-size:12px;color:var(--t3)">% of portfolio</span>
          <span style="font-family:var(--font-d);font-size:13px;font-weight:700;color:${c.color}">${fmt(total*c.pct/100)}</span>
          <span style="font-size:11px;color:var(--t3)">${fmt(monthlyForClass)}/mo</span>
        </div>
        <button class="btn btn-p btn-sm" onclick="openAddProd('${c.id}')" style="flex-shrink:0">+ Add Product</button>
      </div>
      ${c.products.length?`
      <div style="margin-bottom:6px;height:4px;background:#f0fdf4;border-radius:20px;overflow:hidden">
        <div style="height:4px;border-radius:20px;background:${c.color};width:${Math.min(prodSum,100)}%;transition:width .3s"></div>
      </div>
      <div style="font-size:10px;color:${prodSum>100?'var(--red)':prodSum===100?'var(--green)':'var(--amber)'};font-weight:600;margin-bottom:8px">Products: ${prodSum}% of this class${prodSum===100?' - perfect':prodSum>100?' - over':'  - '+Math.abs(100-prodSum)+'% unallocated'}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${c.products.map(p=>{
          const absW=(c.pct*p.pct/100).toFixed(1);
          const learnTip=FUND_LEARN[p.ticker]||p.desc||'';
          return `<div style="background:#faf8ff;border:1px solid #f0ebff;border-radius:10px;padding:.7rem .9rem">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <span style="font-size:13px;font-weight:700;color:var(--t)" title="${learnTip}">${p.name}</span>
                ${p.ticker&&p.ticker!==p.name?`<span style="font-size:11px;color:var(--t3);margin-left:6px">${p.ticker}</span>`:''}
                ${p.returnPct?`<span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:20px;background:rgba(16,185,129,.1);color:#065f46;margin-left:4px">+${p.returnPct}% p.a.</span>`:''}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <input type="number" min="0" max="100" step="1" value="${p.pct}"
                  style="width:52px;padding:4px 6px;border:1.5px solid ${c.color}40;border-radius:8px;font-family:var(--font-d);font-size:13px;font-weight:700;color:${c.color};text-align:center;background:#fff"
                  onchange="(async()=>{const cls=allocClasses.find(x=>x.id==='${c.id}');const pr=cls?.products.find(x=>x.id===${p.id});if(pr){pr.pct=Math.min(100,Math.max(0,parseInt(this.value)||0));await save();renderAllocPlanner();}})()">
                <span style="font-size:11px;color:var(--t3)">% of class</span>
                <span style="font-size:11px;font-weight:600;color:${c.color}">${absW}% total</span>
                <button class="btn btn-g btn-sm" onclick="openEditProd('${c.id}',${p.id})" style="padding:3px 9px;font-size:11px">Edit</button>
                <button class="btn btn-d" onclick="dProd('${c.id}',${p.id})" style="padding:3px 8px;font-size:11px">x</button>
              </div>
            </div>
            ${p.desc?`<div style="font-size:11px;color:var(--t2);margin-top:5px;line-height:1.5">${p.desc}</div>`:''}
            ${p.notes?`<div style="font-size:11px;color:var(--t3);margin-top:3px;font-style:italic">${p.notes}</div>`:''}
          </div>`;
        }).join('')}
      </div>`:'<div style="font-size:12px;color:var(--t3);font-style:italic;padding:4px 0">No products added yet — click "+ Add Product"</div>'}
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
// PRODUCT LIBRARY
// ══════════════════════════════════════════════════════
function renderLibrary(){
  const wrap=el('lib-list');
  if(!library.length){wrap.innerHTML='<div class="empty">No products in your library yet — add interesting funds or ETFs here to research them before allocating</div>';return;}
  const CAT_COLORS_LIB={'Fixed Income':'#3b82f6','Equities':'#10b981','Alternatives':'#8b5cf6','Gold':'#f97316','Other':'#9ca3af'};
  wrap.innerHTML=library.map(p=>{
    const cc=CAT_COLORS_LIB[p.cat]||'#9ca3af';
    return`<div class="glass" style="padding:1rem 1.1rem;margin-bottom:.6rem">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span style="font-size:14px;font-weight:700;color:var(--t)">${p.name}</span>
            ${p.ticker&&p.ticker!==p.name?`<span style="font-size:11px;color:var(--t3)">${p.ticker}</span>`:''}
            <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${cc}18;color:${cc}">${p.cat||'Other'}</span>
            ${p.returnPct?`<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,.1);color:#065f46">+${p.returnPct}% p.a.</span>`:''}
          </div>
          ${p.desc?`<div style="font-size:12px;color:var(--t2);line-height:1.5;margin-top:3px">${p.desc}</div>`:''}
          ${p.notes?`<div style="font-size:11px;color:var(--t3);margin-top:3px;font-style:italic">${p.notes}</div>`:''}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn btn-g btn-sm" onclick="moveToAlloc(${p.id})" title="Move to Allocation Planner" style="font-size:11px">Move to Plan</button>
          <button class="btn btn-g btn-sm" onclick="editLib(${p.id})" style="font-size:11px">Edit</button>
          <button class="btn btn-d btn-sm" onclick="dLib(${p.id})" style="font-size:11px">x</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
// MONTHLY SPENDING
// ══════════════════════════════════════════════════════
function renderSpending(){
  const sorted=[...months].sort((a,b)=>b.month.localeCompare(a.month));
  const last6=sorted.slice(0,6).reverse();
  const maxTotal=Math.max(...last6.map(m=>m.total),1);
  const trendEl=el('spending-trend');
  if(last6.length>1){trendEl.innerHTML=`<div class="glass" style="padding:1.1rem;margin-bottom:1.2rem"><div style="font-family:var(--font-d);font-size:13px;font-weight:700;margin-bottom:12px">6-Month Trend</div><div style="display:flex;align-items:flex-end;gap:6px;height:80px">${last6.map(m=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="width:100%;background:linear-gradient(180deg,#10b981,#3b82f6);border-radius:6px 6px 0 0;height:${Math.round(m.total/maxTotal*64)}px;min-height:4px" title="${fmt(m.total)}"></div><div style="font-size:9px;color:var(--t3);text-align:center">${fM(m.month).split(' ')[0].slice(0,3)}</div></div>`).join('')}</div></div>`;
  }else{trendEl.innerHTML='';}
  const wrap=el('month-list');
  if(!sorted.length){wrap.innerHTML='<div class="empty">No months logged yet</div>';return;}
  wrap.innerHTML=sorted.map((m,idx)=>{
    const prev=sorted[idx+1]||null, cats=SPEND_CATS.filter(c=>m[c.key]>0), totalDiff=prev?m.total-prev.total:null;
    return`<div class="glass month-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-family:var(--font-d);font-size:15px;font-weight:700">${fM(m.month)}</span><div style="display:flex;align-items:center;gap:10px"><div style="text-align:right"><div style="font-family:var(--font-d);font-size:15px;font-weight:800" class="g-text">${fmt(m.total)}</div>${totalDiff!==null?`<div style="font-size:10px;font-weight:600;color:${totalDiff>0?'var(--red)':'var(--green)'}">${totalDiff>0?'+':'-'} ${fmt(Math.abs(totalDiff))} vs prev</div>`:''}</div><button class="btn btn-d" onclick="dMonth('${m.month}')">Delete</button></div></div><div class="month-cats">${cats.map(c=>{const diff=prev?m[c.key]-(prev[c.key]||0):null;return`<div class="cat-row"><span style="font-size:12px;color:var(--t2);flex:1">${c.label}</span><div style="text-align:right"><div style="font-family:var(--font-d);font-size:12px;font-weight:700">${fmt(m[c.key])}</div>${diff!==null&&diff!==0?`<div style="font-size:10px;font-weight:600;color:${diff>0?'var(--red)':'var(--green)'}">${diff>0?'+':'-'} ${fmt(Math.abs(diff))}</div>`:''}</div></div>`;}).join('')}</div></div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
// PRINCIPLES
// ══════════════════════════════════════════════════════
function renderPrinciples(){
  const wrap=el('principles-list');
  if(!principles.length){wrap.innerHTML='<div class="empty">No principles yet</div>';return;}
  wrap.innerHTML=principles.map(p=>`<div class="glass" style="padding:1.1rem;margin-bottom:.65rem"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px"><div><div style="font-family:var(--font-d);font-size:15px;font-weight:700;color:var(--t);margin-bottom:4px">${p.title}</div>${p.tag?`<span style="display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(16,185,129,.12);color:#065f46">${p.tag}</span>`:''}</div><div style="display:flex;gap:5px;flex-shrink:0"><button class="btn btn-g btn-sm" onclick="editPrinciple(${p.id})">Edit</button><button class="btn btn-d btn-sm" onclick="dPrinciple(${p.id})">Delete</button></div></div>${p.body?`<div style="font-size:13px;color:var(--t2);line-height:1.7;white-space:pre-wrap;background:rgba(240,253,244,.5);border:1px solid #d1fae5;border-radius:10px;padding:.75rem 1rem;margin-top:8px">${p.body}</div>`:''}</div>`).join('');
}

// ══════════════════════════════════════════════════════
// BUDGET
// ══════════════════════════════════════════════════════
function renderBudget(){
  const inc=overview.income||mmIncome.salary, total=budget.reduce((s,b)=>s+b.amount,0), remaining=inc-total;
  el('budget-income-bar').innerHTML=inc>0?`<div class="glass" style="padding:1.1rem;margin-bottom:1.2rem"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-family:var(--font-d);font-size:14px;font-weight:700">Monthly: ${fmt(inc)}</span><span style="font-size:12px;font-weight:600;color:${remaining>=0?'var(--green)':'var(--red)'}">${remaining>=0?'Unallocated':'Over'}: ${fmt(Math.abs(remaining))}</span></div><div style="display:flex;height:10px;border-radius:20px;overflow:hidden;gap:1px">${budget.map(b=>`<div style="height:10px;background:${b.color};width:${pct(b.amount,inc)}%;min-width:${b.amount>0?2:0}px" title="${b.name}: ${fmt(b.amount)}"></div>`).join('')}<div style="flex:1;background:#f0fdf4;min-width:0"></div></div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">${budget.map(b=>`<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--t2)"><div style="width:8px;height:8px;border-radius:50%;background:${b.color}"></div>${b.name}: ${fmt(b.amount)} (${pct(b.amount,inc)}%)</div>`).join('')}</div></div>`:'<div class="empty" style="margin-bottom:1.2rem">Set your monthly income first</div>';
  const grid=el('budget-grid');
  if(!budget.length){grid.innerHTML='<div class="empty" style="grid-column:1/-1">No budget categories yet</div>';return;}
  grid.innerHTML=budget.map((b,i)=>`<div class="glass budget-cat"><div class="bc-top"><div class="bc-name"><div class="bc-dot" style="background:${b.color}"></div>${b.emoji} ${b.name}</div><div style="text-align:right"><div style="font-family:var(--font-d);font-size:14px;font-weight:700;color:${b.color}">${fmt(b.amount)}</div><div style="font-size:10px;color:var(--t3)">${inc>0?pct(b.amount,inc):0}% of income</div></div></div><div class="pbar-bg"><div class="pbar" style="width:${inc>0?pct(b.amount,inc):0}%;background:${b.color}"></div></div><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-d" onclick="dBudget(${i})">Remove</button></div></div>`).join('');
}
