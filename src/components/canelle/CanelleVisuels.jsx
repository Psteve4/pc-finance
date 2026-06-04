import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { format } from 'date-fns'

// ── Palette ───────────────────────────────────────────────────────────
const P = {
  bg: '#FAFAF8', surface: '#FFFFFF', surface2: '#F7F4F0',
  orange: '#F49306', pink: '#E0858E', green: '#A5BB1A',
  blue: '#6DB8BE', red: '#E63A26', gold: '#C9B749',
  text: '#1a0a00', muted: '#7a4a3a', subtle: '#b8a89a',
}

const RENT = 800
const PIERS_WISE_PCT = 0.40
const INVEST_PCT = 0.10
const THRESHOLD_2025 = 77700

const URSSAF_CATEGORIES = [
  { id: 'bnc_services', label: 'Services libéraux (BNC)', rate: 0.22 },
  { id: 'bic_services', label: 'Services BIC',            rate: 0.212 },
  { id: 'commerce',     label: 'Vente de marchandises',   rate: 0.123 },
]

const TIPS = {
  en: [
    "Set aside URSSAF charges immediately after each payment — never spend them.",
    "As an auto-entrepreneur, you can deduct nothing. Keep revenue low to stay under thresholds.",
    "The 2025 threshold for BNC services is €77,700. Track your annual turnover carefully.",
    "Pay yourself a consistent salary each month, even when income varies.",
    "Reinvesting 10% back into your business (gear, software, training) is a smart habit.",
    "Build a 3-month revenue buffer before increasing your personal salary.",
  ],
  fr: [
    "Mettez de côté les cotisations URSSAF dès chaque encaissement — ne les dépensez jamais.",
    "En micro-entreprise, aucune charge n'est déductible. Suivez votre CA annuel.",
    "Le seuil 2025 pour les services BNC est 77 700€. Surveillez votre CA cumulé.",
    "Versez-vous un salaire fixe chaque mois, même quand les revenus varient.",
    "Réinvestir 10% dans votre activité (matériel, logiciels, formations) est une bonne habitude.",
    "Constituez un fonds de 3 mois de revenus avant d'augmenter votre salaire.",
  ]
}

const T = {
  en: {
    back: '← Back', add_income: 'Add Income', client: 'Client',
    amount: 'Amount (gross €)', date: 'Date', urssaf_rate: 'URSSAF Category',
    add: 'Record', year: 'Year', gross: 'Gross', urssaf: 'URSSAF',
    net: 'Net', company: 'Company', to_wise: "→ Piers' Wise",
    year_total: 'YTD Turnover', tips: 'Business Tips', chart_title: 'Monthly Revenue',
    edit_splits: 'Edit Splits', piers_pct: "% to Piers' Wise", invest_pct: '% reinvest',
    wishlist: 'Wishlist', wish_add: 'Add Item', wish_name: 'Item name',
    wish_price: 'Price (€)', wish_url: 'URL', wish_cat: 'Category',
    wish_priority: 'Priority', wish_total: 'Total', wish_funded: 'Funded',
    wish_months: 'Months to goal', wish_sort: 'Sort', wish_alloc: '% net → wishlist',
  },
  fr: {
    back: '← Retour', add_income: 'Ajouter revenu', client: 'Client',
    amount: 'Montant brut (€)', date: 'Date', urssaf_rate: 'Catégorie URSSAF',
    add: 'Enregistrer', year: 'Année', gross: 'Brut', urssaf: 'URSSAF',
    net: 'Net', company: 'Réinvesti', to_wise: '→ Wise Piers',
    year_total: 'CA annuel', tips: 'Conseils pro', chart_title: 'Revenus mensuels',
    edit_splits: 'Répartition', piers_pct: '% vers Wise Piers', invest_pct: '% réinvesti',
    wishlist: 'Souhaits', wish_add: 'Ajouter', wish_name: "Nom de l'article",
    wish_price: 'Prix (€)', wish_url: 'URL', wish_cat: 'Catégorie',
    wish_priority: 'Priorité', wish_total: 'Total', wish_funded: 'Financé',
    wish_months: 'Mois pour l\'objectif', wish_sort: 'Trier', wish_alloc: '% net → liste',
  }
}

const NAV_LABELS = {
  en: { dashboard: 'Dashboard', progress: 'Progress', expenses: 'Expenses', history: 'History', splits: 'Splits', wishlist: 'Wishlist' },
  fr: { dashboard: 'Tableau', progress: 'Progression', expenses: 'Dépenses', history: 'Historique', splits: 'Répartition', wishlist: 'Liste' }
}

const ONBOARDING_MONTHS = (() => {
  const months = []
  let d = new Date(2025, 4, 1)
  const stop = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  while (d <= stop) {
    months.push(format(d, 'yyyy-MM'))
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return months
})()

const MONTH_FR = { '01':'Janvier','02':'Février','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juillet','08':'Août','09':'Septembre','10':'Octobre','11':'Novembre','12':'Décembre' }
const monthLabel = (ym) => `${MONTH_FR[ym.slice(5)]} ${ym.slice(0,4)}`

const URSSAF_QUARTERS = [
  { id:'Q2_2025', label:'Q2 2025 (Avr–Jun)', year:2025, months:['04','05','06'], due:'31 juil. 2025', dueDate:new Date(2025,6,31) },
  { id:'Q3_2025', label:'Q3 2025 (Jul–Sep)', year:2025, months:['07','08','09'], due:'31 oct. 2025',  dueDate:new Date(2025,9,31) },
  { id:'Q4_2025', label:'Q4 2025 (Oct–Déc)', year:2025, months:['10','11','12'], due:'31 jan. 2026', dueDate:new Date(2026,0,31) },
  { id:'Q1_2026', label:'Q1 2026 (Jan–Mar)', year:2026, months:['01','02','03'], due:'30 avr. 2026', dueDate:new Date(2026,3,30) },
  { id:'Q2_2026', label:'Q2 2026 (Avr–Jun)', year:2026, months:['04','05','06'], due:'31 juil. 2026', dueDate:new Date(2026,6,31) },
  { id:'Q3_2026', label:'Q3 2026 (Jul–Sep)', year:2026, months:['07','08','09'], due:'31 oct. 2026', dueDate:new Date(2026,9,31) },
  { id:'Q4_2026', label:'Q4 2026 (Oct–Déc)', year:2026, months:['10','11','12'], due:'31 jan. 2027', dueDate:new Date(2027,0,31) },
]

const PRIORITY_ORDER = { dream: 0, soon: 1, someday: 2 }
const CV_PRIORITY_COLORS = { dream: P.orange, soon: P.pink, someday: P.blue }
const CV_PRIORITY_ICONS  = { dream: '⭐', soon: '🔜', someday: '☁️' }
const CV_CAT_ICONS       = { gear: '🔧', software: '💻', other: '📦' }

// No seed data — expenses start empty. User adds their own subscriptions.

// ── Small SVG circle ──────────────────────────────────────────────────
function CircleProgress({ pct, color = P.orange, size = 52 }) {
  const R = (size - 6) / 2
  const C = 2 * Math.PI * R
  const offset = C - (Math.min(100, Math.max(0, pct)) / 100) * C
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}/>
    </svg>
  )
}

// ── Large goal ring ───────────────────────────────────────────────────
function GoalCircle({ current, goal }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0
  const reached = current >= goal
  const R = 90, C = 2 * Math.PI * R
  const color = reached ? P.green : P.orange
  return (
    <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
      <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="18"/>
        <circle cx="110" cy="110" r={R} fill="none" stroke={color} strokeWidth="18"
          strokeDasharray={C} strokeDashoffset={C - (pct/100)*C} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
        {reached
          ? <div style={{ fontSize:13, color:P.green, fontWeight:700, lineHeight:1.4 }}>🎉<br/>Objectif<br/>atteint!</div>
          : <>
              <div style={{ fontSize:30, fontWeight:700, color, lineHeight:1 }}>{Math.round(pct)}%</div>
              <div style={{ fontSize:14, color:P.text, marginTop:4, fontWeight:600 }}>€{Math.round(current).toLocaleString()}</div>
              <div style={{ fontSize:11, color:P.muted, marginTop:2 }}>/ €{goal.toLocaleString()}</div>
            </>
        }
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function CanelleVisuels({ onBack, lang, setLang }) {
  const t = T[lang]
  const nav = NAV_LABELS[lang]

  const [tab, setTab] = useState('dashboard')
  const [income, setIncome] = useState([])
  const [allIncome, setAllIncome] = useState([])
  const [loading, setLoading] = useState(true)
  const [urssafCat, setUrssafCat] = useState('bnc_services')
  const [piersPct, setPiersPct] = useState(PIERS_WISE_PCT * 100)
  const [investPct, setInvestPct] = useState(INVEST_PCT * 100)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [tipIdx] = useState(() => new Date().getDate() % TIPS.en.length)
  const addIncomeRef = useRef(null)

  // Wishlist
  const [wishlist, setWishlist] = useState([])
  const [newWish, setNewWish] = useState({ name:'', price:'', url:'', category:'gear', priority:'soon' })
  const [wishlistPct, setWishlistPct] = useState(() => parseInt(localStorage.getItem('cv_wishlist_pct')||'5'))
  const [wishlistSort, setWishlistSort] = useState('priority')
  const [wishError, setWishError] = useState(null)
  const [wishLoading, setWishLoading] = useState(false)

  // Onboarding
  const [onboardingMode, setOnboardingMode] = useState(false)
  const [onboardingRows, setOnboardingRows] = useState({})
  const [onboardingSaving, setOnboardingSaving] = useState(false)
  const [onboardingSaved, setOnboardingSaved] = useState(false)

  // Goal
  const [monthlyGoal, setMonthlyGoal] = useState(() => parseInt(localStorage.getItem('cv_monthly_goal')||'2500'))
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  // Recurring & one-off expenses
  const [cvRecurring, setCvRecurring] = useState([])
  const [newRecurring, setNewRecurring] = useState({ name:'', amount:'' })
  const [oneOffExpenses, setOneOffExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_oneoff')||'[]') } catch { return [] }
  })
  const [newOneOff, setNewOneOff] = useState({ name:'', amount:'' })

  // URSSAF paid
  const [urssafPaid, setUrssafPaid] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_urssaf_paid')||'{}') } catch { return {} }
  })

  // Add income form
  const [form, setForm] = useState({ client:'', amount:'', date:format(new Date(),'yyyy-MM-dd'), cat:'bnc_services', desc:'' })

  // ── Load ───────────────────────────────────────────────────────────
  useEffect(() => { loadIncome() }, [selectedYear])
  useEffect(() => {
    loadAllIncome()
    loadWishlist()
    loadCVRecurring()
    if (!localStorage.getItem('cv_onboarding_done')) {
      supabase.from('cv_income').select('id',{ count:'exact', head:true })
        .then(({ count }) => { if ((count||0) === 0) setOnboardingMode(true) })
    }
  }, [])

  async function loadIncome() {
    setLoading(true)
    const { data } = await supabase.from('cv_income')
      .select('*').gte('date',`${selectedYear}-01-01`).lte('date',`${selectedYear}-12-31`)
      .order('date',{ ascending:false })
    setIncome(data||[])
    setLoading(false)
  }
  async function loadAllIncome() {
    const { data } = await supabase.from('cv_income').select('*').gte('date','2025-05-01').order('date')
    setAllIncome(data||[])
  }
  async function loadWishlist() {
    const { data } = await supabase.from('cv_wishlist').select('*').order('created_at')
    setWishlist(data||[])
  }

  async function loadCVRecurring() {
    // Show locally-saved data immediately — but ignore the old auto-seeded defaults (c1/c2/c3)
    const localSaved = localStorage.getItem('cv_recurring_local')
    if (localSaved) {
      const parsed = JSON.parse(localSaved)
      // Strip out the old hardcoded seed IDs if they were auto-inserted
      const clean = parsed.filter(r => !['c1','c2','c3'].includes(r.id))
      setCvRecurring(clean)
      if (clean.length !== parsed.length) localStorage.setItem('cv_recurring_local', JSON.stringify(clean))
    }
    // Sync from Supabase — start empty if nothing saved
    try {
      const { data, error } = await supabase.from('cv_recurring').select('*').order('created_at')
      if (error) return
      setCvRecurring(data || [])
      localStorage.setItem('cv_recurring_local', JSON.stringify(data || []))
    } catch { /* keep local if Supabase unavailable */ }
  }

  // ── Recurring actions ──────────────────────────────────────────────
  async function addCVRecurring() {
    if (!newRecurring.name || !newRecurring.amount) return
    const item = { name: newRecurring.name, amount: parseFloat(newRecurring.amount), active: true }
    let newItem = { ...item, id: `local_${Date.now()}` }
    try {
      const { data } = await supabase.from('cv_recurring').insert(item).select().single()
      if (data) newItem = data
    } catch {}
    const updated = [...cvRecurring, newItem]
    setCvRecurring(updated)
    localStorage.setItem('cv_recurring_local', JSON.stringify(updated))
    setNewRecurring({ name:'', amount:'' })
  }

  async function toggleCVRecurring(id) {
    const item = cvRecurring.find(r => r.id === id)
    if (!item) return
    const next = !item.active
    try { await supabase.from('cv_recurring').update({ active: next }).eq('id', id) } catch {}
    const updated = cvRecurring.map(r => r.id === id ? { ...r, active: next } : r)
    setCvRecurring(updated)
    localStorage.setItem('cv_recurring_local', JSON.stringify(updated))
  }

  async function deleteCVRecurring(id) {
    try { await supabase.from('cv_recurring').delete().eq('id', id) } catch {}
    const updated = cvRecurring.filter(r => r.id !== id)
    setCvRecurring(updated)
    localStorage.setItem('cv_recurring_local', JSON.stringify(updated))
  }

  // ── One-off expense actions ────────────────────────────────────────
  function addOneOff() {
    if (!newOneOff.name || !newOneOff.amount) return
    const exp = { id: Date.now(), name: newOneOff.name, amount: parseFloat(newOneOff.amount), date: format(new Date(),'yyyy-MM-dd') }
    const updated = [...oneOffExpenses, exp]
    setOneOffExpenses(updated)
    localStorage.setItem('cv_oneoff', JSON.stringify(updated))
    setNewOneOff({ name:'', amount:'' })
  }
  function deleteOneOff(id) {
    const updated = oneOffExpenses.filter(e => e.id !== id)
    setOneOffExpenses(updated)
    localStorage.setItem('cv_oneoff', JSON.stringify(updated))
  }

  // ── Onboarding ─────────────────────────────────────────────────────
  async function saveOnboarding() {
    setOnboardingSaving(true)
    const rows = Object.entries(onboardingRows).filter(([, v]) => v && parseFloat(v.amount) > 0)
    for (const [month, { amount, note }] of rows) {
      const gross = parseFloat(amount)
      const rate = URSSAF_CATEGORIES[0].rate
      const urssaf = gross * rate, net = gross - urssaf
      const toPiers = net * (piersPct/100), company = net * (investPct/100), salary = net - toPiers - company
      await supabase.from('cv_income').insert({
        client: note||'Historique', amount_gross:gross, amount_urssaf:urssaf,
        amount_after_urssaf:net, amount_to_piers_wise:toPiers,
        amount_company:company, amount_salary:salary,
        date:`${month}-01`, category:'bnc_services', description:note||'Historique'
      })
    }
    localStorage.setItem('cv_onboarding_done','1')
    setOnboardingMode(false); setOnboardingSaving(false)
    setOnboardingSaved(true); setOnboardingRows({})
    loadIncome(); loadAllIncome()
    setTimeout(() => setOnboardingSaved(false), 5000)
  }

  // ── Income ─────────────────────────────────────────────────────────
  async function addIncome() {
    if (!form.amount||!form.date) return
    const gross = parseFloat(form.amount)
    const rate = URSSAF_CATEGORIES.find(c=>c.id===form.cat)?.rate||0.22
    const urssaf = gross*rate, net = gross-urssaf
    const toPiers = net*(piersPct/100), company = net*(investPct/100), salary = net-toPiers-company
    const { data } = await supabase.from('cv_income').insert({
      client:form.client, amount_gross:gross, amount_urssaf:urssaf,
      amount_after_urssaf:net, amount_to_piers_wise:toPiers,
      amount_company:company, amount_salary:salary,
      date:form.date, category:form.cat, description:form.desc
    }).select().single()
    if (data) { setIncome(prev=>[data,...prev]); loadAllIncome() }
    setForm({ client:'', amount:'', date:format(new Date(),'yyyy-MM-dd'), cat:'bnc_services', desc:'' })
    if (wishlistPct > 0) {
      const alloc = net * (wishlistPct/100)
      const PO = { dream:0, soon:1, someday:2 }
      const top = [...wishlist].filter(w=>!w.purchased&&(w.funded||0)<w.price)
        .sort((a,b)=>(PO[a.priority]??9)-(PO[b.priority]??9))[0]
      if (top) {
        const nf = Math.min((top.funded||0)+alloc, top.price)
        await supabase.from('cv_wishlist').update({ funded:nf }).eq('id',top.id)
        setWishlist(prev=>prev.map(w=>w.id===top.id?{...w,funded:nf}:w))
      }
    }
  }

  // ── Wishlist ───────────────────────────────────────────────────────
  async function addWishItem() {
    if (!newWish.name||!newWish.price) return
    setWishError(null); setWishLoading(true)
    const { data, error } = await supabase.from('cv_wishlist').insert({
      name:newWish.name, price:parseFloat(newWish.price),
      url:newWish.url||null, category:newWish.category||null,
      priority:newWish.priority||'soon', funded:0, purchased:false
    }).select().single()
    if (error) { setWishError(`${error.message}`); setWishLoading(false); return }
    setWishlist(prev=>[...prev,data])
    setNewWish({ name:'', price:'', url:'', category:'gear', priority:'soon' })
    setWishLoading(false)
  }
  async function deleteWishItem(id) {
    await supabase.from('cv_wishlist').delete().eq('id',id)
    setWishlist(prev=>prev.filter(w=>w.id!==id))
  }
  async function markWishPurchased(id) {
    await supabase.from('cv_wishlist').update({ purchased:true }).eq('id',id)
    setWishlist(prev=>prev.map(w=>w.id===id?{...w,purchased:true}:w))
  }

  function toggleUrssafPaid(qId) {
    setUrssafPaid(prev => {
      const next = { ...prev, [qId]: !prev[qId] }
      localStorage.setItem('cv_urssaf_paid', JSON.stringify(next))
      return next
    })
  }

  // ── Derived ────────────────────────────────────────────────────────
  const formRate = URSSAF_CATEGORIES.find(c=>c.id===form.cat)?.rate||0.22
  const previewGross = parseFloat(form.amount)||0
  const previewUrssaf = previewGross * formRate
  const previewNet = previewGross - previewUrssaf
  const previewToPiers = previewNet * (piersPct/100)
  const previewCompany = previewNet * (investPct/100)
  const previewSalary = previewNet - previewToPiers - previewCompany

  const ytdGross = income.reduce((s,r)=>s+(r.amount_gross||0),0)
  const ytdUrssaf = income.reduce((s,r)=>s+(r.amount_urssaf||0),0)
  const ytdNet = income.reduce((s,r)=>s+(r.amount_after_urssaf||0),0)
  const ytdToPiers = income.reduce((s,r)=>s+(r.amount_to_piers_wise||0),0)

  const currentMonthStr = format(new Date(),'yyyy-MM')
  const currentMonthGross = income.filter(r=>r.date?.startsWith(currentMonthStr))
    .reduce((s,r)=>s+(r.amount_gross||0),0)

  const monthlyData = Array.from({length:12},(_,i)=>{
    const m = String(i+1).padStart(2,'0')
    const mi = income.filter(r=>r.date?.startsWith(`${selectedYear}-${m}`))
    return { month:m, gross:Math.round(mi.reduce((s,r)=>s+(r.amount_gross||0),0)), net:Math.round(mi.reduce((s,r)=>s+(r.amount_after_urssaf||0),0)) }
  })

  const monthsWithData = new Set(income.map(r=>r.date?.slice(0,7)).filter(Boolean)).size
  const avgMonthlyGross = monthsWithData>0 ? ytdGross/monthsWithData : 0
  const isCurrentYear = selectedYear===new Date().getFullYear()
  const currentCalMonth = new Date().getMonth()+1
  const remainingMonths = isCurrentYear ? Math.max(0,12-currentCalMonth) : 0
  const projected = ytdGross + remainingMonths * avgMonthlyGross
  const estUrssaf = projected * 0.22
  const stillToSet = Math.max(0, estUrssaf - ytdUrssaf)
  const forecastPct = projected>0 ? Math.round(projected/THRESHOLD_2025*100) : 0

  // Progress tab
  const progressData = ONBOARDING_MONTHS.map(ym=>{
    const mi = allIncome.filter(r=>r.date?.startsWith(ym))
    return { ym, month:ym.slice(5)+"'"+ym.slice(2,4), gross:Math.round(mi.reduce((s,r)=>s+(r.amount_gross||0),0)), net:Math.round(mi.reduce((s,r)=>s+(r.amount_after_urssaf||0),0)) }
  })
  const allTimeGross = progressData.reduce((s,d)=>s+d.gross,0)
  const nonZeroM = progressData.filter(d=>d.gross>0)
  const avgMonthlyAll = nonZeroM.length>0 ? Math.round(allTimeGross/nonZeroM.length) : 0
  const bestMonth = [...progressData].sort((a,b)=>b.gross-a.gross)[0]||{ month:'—', gross:0, ym:'' }
  const recentNZ = progressData.filter(d=>d.gross>0)
  let momGrowth = null
  if (recentNZ.length>=2) {
    const last = recentNZ[recentNZ.length-1].gross, prev = recentNZ[recentNZ.length-2].gross
    momGrowth = prev>0 ? Math.round((last-prev)/prev*100) : null
  }
  let cum = 0
  const cumulativeData = progressData.map(d=>{ cum+=d.gross; return {...d, cumulative:cum} })

  const now = new Date()
  const activeQuarters = URSSAF_QUARTERS.filter(q=>new Date(q.year,parseInt(q.months[0])-1,1)<=now)
  const quarterlyData = activeQuarters.map(q=>{
    const qI = allIncome.filter(r=>q.months.some(m=>r.date?.startsWith(`${q.year}-${m}`)))
    const gross = qI.reduce((s,r)=>s+(r.amount_gross||0),0)
    const urssaf = qI.reduce((s,r)=>s+(r.amount_urssaf||0),0)
    const isPaid = !!urssafPaid[q.id]
    const isOverdue = now>q.dueDate && !isPaid && gross>0
    return { ...q, gross, urssaf, isPaid, isOverdue }
  })
  const nextDue = quarterlyData.filter(q=>!q.isPaid&&q.gross>0&&q.dueDate>=now).sort((a,b)=>a.dueDate-b.dueDate)[0]
  const totalUrssafOwed = quarterlyData.filter(q=>!q.isPaid).reduce((s,q)=>s+q.urssaf,0)
  const totalUrssafPaid = quarterlyData.filter(q=>q.isPaid).reduce((s,q)=>s+q.urssaf,0)

  const recurringTotal = cvRecurring.filter(r=>r.active).reduce((s,r)=>s+r.amount,0)
  const currentMonthOneOffs = oneOffExpenses.filter(e=>e.date?.startsWith(currentMonthStr))

  // Wishlist
  const activeWish = wishlist.filter(w=>!w.purchased)
  const wishTotal = activeWish.reduce((s,w)=>s+w.price,0)
  const wishFunded = activeWish.reduce((s,w)=>s+(w.funded||0),0)
  const readyToBuy = activeWish.filter(w=>(w.funded||0)>=w.price)
  const monthlyAvgNet = currentCalMonth>0 ? ytdNet/currentCalMonth : 0
  const wishMonthlyContrib = monthlyAvgNet*(wishlistPct/100)
  const topUnfunded = [...activeWish].sort((a,b)=>(PRIORITY_ORDER[a.priority]??9)-(PRIORITY_ORDER[b.priority]??9)).find(w=>(w.funded||0)<w.price)
  const monthsToTop = topUnfunded&&wishMonthlyContrib>0 ? Math.ceil((topUnfunded.price-(topUnfunded.funded||0))/wishMonthlyContrib) : null
  const sortedWishlist = [...activeWish].sort((a,b)=>{
    if (wishlistSort==='priority') return (PRIORITY_ORDER[a.priority]??9)-(PRIORITY_ORDER[b.priority]??9)
    if (wishlistSort==='price') return b.price-a.price
    if (wishlistSort==='funded') return ((b.funded||0)/b.price)-((a.funded||0)/a.price)
    return 0
  })

  // ── Styles ─────────────────────────────────────────────────────────
  const S = {
    container: { minHeight:'100vh', background:P.bg, color:P.text, fontFamily:"'Space Grotesk', sans-serif" },
    // White card — no border, no shadow, floating on warm bg. Use accentCard for coloured edge.
    card: { background:'#fff', borderRadius:12, padding:28, position:'relative' },
    // Left-edge coloured accent strip using gradient (not border)
    accentCard: (color=P.orange) => ({
      background:`linear-gradient(90deg, ${color} 0px, ${color} 4px, #fff 4px, #fff 100%)`,
      borderRadius:12, padding:'24px 28px 24px 32px', position:'relative'
    }),
    // Magazine-style section header
    label: { fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase', color:P.muted, marginBottom:10, fontWeight:600, fontFamily:"'Space Grotesk', sans-serif" },
    // Clean underline-only input
    input: { background:'transparent', border:'none', borderBottom:'2px solid #e8e0d8', borderRadius:0, padding:'10px 2px', color:P.text, fontSize:14, width:'100%', fontFamily:"'Space Grotesk', sans-serif", outline:'none' },
    // Pill buttons — no border, no shadow
    btn: { background:P.orange, border:'none', borderRadius:100, padding:'12px 28px', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'Space Grotesk', sans-serif" },
    btnSecondary: { background:P.pink, border:'none', borderRadius:100, padding:'10px 22px', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Space Grotesk', sans-serif" },
    btnGhost: (color=P.muted) => ({ background:'transparent', border:'none', color, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:"'Space Grotesk', sans-serif", textDecoration:'underline', textDecorationColor:`${color}55` }),
    btnDanger: { background:'transparent', border:'none', color:P.red, fontSize:13, cursor:'pointer', fontFamily:"'Space Grotesk', sans-serif", padding:'4px 8px', opacity:0.8 },
    // Editorial tab nav
    navBtn: (active) => ({
      padding:'16px 24px', fontSize:13, fontWeight:active?600:400, cursor:'pointer',
      background:'transparent', color:active?P.text:P.muted,
      border:'none', borderBottom:active?`3px solid ${P.orange}`:'3px solid transparent',
      fontFamily:"'Space Grotesk', sans-serif", transition:'all 0.15s', whiteSpace:'nowrap'
    }),
  }

  const tipStyle = { background:'#fff', border:'1px solid rgba(0,0,0,0.06)', borderRadius:8, fontSize:12, color:P.text }

  // ── ONBOARDING ──────────────────────────────────────────────────────
  if (onboardingMode) {
    return (
      <div className="canelle" style={{ ...S.container, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 24px' }}>
        <div style={{ width:'100%', maxWidth:680 }}>
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div style={{ fontSize:28, fontWeight:700, color:P.text, marginBottom:10 }}>👋 Bienvenue Canelle! Let's set up your history</div>
            <div style={{ fontSize:14, color:P.muted, lineHeight:1.7 }}>
              Add your income from May 2025 to today in one go. You only do this once.<br/>Months with no income can be left blank.
            </div>
          </div>
          <div style={{...S.accentCard(P.orange), marginBottom:20}}>
            <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr', gap:10, marginBottom:10 }}>
              {['Month','Total gross (€)','Note (optional)'].map(h=>(
                <div key={h} style={{ ...S.label, marginBottom:0 }}>{h}</div>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:480, overflowY:'auto' }}>
              {ONBOARDING_MONTHS.map(ym=>{
                const row = onboardingRows[ym]||{}
                const set = p => setOnboardingRows(prev=>({ ...prev, [ym]:{ ...prev[ym], ...p } }))
                return (
                  <div key={ym} style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr', gap:10, alignItems:'center' }}>
                    <div style={{ fontSize:13, color:P.muted, fontWeight:500 }}>{monthLabel(ym)}</div>
                    <input style={{ ...S.input, padding:'7px 10px', fontSize:12 }} type="number" placeholder="0"
                      value={row.amount||''} onChange={e=>set({ amount:e.target.value })}/>
                    <input style={{ ...S.input, padding:'7px 10px', fontSize:12 }} placeholder="Historique"
                      value={row.note||''} onChange={e=>set({ note:e.target.value })}/>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <button style={{ ...S.btn, fontSize:16, padding:'14px 36px', borderRadius:10, opacity:onboardingSaving?0.6:1 }}
              onClick={saveOnboarding} disabled={onboardingSaving}>
              {onboardingSaving?'Saving…':'✅ Save all history & start'}
            </button>
            <button style={{ background:'none', border:'none', color:P.muted, fontSize:13, cursor:'pointer', textDecoration:'underline', fontFamily:'var(--font-modern)' }}
              onClick={() => { localStorage.setItem('cv_onboarding_done','1'); setOnboardingMode(false) }}>
              Skip — I'll add history later
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN APP ────────────────────────────────────────────────────────
  return (
    <div className="canelle" style={S.container}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 40px', background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:24 }}>
          <button onClick={onBack} style={{ ...S.btnGhost(), fontSize:13 }}>{t.back}</button>
          <div>
            <div style={{ lineHeight:1 }}>
              <span style={{ fontSize:30, fontWeight:700, color:P.text, letterSpacing:'-0.02em' }}>Canelle</span>
              <span style={{ fontSize:30, fontWeight:700, color:P.orange, letterSpacing:'-0.02em' }}>.visuels</span>
            </div>
            <div style={{ fontSize:10, color:P.subtle, letterSpacing:'0.2em', marginTop:3, textTransform:'uppercase' }}>Business Tracker</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          {onboardingSaved && (
            <div style={{ fontSize:12, color:P.green, fontWeight:600, padding:'5px 12px', background:'rgba(165,187,26,0.12)', border:`1px solid rgba(165,187,26,0.4)`, borderRadius:6 }}>
              ✅ Historique enregistré!
            </div>
          )}
          <span style={{ fontSize:12, color:P.muted }}>
            CA {selectedYear}: <strong style={{ color:ytdGross>THRESHOLD_2025?P.red:P.green }}>€{Math.round(ytdGross).toLocaleString()}</strong>
          </span>
          <div style={{ display:'flex', gap:4 }}>
            {['en','fr'].map(l=>(
              <button key={l} onClick={()=>setLang(l)} style={{
                padding:'5px 10px', borderRadius:5, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-modern)',
                background:lang===l?P.orange:'transparent', color:lang===l?'#fff':P.muted,
                border:'none', borderBottom:`2px solid ${lang===l?P.orange:'transparent'}`,
                textTransform:'uppercase', borderRadius:0,
              }}>{l}</button>
            ))}
          </div>
          <button onClick={()=>setOnboardingMode(true)} style={{ ...S.btnSecondary, padding:'8px 16px', fontSize:12, whiteSpace:'nowrap' }}>
            📂 {lang==='en'?'Add history':'Ajouter historique'}
          </button>
          <select value={selectedYear} onChange={e=>setSelectedYear(parseInt(e.target.value))} style={{ ...S.input, width:88 }}>
            {[2025,2026].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display:'flex', background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.06)', padding:'0 40px', overflowX:'auto' }}>
        {['dashboard','progress','expenses','history','splits','wishlist'].map(tid=>(
          <button key={tid} style={S.navBtn(tab===tid)} onClick={()=>setTab(tid)}>{nav[tid]}</button>
        ))}
      </div>

      <div style={{ padding:'32px 40px', maxWidth:1100, margin:'0 auto' }}>

        {/* ── DASHBOARD ── */}
        {tab==='dashboard' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }} className="page-enter">

            {/* Goal circle */}
            <div style={S.accentCard(P.orange)}>
              <div style={{ display:'flex', alignItems:'center', gap:32, flexWrap:'wrap' }}>
                <GoalCircle current={currentMonthGross} goal={monthlyGoal}/>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:P.text }}>{lang==='en'?'Monthly Income Goal':'Objectif mensuel'}</div>
                    {!editingGoal
                      ? <button onClick={()=>{ setGoalInput(String(monthlyGoal)); setEditingGoal(true) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14 }}>✏️</button>
                      : <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <input style={{ ...S.input, width:100, padding:'4px 8px', fontSize:13 }} type="number" value={goalInput} onChange={e=>setGoalInput(e.target.value)} autoFocus/>
                          <button style={{ ...S.btn, padding:'4px 10px', fontSize:12 }} onClick={()=>{ const v=parseInt(goalInput)||2500; setMonthlyGoal(v); localStorage.setItem('cv_monthly_goal',String(v)); setEditingGoal(false) }}>✓</button>
                          <button style={{ background:'none', border:'none', cursor:'pointer', color:P.muted, fontSize:16 }} onClick={()=>setEditingGoal(false)}>✕</button>
                        </div>
                    }
                  </div>
                  <div style={{ fontSize:28, fontWeight:700, color:P.orange }}>
                    €{Math.round(currentMonthGross).toLocaleString()}
                    <span style={{ fontSize:14, fontWeight:400, color:P.muted, marginLeft:8 }}>/ €{monthlyGoal.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize:12, color:P.muted, marginTop:4 }}>{format(new Date(),'MMMM yyyy')}</div>
                </div>
              </div>
            </div>

            {/* Add income */}
            <div ref={addIncomeRef} style={S.accentCard(P.orange)}>
              <div style={{ marginBottom:16 }}>
                <div style={{ ...S.label, color:P.orange }}>+ {t.add_income}</div>
                <div style={{ fontSize:14, color:P.muted, marginTop:4 }}>
                  {lang==='en'
                    ? 'Add each payment received from your clients here — URSSAF and splits are calculated automatically.'
                    : 'Ajoutez chaque paiement reçu de vos clients ici — l\'URSSAF et les répartitions sont calculés automatiquement.'}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1.5fr 2fr', gap:12, marginBottom:12 }}>
                <div><div style={S.label}>{t.client}</div><input style={S.input} value={form.client} onChange={e=>setForm(p=>({...p,client:e.target.value}))} placeholder={lang==='en'?'Client or company name':'Nom du client ou entreprise'}/></div>
                <div><div style={S.label}>{t.amount} — {lang==='en'?'gross, before URSSAF':'brut, avant URSSAF'}</div><input style={S.input} type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="0.00"/></div>
                <div><div style={S.label}>{t.date}</div><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
                <div><div style={S.label}>{t.urssaf_rate}</div>
                  <select style={S.input} value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}>
                    {URSSAF_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label} ({(c.rate*100).toFixed(1)}%)</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                  <input style={S.input} value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} placeholder={lang==='en'?'Optional note':'Note optionnelle'}/>
                  <button style={{ ...S.btn, whiteSpace:'nowrap', fontSize:15, padding:'13px 28px' }} onClick={addIncome}>
                    {lang==='en'?'✓ Record':'✓ Enregistrer'}
                  </button>
                </div>
              </div>
              {previewGross>0 && (
                <div style={{ background:'#F7F4F0', borderRadius:8, padding:'14px 18px', marginTop:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ fontSize:12, color:P.muted }}>🏦 Monobanque reçoit</div>
                    <div style={{ fontSize:18, fontWeight:700, color:P.text }}>€{Math.round(previewGross).toLocaleString()}</div>
                  </div>
                  <div style={{ paddingLeft:14, marginBottom:8 }}>
                    <div style={{ fontSize:11, color:P.muted }}>↓ URSSAF ({Math.round(formRate*100)}%)</div>
                    <div style={{ fontSize:13, fontWeight:600, color:P.red }}>−€{Math.round(previewUrssaf).toLocaleString()}</div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'rgba(165,187,26,0.1)', border:`1px solid rgba(165,187,26,0.35)`, borderRadius:6, marginBottom:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:P.green }}>Net personnel</div>
                    <div style={{ fontSize:20, fontWeight:700, color:P.green }}>€{Math.round(previewNet).toLocaleString()}</div>
                  </div>
                  <div style={{ paddingLeft:14 }}>
                    {[
                      { label:'Wise Canelle (salaire)', val:previewSalary, color:P.green },
                      { label:'Wise Piers — loyer & épargne', val:previewToPiers, color:P.blue },
                      { label:'Réinvesti entreprise', val:previewCompany, color:P.orange },
                    ].map(({label,val,color})=>(
                      <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <div style={{ color, fontSize:14 }}>→</div>
                        <div style={{ flex:1, fontSize:12, color:P.muted }}>{label}</div>
                        <div style={{ fontSize:14, fontWeight:700, color }}>€{Math.round(val).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* YTD stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
              {[
                { label:t.year_total, val:ytdGross, color:P.text, sub:`${Math.round(ytdGross/THRESHOLD_2025*100)}% of €${THRESHOLD_2025.toLocaleString()}`, accent:P.orange },
                { label:'URSSAF dû', val:ytdUrssaf, color:P.red, sub:`${Math.round(formRate*100)}% rate`, accent:P.red },
                { label:t.net, val:ytdNet, color:P.green, sub:'Net YTD', accent:P.green },
                { label:t.to_wise, val:ytdToPiers, color:P.blue, sub:'Épargne commune', accent:P.blue },
              ].map(({label,val,color,sub,accent})=>(
                <div key={label} style={S.accentCard(accent)}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize:36, fontWeight:700, color, marginTop:6, lineHeight:1, letterSpacing:'-0.02em' }}>€{Math.round(val).toLocaleString()}</div>
                  <div style={{ fontSize:11, color:P.subtle, marginTop:8 }}>{sub}</div>
                </div>
              ))}
            </div>

            {ytdGross>0 && (
              <div style={S.accentCard(P.orange)}>
                <div style={{ ...S.label, color:P.orange, marginBottom:12 }}>📊 {lang==='en'?'URSSAF Forecast':'Prévision URSSAF'}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[
                    { label:'Moy. mensuelle', val:avgMonthlyGross, color:P.text },
                    { label:'CA annuel projeté', val:projected, color:P.text },
                    { label:'URSSAF estimée', val:estUrssaf, color:P.red },
                    { label:'Encore à mettre', val:stillToSet, color:stillToSet>0?P.red:P.green },
                  ].map(({label,val,color})=>(
                    <div key={label}>
                      <div style={{ fontSize:10, color:P.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:20, fontWeight:700, color }}>€{Math.round(val).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                {forecastPct>70 && (
                  <div style={{ marginTop:12, fontSize:12, padding:'8px 12px', borderRadius:6, color:forecastPct>=100?P.red:'#b36600', background:forecastPct>=100?'rgba(230,58,38,0.08)':'rgba(244,147,6,0.08)', border:`1px solid ${forecastPct>=100?'rgba(230,58,38,0.3)':'rgba(244,147,6,0.3)'}` }}>
                    {forecastPct>=100?`⚠️ CA projeté (€${Math.round(projected).toLocaleString()}) dépasse le seuil — consultez un comptable.`:`📈 À ce rythme vous atteindrez ${forecastPct}% du seuil de 77 700€.`}
                  </div>
                )}
              </div>
            )}

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:20 }}>{t.chart_title} — {selectedYear}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false}/>
                  <XAxis dataKey="month" tick={{ fill:P.muted, fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tipStyle} labelStyle={{ color:P.text }}/>
                  <Bar dataKey="gross" fill={P.orange} radius={[3,3,0,0]} name={t.gross}/>
                  <Bar dataKey="net" fill={P.green} radius={[3,3,0,0]} name={t.net}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={S.accentCard(P.gold)}>
              <div style={{ ...S.label, color:P.gold }}>💼 {t.tips}</div>
              <div style={{ fontSize:14, color:P.text, marginTop:10, lineHeight:1.7 }}>{TIPS[lang][tipIdx]}</div>
            </div>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {tab==='progress' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }} className="page-enter">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
              {[
                { label:'Total gagné', val:`€${allTimeGross.toLocaleString()}`, color:P.text },
                { label:'Meilleur mois', val:`€${bestMonth.gross.toLocaleString()}`, sub:bestMonth.ym?monthLabel(bestMonth.ym):'—', color:P.orange },
                { label:'Moyenne mensuelle', val:`€${avgMonthlyAll.toLocaleString()}`, sub:`${nonZeroM.length} mois actifs`, color:P.text },
                { label:'Mois sur mois', val:momGrowth!==null?`${momGrowth>0?'+':''}${momGrowth}%`:'—', color:momGrowth===null?P.muted:momGrowth>=0?P.green:P.red, icon:momGrowth!==null?(momGrowth>=0?'↑':'↓'):'' },
              ].map(({label,val,color,sub,icon})=>(
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color, marginTop:8 }}>{icon} {val}</div>
                  {sub&&<div style={{ fontSize:11, color:P.muted, marginTop:4 }}>{sub}</div>}
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:16 }}>Revenus mensuels — Mai 2025 à aujourd'hui</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={progressData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false}/>
                  <XAxis dataKey="month" tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tipStyle} labelStyle={{ color:P.text }}/>
                  <Bar dataKey="gross" fill={P.orange} radius={[3,3,0,0]} name="Brut"/>
                  <Bar dataKey="net" fill={P.green} radius={[3,3,0,0]} name="Net"/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:20, marginTop:8 }}>
                {[[P.orange,'Brut'],[P.green,'Net']].map(([c,l])=>(
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:P.muted }}>
                    <div style={{ width:12, height:8, borderRadius:2, background:c }}/>{l}
                  </div>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:16 }}>Revenus cumulés</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false}/>
                  <XAxis dataKey="month" tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tipStyle} labelStyle={{ color:P.text }}/>
                  <Line type="monotone" dataKey="cumulative" stroke={P.orange} strokeWidth={2.5} dot={{ r:3, fill:P.orange }} name="Cumulé"/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:16 }}>📋 Historique URSSAF trimestriel</div>
              <div style={{ display:'flex', gap:24, marginBottom:16, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontSize:11, color:P.muted }}>URSSAF payée</div>
                  <div style={{ fontSize:20, fontWeight:700, color:P.green }}>€{Math.round(totalUrssafPaid).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:P.muted }}>Encore dû</div>
                  <div style={{ fontSize:20, fontWeight:700, color:totalUrssafOwed>0?P.red:P.green }}>€{Math.round(totalUrssafOwed).toLocaleString()}</div>
                </div>
                {nextDue&&(
                  <div style={{ padding:'8px 14px', background:'rgba(244,147,6,0.12)', border:`1px solid rgba(244,147,6,0.4)`, borderRadius:6 }}>
                    <div style={{ fontSize:11, color:P.muted }}>Prochain paiement</div>
                    <div style={{ fontSize:14, fontWeight:700, color:P.orange }}>{nextDue.due} — €{Math.round(nextDue.urssaf).toLocaleString()}</div>
                  </div>
                )}
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead><tr>
                  {['Trimestre','Revenus','URSSAF dû','Échéance','Statut'].map(h=>(
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', borderBottom:`1px solid ${P.border}`, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:P.muted }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {quarterlyData.map(q=>(
                    <tr key={q.id} style={{ borderBottom:`1px solid rgba(0,0,0,0.05)`, background:nextDue?.id===q.id?'rgba(244,147,6,0.06)':'transparent' }}>
                      <td style={{ padding:'10px 12px', color:P.text, fontWeight:500 }}>{q.label}</td>
                      <td style={{ padding:'10px 12px', color:P.text }}>{q.gross>0?`€${Math.round(q.gross).toLocaleString()}`:'—'}</td>
                      <td style={{ padding:'10px 12px', color:q.isOverdue?P.red:P.orange, fontWeight:600 }}>{q.urssaf>0?`€${Math.round(q.urssaf).toLocaleString()}`:'—'}</td>
                      <td style={{ padding:'10px 12px', color:nextDue?.id===q.id?P.orange:P.muted, fontWeight:nextDue?.id===q.id?700:400 }}>{q.due}</td>
                      <td style={{ padding:'10px 12px' }}>
                        {q.gross>0
                          ? <button onClick={()=>toggleUrssafPaid(q.id)} style={{ padding:'4px 12px', borderRadius:4, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-modern)', background:q.isPaid?'rgba(165,187,26,0.15)':'rgba(244,147,6,0.12)', color:q.isPaid?P.green:P.orange, border:`1px solid ${q.isPaid?'rgba(165,187,26,0.4)':'rgba(244,147,6,0.4)'}` }}>
                              {q.isPaid?'✓ Payé':'Marquer payé'}
                            </button>
                          : <span style={{ color:P.muted, fontSize:12 }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab==='expenses' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }} className="page-enter">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={S.card}>
                <div style={S.label}>Abonnements mensuels</div>
                <div style={{ fontSize:32, fontWeight:700, color:P.orange, marginTop:8 }}>€{recurringTotal.toFixed(2)}</div>
                <div style={{ fontSize:12, color:P.muted, marginTop:4 }}>{cvRecurring.filter(r=>r.active).length} actifs</div>
              </div>
              <div style={S.card}>
                <div style={S.label}>Dépenses ponctuelles ce mois</div>
                <div style={{ fontSize:32, fontWeight:700, color:P.text, marginTop:8 }}>€{currentMonthOneOffs.reduce((s,e)=>s+e.amount,0).toFixed(2)}</div>
                <div style={{ fontSize:12, color:P.muted, marginTop:4 }}>{currentMonthOneOffs.length} entrée(s)</div>
              </div>
            </div>

            {/* Recurring subscriptions */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:16 }}>Abonnements récurrents</div>
              {cvRecurring.length===0
                ? <div style={{ color:P.muted, fontSize:13, padding:'16px 0' }}>Chargement…</div>
                : cvRecurring.map(r=>(
                    <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid rgba(0,0,0,0.05)`, opacity:r.active?1:0.5 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:P.text }}>{r.name}</div>
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:r.active?P.orange:P.muted }}>€{r.amount.toFixed(2)}/mo</div>
                      <button onClick={()=>toggleCVRecurring(r.id)} style={{ padding:'4px 10px', borderRadius:4, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-modern)', background:r.active?'rgba(165,187,26,0.12)':'rgba(0,0,0,0.05)', color:r.active?P.green:P.muted, border:`1px solid ${r.active?'rgba(165,187,26,0.3)':'rgba(0,0,0,0.15)'}` }}>
                        {r.active?'● Actif':'○ Pausé'}
                      </button>
                      <button onClick={()=>deleteCVRecurring(r.id)} style={S.btnDanger}>✕</button>
                    </div>
                  ))
              }
              {/* Add recurring form */}
              <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${P.border}` }}>
                <div style={{ ...S.label, marginBottom:10 }}>+ Ajouter un abonnement</div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <input style={{ ...S.input, flex:2 }} placeholder="Netflix, Adobe…" value={newRecurring.name} onChange={e=>setNewRecurring(p=>({...p,name:e.target.value}))}/>
                  <input style={{ ...S.input, width:120 }} type="number" placeholder="€/mois" value={newRecurring.amount} onChange={e=>setNewRecurring(p=>({...p,amount:e.target.value}))}/>
                  <button style={{ ...S.btn, whiteSpace:'nowrap', padding:'10px 16px' }} onClick={addCVRecurring}>Ajouter</button>
                </div>
              </div>
            </div>

            {/* One-off expenses */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:16 }}>Dépenses ponctuelles</div>
              {oneOffExpenses.length===0
                ? <div style={{ color:P.muted, fontSize:13, padding:'8px 0' }}>{lang==='en'?'No one-off expenses yet.':'Aucune dépense ponctuelle.'}</div>
                : oneOffExpenses.slice().reverse().map(e=>(
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:`1px solid rgba(0,0,0,0.05)` }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:P.text }}>{e.name}</div>
                        <div style={{ fontSize:11, color:P.muted }}>{e.date}</div>
                      </div>
                      <div style={{ fontSize:15, fontWeight:700, color:P.text }}>€{e.amount.toFixed(2)}</div>
                      <button onClick={()=>deleteOneOff(e.id)} style={S.btnDanger}>✕</button>
                    </div>
                  ))
              }
              {/* Add one-off form */}
              <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${P.border}` }}>
                <div style={{ ...S.label, marginBottom:10 }}>+ Ajouter une dépense ponctuelle</div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <input style={{ ...S.input, flex:2 }} placeholder="Imprimante, fournitures…" value={newOneOff.name} onChange={e=>setNewOneOff(p=>({...p,name:e.target.value}))}/>
                  <input style={{ ...S.input, width:120 }} type="number" placeholder="€" value={newOneOff.amount} onChange={e=>setNewOneOff(p=>({...p,amount:e.target.value}))}/>
                  <button style={{ ...S.btn, whiteSpace:'nowrap', padding:'10px 16px' }} onClick={addOneOff}>Ajouter</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab==='history' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }} className="page-enter">
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:16 }}>
                {lang==='en'?'Income History':'Historique'} — {selectedYear}
                <span style={{ color:P.muted, marginLeft:12 }}>{income.length} {lang==='en'?'entries':'entrées'}</span>
              </div>
              {income.length===0
                ? <div style={{ textAlign:'center', padding:40, color:P.muted, fontSize:14 }}>
                    {lang==='en'?'No income recorded yet.':'Aucun revenu enregistré.'}
                  </div>
                : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead><tr>
                      {['Date','Client','Brut','URSSAF','Net','→ Wise','Catégorie'].map(h=>(
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', borderBottom:`1px solid ${P.border}`, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:P.muted }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {income.map(r=>(
                        <tr key={r.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                          <td style={{ padding:'10px 12px', color:P.muted }}>{r.date}</td>
                          <td style={{ padding:'10px 12px', fontWeight:500, color:P.text }}>{r.client||'—'}</td>
                          <td style={{ padding:'10px 12px', color:P.text, fontWeight:600 }}>€{Math.round(r.amount_gross)}</td>
                          <td style={{ padding:'10px 12px', color:P.red }}>−€{Math.round(r.amount_urssaf)}</td>
                          <td style={{ padding:'10px 12px', color:P.green, fontWeight:600 }}>€{Math.round(r.amount_after_urssaf)}</td>
                          <td style={{ padding:'10px 12px', color:P.blue }}>€{Math.round(r.amount_to_piers_wise||0)}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:4, background:P.surface2, color:P.muted, border:`1px solid ${P.border}` }}>
                              {URSSAF_CATEGORIES.find(c=>c.id===r.category)?.label||r.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr style={{ borderTop:`1px solid ${P.border}` }}>
                      <td colSpan={2} style={{ padding:'10px 12px', fontSize:12, fontWeight:700, color:P.text }}>TOTAL {selectedYear}</td>
                      <td style={{ padding:'10px 12px', color:P.text, fontWeight:700 }}>€{Math.round(ytdGross).toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:P.red, fontWeight:700 }}>−€{Math.round(ytdUrssaf).toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:P.green, fontWeight:700 }}>€{Math.round(ytdNet).toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:P.blue, fontWeight:700 }}>€{Math.round(ytdToPiers).toLocaleString()}</td>
                      <td/>
                    </tr></tfoot>
                  </table>
              }
            </div>
          </div>
        )}

        {/* ── SPLITS ── */}
        {tab==='splits' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }} className="page-enter">
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:20 }}>{t.edit_splits}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
                <div>
                  <div style={S.label}>{t.urssaf_rate}</div>
                  {URSSAF_CATEGORIES.map(c=>(
                    <label key={c.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, cursor:'pointer' }}>
                      <input type="radio" name="urssaf" value={c.id} checked={urssafCat===c.id} onChange={()=>setUrssafCat(c.id)} style={{ accentColor:P.orange }}/>
                      <span style={{ fontSize:14, color:P.text }}>{c.label}</span>
                      <span style={{ fontSize:13, color:P.orange, fontWeight:700 }}>{(c.rate*100).toFixed(1)}%</span>
                    </label>
                  ))}
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={S.label}>{t.piers_pct}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:P.blue }}>{Math.round(piersPct)}%</div>
                  </div>
                  <input type="range" min="10" max="60" value={piersPct} onChange={e=>setPiersPct(parseInt(e.target.value))} style={{ width:'100%', accentColor:P.blue }}/>
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={S.label}>{t.invest_pct}</div>
                    <div style={{ fontSize:16, fontWeight:700, color:P.orange }}>{Math.round(investPct)}%</div>
                  </div>
                  <input type="range" min="0" max="30" value={investPct} onChange={e=>setInvestPct(parseInt(e.target.value))} style={{ width:'100%', accentColor:P.orange }}/>
                </div>
                <div style={{ background:P.surface2, borderRadius:8, padding:16 }}>
                  <div style={{ ...S.label, marginBottom:12 }}>Pour chaque 1 000€ net :</div>
                  {[
                    { label:t.to_wise, val:Math.round(1000*piersPct/100), color:P.blue },
                    { label:t.company, val:Math.round(1000*investPct/100), color:P.orange },
                    { label:'Votre salaire', val:Math.round(1000*(1-piersPct/100-investPct/100)), color:P.green },
                  ].map(({label,val,color})=>(
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${P.border}`, fontSize:14 }}>
                      <span style={{ color:P.muted }}>{label}</span>
                      <span style={{ color, fontWeight:700 }}>€{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WISHLIST ── */}
        {tab==='wishlist' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }} className="page-enter">
            {readyToBuy.map(item=>(
              <div key={item.id} style={{ background:'rgba(165,187,26,0.1)', border:`1px solid rgba(165,187,26,0.4)`, borderRadius:8, padding:'12px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ color:P.green, fontSize:14, fontWeight:600 }}>🎉 {item.name} — {lang==='en'?'ready to buy!':'prêt à acheter !'}</div>
                {item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration:'none', fontSize:12, padding:'6px 14px' }}>Voir →</a>}
              </div>
            ))}

            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={S.label}>{t.wish_alloc}</div>
                <div style={{ fontSize:20, fontWeight:700, color:P.orange }}>{wishlistPct}%</div>
              </div>
              <input type="range" min="0" max="20" value={wishlistPct} onChange={e=>{ const v=parseInt(e.target.value); setWishlistPct(v); localStorage.setItem('cv_wishlist_pct',v) }} style={{ width:'100%', accentColor:P.orange }}/>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
              {[
                { label:t.wish_total, val:`€${Math.round(wishTotal).toLocaleString()}`, color:P.text },
                { label:t.wish_funded, val:`€${Math.round(wishFunded).toLocaleString()}`, color:P.green },
                { label:t.wish_months, val:monthsToTop!==null?`${monthsToTop}`:'—', color:P.orange, suffix:monthsToTop?' mo':'' },
              ].map(({label,val,color,suffix})=>(
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize:26, fontWeight:700, color, marginTop:8 }}>{val}<span style={{ fontSize:14, fontWeight:400, color:P.muted }}>{suffix}</span></div>
                </div>
              ))}
            </div>

            <div style={S.accentCard(P.orange)}>
              <div style={{ ...S.label, color:P.orange, marginBottom:16 }}>+ {t.wish_add}</div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:12, marginBottom:12 }}>
                <div><div style={S.label}>{t.wish_name}</div><input style={S.input} value={newWish.name} onChange={e=>setNewWish(p=>({...p,name:e.target.value}))} placeholder="Sony lens…"/></div>
                <div><div style={S.label}>{t.wish_price}</div><input style={S.input} type="number" value={newWish.price} onChange={e=>setNewWish(p=>({...p,price:e.target.value}))} placeholder="€"/></div>
                <div><div style={S.label}>{t.wish_cat}</div>
                  <select style={S.input} value={newWish.category} onChange={e=>setNewWish(p=>({...p,category:e.target.value}))}>
                    <option value="gear">🔧 Gear</option><option value="software">💻 Software</option><option value="other">📦 Other</option>
                  </select>
                </div>
                <div><div style={S.label}>{t.wish_priority}</div>
                  <select style={S.input} value={newWish.priority} onChange={e=>setNewWish(p=>({...p,priority:e.target.value}))}>
                    <option value="dream">⭐ Dream</option><option value="soon">🔜 Soon</option><option value="someday">☁️ Someday</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ flex:1 }}><div style={S.label}>{t.wish_url}</div><input style={S.input} value={newWish.url} onChange={e=>setNewWish(p=>({...p,url:e.target.value}))} placeholder="https://…"/></div>
                <button style={{ ...S.btn, alignSelf:'flex-end', opacity:wishLoading?0.6:1 }} onClick={addWishItem} disabled={wishLoading}>
                  {wishLoading?'Adding…':t.add}
                </button>
              </div>
            </div>

            {wishError&&(
              <div style={{ background:'rgba(230,58,38,0.08)', border:`1px solid rgba(230,58,38,0.3)`, borderRadius:8, padding:'12px 16px' }}>
                <div style={{ fontSize:12, color:P.red, fontWeight:600 }}>⚠ {wishError}</div>
                <button onClick={()=>setWishError(null)} style={{ marginTop:6, fontSize:11, color:P.red, background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Fermer</button>
              </div>
            )}

            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span style={{ fontSize:11, color:P.muted, textTransform:'uppercase', letterSpacing:'0.1em' }}>{t.wish_sort}:</span>
              {['priority','price','funded'].map(s=>(
                <button key={s} onClick={()=>setWishlistSort(s)} style={{ padding:'4px 12px', borderRadius:4, fontSize:12, cursor:'pointer', fontFamily:'var(--font-modern)', background:wishlistSort===s?P.orange:'transparent', color:wishlistSort===s?'#fff':P.muted, border:`1px solid ${P.border}` }}>{s}</button>
              ))}
            </div>

            {sortedWishlist.length===0
              ? <div style={{ ...S.card, textAlign:'center', color:P.muted, fontSize:14, padding:40 }}>Aucun article — ajoutez-en un !</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
                  {sortedWishlist.map(item=><CVWishCard key={item.id} item={item} onMarkBought={markWishPurchased} onDelete={deleteWishItem} S={S} lang={lang}/>)}
                </div>
            }

            {wishlist.some(w=>w.purchased)&&(
              <div style={S.card}>
                <div style={{ ...S.label, marginBottom:12 }}>✓ {lang==='en'?'Purchased':'Achetés'}</div>
                {wishlist.filter(w=>w.purchased).map(item=>(
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${P.border}`, fontSize:13, opacity:0.5 }}>
                    <span style={{ textDecoration:'line-through', color:P.muted }}>{item.name}</span>
                    <span>€{item.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CVWishCard({ item, onMarkBought, onDelete, S, lang }) {
  const funded = item.funded||0
  const fundedPct = Math.min(100,(funded/item.price)*100)
  const isReady = funded>=item.price
  const pc = CV_PRIORITY_COLORS[item.priority]||P.orange

  return (
    <div style={{...S.card, borderLeft: isReady ? `4px solid ${P.green}` : `4px solid transparent`, paddingLeft: isReady ? 24 : 28}}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:3, background:`${pc}22`, color:pc, fontWeight:700, textTransform:'uppercase' }}>
              {CV_PRIORITY_ICONS[item.priority]} {item.priority}
            </span>
            {item.category&&<span style={{ fontSize:10, color:P.muted }}>{CV_CAT_ICONS[item.category]} {item.category}</span>}
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:P.text }}>{item.name}</div>
          {item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:P.orange, textDecoration:'none', marginTop:4, display:'inline-block' }}>🔗 Voir le produit</a>}
        </div>
        <div style={{ fontSize:22, fontWeight:700, color:P.text, marginLeft:12, flexShrink:0 }}>€{item.price.toLocaleString()}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <CircleProgress pct={fundedPct} color={isReady?P.green:P.orange} size={52}/>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:isReady?P.green:P.orange }}>
            {Math.round(fundedPct)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize:13, color:P.text, fontWeight:600 }}>€{Math.round(funded).toLocaleString()} financé</div>
          <div style={{ fontSize:11, color:P.muted }}>sur €{item.price.toLocaleString()}</div>
        </div>
      </div>
      {isReady&&<div style={{ fontSize:12, color:P.green, marginBottom:10, fontWeight:600 }}>🎉 {lang==='en'?'You can buy this now!':"Vous pouvez l'acheter !"}</div>}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={()=>onMarkBought(item.id)} style={{ ...S.btn, flex:1, fontSize:12, padding:'8px', background:isReady?P.green:'transparent', color:isReady?'#fff':P.muted, border:`1px solid ${isReady?P.green:P.border}` }}>
          {lang==='en'?'Mark as bought ✓':'Marquer acheté ✓'}
        </button>
        <button onClick={()=>onDelete(item.id)} style={S.btnDanger}>✕</button>
      </div>
    </div>
  )
}
