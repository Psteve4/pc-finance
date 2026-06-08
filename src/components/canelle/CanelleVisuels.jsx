import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Cell, ReferenceLine } from 'recharts'
import { format, subMonths, addMonths, startOfMonth } from 'date-fns'

// ── URSSAF rate history (taux par mois) ──────────────────────────────
const URSSAF_RATE_HISTORY = {
  '2025-08':0.11,'2025-09':0.106,'2025-10':0.106,'2025-11':0.106,
  '2025-12':0.126,'2026-01':0.126,'2026-02':0.126,'2026-03':0.126,
  '2026-04':0.2198,'2026-05':0.2198,'2026-06':0.2198,
}
function getUrssafRate(month, customRates={}) {
  if (customRates[month]) return customRates[month]
  if (URSSAF_RATE_HISTORY[month]) return URSSAF_RATE_HISTORY[month]
  // Fall back to last known rate
  const known = Object.keys(URSSAF_RATE_HISTORY).sort()
  return URSSAF_RATE_HISTORY[known[known.length-1]] || 0.22
}

// ── Historical income data to seed on first load ──────────────────────
const HISTORICAL_INCOME = [
  { month:'2025-08', gross:791.84,  urssaf:87.10,  net:704.74,  client:'Historique Août' },
  { month:'2025-09', gross:567.25,  urssaf:60.14,  net:507.11,  client:'Historique Septembre' },
  { month:'2025-10', gross:2234.06, urssaf:236.81, net:1997.25, client:'Historique Octobre' },
  { month:'2025-11', gross:932.00,  urssaf:98.79,  net:833.21,  client:'Historique Novembre' },
  { month:'2025-12', gross:1605.99, urssaf:202.35, net:1403.64, client:'Historique Décembre' },
  { month:'2026-01', gross:2059.69, urssaf:259.53, net:1800.16, client:'Historique Janvier' },
  { month:'2026-02', gross:2448.00, urssaf:308.45, net:2139.55, client:'Historique Février' },
  { month:'2026-03', gross:2850.00, urssaf:359.10, net:2490.90, client:'Historique Mars' },
  { month:'2026-04', gross:2320.00, urssaf:509.95, net:1810.05, client:'Historique Avril' },
]

// ── Tutorial steps ────────────────────────────────────────────────────
const TUTORIAL_STEPS = [
  { title:'Dashboard', icon:'🏠', desc:"Ajoutez chaque paiement client dès réception. L'URSSAF et les répartitions sont calculées automatiquement." },
  { title:'Objectif mensuel', icon:'🎯', desc:"Le cercle objectif montre votre cible mensuelle nette. Il se remplit en temps réel avec chaque revenu confirmé." },
  { title:'Dépenses', icon:'💳', desc:"Suivez vos abonnements (Canva, Notion…) et frais ponctuels. Le total mensuel s'affiche en haut." },
  { title:'Progrès & URSSAF', icon:'📊', desc:"Votre historique depuis mai 2025, graphiques de revenus nets, et suivi des paiements URSSAF par trimestre." },
  { title:'Wishlist', icon:'⭐', desc:"Un % de chaque revenu net est automatiquement alloué à votre article prioritaire." },
  { title:'Fin de mois', icon:'📅', desc:"La bannière de clôture apparaît les derniers jours du mois pour vous dire exactement quoi virer et où." },
]

const NET_GOAL = 2500 // default monthly net goal

// ── Default splits ────────────────────────────────────────────────────
const DEFAULT_SPLITS = { business:5, piers:15, retraite:10, courante:70 }

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

// ── Large goal ring — supports confirmed + draft dual fill ─────────────
function GoalCircle({ confirmedNet, draftNet = 0, goal }) {
  const R = 90, C = 2 * Math.PI * R
  const totalNet = confirmedNet + draftNet
  const confPct = goal > 0 ? Math.min(100, (confirmedNet / goal) * 100) : 0
  const totalPct = goal > 0 ? Math.min(100, (totalNet / goal) * 100) : 0
  const reached = confirmedNet >= goal
  const color = reached ? P.green : P.orange
  return (
    <div style={{ position:'relative', width:220, height:220, flexShrink:0 }}>
      <svg width="220" height="220" style={{ transform:'rotate(-90deg)' }}>
        {/* track */}
        <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="18"/>
        {/* draft preview (lighter) */}
        {draftNet > 0 && (
          <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(244,147,6,0.25)" strokeWidth="18"
            strokeDasharray={C} strokeDashoffset={C - (totalPct/100)*C} strokeLinecap="round"/>
        )}
        {/* confirmed fill */}
        <circle cx="110" cy="110" r={R} fill="none" stroke={color} strokeWidth="18"
          strokeDasharray={C} strokeDashoffset={C - (confPct/100)*C} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 0.7s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
        {reached
          ? <div style={{ fontSize:13, color:P.green, fontWeight:700, lineHeight:1.4 }}>🎉<br/>Objectif<br/>atteint!</div>
          : <>
              <div style={{ fontSize:30, fontWeight:700, color, lineHeight:1 }}>{Math.round(confPct)}%</div>
              <div style={{ fontSize:14, color:P.text, marginTop:4, fontWeight:600 }}>€{Math.round(confirmedNet).toLocaleString()}</div>
              <div style={{ fontSize:11, color:P.muted, marginTop:2 }}>/ €{goal.toLocaleString()} net</div>
              {draftNet > 0 && <div style={{ fontSize:10, color:'rgba(244,147,6,0.7)', marginTop:2 }}>dont €{Math.round(draftNet).toLocaleString()} prévu</div>}
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
  // Single source: all income from Supabase. 'income' is derived by year filter below.
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

  // URSSAF monthly reminder
  const _prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM')
  const [urssafBannerDismissed, setUrssafBannerDismissed] = useState(() => {
    if (localStorage.getItem(`cv_urssaf_paid_${_prevMonth}`) === '1') return true
    const snooze = localStorage.getItem(`cv_urssaf_snooze_${_prevMonth}`)
    return !!(snooze && Date.now() < parseInt(snooze))
  })
  const [urssafLog, setUrssafLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_urssaf_log') || '[]') } catch { return [] }
  })

  // Draft income entries (planned payments, stored locally)
  const [draftEntries, setDraftEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_income_drafts') || '[]') } catch { return [] }
  })
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [draftForm, setDraftForm] = useState({ client:'', amount:'', date:format(new Date(),'yyyy-MM-dd'), note:'' })

  // URSSAF custom rates (overlay on URSSAF_RATE_HISTORY)
  const [customRates, setCustomRates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_urssaf_custom_rates') || '{}') } catch { return {} }
  })

  // Custom income splits
  const [splits, setSplits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_splits') || JSON.stringify(DEFAULT_SPLITS)) } catch { return DEFAULT_SPLITS }
  })

  // Historical seeding
  const [seeded, setSeeded] = useState(() => localStorage.getItem('cv_history_seeded') === '1')

  // Tutorial
  const [tutorialOpen, setTutorialOpen] = useState(() => localStorage.getItem('tutorial_seen_cv') !== '1')
  const [tutorialStep, setTutorialStep] = useState(0)

  // End of month dismissed
  const [eomDismissed, setEomDismissed] = useState(() => {
    const key = `cv_eom_dismissed_${format(new Date(),'yyyy-MM')}`
    return localStorage.getItem(key) === '1'
  })

  // Piers salary for current month (to show rent coverage note)
  const [piersSalaryThisMonth, setPiersSalaryThisMonth] = useState(null)

  // Calendar & account overview
  const [calendarMonth, setCalendarMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [calendarDayDetail, setCalendarDayDetail] = useState(null) // 'yyyy-MM-dd' of clicked day
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const [accountBalances, setAccountBalances] = useState({})
  const [accountUpdatedAt, setAccountUpdatedAt] = useState({})

  // Late payment banners dismissed per draft id
  const [lateDismissed, setLateDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_late_dismissed') || '{}') } catch { return {} }
  })

  // Edit / manage modals
  const [editEntry, setEditEntry] = useState(null)       // null = closed, object = entry being edited
  const [showAllEntries, setShowAllEntries] = useState(false)

  // Add income form
  const [form, setForm] = useState({ client:'', amount:'', date:format(new Date(),'yyyy-MM-dd'), cat:'bnc_services', desc:'' })

  // ── Load ───────────────────────────────────────────────────────────
  // Single source of truth: one query, all income, both History and Progress derive from it.
  useEffect(() => {
    loadAllIncome()
    loadWishlist()
    loadCVRecurring()
    loadAccountBalances()
    loadPiersSalary()
    if (!localStorage.getItem('cv_onboarding_done')) {
      supabase.from('cv_income').select('id',{ count:'exact', head:true })
        .then(({ count }) => { if ((count||0) === 0) setOnboardingMode(true) })
    }
  }, [])

  async function loadAllIncome() {
    setLoading(true)
    const { data, error } = await supabase
      .from('cv_income')
      .select('*')
      .order('date', { ascending: false })
    console.log('[cv_income] query result:', { count: data?.length ?? 0, error, rows: data })
    setAllIncome(data || [])
    setLoading(false)
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

  async function loadAccountBalances() {
    try {
      const ids = ['mono_canelle','wise_canelle','wise_piers','wise_vacances','wise_maison']
      const { data } = await supabase.from('mt_balances').select('*').in('account_id', ids)
      const bals = {}, updAts = {}
      ;(data || []).forEach(b => { bals[b.account_id] = b.balance; updAts[b.account_id] = b.updated_at })
      setAccountBalances(bals)
      setAccountUpdatedAt(updAts)
    } catch(e) { console.log('[mt_balances] read error:', e) }
  }

  async function loadPiersSalary() {
    try {
      const currentMonth = format(new Date(), 'yyyy-MM')
      const { data } = await supabase.from('mt_salaries').select('amount').eq('month', currentMonth).eq('person', 'piers').maybeSingle()
      setPiersSalaryThisMonth(data?.amount ?? null)
    } catch(e) { /* non-critical */ }
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

  // ── Historical data seeding ───────────────────────────────────────
  useEffect(() => {
    if (seeded || loading) return
    seedHistoricalData()
  }, [loading, seeded])

  async function seedHistoricalData() {
    for (const h of HISTORICAL_INCOME) {
      const exists = allIncome.some(r => r.date?.startsWith(h.month))
      if (exists) continue
      const rate = getUrssafRate(h.month, customRates)
      const isPost = h.month >= '2026-04'
      const toPiers = h.net * 0.15
      const company = h.net * 0.05
      const retraite = isPost ? h.net * 0.10 : 0
      const salary = h.net - toPiers - company - retraite
      await supabase.from('cv_income').insert({
        client: h.client, amount_gross: h.gross, amount_urssaf: h.urssaf,
        amount_after_urssaf: h.net, amount_to_piers_wise: toPiers,
        amount_company: company, amount_salary: salary,
        date: `${h.month}-01`, category: 'bnc_services', description: 'Historique'
      })
    }
    localStorage.setItem('cv_history_seeded', '1')
    setSeeded(true)
    loadAllIncome()
  }

  // ── Draft entry actions ───────────────────────────────────────────
  function addDraftEntry() {
    if (!draftForm.amount) return
    const entry = {
      id: `draft_${Date.now()}`, client: draftForm.client || 'Client',
      amount_gross: parseFloat(draftForm.amount), date: draftForm.date, note: draftForm.note,
      created: new Date().toISOString()
    }
    const updated = [entry, ...draftEntries]
    setDraftEntries(updated)
    localStorage.setItem('cv_income_drafts', JSON.stringify(updated))
    setDraftForm({ client:'', amount:'', date:format(new Date(),'yyyy-MM-dd'), note:'' })
    setShowDraftForm(false)
  }

  function deleteDraftEntry(id) {
    const updated = draftEntries.filter(d => d.id !== id)
    setDraftEntries(updated)
    localStorage.setItem('cv_income_drafts', JSON.stringify(updated))
  }

  async function confirmDraftEntry(draft) {
    const month = draft.date?.slice(0,7) || currentMonthStr
    const rate = getUrssafRate(month, customRates)
    const gross = draft.amount_gross
    const urssaf = gross * rate, net = gross - urssaf
    const toPiers = net * (splits.piers / 100)
    const company = net * (splits.business / 100)
    const retraite = net * (splits.retraite / 100)
    const salary = net - toPiers - company - retraite
    const { error } = await supabase.from('cv_income').insert({
      client: draft.client, amount_gross: gross, amount_urssaf: urssaf,
      amount_after_urssaf: net, amount_to_piers_wise: toPiers,
      amount_company: company, amount_salary: salary,
      date: draft.date, category: 'bnc_services', description: draft.note || ''
    })
    if (error) { console.error('confirm draft error:', error); return }
    deleteDraftEntry(draft.id)
    loadAllIncome()
  }

  function saveSplits(newSplits) {
    setSplits(newSplits)
    localStorage.setItem('cv_splits', JSON.stringify(newSplits))
  }

  function dismissLateBanner(id) {
    const updated = { ...lateDismissed, [id]: true }
    setLateDismissed(updated)
    localStorage.setItem('cv_late_dismissed', JSON.stringify(updated))
  }

  // ── Income edit / delete ───────────────────────────────────────────
  async function saveEdit(form) {
    if (!editEntry) return
    const gross = parseFloat(form.amount) || 0
    const rate = URSSAF_CATEGORIES.find(c => c.id === form.cat)?.rate || 0.22
    const urssaf = gross * rate, net = gross - urssaf
    const toPiers = net * (piersPct / 100), company = net * (investPct / 100), salary = net - toPiers - company
    const { error } = await supabase.from('cv_income').update({
      client: form.client, amount_gross: gross, amount_urssaf: urssaf,
      amount_after_urssaf: net, amount_to_piers_wise: toPiers,
      amount_company: company, amount_salary: salary,
      date: form.date, category: form.cat, description: form.desc
    }).eq('id', editEntry.id)
    if (error) { console.error('[cv_income] update error:', error); return }
    setEditEntry(null)
    loadAllIncome()
  }

  async function deleteEntry(id) {
    if (!window.confirm('Supprimer cette entrée ?')) return
    const { error } = await supabase.from('cv_income').delete().eq('id', id)
    if (error) { console.error('[cv_income] delete error:', error); return }
    loadAllIncome()
  }

  // ── URSSAF monthly reminder actions ───────────────────────────────
  function markUrssafMonthPaid(month, amount) {
    localStorage.setItem(`cv_urssaf_paid_${month}`, '1')
    const existing = JSON.parse(localStorage.getItem('cv_urssaf_log') || '[]')
    const entry = { month, amount: Math.round(amount * 100) / 100, paidDate: format(new Date(), 'yyyy-MM-dd') }
    const idx = existing.findIndex(e => e.month === month)
    if (idx >= 0) existing[idx] = entry; else existing.unshift(entry)
    localStorage.setItem('cv_urssaf_log', JSON.stringify(existing))
    setUrssafLog([...existing])
    setUrssafBannerDismissed(true)
  }

  function snoozeUrssafBanner(month) {
    const until = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    localStorage.setItem(`cv_urssaf_snooze_${month}`, String(until))
    setUrssafBannerDismissed(true)
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
    loadAllIncome()
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
    if (data) { loadAllIncome() }
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
  // 'income' is allIncome filtered to selectedYear — History tab and dashboard YTD stats use this.
  // Progress tab uses allIncome directly. Both read from the same Supabase query.
  const income = allIncome.filter(r => r.date?.startsWith(String(selectedYear)))

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

  // Current URSSAF rate
  const currentUrssafRate = getUrssafRate(currentMonthStr, customRates)

  // Calendar month derived data (what the income table + calendar display)
  const calendarMonthEntries = allIncome.filter(r => r.date?.startsWith(calendarMonth))
  const calendarMonthDrafts  = draftEntries.filter(d => d.date?.startsWith(calendarMonth))
  const calendarMonthNet     = calendarMonthEntries.reduce((s,r) => s + (r.amount_after_urssaf||0), 0)
  const calendarPrevMonth    = format(subMonths(new Date(calendarMonth+'-01'), 1), 'yyyy-MM')
  const calendarPrevNet      = allIncome.filter(r => r.date?.startsWith(calendarPrevMonth)).reduce((s,r) => s + (r.amount_after_urssaf||0), 0)
  const momNetPct            = calendarPrevNet > 0 ? Math.round((calendarMonthNet - calendarPrevNet) / calendarPrevNet * 100) : null
  const calendarNextMonth    = format(addMonths(new Date(calendarMonth+'-01'), 1), 'yyyy-MM')
  const maxCalendarMonth     = format(addMonths(new Date(), 2), 'yyyy-MM')

  // Latest account updated_at (most recent across all accounts)
  const latestAccountUpdate = Object.values(accountUpdatedAt).sort().reverse()[0]

  // Draft entries for current month
  const currentMonthDrafts = draftEntries.filter(d => d.date?.startsWith(currentMonthStr))
  const lateDrafts = draftEntries.filter(d => new Date(d.date) < new Date() && !lateDismissed[d.id])
  const currentMonthDraftNet = currentMonthDrafts.reduce((s,d) => {
    const n = d.amount_gross * (1 - currentUrssafRate); return s + n
  }, 0)

  // End of month detection (days 28-31 and days 1-6 of next month)
  const todayDay = new Date().getDate()
  const isEndOfMonth = todayDay >= 28 || todayDay <= 6

  // URSSAF monthly reminder — previous month's amounts and paid status
  const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM')
  const prevMonthLabel = monthLabel(prevMonth)
  const prevMonthUrssafAmt = allIncome
    .filter(r => r.date?.startsWith(prevMonth))
    .reduce((s,r) => s + (r.amount_urssaf || 0), 0)
  const prevMonthIsPaid = localStorage.getItem(`cv_urssaf_paid_${prevMonth}`) === '1'
  const showUrssafBanner = !urssafBannerDismissed && !prevMonthIsPaid
  // Current month URSSAF for the status indicator
  const currentMonthUrssaf = allIncome
    .filter(r => r.date?.startsWith(currentMonthStr))
    .reduce((s,r) => s + (r.amount_urssaf || 0), 0)
  const currentMonthUrssafPaid = localStorage.getItem(`cv_urssaf_paid_${currentMonthStr}`) === '1'

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

            {/* ── URSSAF REMINDER BANNER ── */}
            {showUrssafBanner && (
              <div style={{ background:P.orange, borderRadius:12, padding:'20px 24px', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:240 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:4 }}>
                    💰 URSSAF à payer pour {prevMonthLabel}
                  </div>
                  <div style={{ fontSize:14, color:'rgba(255,255,255,0.85)' }}>
                    Montant calculé sur vos revenus de {prevMonthLabel} :{' '}
                    <strong>€{prevMonthUrssafAmt.toFixed(2)}</strong>
                    {prevMonthUrssafAmt === 0 && ' (aucun revenu enregistré ce mois)'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
                  <button
                    onClick={() => markUrssafMonthPaid(prevMonth, prevMonthUrssafAmt)}
                    style={{ background:'#fff', border:'none', borderRadius:100, padding:'10px 22px', color:P.orange, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", whiteSpace:'nowrap' }}>
                    ✅ Marqué comme payé
                  </button>
                  <button
                    onClick={() => snoozeUrssafBanner(prevMonth)}
                    style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.8)', fontSize:13, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", textDecoration:'underline', whiteSpace:'nowrap' }}>
                    Me rappeler plus tard
                  </button>
                </div>
              </div>
            )}

            {/* Goal circle + Account overview side by side */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:16, alignItems:'stretch' }}>
            <div style={S.accentCard(P.orange)}>
              <div style={{ display:'flex', alignItems:'center', gap:32, flexWrap:'wrap' }}>
                <GoalCircle confirmedNet={currentMonthGross * (1 - currentUrssafRate)} draftNet={currentMonthDraftNet} goal={monthlyGoal}/>
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

            {/* Account balances — read-only, synced from Piers' MoneyTime */}
            <div style={{ ...S.card, minWidth:220, display:'flex', flexDirection:'column', gap:0 }}>
              <div style={{ ...S.label, marginBottom:12 }}>Mes comptes</div>
              {[
                { id:'mono_canelle', label:'Monobanque', icon:'🏦', color:P.blue },
                { id:'wise_canelle', label:'Wise moi',   icon:'💳', color:P.green },
                { id:'wise_piers',   label:'Wise Piers', icon:'💰', color:P.orange },
                { id:'wise_assets',  label:'Stocks',     icon:'📈', color:P.gold },
              ].map(acc => {
                const bal = accountBalances[acc.id]
                return (
                  <div key={acc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:acc.color, flexShrink:0 }}/>
                    <div style={{ flex:1, fontSize:13, color:P.muted }}>{acc.icon} {acc.label}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:bal!=null&&bal!==0?P.text:P.subtle }}>
                      {bal!=null&&bal!==0 ? `€${Math.round(bal).toLocaleString()}` : '—'}
                    </div>
                  </div>
                )
              })}
              <div style={{ fontSize:10, color:P.subtle, marginTop:10 }}>
                {latestAccountUpdate
                  ? `màj ${latestAccountUpdate.slice(0,10)}`
                  : 'Mis à jour par Piers dans Money Time'}
              </div>
            </div>
            </div>{/* end 2-col grid */}

            {/* ── LATE PAYMENT BANNERS ── */}
            {lateDrafts.map(d=>{
              const daysLate = Math.floor((Date.now()-new Date(d.date))/(86400000))
              return (
                <div key={d.id} style={{ background:'rgba(230,58,38,0.08)', border:'1px solid rgba(230,58,38,0.3)', borderRadius:10, padding:'14px 20px' }}>
                  <div style={{ fontSize:14, fontWeight:600, color:P.red, marginBottom:10 }}>
                    ⚠️ Paiement en retard — {d.client} devait payer le {d.date} (il y a {daysLate} jour{daysLate>1?'s':''})
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button style={{ ...S.btn, background:P.green, padding:'8px 16px', fontSize:13 }} onClick={()=>confirmDraftEntry(d)}>✅ Reçu maintenant</button>
                    <button style={{ ...S.btn, background:'transparent', border:`1px solid ${P.orange}`, color:P.orange, padding:'8px 16px', fontSize:13 }}
                      onClick={()=>{const u=[...draftEntries];const i=u.findIndex(x=>x.id===d.id);if(i>=0){u[i]={...u[i],date:format(new Date(new Date().getTime()+7*86400000),'yyyy-MM-dd')};setDraftEntries(u);localStorage.setItem('cv_income_drafts',JSON.stringify(u))}}}>
                      ⏰ Reporter 7j
                    </button>
                    <button style={{ ...S.btnGhost(), fontSize:13 }} onClick={()=>dismissLateBanner(d.id)}>Ignorer</button>
                  </div>
                </div>
              )
            })}

            {/* ── END OF MONTH BANNER ── */}
            {isEndOfMonth && !eomDismissed && (
              <div style={{ background:'rgba(109,184,190,0.12)', border:'1px solid rgba(109,184,190,0.4)', borderRadius:12, padding:'20px 24px' }}>
                <div style={{ fontSize:16, fontWeight:700, color:P.blue, marginBottom:10 }}>📅 Clôture du mois</div>
                <div style={{ fontSize:14, color:P.text, marginBottom:12 }}>
                  Revenus confirmés ce mois : <strong>€{Math.round(currentMonthGross).toLocaleString()}</strong> brut &nbsp;·&nbsp;
                  URSSAF : <strong style={{color:P.red}}>€{Math.round(currentMonthGross*currentUrssafRate).toLocaleString()}</strong> &nbsp;·&nbsp;
                  Net : <strong style={{color:P.green}}>€{Math.round(currentMonthGross*(1-currentUrssafRate)).toLocaleString()}</strong>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                  {[
                    { label:`→ Wise Piers (${splits.piers}%)`, amt: currentMonthGross*(1-currentUrssafRate)*splits.piers/100 },
                    { label:`→ Épargne business (${splits.business}%)`, amt: currentMonthGross*(1-currentUrssafRate)*splits.business/100 },
                    { label:`→ Retraite (${splits.retraite}%)`, amt: currentMonthGross*(1-currentUrssafRate)*splits.retraite/100 },
                    { label:`→ URSSAF (${Math.round(currentUrssafRate*100)}%)`, amt: currentMonthGross*currentUrssafRate },
                  ].map(({label,amt})=>(
                    <div key={label} style={{ fontSize:13, color:P.text }}>
                      {label}: <strong style={{color:P.orange}}>€{Math.round(amt).toLocaleString()}</strong>
                    </div>
                  ))}

                  {/* Rent — always shown, highlighted in pink */}
                  <div style={{ marginTop:6, padding:'10px 14px', background:'rgba(224,133,142,0.12)', border:'1px solid rgba(224,133,142,0.4)', borderRadius:8 }}>
                    <div style={{ fontSize:13, color:P.pink, fontWeight:600 }}>
                      ☐ Virement Wise Piers : <strong>€{RENT}</strong> — <span style={{fontWeight:400}}>loyer</span>
                    </div>
                    {piersSalaryThisMonth === null || piersSalaryThisMonth === 0 ? (
                      <div style={{ fontSize:12, color:P.muted, marginTop:4 }}>
                        ⚠ Piers n'a pas encore été payé ce mois-ci — tu couvres le loyer seule. Ce montant se mettra à jour automatiquement dès que Piers ajoute son salaire.
                      </div>
                    ) : (
                      <div style={{ fontSize:12, color:P.green, marginTop:4 }}>
                        ✅ Piers a été payé ce mois-ci (€{Math.round(piersSalaryThisMonth).toLocaleString()}) — le loyer est couvert.
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={()=>{localStorage.setItem(`cv_eom_dismissed_${currentMonthStr}`,'1');setEomDismissed(true)}}
                  style={{ ...S.btn, background:P.blue, padding:'10px 22px', fontSize:13 }}>✅ Mois clôturé</button>
              </div>
            )}

            {/* ── INCOME TABLE — current month ── */}
            <div ref={addIncomeRef} style={S.card}>
              <style>{`
                .cv-field-label { font-size:11px; letter-spacing:0.13em; text-transform:uppercase; color:${P.muted}; margin-bottom:6px; font-weight:600; display:block; }
                .cv-field-input { display:block; width:100%; height:42px; padding:0 2px; background:transparent; border:none; border-bottom:2px solid #e8e0d8; font-size:14px; color:${P.text}; font-family:'Space Grotesk',sans-serif; box-sizing:border-box; }
                .cv-field-input:focus { border-bottom-color:${P.orange}; outline:none; }
              `}</style>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
                <div>
                  {/* Month navigation — synced with calendar */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <button onClick={()=>setCalendarMonth(calendarPrevMonth)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:P.muted, padding:'2px 6px' }}>←</button>
                    <div style={{ ...S.label, marginBottom:0 }}>{MONTH_FR[calendarMonth.slice(5)]} {calendarMonth.slice(0,4)}</div>
                    <button onClick={()=>{ if(calendarNextMonth<=maxCalendarMonth) setCalendarMonth(calendarNextMonth) }} style={{ background:'none', border:'none', cursor:calendarNextMonth<=maxCalendarMonth?'pointer':'default', fontSize:16, color:calendarNextMonth<=maxCalendarMonth?P.muted:P.subtle, padding:'2px 6px' }}>→</button>
                    {/* History dropdown */}
                    <div style={{ position:'relative' }}>
                      <button onClick={()=>setShowHistoryDropdown(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:P.muted }}>Historique ▾</button>
                      {showHistoryDropdown && (
                        <div style={{ position:'absolute', top:'100%', left:0, background:'#fff', borderRadius:8, boxShadow:'0 4px 20px rgba(0,0,0,0.12)', zIndex:100, minWidth:160, padding:'4px 0' }}>
                          {ONBOARDING_MONTHS.slice().reverse().map(ym=>(
                            <button key={ym} onClick={()=>{ setCalendarMonth(ym); setShowHistoryDropdown(false) }}
                              style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 16px', background:ym===calendarMonth?'rgba(244,147,6,0.08)':'transparent', border:'none', cursor:'pointer', fontSize:13, color:P.text, fontFamily:"'Space Grotesk',sans-serif" }}>
                              {monthLabel(ym)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ fontSize:12, color:P.subtle }}>
                      Taux URSSAF : <strong style={{color:P.orange}}>{(getUrssafRate(calendarMonth,customRates)*100).toFixed(1)}%</strong>
                    </div>
                    {/* Month-over-month comparison */}
                    {momNetPct !== null && (
                      <div style={{ fontSize:12, fontWeight:600, color:momNetPct>=0?P.green:P.red }}>
                        {momNetPct>=0?'+':''}{momNetPct}% vs mois précédent
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={()=>setShowDraftForm(v=>!v)} style={{ ...S.btn, padding:'9px 20px', fontSize:13 }}>+ Ajouter un client</button>
                  <button onClick={()=>setShowAllEntries(true)} style={{ ...S.btnGhost(), fontSize:12 }}>📋 Tout voir</button>
                </div>
              </div>

              {/* Add draft form */}
              {showDraftForm && (
                <div style={{ background:'#F7F4F0', borderRadius:10, padding:16, marginBottom:16, display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr auto', gap:12, alignItems:'end' }}>
                  <div><span className="cv-field-label">Client</span><input className="cv-field-input" value={draftForm.client} onChange={e=>setDraftForm(p=>({...p,client:e.target.value}))} placeholder="Nom du client"/></div>
                  <div><span className="cv-field-label">Montant (€ brut)</span><input className="cv-field-input" type="number" value={draftForm.amount} onChange={e=>setDraftForm(p=>({...p,amount:e.target.value}))} placeholder="0.00"/></div>
                  <div><span className="cv-field-label">Date prévue</span><input className="cv-field-input" type="date" value={draftForm.date} onChange={e=>setDraftForm(p=>({...p,date:e.target.value}))}/></div>
                  <div><span className="cv-field-label">Note</span><input className="cv-field-input" value={draftForm.note} onChange={e=>setDraftForm(p=>({...p,note:e.target.value}))} placeholder="N° facture…"/></div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button style={{ ...S.btn, padding:'9px 16px', fontSize:13 }} onClick={addDraftEntry}>Ajouter</button>
                    <button style={{ ...S.btnGhost(), fontSize:13 }} onClick={()=>setShowDraftForm(false)}>✕</button>
                  </div>
                </div>
              )}

              {/* Table */}
              {(calendarMonthEntries.length + calendarMonthDrafts.length) === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', color:P.muted, fontSize:14 }}>
                  Aucun revenu ce mois — cliquez "+ Ajouter un client" pour commencer.
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr>
                    {['Client','Montant brut','Date','Statut','URSSAF','Net',''].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', borderBottom:'2px solid #e8e0d8', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:P.muted }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {/* Confirmed entries */}
                    {calendarMonthEntries.map(r=>(
                      <tr key={r.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding:'10px 10px', fontWeight:500, color:P.text }}>{r.client||'—'}</td>
                        <td style={{ padding:'10px 10px', color:P.text }}>€{Math.round(r.amount_gross)}</td>
                        <td style={{ padding:'10px 10px', color:P.muted }}>{r.date}</td>
                        <td style={{ padding:'10px 10px' }}><span style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(165,187,26,0.12)', color:P.green, fontWeight:600 }}>✅ Confirmé</span></td>
                        <td style={{ padding:'10px 10px', color:P.red }}>−€{Math.round(r.amount_urssaf)}</td>
                        <td style={{ padding:'10px 10px', color:P.green, fontWeight:600 }}>€{Math.round(r.amount_after_urssaf)}</td>
                        <td style={{ padding:'10px 6px', whiteSpace:'nowrap' }}>
                          <button onClick={()=>setEditEntry(r)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, opacity:0.7 }}>✏️</button>
                          <button onClick={()=>deleteEntry(r.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, opacity:0.7 }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {/* Draft entries */}
                    {calendarMonthDrafts.map(d=>{
                      const dRate = getUrssafRate(d.date?.slice(0,7)||calendarMonth, customRates)
                      const dUrssaf = d.amount_gross * dRate
                      const dNet = d.amount_gross - dUrssaf
                      const isLate = new Date(d.date) < new Date()
                      return (
                        <tr key={d.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.04)', background:isLate?'rgba(230,58,38,0.03)':'rgba(244,147,6,0.03)' }}>
                          <td style={{ padding:'10px 10px', color:P.text }}>{isLate?'⚠️ ':''}{d.client}</td>
                          <td style={{ padding:'10px 10px', color:P.muted }}>€{d.amount_gross}</td>
                          <td style={{ padding:'10px 10px', color:isLate?P.red:P.muted }}>{d.date}</td>
                          <td style={{ padding:'10px 10px' }}><span style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(244,147,6,0.12)', color:P.orange, fontWeight:600 }}>📋 Prévu</span></td>
                          <td style={{ padding:'10px 10px', color:P.red, opacity:0.6 }}>−€{Math.round(dUrssaf)}</td>
                          <td style={{ padding:'10px 10px', color:P.muted }}>€{Math.round(dNet)}</td>
                          <td style={{ padding:'10px 6px', whiteSpace:'nowrap' }}>
                            <button onClick={()=>confirmDraftEntry(d)} style={{ ...S.btn, padding:'4px 10px', fontSize:12, background:P.green }} title="Confirmer réception">✓</button>
                            <button onClick={()=>deleteDraftEntry(d.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, opacity:0.7, marginLeft:4 }}>🗑️</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── MONTHLY CALENDAR ── */}
            <CalendarView
              month={calendarMonth}
              allIncome={allIncome}
              draftEntries={draftEntries}
              oneOffExpenses={oneOffExpenses}
              cvRecurring={cvRecurring}
              selectedDay={calendarDayDetail}
              onDayClick={d => setCalendarDayDetail(prev => prev===d ? null : d)}
              onPrev={() => setCalendarMonth(calendarPrevMonth)}
              onNext={() => { if(calendarNextMonth<=maxCalendarMonth) setCalendarMonth(calendarNextMonth) }}
              canGoNext={calendarNextMonth<=maxCalendarMonth}
            />

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

            {/* URSSAF this-month status indicator */}
            <div style={{ display:'flex', gap:12, alignItems:'center', padding:'12px 16px', background:'#fff', borderRadius:10, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {currentMonthUrssafPaid
                  ? <span style={{ fontSize:18 }}>✅</span>
                  : <span style={{ fontSize:18 }}>⚠️</span>}
                <div>
                  <div style={{ fontSize:12, color:P.muted, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:600 }}>
                    URSSAF {format(new Date(),'MMMM yyyy')}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:currentMonthUrssafPaid?P.green:P.orange }}>
                    {currentMonthUrssafPaid ? 'Payé ✓' : `€${currentMonthUrssaf.toFixed(2)} à provisionner`}
                  </div>
                </div>
              </div>
              {!currentMonthUrssafPaid && currentMonthUrssaf > 0 && (
                <button onClick={() => markUrssafMonthPaid(currentMonthStr, currentMonthUrssaf)}
                  style={{ marginLeft:'auto', background:'transparent', border:`1.5px solid ${P.orange}`, borderRadius:100, padding:'6px 18px', color:P.orange, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", whiteSpace:'nowrap' }}>
                  Marquer payé
                </button>
              )}
              {urssafLog.length > 0 && (
                <details style={{ marginLeft:currentMonthUrssaf>0?0:'auto', fontSize:12, color:P.muted, cursor:'pointer' }}>
                  <summary style={{ listStyle:'none', cursor:'pointer', userSelect:'none' }}>📋 Historique paiements</summary>
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4, minWidth:260 }}>
                    {urssafLog.slice(0, 6).map(e => (
                      <div key={e.month} style={{ display:'flex', justifyContent:'space-between', gap:16, fontSize:12 }}>
                        <span style={{ color:P.text }}>{monthLabel(e.month)}</span>
                        <span style={{ color:P.green, fontWeight:600 }}>€{e.amount.toFixed(2)}</span>
                        <span style={{ color:P.subtle }}>{e.paidDate}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Aperçu URSSAF — current month focus */}
            <div style={S.accentCard(P.red)}>
              <div style={{ ...S.label, color:P.red, marginBottom:12 }}>📊 Aperçu URSSAF — {format(new Date(),'MMMM yyyy')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
                {[
                  { label:'Revenus bruts ce mois', val:currentMonthGross, color:P.text },
                  { label:`URSSAF (${(currentUrssafRate*100).toFixed(1)}%)`, val:currentMonthGross*currentUrssafRate, color:P.red },
                  { label:'Virements à effectuer', val:currentMonthGross*(splits.piers/100)+currentMonthGross*(splits.business/100)+currentMonthGross*(splits.retraite/100), color:P.orange },
                ].map(({label,val,color})=>(
                  <div key={label}>
                    <div style={{ fontSize:10, color:P.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:22, fontWeight:700, color }}>€{Math.round(val).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:P.muted, marginTop:10 }}>
                Total URSSAF payée cette année : €{Math.round(totalUrssafPaid).toLocaleString()}
                {forecastPct>70&&<span style={{marginLeft:12,color:P.red}}>⚠️ {forecastPct}% du seuil €77 700 atteint</span>}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:20 }}>Revenus nets — {selectedYear} <span style={{fontSize:10,color:P.subtle,marginLeft:8,fontWeight:400}}>objectif €{NET_GOAL.toLocaleString()} net</span></div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false}/>
                  <XAxis dataKey="month" tick={{ fill:P.muted, fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tipStyle} labelStyle={{ color:P.text }}/>
                  <ReferenceLine y={NET_GOAL} stroke={P.green} strokeDasharray="6 3" label={{ value:`Objectif €${NET_GOAL.toLocaleString()}`, position:'insideTopRight', fill:P.green, fontSize:10 }}/>
                  <Bar dataKey="net" radius={[3,3,0,0]} name="Net">
                    {monthlyData.map((d,i)=><Cell key={i} fill={d.net>=NET_GOAL?P.green:P.orange}/>)}
                  </Bar>
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
              <div style={{ ...S.label, marginBottom:16 }}>
                Revenus nets — Mai 2025 à aujourd'hui
                <span style={{ fontSize:10, color:P.subtle, marginLeft:8, fontWeight:400 }}>objectif €{NET_GOAL.toLocaleString()}/mois</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={progressData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false}/>
                  <XAxis dataKey="month" tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:P.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={tipStyle} labelStyle={{ color:P.text }}/>
                  <ReferenceLine y={NET_GOAL} stroke={P.green} strokeDasharray="6 3" label={{ value:`Objectif €${NET_GOAL.toLocaleString()}`, position:'insideTopRight', fill:P.green, fontSize:10 }}/>
                  <Bar dataKey="net" radius={[3,3,0,0]} name="Net">
                    {progressData.map((d,i)=><Cell key={i} fill={d.net>=NET_GOAL?P.green:P.orange}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', gap:16, marginTop:8 }}>
                {[[P.orange,`Net < €${NET_GOAL.toLocaleString()}`],[P.green,`Net ≥ €${NET_GOAL.toLocaleString()} (objectif)`]].map(([c,l])=>(
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
            {/* Monthly entries — individual rows with edit/delete */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:16 }}>Entrées par mois</div>
              {ONBOARDING_MONTHS.slice().reverse().map(ym => {
                const entries = allIncome.filter(r => r.date?.startsWith(ym))
                if (entries.length === 0) return null
                const monthGross = entries.reduce((s,r) => s + (r.amount_gross||0), 0)
                return (
                  <div key={ym} style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, paddingBottom:6, borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:P.text }}>{monthLabel(ym)}</div>
                      <div style={{ fontSize:16, fontWeight:700, color:P.orange }}>€{Math.round(monthGross).toLocaleString()}</div>
                    </div>
                    {entries.map(r => (
                      <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(0,0,0,0.04)', fontSize:13 }}>
                        <div style={{ color:P.muted, fontSize:12, minWidth:70 }}>{r.date?.slice(5)}</div>
                        <div style={{ flex:1, color:P.text }}>{r.client||'—'}</div>
                        <div style={{ fontWeight:600, color:P.text }}>€{Math.round(r.amount_gross)}</div>
                        <div style={{ color:P.red, fontSize:12 }}>−€{Math.round(r.amount_urssaf)}</div>
                        <div style={{ color:P.green, fontWeight:600, fontSize:12 }}>net €{Math.round(r.amount_after_urssaf)}</div>
                        <button onClick={()=>setEditEntry(r)}
                          style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, padding:'2px 4px', opacity:0.7 }}
                          title="Modifier">✏️</button>
                        <button onClick={()=>deleteEntry(r.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, padding:'2px 4px', opacity:0.7 }}
                          title="Supprimer">🗑️</button>
                      </div>
                    ))}
                  </div>
                )
              })}
              {allIncome.length === 0 && (
                <div style={{ color:P.muted, fontSize:14, textAlign:'center', padding:24 }}>Aucune entrée enregistrée.</div>
              )}
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
                      {['Date','Client','Brut','URSSAF','Net','→ Wise','Catégorie',''].map(h=>(
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', borderBottom:'2px solid #e8e0d8', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:P.muted }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {income.map(r=>(
                        <tr key={r.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                          <td style={{ padding:'10px 12px', color:P.muted, whiteSpace:'nowrap' }}>{r.date}</td>
                          <td style={{ padding:'10px 12px', fontWeight:500, color:P.text }}>{r.client||'—'}</td>
                          <td style={{ padding:'10px 12px', color:P.text, fontWeight:600 }}>€{Math.round(r.amount_gross)}</td>
                          <td style={{ padding:'10px 12px', color:P.red }}>−€{Math.round(r.amount_urssaf)}</td>
                          <td style={{ padding:'10px 12px', color:P.green, fontWeight:600 }}>€{Math.round(r.amount_after_urssaf)}</td>
                          <td style={{ padding:'10px 12px', color:P.blue }}>€{Math.round(r.amount_to_piers_wise||0)}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(244,147,6,0.1)', color:P.orange }}>
                              {URSSAF_CATEGORIES.find(c=>c.id===r.category)?.label?.split('(')[0]?.trim()||r.category}
                            </span>
                          </td>
                          <td style={{ padding:'10px 8px', whiteSpace:'nowrap' }}>
                            <button onClick={()=>setEditEntry(r)}
                              style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, padding:'4px 6px', opacity:0.75 }}
                              title="Modifier">✏️</button>
                            <button onClick={()=>deleteEntry(r.id)}
                              style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, padding:'4px 6px', opacity:0.75 }}
                              title="Supprimer">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr style={{ borderTop:'2px solid #e8e0d8' }}>
                      <td colSpan={2} style={{ padding:'10px 12px', fontSize:12, fontWeight:700, color:P.text }}>TOTAL {selectedYear}</td>
                      <td style={{ padding:'10px 12px', color:P.text, fontWeight:700 }}>€{Math.round(ytdGross).toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:P.red, fontWeight:700 }}>−€{Math.round(ytdUrssaf).toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:P.green, fontWeight:700 }}>€{Math.round(ytdNet).toLocaleString()}</td>
                      <td style={{ padding:'10px 12px', color:P.blue, fontWeight:700 }}>€{Math.round(ytdToPiers).toLocaleString()}</td>
                      <td colSpan={2}/>
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

      {/* ── EDIT MODAL ── */}
      {editEntry && (
        <EditModal
          entry={editEntry}
          piersPct={piersPct}
          investPct={investPct}
          onSave={saveEdit}
          onClose={()=>setEditEntry(null)}
        />
      )}

      {/* ── ALL ENTRIES MODAL ── */}
      {showAllEntries && (
        <AllEntriesModal
          allIncome={allIncome}
          onEdit={r=>{ setShowAllEntries(false); setEditEntry(r) }}
          onDelete={deleteEntry}
          onClose={()=>setShowAllEntries(false)}
        />
      )}

      {/* ── TUTORIAL ── */}
      {tutorialOpen && (
        <TutorialOverlay
          steps={TUTORIAL_STEPS}
          step={tutorialStep}
          onNext={()=>{ if(tutorialStep<TUTORIAL_STEPS.length-1) setTutorialStep(s=>s+1); else { setTutorialOpen(false); localStorage.setItem('tutorial_seen_cv','1') } }}
          onBack={()=>setTutorialStep(s=>Math.max(0,s-1))}
          onClose={()=>{ setTutorialOpen(false); localStorage.setItem('tutorial_seen_cv','1') }}
        />
      )}

      {/* ── ? TUTORIAL BUTTON ── fixed bottom-left ── */}
      <button
        onClick={()=>{ setTutorialStep(0); setTutorialOpen(true) }}
        style={{ position:'fixed', bottom:24, left:24, zIndex:500, width:44, height:44, borderRadius:'50%', background:P.orange, border:'none', color:'#fff', fontSize:20, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(244,147,6,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}
        title="Guide d'utilisation"
      >?</button>
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

// ── Shared modal styles ───────────────────────────────────────────────
const ML = { display:'block', fontSize:11, letterSpacing:'0.13em', textTransform:'uppercase', color:P.muted, marginBottom:6, fontWeight:600, fontFamily:"'Space Grotesk',sans-serif" }
const MI = { display:'block', width:'100%', padding:'10px 2px', background:'transparent', border:'none', borderBottom:'2px solid #e8e0d8', fontSize:14, color:P.text, fontFamily:"'Space Grotesk',sans-serif", outline:'none', boxSizing:'border-box' }

// ── EditModal ─────────────────────────────────────────────────────────
function EditModal({ entry, piersPct, investPct, onSave, onClose }) {
  const [form, setForm] = useState({
    client: entry.client || '',
    amount: String(entry.amount_gross || ''),
    date: entry.date || '',
    cat: entry.category || 'bnc_services',
    desc: entry.description || ''
  })
  const [saving, setSaving] = useState(false)

  const gross = parseFloat(form.amount) || 0
  const rate = URSSAF_CATEGORIES.find(c => c.id === form.cat)?.rate || 0.22
  const urssaf = gross * rate
  const net = gross - urssaf

  async function handleSave() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,10,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, width:520, maxWidth:'100%', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ fontSize:18, fontWeight:700, color:P.text }}>Modifier l'entrée</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:P.muted, lineHeight:1, padding:'0 4px' }}>×</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:18, marginBottom:24 }}>
          <div>
            <label style={ML}>Client</label>
            <input style={MI} value={form.client} onChange={e=>setForm(p=>({...p,client:e.target.value}))} placeholder="Nom du client"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label style={ML}>Montant brut (€)</label>
              <input style={MI} type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="0.00"/>
            </div>
            <div>
              <label style={ML}>Date</label>
              <input style={MI} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
            </div>
          </div>
          <div>
            <label style={ML}>Catégorie URSSAF</label>
            <select style={MI} value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}>
              {URSSAF_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label} ({(c.rate*100).toFixed(1)}%)</option>)}
            </select>
          </div>
          <div>
            <label style={ML}>Note</label>
            <input style={MI} value={form.desc} onChange={e=>setForm(p=>({...p,desc:e.target.value}))} placeholder="Note optionnelle"/>
          </div>
        </div>

        {/* Live URSSAF preview */}
        {gross > 0 && (
          <div style={{ background:'#F7F4F0', borderRadius:10, padding:16, marginBottom:24, fontSize:13 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ color:P.muted }}>Montant brut</span>
              <span style={{ fontWeight:600, color:P.text }}>€{gross.toFixed(2)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ color:P.muted }}>URSSAF ({Math.round(rate*100)}%)</span>
              <span style={{ color:P.red }}>−€{urssaf.toFixed(2)}</span>
            </div>
            <div style={{ height:1, background:'#e8e0d8', margin:'8px 0' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700 }}>
              <span style={{ color:P.green }}>Net personnel</span>
              <span style={{ color:P.green }}>€{net.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:P.muted, fontSize:14, cursor:'pointer', padding:'12px 20px', fontFamily:"'Space Grotesk',sans-serif" }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background:P.orange, border:'none', borderRadius:100, padding:'12px 32px', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif", opacity:saving?0.7:1 }}>
            {saving ? 'Enregistrement…' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CalendarView ──────────────────────────────────────────────────────
const DAY_HEADERS = ['L','M','M','J','V','S','D']

function CalendarView({ month, allIncome, draftEntries, oneOffExpenses, cvRecurring, selectedDay, onDayClick, onPrev, onNext, canGoNext }) {
  const [y, m] = month.split('-').map(Number)
  const firstDayOfWeek = (new Date(y, m-1, 1).getDay() + 6) % 7 // Monday=0
  const daysInMonth = new Date(y, m, 0).getDate()
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7

  return (
    <div style={{ background:'#fff', borderRadius:12, padding:20 }}>
      {/* Calendar header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <button onClick={onPrev} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:P.muted, padding:'4px 8px' }}>←</button>
        <div style={{ fontSize:15, fontWeight:700, color:P.text }}>
          {MONTH_FR[month.slice(5)]} {month.slice(0,4)}
        </div>
        <button onClick={onNext} style={{ background:'none', border:'none', cursor:canGoNext?'pointer':'default', fontSize:20, color:canGoNext?P.muted:P.subtle, padding:'4px 8px' }}>→</button>
      </div>

      {/* Day headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
        {DAY_HEADERS.map((d,i) => (
          <div key={i} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:P.subtle, letterSpacing:'0.08em', padding:'4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {Array.from({ length: totalCells }, (_, idx) => {
          const dayNum = idx - firstDayOfWeek + 1
          const valid = dayNum >= 1 && dayNum <= daysInMonth
          const dateStr = valid ? `${month}-${String(dayNum).padStart(2,'0')}` : null
          const confirmed = valid ? allIncome.filter(r => r.date === dateStr) : []
          const drafts    = valid ? draftEntries.filter(d => d.date === dateStr) : []
          const oneoffs   = valid ? oneOffExpenses.filter(e => e.date === dateStr) : []
          const recurring = valid ? cvRecurring.filter(r => r.active) : [] // show recurring indicator on day 1
          const showRecurring = valid && dayNum === 1 && recurring.length > 0
          const hasExpense = oneoffs.length > 0 || showRecurring
          const isToday = dateStr === format(new Date(), 'yyyy-MM-dd')
          const isSelected = dateStr === selectedDay

          return (
            <div key={idx}
              onClick={() => valid && onDayClick(dateStr)}
              style={{
                minHeight:52, padding:'4px 3px', borderRadius:6, cursor:valid?'pointer':'default',
                background: isSelected ? 'rgba(244,147,6,0.1)' : isToday ? 'rgba(165,187,26,0.08)' : 'transparent',
                border: isToday ? `1.5px solid ${P.green}` : isSelected ? `1.5px solid ${P.orange}` : '1.5px solid transparent',
                transition:'background 0.15s',
              }}>
              {valid && (
                <>
                  <div style={{ fontSize:12, fontWeight:isToday?700:400, color:isToday?P.green:P.text, textAlign:'center', marginBottom:3 }}>{dayNum}</div>
                  {/* Dots */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:2, justifyContent:'center' }}>
                    {confirmed.map((_,i)=><div key={`c${i}`} style={{ width:6, height:6, borderRadius:'50%', background:P.green }}/>)}
                    {drafts.map((_,i)=><div key={`d${i}`} style={{ width:6, height:6, borderRadius:'50%', background:'rgba(165,187,26,0.35)', border:`1px solid ${P.green}` }}/>)}
                    {hasExpense && <div style={{ width:6, height:6, borderRadius:'50%', background:P.red }}/>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:16, marginTop:12, flexWrap:'wrap' }}>
        {[
          { color:P.green, label:'Reçu' },
          { color:'rgba(165,187,26,0.35)', border:`1px solid ${P.green}`, label:'Prévu' },
          { color:P.red, label:'Dépense' },
        ].map(({color,border,label})=>(
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:P.muted }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:color, border:border||'none' }}/>
            {label}
          </div>
        ))}
      </div>

      {/* Day detail panel */}
      {selectedDay && (() => {
        const conf = allIncome.filter(r => r.date === selectedDay)
        const drft = draftEntries.filter(d => d.date === selectedDay)
        const exps = oneOffExpenses.filter(e => e.date === selectedDay)
        const dayNum = parseInt(selectedDay.slice(8))
        const isFirst = dayNum === 1
        const recs = isFirst ? cvRecurring.filter(r => r.active) : []
        const hasAnything = conf.length||drft.length||exps.length||recs.length
        return (
          <div style={{ marginTop:12, padding:'12px 16px', background:'#F7F4F0', borderRadius:10, fontSize:13 }}>
            <div style={{ fontWeight:700, color:P.text, marginBottom:8 }}>{selectedDay}</div>
            {!hasAnything && <div style={{ color:P.subtle }}>Rien ce jour</div>}
            {conf.map(r=>(
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span>✅ {r.client||'Revenu'}</span>
                <span style={{ color:P.green, fontWeight:600 }}>+€{Math.round(r.amount_gross)}</span>
              </div>
            ))}
            {drft.map(d=>(
              <div key={d.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span>📋 {d.client} (prévu)</span>
                <span style={{ color:P.muted }}>+€{d.amount_gross}</span>
              </div>
            ))}
            {exps.map(e=>(
              <div key={e.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span>💸 {e.name}</span>
                <span style={{ color:P.red }}>−€{e.amount.toFixed(2)}</span>
              </div>
            ))}
            {recs.map(r=>(
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span>🔄 {r.name} (mensuel)</span>
                <span style={{ color:P.red }}>−€{r.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ── TutorialOverlay ───────────────────────────────────────────────────
function TutorialOverlay({ steps, step, onNext, onBack, onClose }) {
  const s = steps[step]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,10,0,0.7)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:40, maxWidth:480, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>{s.icon}</div>
        <div style={{ fontSize:11, letterSpacing:'0.15em', textTransform:'uppercase', color:P.muted, marginBottom:8 }}>
          Étape {step+1} / {steps.length}
        </div>
        <div style={{ fontSize:22, fontWeight:700, color:P.text, marginBottom:12 }}>{s.title}</div>
        <div style={{ fontSize:15, color:P.muted, lineHeight:1.7, marginBottom:32 }}>{s.desc}</div>
        <div style={{ display:'flex', gap:8, justifyContent:'center', alignItems:'center' }}>
          {step > 0 && <button onClick={onBack} style={{ background:'transparent', border:'none', color:P.muted, fontSize:14, cursor:'pointer', padding:'10px 20px', fontFamily:"'Space Grotesk',sans-serif" }}>← Retour</button>}
          <button onClick={onNext} style={{ background:P.orange, border:'none', borderRadius:100, padding:'12px 32px', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'Space Grotesk',sans-serif" }}>
            {step < steps.length-1 ? 'Suivant →' : '✓ Commencer'}
          </button>
        </div>
        <button onClick={onClose} style={{ marginTop:16, background:'none', border:'none', color:P.subtle, fontSize:12, cursor:'pointer', display:'block', margin:'16px auto 0', fontFamily:"'Space Grotesk',sans-serif" }}>Passer le tutoriel</button>
        {/* Step dots */}
        <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:20 }}>
          {steps.map((_,i)=><div key={i} style={{ width:8, height:8, borderRadius:'50%', background:i===step?P.orange:'rgba(0,0,0,0.12)' }}/>)}
        </div>
      </div>
    </div>
  )
}

// ── AllEntriesModal ───────────────────────────────────────────────────
function AllEntriesModal({ allIncome, onEdit, onDelete, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,10,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, width:900, maxWidth:'100%', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:P.text }}>Toutes les entrées de revenus</div>
            <div style={{ fontSize:12, color:P.muted, marginTop:4 }}>{allIncome.length} entrée{allIncome.length!==1?'s':''} au total</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:P.muted, lineHeight:1, padding:'0 4px' }}>×</button>
        </div>

        {allIncome.length === 0
          ? <div style={{ textAlign:'center', padding:40, color:P.muted, fontSize:14 }}>Aucun revenu enregistré.</div>
          : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr>
                {['Date','Client','Brut','URSSAF','Net','Catégorie','Actions'].map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', borderBottom:'2px solid #e8e0d8', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:P.muted }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {allIncome.map(r=>(
                  <tr key={r.id} style={{ borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
                    <td style={{ padding:'10px 12px', color:P.muted, whiteSpace:'nowrap' }}>{r.date}</td>
                    <td style={{ padding:'10px 12px', color:P.text }}>{r.client||'—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600, color:P.text }}>€{Math.round(r.amount_gross)}</td>
                    <td style={{ padding:'10px 12px', color:P.red }}>−€{Math.round(r.amount_urssaf)}</td>
                    <td style={{ padding:'10px 12px', color:P.green, fontWeight:600 }}>€{Math.round(r.amount_after_urssaf)}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:100, background:'rgba(244,147,6,0.1)', color:P.orange, whiteSpace:'nowrap' }}>
                        {URSSAF_CATEGORIES.find(c=>c.id===r.category)?.label?.split('(')[0]?.trim()||r.category}
                      </span>
                    </td>
                    <td style={{ padding:'10px 8px', whiteSpace:'nowrap' }}>
                      <button onClick={()=>onEdit(r)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, padding:'4px 6px', opacity:0.75 }} title="Modifier">✏️</button>
                      <button onClick={()=>onDelete(r.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, padding:'4px 6px', opacity:0.75 }} title="Supprimer">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  )
}
