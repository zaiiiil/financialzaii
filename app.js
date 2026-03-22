// ── FIREBASE SETUP ────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7BoxdHTTbQyPQZEPje8c_IaaInbJUe8w",
  authDomain: "my-portal-fd675.firebaseapp.com",
  projectId: "my-portal-fd675",
  storageBucket: "my-portal-fd675.firebasestorage.app",
  messagingSenderId: "901831637749",
  appId: "1:901831637749:web:fa93c3208fff016036e3bc"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const DOC_ID = "finance";

// ── STORAGE (Firebase + localStorage fallback) ────────────────────
const LS = {
  g:  k => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } },
  gA: k => { try { return JSON.parse(localStorage.getItem(k) || '[]')   } catch { return [] }  },
  s:  (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
};

async function loadFromFirebase() {
  try {
    const snap = await getDoc(doc(db, "portals", DOC_ID));
    if (snap.exists()) {
      const d = snap.data();
      overview    = d.overview    || { income:0, saveTarget:0 };
      budget      = d.budget      || [];
      investments = d.investments || [];
      invMonthly  = d.invMonthly  || 0;
      months      = d.months      || [];
      principles  = d.principles  || [];
      banks       = d.banks       || [];
      mmIncome    = d.mmIncome    || { salary:0, autosave:0, autoinvest:0 };
      console.log("Loaded from Firebase");
    } else {
      // First time — migrate from localStorage
      await migrateFromLocalStorage();
    }
  } catch(e) {
    console.warn("Firebase load failed, using localStorage:", e);
  }
}

async function migrateFromLocalStorage() {
  const lsOverview = LS.g('fp_overview');
  if (lsOverview || LS.gA('mm_banks').length) {
    overview    = LS.g('fp_overview')    || { income:0, saveTarget:0 };
    budget      = LS.gA('fp_budget');
    investments = LS.gA('fp_investments');
    invMonthly  = LS.g('fp_inv_monthly') || 0;
    months      = LS.gA('fp_months');
    principles  = LS.gA('fp_principles');
    banks       = LS.gA('mm_banks');
    mmIncome    = LS.g('mm_income') || { salary:0, autosave:0, autoinvest:0 };
    await saveToFirebase();
    console.log("Migrated from localStorage to Firebase");
  }
}

async function saveToFirebase() {
  try {
    await setDoc(doc(db, "portals", DOC_ID), {
      overview, budget, investments, invMonthly,
      months, principles, banks, mmIncome
    });
  } catch(e) {
    console.warn("Firebase save failed:", e);
    // Fallback to localStorage
    LS.s('fp_overview', overview);
    LS.s('fp_budget', budget);
    LS.s('fp_investments', investments);
    LS.s('fp_inv_monthly', invMonthly);
    LS.s('fp_months', months);
    LS.s('fp_principles', principles);
    LS.s('mm_banks', banks);
    LS.s('mm_income', mmIncome);
  }
}

// ── STATE ─────────────────────────────────────────────────────────
let overview    = { income:0, saveTarget:0 };
let budget      = [];
let investments = [];
let invMonthly  = 0;
let months      = [];
let principles  = [];
let banks       = [];
let mmIncome    = { salary:0, autosave:0, autoinvest:0 };

let editBankIdx = null, editPrincipleId = null;
let bankFilter = 'all';
let selColor = '#10b981', selType = 'savings';

// ── CONSTANTS ─────────────────────────────────────────────────────
const INV_COLORS = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];
const INV_CATEGORIES = {
  'Fixed Income': { color:'#3b82f6', desc:'Bonds and debt instruments that pay regular interest. Lower risk than equities. You lend money to governments or companies and get predictable returns. The portfolio anchor.' },
  'Equities':     { color:'#10b981', desc:'Shares in companies. Higher growth potential but more volatile. Over long periods, equities have historically outperformed other asset classes.' },
  'Alternatives': { color:'#8b5cf6', desc:'Non-traditional assets like commodities, real estate, or multi-asset funds. They move differently from stocks and bonds, reducing overall portfolio risk through diversification.' },
  'Hedges':       { color:'#f59e0b', desc:'Assets designed to protect your portfolio when markets fall - like gold, managed futures, or trend-following funds. Cushion losses in downturns.' },
  'Other':        { color:'#9ca3af', desc:'Uncategorized investment.' }
};
const FUND_LEARN = {
  'KFAFIX-A':   'Fixed Income | 20% of portfolio. Thai investment-grade bond fund - government and high-quality corporate bonds. The most stable holding. Low volatility, predictable returns. The anchor when global markets get choppy.',
  'K-APB-A(A)': 'Fixed Income | 10% of portfolio. KAsset Asia Pacific Bond Fund - invests across Asian debt markets including Thailand, Singapore and Korea. Slightly higher yield than pure Thai bonds with modest currency exposure.',
  'CSPX':       'Equities | 16% of portfolio. iShares Core S&P 500 UCITS ETF - tracks the 500 largest US companies. Apple, Microsoft, Nvidia, Amazon. Broadest cheapest exposure to the American economy. Core long-term growth engine.',
  'TDIV':       'Equities | 16% of portfolio. VanEck Developed Markets Dividend Leaders ETF - top dividend-paying companies across Europe, US and developed Asia. Combines steady income with equity growth. Lower volatility than pure growth ETFs.',
  'VAPX':       'Equities | 10% of portfolio. Vanguard FTSE Asia Pacific ex Japan - South Korea, Australia, Taiwan, Hong Kong, Singapore. Captures Asia-Pacific growth without overexposure to Japan or China.',
  'DXJ':        'Equities | 7% of portfolio. WisdomTree Japan Hedged Equity Fund - Japanese stocks with USD/JPY currency risk removed. You get Japan equity performance without being hurt if the yen weakens further against the baht.',
  'EMXC':       'Equities | 6% of portfolio. iShares MSCI Emerging Markets ex China - India, Taiwan, Korea, Brazil, Mexico and more, deliberately excluding China. Captures EM growth while avoiding China-specific political and regulatory risk.',
  'HGER':       'Alternatives | 5% of portfolio. Harbor Commodity All-Weather Strategy - broad commodities (energy, metals, agriculture). Rises with inflation. Protects purchasing power when bonds and stocks both struggle. Portfolio inflation shield.',
  'IGF':        'Alternatives | 5% of portfolio. iShares Global Infrastructure ETF - airports, toll roads, utilities, pipelines worldwide. Highly stable cash flows. Defensive in downturns, benefits from infrastructure spending cycles.',
  'DBMF':       'Hedges | 5% of portfolio. iMGP DBi Managed Futures Strategy - replicates hedge fund trend-following. Historically profits during major crashes (2008, 2020, 2022). Portfolio insurance. May underperform in calm bull markets.'
};
const PORTFOLIO_TEMPLATE = [
  { name:'KFAFIX-A',   ticker:'KFAFIX-A',   cat:'Fixed Income', pct:20 },
  { name:'K-APB-A(A)', ticker:'K-APB-A(A)', cat:'Fixed Income', pct:10 },
  { name:'CSPX',       ticker:'CSPX',       cat:'Equities',     pct:16 },
  { name:'TDIV',       ticker:'TDIV',       cat:'Equities',     pct:16 },
  { name:'VAPX',       ticker:'VAPX',       cat:'Equities',     pct:10 },
  { name:'DXJ',        ticker:'DXJ',        cat:'Equities',     pct:7  },
  { name:'EMXC',       ticker:'EMXC',       cat:'Equities',     pct:6  },
  { name:'HGER',       ticker:'HGER',       cat:'Alternatives', pct:5  },
  { name:'IGF',        ticker:'IGF',        cat:'Alternatives', pct:5  },
  { name:'DBMF',       ticker:'DBMF',       cat:'Hedges',       pct:5  }
];
const SPEND_CATS = [
  { key:'shopping',      label:'Shopping & Clothes',    icon:'[shop]' },
  { key:'transport',     label:'Transport',              icon:'[car]' },
  { key:'health',        label:'Health & Wellness',      icon:'[health]' },
  { key:'entertainment', label:'Entertainment',          icon:'[fun]' },
  { key:'travel',        label:'Travel',                 icon:'[plane]' },
  { key:'rent',          label:'Rent & Bills',           icon:'[home]' },
  { key:'beauty',        label:'Personal Care & Beauty', icon:'[beauty]' },
  { key:'food',          label:'Eating Out & Cafes',     icon:'[cafe]' },
  { key:'subs',          label:'Subscriptions',          icon:'[phone]' }
];
const TYPE_LABELS = { savings:'Savings', checking:'Checking', investment:'Equities', fixed:'Fixed Deposit', fixedincome:'Fixed Income', alternatives:'Alternatives', hedges:'Hedges', gold:'Gold' };
const TYPE_COLORS = { savings:'#10b981', checking:'#3b82f6', investment:'#10b981', fixed:'#06b6d4', fixedincome:'#3b82f6', alternatives:'#8b5cf6', hedges:'#f59e0b', gold:'#f59e0b' };

// ── HELPERS ───────────────────────────────────────────────────────
const BAHT = '\u0E3F';
const fmt = n => BAHT + Math.round(n||0).toLocaleString();
const pct = (a,b) => b > 0 ? Math.round(a/b*100) : 0;
const v   = id => document.getElementById(id)?.value.trim() || '';
const sv  = (id,val) => { const e = document.getElementById(id); if(e) e.value = val||''; };
const el  = id => document.getElementById(id);
const fD  = s => { if(!s) return ''; return new Date(s+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
const fM  = s => { if(!s) return ''; const [y,m] = s.split('-'); return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}); };

// ── DERIVED ───────────────────────────────────────────────────────
const totalSavingsFromBanks  = () => banks.filter(b => ['savings','fixed','checking'].includes(b.type)).reduce((s,b) => s+b.amount, 0);
const totalInvestedFromBanks = () => banks.filter(b => b.type==='investment').reduce((s,b) => s+b.amount, 0);
const totalWealthFromBanks   = () => banks.reduce((s,b) => s+b.amount, 0);

// ── SAVE SHORTCUT ─────────────────────────────────────────────────
const save = () => saveToFirebase();

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  el('hdate').textContent = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  // Show loading state
  document.querySelectorAll('.panel').forEach(p => p.style.opacity = '0.4');

  await loadFromFirebase();

  // Restore opacity
  document.querySelectorAll('.panel').forEach(p => p.style.opacity = '1');

  // Tabs
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    el('p-' + b.dataset.t)?.classList.add('active');
  }));

  const ov = el('ov');
  ov.addEventListener('click', () => {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    ov.classList.remove('open');
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeM(b.dataset.close)));

  el('color-row')?.addEventListener('click', e => {
    const sw = e.target.closest('.color-swatch'); if (!sw) return;
    document.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('sel'));
    sw.classList.add('sel'); selColor = sw.dataset.color;
  });

  el('type-pills')?.addEventListener('click', e => {
    const p = e.target.closest('.type-pill'); if (!p) return;
    document.querySelectorAll('.type-pill').forEach(x => x.classList.remove('sel'));
    p.classList.add('sel'); selType = p.dataset.type;
  });

  el('bank-filter-bar')?.addEventListener('click', e => {
    const fc = e.target.closest('.fc'); if (!fc) return;
    document.querySelectorAll('#bank-filter-bar .fc').forEach(x => x.classList.remove('active'));
    fc.classList.add('active'); bankFilter = fc.dataset.f; renderBanks();
  });

  SPEND_CATS.forEach(c => {
    el('ms-'+c.key)?.addEventListener('input', autoSumSpending);
  });

  // Overview
  el('btn-edit-overview')?.addEventListener('click', () => {
    sv('ov-income', overview.income||mmIncome.salary);
    sv('ov-save-target', overview.saveTarget);
    openM('m-overview');
  });
  el('sv-overview')?.addEventListener('click', async () => {
    overview = { income:+v('ov-income'), saveTarget:+v('ov-save-target') };
    await save(); renderOverview(); closeM('m-overview');
  });

  // Budget
  el('btn-set-income')?.addEventListener('click', () => { sv('inc-val', overview.income||mmIncome.salary); openM('m-income'); });
  el('sv-income')?.addEventListener('click', async () => {
    overview.income = +v('inc-val');
    await save(); renderOverview(); renderBudget(); closeM('m-income');
  });
  el('btn-add-budget')?.addEventListener('click', () => openM('m-budget'));
  el('sv-budget')?.addEventListener('click', async () => {
    const name = v('bc-name'); if (!name) return;
    budget.push({ id:Date.now(), name, emoji:el('bc-emoji').value.trim()||'*', amount:+v('bc-amount')||0, color:el('bc-color').value });
    await save(); renderBudget(); renderOverview();
    ['bc-name','bc-amount'].forEach(id => sv(id,'')); closeM('m-budget');
  });
  window.dBudget = async i => { budget.splice(i,1); await save(); renderBudget(); renderOverview(); };

  // Investments
  el('btn-set-inv-budget')?.addEventListener('click', () => { sv('inv-monthly', invMonthly); openM('m-inv-budget'); });
  el('sv-inv-budget')?.addEventListener('click', async () => {
    invMonthly = +v('inv-monthly'); await save(); renderInvestments(); closeM('m-inv-budget');
  });
  el('btn-load-portfolio')?.addEventListener('click', async () => {
    if (investments.length > 0) {
      if (!confirm('This will replace your current investments with the 10-fund portfolio from your dashboard. Continue?')) return;
    }
    investments = PORTFOLIO_TEMPLATE.map((t,i) => ({ ...t, id:Date.now()+i, note:'', color:INV_COLORS[i%INV_COLORS.length] }));
    await save(); renderInvestments();
  });
  el('btn-add-inv')?.addEventListener('click', () => openM('m-inv'));
  el('sv-inv')?.addEventListener('click', async () => {
    const name = v('inv-name'); if (!name) return;
    const cat = el('inv-cat')?.value || 'Other';
    investments.push({ id:Date.now(), name, ticker:v('inv-ticker'), pct:+v('inv-pct')||0, cat, note:v('inv-note'), color:INV_COLORS[investments.length%INV_COLORS.length] });
    await save(); renderInvestments();
    ['inv-name','inv-ticker','inv-pct','inv-note'].forEach(id => sv(id,'')); closeM('m-inv');
  });
  window.dInv = async i => { investments.splice(i,1); await save(); renderInvestments(); };

  // Monthly Spending
  el('btn-add-month')?.addEventListener('click', () => {
    const now = new Date();
    sv('ms-month', `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
    SPEND_CATS.forEach(c => sv('ms-'+c.key,''));
    sv('ms-total','');
    openM('m-month');
  });
  el('sv-month')?.addEventListener('click', async () => {
    const month = v('ms-month'); if (!month) return;
    const entry = { month };
    SPEND_CATS.forEach(c => { entry[c.key] = +(el('ms-'+c.key)?.value||0); });
    entry.total = SPEND_CATS.reduce((s,c) => s+entry[c.key], 0);
    const existing = months.findIndex(m => m.month === month);
    if (existing >= 0) months[existing] = entry; else months.push(entry);
    await save(); renderSpending(); renderOverview();
    SPEND_CATS.forEach(c => sv('ms-'+c.key,'')); sv('ms-total',''); closeM('m-month');
  });
  window.dMonth = async month => { months = months.filter(m => m.month !== month); await save(); renderSpending(); renderOverview(); };

  // Money Map
  el('btn-edit-mm-income')?.addEventListener('click', () => {
    sv('ic-salary', mmIncome.salary); sv('ic-autosave', mmIncome.autosave); sv('ic-autoinvest', mmIncome.autoinvest); openM('m-mm-income');
  });
  el('sv-mm-income')?.addEventListener('click', async () => {
    mmIncome = { salary:+v('ic-salary')||0, autosave:+v('ic-autosave')||0, autoinvest:+v('ic-autoinvest')||0 };
    await save(); renderMoneyMap(); renderOverview(); closeM('m-mm-income');
  });
  el('btn-add-bank')?.addEventListener('click', () => {
    editBankIdx = null;
    selColor = '#10b981'; selType = 'savings';
    document.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('sel'));
    document.querySelector('.color-swatch[data-color="#10b981"]')?.classList.add('sel');
    document.querySelectorAll('.type-pill').forEach(x => x.classList.remove('sel'));
    document.querySelector('.type-pill[data-type="savings"]')?.classList.add('sel');
    el('m-bank-title').textContent = 'Add Bank / Account';
    el('sv-bank').textContent = 'Save';
    ['bk-name','bk-nick','bk-amount','bk-purpose','bk-notes','bk-return'].forEach(id => sv(id,''));
    openM('m-bank');
  });
  el('sv-bank')?.addEventListener('click', async () => {
    const name = v('bk-name'); if (!name) return;
    const entry = { name, nick:v('bk-nick'), type:selType, amount:+v('bk-amount')||0, purpose:v('bk-purpose'), color:selColor, notes:v('bk-notes'), returnPct:v('bk-return') };
    if (editBankIdx !== null) {
      banks[editBankIdx] = { ...banks[editBankIdx], ...entry };
      editBankIdx = null;
    } else {
      banks.push({ id:Date.now(), ...entry });
    }
    el('m-bank-title').textContent = 'Add Bank / Account';
    el('sv-bank').textContent = 'Save';
    await save(); renderMoneyMap(); renderOverview();
    ['bk-name','bk-nick','bk-amount','bk-purpose','bk-notes','bk-return'].forEach(id => sv(id,'')); closeM('m-bank');
  });
  el('sv-edit-bank')?.addEventListener('click', async () => {
    if (editBankIdx === null) return;
    banks[editBankIdx].amount = +v('eb-amount')||0;
    if (v('eb-notes')) banks[editBankIdx].notes = v('eb-notes');
    await save(); renderMoneyMap(); renderOverview(); closeM('m-edit-bank'); editBankIdx = null;
  });
  window.editBank = i => {
  editBankIdx = i;
  const b = banks[i];
  // Pre-fill full add bank modal for editing
  sv('bk-name', b.name); sv('bk-nick', b.nick||''); sv('bk-amount', b.amount);
  sv('bk-purpose', b.purpose||''); sv('bk-notes', b.notes||'');
  sv('bk-return', b.returnPct||'');
  selColor = b.color; selType = b.type;
  document.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('sel'));
  document.querySelector(`.color-swatch[data-color="${b.color}"]`)?.classList.add('sel');
  document.querySelectorAll('.type-pill').forEach(x => x.classList.remove('sel'));
  document.querySelector(`.type-pill[data-type="${b.type}"]`)?.classList.add('sel');
  el('m-bank-title').textContent = 'Edit Account';
  el('sv-bank').textContent = 'Save Changes';
  openM('m-bank');
};
  window.dBank = async i => { banks.splice(i,1); await save(); renderMoneyMap(); renderOverview(); };

  // Principles
  el('btn-add-principle')?.addEventListener('click', () => {
    editPrincipleId = null;
    el('pr-modal-title').textContent = 'Add Principle';
    ['pr-title','pr-body','pr-tag'].forEach(id => sv(id,''));
    openM('m-principle');
  });
  el('sv-principle')?.addEventListener('click', async () => {
    const title = v('pr-title'); if (!title) return;
    if (editPrincipleId) {
      const p = principles.find(x => x.id === editPrincipleId);
      if (p) { p.title = title; p.body = v('pr-body'); p.tag = v('pr-tag'); }
    } else {
      principles.push({ id:Date.now(), title, body:v('pr-body'), tag:v('pr-tag') });
    }
    await save(); renderPrinciples();
    ['pr-title','pr-body','pr-tag'].forEach(id => sv(id,'')); editPrincipleId = null; closeM('m-principle');
  });
  window.editPrinciple = id => {
    editPrincipleId = id;
    const p = principles.find(x => x.id === id); if (!p) return;
    el('pr-modal-title').textContent = 'Edit Principle';
    sv('pr-title', p.title); sv('pr-body', p.body||''); sv('pr-tag', p.tag||'');
    openM('m-principle');
  };
  window.dPrinciple = async id => { principles = principles.filter(x => x.id !== id); await save(); renderPrinciples(); };

  renderOverview(); renderBudget(); renderInvestments();
  renderSpending(); renderMoneyMap(); renderPrinciples();
});

// ── MODALS ────────────────────────────────────────────────────────
function openM(id) { el('ov').classList.add('open'); el(id)?.classList.add('open'); }
function closeM(id) { el('ov').classList.remove('open'); el(id)?.classList.remove('open'); }

// ── AUTO-SUM ──────────────────────────────────────────────────────
function autoSumSpending() {
  const total = SPEND_CATS.reduce((s,c) => s + (+(el('ms-'+c.key)?.value||0)), 0);
  const totalEl = el('ms-total');
  if (totalEl) totalEl.value = total || '';
}

// ── OVERVIEW ──────────────────────────────────────────────────────
function renderOverview() {
  const income = overview.income || mmIncome.salary;
  const saveTarget = overview.saveTarget;
  const savings = totalSavingsFromBanks();
  const invested = totalInvestedFromBanks();
  const total = totalWealthFromBanks();
  const rate = income > 0 ? pct(saveTarget, income) : 0;
  const totalBudgeted = budget.reduce((s,b) => s+b.amount, 0);
  const remaining = income - totalBudgeted - saveTarget;
  el('kpi-overview').innerHTML = `
    <div class="kpi"><div class="kpi-lbl">Monthly Income</div><div class="kpi-val g-text">${fmt(income)}</div><div class="kpi-sub">from Money Map</div></div>
    <div class="kpi"><div class="kpi-lbl">Total Savings</div><div class="kpi-val">${fmt(savings)}</div><div class="kpi-sub">from accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">Total Invested</div><div class="kpi-val" style="color:var(--blue)">${fmt(invested)}</div><div class="kpi-sub">from accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">Net Worth</div><div class="kpi-val g-text">${fmt(total)}</div><div class="kpi-sub">all accounts combined</div></div>
  `;
  el('savings-rate-card').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div><div style="font-family:var(--font-d);font-size:15px;font-weight:700">Savings Rate</div>
      <div style="font-size:11px;color:var(--t3);margin-top:1px">Target ${fmt(saveTarget)} / month</div></div>
      <div style="font-family:var(--font-d);font-size:30px;font-weight:800" class="g-text">${rate}%</div>
    </div>
    <div class="pbar-bg"><div class="pbar" style="width:${Math.min(rate,100)}%"></div></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-top:8px">
      <span>Budgeted: ${fmt(totalBudgeted)}</span><span>Saved: ${fmt(saveTarget)}</span>
      <span style="color:${remaining>=0?'var(--green)':'var(--red)'}">${remaining>=0?'Unallocated':'Over'}: ${fmt(Math.abs(remaining))}</span>
    </div>
    <div style="font-size:11px;color:var(--t3);margin-top:10px;font-style:italic">Savings &amp; invested totals auto-update from your Money Map accounts</div>
  `;
  const sorted = [...months].sort((a,b) => b.month.localeCompare(a.month));
  const latest = sorted[0] || null;
  const prev = sorted[1] || null;
  const ovMonth = el('overview-month');
  if (!latest) { ovMonth.innerHTML = '<div class="empty">No monthly data yet - log your first month in Monthly Spending</div>'; return; }
  const topCats = SPEND_CATS.filter(c => latest[c.key]>0).sort((a,b) => latest[b.key]-latest[a.key]).slice(0,4);
  ovMonth.innerHTML = `<div class="glass" style="padding:1.1rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-family:var(--font-d);font-size:14px;font-weight:700">${fM(latest.month)}</span>
      <span style="font-family:var(--font-d);font-size:16px;font-weight:800" class="g-text">${fmt(latest.total)}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px">
      ${topCats.map(c => {
        const diff = prev ? latest[c.key] - (prev[c.key]||0) : null;
        return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <span style="font-size:12px;color:var(--t2);flex:1">${c.label}</span>
          <div style="text-align:right">
            <div style="font-family:var(--font-d);font-size:12px;font-weight:700">${fmt(latest[c.key])}</div>
            ${diff!==null&&diff!==0?`<div style="font-size:10px;color:${diff>0?'var(--red)':'var(--green)'};font-weight:600">${diff>0?'+':'-'} ${fmt(Math.abs(diff))}</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── BUDGET ────────────────────────────────────────────────────────
function renderBudget() {
  const inc = overview.income || mmIncome.salary;
  const total = budget.reduce((s,b) => s+b.amount, 0);
  const remaining = inc - total;
  el('budget-income-bar').innerHTML = inc > 0 ? `
    <div class="glass" style="padding:1.1rem;margin-bottom:1.2rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-family:var(--font-d);font-size:14px;font-weight:700">Monthly: ${fmt(inc)}</span>
        <span style="font-size:12px;font-weight:600;color:${remaining>=0?'var(--green)':'var(--red)'}">${remaining>=0?'Unallocated':'Over'}: ${fmt(Math.abs(remaining))}</span>
      </div>
      <div style="display:flex;height:10px;border-radius:20px;overflow:hidden;gap:1px">
        ${budget.map(b=>`<div style="height:10px;background:${b.color};width:${pct(b.amount,inc)}%;min-width:${b.amount>0?2:0}px" title="${b.name}: ${fmt(b.amount)}"></div>`).join('')}
        <div style="flex:1;background:#f0fdf4;min-width:0"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        ${budget.map(b=>`<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--t2)"><div style="width:8px;height:8px;border-radius:50%;background:${b.color}"></div>${b.name}: ${fmt(b.amount)} (${pct(b.amount,inc)}%)</div>`).join('')}
      </div>
    </div>` : '<div class="empty" style="margin-bottom:1.2rem">Set your monthly income first</div>';
  const grid = el('budget-grid');
  if (!budget.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">No budget categories yet</div>'; return; }
  grid.innerHTML = budget.map((b,i) => `
    <div class="glass budget-cat">
      <div class="bc-top">
        <div class="bc-name"><div class="bc-dot" style="background:${b.color}"></div>${b.emoji} ${b.name}</div>
        <div style="text-align:right">
          <div style="font-family:var(--font-d);font-size:14px;font-weight:700;color:${b.color}">${fmt(b.amount)}</div>
          <div style="font-size:10px;color:var(--t3)">${inc>0?pct(b.amount,inc):0}% of income</div>
        </div>
      </div>
      <div class="pbar-bg"><div class="pbar" style="width:${inc>0?pct(b.amount,inc):0}%;background:${b.color}"></div></div>
      <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-d" onclick="dBudget(${i})">Remove</button></div>
    </div>`).join('');
}

// ── INVESTMENTS ───────────────────────────────────────────────────
function renderInvestments() {
  const totalPct = investments.reduce((s,i) => s+i.pct, 0);

  // Build category summary
  const catSums = {};
  investments.forEach(inv => {
    const cat = inv.cat || 'Other';
    catSums[cat] = (catSums[cat] || 0) + inv.pct;
  });

  el('inv-summary').innerHTML = `
    <div class="kpi-grid" style="margin-bottom:1.2rem">
      <div class="kpi"><div class="kpi-lbl">Monthly Amount</div><div class="kpi-val g-text">${fmt(invMonthly)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Funds / ETFs</div><div class="kpi-val">${investments.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Allocated</div><div class="kpi-val" style="color:${totalPct>100?'var(--red)':totalPct===100?'var(--green)':'var(--amber)'}">${totalPct}%</div><div class="kpi-sub">${totalPct===100?'Perfect':'Target: 100%'}</div></div>
    </div>
    ${Object.keys(catSums).length > 0 ? `
    <div class="glass" style="padding:1.1rem;margin-bottom:1.2rem">
      <div style="font-family:var(--font-d);font-size:13px;font-weight:700;margin-bottom:12px">Portfolio by Asset Class</div>
      <div style="display:flex;height:10px;border-radius:20px;overflow:hidden;gap:1px;margin-bottom:10px">
        ${Object.entries(catSums).map(([cat,p])=>`<div style="height:10px;background:${(INV_CATEGORIES[cat]||INV_CATEGORIES['Other']).color};width:${p}%;min-width:2px;transition:width .5s" title="${cat}: ${p}%"></div>`).join('')}
        ${totalPct<100?`<div style="flex:1;background:#f0fdf4"></div>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${Object.entries(catSums).map(([cat,p])=>{
          const catDef = INV_CATEGORIES[cat] || INV_CATEGORIES['Other'];
          return `<div style="position:relative;display:inline-block">
            <div class="inv-cat-pill" style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2);cursor:help;padding:3px 8px;border-radius:20px;background:${catDef.color}15;border:1px solid ${catDef.color}30" title="${catDef.desc}">
              <div style="width:8px;height:8px;border-radius:50%;background:${catDef.color};flex-shrink:0"></div>
              <strong>${cat}</strong>: ${p}%
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}`;

  const barWrap = el('alloc-bar-wrap');
  if (!investments.length) { barWrap.innerHTML = '<div class="empty">Add ETFs to see allocation</div>'; el('inv-grid').innerHTML = ''; return; }
  barWrap.innerHTML = `
    <div class="alloc-bar">${investments.map(inv=>{
      const c = inv.cat ? (INV_CATEGORIES[inv.cat]||INV_CATEGORIES['Other']).color : inv.color;
      return `<div class="alloc-seg" style="width:${inv.pct}%;background:${c}" title="${inv.ticker||inv.name}: ${inv.pct}%"></div>`;
    }).join('')}${totalPct<100?`<div class="alloc-seg" style="width:${100-totalPct}%;background:#f0fdf4"></div>`:''}</div>
    <div class="alloc-legend" style="margin-top:.5rem">${investments.map(inv=>{
      const c = inv.cat ? (INV_CATEGORIES[inv.cat]||INV_CATEGORIES['Other']).color : inv.color;
      return `<div class="alloc-leg"><div class="alloc-dot" style="background:${c}"></div>${inv.ticker||inv.name}: ${inv.pct}%</div>`;
    }).join('')}</div>`;

  el('inv-grid').innerHTML = investments.map((inv,i) => {
    const monthly = invMonthly * inv.pct / 100;
    const catDef = inv.cat ? (INV_CATEGORIES[inv.cat]||INV_CATEGORIES['Other']) : null;
    const c = catDef ? catDef.color : inv.color;
    const learnText = FUND_LEARN[inv.ticker] || FUND_LEARN[inv.name] || '';
    return `<div class="glass inv-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:700;color:var(--t);position:relative;cursor:help" title="${learnText||inv.name}">${inv.name}</span>
            ${learnText?`<span style="font-size:9px;background:rgba(16,185,129,.12);color:#065f46;padding:1px 6px;border-radius:10px;font-weight:600">hover for info</span>`:''}
          </div>
          <div style="font-size:11px;color:var(--t3);margin-top:1px">${inv.ticker||'-'}</div>
          ${catDef?`<div style="margin-top:4px"><span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${catDef.color}15;color:${catDef.color}">${inv.cat}</span></div>`:''}
        </div>
        <div style="font-family:var(--font-d);font-size:20px;font-weight:800;color:${c}">${inv.pct}%</div>
      </div>
      ${learnText?`<div style="font-size:11px;color:var(--t2);background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:.5rem .75rem;margin-bottom:8px;line-height:1.5">${learnText}</div>`:''}
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;background:#f0fdf4;border-radius:20px;height:5px;overflow:hidden"><div style="height:5px;border-radius:20px;background:${c};width:${Math.min(inv.pct,100)}%"></div></div>
        <span style="font-size:11px;color:var(--t3);white-space:nowrap">${fmt(monthly)}/mo</span>
      </div>
      ${inv.note?`<div style="font-size:11px;color:var(--t2);margin-top:8px;line-height:1.5">${inv.note}</div>`:''}
      <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-d" onclick="dInv(${i})">Remove</button></div>
    </div>`;
  }).join('');
}

// ── MONTHLY SPENDING ──────────────────────────────────────────────
function renderSpending() {
  const sorted = [...months].sort((a,b) => b.month.localeCompare(a.month));
  const last6 = sorted.slice(0,6).reverse();
  const maxTotal = Math.max(...last6.map(m => m.total), 1);
  const trendEl = el('spending-trend');
  if (last6.length > 1) {
    trendEl.innerHTML = `<div class="glass" style="padding:1.1rem;margin-bottom:1.2rem">
      <div style="font-family:var(--font-d);font-size:13px;font-weight:700;margin-bottom:12px">6-Month Trend</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:80px">
        ${last6.map(m=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <div style="width:100%;background:linear-gradient(180deg,#10b981,#3b82f6);border-radius:6px 6px 0 0;height:${Math.round(m.total/maxTotal*64)}px;min-height:4px" title="${fmt(m.total)}"></div>
          <div style="font-size:9px;color:var(--t3);text-align:center">${fM(m.month).split(' ')[0].slice(0,3)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  } else { trendEl.innerHTML = ''; }
  const wrap = el('month-list');
  if (!sorted.length) { wrap.innerHTML = '<div class="empty">No months logged yet - click "+ Log Month"</div>'; return; }
  wrap.innerHTML = sorted.map((m, idx) => {
    const prev = sorted[idx+1] || null;
    const cats = SPEND_CATS.filter(c => m[c.key] > 0);
    const totalDiff = prev ? m.total - prev.total : null;
    return `<div class="glass month-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-family:var(--font-d);font-size:15px;font-weight:700">${fM(m.month)}</span>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:right">
            <div style="font-family:var(--font-d);font-size:15px;font-weight:800" class="g-text">${fmt(m.total)}</div>
            ${totalDiff!==null?`<div style="font-size:10px;font-weight:600;color:${totalDiff>0?'var(--red)':'var(--green)'}">${totalDiff>0?'+':'-'} ${fmt(Math.abs(totalDiff))} vs prev</div>`:''}
          </div>
          <button class="btn btn-d" onclick="dMonth('${m.month}')">Delete</button>
        </div>
      </div>
      <div class="month-cats">
        ${cats.map(c => {
          const diff = prev ? m[c.key] - (prev[c.key]||0) : null;
          return `<div class="cat-row">
            <span style="font-size:12px;color:var(--t2);flex:1">${c.label}</span>
            <div style="text-align:right">
              <div style="font-family:var(--font-d);font-size:12px;font-weight:700">${fmt(m[c.key])}</div>
              ${diff!==null&&diff!==0?`<div style="font-size:10px;font-weight:600;color:${diff>0?'var(--red)':'var(--green)'}">${diff>0?'+':'-'} ${fmt(Math.abs(diff))}</div>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── MONEY MAP ─────────────────────────────────────────────────────
function renderMoneyMap() { renderMMKPIs(); renderIncomeFlow(); renderBanks(); renderPie(); renderAllocSummary(); }
function renderMMKPIs() {
  const savings = totalSavingsFromBanks(), invested = totalInvestedFromBanks(), total = totalWealthFromBanks();
  const spending = Math.max(mmIncome.salary - mmIncome.autosave - mmIncome.autoinvest, 0);
  el('mm-kpi-grid').innerHTML = `
    <div class="kpi"><div class="kpi-lbl">Total Wealth</div><div class="kpi-val g-text">${fmt(total)}</div><div class="kpi-sub">all accounts</div></div>
    <div class="kpi"><div class="kpi-lbl">In Banks / Savings</div><div class="kpi-val">${fmt(savings)}</div><div class="kpi-sub">${pct(savings,total)}% of total</div></div>
    <div class="kpi"><div class="kpi-lbl">Invested</div><div class="kpi-val" style="color:var(--blue)">${fmt(invested)}</div><div class="kpi-sub">${pct(invested,total)}% of total</div></div>
    <div class="kpi"><div class="kpi-lbl">Monthly Salary</div><div class="kpi-val" style="color:var(--green)">${fmt(mmIncome.salary)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Spending Budget</div><div class="kpi-val" style="color:var(--amber)">${fmt(spending)}</div><div class="kpi-sub">after savings &amp; invest</div></div>
  `;
}
function renderIncomeFlow() {
  const { salary, autosave, autoinvest } = mmIncome;
  const spending = Math.max(salary - autosave - autoinvest, 0);
  const wrap = el('income-flow');
  if (!salary) { wrap.innerHTML = '<div class="empty">Click "Edit Income" to set up your monthly salary flow</div>'; return; }
  const rows = [
    { label:'Savings - auto-transfer on payday', amt:autosave, color:'#10b981' },
    { label:'Investments - auto-invest on payday', amt:autoinvest, color:'#3b82f6' },
    { label:'Monthly spending budget', amt:spending, color:'#f59e0b' }
  ];
  wrap.innerHTML = `<div style="font-family:var(--font-d);font-size:13px;font-weight:700;margin-bottom:14px">Every month, the second your salary lands</div>
    ${rows.map(r=>`<div class="flow-row">
      <div class="flow-icon" style="background:${r.color}18;width:34px;height:34px;border-radius:10px;flex-shrink:0"></div>
      <div style="flex:1"><div style="font-size:12px;font-weight:500;color:var(--t2)">${r.label}</div><div class="flow-bar"><div class="flow-bar-fill" style="background:${r.color};width:${pct(r.amt,salary)}%"></div></div></div>
      <div style="text-align:right;flex-shrink:0"><div style="font-family:var(--font-d);font-size:14px;font-weight:700;color:${r.color}">${fmt(r.amt)}</div><div style="font-size:10px;color:var(--t3)">${pct(r.amt,salary)}%</div></div>
    </div>`).join('')}
    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0fdf4;display:flex;justify-content:space-between;font-size:11px;color:var(--t3)">
      <span>Total: ${fmt(salary)}</span>
      <span style="color:${salary-autosave-autoinvest>=0?'var(--green)':'var(--red)'}">${salary-autosave-autoinvest>=0?'Balanced':'Over-allocated'}</span>
    </div>`;
}
function renderBanks() {
  const total = totalWealthFromBanks();
  const filtered = bankFilter==='all' ? banks : banks.filter(b => b.type===bankFilter);
  const wrap = el('bank-list');
  if (!filtered.length) { wrap.innerHTML = '<div class="empty">No accounts yet - click "+ Add Account"</div>'; return; }
  wrap.innerHTML = filtered.map(b => {
    const ri = banks.indexOf(b), p = pct(b.amount, total);
    const init = b.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const typeColor = TYPE_COLORS[b.type] || b.color;
    return `<div class="glass bank-card">
      <div class="bank-init" style="background:${typeColor}">${init}</div>
      <div class="bank-body">
        <div class="bank-name">${b.nick||b.name}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap">
          <span style="font-size:11px;color:var(--t3)">${b.name}</span>
          <span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;background:${typeColor}18;color:${typeColor}">${TYPE_LABELS[b.type]||b.type}</span>
          ${b.returnPct?`<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;background:rgba(16,185,129,.1);color:#065f46">+${b.returnPct}% p.a.</span>`:''}
        </div>
        ${b.purpose?`<div style="font-size:11px;color:var(--t2);margin-top:3px">${b.purpose}</div>`:''}
        ${b.notes?`<div style="font-size:11px;color:var(--t3);margin-top:1px">${b.notes}</div>`:''}
        <div class="bank-bar"><div class="bank-bar-fill" style="background:${typeColor};width:${p}%"></div></div>
      </div>
      <div class="bank-right">
        <div class="bank-amt">${fmt(b.amount)}</div>
        <div class="bank-pct-badge" style="background:${typeColor}">${p}% of wealth</div>
        <div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end">
          <button class="btn btn-g btn-sm" onclick="editBank(${ri})" title="Edit all fields">✏ Edit</button>
          <button class="btn btn-d" onclick="dBank(${ri})">x</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function renderPie() {
  const total = totalWealthFromBanks();
  el('pie-center-val').textContent = fmt(total);
  const canvas = el('pie-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=200,H=200,cx=W/2,cy=H/2,R=88,RI=56;
  ctx.clearRect(0,0,W,H);

  // Group by asset type
  const typeMap = {};
  banks.filter(b => b.amount > 0).forEach(b => {
    const label = TYPE_LABELS[b.type] || b.type;
    const color = TYPE_COLORS[b.type] || b.color;
    if (!typeMap[label]) typeMap[label] = { amount:0, color };
    typeMap[label].amount += b.amount;
  });
  const segments = Object.entries(typeMap).map(([label,v]) => ({ label, amount:v.amount, color:v.color })).sort((a,b)=>b.amount-a.amount);

  if (!segments.length||total===0) {
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fillStyle='#f0fdf4'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,RI,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.95)'; ctx.fill();
    el('pie-legend').innerHTML = '<div style="font-size:12px;color:#a7f3d0;font-style:italic">Add accounts to see your wealth map</div>';
    return;
  }
  let startAngle = -Math.PI/2;
  segments.forEach(seg => {
    const sliceAngle = seg.amount/total*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,startAngle,startAngle+sliceAngle); ctx.closePath();
    ctx.fillStyle = seg.color; ctx.fill();
    startAngle += sliceAngle;
  });
  ctx.beginPath(); ctx.arc(cx,cy,RI,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.95)'; ctx.fill();
  el('pie-legend').innerHTML = segments.map(s => `
    <div class="pie-leg-row">
      <div class="pie-dot" style="background:${s.color}"></div>
      <span class="pie-leg-label">${s.label}</span>
      <span class="pie-leg-amt">${fmt(s.amount)}</span>
      <span class="pie-leg-pct">${pct(s.amount,total)}%</span>
    </div>`).join('');
}
function renderAllocSummary() {
  const total = totalWealthFromBanks();
  if (!banks.length) { el('alloc-summary').innerHTML = ''; return; }
  const groups = [
    { label:'Savings',      types:['savings'],                  color:'#10b981' },
    { label:'Fixed Deposit', types:['fixed'],                   color:'#06b6d4' },
    { label:'Checking',     types:['checking'],                 color:'#3b82f6' },
    { label:'Equities',     types:['investment'],               color:'#10b981' },
    { label:'Fixed Income', types:['fixedincome'],              color:'#3b82f6' },
    { label:'Alternatives', types:['alternatives'],             color:'#8b5cf6' },
    { label:'Hedges',       types:['hedges'],                   color:'#f59e0b' },
    { label:'Gold',         types:['gold'],                     color:'#f59e0b' }
  ].map(g => ({ ...g, amount:banks.filter(b=>g.types.includes(b.type)).reduce((s,b)=>s+b.amount,0) })).filter(g=>g.amount>0);
  el('alloc-summary').innerHTML = `<div class="glass" style="padding:1.1rem"><div style="display:flex;flex-direction:column;gap:12px">${groups.map(g=>`<div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:13px;font-weight:500">${g.label}</span><span style="font-family:var(--font-d);font-size:13px;font-weight:700;color:${g.color}">${fmt(g.amount)} <span style="font-size:11px;color:var(--t3)">${pct(g.amount,total)}%</span></span></div><div class="pbar-bg"><div class="pbar" style="width:${pct(g.amount,total)}%;background:${g.color}"></div></div></div>`).join('')}</div></div>`;
}

// ── PRINCIPLES ────────────────────────────────────────────────────
function renderPrinciples() {
  const wrap = el('principles-list');
  if (!principles.length) { wrap.innerHTML = '<div class="empty">No principles yet - add your first investment rule or philosophy</div>'; return; }
  wrap.innerHTML = principles.map(p => `
    <div class="glass" style="padding:1.1rem;margin-bottom:.65rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div>
          <div style="font-family:var(--font-d);font-size:15px;font-weight:700;color:var(--t);margin-bottom:4px">${p.title}</div>
          ${p.tag?`<span style="display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(16,185,129,.12);color:#065f46">${p.tag}</span>`:''}
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button class="btn btn-g btn-sm" onclick="editPrinciple(${p.id})">Edit</button>
          <button class="btn btn-d btn-sm" onclick="dPrinciple(${p.id})">Delete</button>
        </div>
      </div>
      ${p.body?`<div style="font-size:13px;color:var(--t2);line-height:1.7;white-space:pre-wrap;background:rgba(240,253,244,.5);border:1px solid #d1fae5;border-radius:10px;padding:.75rem 1rem;margin-top:8px">${p.body}</div>`:''}
    </div>`).join('');
}

// ── ALLOCATION PLANNER ────────────────────────────────────────────
const ALLOC_CATS = [
  { id:'savings',      label:'Savings',       sub:'Cash in savings accounts',       color:'#10b981', group:'cash' },
  { id:'fixed',        label:'Fixed Deposit', sub:'Term deposits, fixed savings',    color:'#06b6d4', group:'cash' },
  { id:'checking',     label:'Checking',      sub:'Day-to-day liquidity',            color:'#3b82f6', group:'cash' },
  { id:'fixedincome',  label:'Fixed Income',  sub:'Bonds — KFAFIX-A, K-APB-A(A)',   color:'#3b82f6', group:'inv'  },
  { id:'investment',   label:'Equities',      sub:'CSPX, TDIV, VAPX, DXJ, EMXC',   color:'#10b981', group:'inv'  },
  { id:'alternatives', label:'Alternatives',  sub:'HGER, IGF — commodities, infra', color:'#8b5cf6', group:'inv'  },
  { id:'hedges',       label:'Hedges',        sub:'DBMF — trend-following',          color:'#f59e0b', group:'inv'  },
  { id:'gold',         label:'Gold',          sub:'Physical gold or gold ETF',       color:'#f97316', group:'inv'  },
];

let allocPcts = {};
ALLOC_CATS.forEach(c => allocPcts[c.id] = 0);

// Pre-fill from user's actual Money Map when tab opens
function initAllocPlanner() {
  const total = totalWealthFromBanks();
  if (total > 0) {
    // Calculate current % per type from actual banks
    ALLOC_CATS.forEach(c => {
      const typeTotal = banks.filter(b => b.type === c.id).reduce((s,b) => s+b.amount, 0);
      allocPcts[c.id] = Math.round(typeTotal / total * 100);
    });
  } else {
    // Default to dashboard weights if no banks set up yet
    const defaults = { savings:20, fixed:10, checking:5, fixedincome:30, investment:25, alternatives:5, hedges:3, gold:2 };
    ALLOC_CATS.forEach(c => allocPcts[c.id] = defaults[c.id] || 0);
  }
  buildAllocSliders('cash', 'alloc-cash-sliders');
  buildAllocSliders('inv',  'alloc-inv-sliders');
  recalcAlloc();
}

function buildAllocSliders(group, wrapId) {
  const wrap = el(wrapId); if (!wrap) return;
  const cats = ALLOC_CATS.filter(c => c.group === group);
  wrap.innerHTML = cats.map(c => `
    <div class="glass" style="padding:.85rem 1rem;margin-bottom:.5rem;display:flex;align-items:center;gap:12px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--t)">${c.label}</div>
        <div style="font-size:11px;color:var(--t3)">${c.sub}</div>
        <div style="margin-top:6px;height:4px;background:#f0fdf4;border-radius:20px;overflow:hidden">
          <div id="ap-bar-${c.id}" style="height:4px;background:${c.color};border-radius:20px;transition:width .3s;width:${allocPcts[c.id]}%"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <input type="number" min="0" max="100" step="1" value="${allocPcts[c.id]}"
          id="ap-sl-${c.id}"
          style="width:64px;padding:6px 8px;border:1.5px solid ${c.color}40;border-radius:10px;font-family:var(--font-d);font-size:15px;font-weight:700;color:${c.color};text-align:center;background:#f0fdf4"
          oninput="onAllocSlide('${c.id}',this.value)">
        <span style="font-size:12px;color:var(--t3);font-weight:600">%</span>
      </div>
      <div style="font-family:var(--font-d);font-size:14px;font-weight:700;color:${c.color};min-width:110px;text-align:right" id="ap-amt-${c.id}">${fmt(0)}</div>
    </div>`).join('');
}

window.onAllocSlide = (id, val) => {
  allocPcts[id] = Math.min(100, Math.max(0, parseInt(val)||0));
  recalcAlloc();
};

function recalcAlloc() {
  const total = totalWealthFromBanks() || 1000000;
  const sum = ALLOC_CATS.reduce((s,c) => s + allocPcts[c.id], 0);

  ALLOC_CATS.forEach(c => {
    const amt = total * allocPcts[c.id] / 100;
    const pEl = el('ap-pct-'+c.id); if(pEl) pEl.textContent = allocPcts[c.id] + '%';
    const aEl = el('ap-amt-'+c.id); if(aEl) aEl.textContent = fmt(amt);
    const bEl = el('ap-bar-'+c.id); if(bEl) bEl.style.width = allocPcts[c.id] + '%';
  });

  // Rainbow bar
  const barEl = el('alloc-plan-bar');
  if (barEl) {
    barEl.innerHTML = `
      <div style="display:flex;height:12px;border-radius:20px;overflow:hidden;gap:1px">
        ${ALLOC_CATS.filter(c=>allocPcts[c.id]>0).map(c=>`<div style="height:12px;background:${c.color};width:${allocPcts[c.id]}%;min-width:2px;transition:width .2s" title="${c.label}: ${allocPcts[c.id]}%"></div>`).join('')}
        ${sum<100?`<div style="flex:1;background:#f0fdf4;min-width:0"></div>`:''}
      </div>`;
  }

  // Legend
  const legEl = el('alloc-plan-legend');
  if (legEl) legEl.innerHTML = ALLOC_CATS.filter(c=>allocPcts[c.id]>0).map(c=>`<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t2)"><div style="width:8px;height:8px;border-radius:50%;background:${c.color}"></div>${c.label} ${allocPcts[c.id]}%</div>`).join('');

  // Status message
  const msgEl = el('alloc-plan-msg');
  if (msgEl) {
    if (sum === 100) msgEl.innerHTML = `<div style="font-size:12px;font-weight:600;color:var(--green)">Perfectly balanced at 100%</div>`;
    else if (sum > 100) msgEl.innerHTML = `<div style="font-size:12px;font-weight:600;color:var(--red)">Over-allocated by ${sum-100}% — reduce some sliders</div>`;
    else msgEl.innerHTML = `<div style="font-size:12px;font-weight:600;color:var(--amber)">${100-sum}% unallocated — keep adjusting to reach 100%</div>`;
  }

  // Summary KPIs
  const cashTotal = ALLOC_CATS.filter(c=>c.group==='cash').reduce((s,c)=>s+allocPcts[c.id],0);
  const invTotal  = ALLOC_CATS.filter(c=>c.group==='inv').reduce((s,c)=>s+allocPcts[c.id],0);
  const statsEl = el('alloc-plan-stats');
  if (statsEl) statsEl.innerHTML = `
    <div class="kpi"><div class="kpi-lbl">Total Allocated</div><div class="kpi-val" style="color:${sum===100?'var(--green)':sum>100?'var(--red)':'var(--amber)'}">${sum}%</div></div>
    <div class="kpi"><div class="kpi-lbl">Total Wealth</div><div class="kpi-val g-text">${fmt(total)}</div><div class="kpi-sub">from Money Map</div></div>
    <div class="kpi"><div class="kpi-lbl">Cash & Banking</div><div class="kpi-val" style="color:#3b82f6">${fmt(total*cashTotal/100)}</div><div class="kpi-sub">${cashTotal}%</div></div>
    <div class="kpi"><div class="kpi-lbl">Invested</div><div class="kpi-val" style="color:#10b981">${fmt(total*invTotal/100)}</div><div class="kpi-sub">${invTotal}%</div></div>
    <div class="kpi"><div class="kpi-lbl">Unallocated</div><div class="kpi-val" style="color:var(--t3)">${fmt(Math.max(0,total*(100-sum)/100))}</div><div class="kpi-sub">${Math.max(0,100-sum)}%</div></div>
  `;
}

// Wire up tab click to init planner
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab[data-t="alloc"]').forEach(b => {
    b.addEventListener('click', () => setTimeout(initAllocPlanner, 50));
  });
});
