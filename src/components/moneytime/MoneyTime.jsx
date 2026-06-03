import { useState, useEffect } from 'react'
import { supabase, ACCOUNTS, EXPENSE_CATEGORIES, FOOD_BUDGET, RENT_AMOUNT } from '../../lib/supabase.js'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'

const T = {
  en: {
    title: 'MONEY TIME', back: '← Back', month: 'Month',
    piers_income: "Piers' Monthly Salary", canelle_income: "Canelle's Income (auto)",
    accounts: 'Accounts', add_expense: 'Add Expense', expenses: 'Expenses',
    budget: 'Budget Planner', savings: 'Savings Goal', tips: 'Monthly Tips',
    combined: 'Combined Income', food_spent: 'Food Spent', food_budget: 'Food Budget',
    can_spend: 'Available to Spend', save_target: 'Save Target', amount: 'Amount',
    category: 'Category', account: 'From Account', desc: 'Description',
    add: 'Add', balance: 'Balance', update_balance: 'Update Balance',
    save_salary: 'Save Salary', this_month: 'This Month', last_month: 'Last Month',
    food_warn: '⚠ Food budget almost used!', food_over: '🚨 Food budget exceeded!',
    savings_pct: 'Savings target (% of income)', investment: 'Investment split',
    rent: 'Rent (from Wise Piers)', invest_piers: "Piers' Investment",
    invest_canelle: "Canelle's Investment", date: 'Date',
    delete: 'Delete', update_all: 'Update All Balances',
    balance_stale: 'Balance reminder: some account balances are 7+ days old.',
    update_now: 'Update Now', save_all: 'Save All', cancel: 'Cancel',
  },
  fr: {
    title: 'MONEY TIME', back: '← Retour', month: 'Mois',
    piers_income: 'Salaire mensuel Piers', canelle_income: "Revenus Canelle (auto)",
    accounts: 'Comptes', add_expense: 'Ajouter une dépense', expenses: 'Dépenses',
    budget: 'Planificateur', savings: "Objectif d'épargne", tips: 'Conseils du mois',
    combined: 'Revenus combinés', food_spent: 'Dépenses alimentaires', food_budget: 'Budget alimentation',
    can_spend: 'Disponible', save_target: 'Objectif épargne', amount: 'Montant',
    category: 'Catégorie', account: 'Depuis le compte', desc: 'Description',
    add: 'Ajouter', balance: 'Solde', update_balance: 'Mettre à jour',
    save_salary: 'Enregistrer salaire', this_month: 'Ce mois', last_month: 'Mois dernier',
    food_warn: '⚠ Budget alimentation presque épuisé !', food_over: '🚨 Budget alimentation dépassé !',
    savings_pct: 'Objectif épargne (% des revenus)', investment: 'Répartition investissement',
    rent: 'Loyer (depuis Wise Piers)', invest_piers: 'Investissement Piers',
    invest_canelle: 'Investissement Canelle', date: 'Date',
    delete: 'Supprimer', update_all: 'Mettre à jour tous les soldes',
    balance_stale: "Rappel : certains soldes n'ont pas été mis à jour depuis 7+ jours.",
    update_now: 'Mettre à jour', save_all: 'Tout enregistrer', cancel: 'Annuler',
  }
}

const TIPS = {
  en: [
    "After a holiday, prioritise rebuilding your emergency fund before discretionary spending.",
    "Track every expense for 30 days — awareness is the first step to saving.",
    "The 50/30/20 rule: 50% needs, 30% wants, 20% savings/investments.",
    "Review subscriptions monthly — cancel anything unused for 2+ months.",
    "Cook in bulk on Sundays to stay under your €400 food budget.",
    "Before a purchase over €50, wait 48 hours. Impulse buying fades fast.",
    "Transfer savings the day you get paid, not at the end of the month.",
  ],
  fr: [
    "Après les vacances, reconstituez d'abord votre fonds d'urgence.",
    "Notez chaque dépense pendant 30 jours — la conscience est la première étape.",
    "Règle 50/30/20 : 50% besoins, 30% envies, 20% épargne.",
    "Révisez vos abonnements chaque mois — annulez ce que vous n'utilisez pas.",
    "Cuisinez en grande quantité le dimanche pour rester sous les 400€ alimentaires.",
    "Pour tout achat > 50€, attendez 48h. Les achats impulsifs passent vite.",
    "Transférez l'épargne dès le jour du salaire, pas en fin de mois.",
  ]
}

export default function MoneyTime({ onBack, lang, setLang }) {
  const t = T[lang]
  const [tab, setTab] = useState('overview')
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [piersSalary, setPiersSalary] = useState(0)
  const [savingsPct, setSavingsPct] = useState(20)
  const [expenses, setExpenses] = useState([])
  const [balances, setBalances] = useState({})
  const [balanceUpdatedAt, setBalanceUpdatedAt] = useState({})
  const [canelleIncome, setCanelleIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tipIdx] = useState(() => new Date().getDate() % TIPS.en.length)
  const [showBalanceModal, setShowBalanceModal] = useState(false)
  const [modalInputs, setModalInputs] = useState({})
  const [newExp, setNewExp] = useState({ amount: '', category: '', account: '', desc: '', date: format(new Date(), 'yyyy-MM-dd') })
  const [newSalary, setNewSalary] = useState('')

  useEffect(() => { loadData() }, [currentMonth])

  async function loadData() {
    setLoading(true)
    try {
      const { data: salaryData } = await supabase.from('mt_salaries')
        .select('*').eq('month', currentMonth).eq('person', 'piers').maybeSingle()
      if (salaryData) { setPiersSalary(salaryData.amount); setNewSalary(salaryData.amount.toString()) }

      const start = startOfMonth(parseISO(currentMonth + '-01')).toISOString().slice(0, 10)
      const end = endOfMonth(parseISO(currentMonth + '-01')).toISOString().slice(0, 10)
      const { data: expData } = await supabase.from('mt_expenses')
        .select('*').gte('date', start).lte('date', end).order('date', { ascending: false })
      setExpenses(expData || [])

      const { data: balData } = await supabase.from('mt_balances').select('*')
      const balMap = {}
      const updAtMap = {}
      ;(balData || []).forEach(b => {
        balMap[b.account_id] = b.balance
        updAtMap[b.account_id] = b.updated_at
      })
      setBalances(balMap)
      setBalanceUpdatedAt(updAtMap)

      const { data: cIncome } = await supabase.from('cv_income')
        .select('amount_after_urssaf').gte('date', start).lte('date', end)
      const total = (cIncome || []).reduce((s, r) => s + (r.amount_after_urssaf || 0), 0)
      setCanelleIncome(total)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function saveSalary() {
    const amt = parseFloat(newSalary) || 0
    await supabase.from('mt_salaries').upsert({ month: currentMonth, person: 'piers', amount: amt }, { onConflict: 'month,person' })
    setPiersSalary(amt)
  }

  async function addExpense() {
    if (!newExp.amount || !newExp.category || !newExp.account) return
    const { data } = await supabase.from('mt_expenses').insert({
      amount: parseFloat(newExp.amount), category: newExp.category,
      account_id: newExp.account, description: newExp.desc, date: newExp.date
    }).select().single()
    if (data) setExpenses(prev => [data, ...prev])
    setNewExp({ amount: '', category: '', account: '', desc: '', date: format(new Date(), 'yyyy-MM-dd') })
  }

  async function deleteExpense(id) {
    await supabase.from('mt_expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  async function updateBalance(accountId, val) {
    const now = new Date().toISOString()
    await supabase.from('mt_balances').upsert({ account_id: accountId, balance: parseFloat(val) || 0, updated_at: now }, { onConflict: 'account_id' })
    setBalances(prev => ({ ...prev, [accountId]: parseFloat(val) || 0 }))
    setBalanceUpdatedAt(prev => ({ ...prev, [accountId]: now }))
  }

  function openBalanceModal() {
    const inputs = {}
    ACCOUNTS.forEach(acc => { inputs[acc.id] = (balances[acc.id] || 0).toString() })
    setModalInputs(inputs)
    setShowBalanceModal(true)
  }

  async function saveAllBalances() {
    const now = new Date().toISOString()
    await Promise.all(ACCOUNTS.map(acc =>
      supabase.from('mt_balances').upsert(
        { account_id: acc.id, balance: parseFloat(modalInputs[acc.id]) || 0, updated_at: now },
        { onConflict: 'account_id' }
      )
    ))
    const newBal = {}
    const newUpdAt = {}
    ACCOUNTS.forEach(acc => {
      newBal[acc.id] = parseFloat(modalInputs[acc.id]) || 0
      newUpdAt[acc.id] = now
    })
    setBalances(newBal)
    setBalanceUpdatedAt(newUpdAt)
    setShowBalanceModal(false)
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const hasStaleBalance = ACCOUNTS.some(acc => {
    const updAt = balanceUpdatedAt[acc.id]
    if (!updAt) return true
    return (new Date() - new Date(updAt)) >= sevenDaysMs
  })

  const combinedIncome = piersSalary + canelleIncome
  const foodExpenses = expenses.filter(e => e.category === 'Food & Groceries').reduce((s, e) => s + e.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const savingsTarget = combinedIncome * (savingsPct / 100)
  const canSpend = combinedIncome - savingsTarget - RENT_AMOUNT
  const incomeRatio = combinedIncome > 0 ? { piers: piersSalary / combinedIncome, canelle: canelleIncome / combinedIncome } : { piers: 0.5, canelle: 0.5 }

  const [chartData, setChartData] = useState([])
  useEffect(() => {
    async function loadChart() {
      const months = Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), 5 - i), 'yyyy-MM'))
      const data = await Promise.all(months.map(async (m) => {
        const start = startOfMonth(parseISO(m + '-01')).toISOString().slice(0, 10)
        const end = endOfMonth(parseISO(m + '-01')).toISOString().slice(0, 10)
        const { data: sal } = await supabase.from('mt_salaries').select('amount').eq('month', m).eq('person', 'piers').maybeSingle()
        const { data: exp } = await supabase.from('mt_expenses').select('amount').gte('date', start).lte('date', end)
        const { data: ci } = await supabase.from('cv_income').select('amount_after_urssaf').gte('date', start).lte('date', end)
        const income = (sal?.amount || 0) + (ci || []).reduce((s, r) => s + r.amount_after_urssaf, 0)
        const spent = (exp || []).reduce((s, e) => s + e.amount, 0)
        return { month: m.slice(5), income: Math.round(income), expenses: Math.round(spent), savings: Math.round(Math.max(0, income - spent)) }
      }))
      setChartData(data)
    }
    loadChart()
  }, [currentMonth])

  const S = {
    container: { minHeight: '100vh', background: 'var(--v-bg)', color: 'var(--v-text)', fontFamily: 'var(--font-mono)' },
    nav: { display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--v-glass-border)', padding: '0 24px' },
    navBtn: (active) => ({
      padding: '14px 20px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: active ? 'var(--v-glass)' : 'transparent',
      color: active ? 'var(--v-accent)' : 'var(--v-muted)',
      border: 'none', borderBottom: active ? '2px solid var(--v-accent)' : '2px solid transparent',
      letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)',
      transition: 'all 0.15s'
    }),
    card: { background: 'var(--v-glass)', border: '1px solid var(--v-glass-border)', borderRadius: 8, padding: 20 },
    label: { fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--v-muted)', marginBottom: 6 },
    big: { fontSize: 28, fontWeight: 700, color: 'var(--v-accent)', fontFamily: 'var(--font-vista)', letterSpacing: '0.05em' },
    input: { background: 'rgba(0,0,0,0.4)', border: '1px solid var(--v-glass-border)', borderRadius: 4, padding: '8px 12px', color: 'var(--v-text)', fontSize: 13, width: '100%', fontFamily: 'var(--font-mono)' },
    btn: { background: 'rgba(106,180,255,0.15)', border: '1px solid rgba(106,180,255,0.4)', borderRadius: 4, padding: '8px 16px', color: 'var(--v-accent)', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 0.15s' },
  }

  const foodPct = Math.min(100, (foodExpenses / FOOD_BUDGET) * 100)

  return (
    <div className="vista" style={S.container}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--v-glass-border)', background: 'rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button onClick={onBack} style={{ ...S.btn, fontSize: 11 }}>{t.back}</button>
          <div style={{ fontFamily: 'var(--font-vista)', fontSize: 32, color: 'var(--v-accent)', letterSpacing: '0.1em', textShadow: '0 0 20px rgba(106,180,255,0.3)' }}>
            {t.title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {['en', 'fr'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: lang === l ? 'rgba(106,180,255,0.2)' : 'transparent',
                color: lang === l ? 'var(--v-accent)' : 'var(--v-muted)',
                border: '1px solid rgba(106,180,255,0.3)', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'var(--font-mono)'
              }}>{l}</button>
            ))}
          </div>
          <input type="month" value={currentMonth} onChange={e => setCurrentMonth(e.target.value)}
            style={{ ...S.input, width: 160 }} />
        </div>
      </div>

      {/* Stale balance banner */}
      {hasStaleBalance && !loading && (
        <div style={{ background: 'rgba(255,204,68,0.08)', borderBottom: '1px solid rgba(255,204,68,0.25)', padding: '10px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--v-amber)' }}>⏰ {t.balance_stale}</div>
          <button
            style={{ ...S.btn, fontSize: 11, color: 'var(--v-amber)', border: '1px solid rgba(255,204,68,0.4)', background: 'rgba(255,204,68,0.1)' }}
            onClick={openBalanceModal}
          >{t.update_now}</button>
        </div>
      )}

      {/* Nav tabs */}
      <div style={S.nav}>
        {['overview', 'accounts', 'expenses', 'budget'].map(tab_id => (
          <button key={tab_id} style={S.navBtn(tab === tab_id)} onClick={() => setTab(tab_id)}>
            {t[tab_id] || tab_id.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={S.card}>
                <div style={S.label}>{t.piers_income}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input style={S.input} type="number" value={newSalary} onChange={e => setNewSalary(e.target.value)} placeholder="€ 0" />
                  <button style={S.btn} onClick={saveSalary}>▶</button>
                </div>
                <div style={{ ...S.big, marginTop: 8 }}>€{Math.round(piersSalary).toLocaleString()}</div>
              </div>

              <div style={S.card}>
                <div style={S.label}>{t.canelle_income}</div>
                <div style={{ ...S.big, marginTop: 12 }}>€{Math.round(canelleIncome).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--v-muted)', marginTop: 8 }}>
                  {lang === 'en' ? 'Synced from Canelle Visuels' : 'Synchronisé depuis Canelle Visuels'}
                </div>
              </div>

              <div style={{ ...S.card, background: 'rgba(106,180,255,0.08)', borderColor: 'rgba(106,180,255,0.3)' }}>
                <div style={S.label}>{t.combined}</div>
                <div style={{ fontFamily: 'var(--font-vista)', fontSize: 40, color: 'var(--v-green)', letterSpacing: '0.05em', marginTop: 4 }}>
                  €{Math.round(combinedIncome).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: 'var(--v-muted)', marginTop: 8 }}>
                  P: {Math.round(incomeRatio.piers * 100)}% / C: {Math.round(incomeRatio.canelle * 100)}%
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
              {[
                { label: t.can_spend, val: `€${Math.round(canSpend).toLocaleString()}`, color: 'var(--v-green)' },
                { label: t.save_target, val: `€${Math.round(savingsTarget).toLocaleString()}`, color: 'var(--v-accent)' },
                { label: t.rent, val: `€${RENT_AMOUNT}`, color: 'var(--v-amber)' },
                { label: lang === 'en' ? 'Total Spent' : 'Total dépensé', val: `€${Math.round(totalExpenses).toLocaleString()}`, color: totalExpenses > canSpend ? 'var(--v-red)' : 'var(--v-text)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-vista)', fontSize: 26, color, marginTop: 4 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={S.label}>{t.food_spent} / {t.food_budget}</div>
                <div style={{ fontSize: 13, color: foodExpenses > FOOD_BUDGET ? 'var(--v-red)' : 'var(--v-text)' }}>
                  €{Math.round(foodExpenses)} / €{FOOD_BUDGET}
                </div>
              </div>
              <div style={{ height: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
                  width: `${foodPct}%`,
                  background: foodPct > 100 ? 'var(--v-red)' : foodPct > 80 ? 'var(--v-amber)' : 'var(--v-green)'
                }}/>
              </div>
              {foodPct > 80 && <div style={{ fontSize: 11, color: 'var(--v-amber)', marginTop: 8 }}>
                {foodPct > 100 ? t.food_over : t.food_warn}
              </div>}
            </div>

            {chartData.length > 0 && (
              <div style={S.card}>
                <div style={{ ...S.label, marginBottom: 16 }}>{lang === 'en' ? '6-Month Overview' : 'Aperçu 6 mois'}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6ab4ff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6ab4ff" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff4e4e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ff4e4e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(106,180,255,0.1)" vertical={false}/>
                    <XAxis dataKey="month" tick={{ fill: '#7a9bc4', fontSize: 11, fontFamily: 'Share Tech Mono' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fill: '#7a9bc4', fontSize: 10, fontFamily: 'Share Tech Mono' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ background: '#1a2744', border: '1px solid rgba(106,180,255,0.3)', borderRadius: 6, fontFamily: 'Share Tech Mono', fontSize: 12 }} labelStyle={{ color: '#6ab4ff' }}/>
                    <Area type="monotone" dataKey="income" stroke="#6ab4ff" fill="url(#incGrad)" strokeWidth={2}/>
                    <Area type="monotone" dataKey="expenses" stroke="#ff4e4e" fill="url(#expGrad)" strokeWidth={2}/>
                    <Area type="monotone" dataKey="savings" stroke="#4eff91" fill="none" strokeWidth={1.5} strokeDasharray="4 4"/>
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 8 }}>
                  {[['#6ab4ff', lang === 'en' ? 'Income' : 'Revenus'], ['#ff4e4e', lang === 'en' ? 'Expenses' : 'Dépenses'], ['#4eff91', lang === 'en' ? 'Saved' : 'Épargné']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--v-muted)' }}>
                      <div style={{ width: 12, height: 2, background: c }}/>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...S.card, borderColor: 'rgba(78,255,145,0.2)', background: 'rgba(78,255,145,0.04)' }}>
              <div style={{ ...S.label, color: 'rgba(78,255,145,0.6)' }}>💡 {t.tips}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 8, lineHeight: 1.6 }}>
                {TIPS[lang][tipIdx]}
              </div>
            </div>
          </div>
        )}

        {/* ── ACCOUNTS TAB ── */}
        {tab === 'accounts' && (
          <div className="page-enter">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button style={S.btn} onClick={openBalanceModal}>{t.update_all}</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {ACCOUNTS.map(acc => (
                <AccountCard key={acc.id} acc={acc} balance={balances[acc.id] || 0} onUpdate={updateBalance} S={S} t={t} lang={lang}/>
              ))}
            </div>
          </div>
        )}

        {/* ── EXPENSES TAB ── */}
        {tab === 'expenses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 12 }}>{t.add_expense}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr', gap: 10, alignItems: 'end' }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.amount}</div>
                  <input style={S.input} type="number" placeholder="€" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))}/>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.date}</div>
                  <input style={S.input} type="date" value={newExp.date} onChange={e => setNewExp(p => ({ ...p, date: e.target.value }))}/>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.category}</div>
                  <select style={S.input} value={newExp.category} onChange={e => setNewExp(p => ({ ...p, category: e.target.value }))}>
                    <option value="">--</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.account}</div>
                  <select style={S.input} value={newExp.account} onChange={e => setNewExp(p => ({ ...p, account: e.target.value }))}>
                    <option value="">--</option>
                    {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={S.input} placeholder={t.desc} value={newExp.desc} onChange={e => setNewExp(p => ({ ...p, desc: e.target.value }))}/>
                  <button style={S.btn} onClick={addExpense}>{t.add}</button>
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 12 }}>{t.expenses} — {currentMonth}</div>
              {expenses.length === 0 ? (
                <div style={{ color: 'var(--v-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                  {lang === 'en' ? 'No expenses this month' : 'Aucune dépense ce mois-ci'}
                </div>
              ) : expenses.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(106,180,255,0.08)', fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ color: 'var(--v-muted)', fontSize: 11 }}>{e.date?.slice(5)}</div>
                    <div style={{ color: 'var(--v-text)' }}>{e.description || e.category}</div>
                    <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'rgba(106,180,255,0.1)', color: 'var(--v-accent)' }}>{e.category}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ color: 'var(--v-red)', fontFamily: 'var(--font-vista)', fontSize: 18 }}>-€{e.amount}</div>
                    <button
                      onClick={() => deleteExpense(e.id)}
                      style={{ background: 'rgba(255,78,78,0.1)', border: '1px solid rgba(255,78,78,0.3)', borderRadius: 4, padding: '3px 8px', color: 'var(--v-red)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>

            <CategoryBreakdown expenses={expenses} S={S} lang={lang}/>
          </div>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === 'budget' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 12 }}>{t.savings_pct}</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <input type="range" min="5" max="50" value={savingsPct} onChange={e => setSavingsPct(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--v-accent)' }}/>
                <div style={{ fontFamily: 'var(--font-vista)', fontSize: 24, color: 'var(--v-accent)', minWidth: 60 }}>{savingsPct}%</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--v-muted)', marginTop: 8 }}>
                = €{Math.round(savingsTarget)} / {lang === 'en' ? 'month' : 'mois'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={S.card}>
                <div style={S.label}>{lang === 'en' ? 'Proportional split this month' : 'Répartition proportionnelle'}</div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { name: 'Piers', pct: incomeRatio.piers, share: canSpend * incomeRatio.piers },
                    { name: 'Canelle', pct: incomeRatio.canelle, share: canSpend * incomeRatio.canelle },
                  ].map(({ name, pct, share }) => (
                    <div key={name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: 'var(--v-text)' }}>{name}</span>
                        <span style={{ color: 'var(--v-accent)' }}>€{Math.round(share)} ({Math.round(pct * 100)}%)</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(0,0,0,0.4)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct * 100}%`, background: 'var(--v-accent)', borderRadius: 2 }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={S.card}>
                <div style={S.label}>{lang === 'en' ? 'Fixed costs' : 'Charges fixes'}</div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Rent (Wise Piers)', val: RENT_AMOUNT },
                    { label: lang === 'en' ? 'Food Budget' : 'Budget alimentation', val: FOOD_BUDGET },
                    { label: lang === 'en' ? 'Savings target' : 'Objectif épargne', val: Math.round(savingsTarget) },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--v-muted)' }}>{label}</span>
                      <span style={{ color: 'var(--v-amber)' }}>€{val}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--v-glass-border)', margin: '4px 0' }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--v-text)', fontWeight: 700 }}>{lang === 'en' ? 'Remaining' : 'Restant'}</span>
                    <span style={{ color: 'var(--v-green)', fontFamily: 'var(--font-vista)', fontSize: 18 }}>
                      €{Math.round(combinedIncome - RENT_AMOUNT - FOOD_BUDGET - savingsTarget)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick balance update modal */}
      {showBalanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...S.card, width: 480, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ ...S.label, marginBottom: 20, fontSize: 12 }}>{t.update_all}</div>
            {ACCOUNTS.map(acc => (
              <div key={acc.id} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: acc.color, flexShrink: 0 }}/>
                <span style={{ fontSize: 13, color: 'var(--v-text)', flex: 1 }}>{acc.name}</span>
                <input
                  style={{ ...S.input, width: 130 }}
                  type="number"
                  value={modalInputs[acc.id] || ''}
                  onChange={e => setModalInputs(prev => ({ ...prev, [acc.id]: e.target.value }))}
                  placeholder="€ 0"
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...S.btn, color: 'var(--v-muted)', background: 'transparent', border: '1px solid var(--v-glass-border)' }} onClick={() => setShowBalanceModal(false)}>{t.cancel}</button>
              <button style={S.btn} onClick={saveAllBalances}>{t.save_all}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountCard({ acc, balance, onUpdate, S, t, lang }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(balance.toString())

  useEffect(() => { setVal(balance.toString()) }, [balance])

  const isWise = acc.type === 'wise'

  return (
    <div style={{ ...S.card, borderColor: isWise ? 'rgba(0,185,255,0.3)' : 'var(--v-glass-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v-muted)' }}>
            {acc.owner === 'piers' ? 'PIERS' : 'CANELLE'} · {acc.type.toUpperCase()}
          </div>
          <div style={{ fontSize: 15, color: 'var(--v-text)', marginTop: 4, fontWeight: 600 }}>{acc.name}</div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: acc.color, marginTop: 4 }}/>
      </div>

      <div style={{ fontFamily: 'var(--font-vista)', fontSize: 32, color: balance >= 0 ? 'var(--v-green)' : 'var(--v-red)', marginBottom: 16 }}>
        €{Math.round(balance).toLocaleString()}
      </div>

      {isWise && (
        <div style={{ fontSize: 11, color: 'rgba(0,185,255,0.5)', marginBottom: 12 }}>
          {lang === 'en' ? '⚡ Connect Wise API for live balance' : "⚡ Connectez l'API Wise pour solde en temps réel"}
        </div>
      )}

      {editing ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={S.input} type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus/>
          <button style={S.btn} onClick={() => { onUpdate(acc.id, val); setEditing(false) }}>✓</button>
          <button style={{ ...S.btn, color: 'var(--v-muted)' }} onClick={() => setEditing(false)}>✕</button>
        </div>
      ) : (
        <button style={{ ...S.btn, width: '100%' }} onClick={() => setEditing(true)}>{t.update_balance}</button>
      )}
    </div>
  )
}

function CategoryBreakdown({ expenses, S, lang }) {
  const cats = {}
  expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.amount })
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1])
  const total = Object.values(cats).reduce((s, v) => s + v, 0)
  const colors = ['#6ab4ff', '#4eff91', '#ffcc44', '#ff4e4e', '#ff88cc', '#88ffcc', '#ffaa44']

  return (
    <div style={S.card}>
      <div style={{ ...S.label, marginBottom: 16 }}>{lang === 'en' ? 'By Category' : 'Par catégorie'}</div>
      {sorted.map(([cat, amt], i) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: 'var(--v-text)' }}>{cat}</span>
            <span style={{ color: colors[i % colors.length] }}>€{Math.round(amt)} ({Math.round(amt / total * 100)}%)</span>
          </div>
          <div style={{ height: 4, background: 'rgba(0,0,0,0.4)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${amt / total * 100}%`, background: colors[i % colors.length], borderRadius: 2, transition: 'width 0.5s' }}/>
          </div>
        </div>
      ))}
    </div>
  )
}
