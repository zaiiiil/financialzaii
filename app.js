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
      months      = d.months      || [];
      principles  = d.principles  || [];
      banks       = d.banks       || [];
      mmIncome    = d.mmIncome    || {salary:0,autosave:0,autoinvest:0};
      invMonthly  = d.invMonthly  || 0;
      allocClasses= d.allocClasses|| JSON.parse(JSON.stringify(DEFAULT_CLASSES));
      allocTotal  = d.allocTotal  || 1000000;
      library     = d.library     || migrateOldInvestments(d.investments||[]);
      plans       = d.plans       || [];
      transfers   = d.transfers   || [];
      if(d.allocCashPct!==undefined){ allocCashPct=d.allocCashPct; allocInvPct=d.allocInvPct; allocLiquidPct=d.allocLiquidPct; allocFixedPct=d.allocFixedPct; }
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
    plans      = [];
    await save();
  }
}

async function saveToFirebase() {
  try {
    await setDoc(doc(db,"portals",DOC_ID),{
      overview,months,principles,banks,mmIncome,
      invMonthly,allocClasses,allocTotal,library,plans,transfers
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
let plans       = [];
let transfers   = [];
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

const TYPE_LABELS = {fixed:'Fixed Deposit',esavings:'E-Savings',checking:'Liquidity / Cash',fixedincome:'Fixed Income',investment:'Equities',alternatives:'Alternatives',gold:'Gold',savings:'Savings (legacy)',hedges:'Hedges (legacy)'};
const TYPE_COLORS = {fixed:'#06b6d4',esavings:'#10b981',checking:'#3b82f6',fixedincome:'#3b82f6',investment:'#10b981',alternatives:'#8b5cf6',gold:'#f97316',savings:'#10b981',hedges:'#f59e0b'};

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
const totalSavingsFromBanks  = ()=>banks.filter(b=>['savings','fixed','checking','esavings'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
const totalInvestedFromBanks = ()=>banks.filter(b=>['fixedincome','investment','alternatives','gold','hedges'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
const totalWealthFromBanks   = ()=>banks.reduce((s,b)=>s+b.amount,0);

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async ()=>{
  el('hdate').textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.querySelectorAll('.panel').forEach(p=>p.style.opacity='0.4');
  await loadFromFirebase();
  document.querySelectorAll('.panel').forEach(p=>p.style.opacity='1');

  // Prevent details dropdowns from closing before mousedown registers
  document.querySelectorAll('.grp').forEach(details => {
    details.addEventListener('toggle', () => {
      // nothing — let native toggle work
    });
  });
  // Keep details open while mouse is over the menu
  document.querySelectorAll('.grp-menu').forEach(menu => {
    menu.addEventListener('mouseenter', () => {
      const details = menu.closest('.grp');
      if(details) details.setAttribute('open','');
    });
  });

  // Tab navigation — use mousedown so it fires before blur closes the details
  document.querySelectorAll('.tab[data-t]').forEach(b => {
    b.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevents blur on details before we navigate
    });
    b.addEventListener('click', () => {
      const t = b.dataset.t; if(!t) return;
      document.querySelectorAll('.tab[data-t]').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      el('p-'+t)?.classList.add('active');
      // Close details dropdown and highlight group label
      document.querySelectorAll('.grp-label').forEach(l=>l.classList.remove('active'));
      const parentGrp = b.closest('.grp');
      if(parentGrp) {
        parentGrp.removeAttribute('open');
        parentGrp.querySelector('.grp-label')?.classList.add('active');
      }
      if(t==='alloc') renderAllocPlanner();
      if(t==='budget') renderBudget();
      if(t==='transfers') renderTransfers();
      if(t==='library') renderLibrary();
      if(t==='principles') renderPrinciples();
      if(t==='allocplans') renderPlans();
    });
  });




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

  // ── Money Map ──
  el('btn-edit-mm-income')?.addEventListener('click',()=>{ sv('ic-salary',mmIncome.salary); sv('ic-autosave',mmIncome.autosave); sv('ic-autoinvest',mmIncome.autoinvest); openM('m-mm-income'); });
  el('sv-mm-income')?.addEventListener('click',async()=>{ mmIncome={salary:+v('ic-salary')||0,autosave:+v('ic-autosave')||0,autoinvest:+v('ic-autoinvest')||0}; await save(); renderMoneyMap(); renderOverview(); closeM('m-mm-income'); });
  el('btn-add-bank')?.addEventListener('click',()=>{ editBankIdx=null; selColor='#10b981'; selType='fixed'; document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('sel')); document.querySelector('.color-swatch[data-color="#10b981"]')?.classList.add('sel'); document.querySelectorAll('.type-pill').forEach(x=>x.classList.remove('sel')); document.querySelector('.type-pill[data-type="fixed"]')?.classList.add('sel'); el('m-bank-title').textContent='Add Account'; el('sv-bank').textContent='Save'; ['bk-name','bk-nick','bk-amount','bk-return','bk-purpose','bk-terms','bk-notes'].forEach(id=>sv(id,'')); if(el('bk-keepopen'))el('bk-keepopen').checked=false; openM('m-bank'); });
  el('sv-bank')?.addEventListener('click',async()=>{ const name=v('bk-name'); if(!name)return; const keepOpen=el('bk-keepopen')?.checked||false; const entry={name,nick:v('bk-nick'),type:selType,amount:+v('bk-amount')||0,purpose:v('bk-purpose'),terms:v('bk-terms'),color:selColor,notes:v('bk-notes'),returnPct:v('bk-return'),keepOpen}; if(editBankIdx!==null){banks[editBankIdx]={...banks[editBankIdx],...entry};editBankIdx=null;}else{banks.push({id:Date.now(),...entry});} el('m-bank-title').textContent='Add Account'; el('sv-bank').textContent='Save'; await save(); renderMoneyMap(); renderOverview(); ['bk-name','bk-nick','bk-amount','bk-return','bk-purpose','bk-terms','bk-notes'].forEach(id=>sv(id,'')); closeM('m-bank'); });
  el('sv-edit-bank')?.addEventListener('click',async()=>{ if(editBankIdx===null)return; banks[editBankIdx].amount=+v('eb-amount')||0; if(v('eb-notes'))banks[editBankIdx].notes=v('eb-notes'); await save(); renderMoneyMap(); renderOverview(); closeM('m-edit-bank'); editBankIdx=null; });
  window.editBank=i=>{ editBankIdx=i; const b=banks[i]; sv('bk-name',b.name); sv('bk-nick',b.nick||''); sv('bk-amount',b.amount); sv('bk-return',b.returnPct||''); sv('bk-purpose',b.purpose||''); sv('bk-terms',b.terms||''); sv('bk-notes',b.notes||''); if(el('bk-keepopen'))el('bk-keepopen').checked=b.keepOpen||false; selColor=b.color; selType=b.type; document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('sel')); document.querySelector(`.color-swatch[data-color="${b.color}"]`)?.classList.add('sel'); document.querySelectorAll('.type-pill').forEach(x=>x.classList.remove('sel')); document.querySelector(`.type-pill[data-type="${b.type}"]`)?.classList.add('sel'); el('m-bank-title').textContent='Edit Account'; el('sv-bank').textContent='Save Changes'; openM('m-bank'); };
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
  el('sv-month')?.addEventListener('click',async()=>{ const month=v('ms-month'); if(!month)return; const entry={month,income:+(el('ms-income')?.value||0)}; SPEND_CATS.forEach(c=>{entry[c.key]=+(el('ms-'+c.key)?.value||0);}); entry.total=SPEND_CATS.reduce((s,c)=>s+entry[c.key],0); entry.saved=Math.max(0,entry.income-entry.total); const ex=months.findIndex(m=>m.month===month); if(ex>=0)months[ex]=entry;else months.push(entry); await save(); renderSpending(); renderOverview(); sv('ms-income',''); SPEND_CATS.forEach(c=>sv('ms-'+c.key,'')); sv('ms-total',''); closeM('m-month'); });
  window.dMonth=async month=>{months=months.filter(m=>m.month!==month);await save();renderSpending();renderOverview();};
  window.editMonth=month=>{
    const m=months.find(x=>x.month===month); if(!m)return;
    sv('ms-month',m.month); sv('ms-income',m.income||'');
    SPEND_CATS.forEach(c=>sv('ms-'+c.key,m[c.key]||''));
    autoSumSpending(); openM('m-month');
  };

  // ── Principles ──
  el('btn-add-principle')?.addEventListener('click',()=>{ editPrincipleId=null; el('pr-modal-title').textContent='Add Principle'; ['pr-title','pr-body','pr-tag'].forEach(id=>sv(id,'')); openM('m-principle'); });
  el('sv-principle')?.addEventListener('click',async()=>{ const title=v('pr-title'); if(!title)return; if(editPrincipleId){const p=principles.find(x=>x.id===editPrincipleId); if(p){p.title=title;p.body=v('pr-body');p.tag=v('pr-tag');}}else{principles.push({id:Date.now(),title,body:v('pr-body'),tag:v('pr-tag')});} await save(); renderPrinciples(); ['pr-title','pr-body','pr-tag'].forEach(id=>sv(id,'')); editPrincipleId=null; closeM('m-principle'); });
  window.editPrinciple=id=>{ editPrincipleId=id; const p=principles.find(x=>x.id===id); if(!p)return; el('pr-modal-title').textContent='Edit Principle'; sv('pr-title',p.title); sv('pr-body',p.body||''); sv('pr-tag',p.tag||''); openM('m-principle'); };
  window.dPrinciple=async id=>{principles=principles.filter(x=>x.id!==id);await save();renderPrinciples();};

  renderAll();
  initBudgetListeners();
});

function openM(id){el('ov').classList.add('open');el(id)?.classList.add('open');}
function closeM(id){el('ov').classList.remove('open');el(id)?.classList.remove('open');}
function autoSumSpending(){const total=SPEND_CATS.reduce((s,c)=>s+(+(el('ms-'+c.key)?.value||0)),0);const t=el('ms-total');if(t)t.value=total||'';}

function renderAll(){
  renderOverview(); renderMoneyMap(); renderSpending();
  renderPlans(); renderTransfers(); renderLibrary();
  renderPrinciples(); renderAllocPlanner();
}


// ══════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════
function renderOverview(){
  const income=overview.income||mmIncome.salary, saveTarget=overview.saveTarget;
  const savings=totalSavingsFromBanks(), invested=totalInvestedFromBanks(), total=totalWealthFromBanks();
  const rate=income>0?pct(saveTarget,income):0;
  el('kpi-overview').innerHTML=`
    <div class="kpi"><div class="kpi-lbl">Monthly Income</div><div class="kpi-val g-text">${fmt(income)}</div><div class="kpi-sub">from Money Map</div></div>
    <div class="kpi"><div class="kpi-lbl">Cash & Savings</div><div class="kpi-val">${fmt(savings)}</div><div class="kpi-sub">from accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">Invested</div><div class="kpi-val" style="color:var(--blue)">${fmt(invested)}</div><div class="kpi-sub">from accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">Net Worth</div><div class="kpi-val g-text">${fmt(total)}</div><div class="kpi-sub">all accounts</div></div>`;
  const totalSaved=months.reduce((s,m)=>s+Math.max(0,(m.income||0)-m.total),0);
  const totalInc=months.reduce((s,m)=>s+(m.income||0),0);
  const overallRate=totalInc>0?pct(totalSaved,totalInc):0;
  el('savings-rate-card').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <div>
        <div style="font-family:var(--font-d);font-size:15px;font-weight:700">Cumulative Savings from Salary</div>
        <div style="font-size:11px;color:var(--t3);margin-top:1px">${months.length} months tracked</div>
      </div>
      <div style="font-family:var(--font-d);font-size:30px;font-weight:800;color:#10b981">${fmt(totalSaved)}</div>
    </div>
    <div class="pbar-bg"><div class="pbar" style="width:${Math.min(overallRate,100)}%;background:#10b981"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-top:8px">
      <span>Total income logged: ${fmt(totalInc)}</span>
      <span style="color:#10b981;font-weight:600">Overall savings rate: ${overallRate}%</span>
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
function renderMoneyMap(){renderIncomeFlow();renderBanks();renderPie();renderAllocSummary();}

function renderMMKPIs(){ /* removed — KPI bar hidden */ }

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
            const isKO = b.keepOpen||false;
            return `<tr style="border-bottom:1px solid #f5f0ff;transition:background .12s;${isKO?'opacity:.45;':''}">
              <td style="padding:10px 10px"><div style="width:14px;height:14px;border-radius:50%;background:${isKO?'#d1d5db':b.color};flex-shrink:0"></div></td>
              <td style="padding:10px 10px;font-weight:600;color:${isKO?'var(--t3)':'var(--t)'}">${b.name}${isKO?'<span style="font-size:9px;font-weight:600;padding:1px 6px;border-radius:20px;background:#f3f4f6;color:#9ca3af;margin-left:5px">keep open</span>':''}</td>
              <td style="padding:10px 10px">
                <div style="font-size:12px;color:var(--t3)">${b.nick||'—'}</div>
                <span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:20px;background:${isKO?'#f3f4f6':typeColor+'18'};color:${isKO?'#9ca3af':typeColor}">${TYPE_LABELS[b.type]||b.type}</span>
              </td>
              <td style="padding:10px 10px;font-size:12px;color:var(--t3)">${b.purpose||'—'}</td>
              <td style="padding:10px 10px;text-align:center">
                ${b.returnPct?`<span style="font-size:11px;font-weight:600;color:${isKO?'#9ca3af':'var(--green)'}">+${b.returnPct}% p.a.</span>`:`<span style="color:var(--t3)">—</span>`}
              </td>
              <td style="padding:10px 10px;font-size:12px;color:var(--t3)">${b.terms||'—'}</td>
              <td style="padding:10px 10px;text-align:right;font-family:var(--font-d);font-size:14px;font-weight:700;color:${isKO?'var(--t3)':'var(--t)'}">${fmt(b.amount)}</td>
              <td style="padding:10px 10px;text-align:right"><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:${isKO?'#f3f4f6':typeColor+'18'};color:${isKO?'#9ca3af':typeColor}">${p}%</span></td>
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
  // Group into 3 buckets: Liquid Cash / Fixed Deposits / Investment
  const liquidAmt  = banks.filter(b=>['checking','savings','esavings'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
  const fixedAmt   = banks.filter(b=>b.type==='fixed').reduce((s,b)=>s+b.amount,0);
  const investAmt  = banks.filter(b=>['fixedincome','investment','alternatives','gold','hedges'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
  const segments = [
    {label:'Liquid Cash',    amount:liquidAmt,  color:'#3b82f6'},
    {label:'Fixed Deposits', amount:fixedAmt,   color:'#06b6d4'},
    {label:'Investment',     amount:investAmt,  color:'#10b981'},
  ].filter(s=>s.amount>0);
  if(!segments.length||total===0){ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.fillStyle='#f0fdf4';ctx.fill();ctx.beginPath();ctx.arc(cx,cy,RI,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.95)';ctx.fill();el('pie-legend').innerHTML='<div style="font-size:12px;color:#a7f3d0;font-style:italic">Add accounts to see your wealth map</div>';return;}
  let startAngle=-Math.PI/2;
  segments.forEach(seg=>{const sliceAngle=seg.amount/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,startAngle,startAngle+sliceAngle);ctx.closePath();ctx.fillStyle=seg.color;ctx.fill();startAngle+=sliceAngle;});
  ctx.beginPath();ctx.arc(cx,cy,RI,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.95)';ctx.fill();
  el('pie-legend').innerHTML=segments.map(s=>`<div class="pie-leg-row"><div class="pie-dot" style="background:${s.color}"></div><span class="pie-leg-label">${s.label}</span><span class="pie-leg-amt">${fmt(s.amount)}</span><span class="pie-leg-pct">${pct(s.amount,total)}%</span></div>`).join('');
}

function renderAllocSummary(){
  const total=totalWealthFromBanks(); if(!banks.length){el('alloc-summary').innerHTML='';return;}
  const liquidAmt = banks.filter(b=>['checking','savings','esavings'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
  const fixedAmt  = banks.filter(b=>b.type==='fixed').reduce((s,b)=>s+b.amount,0);
  const invAmt    = banks.filter(b=>['fixedincome','investment','alternatives','gold','hedges'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
  const cashAmt   = liquidAmt + fixedAmt;
  // Investment sub-breakdown
  const invGroups=[{label:'Fixed Income',types:['fixedincome'],color:'#3b82f6'},{label:'Equities',types:['investment'],color:'#10b981'},{label:'Alternatives',types:['alternatives'],color:'#8b5cf6'},{label:'Gold',types:['gold'],color:'#f97316'}].map(g=>({...g,amount:banks.filter(b=>g.types.includes(b.type)).reduce((s,b)=>s+b.amount,0)})).filter(g=>g.amount>0);
  const row=(label,amt,color)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:12px;color:var(--t2)">${label}</span>
      <span style="font-size:12px;font-weight:600;color:${color}">${fmt(amt)} &nbsp; ${pct(amt,total)}%</span>
    </div>
    <div class="pbar-bg" style="margin-bottom:8px"><div class="pbar" style="width:${pct(amt,total)}%;background:${color}"></div></div>`;
  el('alloc-summary').innerHTML=`<div class="glass" style="padding:1.1rem">
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#3b82f6">CASH &nbsp;${pct(cashAmt,total)}%</span>
        <span style="font-family:var(--font-d);font-size:15px;font-weight:700;color:#3b82f6">${fmt(cashAmt)}</span>
      </div>
      ${liquidAmt>0?row('Liquid Cash',liquidAmt,'#3b82f6'):''}
      ${fixedAmt>0?row('Fixed Deposits',fixedAmt,'#06b6d4'):''}
    </div>
    ${invAmt>0?`<div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#10b981">INVESTMENT &nbsp;${pct(invAmt,total)}%</span>
        <span style="font-family:var(--font-d);font-size:15px;font-weight:700;color:#10b981">${fmt(invAmt)}</span>
      </div>
      ${invGroups.map(g=>row(g.label,g.amount,g.color)).join('')}
    </div>`:''}
  </div>`;
}

// ══════════════════════════════════════════════════════
// INVESTMENT ALLOCATION PLANNER
// ══════════════════════════════════════════════════════
let allocCashPct = 35;   // user-set: % of total wealth in cash
let allocInvPct  = 65;   // user-set: % of total wealth in investment
let allocLiquidPct = 15; // % of total in liquid cash (sub of cash)
let allocFixedPct  = 20; // % of total in fixed deposits (sub of cash)

window.onAllocCashChange = async (field, val) => {
  const n = Math.min(100, Math.max(0, parseInt(val)||0));
  if(field==='liquid') allocLiquidPct = n;
  if(field==='fixed')  allocFixedPct  = n;
  allocCashPct  = allocLiquidPct + allocFixedPct;
  allocInvPct   = Math.max(0, 100 - allocCashPct);
  await save(); renderAllocPlanner();
};

function renderAllocPlanner(){
  if(!allocBuilt){
    const mapTotal=totalWealthFromBanks();
    if(mapTotal>0&&allocTotal===1000000) allocTotal=mapTotal;
    // Try to seed from actual Money Map
    if(mapTotal>0){
      const liquidAmt=banks.filter(b=>['checking','savings'].includes(b.type)).reduce((s,b)=>s+b.amount,0);
      const fixedAmt =banks.filter(b=>b.type==='fixed').reduce((s,b)=>s+b.amount,0);
      allocLiquidPct = Math.round(liquidAmt/mapTotal*100);
      allocFixedPct  = Math.round(fixedAmt/mapTotal*100);
      allocCashPct   = allocLiquidPct+allocFixedPct;
      allocInvPct    = Math.max(0,100-allocCashPct);
    }
    allocBuilt=true;
  }
  const twEl=el('alloc-total-input'); if(twEl&&!twEl.value) twEl.value=allocTotal;
  const total=allocTotal||0;
  const classSum=allocClasses.reduce((s,c)=>s+c.pct,0);

  // ── Cash vs Investment top section ──
  const cashSec=el('alloc-cash-inv-section');
  if(cashSec){
    const cashAmt   = total*allocCashPct/100;
    const liqAmt    = total*allocLiquidPct/100;
    const fixedAmt  = total*allocFixedPct/100;
    const invAmt    = total*allocInvPct/100;
    const topSum    = allocCashPct+allocInvPct;
    cashSec.innerHTML=`
      <div style="margin-bottom:10px">
        <div style="display:flex;height:12px;border-radius:20px;overflow:hidden;gap:1px;margin-bottom:8px">
          ${allocLiquidPct>0?`<div style="height:12px;background:#3b82f6;width:${allocLiquidPct}%;min-width:2px;transition:width .3s" title="Liquid Cash: ${allocLiquidPct}%"></div>`:''}
          ${allocFixedPct>0?`<div style="height:12px;background:#06b6d4;width:${allocFixedPct}%;min-width:2px;transition:width .3s" title="Fixed Deposits: ${allocFixedPct}%"></div>`:''}
          ${allocInvPct>0?`<div style="height:12px;background:#10b981;width:${allocInvPct}%;min-width:2px;transition:width .3s" title="Investment: ${allocInvPct}%"></div>`:''}
          ${topSum<100?`<div style="flex:1;background:#f0fdf4;min-width:0" title="Unallocated: ${100-topSum}%"></div>`:''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
          <span style="font-size:11px;color:var(--t2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block"></span>Liquid Cash ${allocLiquidPct}%</span>
          <span style="font-size:11px;color:var(--t2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#06b6d4;display:inline-block"></span>Fixed Deposits ${allocFixedPct}%</span>
          <span style="font-size:11px;color:var(--t2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#10b981;display:inline-block"></span>Investment ${allocInvPct}%</span>
          ${topSum!==100?`<span style="font-size:11px;font-weight:600;color:${topSum>100?'var(--red)':'var(--amber)'}">${topSum>100?'Over by '+(topSum-100)+'%':(100-topSum)+'% unallocated'}</span>`:`<span style="font-size:11px;font-weight:600;color:var(--green)">100% - balanced</span>`}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="glass" style="padding:1rem;border-left:4px solid #3b82f6">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#3b82f6;margin-bottom:8px">CASH &nbsp; ${allocCashPct}% &nbsp; = &nbsp; ${fmt(cashAmt)}</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;color:var(--t2)">a/ Liquid Cash</span>
                <span style="font-size:12px;font-weight:600;color:#3b82f6">${fmt(liqAmt)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="number" min="0" max="100" step="1" value="${allocLiquidPct}"
                  style="width:56px;padding:5px 7px;border:1.5px solid #3b82f640;border-radius:8px;font-family:var(--font-d);font-size:14px;font-weight:700;color:#3b82f6;text-align:center;background:#f0fdf4"
                  oninput="onAllocCashChange('liquid',this.value)">
                <span style="font-size:11px;color:var(--t3)">% of total wealth</span>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;color:var(--t2)">b/ Fixed Deposits</span>
                <span style="font-size:12px;font-weight:600;color:#06b6d4">${fmt(fixedAmt)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="number" min="0" max="100" step="1" value="${allocFixedPct}"
                  style="width:56px;padding:5px 7px;border:1.5px solid #06b6d440;border-radius:8px;font-family:var(--font-d);font-size:14px;font-weight:700;color:#06b6d4;text-align:center;background:#f0fdf4"
                  oninput="onAllocCashChange('fixed',this.value)">
                <span style="font-size:11px;color:var(--t3)">% of total wealth</span>
              </div>
            </div>
          </div>
        </div>
        <div class="glass" style="padding:1rem;border-left:4px solid #10b981">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#10b981;margin-bottom:8px">INVESTMENT &nbsp; ${allocInvPct}% &nbsp; = &nbsp; ${fmt(invAmt)}</div>
          <div style="font-size:12px;color:var(--t3);line-height:1.6">Auto-calculated as 100% minus your cash allocation. &nbsp; <strong style="color:#10b981">${allocInvPct}%</strong> goes into the 4 asset classes below.</div>
          <div style="margin-top:10px;font-size:11px;color:var(--t3)">Monthly investment: <strong style="color:#10b981">${fmt(invMonthly)}</strong></div>
        </div>
      </div>`;
  }

  // Summary KPIs (asset classes)
  el('alloc-plan-stats').innerHTML=`
    <div class="kpi"><div class="kpi-lbl">Investment allocated</div><div class="kpi-val" style="color:${classSum===100?'var(--green)':classSum>100?'var(--red)':'var(--amber)'}">${classSum}%</div><div class="kpi-sub">of investment sleeve</div></div>
    <div class="kpi"><div class="kpi-lbl">Monthly Amount</div><div class="kpi-val g-text">${fmt(invMonthly)}</div></div>
    ${allocClasses.map(c=>`<div class="kpi"><div class="kpi-lbl" style="color:${c.color}">${c.label}</div><div class="kpi-val" style="color:${c.color}">${c.pct}%</div><div class="kpi-sub">${fmt(total*allocInvPct/100*c.pct/100)}</div></div>`).join('')}
  `;

  // Balance message
  const msgEl=el('alloc-plan-msg');
  if(msgEl){
    if(classSum===100) msgEl.innerHTML=`<div style="font-size:12px;font-weight:600;color:var(--green)">Investment sleeve perfectly balanced at 100%</div>`;
    else if(classSum>100) msgEl.innerHTML=`<div style="font-size:12px;font-weight:600;color:var(--red)">Investment sleeve over-allocated by ${classSum-100}%</div>`;
    else msgEl.innerHTML=`<div style="font-size:12px;font-weight:600;color:var(--amber)">${100-classSum}% of investment sleeve unallocated</div>`;
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
// Category colors for visual bars
const CAT_COLORS_SPEND = {
  shopping:'#ec4899', transport:'#3b82f6', health:'#10b981', entertainment:'#8b5cf6',
  travel:'#f59e0b', rent:'#06b6d4', beauty:'#f97316', food:'#ef4444', subs:'#6366f1'
};

function renderSpending(){
  const sorted=[...months].sort((a,b)=>b.month.localeCompare(a.month));
  const last6=sorted.slice(0,6).reverse();

  // Cumulative savings banner
  const totalSavedAllTime = sorted.reduce((s,m)=>s+(m.saved||Math.max(0,(m.income||0)-m.total)),0);
  const totalIncomeAllTime = sorted.reduce((s,m)=>s+(m.income||0),0);
  const trendEl=el('spending-trend');

  let trendHTML = '';

  // Cumulative savings card
  if(sorted.length){
    const avgSaved = sorted.length>0 ? Math.round(totalSavedAllTime/sorted.length) : 0;
    trendHTML += `<div class="glass" style="padding:1.1rem;margin-bottom:1.2rem;background:linear-gradient(135deg,rgba(16,185,129,.06),rgba(59,130,246,.06))">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:4px">Total Saved from Salary</div>
          <div style="font-family:var(--font-d);font-size:28px;font-weight:800;color:#10b981">${fmt(totalSavedAllTime)}</div>
          <div style="font-size:11px;color:var(--t3);margin-top:3px">across ${sorted.length} month${sorted.length!==1?'s':''} tracked &nbsp;·&nbsp; avg ${fmt(avgSaved)}/month saved</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:4px">Total Income tracked</div>
          <div style="font-family:var(--font-d);font-size:20px;font-weight:700;color:var(--t)">${fmt(totalIncomeAllTime)}</div>
          ${totalIncomeAllTime>0?`<div style="font-size:11px;color:var(--t3);margin-top:3px">Overall savings rate: <strong style="color:#10b981">${pct(totalSavedAllTime,totalIncomeAllTime)}%</strong></div>`:''}
        </div>
      </div>
      ${totalIncomeAllTime>0?`<div style="margin-top:12px">
        <div style="display:flex;height:8px;border-radius:20px;overflow:hidden;gap:1px">
          <div style="background:#10b981;width:${pct(totalSavedAllTime,totalIncomeAllTime)}%;min-width:${totalSavedAllTime>0?3:0}px;transition:width .5s" title="Saved"></div>
          <div style="background:#ef4444;flex:1;min-width:0" title="Spent"></div>
        </div>
        <div style="display:flex;gap:14px;margin-top:5px;font-size:10px;color:var(--t3)">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:3px"></span>Saved ${pct(totalSavedAllTime,totalIncomeAllTime)}%</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:3px"></span>Spent ${100-pct(totalSavedAllTime,totalIncomeAllTime)}%</span>
        </div>
      </div>`:''}</div>`;
  }

  // 6-month trend bar chart
  if(last6.length>1){
    const maxVal=Math.max(...last6.map(m=>Math.max(m.total,m.income||0)),1);
    trendHTML+=`<div class="glass" style="padding:1.1rem;margin-bottom:1.2rem">
      <div style="font-family:var(--font-d);font-size:13px;font-weight:700;margin-bottom:14px">6-Month Spending vs Income</div>
      <div style="display:flex;align-items:flex-end;gap:8px;height:90px">
        ${last6.map(m=>{
          const spendH=Math.round(m.total/maxVal*72);
          const incH=m.income?Math.round(m.income/maxVal*72):0;
          const saved=m.income?Math.max(0,m.income-m.total):0;
          return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="width:100%;display:flex;align-items:flex-end;gap:2px;height:72px">
              ${incH?`<div style="flex:1;background:#10b981;opacity:.3;border-radius:4px 4px 0 0;height:${incH}px" title="Income: ${fmt(m.income)}"></div>`:''}
              <div style="flex:1;background:linear-gradient(180deg,#ec4899,#3b82f6);border-radius:4px 4px 0 0;height:${Math.max(spendH,2)}px" title="Spent: ${fmt(m.total)}"></div>
            </div>
            <div style="font-size:9px;color:var(--t3);text-align:center">${fM(m.month).split(' ')[0].slice(0,3)}</div>
            ${saved>0?`<div style="font-size:8px;color:#10b981;font-weight:700">+${fmt(saved)}</div>`:''}
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:8px;font-size:10px;color:var(--t3)">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#10b981;opacity:.4;margin-right:3px"></span>Income</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#ec4899;margin-right:3px"></span>Spending</span>
      </div>
    </div>`;
  }

  trendEl.innerHTML = trendHTML;

  const wrap=el('month-list');
  if(!sorted.length){wrap.innerHTML='<div class="empty">No months logged yet — click "+ Log Month" to add your first month</div>';return;}

  wrap.innerHTML=sorted.map((m,idx)=>{
    const prev=sorted[idx+1]||null;
    const cats=SPEND_CATS.filter(c=>m[c.key]>0).sort((a,b)=>m[b.key]-m[a.key]);
    const totalDiff=prev?m.total-prev.total:null;
    const income=m.income||0;
    const saved=income>0?Math.max(0,income-m.total):null;
    const saveRate=income>0?pct(saved,income):null;

    // Category visual bar
    const catBarSegs=cats.map(c=>`<div style="height:6px;background:${CAT_COLORS_SPEND[c.key]||'#9ca3af'};width:${m.total>0?pct(m[c.key],m.total):0}%;min-width:2px;transition:width .3s" title="${c.label}: ${fmt(m[c.key])}"></div>`).join('');

    return`<div class="glass month-card" style="padding:0;overflow:hidden">
      <!-- Header -->
      <div style="padding:1rem 1.1rem .75rem;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-family:var(--font-d);font-size:16px;font-weight:700">${fM(m.month)}</div>
          ${income>0?`<div style="font-size:11px;color:var(--t3);margin-top:2px">Income: <strong style="color:var(--t)">${fmt(income)}</strong></div>`:'<div style="font-size:11px;color:var(--amber)">No income logged for this month</div>'}
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="text-align:right">
            <div style="font-family:var(--font-d);font-size:16px;font-weight:800" class="g-text">${fmt(m.total)}<span style="font-size:11px;font-weight:400;color:var(--t3);margin-left:4px">spent</span></div>
            ${totalDiff!==null?`<div style="font-size:10px;font-weight:600;color:${totalDiff>0?'var(--red)':'var(--green)'}">${totalDiff>0?'+':'-'} ${fmt(Math.abs(totalDiff))} vs prev</div>`:''}
          </div>
          ${saved!==null?`<div style="text-align:right;padding-left:12px;border-left:1px solid #f0fdf4">
            <div style="font-family:var(--font-d);font-size:16px;font-weight:800;color:#10b981">${fmt(saved)}<span style="font-size:11px;font-weight:400;color:var(--t3);margin-left:4px">saved</span></div>
            <div style="font-size:10px;font-weight:600;color:#10b981">${saveRate}% savings rate</div>
          </div>`:''}
          <button class="btn btn-g btn-sm" onclick="editMonth('${m.month}')" style="flex-shrink:0">Edit</button><button class="btn btn-d" onclick="dMonth('${m.month}')" style="flex-shrink:0">Delete</button>
        </div>
      </div>

      <!-- Category colour bar -->
      <div style="display:flex;height:6px;overflow:hidden">${catBarSegs}</div>

      <!-- Category breakdown -->
      <div style="padding:.75rem 1.1rem 1rem">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;margin-bottom:8px">
          ${cats.map(c=>{
            const diff=prev?m[c.key]-(prev[c.key]||0):null;
            const catPct=m.total>0?pct(m[c.key],m.total):0;
            const cc=CAT_COLORS_SPEND[c.key]||'#9ca3af';
            return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0">
              <div style="width:3px;height:28px;border-radius:2px;background:${cc};flex-shrink:0"></div>
              <div style="flex:1;min-width:0">
                <div style="font-size:11px;color:var(--t3);margin-bottom:1px">${c.label}</div>
                <div style="font-family:var(--font-d);font-size:13px;font-weight:700">${fmt(m[c.key])} <span style="font-size:10px;color:var(--t3);font-weight:400">${catPct}%</span></div>
                ${diff!==null&&diff!==0?`<div style="font-size:10px;font-weight:600;color:${diff>0?'var(--red)':'var(--green)'}">${diff>0?'+':'-'}${fmt(Math.abs(diff))}</div>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>
        ${income>0&&saved!==null?`
        <div style="margin-top:6px">
          <div style="display:flex;height:5px;border-radius:20px;overflow:hidden;gap:1px">
            ${cats.map(c=>`<div style="background:${CAT_COLORS_SPEND[c.key]||'#9ca3af'};width:${pct(m[c.key],income)}%;min-width:${m[c.key]>0?1:0}px"></div>`).join('')}
            <div style="background:#10b981;width:${saveRate}%;min-width:${saved>0?2:0}px" title="Saved"></div>
            <div style="flex:1;background:#f0fdf4;min-width:0"></div>
          </div>
          <div style="font-size:10px;color:var(--t3);margin-top:4px">As % of income — green = saved</div>
        </div>`:''}
      </div>
    </div>`;
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
// ALLOCATION PLANS
// ══════════════════════════════════════════════════════
let editPlanId = null;


// ══════════════════════════════════════════════════════
// BUDGET PLANNER
// ══════════════════════════════════════════════════════
let budgetData = {
  salaryOverride: 0,
  savingsGoal: 15000,
  fixed: [
    { id:1, label:'Gym membership', amt:1500 },
    { id:2, label:'Phone & Internet', amt:799 },
  ],
  essential: [
    { id:1, label:'Transportation', amt:3000 },
    { id:2, label:'Lunch at work', amt:3000 },
  ],
  disc: [
    { id:1, label:'Shopping & Clothes', amt:2000 },
    { id:2, label:'Eating out & Cafes', amt:3000 },
    { id:3, label:'Beauty & Personal Care', amt:1500 },
  ]
};
let budgetNextId = 20;

// Budget data saved to localStorage only (separate from Firebase)

function loadBudgetData() {
  const saved = LS.g('fp_budget_planner');
  if (saved && saved.fixed) {
    budgetData = saved;
    budgetNextId = Math.max(budgetNextId, ...[...saved.fixed, ...saved.essential, ...saved.disc].map(x=>x.id+1), 20);
  }
}

// Budget init — moved into main DOMContentLoaded
function initBudgetListeners() {
  loadBudgetData();
  document.querySelectorAll('.tab[data-t="budget"]').forEach(b => {
    b.addEventListener('click', () => setTimeout(renderBudget, 50));
  });
}

function saveBudgetLocal() {
  LS.s('fp_budget_planner', budgetData);
}

function budgetSalary() {
  return budgetData.salaryOverride || mmIncome.salary || 0;
}

window.budgetUpdateSalary = val => { budgetData.salaryOverride = +val||0; saveBudgetLocal(); renderBudget(); };
window.budgetUpdateGoal  = val => { budgetData.savingsGoal = +val||0; saveBudgetLocal(); renderBudget(); };
window.budgetUpdateAmt   = (type, id, val) => {
  const arr = budgetData[type];
  const item = arr.find(x=>x.id===id);
  if(item) { item.amt = +val||0; saveBudgetLocal(); renderBudget(); }
};
window.budgetRename = (type, id, val) => {
  const item = budgetData[type].find(x=>x.id===id);
  if(item) { item.label = val; saveBudgetLocal(); }
};
window.budgetDelete = (type, id) => {
  budgetData[type] = budgetData[type].filter(x=>x.id!==id);
  saveBudgetLocal(); renderBudget();
};
window.budgetAdd = type => {
  budgetData[type].push({ id:budgetNextId++, label:'New item', amt:0 });
  saveBudgetLocal(); renderBudget();
};

function budgetRows(arr, type) {
  const color = type==='fixed'?'#E24B4A':type==='essential'?'#BA7517':'#378ADD';
  return arr.map(r => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:0.5px solid #f5f5f5">
      <input value="${(r.label||'').replace(/"/g,'&quot;')}" onchange="budgetRename('${type}',${r.id},this.value)"
        style="flex:1;border:none;background:transparent;font-size:13px;color:var(--t);outline:none;font-family:var(--font);min-width:0">
      <input type="number" value="${r.amt}" oninput="budgetUpdateAmt('${type}',${r.id},this.value)"
        style="width:110px;padding:5px 9px;border:1px solid ${color}30;border-radius:8px;font-size:13px;font-weight:600;text-align:right;color:var(--t);background:transparent">
      <button onclick="budgetDelete('${type}',${r.id})" style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:16px;padding:0 2px;line-height:1;flex-shrink:0">x</button>
    </div>`).join('')
  + `<button onclick="budgetAdd('${type}')" style="width:100%;padding:7px;border:0.5px dashed #d1d5db;border-radius:8px;background:transparent;font-size:12px;font-weight:500;color:var(--t3);cursor:pointer;margin-top:8px">+ Add item</button>`;
}

function renderBudget() {
  const salary = budgetSalary();
  const goal = budgetData.savingsGoal;
  const totalFixed = budgetData.fixed.reduce((s,x)=>s+x.amt,0);
  const totalEss   = budgetData.essential.reduce((s,x)=>s+x.amt,0);
  const totalDisc  = budgetData.disc.reduce((s,x)=>s+x.amt,0);
  const spendable  = salary - goal;
  const afterFixed = spendable - totalFixed;
  const afterEss   = afterFixed - totalEss;
  const remaining  = afterEss - totalDisc;

  // Stats
  const statsEl = el('budget-stats');
  if (statsEl) statsEl.innerHTML = `
    <div class="kpi"><div class="kpi-lbl">Take-home</div><div class="kpi-val g-text">${fmt(salary)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Savings goal</div><div class="kpi-val" style="color:var(--green)">${fmt(goal)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Fixed costs</div><div class="kpi-val" style="color:var(--red)">${fmt(totalFixed)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Essentials est.</div><div class="kpi-val" style="color:var(--amber)">${fmt(totalEss)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Discretionary</div><div class="kpi-val" style="color:var(--blue)">${fmt(totalDisc)}</div></div>
    <div class="kpi" style="border:1.5px solid ${remaining>=0?'#d1fae5':'#fecaca'}">
      <div class="kpi-lbl">${remaining>=0?'Unallocated':'Over budget'}</div>
      <div class="kpi-val" style="color:${remaining>=0?'var(--green)':'var(--red)'}">${fmt(Math.abs(remaining))}</div>
    </div>`;

  // Bar
  const segs = [
    { label:'Savings', amt:goal,       color:'#1D9E75' },
    { label:'Fixed',   amt:totalFixed, color:'#E24B4A' },
    { label:'Essentials', amt:totalEss, color:'#BA7517' },
    { label:'Discretionary', amt:totalDisc, color:'#378ADD' },
  ].filter(s=>s.amt>0&&salary>0);
  const pctOf = (a,b) => b>0?Math.round(a/b*100):0;
  const barEl = el('budget-bar');
  if (barEl && salary>0) {
    barEl.innerHTML = `
      <div style="display:flex;height:10px;border-radius:20px;overflow:hidden;gap:1px;margin-bottom:10px">
        ${segs.map(s=>`<div style="height:10px;background:${s.color};width:${pctOf(s.amt,salary)}%;min-width:2px;transition:width .3s" title="${s.label}: ${fmt(s.amt)}"></div>`).join('')}
        ${remaining>0?`<div style="flex:1;background:#f0fdf4;min-width:0"></div>`:''}
        ${remaining<0?`<div style="width:${Math.min(pctOf(Math.abs(remaining),salary),20)}%;background:#fecaca;min-width:2px"></div>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px">
        ${segs.map(s=>`<span style="font-size:11px;color:var(--t2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block"></span>${s.label} ${pctOf(s.amt,salary)}%</span>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-top:8px;border-top:1px solid #f0fdf4">
        <div style="font-size:12px;color:var(--t2)">
          Spendable after savings: <strong style="color:var(--t)">${fmt(spendable)}</strong>
          &nbsp;·&nbsp; After fixed: <strong style="color:var(--t)">${fmt(afterFixed)}</strong>
          &nbsp;·&nbsp; After essentials: <strong style="color:var(--t)">${fmt(afterEss)}</strong>
        </div>
        <div style="font-size:12px;font-weight:600;color:${remaining>=0?'var(--green)':'var(--red)'}">
          ${remaining>=0?`${fmt(remaining)} left unallocated`:`Over budget by ${fmt(Math.abs(remaining))}`}
        </div>
      </div>`;
  }

  // Income section
  const incEl = el('budget-income-section');
  if (incEl) incEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:0.5px solid #f5f5f5">
      <span style="flex:1;font-size:13px;color:var(--t)">Monthly salary (take-home)</span>
      <input type="number" value="${salary}" oninput="budgetUpdateSalary(this.value)"
        style="width:110px;padding:5px 9px;border:1px solid #d1fae5;border-radius:8px;font-size:13px;font-weight:600;text-align:right;color:var(--t);background:transparent">
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0">
      <div style="flex:1"><div style="font-size:13px;color:var(--t)">Savings goal</div><div style="font-size:11px;color:var(--t3)">Taken off the top — non-negotiable</div></div>
      <input type="number" value="${goal}" oninput="budgetUpdateGoal(this.value)"
        style="width:110px;padding:5px 9px;border:1px solid #d1fae5;border-radius:8px;font-size:13px;font-weight:600;text-align:right;color:var(--green);background:transparent">
    </div>`;

  // Fixed/essential/disc sections
  const fEl = el('budget-fixed-section'); if(fEl) fEl.innerHTML = budgetRows(budgetData.fixed,'fixed');
  const eEl = el('budget-ess-section');   if(eEl) eEl.innerHTML = budgetRows(budgetData.essential,'essential');
  const dEl = el('budget-disc-section');  if(dEl) dEl.innerHTML = budgetRows(budgetData.disc,'disc');
}

// ── GROUP TAB TOGGLE — wired in DOMContentLoaded below ───────────

// ══════════════════════════════════════════════════════
// TRANSFER SUMMARY
// ══════════════════════════════════════════════════════
let editTransferId = null;
;

function buildTransferRows(rows) {
  const wrap = el('tr-rows'); if(!wrap) return;
  wrap.innerHTML = '';
  rows.forEach(r => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 120px auto;gap:6px;margin-bottom:6px;align-items:center';
    row.innerHTML = [
      '<input value="'+(r.desc||'').replace(/"/g,'&quot;')+'" placeholder="Description" style="padding:6px 9px;border:1px solid #d1fae5;border-radius:8px;font-size:12px;color:var(--t);background:transparent;font-family:var(--font)">',
      '<input type="number" value="'+(r.amt||'')+'" placeholder="Amount (฿)" style="padding:6px 9px;border:1px solid #d1fae5;border-radius:8px;font-size:12px;text-align:right;color:var(--t);background:transparent;font-family:var(--font)">',
      '<button onclick="this.parentElement.remove()" style="padding:4px 9px;border-radius:8px;border:1px solid #fecaca;background:#fff;color:#ef4444;cursor:pointer">x</button>'
    ].join('');
    wrap.appendChild(row);
  });
}

function collectTransferRows() {
  const rows = [];
  document.querySelectorAll('#tr-rows > div').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const desc = inputs[0]?.value.trim()||'';
    const amt  = parseFloat(inputs[1]?.value)||0;
    if(desc) rows.push({desc, amt});
  });
  return rows;
}

function renderTransfers() {
  const wrap = el('transfers-list'); if(!wrap) return;
  if(!transfers.length){
    wrap.innerHTML = `<div class="empty">No transfer summaries yet — create one to track what you owe or are owed</div>
      <div class="glass" style="padding:1.1rem;margin-top:1rem;background:rgba(16,185,129,.03);border:1px solid #d1fae5">
        <div style="font-size:13px;font-weight:600;color:#065f46;margin-bottom:6px">How to use this</div>
        <div style="font-size:12px;color:var(--t2);line-height:1.7">
          Add items you need to pay someone (positive amounts) and things they owe you back (negative amounts).
          The net total shows exactly what you need to transfer. Great for tracking monthly payments to parents for shared bills like gym, phone, groceries.
        </div>
      </div>`;
    return;
  }
  wrap.innerHTML = [...transfers].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(t => {
    const net = t.rows.reduce((s,r)=>s+r.amt,0);
    const owes = net > 0;
    const dateStr = t.date ? new Date(t.date+'T12:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '';

    // Copy text for sharing
    const copyText = [
      `Transfer Summary — ${t.title}`,
      dateStr ? `Date: ${dateStr}` : '',
      t.person ? `To: ${t.person}` : '',
      '',
      ...t.rows.map(r => `  ${r.desc}: ${r.amt>=0?'+':''}${r.amt>=0?'\u0E3F'+Math.abs(r.amt).toLocaleString():'-\u0E3F'+Math.abs(r.amt).toLocaleString()}`),
      '',
      `NET TOTAL: ${owes?'You transfer':t.person+' transfers'} \u0E3F${Math.abs(Math.round(net)).toLocaleString()}`,
      t.notes ? `Note: ${t.notes}` : ''
    ].filter(Boolean).join('\n');

    return `<div class="glass" style="padding:0;overflow:hidden;margin-bottom:.8rem">
      <div style="padding:1rem 1.1rem .75rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-family:var(--font-d);font-size:15px;font-weight:700;color:var(--t)">${t.title}</div>
          <div style="font-size:11px;color:var(--t3);margin-top:2px">${dateStr}${t.person?' · To: '+t.person:''}</div>
          ${t.notes?`<div style="font-size:11px;color:var(--t2);margin-top:2px;font-style:italic">${t.notes}</div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <div style="text-align:right">
            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:${owes?'#065f46':'#9ca3af'}">${owes?'You transfer':'They transfer'}</div>
            <div style="font-family:var(--font-d);font-size:20px;font-weight:800;color:${owes?'#10b981':'#3b82f6'}">${fmt(Math.abs(net))}</div>
          </div>
          <button onclick="copyTransfer(${t.id})" title="Copy to clipboard" style="padding:6px 12px;border-radius:8px;border:1px solid #d1fae5;background:#f0fdf4;font-size:12px;font-weight:600;color:#065f46;cursor:pointer">Copy</button>
          <button class="btn btn-g btn-sm" onclick="editTransfer(${t.id})">Edit</button>
          <button class="btn btn-d btn-sm" onclick="dTransfer(${t.id})">x</button>
        </div>
      </div>

      <div style="border-top:1px solid #f0fdf4">
        ${t.rows.map((r,i) => {
          const isNeg = r.amt < 0;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 1.1rem;border-bottom:${i<t.rows.length-1?'1px solid #f9fafb':'none'}">
            <span style="font-size:13px;color:var(--t2)">${r.desc}</span>
            <div style="display:flex;align-items:center;gap:8px">
              ${isNeg?'<span style="font-size:10px;color:#3b82f6;font-weight:600">they owe you</span>':''}
              <span style="font-family:var(--font-d);font-size:13px;font-weight:700;color:${isNeg?'#3b82f6':'var(--t)'}">${isNeg?'-':'+'}${fmt(Math.abs(r.amt))}</span>
            </div>
          </div>`;
        }).join('')}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 1.1rem;background:${owes?'rgba(16,185,129,.04)':'rgba(59,130,246,.04)'}">
          <span style="font-size:13px;font-weight:700;color:var(--t)">Net total</span>
          <span style="font-family:var(--font-d);font-size:16px;font-weight:800;color:${owes?'#10b981':'#3b82f6'}">${owes?'':'- '}${fmt(Math.abs(net))}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Store copy texts
  window._transferCopyTexts = {};
  transfers.forEach(t => {
    const net = t.rows.reduce((s,r)=>s+r.amt,0);
    const owes = net > 0;
    const dateStr = t.date ? new Date(t.date+'T12:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '';
    window._transferCopyTexts[t.id] = [
      `Transfer Summary — ${t.title}`,
      dateStr ? `Date: ${dateStr}` : '',
      t.person ? `To: ${t.person}` : '',
      '',
      ...t.rows.map(r => `  ${r.desc}: ${r.amt>=0?'+':''}\u0E3F${r.amt.toLocaleString()}`),
      '',
      `NET: ${owes?'I will transfer':'They will transfer'} \u0E3F${Math.abs(Math.round(net)).toLocaleString()}`,
      t.notes ? `Note: ${t.notes}` : ''
    ].filter(Boolean).join('\n');
  });
}

window.copyTransfer = async id => {
  const text = window._transferCopyTexts?.[id];
  if(!text) return;
  try {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard — paste it into LINE, WhatsApp, or any message app');
  } catch(e) {
    prompt('Copy this text:', text);
  }
};
