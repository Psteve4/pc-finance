import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths, parseISO, getYear } from 'date-fns'

const RENT = 800
const PIERS_WISE_PCT = 0.40
const INVEST_PCT = 0.10

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
    back: '← Back', add_income: 'Add Income',
    client: 'Client', amount: 'Amount (gross €)', date: 'Date',
    urssaf_rate: 'URSSAF Category', add: 'Record Income',
    year: 'Year', gross: 'Gross', urssaf: 'URSSAF', net: 'Net to Self',
    company: 'Company reinvestment', to_wise: "→ Piers' Wise",
    year_total: 'YTD Turnover', threshold: '2025 Threshold',
    tips: 'Business Tips', chart_title: 'Monthly Revenue',
    edit_splits: 'Edit Splits', piers_pct: "% to Piers' Wise",
    invest_pct: '% reinvest company',
    wishlist: 'Wishlist', wish_add: 'Add to Wishlist', wish_name: 'Item name',
    wish_price: 'Price (€)', wish_url: 'Product URL', wish_cat: 'Category',
    wish_priority: 'Priority', wish_total: 'Total wishlist', wish_funded: 'Total funded',
    wish_months: 'Months to top item', wish_sort: 'Sort by',
    wish_alloc: '% of net income → wishlist fund',
  },
  fr: {
    back: '← Retour', add_income: 'Ajouter un revenu',
    client: 'Client', amount: 'Montant brut (€)', date: 'Date',
    urssaf_rate: 'Catégorie URSSAF', add: 'Enregistrer',
    year: 'Année', gross: 'Brut', urssaf: 'URSSAF', net: 'Net personnel',
    company: 'Réinvesti entreprise', to_wise: "→ Wise Piers",
    year_total: 'CA annuel', threshold: 'Seuil 2025',
    tips: 'Conseils pro', chart_title: 'Revenus mensuels',
    edit_splits: 'Modifier la répartition', piers_pct: "% vers Wise Piers",
    invest_pct: '% réinvesti entreprise',
    wishlist: 'Liste de souhaits', wish_add: 'Ajouter à la liste', wish_name: "Nom de l'article",
    wish_price: 'Prix (€)', wish_url: 'URL produit', wish_cat: 'Catégorie',
    wish_priority: 'Priorité', wish_total: 'Total liste', wish_funded: 'Total financé',
    wish_months: "Mois pour l'article top", wish_sort: 'Trier par',
    wish_alloc: '% du net → fonds liste',
  }
}

const NAV_LABELS = {
  en: { dashboard: 'Dashboard', progress: 'Progress', expenses: 'Expenses', history: 'History', splits: 'Splits', wishlist: 'Wishlist' },
  fr: { dashboard: 'Tableau', progress: 'Progression', expenses: 'Dépenses', history: 'Historique', splits: 'Répartition', wishlist: 'Liste' }
}

// Months from May 2025 to current month
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

const MONTH_LABELS_FR = {
  '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
  '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
  '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre'
}
function monthLabel(ym) {
  const [year, mon] = ym.split('-')
  return `${MONTH_LABELS_FR[mon]} ${year}`
}

// URSSAF quarters (Q2 2025 onward since activity starts May 2025)
const URSSAF_QUARTERS = [
  { id: 'Q2_2025', label: 'Q2 2025 (Avr–Jun)', year: 2025, months: ['04','05','06'], due: '31 juil. 2025', dueDate: new Date(2025,6,31) },
  { id: 'Q3_2025', label: 'Q3 2025 (Jul–Sep)', year: 2025, months: ['07','08','09'], due: '31 oct. 2025',  dueDate: new Date(2025,9,31) },
  { id: 'Q4_2025', label: 'Q4 2025 (Oct–Déc)', year: 2025, months: ['10','11','12'], due: '31 jan. 2026', dueDate: new Date(2026,0,31) },
  { id: 'Q1_2026', label: 'Q1 2026 (Jan–Mar)', year: 2026, months: ['01','02','03'], due: '30 avr. 2026', dueDate: new Date(2026,3,30) },
  { id: 'Q2_2026', label: 'Q2 2026 (Avr–Jun)', year: 2026, months: ['04','05','06'], due: '31 juil. 2026', dueDate: new Date(2026,6,31) },
  { id: 'Q3_2026', label: 'Q3 2026 (Jul–Sep)', year: 2026, months: ['07','08','09'], due: '31 oct. 2026', dueDate: new Date(2026,9,31) },
  { id: 'Q4_2026', label: 'Q4 2026 (Oct–Déc)', year: 2026, months: ['10','11','12'], due: '31 jan. 2027', dueDate: new Date(2027,0,31) },
]

// ── Small SVG circle progress ──────────────────────────────────────────
function CircleProgress({ pct, color = '#F49306', size = 52 }) {
  const R = (size - 6) / 2
  const C = 2 * Math.PI * R
  const offset = C - (Math.min(100, Math.max(0, pct)) / 100) * C
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

// ── Large monthly goal ring ────────────────────────────────────────────
function GoalCircle({ current, goal }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0
  const reached = current >= goal
  const R = 90
  const C = 2 * Math.PI * R
  const offset = C - (pct / 100) * C
  const color = reached ? '#1a7040' : '#F49306'
  return (
    <div style={{ position: 'relative', width: 220, height: 220, flexShrink: 0 }}>
      <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="18" />
        <circle cx="110" cy="110" r={R} fill="none" stroke={color} strokeWidth="18"
          strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {reached ? (
          <div style={{ fontSize: 13, color: '#1a7040', fontWeight: 700, lineHeight: 1.4 }}>🎉<br/>Objectif<br/>atteint!</div>
        ) : (
          <>
            <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{Math.round(pct)}%</div>
            <div style={{ fontSize: 14, color: '#0a1f14', marginTop: 4, fontWeight: 600 }}>€{Math.round(current).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#3a6e52', marginTop: 2 }}>/ €{goal.toLocaleString()}</div>
          </>
        )}
      </div>
    </div>
  )
}

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
  const [newWishItem, setNewWishItem] = useState({ name: '', price: '', url: '', category: 'gear', priority: 'soon' })
  const [wishlistPct, setWishlistPct] = useState(() => parseInt(localStorage.getItem('cv_wishlist_pct') || '5'))
  const [wishlistSort, setWishlistSort] = useState('priority')
  const [wishError, setWishError] = useState(null)
  const [wishLoading, setWishLoading] = useState(false)

  // Onboarding
  const [onboardingMode, setOnboardingMode] = useState(false)
  const [onboardingRows, setOnboardingRows] = useState({})
  const [onboardingSaving, setOnboardingSaving] = useState(false)
  const [onboardingSaved, setOnboardingSaved] = useState(false)

  // Monthly goal
  const [monthlyGoal, setMonthlyGoal] = useState(() => parseInt(localStorage.getItem('cv_monthly_goal') || '2500'))
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

  // Recurring expenses
  const [cvRecurring, setCvRecurring] = useState([])

  // URSSAF paid toggles (localStorage)
  const [urssafPaid, setUrssafPaid] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cv_urssaf_paid') || '{}') } catch { return {} }
  })

  // Add income form
  const [form, setForm] = useState({ client: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), cat: 'bnc_services', desc: '' })

  // ── Load data ─────────────────────────────────────────────────────────
  useEffect(() => { loadIncome() }, [selectedYear])

  useEffect(() => {
    loadAllIncome()
    loadWishlist()
    loadCVRecurring()
    if (!localStorage.getItem('cv_onboarding_done')) {
      supabase.from('cv_income').select('id', { count: 'exact', head: true })
        .then(({ count }) => { if ((count || 0) === 0) setOnboardingMode(true) })
    }
  }, [])

  async function loadIncome() {
    setLoading(true)
    const { data } = await supabase.from('cv_income')
      .select('*').gte('date', `${selectedYear}-01-01`).lte('date', `${selectedYear}-12-31`)
      .order('date', { ascending: false })
    setIncome(data || [])
    setLoading(false)
  }

  async function loadAllIncome() {
    const { data } = await supabase.from('cv_income').select('*').gte('date', '2025-05-01').order('date')
    setAllIncome(data || [])
  }

  async function loadWishlist() {
    const { data } = await supabase.from('cv_wishlist').select('*').order('created_at')
    setWishlist(data || [])
  }

  async function loadCVRecurring() {
    const LOCAL_DEFAULTS = [
      { id: 'c1', name: 'Canva',    amount: 14.99, active: true },
      { id: 'c2', name: 'Notion',   amount: 8.00,  active: true },
      { id: 'c3', name: 'ChatGPT',  amount: 20.00, active: true },
    ]
    try {
      const { data, error } = await supabase.from('cv_recurring').select('*').order('created_at')
      if (error) throw error
      if (!data || data.length === 0) {
        const payload = LOCAL_DEFAULTS.map(({ name, amount, active }) => ({ name, amount, active }))
        const { data: ins } = await supabase.from('cv_recurring').insert(payload).select()
        setCvRecurring(ins || LOCAL_DEFAULTS)
      } else {
        setCvRecurring(data)
      }
    } catch {
      const saved = localStorage.getItem('cv_recurring_local')
      setCvRecurring(saved ? JSON.parse(saved) : LOCAL_DEFAULTS)
      if (!localStorage.getItem('cv_recurring_local'))
        localStorage.setItem('cv_recurring_local', JSON.stringify(LOCAL_DEFAULTS))
    }
  }

  function scrollToAddIncome(date) {
    setTab('dashboard')
    if (date) setForm(p => ({ ...p, date }))
    setTimeout(() => addIncomeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  // ── Onboarding ────────────────────────────────────────────────────────
  async function saveOnboarding() {
    setOnboardingSaving(true)
    const rows = Object.entries(onboardingRows).filter(([, v]) => v && parseFloat(v.amount) > 0)
    for (const [month, { amount, note }] of rows) {
      const gross = parseFloat(amount)
      const rate = URSSAF_CATEGORIES[0].rate // default BNC
      const urssaf = gross * rate
      const net = gross - urssaf
      const toPiers = net * (piersPct / 100)
      const company = net * (investPct / 100)
      const salary = net - toPiers - company
      await supabase.from('cv_income').insert({
        client: note || 'Historique', amount_gross: gross, amount_urssaf: urssaf,
        amount_after_urssaf: net, amount_to_piers_wise: toPiers,
        amount_company: company, amount_salary: salary,
        date: `${month}-01`, category: 'bnc_services', description: note || 'Historique'
      })
    }
    localStorage.setItem('cv_onboarding_done', '1')
    setOnboardingMode(false)
    setOnboardingSaving(false)
    setOnboardingSaved(true)
    setOnboardingRows({})
    loadIncome()
    loadAllIncome()
    setTimeout(() => setOnboardingSaved(false), 5000)
  }

  function skipOnboarding() {
    localStorage.setItem('cv_onboarding_done', '1')
    setOnboardingMode(false)
  }

  // ── Income ────────────────────────────────────────────────────────────
  async function addIncome() {
    if (!form.amount || !form.date) return
    const gross = parseFloat(form.amount)
    const rate = URSSAF_CATEGORIES.find(c => c.id === form.cat)?.rate || 0.22
    const urssaf = gross * rate
    const net = gross - urssaf
    const toPiers = net * (piersPct / 100)
    const company = net * (investPct / 100)
    const salary = net - toPiers - company
    const { data } = await supabase.from('cv_income').insert({
      client: form.client, amount_gross: gross, amount_urssaf: urssaf,
      amount_after_urssaf: net, amount_to_piers_wise: toPiers,
      amount_company: company, amount_salary: salary,
      date: form.date, category: form.cat, description: form.desc
    }).select().single()
    if (data) { setIncome(prev => [data, ...prev]); loadAllIncome() }
    setForm({ client: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), cat: 'bnc_services', desc: '' })
    if (wishlistPct > 0) {
      const alloc = net * (wishlistPct / 100)
      const PO = { dream: 0, soon: 1, someday: 2 }
      const top = [...wishlist].filter(w => !w.purchased && (w.funded || 0) < w.price)
        .sort((a, b) => (PO[a.priority] ?? 9) - (PO[b.priority] ?? 9))[0]
      if (top) {
        const nf = Math.min((top.funded || 0) + alloc, top.price)
        await supabase.from('cv_wishlist').update({ funded: nf }).eq('id', top.id)
        setWishlist(prev => prev.map(w => w.id === top.id ? { ...w, funded: nf } : w))
      }
    }
  }

  // ── Wishlist ──────────────────────────────────────────────────────────
  async function addWishItem() {
    if (!newWishItem.name || !newWishItem.price) return
    setWishError(null); setWishLoading(true)
    const { data, error } = await supabase.from('cv_wishlist').insert({
      name: newWishItem.name, price: parseFloat(newWishItem.price),
      url: newWishItem.url || null, category: newWishItem.category || null,
      priority: newWishItem.priority || 'soon', funded: 0, purchased: false,
    }).select().single()
    if (error) { setWishError(`${error.message} (code: ${error.code})`); setWishLoading(false); return }
    setWishlist(prev => [...prev, data])
    setNewWishItem({ name: '', price: '', url: '', category: 'gear', priority: 'soon' })
    setWishLoading(false)
  }
  async function deleteWishItem(id) {
    await supabase.from('cv_wishlist').delete().eq('id', id)
    setWishlist(prev => prev.filter(w => w.id !== id))
  }
  async function markWishPurchased(id) {
    await supabase.from('cv_wishlist').update({ purchased: true }).eq('id', id)
    setWishlist(prev => prev.map(w => w.id === id ? { ...w, purchased: true } : w))
  }

  // ── URSSAF paid toggle ────────────────────────────────────────────────
  function toggleUrssafPaid(qId) {
    setUrssafPaid(prev => {
      const next = { ...prev, [qId]: !prev[qId] }
      localStorage.setItem('cv_urssaf_paid', JSON.stringify(next))
      return next
    })
  }

  // ── Derived calculations ──────────────────────────────────────────────
  const rate = URSSAF_CATEGORIES.find(c => c.id === urssafCat)?.rate || 0.22
  const previewGross = parseFloat(form.amount) || 0
  const previewUrssaf = previewGross * rate
  const previewNet = previewGross - previewUrssaf
  const previewToPiers = previewNet * (piersPct / 100)
  const previewCompany = previewNet * (investPct / 100)
  const previewSalary = previewNet - previewToPiers - previewCompany

  const ytdGross = income.reduce((s, r) => s + (r.amount_gross || 0), 0)
  const ytdUrssaf = income.reduce((s, r) => s + (r.amount_urssaf || 0), 0)
  const ytdNet = income.reduce((s, r) => s + (r.amount_after_urssaf || 0), 0)
  const ytdToPiers = income.reduce((s, r) => s + (r.amount_to_piers_wise || 0), 0)
  const THRESHOLD_2025 = 77700

  const currentMonthStr = format(new Date(), 'yyyy-MM')
  const currentMonthGross = income.filter(r => r.date?.startsWith(currentMonthStr))
    .reduce((s, r) => s + (r.amount_gross || 0), 0)

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    const mi = income.filter(r => r.date?.startsWith(`${selectedYear}-${m}`))
    return { month: m, gross: Math.round(mi.reduce((s, r) => s + (r.amount_gross || 0), 0)), net: Math.round(mi.reduce((s, r) => s + (r.amount_after_urssaf || 0), 0)) }
  })

  const monthsWithData = new Set(income.map(r => r.date?.slice(0, 7)).filter(Boolean)).size
  const avgMonthlyGross = monthsWithData > 0 ? ytdGross / monthsWithData : 0
  const currentCalMonth = new Date().getMonth() + 1
  const isCurrentYear = selectedYear === new Date().getFullYear()
  const remainingMonths = isCurrentYear ? Math.max(0, 12 - currentCalMonth) : 0
  const projectedAnnualGross = ytdGross + remainingMonths * avgMonthlyGross
  const estimatedTotalUrssaf = projectedAnnualGross * 0.22
  const stillToSetUrssaf = Math.max(0, estimatedTotalUrssaf - ytdUrssaf)
  const forecastThresholdPct = projectedAnnualGross > 0 ? Math.round(projectedAnnualGross / THRESHOLD_2025 * 100) : 0

  // Progress tab: all income from May 2025 onwards
  const progressData = ONBOARDING_MONTHS.map(ym => {
    const mi = allIncome.filter(r => r.date?.startsWith(ym))
    const gross = Math.round(mi.reduce((s, r) => s + (r.amount_gross || 0), 0))
    const net = Math.round(mi.reduce((s, r) => s + (r.amount_after_urssaf || 0), 0))
    return { ym, month: ym.slice(5) + "'" + ym.slice(2, 4), gross, net }
  })
  const allTimeGross = progressData.reduce((s, d) => s + d.gross, 0)
  const nonZeroMonths = progressData.filter(d => d.gross > 0)
  const avgMonthlyAll = nonZeroMonths.length > 0 ? Math.round(allTimeGross / nonZeroMonths.length) : 0
  const bestMonth = [...progressData].sort((a, b) => b.gross - a.gross)[0] || { month: '—', gross: 0 }
  const recentNZ = progressData.filter(d => d.gross > 0)
  let momGrowth = null
  if (recentNZ.length >= 2) {
    const last = recentNZ[recentNZ.length - 1].gross
    const prev = recentNZ[recentNZ.length - 2].gross
    momGrowth = prev > 0 ? Math.round((last - prev) / prev * 100) : null
  }
  let cum = 0
  const cumulativeData = progressData.map(d => { cum += d.gross; return { ...d, cumulative: cum } })

  // URSSAF quarters
  const now = new Date()
  const activeQuarters = URSSAF_QUARTERS.filter(q => new Date(q.year, parseInt(q.months[0]) - 1, 1) <= now)
  const quarterlyData = activeQuarters.map(q => {
    const qI = allIncome.filter(r => q.months.some(m => r.date?.startsWith(`${q.year}-${m}`)))
    const gross = qI.reduce((s, r) => s + (r.amount_gross || 0), 0)
    const urssaf = qI.reduce((s, r) => s + (r.amount_urssaf || 0), 0)
    const isPaid = !!urssafPaid[q.id]
    const isOverdue = now > q.dueDate && !isPaid && gross > 0
    return { ...q, gross, urssaf, isPaid, isOverdue }
  })
  const nextDue = quarterlyData.filter(q => !q.isPaid && q.gross > 0 && q.dueDate >= now)
    .sort((a, b) => a.dueDate - b.dueDate)[0]
  const totalUrssafOwed = quarterlyData.filter(q => !q.isPaid).reduce((s, q) => s + q.urssaf, 0)
  const totalUrssafPaid = quarterlyData.filter(q => q.isPaid).reduce((s, q) => s + q.urssaf, 0)

  // Recurring total
  const recurringTotal = cvRecurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0)

  // Wishlist
  const PRIORITY_ORDER = { dream: 0, soon: 1, someday: 2 }
  const activeWish = wishlist.filter(w => !w.purchased)
  const wishTotal = activeWish.reduce((s, w) => s + w.price, 0)
  const wishFunded = activeWish.reduce((s, w) => s + (w.funded || 0), 0)
  const readyToBuy = activeWish.filter(w => (w.funded || 0) >= w.price)
  const monthlyAvgNet = currentCalMonth > 0 ? ytdNet / currentCalMonth : 0
  const wishMonthlyContrib = monthlyAvgNet * (wishlistPct / 100)
  const topUnfunded = [...activeWish].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)).find(w => (w.funded || 0) < w.price)
  const monthsToTop = topUnfunded && wishMonthlyContrib > 0 ? Math.ceil((topUnfunded.price - (topUnfunded.funded || 0)) / wishMonthlyContrib) : null
  const sortedWishlist = [...activeWish].sort((a, b) => {
    if (wishlistSort === 'priority') return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    if (wishlistSort === 'price') return b.price - a.price
    if (wishlistSort === 'funded') return ((b.funded || 0) / b.price) - ((a.funded || 0) / a.price)
    return 0
  })

  // ── Styles ────────────────────────────────────────────────────────────
  const S = {
    container: { minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'var(--font-modern)' },
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: 24 },
    label: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-muted)', marginBottom: 6 },
    input: { background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '10px 14px', color: 'var(--c-text)', fontSize: 13, width: '100%', fontFamily: 'var(--font-modern)' },
    btn: { background: 'var(--c-accent)', border: 'none', borderRadius: 6, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: 'var(--font-modern)', transition: 'all 0.15s' },
    navBtn: (active) => ({
      padding: '14px 22px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: 'transparent', color: active ? '#0a1f14' : 'var(--c-muted)',
      border: 'none', borderBottom: active ? '2px solid var(--c-accent)' : '2px solid transparent',
      letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-modern)',
      transition: 'all 0.15s'
    }),
  }

  const tooltipStyle = { background: '#a8cfc0', border: '1px solid #7aaa90', borderRadius: 6, fontSize: 12, color: '#0a1f14' }

  // ── ONBOARDING SCREEN ─────────────────────────────────────────────────
  if (onboardingMode) {
    return (
      <div className="canelle" style={{ ...S.container, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 680 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0a1f14', marginBottom: 10 }}>
              👋 Bienvenue Canelle! Let's set up your history
            </div>
            <div style={{ fontSize: 14, color: '#3a6e52', lineHeight: 1.7 }}>
              Add your income from May 2025 to today in one go. You only do this once.
              Months with no income can be left blank.
            </div>
          </div>

          <div style={{ ...S.card, borderColor: 'rgba(244,147,6,0.4)', marginBottom: 20 }}>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 10, marginBottom: 10 }}>
              {['Month', 'Total gross (€)', 'Note (optional)'].map(h => (
                <div key={h} style={{ ...S.label, marginBottom: 0 }}>{h}</div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
              {ONBOARDING_MONTHS.map(ym => {
                const row = onboardingRows[ym] || {}
                const set = (patch) => setOnboardingRows(prev => ({ ...prev, [ym]: { ...prev[ym], ...patch } }))
                return (
                  <div key={ym} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: '#3a6e52', fontWeight: 500 }}>{monthLabel(ym)}</div>
                    <input style={{ ...S.input, padding: '7px 10px', fontSize: 12 }} type="number" placeholder="0"
                      value={row.amount || ''} onChange={e => set({ amount: e.target.value })} />
                    <input style={{ ...S.input, padding: '7px 10px', fontSize: 12 }} placeholder="Historique"
                      value={row.note || ''} onChange={e => set({ note: e.target.value })} />
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <button style={{ ...S.btn, fontSize: 16, padding: '14px 36px', borderRadius: 10, opacity: onboardingSaving ? 0.6 : 1 }}
              onClick={saveOnboarding} disabled={onboardingSaving}>
              {onboardingSaving ? 'Saving…' : '✅ Save all history & start'}
            </button>
            <button style={{ background: 'none', border: 'none', color: '#3a6e52', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-modern)' }}
              onClick={skipOnboarding}>Skip — I'll add history later</button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN APP ──────────────────────────────────────────────────────────
  return (
    <div className="canelle" style={S.container}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--c-border)', background: 'rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button onClick={onBack} style={{ ...S.btn, background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)', padding: '8px 14px', fontSize: 12 }}>{t.back}</button>
          <div>
            <div style={{ lineHeight: 1 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#0a1f14', letterSpacing: '-0.01em' }}>Canelle</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#F49306', letterSpacing: '-0.01em' }}>.visuels</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-muted)', letterSpacing: '0.15em' }}>BUSINESS TRACKER</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {onboardingSaved && (
            <div style={{ fontSize: 13, color: '#1a7040', fontWeight: 600, padding: '6px 14px', background: 'rgba(26,112,64,0.1)', border: '1px solid rgba(26,112,64,0.3)', borderRadius: 6 }}>
              ✅ Historique enregistré!
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            CA {selectedYear}: <span style={{ color: ytdGross > THRESHOLD_2025 ? '#dc2626' : '#1a7040', fontWeight: 700 }}>€{Math.round(ytdGross).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['en', 'fr'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: lang === l ? 'var(--c-accent)' : 'transparent',
                color: lang === l ? '#fff' : 'var(--c-muted)',
                border: '1px solid var(--c-border)', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-modern)'
              }}>{l}</button>
            ))}
          </div>
          <button onClick={() => setOnboardingMode(true)} style={{ ...S.btn, background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)', padding: '8px 12px', fontSize: 12 }}>
            📂 {lang === 'en' ? 'Add history' : 'Ajouter historique'}
          </button>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ ...S.input, width: 90 }}>
            {[2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.06)', borderBottom: '1px solid var(--c-border)', padding: '0 32px', overflowX: 'auto' }}>
        {['dashboard', 'progress', 'expenses', 'history', 'splits', 'wishlist'].map(tid => (
          <button key={tid} style={S.navBtn(tab === tid)} onClick={() => setTab(tid)}>
            {nav[tid]}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="page-enter">

            {/* Monthly Goal Circle */}
            <div style={{ ...S.card, borderColor: 'rgba(244,147,6,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                <GoalCircle current={currentMonthGross} goal={monthlyGoal} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0a1f14' }}>{lang === 'en' ? 'Monthly Income Goal' : 'Objectif mensuel'}</div>
                    {!editingGoal ? (
                      <button onClick={() => { setGoalInput(String(monthlyGoal)); setEditingGoal(true) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3a6e52' }}>✏️</button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input style={{ ...S.input, width: 100, padding: '4px 8px', fontSize: 13 }} type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} autoFocus />
                        <button style={{ ...S.btn, padding: '4px 10px', fontSize: 12 }} onClick={() => {
                          const v = parseInt(goalInput) || 2500
                          setMonthlyGoal(v); localStorage.setItem('cv_monthly_goal', String(v)); setEditingGoal(false)
                        }}>✓</button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a6e52' }} onClick={() => setEditingGoal(false)}>✕</button>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#F49306', marginBottom: 4 }}>
                    €{Math.round(currentMonthGross).toLocaleString()}
                    <span style={{ fontSize: 14, fontWeight: 400, color: '#3a6e52', marginLeft: 8 }}>/ €{monthlyGoal.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#3a6e52' }}>{format(new Date(), 'MMMM yyyy')} · Goal: €{monthlyGoal.toLocaleString()} gross</div>
                </div>
              </div>
            </div>

            {/* Add income */}
            <div ref={addIncomeRef} style={{ ...S.card, borderColor: 'rgba(244,147,6,0.3)' }}>
              <div style={{ ...S.label, color: '#F49306', marginBottom: 16 }}>+ {t.add_income}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 2fr', gap: 12, marginBottom: 12 }}>
                <div><div style={S.label}>{t.client}</div>
                  <input style={S.input} value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} placeholder="Client name" /></div>
                <div><div style={S.label}>{t.amount}</div>
                  <input style={S.input} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="€ 0" /></div>
                <div><div style={S.label}>{t.date}</div>
                  <input style={S.input} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                <div><div style={S.label}>{t.urssaf_rate}</div>
                  <select style={S.input} value={form.cat} onChange={e => setForm(p => ({ ...p, cat: e.target.value }))}>
                    {URSSAF_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label} ({(c.rate * 100).toFixed(1)}%)</option>)}
                  </select></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <input style={S.input} value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} placeholder="Description (opt.)" />
                  <button style={{ ...S.btn, whiteSpace: 'nowrap' }} onClick={addIncome}>{t.add}</button>
                </div>
              </div>
              {previewGross > 0 && (
                <div style={{ background: 'var(--c-surface2)', borderRadius: 8, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#3a6e52' }}>🏦 Monobanque receives</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0a1f14' }}>€{Math.round(previewGross).toLocaleString()}</div>
                  </div>
                  <div style={{ paddingLeft: 14, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#3a6e52' }}>↓ URSSAF ({Math.round(rate * 100)}%)</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>−€{Math.round(previewUrssaf).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(26,112,64,0.1)', border: '1px solid rgba(26,112,64,0.3)', borderRadius: 6, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1a7040' }}>Net income</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1a7040' }}>€{Math.round(previewNet).toLocaleString()}</div>
                  </div>
                  <div style={{ paddingLeft: 14 }}>
                    {[
                      { label: 'Wise Canelle (salary)', val: previewSalary, color: '#1a7040' },
                      { label: 'Wise Piers — savings & rent', val: previewToPiers, color: '#6DB8BE' },
                      { label: 'Company reinvestment', val: previewCompany, color: '#F49306' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ color, fontSize: 14 }}>→</div>
                        <div style={{ flex: 1, fontSize: 12, color: '#3a6e52' }}>{label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color }}>€{Math.round(val).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* YTD stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {[
                { label: t.year_total, val: ytdGross, color: '#0a1f14', sub: `${Math.round(ytdGross / THRESHOLD_2025 * 100)}% of €${THRESHOLD_2025.toLocaleString()} threshold` },
                { label: 'URSSAF dû', val: ytdUrssaf, color: '#F49306', sub: `${Math.round(rate * 100)}% rate` },
                { label: t.net, val: ytdNet, color: '#1a7040', sub: 'Net income YTD' },
                { label: t.to_wise, val: ytdToPiers, color: '#6DB8BE', sub: 'To joint savings' },
              ].map(({ label, val, color, sub }) => (
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 8 }}>€{Math.round(val).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#3a6e52', marginTop: 6 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* URSSAF Forecast */}
            {ytdGross > 0 && (
              <div style={{ ...S.card, borderColor: 'rgba(244,147,6,0.3)' }}>
                <div style={{ ...S.label, color: '#F49306', marginBottom: 12 }}>📊 {lang === 'en' ? 'URSSAF Forecast' : 'Prévision URSSAF'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { label: lang === 'en' ? 'Avg monthly' : 'Moy. mensuelle', val: avgMonthlyGross, color: '#0a1f14' },
                    { label: lang === 'en' ? 'Projected annual' : 'CA annuel projeté', val: projectedAnnualGross, color: '#0a1f14' },
                    { label: lang === 'en' ? 'Est. total URSSAF' : 'URSSAF estimée', val: estimatedTotalUrssaf, color: '#F49306' },
                    { label: lang === 'en' ? 'Still to set aside' : 'Encore à mettre', val: stillToSetUrssaf, color: stillToSetUrssaf > 0 ? '#dc2626' : '#1a7040' },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: '#3a6e52', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>€{Math.round(val).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chart */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 20 }}>{t.chart_title} — {selectedYear}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#3a6e52', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a6e52', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#0a1f14' }} />
                  <Bar dataKey="gross" fill="rgba(244,147,6,0.8)" radius={[3,3,0,0]} name={t.gross} />
                  <Bar dataKey="net" fill="#1a7040" radius={[3,3,0,0]} name={t.net} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tips */}
            <div style={{ ...S.card, borderColor: 'rgba(244,147,6,0.25)' }}>
              <div style={{ ...S.label, color: '#F49306' }}>💼 {t.tips}</div>
              <div style={{ fontSize: 14, color: '#0a1f14', marginTop: 10, lineHeight: 1.7 }}>{TIPS[lang][tipIdx]}</div>
            </div>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {tab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="page-enter">
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {[
                { label: lang === 'en' ? 'Total earned (all time)' : 'Total gagné', val: `€${allTimeGross.toLocaleString()}`, color: '#0a1f14' },
                { label: lang === 'en' ? 'Best month' : 'Meilleur mois', val: `€${bestMonth.gross.toLocaleString()}`, sub: bestMonth.ym ? monthLabel(bestMonth.ym) : '—', color: '#F49306' },
                { label: lang === 'en' ? 'Monthly average' : 'Moyenne mensuelle', val: `€${avgMonthlyAll.toLocaleString()}`, sub: `${nonZeroMonths.length} active months`, color: '#0a1f14' },
                {
                  label: lang === 'en' ? 'Month-over-month' : 'Mois sur mois',
                  val: momGrowth !== null ? `${momGrowth > 0 ? '+' : ''}${momGrowth}%` : '—',
                  color: momGrowth === null ? '#3a6e52' : momGrowth >= 0 ? '#1a7040' : '#dc2626',
                  icon: momGrowth !== null ? (momGrowth >= 0 ? '↑' : '↓') : ''
                },
              ].map(({ label, val, color, sub, icon }) => (
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 8 }}>{icon} {val}</div>
                  {sub && <div style={{ fontSize: 11, color: '#3a6e52', marginTop: 4 }}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Monthly bar chart */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 16 }}>{lang === 'en' ? 'Monthly revenue — May 2025 to now' : 'Revenus mensuels — Mai 2025 à aujourd\'hui'}</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={progressData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#3a6e52', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a6e52', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#0a1f14' }} />
                  <Bar dataKey="gross" fill="#F49306" radius={[3,3,0,0]} name="Gross" />
                  <Bar dataKey="net" fill="#A5BB1A" radius={[3,3,0,0]} name="Net" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {[['#F49306','Gross'],['#A5BB1A','Net']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3a6e52' }}>
                    <div style={{ width: 12, height: 8, borderRadius: 2, background: c }} />{l}
                  </div>
                ))}
              </div>
            </div>

            {/* Cumulative earnings line */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 16 }}>{lang === 'en' ? 'Cumulative earnings' : 'Revenus cumulés'}</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#3a6e52', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#3a6e52', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#0a1f14' }} />
                  <Line type="monotone" dataKey="cumulative" stroke="#F49306" strokeWidth={2.5} dot={{ r: 3, fill: '#F49306' }} name="Cumulative" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* URSSAF History table */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 16 }}>📋 {lang === 'en' ? 'URSSAF quarterly history' : 'Historique URSSAF trimestriel'}</div>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#3a6e52' }}>{lang === 'en' ? 'Total URSSAF paid' : 'URSSAF payée'}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1a7040' }}>€{Math.round(totalUrssafPaid).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#3a6e52' }}>{lang === 'en' ? 'Still owed' : 'Encore dû'}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: totalUrssafOwed > 0 ? '#dc2626' : '#1a7040' }}>€{Math.round(totalUrssafOwed).toLocaleString()}</div>
                </div>
                {nextDue && (
                  <div style={{ padding: '8px 14px', background: 'rgba(244,147,6,0.15)', border: '1px solid rgba(244,147,6,0.4)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: '#3a6e52' }}>{lang === 'en' ? 'Next payment due' : 'Prochain paiement'}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F49306' }}>{nextDue.due} — €{Math.round(nextDue.urssaf).toLocaleString()}</div>
                  </div>
                )}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Quarter','Income','URSSAF owed','Due date','Status'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--c-border)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3a6e52' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quarterlyData.map(q => (
                    <tr key={q.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: nextDue?.id === q.id ? 'rgba(244,147,6,0.08)' : 'transparent' }}>
                      <td style={{ padding: '12px', color: '#0a1f14', fontWeight: 500 }}>{q.label}</td>
                      <td style={{ padding: '12px', color: '#0a1f14' }}>{q.gross > 0 ? `€${Math.round(q.gross).toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '12px', color: q.isOverdue ? '#dc2626' : '#F49306', fontWeight: 600 }}>{q.urssaf > 0 ? `€${Math.round(q.urssaf).toLocaleString()}` : '—'}</td>
                      <td style={{ padding: '12px', color: nextDue?.id === q.id ? '#F49306' : '#3a6e52', fontWeight: nextDue?.id === q.id ? 700 : 400 }}>{q.due}</td>
                      <td style={{ padding: '12px' }}>
                        {q.gross > 0 ? (
                          <button
                            onClick={() => toggleUrssafPaid(q.id)}
                            style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-modern)',
                              background: q.isPaid ? 'rgba(26,112,64,0.15)' : 'rgba(244,147,6,0.15)',
                              color: q.isPaid ? '#1a7040' : '#F49306',
                              border: `1px solid ${q.isPaid ? 'rgba(26,112,64,0.4)' : 'rgba(244,147,6,0.4)'}` }}
                          >{q.isPaid ? '✓ Paid' : 'Mark paid'}</button>
                        ) : <span style={{ color: '#3a6e52', fontSize: 12 }}>No income</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EXPENSES (RECURRING) ── */}
        {tab === 'expenses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={S.card}>
                <div style={S.label}>Monthly recurring total</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#F49306', marginTop: 8 }}>€{recurringTotal.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: '#3a6e52', marginTop: 4 }}>{cvRecurring.filter(r => r.active).length} active subscriptions</div>
              </div>
              <div style={S.card}>
                <div style={S.label}>Annual cost</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#0a1f14', marginTop: 8 }}>€{(recurringTotal * 12).toFixed(0)}</div>
                <div style={{ fontSize: 12, color: '#3a6e52', marginTop: 4 }}>= {ytdGross > 0 ? Math.round(recurringTotal * 12 / ytdGross * 100) : 0}% of YTD income</div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 16 }}>Subscriptions & recurring expenses</div>
              {cvRecurring.length === 0 ? (
                <div style={{ color: '#3a6e52', fontSize: 13, textAlign: 'center', padding: 24 }}>Loading…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {cvRecurring.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.07)', opacity: r.active ? 1 : 0.45 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0a1f14' }}>{r.name}</div>
                        {r.category && <div style={{ fontSize: 11, color: '#3a6e52' }}>{r.category}</div>}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: r.active ? '#F49306' : '#3a6e52' }}>€{r.amount.toFixed(2)}/mo</div>
                      <button
                        onClick={async () => {
                          const next = !r.active
                          try { await supabase.from('cv_recurring').update({ active: next }).eq('id', r.id) } catch {}
                          setCvRecurring(prev => prev.map(x => x.id === r.id ? { ...x, active: next } : x))
                        }}
                        style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-modern)',
                          background: r.active ? 'rgba(26,112,64,0.12)' : 'rgba(0,0,0,0.06)',
                          color: r.active ? '#1a7040' : '#3a6e52',
                          border: `1px solid ${r.active ? 'rgba(26,112,64,0.3)' : 'rgba(0,0,0,0.12)'}` }}
                      >{r.active ? '● Active' : '○ Paused'}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="page-enter">
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 16 }}>
                {lang === 'en' ? 'Income History' : 'Historique'} — {selectedYear}
                <span style={{ color: '#3a6e52', marginLeft: 12 }}>{income.length} {lang === 'en' ? 'entries' : 'entrées'}</span>
              </div>
              {income.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#3a6e52', fontSize: 14 }}>
                  {lang === 'en' ? 'No income recorded for this year yet.' : 'Aucun revenu enregistré pour cette année.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>
                    {['Date','Client','Gross','URSSAF','Net','→ Wise','Category'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--c-border)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3a6e52' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {income.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '10px 12px', color: '#3a6e52' }}>{r.date}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 500, color: '#0a1f14' }}>{r.client || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#0a1f14', fontWeight: 600 }}>€{Math.round(r.amount_gross)}</td>
                        <td style={{ padding: '10px 12px', color: '#F49306' }}>−€{Math.round(r.amount_urssaf)}</td>
                        <td style={{ padding: '10px 12px', color: '#1a7040', fontWeight: 600 }}>€{Math.round(r.amount_after_urssaf)}</td>
                        <td style={{ padding: '10px 12px', color: '#6DB8BE' }}>€{Math.round(r.amount_to_piers_wise || 0)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.08)', color: '#3a6e52' }}>
                            {URSSAF_CATEGORIES.find(c => c.id === r.category)?.label || r.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{ borderTop: '1px solid var(--c-border)' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#0a1f14' }}>TOTAL {selectedYear}</td>
                    <td style={{ padding: '10px 12px', color: '#0a1f14', fontWeight: 700 }}>€{Math.round(ytdGross).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#F49306', fontWeight: 700 }}>−€{Math.round(ytdUrssaf).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#1a7040', fontWeight: 700 }}>€{Math.round(ytdNet).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#6DB8BE', fontWeight: 700 }}>€{Math.round(ytdToPiers).toLocaleString()}</td>
                    <td />
                  </tr></tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── SPLITS ── */}
        {tab === 'splits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 20 }}>{t.edit_splits}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={S.label}>{t.urssaf_rate}</div>
                  {URSSAF_CATEGORIES.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                      <input type="radio" name="urssaf" value={c.id} checked={urssafCat === c.id} onChange={() => setUrssafCat(c.id)} style={{ accentColor: '#F49306' }} />
                      <span style={{ fontSize: 14, color: '#0a1f14' }}>{c.label}</span>
                      <span style={{ fontSize: 13, color: '#F49306', fontWeight: 700 }}>{(c.rate * 100).toFixed(1)}%</span>
                    </label>
                  ))}
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={S.label}>{t.piers_pct}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#6DB8BE' }}>{Math.round(piersPct)}%</div>
                  </div>
                  <input type="range" min="10" max="60" value={piersPct} onChange={e => setPiersPct(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#6DB8BE' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={S.label}>{t.invest_pct}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#F49306' }}>{Math.round(investPct)}%</div>
                  </div>
                  <input type="range" min="0" max="30" value={investPct} onChange={e => setInvestPct(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#F49306' }} />
                </div>
                <div style={{ background: 'var(--c-surface2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>For every €1,000 net:</div>
                  {[
                    { label: t.to_wise, val: Math.round(1000 * piersPct / 100), color: '#6DB8BE' },
                    { label: t.company, val: Math.round(1000 * investPct / 100), color: '#F49306' },
                    { label: 'Your salary', val: Math.round(1000 * (1 - piersPct / 100 - investPct / 100)), color: '#1a7040' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-border)', fontSize: 14 }}>
                      <span style={{ color: '#3a6e52' }}>{label}</span>
                      <span style={{ color, fontWeight: 700 }}>€{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WISHLIST ── */}
        {tab === 'wishlist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            {readyToBuy.map(item => (
              <div key={item.id} style={{ background: 'rgba(26,112,64,0.08)', border: '1px solid rgba(26,112,64,0.4)', borderRadius: 8, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#1a7040', fontSize: 14, fontWeight: 600 }}>🎉 {item.name} — {lang === 'en' ? 'ready to buy!' : 'prêt à acheter !'}</div>
                {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: 'none', fontSize: 12, padding: '6px 14px' }}>{lang === 'en' ? 'View →' : 'Voir →'}</a>}
              </div>
            ))}

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={S.label}>{t.wish_alloc}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#F49306' }}>{wishlistPct}%</div>
              </div>
              <input type="range" min="0" max="20" value={wishlistPct} onChange={e => { const v = parseInt(e.target.value); setWishlistPct(v); localStorage.setItem('cv_wishlist_pct', v) }} style={{ width: '100%', accentColor: '#F49306' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {[
                { label: t.wish_total, val: `€${Math.round(wishTotal).toLocaleString()}`, color: '#0a1f14' },
                { label: t.wish_funded, val: `€${Math.round(wishFunded).toLocaleString()}`, color: '#1a7040' },
                { label: t.wish_months, val: monthsToTop !== null ? `${monthsToTop}` : '—', color: '#F49306', suffix: monthsToTop ? ' mo' : '' },
              ].map(({ label, val, color, suffix }) => (
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 8 }}>{val}<span style={{ fontSize: 14, fontWeight: 400, color: '#3a6e52' }}>{suffix}</span></div>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, borderColor: 'rgba(244,147,6,0.3)' }}>
              <div style={{ ...S.label, color: '#F49306', marginBottom: 16 }}>+ {t.wish_add}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><div style={S.label}>{t.wish_name}</div>
                  <input style={S.input} value={newWishItem.name} onChange={e => setNewWishItem(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Sony lens" /></div>
                <div><div style={S.label}>{t.wish_price}</div>
                  <input style={S.input} type="number" value={newWishItem.price} onChange={e => setNewWishItem(p => ({ ...p, price: e.target.value }))} placeholder="€" /></div>
                <div><div style={S.label}>{t.wish_cat}</div>
                  <select style={S.input} value={newWishItem.category} onChange={e => setNewWishItem(p => ({ ...p, category: e.target.value }))}>
                    <option value="gear">🔧 Gear</option>
                    <option value="software">💻 Software</option>
                    <option value="other">📦 Other</option>
                  </select></div>
                <div><div style={S.label}>{t.wish_priority}</div>
                  <select style={S.input} value={newWishItem.priority} onChange={e => setNewWishItem(p => ({ ...p, priority: e.target.value }))}>
                    <option value="dream">⭐ Dream</option>
                    <option value="soon">🔜 Soon</option>
                    <option value="someday">☁️ Someday</option>
                  </select></div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}><div style={S.label}>{t.wish_url}</div>
                  <input style={S.input} value={newWishItem.url} onChange={e => setNewWishItem(p => ({ ...p, url: e.target.value }))} placeholder="https://..." /></div>
                <button style={{ ...S.btn, alignSelf: 'flex-end', opacity: wishLoading ? 0.6 : 1 }} onClick={addWishItem} disabled={wishLoading}>
                  {wishLoading ? 'Adding…' : t.add}
                </button>
              </div>
            </div>

            {wishError && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>⚠ {lang === 'en' ? 'Failed to add item:' : 'Échec :'} {wishError}</div>
                <button onClick={() => setWishError(null)} style={{ marginTop: 6, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Dismiss</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#3a6e52', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.wish_sort}:</span>
              {['priority','price','funded'].map(s => (
                <button key={s} onClick={() => setWishlistSort(s)} style={{ padding: '4px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-modern)', background: wishlistSort === s ? '#F49306' : 'transparent', color: wishlistSort === s ? '#fff' : '#3a6e52', border: '1px solid var(--c-border)' }}>{s}</button>
              ))}
            </div>

            {sortedWishlist.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: '#3a6e52', fontSize: 14, padding: 40 }}>
                {lang === 'en' ? 'No wishlist items yet!' : 'Liste vide !'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16 }}>
                {sortedWishlist.map(item => <CVWishCard key={item.id} item={item} onMarkBought={markWishPurchased} onDelete={deleteWishItem} S={S} lang={lang} />)}
              </div>
            )}

            {wishlist.some(w => w.purchased) && (
              <div style={S.card}>
                <div style={{ ...S.label, marginBottom: 12 }}>✓ {lang === 'en' ? 'Purchased' : 'Achetés'}</div>
                {wishlist.filter(w => w.purchased).map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-border)', fontSize: 13, opacity: 0.5 }}>
                    <span style={{ textDecoration: 'line-through', color: '#3a6e52' }}>{item.name}</span>
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

const CV_PRIORITY_COLORS = { dream: '#F49306', soon: '#E0858E', someday: '#6DB8BE' }
const CV_PRIORITY_ICONS  = { dream: '⭐', soon: '🔜', someday: '☁️' }
const CV_CAT_ICONS       = { gear: '🔧', software: '💻', other: '📦' }

function CVWishCard({ item, onMarkBought, onDelete, S, lang }) {
  const funded = item.funded || 0
  const fundedPct = Math.min(100, (funded / item.price) * 100)
  const isReady = funded >= item.price
  const pc = CV_PRIORITY_COLORS[item.priority] || '#F49306'

  return (
    <div style={{ ...S.card, borderColor: isReady ? 'rgba(26,112,64,0.5)' : 'var(--c-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: `${pc}22`, color: pc, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {CV_PRIORITY_ICONS[item.priority]} {item.priority}
            </span>
            {item.category && <span style={{ fontSize: 10, color: '#3a6e52' }}>{CV_CAT_ICONS[item.category]} {item.category}</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0a1f14' }}>{item.name}</div>
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#F49306', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>🔗 {lang === 'en' ? 'View product' : 'Voir le produit'}</a>}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0a1f14', marginLeft: 12, flexShrink: 0 }}>€{item.price.toLocaleString()}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <CircleProgress pct={fundedPct} color={isReady ? '#1a7040' : '#F49306'} size={52} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isReady ? '#1a7040' : '#F49306' }}>
            {Math.round(fundedPct)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#0a1f14', fontWeight: 600 }}>€{Math.round(funded).toLocaleString()} {lang === 'en' ? 'funded' : 'financé'}</div>
          <div style={{ fontSize: 11, color: '#3a6e52' }}>of €{item.price.toLocaleString()}</div>
        </div>
      </div>

      {isReady && <div style={{ fontSize: 12, color: '#1a7040', marginBottom: 10, fontWeight: 600 }}>🎉 {lang === 'en' ? 'You can buy this now!' : "Vous pouvez l'acheter !"}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onMarkBought(item.id)} style={{ ...S.btn, flex: 1, fontSize: 12, padding: '8px', background: isReady ? '#1a7040' : 'transparent', color: isReady ? '#fff' : '#3a6e52', border: `1px solid ${isReady ? '#1a7040' : 'var(--c-border)'}` }}>
          {lang === 'en' ? 'Mark as bought ✓' : 'Marquer acheté ✓'}
        </button>
        <button onClick={() => onDelete(item.id)} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '8px 10px', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-modern)' }}>✕</button>
      </div>
    </div>
  )
}
