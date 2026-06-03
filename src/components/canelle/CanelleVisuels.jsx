import { useState, useEffect } from 'react'
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
    "The 2024 threshold for BNC services is €77,700. Track your annual turnover carefully.",
    "Pay yourself a consistent salary each month, even when income varies.",
    "Reinvesting 10% back into your business (gear, software, training) is a smart habit.",
    "Build a 3-month revenue buffer before increasing your personal salary.",
  ],
  fr: [
    "Mettez de côté les cotisations URSSAF dès chaque encaissement — ne les dépensez jamais.",
    "En micro-entreprise, aucune charge n'est déductible. Suivez votre CA annuel.",
    "Le seuil 2024 pour les services BNC est 77 700€. Surveillez votre CA cumulé.",
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
    year_total: 'YTD Turnover', threshold: '2024 Threshold',
    tips: 'Business Tips', chart_title: 'Monthly Revenue',
    edit_splits: 'Edit Splits', piers_pct: "% to Piers' Wise",
    invest_pct: '% reinvest company'
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
    year_total: 'CA annuel', threshold: 'Seuil 2024',
    tips: 'Conseils pro', chart_title: 'Revenus mensuels',
    edit_splits: 'Modifier la répartition', piers_pct: "% vers Wise Piers",
    invest_pct: '% réinvesti entreprise'
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

  // New income form
  const [form, setForm] = useState({ client: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), cat: 'bnc_services', desc: '' })

  useEffect(() => { loadIncome() }, [selectedYear])

  async function loadIncome() {
    setLoading(true)
    const { data } = await supabase.from('cv_income')
      .select('*').gte('date', `${selectedYear}-01-01`).lte('date', `${selectedYear}-12-31`)
      .order('date', { ascending: false })
    setIncome(data || [])
    setLoading(false)
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
  const THRESHOLD_2024 = 77700

  // Monthly chart data
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    const monthIncome = income.filter(r => r.date?.startsWith(`${selectedYear}-${m}`))
    const gross = monthIncome.reduce((s, r) => s + (r.amount_gross || 0), 0)
    const net = monthIncome.reduce((s, r) => s + (r.amount_after_urssaf || 0), 0)
    return { month: m, gross: Math.round(gross), net: Math.round(net) }
  })

  const S = {
    container: { minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'var(--font-modern)' },
    card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: 24 },
    label: { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-muted)', marginBottom: 6 },
    input: { background: 'var(--c-surface2)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '10px 14px', color: 'var(--c-text)', fontSize: 13, width: '100%', fontFamily: 'var(--font-modern)' },
    btn: { background: 'var(--c-accent)', border: 'none', borderRadius: 6, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: 'var(--font-modern)', transition: 'all 0.15s' },
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
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 28, letterSpacing: '0.1em', lineHeight: 1 }}>
              {t.title} <span style={{ color: 'var(--c-accent)' }}>{t.sub}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-muted)', letterSpacing: '0.15em' }}>BUSINESS TRACKER</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            CA {selectedYear}: <span style={{ color: ytdGross > THRESHOLD_2024 ? 'var(--c-accent)' : '#4eff91', fontWeight: 700 }}>€{Math.round(ytdGross).toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['en', 'fr'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: lang === l ? 'var(--c-accent)' : 'transparent',
                color: lang === l ? '#fff' : 'var(--c-muted)',
                border: '1px solid var(--c-border)', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'var(--font-modern)'
              }}>{l}</button>
            ))}
          </div>
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ ...S.input, width: 100 }}>
            {[2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--c-border)', padding: '0 32px' }}>
        {['dashboard', 'history', 'splits'].map(tab_id => (
          <button key={tab_id} style={S.navBtn(tab === tab_id)} onClick={() => setTab(tab_id)}>
            {t[tab_id] || tab_id}
          </button>
        ))}
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="page-enter">

            {/* Add income */}
            <div style={{ ...S.card, borderColor: 'rgba(232,0,28,0.2)' }}>
              <div style={{ ...S.label, color: 'rgba(232,0,28,0.6)', marginBottom: 16 }}>+ {t.add_income}</div>
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

              {/* Live breakdown preview */}
              {previewGross > 0 && (
                <div style={{ background: 'var(--c-surface2)', borderRadius: 8, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  {[
                    { label: t.gross, val: previewGross, color: '#fff' },
                    { label: `URSSAF (${Math.round(rate * 100)}%)`, val: -previewUrssaf, color: 'var(--c-accent)' },
                    { label: t.net, val: previewNet, color: '#4eff91' },
                    { label: `${t.company} (${Math.round(investPct)}%)`, val: previewCompany, color: '#ffcc44' },
                    { label: t.to_wise, val: previewToPiers, color: '#6ab4ff' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--c-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color }}>{val < 0 ? '-' : ''}€{Math.round(Math.abs(val)).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* YTD stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: t.year_total, val: ytdGross, color: '#fff', sub: `${Math.round(ytdGross / THRESHOLD_2024 * 100)}% of ${THRESHOLD_2024.toLocaleString()}€ threshold` },
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

            {/* Threshold warning */}
            {ytdGross > THRESHOLD_2024 * 0.8 && (
              <div style={{ background: 'rgba(232,0,28,0.08)', border: '1px solid rgba(232,0,28,0.3)', borderRadius: 8, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 20 }}>⚠️</div>
                <div style={{ fontSize: 13, color: 'rgba(232,0,28,0.9)' }}>
                  {lang === 'en'
                    ? `You've reached ${Math.round(ytdGross / THRESHOLD_2024 * 100)}% of the 2024 BNC threshold (€77,700). Consider consulting an accountant.`
                    : `Vous avez atteint ${Math.round(ytdGross / THRESHOLD_2024 * 100)}% du seuil BNC 2024 (77 700€). Consultez un comptable.`}
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
                  <Bar dataKey="gross" fill="rgba(232,0,28,0.5)" radius={[3,3,0,0]} name={t.gross}/>
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

                {/* Rent coverage */}
                <div style={{ background: 'rgba(232,0,28,0.06)', borderRadius: 8, padding: 16, border: '1px solid rgba(232,0,28,0.15)' }}>
                  <div style={S.label}>🏠 {lang === 'en' ? 'Rent coverage from Wise Piers' : 'Couverture loyer depuis Wise Piers'}</div>
                  <div style={{ fontSize: 13, color: 'rgba(240,240,240,0.7)', marginTop: 8, lineHeight: 1.7 }}>
                    {lang === 'en'
                      ? `€${RENT} rent is paid from Piers' Wise. Your ${Math.round(piersPct)}% transfer (€${Math.round(10 * piersPct)}/1000€ net) goes there first to cover it.`
                      : `Le loyer de ${RENT}€ est prélevé sur le Wise de Piers. Votre virement de ${Math.round(piersPct)}% (${Math.round(10 * piersPct)}€/1000€ net) l'y alimente.`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
