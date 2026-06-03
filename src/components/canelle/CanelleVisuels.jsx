import { useState, useEffect, useRef } from 'react'
import { supabase, URSSAF_RATES } from '../../lib/supabase.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths, parseISO, getYear } from 'date-fns'

const RENT = 800
const PIERS_WISE_PCT = 0.40 // % of net sent to Piers' Wise for savings/rent
const INVEST_PCT = 0.10     // % reinvested in company

const URSSAF_CATEGORIES = [
  { id: 'bnc_services', label: 'Services libéraux (BNC)', rate: 0.22 },
  { id: 'bic_services', label: 'Services BIC', rate: 0.212 },
  { id: 'commerce',     label: 'Vente de marchandises', rate: 0.123 },
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
    title: 'CANELLE', sub: 'VISUELS',
    back: '← Back', add_income: 'Add Income',
    client: 'Client', amount: 'Amount (gross €)', date: 'Date',
    urssaf_rate: 'URSSAF Category', add: 'Record Income',
    history: 'Income History', year: 'Year',
    live_calc: 'Live Breakdown', gross: 'Gross', urssaf: 'URSSAF',
    net: 'Net to Self', company: 'Company reinvestment',
    to_wise: "→ Piers' Wise", salary_self: 'Salary to keep',
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
    title: 'CANELLE', sub: 'VISUELS',
    back: '← Retour', add_income: 'Ajouter un revenu',
    client: 'Client', amount: 'Montant brut (€)', date: 'Date',
    urssaf_rate: 'Catégorie URSSAF', add: 'Enregistrer',
    history: 'Historique', year: 'Année',
    live_calc: 'Décomposition live', gross: 'Brut', urssaf: 'URSSAF',
    net: 'Net personnel', company: 'Réinvesti entreprise',
    to_wise: "→ Wise Piers", salary_self: 'Salaire gardé',
    year_total: 'CA annuel', threshold: 'Seuil 2025',
    tips: 'Conseils pro', chart_title: 'Revenus mensuels',
    edit_splits: 'Modifier la répartition', piers_pct: "% vers Wise Piers",
    invest_pct: '% réinvesti entreprise',
    wishlist: 'Liste de souhaits', wish_add: 'Ajouter à la liste', wish_name: "Nom de l'article",
    wish_price: 'Prix (€)', wish_url: 'URL produit', wish_cat: 'Catégorie',
    wish_priority: 'Priorité', wish_total: 'Total liste', wish_funded: 'Total financé',
    wish_months: 'Mois pour l\'article top', wish_sort: 'Trier par',
    wish_alloc: '% du net → fonds liste',
  }
}

export default function CanelleVisuels({ onBack, lang, setLang }) {
  const t = T[lang]
  const [tab, setTab] = useState('dashboard')
  const [income, setIncome] = useState([])
  const [loading, setLoading] = useState(true)
  const [urssafCat, setUrssafCat] = useState('bnc_services')
  const [piersPct, setPiersPct] = useState(PIERS_WISE_PCT * 100)
  const [investPct, setInvestPct] = useState(INVEST_PCT * 100)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [tipIdx] = useState(() => new Date().getDate() % TIPS.en.length)
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false)
  const addIncomeRef = useRef(null)
  const [wishlist, setWishlist] = useState([])
  const [newWishItem, setNewWishItem] = useState({ name: '', price: '', url: '', category: 'gear', priority: 'soon' })
  const [wishlistPct, setWishlistPct] = useState(() => parseInt(localStorage.getItem('cv_wishlist_pct') || '5'))
  const [wishlistSort, setWishlistSort] = useState('priority')
  const [wishError, setWishError] = useState(null)
  const [wishLoading, setWishLoading] = useState(false)

  // New income form
  const [form, setForm] = useState({ client: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), cat: 'bnc_services', desc: '' })

  useEffect(() => { loadIncome() }, [selectedYear])

  useEffect(() => {
    if (localStorage.getItem('cv_history_dismissed')) return
    supabase.from('cv_income').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if ((count || 0) === 0) setShowWelcomeBanner(true) })
  }, [])

  useEffect(() => { loadWishlist() }, [])

  async function loadIncome() {
    setLoading(true)
    const { data } = await supabase.from('cv_income')
      .select('*').gte('date', `${selectedYear}-01-01`).lte('date', `${selectedYear}-12-31`)
      .order('date', { ascending: false })
    setIncome(data || [])
    setLoading(false)
  }

  function scrollToAddIncome(date) {
    setTab('dashboard')
    if (date) setForm(p => ({ ...p, date }))
    setTimeout(() => addIncomeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  function dismissWelcomeBanner() {
    localStorage.setItem('cv_history_dismissed', '1')
    setShowWelcomeBanner(false)
  }

  async function loadWishlist() {
    const { data } = await supabase.from('cv_wishlist').select('*').order('created_at')
    setWishlist(data || [])
  }

  async function addWishItem() {
    if (!newWishItem.name || !newWishItem.price) return
    setWishError(null)
    setWishLoading(true)
    const payload = {
      name: newWishItem.name,
      price: parseFloat(newWishItem.price),
      url: newWishItem.url || null,
      category: newWishItem.category || null,
      priority: newWishItem.priority || 'soon',
      funded: 0,
      purchased: false,
    }
    console.log('[cv_wishlist] inserting →', payload)
    const { data, error } = await supabase.from('cv_wishlist').insert(payload).select().single()
    console.log('[cv_wishlist] result →', { data, error })
    if (error) {
      console.error('[cv_wishlist] insert failed:', error)
      setWishError(`${error.message} (code: ${error.code})`)
      setWishLoading(false)
      return
    }
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

    if (data) setIncome(prev => [data, ...prev])
    setForm({ client: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), cat: 'bnc_services', desc: '' })

    // Auto-fund wishlist from income allocation
    if (wishlistPct > 0) {
      const alloc = net * (wishlistPct / 100)
      const PO = { dream: 0, soon: 1, someday: 2 }
      const topItem = [...wishlist]
        .filter(w => !w.purchased && (w.funded || 0) < w.price)
        .sort((a, b) => (PO[a.priority] ?? 9) - (PO[b.priority] ?? 9))[0]
      if (topItem) {
        const newFunded = Math.min((topItem.funded || 0) + alloc, topItem.price)
        await supabase.from('cv_wishlist').update({ funded: newFunded }).eq('id', topItem.id)
        setWishlist(prev => prev.map(w => w.id === topItem.id ? { ...w, funded: newFunded } : w))
      }
    }
  }

  // Calculations
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

  // Monthly chart data
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    const monthIncome = income.filter(r => r.date?.startsWith(`${selectedYear}-${m}`))
    const gross = monthIncome.reduce((s, r) => s + (r.amount_gross || 0), 0)
    const net = monthIncome.reduce((s, r) => s + (r.amount_after_urssaf || 0), 0)
    return { month: m, gross: Math.round(gross), net: Math.round(net) }
  })

  // URSSAF forecast
  const monthsWithData = new Set(income.map(r => r.date?.slice(0, 7)).filter(Boolean)).size
  const avgMonthlyGross = monthsWithData > 0 ? ytdGross / monthsWithData : 0
  const currentCalMonth = new Date().getMonth() + 1
  const isCurrentYear = selectedYear === new Date().getFullYear()
  const remainingMonths = isCurrentYear ? Math.max(0, 12 - currentCalMonth) : 0
  const projectedAnnualGross = ytdGross + remainingMonths * avgMonthlyGross
  const defaultUrssafRate = URSSAF_CATEGORIES.find(c => c.id === 'bnc_services')?.rate || 0.22
  const estimatedTotalUrssaf = projectedAnnualGross * defaultUrssafRate
  const stillToSetUrssaf = Math.max(0, estimatedTotalUrssaf - ytdUrssaf)
  const forecastThresholdPct = projectedAnnualGross > 0 ? Math.round(projectedAnnualGross / THRESHOLD_2025 * 100) : 0

  // Wishlist derived
  const PRIORITY_ORDER = { dream: 0, soon: 1, someday: 2 }
  const activeWish = wishlist.filter(w => !w.purchased)
  const wishTotal = activeWish.reduce((s, w) => s + w.price, 0)
  const wishFunded = activeWish.reduce((s, w) => s + (w.funded || 0), 0)
  const readyToBuy = activeWish.filter(w => (w.funded || 0) >= w.price)
  const currentMonthIdx = new Date().getMonth() + 1
  const monthlyAvgNet = currentMonthIdx > 0 ? ytdNet / currentMonthIdx : 0
  const wishMonthlyContrib = monthlyAvgNet * (wishlistPct / 100)
  const topUnfunded = [...activeWish]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    .find(w => (w.funded || 0) < w.price)
  const monthsToTop = topUnfunded && wishMonthlyContrib > 0
    ? Math.ceil((topUnfunded.price - (topUnfunded.funded || 0)) / wishMonthlyContrib)
    : null
  const sortedWishlist = [...activeWish].sort((a, b) => {
    if (wishlistSort === 'priority') return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    if (wishlistSort === 'price') return b.price - a.price
    if (wishlistSort === 'funded') return ((b.funded || 0) / b.price) - ((a.funded || 0) / a.price)
    return 0
  })

  const S = {
    container: { minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'var(--font-modern)' },
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: 24 },
    label: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-muted)', marginBottom: 6 },
    input: { background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '10px 14px', color: 'var(--c-text)', fontSize: 13, width: '100%', fontFamily: 'var(--font-modern)' },
    btn: { background: 'var(--c-accent)', border: 'none', borderRadius: 6, padding: '10px 20px', color: '#1a1a1a', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: 'var(--font-modern)', transition: 'all 0.15s' },
    navBtn: (active) => ({
      padding: '14px 22px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: 'transparent', color: active ? '#fff' : 'var(--c-muted)',
      border: 'none', borderBottom: active ? '2px solid var(--c-accent)' : '2px solid transparent',
      letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-modern)',
      transition: 'all 0.15s'
    }),
  }

  return (
    <div className="canelle" style={S.container}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button onClick={onBack} style={{ ...S.btn, background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)', padding: '8px 14px', fontSize: 12 }}>{t.back}</button>
          <div>
            <div style={{ lineHeight: 1 }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.01em' }}>Canelle</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 26, fontWeight: 700, color: '#f5c000', letterSpacing: '-0.01em' }}>.visuels</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-muted)', letterSpacing: '0.15em' }}>BUSINESS TRACKER</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            CA {selectedYear}: <span style={{ color: ytdGross > THRESHOLD_2025 ? 'var(--c-accent)' : '#4eff91', fontWeight: 700 }}>€{Math.round(ytdGross).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['en', 'fr'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: lang === l ? 'var(--c-accent)' : 'transparent',
                color: lang === l ? '#1a1a1a' : 'var(--c-muted)',
                border: '1px solid var(--c-border)', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'var(--font-modern)'
              }}>{l}</button>
            ))}
          </div>
          <button
            onClick={() => scrollToAddIncome(null)}
            style={{ ...S.btn, background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-muted)', padding: '8px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
          >📂 {lang === 'en' ? 'Add past income' : 'Ajouter revenu passé'}</button>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ ...S.input, width: 100 }}>
            {[2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--c-border)', padding: '0 32px' }}>
        {['dashboard', 'history', 'splits', 'wishlist'].map(tab_id => (
          <button key={tab_id} style={S.navBtn(tab === tab_id)} onClick={() => setTab(tab_id)}>
            {t[tab_id] || tab_id}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="page-enter">

            {/* Welcome / history onboarding banner */}
            {showWelcomeBanner && (
              <div style={{ background: 'linear-gradient(135deg, rgba(245,192,0,0.08) 0%, rgba(201,168,76,0.06) 100%)', border: '1px solid rgba(245,192,0,0.3)', borderRadius: 10, padding: '24px 28px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0', marginBottom: 10, lineHeight: 1.4 }}>
                  👋 Bienvenue Canelle !
                </div>
                <div style={{ fontSize: 14, color: 'rgba(240,240,240,0.75)', lineHeight: 1.7, marginBottom: 20, maxWidth: 680 }}>
                  {lang === 'en'
                    ? 'Add your income history from May 2025 onwards to see your full picture. Use the + Add Income form below and change the date to the right month.'
                    : 'Ajoute tes revenus depuis mai 2025 pour avoir une vue complète. Utilise le formulaire + Ajouter un revenu ci-dessous en changeant la date.'}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => scrollToAddIncome('2025-05-01')}
                    style={{ ...S.btn, background: 'var(--c-accent)', fontSize: 13 }}
                  >{lang === 'en' ? 'Start adding history →' : 'Commencer l\'historique →'}</button>
                  <button
                    onClick={dismissWelcomeBanner}
                    style={{ ...S.btn, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(240,240,240,0.5)', fontSize: 13, fontWeight: 400 }}
                  >{lang === 'en' ? "I'll do it later" : 'Je le ferai plus tard'}</button>
                </div>
              </div>
            )}

            {/* Add income */}
            <div ref={addIncomeRef} style={{ ...S.card, borderColor: 'rgba(245,192,0,0.3)' }}>
              <div style={{ ...S.label, color: 'rgba(245,192,0,0.8)', marginBottom: 16 }}>+ {t.add_income}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={S.label}>{t.client}</div>
                  <input style={S.input} value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} placeholder="Client name"/>
                </div>
                <div>
                  <div style={S.label}>{t.amount}</div>
                  <input style={S.input} type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="€ 0"/>
                </div>
                <div>
                  <div style={S.label}>{t.date}</div>
                  <input style={S.input} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
                </div>
                <div>
                  <div style={S.label}>{t.urssaf_rate}</div>
                  <select style={S.input} value={form.cat} onChange={e => setForm(p => ({ ...p, cat: e.target.value }))}>
                    {URSSAF_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label} ({(c.rate * 100).toFixed(1)}%)</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <input style={S.input} value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} placeholder="Description (opt.)"/>
                  <button style={{ ...S.btn, whiteSpace: 'nowrap' }} onClick={addIncome}>{t.add}</button>
                </div>
              </div>

              {/* Live breakdown — flow diagram */}
              {previewGross > 0 && (
                <div style={{ background: 'var(--c-surface2)', borderRadius: 8, padding: '16px 20px' }}>
                  {/* Step 1: Receipt */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--c-muted)', letterSpacing: '0.06em' }}>
                      🏦 {lang === 'en' ? 'MONOBANQUE CANELLE — receives payment' : 'MONOBANQUE CANELLE — reçoit le paiement'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f0f0' }}>€{Math.round(previewGross).toLocaleString()}</div>
                  </div>
                  {/* Arrow + URSSAF deduction */}
                  <div style={{ paddingLeft: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 3 }}>
                      ↓ {lang === 'en' ? `minus URSSAF (${Math.round(rate * 100)}%)` : `moins URSSAF (${Math.round(rate * 100)}%)`}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ff8c42' }}>
                      −€{Math.round(previewUrssaf).toLocaleString()}
                    </div>
                  </div>
                  {/* Net income bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(78,255,145,0.08)', border: '1px solid rgba(78,255,145,0.2)', borderRadius: 6, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4eff91', fontWeight: 700 }}>
                      {lang === 'en' ? 'Net income' : 'Net personnel'}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#4eff91' }}>€{Math.round(previewNet).toLocaleString()}</div>
                  </div>
                  {/* 3-way split */}
                  <div style={{ paddingLeft: 16 }}>
                    <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 10 }}>
                      ↓ {lang === 'en' ? 'split into 3:' : 'réparti en 3 :'}
                    </div>
                    {[
                      {
                        label: lang === 'en' ? 'Wise Canelle (your salary)' : 'Wise Canelle (votre salaire)',
                        pct: Math.round(100 - piersPct - investPct),
                        val: previewSalary, color: '#4eff91',
                      },
                      {
                        label: lang === 'en' ? 'Wise Piers — joint savings & rent' : 'Wise Piers — épargne commune & loyer',
                        pct: Math.round(piersPct),
                        val: previewToPiers, color: '#6ab4ff',
                      },
                      {
                        label: lang === 'en' ? 'Company reinvestment' : 'Réinvesti entreprise',
                        pct: Math.round(investPct),
                        val: previewCompany, color: '#ffcc44',
                      },
                    ].map(({ label, pct, val, color }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ color, fontSize: 14, flexShrink: 0 }}>→</div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--c-muted)' }}>{label}</div>
                        <div style={{ fontSize: 11, color: 'var(--c-muted)', minWidth: 32, textAlign: 'right' }}>{pct}%</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color, minWidth: 70, textAlign: 'right' }}>€{Math.round(val).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* YTD stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: t.year_total, val: ytdGross, color: '#fff', sub: `${Math.round(ytdGross / THRESHOLD_2025 * 100)}% of ${THRESHOLD_2025.toLocaleString()}€ threshold` },
                { label: 'URSSAF dû', val: ytdUrssaf, color: 'var(--c-accent)', sub: `${Math.round(rate * 100)}% rate` },
                { label: t.net, val: ytdNet, color: '#4eff91', sub: 'Net income YTD' },
                { label: t.to_wise, val: ytdToPiers, color: '#6ab4ff', sub: 'Transferred to savings' },
              ].map(({ label, val, color, sub }) => (
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 8 }}>€{Math.round(val).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 6 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* URSSAF Forecast */}
            {ytdGross > 0 && (
              <div style={{ ...S.card, borderColor: 'rgba(255,204,68,0.2)', background: 'rgba(255,204,68,0.03)' }}>
                <div style={{ ...S.label, color: 'rgba(255,204,68,0.7)', marginBottom: 16 }}>
                  📊 {lang === 'en' ? 'URSSAF Forecast' : 'Prévision URSSAF'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
                  {[
                    { label: lang === 'en' ? 'Avg monthly' : 'Moy. mensuelle', val: avgMonthlyGross, color: '#f0f0f0' },
                    { label: lang === 'en' ? 'Projected annual CA' : 'CA annuel projeté', val: projectedAnnualGross, color: '#fff' },
                    { label: lang === 'en' ? 'Est. total URSSAF' : 'URSSAF totale estimée', val: estimatedTotalUrssaf, color: 'var(--c-accent)' },
                    { label: lang === 'en' ? 'Already set aside' : 'Déjà mis de côté', val: ytdUrssaf, color: '#4eff91' },
                    { label: lang === 'en' ? 'Still to set aside' : 'Encore à mettre', val: stillToSetUrssaf, color: stillToSetUrssaf > 0 ? '#ffcc44' : '#4eff91' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>€{Math.round(val).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                {forecastThresholdPct > 70 && (
                  <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 10,
                    color: forecastThresholdPct >= 100 ? 'rgba(232,0,28,0.9)' : '#ffcc44',
                    background: forecastThresholdPct >= 100 ? 'rgba(232,0,28,0.08)' : 'rgba(255,204,68,0.06)',
                    border: `1px solid ${forecastThresholdPct >= 100 ? 'rgba(232,0,28,0.3)' : 'rgba(255,204,68,0.2)'}` }}>
                    {forecastThresholdPct >= 100
                      ? (lang === 'en'
                          ? `⚠️ Projected CA (€${Math.round(projectedAnnualGross).toLocaleString()}) exceeds the €77,700 threshold — consult an accountant.`
                          : `⚠️ CA projeté (${Math.round(projectedAnnualGross).toLocaleString()}€) dépasse le seuil — consultez un comptable.`)
                      : (lang === 'en'
                          ? `📈 At this rate you'll reach ${forecastThresholdPct}% of the €77,700 threshold by year end.`
                          : `📈 À ce rythme vous atteindrez ${forecastThresholdPct}% du seuil de 77 700€ en fin d'année.`)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>
                  {lang === 'en'
                    ? `Based on ${monthsWithData} month${monthsWithData !== 1 ? 's' : ''} of data · ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''} remaining in ${selectedYear} · BNC 22% rate`
                    : `Basé sur ${monthsWithData} mois de données · ${remainingMonths} mois restants en ${selectedYear} · Taux BNC 22%`}
                </div>
              </div>
            )}

            {/* Threshold warning */}
            {ytdGross > THRESHOLD_2025 * 0.8 && (
              <div style={{ background: 'rgba(232,0,28,0.08)', border: '1px solid rgba(232,0,28,0.3)', borderRadius: 8, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 20 }}>⚠️</div>
                <div style={{ fontSize: 13, color: 'rgba(232,0,28,0.9)' }}>
                  {lang === 'en'
                    ? `You've reached ${Math.round(ytdGross / THRESHOLD_2025 * 100)}% of the 2025 BNC threshold (€77,700). Consider consulting an accountant.`
                    : `Vous avez atteint ${Math.round(ytdGross / THRESHOLD_2025 * 100)}% du seuil BNC 2025 (77 700€). Consultez un comptable.`}
                </div>
              </div>
            )}

            {/* Chart */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 20 }}>{t.chart_title} — {selectedYear}</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
                  <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 12 }} labelStyle={{ color: '#999' }}/>
                  <Bar dataKey="gross" fill="rgba(245,192,0,0.7)" radius={[3,3,0,0]} name={t.gross}/>
                  <Bar dataKey="net" fill="#4eff91" radius={[3,3,0,0]} name={t.net}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tips */}
            <div style={{ ...S.card, borderColor: 'rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
              <div style={{ ...S.label, color: 'var(--c-gold)' }}>💼 {t.tips}</div>
              <div style={{ fontSize: 14, color: 'rgba(240,240,240,0.8)', marginTop: 10, lineHeight: 1.7 }}>
                {TIPS[lang][tipIdx]}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="page-enter">
            {/* Add past history hint */}
            <div style={{ ...S.card, borderColor: 'rgba(106,180,255,0.2)', background: 'rgba(106,180,255,0.03)' }}>
              <div style={{ fontSize: 13, color: 'rgba(106,180,255,0.7)', lineHeight: 1.6 }}>
                {lang === 'en'
                  ? '📂 Use the + Add Income form on the Dashboard to add past invoices. Just change the date to the correct month.'
                  : '📂 Utilisez le formulaire + Ajouter sur le tableau de bord pour entrer les factures passées. Changez simplement la date.'}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 16 }}>
                {t.history} — {selectedYear}
                <span style={{ color: 'var(--c-muted)', marginLeft: 12 }}>{income.length} {lang === 'en' ? 'entries' : 'entrées'}</span>
              </div>

              {income.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--c-muted)', fontSize: 14 }}>
                  {lang === 'en' ? 'No income recorded for this year yet.' : 'Aucun revenu enregistré pour cette année.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Date', 'Client', t.gross, 'URSSAF', t.net, `→ Wise`, lang === 'en' ? 'Category' : 'Catégorie'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--c-border)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {income.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px', color: 'var(--c-muted)' }}>{r.date}</td>
                        <td style={{ padding: '12px', fontWeight: 500 }}>{r.client || '—'}</td>
                        <td style={{ padding: '12px', color: '#fff' }}>€{Math.round(r.amount_gross)}</td>
                        <td style={{ padding: '12px', color: 'var(--c-accent)' }}>-€{Math.round(r.amount_urssaf)}</td>
                        <td style={{ padding: '12px', color: '#4eff91', fontWeight: 600 }}>€{Math.round(r.amount_after_urssaf)}</td>
                        <td style={{ padding: '12px', color: '#6ab4ff' }}>€{Math.round(r.amount_to_piers_wise || 0)}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'var(--c-surface2)', color: 'var(--c-muted)' }}>
                            {URSSAF_CATEGORIES.find(c => c.id === r.category)?.label || r.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--c-border)' }}>
                      <td colSpan={2} style={{ padding: '12px', fontSize: 12, fontWeight: 700 }}>TOTAL {selectedYear}</td>
                      <td style={{ padding: '12px', color: '#fff', fontWeight: 700 }}>€{Math.round(ytdGross).toLocaleString()}</td>
                      <td style={{ padding: '12px', color: 'var(--c-accent)', fontWeight: 700 }}>-€{Math.round(ytdUrssaf).toLocaleString()}</td>
                      <td style={{ padding: '12px', color: '#4eff91', fontWeight: 700 }}>€{Math.round(ytdNet).toLocaleString()}</td>
                      <td style={{ padding: '12px', color: '#6ab4ff', fontWeight: 700 }}>€{Math.round(ytdToPiers).toLocaleString()}</td>
                      <td/>
                    </tr>
                  </tfoot>
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
                {/* URSSAF cat */}
                <div>
                  <div style={S.label}>{t.urssaf_rate}</div>
                  {URSSAF_CATEGORIES.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                      <input type="radio" name="urssaf" value={c.id} checked={urssafCat === c.id} onChange={() => setUrssafCat(c.id)} style={{ accentColor: 'var(--c-accent)' }}/>
                      <span style={{ fontSize: 14 }}>{c.label}</span>
                      <span style={{ fontSize: 13, color: 'var(--c-accent)', fontWeight: 700 }}>{(c.rate * 100).toFixed(1)}%</span>
                    </label>
                  ))}
                </div>

                {/* Piers % */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={S.label}>{t.piers_pct}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#6ab4ff' }}>{Math.round(piersPct)}%</div>
                  </div>
                  <input type="range" min="10" max="60" value={piersPct} onChange={e => setPiersPct(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#6ab4ff' }}/>
                  <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 6 }}>
                    {lang === 'en'
                      ? `On €1,000 net: €${Math.round(10 * piersPct)} → Piers' Wise (for rent + savings)`
                      : `Sur 1 000€ net : ${Math.round(10 * piersPct)}€ → Wise Piers (loyer + épargne)`}
                  </div>
                </div>

                {/* Company % */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={S.label}>{t.invest_pct}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ffcc44' }}>{Math.round(investPct)}%</div>
                  </div>
                  <input type="range" min="0" max="30" value={investPct} onChange={e => setInvestPct(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#ffcc44' }}/>
                </div>

                {/* Summary of splits */}
                <div style={{ background: 'var(--c-surface2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>{lang === 'en' ? 'For every €1,000 net:' : 'Pour chaque 1 000€ net :'}</div>
                  {[
                    { label: t.to_wise, val: Math.round(1000 * piersPct / 100), color: '#6ab4ff' },
                    { label: t.company, val: Math.round(1000 * investPct / 100), color: '#ffcc44' },
                    { label: lang === 'en' ? 'Your salary' : 'Votre salaire', val: Math.round(1000 * (1 - piersPct / 100 - investPct / 100)), color: '#4eff91' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-border)', fontSize: 14 }}>
                      <span style={{ color: 'var(--c-muted)' }}>{label}</span>
                      <span style={{ color, fontWeight: 700 }}>€{val}</span>
                    </div>
                  ))}
                </div>

                {/* Wise Piers note */}
                <div style={{ background: 'rgba(245,192,0,0.05)', borderRadius: 8, padding: 16, border: '1px solid rgba(245,192,0,0.2)' }}>
                  <div style={{ ...S.label, color: 'rgba(245,192,0,0.7)' }}>🏠 {lang === 'en' ? '→ Wise Piers (joint savings & rent) — how it works' : '→ Wise Piers (épargne commune & loyer) — fonctionnement'}</div>
                  <div style={{ fontSize: 13, color: 'rgba(240,240,240,0.7)', marginTop: 8, lineHeight: 1.8 }}>
                    {lang === 'en'
                      ? `Your ${Math.round(piersPct)}% transfer (€${Math.round(10 * piersPct)} per €1,000 net) goes to Piers' Wise. It covers the €${RENT} shared rent first, then contributes to joint savings.`
                      : `Votre virement de ${Math.round(piersPct)}% (${Math.round(10 * piersPct)}€ par 1 000€ net) va sur le Wise de Piers. Il couvre d'abord le loyer commun de ${RENT}€, puis alimente l'épargne commune.`}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(245,192,0,0.6)', marginTop: 10, lineHeight: 1.7 }}>
                    {lang === 'en'
                      ? `💡 This is your proportional contribution. If you earn more than Piers this month, your % contribution to joint savings increases automatically in Money Time.`
                      : `💡 Il s'agit de votre contribution proportionnelle. Si vous gagnez plus que Piers ce mois-ci, votre % de contribution à l'épargne commune augmente automatiquement dans Money Time.`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WISHLIST ── */}
        {tab === 'wishlist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">

            {/* Ready-to-buy banners */}
            {readyToBuy.map(item => (
              <div key={item.id} style={{ background: 'rgba(78,255,145,0.08)', border: '1px solid rgba(78,255,145,0.4)', borderRadius: 8, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#4eff91', fontSize: 14, fontWeight: 600 }}>
                  🎉 {item.name} — {lang === 'en' ? 'ready to buy!' : 'prêt à acheter !'}
                </div>
                {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: 'none', fontSize: 12, padding: '6px 14px' }}>{lang === 'en' ? 'View →' : 'Voir →'}</a>}
              </div>
            ))}

            {/* Allocation slider */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={S.label}>{t.wish_alloc}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-accent)' }}>{wishlistPct}%</div>
              </div>
              <input type="range" min="0" max="20" value={wishlistPct} onChange={e => { const v = parseInt(e.target.value); setWishlistPct(v); localStorage.setItem('cv_wishlist_pct', v) }} style={{ width: '100%', accentColor: 'var(--c-accent)' }}/>
              <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 8 }}>
                {lang === 'en'
                  ? `= €${Math.round(1000 * wishlistPct / 100)} from every €1,000 net → top priority item`
                  : `= ${Math.round(1000 * wishlistPct / 100)}€ de chaque 1 000€ net → article prioritaire`}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: t.wish_total, val: `€${Math.round(wishTotal).toLocaleString()}`, color: '#fff' },
                { label: t.wish_funded, val: `€${Math.round(wishFunded).toLocaleString()}`, color: '#4eff91' },
                { label: t.wish_months, val: monthsToTop !== null ? `${monthsToTop}` : '—', color: '#ffcc44', suffix: monthsToTop !== null ? (lang === 'en' ? ' mo' : ' mois') : '' },
              ].map(({ label, val, color, suffix }) => (
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color, marginTop: 8 }}>{val}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--c-muted)' }}>{suffix}</span></div>
                </div>
              ))}
            </div>

            {/* Add form */}
            <div style={{ ...S.card, borderColor: 'rgba(245,192,0,0.25)' }}>
              <div style={{ ...S.label, color: 'rgba(245,192,0,0.8)', marginBottom: 16 }}>+ {t.wish_add}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={S.label}>{t.wish_name}</div>
                  <input style={S.input} value={newWishItem.name} onChange={e => setNewWishItem(p => ({ ...p, name: e.target.value }))} placeholder={lang === 'en' ? 'e.g. Sony lens' : 'ex. Objectif Sony'}/>
                </div>
                <div>
                  <div style={S.label}>{t.wish_price}</div>
                  <input style={S.input} type="number" value={newWishItem.price} onChange={e => setNewWishItem(p => ({ ...p, price: e.target.value }))} placeholder="€"/>
                </div>
                <div>
                  <div style={S.label}>{t.wish_cat}</div>
                  <select style={S.input} value={newWishItem.category} onChange={e => setNewWishItem(p => ({ ...p, category: e.target.value }))}>
                    <option value="gear">🔧 Gear</option>
                    <option value="software">💻 Software</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>
                <div>
                  <div style={S.label}>{t.wish_priority}</div>
                  <select style={S.input} value={newWishItem.priority} onChange={e => setNewWishItem(p => ({ ...p, priority: e.target.value }))}>
                    <option value="dream">⭐ Dream</option>
                    <option value="soon">🔜 Soon</option>
                    <option value="someday">☁️ Someday</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={S.label}>{t.wish_url}</div>
                  <input style={S.input} value={newWishItem.url} onChange={e => setNewWishItem(p => ({ ...p, url: e.target.value }))} placeholder="https://..."/>
                </div>
                <button
                  style={{ ...S.btn, alignSelf: 'flex-end', whiteSpace: 'nowrap', opacity: wishLoading ? 0.6 : 1 }}
                  onClick={addWishItem}
                  disabled={wishLoading}
                >
                  {wishLoading ? (lang === 'en' ? 'Adding…' : 'Ajout…') : t.add}
                </button>
              </div>
            </div>

            {/* Wishlist error display */}
            {wishError && (
              <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,80,80,0.4)', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ff7070', marginBottom: 6 }}>
                  ⚠ {lang === 'en' ? 'Failed to add item — Supabase error:' : 'Échec d\'ajout — Erreur Supabase :'}
                </div>
                <div style={{ fontSize: 11, color: '#ff9090', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 6 }}>
                  {wishError}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,150,150,0.7)', lineHeight: 1.6 }}>
                  {lang === 'en'
                    ? 'If this says "relation does not exist", run the SQL from supabase_schema.sql in your Supabase SQL Editor to create the cv_wishlist table.'
                    : 'Si l\'erreur mentionne "relation does not exist", exécutez le SQL de supabase_schema.sql dans Supabase pour créer la table cv_wishlist.'}
                </div>
                <button
                  onClick={() => setWishError(null)}
                  style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,100,100,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  {lang === 'en' ? 'Dismiss' : 'Fermer'}
                </button>
              </div>
            )}

            {/* Sort controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--c-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.wish_sort}:</span>
              {['priority', 'price', 'funded'].map(s => (
                <button key={s} onClick={() => setWishlistSort(s)} style={{
                  padding: '4px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-modern)',
                  background: wishlistSort === s ? 'var(--c-accent)' : 'transparent',
                  color: wishlistSort === s ? '#1a1a1a' : 'var(--c-muted)',
                  border: '1px solid var(--c-border)'
                }}>{s}</button>
              ))}
            </div>

            {/* Item cards */}
            {sortedWishlist.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: 'var(--c-muted)', fontSize: 14, padding: 40 }}>
                {lang === 'en' ? 'No wishlist items yet — add something above!' : 'Liste vide — ajoutez un article ci-dessus !'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {sortedWishlist.map(item => (
                  <CVWishCard key={item.id} item={item} onMarkBought={markWishPurchased} onDelete={deleteWishItem} S={S} lang={lang}/>
                ))}
              </div>
            )}

            {/* Purchased items */}
            {wishlist.some(w => w.purchased) && (
              <div style={S.card}>
                <div style={{ ...S.label, marginBottom: 12 }}>✓ {lang === 'en' ? 'Purchased' : 'Achetés'}</div>
                {wishlist.filter(w => w.purchased).map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--c-border)', fontSize: 13, opacity: 0.5 }}>
                    <span style={{ textDecoration: 'line-through', color: 'var(--c-muted)' }}>{item.name}</span>
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

const CV_PRIORITY_COLORS = { dream: '#f5c000', soon: '#ffcc44', someday: '#6ab4ff' }
const CV_PRIORITY_ICONS  = { dream: '⭐', soon: '🔜', someday: '☁️' }
const CV_CAT_ICONS       = { gear: '🔧', software: '💻', other: '📦' }

function CVWishCard({ item, onMarkBought, onDelete, S, lang }) {
  const funded = item.funded || 0
  const fundedPct = Math.min(100, (funded / item.price) * 100)
  const isReady = funded >= item.price
  const pc = CV_PRIORITY_COLORS[item.priority] || '#aaa'

  return (
    <div style={{ ...S.card, borderColor: isReady ? 'rgba(78,255,145,0.5)' : 'var(--c-border)', background: isReady ? 'rgba(78,255,145,0.04)' : 'var(--c-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: `${pc}22`, color: pc, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {CV_PRIORITY_ICONS[item.priority]} {item.priority}
            </span>
            {item.category && <span style={{ fontSize: 10, color: 'var(--c-muted)' }}>{CV_CAT_ICONS[item.category]} {item.category}</span>}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0' }}>{item.name}</div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--c-accent)', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
              🔗 {lang === 'en' ? 'View product' : 'Voir le produit'}
            </a>
          )}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginLeft: 12, flexShrink: 0 }}>€{item.price.toLocaleString()}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-muted)', marginBottom: 5 }}>
          <span>€{Math.round(funded).toLocaleString()} {lang === 'en' ? 'funded' : 'financé'}</span>
          <span>{Math.round(fundedPct)}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--c-surface2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${fundedPct}%`, background: isReady ? '#4eff91' : 'var(--c-accent)', borderRadius: 3, transition: 'width 0.4s' }}/>
        </div>
      </div>

      {isReady && (
        <div style={{ fontSize: 12, color: '#4eff91', marginBottom: 10, fontWeight: 600 }}>
          🎉 {lang === 'en' ? 'You can buy this now!' : 'Vous pouvez l\'acheter maintenant !'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onMarkBought(item.id)} style={{ ...S.btn, flex: 1, fontSize: 12, padding: '8px', background: isReady ? '#4eff91' : 'transparent', color: isReady ? '#000' : 'var(--c-muted)', border: `1px solid ${isReady ? '#4eff91' : 'var(--c-border)'}` }}>
          {lang === 'en' ? 'Mark as bought ✓' : 'Marquer acheté ✓'}
        </button>
        <button onClick={() => onDelete(item.id)} style={{ background: 'rgba(255,78,78,0.1)', border: '1px solid rgba(255,78,78,0.3)', borderRadius: 6, padding: '8px 10px', color: 'rgba(255,100,100,0.9)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-modern)' }}>✕</button>
      </div>
    </div>
  )
}
