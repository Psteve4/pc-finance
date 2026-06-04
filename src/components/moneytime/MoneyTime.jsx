import { useState, useEffect, useRef } from 'react'
import { supabase, ACCOUNTS, EXPENSE_CATEGORIES, FOOD_BUDGET, RENT_AMOUNT } from '../../lib/supabase.js'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'

const T = {
  en: {
    title: 'MONEY TIME', back: '← Back', month: 'Month',
    piers_income: "Piers' Monthly Salary", canelle_income: "Canelle's Income (auto)",
    accounts: 'Accounts', add_expense: 'Add Expense', expenses: 'Expenses',
    budget: 'Budget Planner', recurring: 'Recurring', tips: 'Monthly Tips',
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
    rec_name: 'Name', rec_day: 'Day of month', rec_total: 'Monthly recurring total',
    rec_add: 'Add Recurring', rec_active: 'Active', rec_this_month: '📅 Recurring this month',
    rec_not_logged: 'Not yet added this month',
    rec_add_all: 'Add All to This Month', rec_dismiss: 'Dismiss',
    wishlist: 'Wishlist', wish_add: 'Add Item', wish_name: 'Item',
    wish_price: 'Price', wish_url: 'URL', wish_owner: 'For',
    wish_fund: 'Add Funds', wish_bought: 'Bought ✓',
    wish_total: 'Total wishlist', wish_funded: 'Total funded', wish_sort: 'Sort by',
  },
  fr: {
    title: 'MONEY TIME', back: '← Retour', month: 'Mois',
    piers_income: 'Salaire mensuel Piers', canelle_income: "Revenus Canelle (auto)",
    accounts: 'Comptes', add_expense: 'Ajouter une dépense', expenses: 'Dépenses',
    budget: 'Planificateur', recurring: 'Récurrents', tips: 'Conseils du mois',
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
    rec_name: 'Nom', rec_day: 'Jour du mois', rec_total: 'Total mensuel récurrent',
    rec_add: 'Ajouter récurrent', rec_active: 'Actif', rec_this_month: '📅 Récurrents ce mois',
    rec_not_logged: 'Pas encore ajoutés ce mois',
    rec_add_all: 'Tout ajouter ce mois', rec_dismiss: 'Ignorer',
    wishlist: 'Liste de souhaits', wish_add: 'Ajouter', wish_name: 'Article',
    wish_price: 'Prix', wish_url: 'URL', wish_owner: 'Pour',
    wish_fund: 'Financer', wish_bought: 'Acheté ✓',
    wish_total: 'Total liste', wish_funded: 'Total financé', wish_sort: 'Trier par',
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

const TODAY_MONTH = format(new Date(), 'yyyy-MM')

// Months from May 2025 to current month (most recent first)
const MT_SALARY_MONTHS = (() => {
  const months = []
  let d = new Date(2025, 4, 1)
  const stop = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  while (d <= stop) { months.unshift(format(d, 'yyyy-MM')); d = new Date(d.getFullYear(), d.getMonth() + 1, 1) }
  return months
})()

const MONTH_EN = { '01':'January','02':'February','03':'March','04':'April','05':'May','06':'June','07':'July','08':'August','09':'September','10':'October','11':'November','12':'December' }
const MONTH_FR_MT = { '01':'Janvier','02':'Février','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juillet','08':'Août','09':'Septembre','10':'Octobre','11':'Novembre','12':'Décembre' }
const monthLabelMT = (ym, lang='en') => `${(lang==='en'?MONTH_EN:MONTH_FR_MT)[ym.slice(5)]} ${ym.slice(0,4)}`

export default function MoneyTime({ onBack, lang, setLang }) {
  const t = T[lang]
  const [tab, setTab] = useState('overview')
  const [currentMonth, setCurrentMonth] = useState(TODAY_MONTH)
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
  const [wishlistMT, setWishlistMT] = useState([])
  const [newWishMT, setNewWishMT] = useState({ name: '', price: '', url: '', category: '', owner: 'both' })
  const [wishlistMTSort, setWishlistMTSort] = useState('owner')
  const [wishErrorMT, setWishErrorMT] = useState(null)
  const [wishLoadingMT, setWishLoadingMT] = useState(false)
  const [newExp, setNewExp] = useState({ amount: '', category: '', account: '', desc: '', date: format(new Date(), 'yyyy-MM-dd') })
  const [newSalary, setNewSalary] = useState('')
  const [payslipLoading, setPayslipLoading] = useState(false)
  const [payslipResult, setPayslipResult] = useState(null)
  const [payslipError, setPayslipError] = useState(null)
  const payslipInputRef = useRef(null)

  // Salary history
  const [salaryHistory, setSalaryHistory] = useState([])
  // Bulk add (history tab)
  const [bulkAddRows, setBulkAddRows] = useState({})
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkSaved, setBulkSaved] = useState(0) // count of saved rows
  // Per-row save status for inline edit
  const [rowSaveStatus, setRowSaveStatus] = useState({}) // month → 'ok' | 'error:msg'
  const [editingMonth, setEditingMonth] = useState(null)
  const [editMonthValue, setEditMonthValue] = useState('')
  const [editMonthNote, setEditMonthNote] = useState('')
  const [quickAddValue, setQuickAddValue] = useState('')
  const [uploadingForMonth, setUploadingForMonth] = useState(null) // which row is using the shared file input
  const [rowPayslipLoading, setRowPayslipLoading] = useState({})
  const salaryRowPayslipRef = useRef(null)

  // Budget slices (adjustable allocations as % of income)
  const [budgetSlices, setBudgetSlices] = useState(() => {
    const saved = localStorage.getItem('mt_budget_slices')
    return saved ? JSON.parse(saved) : { savings: 15, fun: 10, tilly: 5, holidays: 5, treats: 5 }
  })
  // Custom pockets metadata (name + color, keyed by pocket_<id>)
  const [customPockets, setCustomPockets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mt_custom_pockets') || '[]') } catch { return [] }
  })
  const [showAddPocket, setShowAddPocket] = useState(false)
  const [newPocket, setNewPocket] = useState({ name: '', color: '#F49306', pct: 5 })

  // Recurring state
  const [recurring, setRecurring] = useState([])
  const [newRec, setNewRec] = useState({ name: '', amount: '', category: '', account_id: '', day_of_month: 1 })
  const [showRecBanner, setShowRecBanner] = useState(false)

  useEffect(() => { loadData() }, [currentMonth])

  useEffect(() => {
    loadRecurring()
    loadWishlistMT()
    loadSalaryHistory()
  }, [])

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

  async function loadRecurring() {
    const { data } = await supabase.from('mt_recurring').select('*').order('created_at')
    const recs = data || []
    setRecurring(recs)
    // Show banner for current month if active recurring exist and not dismissed
    const dismissed = localStorage.getItem(`mt_rec_dismissed_${TODAY_MONTH}`)
    const active = recs.filter(r => r.active)
    if (active.length > 0 && !dismissed) {
      setShowRecBanner(true)
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handlePayslipUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
    setPayslipLoading(true)
    setPayslipResult(null)
    setPayslipError(null)

    try {
      const base64 = await fileToBase64(file)
      const isPDF = file.type === 'application/pdf'
      const mediaType = file.type || (isPDF ? 'application/pdf' : 'image/jpeg')

      const contentBlock = isPDF
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : { type: 'image',    source: { type: 'base64', media_type: mediaType,          data: base64 } }

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set in .env')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 256,
          system: 'You are a payslip parser. Extract the net pay (take-home amount after all deductions) from this payslip. Respond with ONLY a JSON object like: {"net_pay": 2450.00, "gross_pay": 3200.00, "currency": "EUR", "period": "2025-06"} - nothing else, no explanation.',
          messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: 'Parse this payslip.' }] }],
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error?.message || `HTTP ${res.status}`)
      }

      const apiData = await res.json()
      const text = (apiData.content?.[0]?.text || '').trim()

      // Parse JSON — try direct parse first, then extract from text
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        const match = text.match(/\{[\s\S]*?\}/)
        if (!match) throw new Error('No JSON found in response')
        parsed = JSON.parse(match[0])
      }

      if (typeof parsed.net_pay !== 'number') throw new Error('net_pay missing from response')

      setPayslipResult(parsed)
      setNewSalary(String(Math.round(parsed.net_pay)))
    } catch (err) {
      console.error('Payslip parse error:', err)
      setPayslipError(err.message)
    } finally {
      setPayslipLoading(false)
    }
  }

  async function saveSalary() {
    const amt = parseFloat(newSalary) || 0
    await supabase.from('mt_salaries').upsert({ month: currentMonth, person: 'piers', amount: amt }, { onConflict: 'month,person' })
    setPiersSalary(amt)
  }

  // ── Salary history ──────────────────────────────────────────────────
  async function loadSalaryHistory() {
    const { data } = await supabase.from('mt_salaries')
      .select('*').eq('person', 'piers').gte('month', '2025-05')
      .order('month', { ascending: false })
    const hist = data || []
    setSalaryHistory(hist)
    // Update current month salary
    const thisMonth = hist.find(s => s.month === TODAY_MONTH)
    if (thisMonth) { setPiersSalary(thisMonth.amount); setNewSalary(thisMonth.amount.toString()) }
    // Pre-fill quickAdd with last month's salary
    const lastMonth = hist.find(s => s.month !== TODAY_MONTH)
    if (lastMonth) setQuickAddValue(lastMonth.amount.toString())
    // (onboarding removed — use the History tab to add salary data)
  }

  async function saveSalaryForMonth(month, amount, note = '') {
    const amt = parseFloat(amount) || 0
    console.log('[mt_salaries] saving row:', { month, amt })
    const { error } = await supabase.from('mt_salaries').upsert(
      { month, person: 'piers', amount: amt, notes: note || null },
      { onConflict: 'month,person' }
    )
    if (error) {
      console.error('[mt_salaries] row save failed:', error)
      setRowSaveStatus(prev => ({ ...prev, [month]: `error: ${error.message}` }))
      return
    }
    if (month === TODAY_MONTH || month === currentMonth) { setPiersSalary(amt); setNewSalary(amt.toString()) }
    setRowSaveStatus(prev => ({ ...prev, [month]: 'ok' }))
    setEditingMonth(null)
    await loadSalaryHistory()
    setTimeout(() => setRowSaveStatus(prev => { const n = {...prev}; delete n[month]; return n }), 2500)
  }

  async function deleteSalaryForMonth(month) {
    if (!window.confirm(`Supprimer le salaire de ${monthLabelMT(month, lang)} ?`)) return
    await supabase.from('mt_salaries').delete().eq('month', month).eq('person', 'piers')
    if (month === TODAY_MONTH || month === currentMonth) { setPiersSalary(0); setNewSalary('') }
    await loadSalaryHistory()
  }

  function updateBulkRow(month, value) {
    setBulkAddRows(prev => ({ ...prev, [month]: value }))
  }

  async function saveBulkSalaries() {
    setBulkError('')
    setBulkSaving(true)
    const inserts = Object.entries(bulkAddRows)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([month, v]) => ({ month, person: 'piers', amount: parseFloat(v) }))
    console.log('[mt_salaries bulk] saving', inserts.length, 'rows:', inserts)
    if (inserts.length === 0) { setBulkSaving(false); return }
    const { error } = await supabase.from('mt_salaries').upsert(inserts, { onConflict: 'month,person' })
    if (error) {
      console.error('[mt_salaries bulk] failed:', error)
      setBulkError(`${error.message} (code: ${error.code})`)
      setBulkSaving(false)
      return
    }
    setBulkSaved(inserts.length)
    setBulkAddRows({})
    setBulkSaving(false)
    await loadSalaryHistory()
    setTimeout(() => setBulkSaved(0), 3000)
  }

  function handleRowPayslipClick(month) {
    setUploadingForMonth(month)
    salaryRowPayslipRef.current?.click()
  }

  async function handleRowPayslipFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const month = uploadingForMonth
    if (!month) return
    setRowPayslipLoading(prev => ({ ...prev, [month]: true }))
    try {
      const reader = new FileReader()
      const base64 = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const isPDF = file.type === 'application/pdf'
      const block = isPDF
        ? { type:'document', source:{ type:'base64', media_type:'application/pdf', data:base64 } }
        : { type:'image',    source:{ type:'base64', media_type:file.type||'image/jpeg', data:base64 } }
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:256,
          system:'You are a payslip parser. Extract the net pay (take-home amount after all deductions). Return ONLY JSON: {"net_pay": 0000.00}',
          messages:[{ role:'user', content:[block, { type:'text', text:'Parse this payslip.' }] }] })
      })
      const apiData = await res.json()
      const text = (apiData.content?.[0]?.text || '').trim()
      const parsed = JSON.parse(text.match(/\{[\s\S]*?\}/)?.[0] || text)
      if (typeof parsed.net_pay === 'number') {
        const val = String(Math.round(parsed.net_pay))
        setEditingMonth(month)
        setEditMonthValue(val)
      }
    } catch(err) { console.error('Payslip error:', err) }
    setRowPayslipLoading(prev => ({ ...prev, [month]: false }))
    setUploadingForMonth(null)
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
    // Reload chart data
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

  // ── Recurring functions ──────────────────────────────────────

  async function addRecurring() {
    if (!newRec.name || !newRec.amount) return
    const { data } = await supabase.from('mt_recurring').insert({
      name: newRec.name,
      amount: parseFloat(newRec.amount),
      category: newRec.category || null,
      account_id: newRec.account_id || null,
      day_of_month: parseInt(newRec.day_of_month) || 1,
      active: true,
    }).select().single()
    if (data) setRecurring(prev => [...prev, data])
    setNewRec({ name: '', amount: '', category: '', account_id: '', day_of_month: 1 })
  }

  async function deleteRecurring(id) {
    await supabase.from('mt_recurring').delete().eq('id', id)
    setRecurring(prev => prev.filter(r => r.id !== id))
  }

  async function toggleRecurring(id, active) {
    await supabase.from('mt_recurring').update({ active }).eq('id', id)
    setRecurring(prev => prev.map(r => r.id === id ? { ...r, active } : r))
  }

  async function addAllRecurring() {
    const active = recurring.filter(r => r.active)
    if (active.length === 0) return
    const inserted = await Promise.all(active.map(r => {
      const day = Math.min(r.day_of_month || 1, 28)
      const date = `${currentMonth}-${String(day).padStart(2, '0')}`
      return supabase.from('mt_expenses').insert({
        amount: r.amount,
        category: r.category || 'Other',
        account_id: r.account_id || null,
        description: r.name,
        date,
      }).select().single().then(res => res.data)
    }))
    const newExps = inserted.filter(Boolean)
    setExpenses(prev => [...newExps, ...prev])
    localStorage.setItem(`mt_rec_dismissed_${TODAY_MONTH}`, '1')
    setShowRecBanner(false)
  }

  async function loadWishlistMT() {
    const { data } = await supabase.from('mt_wishlist').select('*').order('created_at')
    setWishlistMT(data || [])
  }

  async function addWishMT() {
    if (!newWishMT.name || !newWishMT.price) return
    setWishErrorMT(null)
    setWishLoadingMT(true)
    const payload = {
      name: newWishMT.name,
      price: parseFloat(newWishMT.price),
      url: newWishMT.url || null,
      category: newWishMT.category || null,
      owner: newWishMT.owner || 'both',
      funded: 0,
      purchased: false,
    }
    console.log('[mt_wishlist] inserting →', payload)
    const { data, error } = await supabase.from('mt_wishlist').insert(payload).select().single()
    console.log('[mt_wishlist] result →', { data, error })
    if (error) {
      console.error('[mt_wishlist] insert failed:', error)
      setWishErrorMT(`${error.message} (code: ${error.code})`)
      setWishLoadingMT(false)
      return
    }
    setWishlistMT(prev => [...prev, data])
    setNewWishMT({ name: '', price: '', url: '', category: '', owner: 'both' })
    setWishLoadingMT(false)
  }

  async function deleteWishMT(id) {
    await supabase.from('mt_wishlist').delete().eq('id', id)
    setWishlistMT(prev => prev.filter(w => w.id !== id))
  }

  async function markWishMTPurchased(id) {
    await supabase.from('mt_wishlist').update({ purchased: true }).eq('id', id)
    setWishlistMT(prev => prev.map(w => w.id === id ? { ...w, purchased: true } : w))
  }

  async function fundWishMT(id, amount) {
    const item = wishlistMT.find(w => w.id === id)
    if (!item) return
    const newFunded = Math.min((item.funded || 0) + (parseFloat(amount) || 0), item.price)
    await supabase.from('mt_wishlist').update({ funded: newFunded }).eq('id', id)
    setWishlistMT(prev => prev.map(w => w.id === id ? { ...w, funded: newFunded } : w))
  }

  function dismissRecBanner() {
    localStorage.setItem(`mt_rec_dismissed_${TODAY_MONTH}`, '1')
    setShowRecBanner(false)
  }

  function adjustSlice(key, newPct) {
    setBudgetSlices(prev => {
      const fixedPct = combinedIncome > 0 ? (RENT_AMOUNT + recurringTotal) / combinedIncome * 100 : 0
      const maxTotal = Math.max(0, 100 - fixedPct)
      const others = Object.keys(prev).filter(k => k !== key)
      const otherTotal = others.reduce((s, k) => s + prev[k], 0)
      const clamped = Math.max(0, newPct)
      let next = { ...prev }

      const projectedTotal = clamped + otherTotal
      if (projectedTotal > maxTotal && otherTotal > 0) {
        const excess = projectedTotal - maxTotal
        next[key] = clamped
        for (const k of others) {
          const share = prev[k] / otherTotal
          next[k] = Math.max(0, Math.round(prev[k] - excess * share))
        }
      } else {
        next[key] = Math.min(clamped, maxTotal)
      }

      localStorage.setItem('mt_budget_slices', JSON.stringify(next))
      return next
    })
  }

  function addCustomPocket() {
    if (!newPocket.name.trim()) return
    const key = `pocket_${Date.now()}`
    const meta = { key, name: newPocket.name.trim(), color: newPocket.color }
    const nextPockets = [...customPockets, meta]
    setCustomPockets(nextPockets)
    localStorage.setItem('mt_custom_pockets', JSON.stringify(nextPockets))
    setBudgetSlices(prev => {
      const next = { ...prev, [key]: newPocket.pct }
      localStorage.setItem('mt_budget_slices', JSON.stringify(next))
      return next
    })
    setNewPocket({ name: '', color: '#F49306', pct: 5 })
    setShowAddPocket(false)
  }

  function deleteCustomPocket(key) {
    const nextPockets = customPockets.filter(p => p.key !== key)
    setCustomPockets(nextPockets)
    localStorage.setItem('mt_custom_pockets', JSON.stringify(nextPockets))
    setBudgetSlices(prev => {
      const next = { ...prev }
      delete next[key]
      localStorage.setItem('mt_budget_slices', JSON.stringify(next))
      return next
    })
  }

  // ── Derived values ───────────────────────────────────────────

  // MT Wishlist derived
  const activeWishMT = wishlistMT.filter(w => !w.purchased)
  const wishMTTotal = activeWishMT.reduce((s, w) => s + w.price, 0)
  const wishMTFunded = activeWishMT.reduce((s, w) => s + (w.funded || 0), 0)
  const readyToBuyMT = activeWishMT.filter(w => (w.funded || 0) >= w.price)
  const sortedWishMT = [...activeWishMT].sort((a, b) => {
    if (wishlistMTSort === 'owner') return a.owner.localeCompare(b.owner)
    if (wishlistMTSort === 'price') return b.price - a.price
    if (wishlistMTSort === 'funded') return ((b.funded || 0) / b.price) - ((a.funded || 0) / a.price)
    return 0
  })

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const hasStaleBalance = ACCOUNTS.some(acc => {
    const updAt = balanceUpdatedAt[acc.id]
    if (!updAt) return true
    return (new Date() - new Date(updAt)) >= sevenDaysMs
  })

  const activeRecurring = recurring.filter(r => r.active)
  const recurringTotal = activeRecurring.reduce((s, r) => s + r.amount, 0)

  const combinedIncome = piersSalary + canelleIncome
  const foodExpenses = expenses.filter(e => e.category === 'Food & Groceries').reduce((s, e) => s + e.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const savingsTarget = combinedIncome * (savingsPct / 100)
  const canSpend = combinedIncome - savingsTarget - RENT_AMOUNT
  const incomeRatio = combinedIncome > 0 ? { piers: piersSalary / combinedIncome, canelle: canelleIncome / combinedIncome } : { piers: 0.5, canelle: 0.5 }

  // Detect if recurring have been logged this month (heuristic: any expense name matches a recurring name)
  const recurringNames = new Set(activeRecurring.map(r => r.name.toLowerCase()))
  const recurringLoggedThisMonth = expenses.some(e => e.description && recurringNames.has(e.description.toLowerCase()))

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

  // Salary summary derived values
  const histNet = (m) => salaryHistory.find(s => s.month === m)?.amount || 0
  const last6Salaries = MT_SALARY_MONTHS.slice(0, 6).map(m => histNet(m)).filter(v => v > 0)
  const avgSalary = last6Salaries.length > 0 ? Math.round(last6Salaries.reduce((a,b)=>a+b,0) / last6Salaries.length) : 0
  const bestSalaryMonth = [...MT_SALARY_MONTHS].sort((a,b) => histNet(b) - histNet(a))[0]
  const totalEarned = MT_SALARY_MONTHS.reduce((s,m) => s + histNet(m), 0)
  const todayNet = histNet(TODAY_MONTH)
  const prevMonthMT = MT_SALARY_MONTHS[1] || ''
  const prevNet = histNet(prevMonthMT)
  const salaryMoM = prevNet > 0 && todayNet > 0 ? Math.round((todayNet - prevNet) / prevNet * 100) : null

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

      {/* Recurring banner — shown once per month for current month */}
      {showRecBanner && currentMonth === TODAY_MONTH && !loading && (
        <div style={{ background: 'rgba(78,255,145,0.08)', borderBottom: '1px solid rgba(78,255,145,0.25)', padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, color: '#4eff91' }}>
            📅 {lang === 'en'
              ? `You have ${activeRecurring.length} recurring expense${activeRecurring.length !== 1 ? 's' : ''} totalling €${Math.round(recurringTotal)} — add them to this month?`
              : `Vous avez ${activeRecurring.length} dépense${activeRecurring.length !== 1 ? 's' : ''} récurrente${activeRecurring.length !== 1 ? 's' : ''} pour un total de €${Math.round(recurringTotal)} — les ajouter ce mois-ci ?`}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button style={{ ...S.btn, fontSize: 11, color: '#4eff91', border: '1px solid rgba(78,255,145,0.4)', background: 'rgba(78,255,145,0.1)' }} onClick={addAllRecurring}>{t.rec_add_all}</button>
            <button style={{ ...S.btn, fontSize: 11, color: 'var(--v-muted)', background: 'transparent', border: '1px solid var(--v-glass-border)' }} onClick={dismissRecBanner}>{t.rec_dismiss}</button>
          </div>
        </div>
      )}

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
        {['overview', 'accounts', 'expenses', 'recurring', 'budget', 'wishlist', 'history'].map(tab_id => (
          <button key={tab_id} style={S.navBtn(tab === tab_id)} onClick={() => setTab(tab_id)}>
            {t[tab_id] || tab_id.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            {/* Salary timing note */}
            {piersSalary === 0 && new Date().getDate() <= 6 && (
              <div style={{ background: 'rgba(106,180,255,0.08)', border: '1px solid rgba(106,180,255,0.25)', borderRadius: 8, padding: '12px 20px', fontSize: 13, color: 'var(--v-muted)' }}>
                ⏳ {lang === 'en'
                  ? "Piers' salary usually arrives by the 6th — proportional split will update automatically once entered."
                  : "Le salaire de Piers arrive généralement avant le 6 — la répartition proportionnelle se mettra à jour automatiquement."}
              </div>
            )}
            {/* Shared file input for per-row payslip scanning */}
            <input ref={salaryRowPayslipRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={handleRowPayslipFile}/>

            {/* ── SALARY HISTORY TABLE ── */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 14 }}>{lang === 'en' ? 'Salary history — Piers' : 'Historique salaire — Piers'}</div>

              {/* Quick-add current month */}
              <div style={{ background: 'rgba(106,180,255,0.1)', border: '1px solid rgba(106,180,255,0.3)', borderRadius: 6, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--v-accent)', fontWeight: 600 }}>
                  {lang === 'en' ? 'Current month:' : 'Mois actuel :'} {monthLabelMT(TODAY_MONTH, lang)}
                </div>
                <input style={{ ...S.input, width: 120, fontSize: 13 }} type="number"
                  value={quickAddValue} onChange={e => setQuickAddValue(e.target.value)}
                  placeholder={prevNet > 0 ? `€${Math.round(prevNet)} (suggestion)` : '€ 0'}/>
                <button style={{ ...S.btn, fontSize: 11, padding: '6px 14px', whiteSpace: 'nowrap' }}
                  onClick={() => { saveSalaryForMonth(TODAY_MONTH, quickAddValue); setQuickAddValue('') }}>
                  💾 {lang === 'en' ? 'Save' : 'Enregistrer'}
                </button>
                <button onClick={() => handleRowPayslipClick(TODAY_MONTH)} disabled={!!rowPayslipLoading[TODAY_MONTH]}
                  style={{ ...S.btn, fontSize: 11, padding: '6px 10px', background: 'transparent', border: '1px solid rgba(106,180,255,0.4)', color: 'var(--v-accent)', opacity: rowPayslipLoading[TODAY_MONTH] ? 0.5 : 1 }}>
                  {rowPayslipLoading[TODAY_MONTH] ? '⏳' : '📄'}
                </button>
              </div>

              {/* History table */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr>
                    {['Month','Net salary','Notes',''].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid var(--v-glass-border)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v-muted)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {MT_SALARY_MONTHS.map(ym => {
                      const entry = salaryHistory.find(s => s.month === ym)
                      const isEditing = editingMonth === ym
                      const isLoading = !!rowPayslipLoading[ym]
                      return (
                        <tr key={ym} style={{ borderBottom: '1px solid rgba(106,180,255,0.06)' }}>
                          <td style={{ padding: '9px 10px', color: ym === TODAY_MONTH ? 'var(--v-accent)' : 'var(--v-text)', fontWeight: ym === TODAY_MONTH ? 600 : 400 }}>
                            {monthLabelMT(ym, lang)}{ym === TODAY_MONTH ? ' ●' : ''}
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            {isEditing ? (
                              <input style={{ ...S.input, width: 110, fontSize: 13 }} type="number" autoFocus
                                value={editMonthValue} onChange={e => setEditMonthValue(e.target.value)}
                                onKeyDown={e => { if(e.key==='Enter') saveSalaryForMonth(ym, editMonthValue, editMonthNote); if(e.key==='Escape') setEditingMonth(null) }}/>
                            ) : (
                              <span style={{ color: entry ? 'var(--v-green)' : 'var(--v-muted)', fontFamily: entry ? 'var(--font-vista)' : 'inherit', fontSize: entry ? 18 : 13 }}>
                                {entry ? `€${Math.round(entry.amount).toLocaleString()}` : '—'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '9px 10px', color: 'var(--v-muted)', fontSize: 12 }}>
                            {isEditing ? (
                              <input style={{ ...S.input, width: 120, fontSize: 12 }} placeholder="Payslip"
                                value={editMonthNote} onChange={e => setEditMonthNote(e.target.value)}/>
                            ) : (
                              <span>{entry?.notes || (entry ? '' : '')}</span>
                            )}
                          </td>
                          <td style={{ padding: '9px 6px', whiteSpace: 'nowrap' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button style={{ ...S.btn, padding: '4px 10px', fontSize: 11 }} onClick={() => saveSalaryForMonth(ym, editMonthValue, editMonthNote)}>💾</button>
                                <button style={{ ...S.btn, background: 'transparent', color: 'var(--v-muted)', padding: '4px 8px', fontSize: 11 }} onClick={() => setEditingMonth(null)}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {!entry && (
                                  <button style={{ ...S.btn, padding: '3px 10px', fontSize: 11, background: 'rgba(106,180,255,0.15)', color: 'var(--v-accent)', border: '1px solid rgba(106,180,255,0.3)' }}
                                    onClick={() => { setEditingMonth(ym); setEditMonthValue(''); setEditMonthNote('') }}>
                                    Ajouter ▶
                                  </button>
                                )}
                                {entry && <button onClick={() => { setEditingMonth(ym); setEditMonthValue(String(Math.round(entry.amount))); setEditMonthNote(entry.notes||'') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 }}>✏️</button>}
                                {entry && <button onClick={() => deleteSalaryForMonth(ym)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 }}>🗑️</button>}
                                <button onClick={() => handleRowPayslipClick(ym)} disabled={isLoading}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, opacity: isLoading ? 0.5 : 0.6 }}>
                                  {isLoading ? '⏳' : '📄'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Salary summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--v-glass-border)' }}>
                {[
                  { label: lang==='en'?'Avg (6 months)':'Moy. 6 mois', val: avgSalary > 0 ? `€${avgSalary.toLocaleString()}` : '—', color: 'var(--v-accent)' },
                  { label: lang==='en'?'Best month':'Meilleur mois', val: bestSalaryMonth && histNet(bestSalaryMonth) > 0 ? `€${Math.round(histNet(bestSalaryMonth)).toLocaleString()}` : '—', sub: bestSalaryMonth && histNet(bestSalaryMonth) > 0 ? monthLabelMT(bestSalaryMonth, lang).slice(0,8) : '', color: 'var(--v-green)' },
                  { label: lang==='en'?'Total since May 25':'Total depuis mai 25', val: totalEarned > 0 ? `€${Math.round(totalEarned).toLocaleString()}` : '—', color: 'var(--v-text)' },
                  { label: lang==='en'?'Month vs prev':'Mois vs précédent', val: salaryMoM !== null ? `${salaryMoM>=0?'+':''}${salaryMoM}%` : '—', color: salaryMoM === null ? 'var(--v-muted)' : salaryMoM >= 0 ? 'var(--v-green)' : 'var(--v-red)' },
                ].map(({ label, val, color, sub }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: 'var(--v-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-vista)', fontSize: 18, color }}>{val}</div>
                    {sub && <div style={{ fontSize: 10, color: 'var(--v-muted)', marginTop: 2 }}>{sub}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

            {/* Recurring this month card */}
            {activeRecurring.length > 0 && (
              <div style={{ ...S.card, borderColor: recurringLoggedThisMonth ? 'rgba(78,255,145,0.2)' : 'rgba(255,204,68,0.25)', background: recurringLoggedThisMonth ? 'rgba(78,255,145,0.04)' : 'rgba(255,204,68,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ ...S.label, color: recurringLoggedThisMonth ? 'rgba(78,255,145,0.6)' : 'var(--v-amber)' }}>{t.rec_this_month}</div>
                    <div style={{ fontFamily: 'var(--font-vista)', fontSize: 26, color: recurringLoggedThisMonth ? 'var(--v-green)' : 'var(--v-amber)', marginTop: 4 }}>
                      €{Math.round(recurringTotal).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--v-muted)', marginTop: 6 }}>
                      {activeRecurring.length} {lang === 'en' ? 'active recurring expenses' : 'dépenses récurrentes actives'}
                      {!recurringLoggedThisMonth && currentMonth === TODAY_MONTH && (
                        <span style={{ color: 'var(--v-amber)', marginLeft: 8 }}>· {t.rec_not_logged}</span>
                      )}
                    </div>
                  </div>
                  {!recurringLoggedThisMonth && currentMonth === TODAY_MONTH && (
                    <button style={{ ...S.btn, fontSize: 11, color: 'var(--v-amber)', border: '1px solid rgba(255,204,68,0.4)', background: 'rgba(255,204,68,0.1)' }} onClick={addAllRecurring}>{t.rec_add_all}</button>
                  )}
                </div>
              </div>
            )}

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

        {/* ── RECURRING TAB ── */}
        {tab === 'recurring' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">

            {/* Total card */}
            <div style={{ ...S.card, borderColor: 'rgba(78,255,145,0.2)', background: 'rgba(78,255,145,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ ...S.label, color: 'rgba(78,255,145,0.6)' }}>{t.rec_total}</div>
                  <div style={{ fontFamily: 'var(--font-vista)', fontSize: 32, color: 'var(--v-green)', marginTop: 4 }}>
                    €{Math.round(recurringTotal).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--v-muted)', marginTop: 6 }}>
                    {activeRecurring.length} {lang === 'en' ? 'active' : 'actifs'} / {recurring.length} {lang === 'en' ? 'total' : 'total'}
                  </div>
                </div>
                <button style={{ ...S.btn, fontSize: 11, color: '#4eff91', border: '1px solid rgba(78,255,145,0.4)', background: 'rgba(78,255,145,0.1)' }} onClick={addAllRecurring}>{t.rec_add_all}</button>
              </div>
            </div>

            {/* Add form */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 12 }}>+ {t.rec_add}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.rec_name}</div>
                  <input style={S.input} placeholder={lang === 'en' ? 'e.g. Netflix' : 'ex. Netflix'} value={newRec.name} onChange={e => setNewRec(p => ({ ...p, name: e.target.value }))}/>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.amount}</div>
                  <input style={S.input} type="number" placeholder="€" value={newRec.amount} onChange={e => setNewRec(p => ({ ...p, amount: e.target.value }))}/>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.category}</div>
                  <select style={S.input} value={newRec.category} onChange={e => setNewRec(p => ({ ...p, category: e.target.value }))}>
                    <option value="">--</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.account}</div>
                  <select style={S.input} value={newRec.account_id} onChange={e => setNewRec(p => ({ ...p, account_id: e.target.value }))}>
                    <option value="">--</option>
                    {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.rec_day}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={S.input} type="number" min="1" max="28" value={newRec.day_of_month} onChange={e => setNewRec(p => ({ ...p, day_of_month: e.target.value }))}/>
                    <button style={S.btn} onClick={addRecurring}>{t.add}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recurring list */}
            <div style={S.card}>
              {recurring.length === 0 ? (
                <div style={{ color: 'var(--v-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                  {lang === 'en' ? 'No recurring expenses yet' : 'Aucune dépense récurrente'}
                </div>
              ) : recurring.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(106,180,255,0.08)', fontSize: 13, opacity: r.active ? 1 : 0.45 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1 }}>
                    <div style={{ color: 'var(--v-text)', fontWeight: 600 }}>{r.name}</div>
                    {r.category && <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: 'rgba(106,180,255,0.1)', color: 'var(--v-accent)' }}>{r.category}</div>}
                    {r.account_id && <div style={{ fontSize: 11, color: 'var(--v-muted)' }}>{ACCOUNTS.find(a => a.id === r.account_id)?.name || r.account_id}</div>}
                    <div style={{ fontSize: 11, color: 'var(--v-muted)' }}>
                      {lang === 'en' ? `day ${r.day_of_month}` : `jour ${r.day_of_month}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ color: 'var(--v-amber)', fontFamily: 'var(--font-vista)', fontSize: 18 }}>€{r.amount}</div>
                    {/* Active toggle */}
                    <button
                      onClick={() => toggleRecurring(r.id, !r.active)}
                      title={r.active ? (lang === 'en' ? 'Deactivate' : 'Désactiver') : (lang === 'en' ? 'Activate' : 'Activer')}
                      style={{ background: r.active ? 'rgba(78,255,145,0.15)' : 'rgba(0,0,0,0.3)', border: `1px solid ${r.active ? 'rgba(78,255,145,0.4)' : 'var(--v-glass-border)'}`, borderRadius: 4, padding: '3px 10px', color: r.active ? '#4eff91' : 'var(--v-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                    >{r.active ? '● ON' : '○ OFF'}</button>
                    <button
                      onClick={() => deleteRecurring(r.id)}
                      style={{ background: 'rgba(255,78,78,0.1)', border: '1px solid rgba(255,78,78,0.3)', borderRadius: 4, padding: '3px 8px', color: 'var(--v-red)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BUDGET TAB ── */}
        {tab === 'budget' && (
          <BudgetPie
            combinedIncome={combinedIncome}
            recurringTotal={recurringTotal}
            budgetSlices={budgetSlices}
            adjustSlice={adjustSlice}
            customPockets={customPockets}
            showAddPocket={showAddPocket}
            setShowAddPocket={setShowAddPocket}
            newPocket={newPocket}
            setNewPocket={setNewPocket}
            addCustomPocket={addCustomPocket}
            deleteCustomPocket={deleteCustomPocket}
            S={S}
            lang={lang}
          />
        )}

        {/* ── WISHLIST TAB ── */}
        {tab === 'wishlist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">

            {/* Ready-to-buy banners */}
            {readyToBuyMT.map(item => (
              <div key={item.id} style={{ background: 'rgba(78,255,145,0.08)', border: '1px solid rgba(78,255,145,0.4)', borderRadius: 6, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: 'var(--v-green)', fontSize: 13, fontWeight: 600 }}>
                  🎉 {item.name} — {lang === 'en' ? 'ready to buy!' : 'prêt à acheter !'}
                </div>
                {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, textDecoration: 'none', fontSize: 11, padding: '5px 12px' }}>{lang === 'en' ? 'View →' : 'Voir →'}</a>}
              </div>
            ))}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={S.card}>
                <div style={S.label}>{t.wish_total}</div>
                <div style={{ fontFamily: 'var(--font-vista)', fontSize: 28, color: 'var(--v-text)', marginTop: 6 }}>€{Math.round(wishMTTotal).toLocaleString()}</div>
              </div>
              <div style={S.card}>
                <div style={S.label}>{t.wish_funded}</div>
                <div style={{ fontFamily: 'var(--font-vista)', fontSize: 28, color: 'var(--v-green)', marginTop: 6 }}>€{Math.round(wishMTFunded).toLocaleString()}</div>
              </div>
            </div>

            {/* Add form */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 12 }}>+ {t.wish_add}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.wish_name}</div>
                  <input style={S.input} placeholder={lang === 'en' ? 'e.g. Weekend in Paris' : 'ex. Week-end à Paris'} value={newWishMT.name} onChange={e => setNewWishMT(p => ({ ...p, name: e.target.value }))}/>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.wish_price}</div>
                  <input style={S.input} type="number" placeholder="€" value={newWishMT.price} onChange={e => setNewWishMT(p => ({ ...p, price: e.target.value }))}/>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.wish_owner}</div>
                  <select style={S.input} value={newWishMT.owner} onChange={e => setNewWishMT(p => ({ ...p, owner: e.target.value }))}>
                    <option value="both">👫 Both</option>
                    <option value="piers">👨 Piers</option>
                    <option value="canelle">👩 Canelle</option>
                  </select>
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.category}</div>
                  <input style={S.input} placeholder={lang === 'en' ? 'e.g. Holiday' : 'ex. Vacances'} value={newWishMT.category} onChange={e => setNewWishMT(p => ({ ...p, category: e.target.value }))}/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.label, marginBottom: 4 }}>{t.wish_url}</div>
                  <input style={S.input} placeholder="https://..." value={newWishMT.url} onChange={e => setNewWishMT(p => ({ ...p, url: e.target.value }))}/>
                </div>
                <button
                  style={{ ...S.btn, alignSelf: 'flex-end', opacity: wishLoadingMT ? 0.6 : 1 }}
                  onClick={addWishMT}
                  disabled={wishLoadingMT}
                >
                  {wishLoadingMT ? (lang === 'en' ? 'Adding…' : 'Ajout…') : t.add}
                </button>
              </div>
            </div>

            {/* Wishlist error display */}
            {wishErrorMT && (
              <div style={{ background: 'rgba(255,78,78,0.08)', border: '1px solid rgba(255,78,78,0.35)', borderRadius: 6, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--v-red)', marginBottom: 6 }}>
                  ⚠ {lang === 'en' ? 'Failed to add item — Supabase error:' : 'Échec d\'ajout — Erreur Supabase :'}
                </div>
                <div style={{ fontSize: 11, color: '#ff8080', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', marginBottom: 6 }}>
                  {wishErrorMT}
                </div>
                <div style={{ fontSize: 11, color: 'var(--v-muted)', lineHeight: 1.6 }}>
                  {lang === 'en'
                    ? 'If this says "relation does not exist", run the SQL from supabase_schema.sql in your Supabase SQL Editor to create the mt_wishlist table.'
                    : 'Si l\'erreur mentionne "relation does not exist", exécutez le SQL de supabase_schema.sql dans Supabase pour créer la table mt_wishlist.'}
                </div>
                <button
                  onClick={() => setWishErrorMT(null)}
                  style={{ marginTop: 8, fontSize: 11, color: 'var(--v-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'var(--font-mono)' }}
                >
                  {lang === 'en' ? 'Dismiss' : 'Fermer'}
                </button>
              </div>
            )}

            {/* Sort controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--v-muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t.wish_sort}:</span>
              {['owner', 'price', 'funded'].map(s => (
                <button key={s} onClick={() => setWishlistMTSort(s)} style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  background: wishlistMTSort === s ? 'rgba(106,180,255,0.2)' : 'transparent',
                  color: wishlistMTSort === s ? 'var(--v-accent)' : 'var(--v-muted)',
                  border: '1px solid rgba(106,180,255,0.3)'
                }}>{s}</button>
              ))}
            </div>

            {/* Item cards */}
            {sortedWishMT.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: 'var(--v-muted)', fontSize: 13, padding: 32 }}>
                {lang === 'en' ? 'No items yet — add a shared goal above!' : 'Liste vide — ajoutez un objectif commun !'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {sortedWishMT.map(item => (
                  <MTWishCard key={item.id} item={item} onMarkBought={markWishMTPurchased} onDelete={deleteWishMT} onFund={fundWishMT} S={S} lang={lang}/>
                ))}
              </div>
            )}

            {/* Purchased items */}
            {wishlistMT.some(w => w.purchased) && (
              <div style={S.card}>
                <div style={{ ...S.label, marginBottom: 12 }}>✓ {lang === 'en' ? 'Purchased' : 'Achetés'}</div>
                {wishlistMT.filter(w => w.purchased).map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(106,180,255,0.08)', fontSize: 13, opacity: 0.45 }}>
                    <span style={{ textDecoration: 'line-through', color: 'var(--v-muted)' }}>{item.name}</span>
                    <span>€{item.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB — Piers salary ── */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
            {/* Shared file input for per-row payslip scan */}
            <input ref={salaryRowPayslipRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleRowPayslipFile}/>

            {/* Title */}
            <div style={{ ...S.card, borderColor: 'rgba(106,180,255,0.3)' }}>
              <div style={{ fontFamily: 'var(--font-vista)', fontSize: 22, color: 'var(--v-accent)', marginBottom: 4 }}>📋 PIERS SALARY HISTORY</div>
              <div style={{ fontSize: 12, color: 'var(--v-muted)' }}>Net salary · May 2025 — present · All edits saved to Supabase</div>
            </div>

            {/* ── BULK ADD section ── */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 14 }}>⚡ {lang === 'en' ? 'Bulk add — fill all months at once' : 'Ajout en masse'}</div>

              {/* Error */}
              {bulkError && (
                <div style={{ background: 'rgba(255,78,78,0.08)', border: '1px solid rgba(255,78,78,0.35)', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--v-red)', fontWeight: 600 }}>⚠ Save failed: {bulkError}</div>
                  <button onClick={() => setBulkError('')} style={{ fontSize: 10, color: 'var(--v-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-mono)', marginTop: 4 }}>Dismiss</button>
                </div>
              )}
              {/* Success */}
              {bulkSaved > 0 && (
                <div style={{ background: 'rgba(78,255,145,0.08)', border: '1px solid rgba(78,255,145,0.3)', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--v-green)', fontWeight: 600 }}>✅ {bulkSaved} month{bulkSaved !== 1 ? 's' : ''} saved successfully</div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
                {MT_SALARY_MONTHS.slice().reverse().map(ym => (
                  <div key={ym}>
                    <div style={{ ...S.label, marginBottom: 4, fontSize: 10 }}>{monthLabelMT(ym, lang)}</div>
                    <input
                      type="number"
                      style={{ ...S.input, fontSize: 13 }}
                      value={bulkAddRows[ym] || ''}
                      onChange={e => updateBulkRow(ym, e.target.value)}
                      placeholder="€ 0"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={saveBulkSalaries}
                disabled={bulkSaving}
                style={{ ...S.btn, opacity: bulkSaving ? 0.6 : 1 }}>
                {bulkSaving ? '⏳ Saving…' : '💾 Save all'}
              </button>
            </div>

            {/* ── HISTORY TABLE ── */}
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom: 14 }}>
                {lang === 'en' ? 'Salary history' : 'Historique salaire'}
                <span style={{ color: 'var(--v-muted)', marginLeft: 12, fontWeight: 400 }}>
                  {salaryHistory.length} {lang === 'en' ? 'months recorded' : 'mois enregistrés'}
                </span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Month', 'Net Salary (€)', 'Notes', 'Last Updated', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--v-glass-border)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MT_SALARY_MONTHS.map(ym => {
                    const entry = salaryHistory.find(s => s.month === ym)
                    const isEditing = editingMonth === ym
                    const status = rowSaveStatus[ym]
                    return (
                      <tr key={ym} style={{ borderBottom: '1px solid rgba(106,180,255,0.06)', background: ym === TODAY_MONTH ? 'rgba(106,180,255,0.04)' : 'transparent' }}>
                        <td style={{ padding: '10px 10px', color: ym === TODAY_MONTH ? 'var(--v-accent)' : 'var(--v-text)', fontWeight: ym === TODAY_MONTH ? 600 : 400, whiteSpace: 'nowrap' }}>
                          {monthLabelMT(ym, lang)}{ym === TODAY_MONTH ? ' ●' : ''}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          {isEditing ? (
                            <input
                              type="number"
                              autoFocus
                              style={{ ...S.input, width: 120, fontSize: 14 }}
                              value={editMonthValue}
                              onChange={e => setEditMonthValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveSalaryForMonth(ym, editMonthValue, editMonthNote); if (e.key === 'Escape') setEditingMonth(null) }}
                            />
                          ) : (
                            <span style={{ fontFamily: entry ? 'var(--font-vista)' : 'inherit', fontSize: entry ? 18 : 13, color: entry ? 'var(--v-green)' : 'var(--v-muted)' }}>
                              {entry ? `€${Math.round(entry.amount).toLocaleString()}` : '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--v-muted)', fontSize: 12 }}>
                          {isEditing ? (
                            <input style={{ ...S.input, width: 120, fontSize: 12 }} placeholder="Payslip" value={editMonthNote} onChange={e => setEditMonthNote(e.target.value)}/>
                          ) : entry?.notes || ''}
                        </td>
                        <td style={{ padding: '10px 10px', color: 'var(--v-muted)', fontSize: 11 }}>
                          {entry?.updated_at?.slice(0, 10) || '—'}
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          {/* Status indicators */}
                          {status === 'ok' && <span style={{ color: 'var(--v-green)', marginRight: 6, fontSize: 14 }}>✅</span>}
                          {status?.startsWith('error:') && (
                            <span style={{ color: 'var(--v-red)', fontSize: 11, marginRight: 6 }}>⚠ {status.slice(6)}</span>
                          )}
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button style={{ ...S.btn, padding: '4px 12px', fontSize: 12 }} onClick={() => saveSalaryForMonth(ym, editMonthValue, editMonthNote)}>💾</button>
                              <button style={{ ...S.btn, background: 'transparent', color: 'var(--v-muted)', border: '1px solid var(--v-glass-border)', padding: '4px 8px', fontSize: 12 }} onClick={() => { setEditingMonth(null); setRowSaveStatus(p => { const n={...p}; delete n[ym]; return n }) }}>✕</button>
                              <button onClick={() => handleRowPayslipClick(ym)} disabled={!!rowPayslipLoading[ym]}
                                style={{ ...S.btn, background: 'rgba(106,180,255,0.15)', border: '1px solid rgba(106,180,255,0.3)', color: 'var(--v-accent)', padding: '4px 8px', fontSize: 12, opacity: rowPayslipLoading[ym] ? 0.5 : 1 }}>
                                {rowPayslipLoading[ym] ? '⏳' : '📄'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              {!entry && (
                                <button style={{ ...S.btn, padding: '3px 10px', fontSize: 11, background: 'rgba(106,180,255,0.12)', color: 'var(--v-accent)', border: '1px solid rgba(106,180,255,0.3)' }}
                                  onClick={() => { setEditingMonth(ym); setEditMonthValue(''); setEditMonthNote('') }}>
                                  Add ▶
                                </button>
                              )}
                              {entry && (
                                <>
                                  <button onClick={() => { setEditingMonth(ym); setEditMonthValue(String(Math.round(entry.amount))); setEditMonthNote(entry.notes || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: 0.7 }}>✏️</button>
                                  <button onClick={() => deleteSalaryForMonth(ym)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, opacity: 0.7 }}>🗑️</button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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

// ── SVG donut pie helpers ───────────────────────────────────────────────
function pxy(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutArc(cx, cy, outerR, innerR, startDeg, endDeg) {
  const span = endDeg - startDeg
  if (span >= 359.9) { endDeg = startDeg + 359.9 }
  const s = pxy(cx, cy, outerR, startDeg)
  const e = pxy(cx, cy, outerR, endDeg)
  const si = pxy(cx, cy, innerR, endDeg)
  const ei = pxy(cx, cy, innerR, startDeg)
  const lg = span > 180 ? 1 : 0
  return `M${s.x},${s.y} A${outerR},${outerR} 0 ${lg} 1 ${e.x},${e.y} L${si.x},${si.y} A${innerR},${innerR} 0 ${lg} 0 ${ei.x},${ei.y} Z`
}

const SLICE_META = {
  rent:      { label: 'Rent',      color: '#555',    fixed: true },
  recurring: { label: 'Recurring', color: '#444',    fixed: true },
  savings:   { label: 'Savings',   color: '#6DB8BE', fixed: false },
  fun:       { label: 'Fun',       color: '#F49306', fixed: false },
  tilly:     { label: 'Tilly',     color: '#E0858E', fixed: false },
  holidays:  { label: 'Holidays',  color: '#A5BB1A', fixed: false },
  treats:    { label: 'Treats',    color: '#ffcc44', fixed: false },
}

const isMonthEnd = new Date().getDate() >= 25

const POCKET_PRESET_COLORS = ['#F49306','#E0858E','#A5BB1A','#6DB8BE','#ffcc44','#9b59b6']

function BudgetPie({ combinedIncome = 0, recurringTotal = 0, budgetSlices = {}, adjustSlice, customPockets = [], showAddPocket, setShowAddPocket, newPocket, setNewPocket, addCustomPocket, deleteCustomPocket, S, lang }) {
  // Guard: render nothing if critical helpers missing
  if (!adjustSlice || !S) return null
  const safeIncome = combinedIncome || 0
  const safeRecurring = recurringTotal || 0
  const rentPct  = safeIncome > 0 ? (RENT_AMOUNT  / safeIncome) * 100 : 0
  const recPct   = safeIncome > 0 ? (safeRecurring / safeIncome) * 100 : 0
  const adjTotal = Object.values(budgetSlices).reduce((s, v) => s + (Number(v) || 0), 0)
  const totalUsed = rentPct + recPct + adjTotal
  const unallocated = Math.max(0, 100 - totalUsed)
  const overBudget = totalUsed > 100

  // Build all slices — safe lookup: custom pocket keys won't be in SLICE_META
  const allSlices = [
    { key: 'rent',      pct: rentPct,  ...SLICE_META.rent },
    { key: 'recurring', pct: recPct,   ...SLICE_META.recurring },
    ...Object.entries(budgetSlices).map(([k, v]) => {
      const customMeta = (customPockets || []).find(p => p.key === k)
      const builtIn = SLICE_META[k]
      const meta = builtIn || (customMeta ? { label: customMeta.name, color: customMeta.color, fixed: false } : { label: k, color: '#888', fixed: false })
      return { key: k, pct: Number(v) || 0, ...meta }
    }),
    { key: 'unalloc', pct: unallocated, label: 'Free', color: '#1a2744', fixed: true },
  ]

  // Build SVG arcs — guard against NaN angles
  const CX = 120, CY = 120, OR = 100, IR = 60
  let angle = 0
  const arcs = allSlices.map(sl => {
    const span = (sl.pct / 100) * 360
    const path = span > 0.5 ? donutArc(CX, CY, OR, IR, angle, angle + span - 1) : null
    const mid = angle + span / 2
    const labelPt = pxy(CX, CY, (OR + IR) / 2, mid)
    angle += span
    return { ...sl, path, span, labelPt }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="page-enter">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Pie chart */}
        <div style={{ ...S.card, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 260 }}>
          <div style={{ ...S.label, marginBottom: 16 }}>{lang === 'en' ? 'Income allocation' : 'Répartition des revenus'}</div>
          <svg width="240" height="240" viewBox="0 0 240 240">
            {arcs.map(sl => sl.path && (
              <path key={sl.key} d={sl.path} fill={sl.color} stroke="#1a2744" strokeWidth="2"/>
            ))}
            {/* centre label */}
            <text x="120" y="115" textAnchor="middle" fill="#c8e0ff" fontSize="11" fontFamily="Share Tech Mono">
              {lang === 'en' ? 'TOTAL' : 'TOTAL'}
            </text>
            <text x="120" y="132" textAnchor="middle" fill={overBudget ? '#ff4e4e' : '#4eff91'} fontSize="18" fontFamily="VT323" fontWeight="700">
              {Math.round(totalUsed)}%
            </text>
          </svg>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: overBudget ? '#ff4e4e' : '#4eff91', textAlign: 'center' }}>
            {overBudget
              ? `⚠ Over budget (${Math.round(totalUsed - 100)}% excess)`
              : `✓ ${Math.round(unallocated)}% unallocated (€${Math.round(safeIncome * unallocated / 100).toLocaleString()})`}
          </div>
          {combinedIncome === 0 && (
            <div style={{ fontSize: 11, color: 'var(--v-muted)', marginTop: 6, textAlign: 'center' }}>
              {lang === 'en' ? 'Enter income to see % amounts' : 'Entrez un revenu pour voir les montants'}
            </div>
          )}
        </div>

        {/* Adjustable slices */}
        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Fixed */}
          <div style={{ ...S.card, padding: 16 }}>
            <div style={{ ...S.label, marginBottom: 10 }}>{lang === 'en' ? 'Fixed (cannot adjust)' : 'Fixes (non modifiables)'}</div>
            {[
              { key: 'rent', label: `Rent`, pct: rentPct, amt: RENT_AMOUNT },
              { key: 'recurring', label: `Recurring`, pct: recPct, amt: recurringTotal },
            ].map(sl => (
              <div key={sl.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: SLICE_META[sl.key].color, flexShrink: 0 }}/>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--v-muted)' }}>{sl.label}</span>
                <span style={{ fontSize: 12, color: 'var(--v-muted)' }}>€{Math.round(sl.amt).toLocaleString()}</span>
                <span style={{ fontSize: 12, color: 'var(--v-muted)', minWidth: 38, textAlign: 'right' }}>{Math.round(sl.pct)}%</span>
              </div>
            ))}
          </div>

          {/* Adjustable */}
          <div style={{ ...S.card, padding: 16 }}>
            <div style={{ ...S.label, marginBottom: 10 }}>{lang === 'en' ? 'Adjustable allocations' : 'Allocations ajustables'}</div>
            {Object.entries(budgetSlices).map(([key, pct]) => {
              const customMeta = (customPockets || []).find(p => p.key === key)
              const meta = SLICE_META[key] || (customMeta ? { label: customMeta.name, color: customMeta.color } : { label: key, color: '#888' })
              const euros = Math.round(safeIncome * pct / 100)
              return (
                <div key={key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: meta.color, flexShrink: 0 }}/>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--v-text)', fontWeight: 500 }}>{meta.label}</span>
                    {isMonthEnd && (
                      <span style={{ fontSize: 10, color: meta.color, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>💸 Transfer reminder</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--v-muted)' }}>€{euros.toLocaleString()}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => adjustSlice(key, pct - 1)}
                        style={{ ...S.btn, padding: '2px 8px', fontSize: 13, background: 'rgba(0,0,0,0.3)', color: 'var(--v-muted)', border: '1px solid var(--v-glass-border)' }}
                      >−</button>
                      <span style={{ fontSize: 14, fontWeight: 700, color: meta.color, minWidth: 38, textAlign: 'center', lineHeight: '24px' }}>{Math.round(pct)}%</span>
                      <button
                        onClick={() => adjustSlice(key, pct + 1)}
                        style={{ ...S.btn, padding: '2px 8px', fontSize: 13, background: 'rgba(0,0,0,0.3)', color: 'var(--v-muted)', border: '1px solid var(--v-glass-border)' }}
                      >+</button>
                    </div>
                  </div>
                  <input
                    type="range" min="0" max="50" value={Math.round(pct)}
                    onChange={e => adjustSlice(key, parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: meta.color }}
                  />
                </div>
              )
            })}
          </div>

          {/* Custom pockets */}
          {customPockets.length > 0 && (
            <div style={{ ...S.card, padding: 16 }}>
              <div style={{ ...S.label, marginBottom: 10 }}>{lang === 'en' ? 'Custom pockets' : 'Poches personnalisées'}</div>
              {customPockets.map(pocket => {
                const pct = budgetSlices[pocket.key] || 0
                const euros = Math.round(combinedIncome * pct / 100)
                return (
                  <div key={pocket.key} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: pocket.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--v-text)', fontWeight: 500 }}>{pocket.name}</span>
                      {isMonthEnd && <span style={{ fontSize: 10, color: pocket.color, fontFamily: 'var(--font-mono)' }}>💸 Transfer reminder</span>}
                      <span style={{ fontSize: 12, color: 'var(--v-muted)' }}>€{euros.toLocaleString()}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => adjustSlice(pocket.key, pct - 1)} style={{ ...S.btn, padding: '2px 8px', fontSize: 13, background: 'rgba(0,0,0,0.3)', color: 'var(--v-muted)', border: '1px solid var(--v-glass-border)' }}>−</button>
                        <span style={{ fontSize: 14, fontWeight: 700, color: pocket.color, minWidth: 38, textAlign: 'center', lineHeight: '24px' }}>{Math.round(pct)}%</span>
                        <button onClick={() => adjustSlice(pocket.key, pct + 1)} style={{ ...S.btn, padding: '2px 8px', fontSize: 13, background: 'rgba(0,0,0,0.3)', color: 'var(--v-muted)', border: '1px solid var(--v-glass-border)' }}>+</button>
                      </div>
                      <button onClick={() => deleteCustomPocket(pocket.key)} style={{ background: 'rgba(255,78,78,0.1)', border: '1px solid rgba(255,78,78,0.3)', borderRadius: 4, padding: '2px 8px', color: '#ff4e4e', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>×</button>
                    </div>
                    <input type="range" min="0" max="50" value={Math.round(pct)} onChange={e => adjustSlice(pocket.key, parseInt(e.target.value))} style={{ width: '100%', accentColor: pocket.color }} />
                  </div>
                )
              })}
            </div>
          )}

          {/* Add custom pocket */}
          {showAddPocket ? (
            <div style={{ ...S.card, padding: 16, borderColor: 'rgba(106,180,255,0.3)' }}>
              <div style={{ ...S.label, marginBottom: 12 }}>New custom pocket</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <input style={{ ...S.input, flex: 2, minWidth: 120 }} placeholder="Pocket name" value={newPocket.name} onChange={e => setNewPocket(p => ({ ...p, name: e.target.value }))} autoFocus />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {POCKET_PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setNewPocket(p => ({ ...p, color: c }))}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: newPocket.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: newPocket.color === c ? '2px solid var(--v-accent)' : 'none' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" min="1" max="50" value={newPocket.pct} onChange={e => setNewPocket(p => ({ ...p, pct: parseInt(e.target.value) || 1 }))} style={{ ...S.input, width: 60 }} />
                  <span style={{ color: 'var(--v-muted)', fontSize: 13 }}>%</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.btn} onClick={addCustomPocket}>{lang === 'en' ? 'Add pocket' : 'Ajouter'}</button>
                <button style={{ ...S.btn, background: 'transparent', color: 'var(--v-muted)', border: '1px solid var(--v-glass-border)' }} onClick={() => setShowAddPocket(false)}>{lang === 'en' ? 'Cancel' : 'Annuler'}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddPocket(true)} style={{ ...S.btn, background: 'rgba(106,180,255,0.1)', border: '1px solid rgba(106,180,255,0.3)', color: 'var(--v-accent)', alignSelf: 'flex-start' }}>
              ➕ {lang === 'en' ? 'Add custom pocket' : 'Ajouter une poche'}
            </button>
          )}

          {/* Summary */}
          <div style={{ ...S.card, padding: 16, borderColor: overBudget ? 'rgba(255,78,78,0.3)' : 'rgba(78,255,145,0.2)', background: overBudget ? 'rgba(255,78,78,0.04)' : 'rgba(78,255,145,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--v-text)', fontWeight: 600 }}>
                {overBudget
                  ? (lang === 'en' ? '⚠ Over budget' : '⚠ Dépassement')
                  : (lang === 'en' ? 'Remaining unallocated' : 'Non alloué restant')}
              </span>
              <span style={{ fontFamily: 'var(--font-vista)', fontSize: 18, color: overBudget ? '#ff4e4e' : '#4eff91' }}>
                {Math.round(unallocated)}% · €{Math.round(safeIncome * unallocated / 100).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
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

function MTCircleProgress({ pct, color, size = 52 }) {
  const R = (size - 6) / 2
  const C = 2 * Math.PI * R
  const offset = C - (Math.min(100, Math.max(0, pct)) / 100) * C
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

const MT_OWNER_COLORS = { piers: '#6ab4ff', canelle: '#e8001c', both: '#4eff91' }
const MT_OWNER_LABELS = { piers: '👨 PIERS', canelle: '👩 CANELLE', both: '👫 BOTH' }

function MTWishCard({ item, onMarkBought, onDelete, onFund, S, lang }) {
  const [funding, setFunding] = useState(false)
  const [fundAmt, setFundAmt] = useState('')

  const funded = item.funded || 0
  const fundedPct = Math.min(100, (funded / item.price) * 100)
  const isReady = funded >= item.price
  const oc = MT_OWNER_COLORS[item.owner] || '#aaa'

  return (
    <div style={{ ...S.card, borderColor: isReady ? 'rgba(78,255,145,0.4)' : 'var(--v-glass-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 3, background: `${oc}22`, color: oc, fontWeight: 700, letterSpacing: '0.08em' }}>
              {MT_OWNER_LABELS[item.owner] || item.owner}
            </span>
            {item.category && <span style={{ fontSize: 10, color: 'var(--v-muted)' }}>{item.category}</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v-text)' }}>{item.name}</div>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--v-accent)', textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
              🔗 {lang === 'en' ? 'View' : 'Voir'}
            </a>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-vista)', fontSize: 20, color: 'var(--v-text)', marginLeft: 12, flexShrink: 0 }}>€{item.price.toLocaleString()}</div>
      </div>

      {/* SVG circle progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <MTCircleProgress pct={fundedPct} color={isReady ? 'var(--v-green)' : 'var(--v-accent)'} size={52} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isReady ? 'var(--v-green)' : 'var(--v-accent)' }}>
            {Math.round(fundedPct)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--v-text)', fontWeight: 600 }}>€{Math.round(funded).toLocaleString()} {lang === 'en' ? 'funded' : 'financé'}</div>
          <div style={{ fontSize: 11, color: 'var(--v-muted)' }}>of €{item.price.toLocaleString()}</div>
        </div>
      </div>

      {isReady && (
        <div style={{ fontSize: 12, color: 'var(--v-green)', marginBottom: 10, fontWeight: 600 }}>
          🎉 {lang === 'en' ? 'You can buy this now!' : 'Vous pouvez acheter !'}
        </div>
      )}

      {funding ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
          <input style={S.input} type="number" value={fundAmt} onChange={e => setFundAmt(e.target.value)} placeholder="€" autoFocus/>
          <button style={S.btn} onClick={() => { onFund(item.id, fundAmt); setFundAmt(''); setFunding(false) }}>✓</button>
          <button style={{ ...S.btn, color: 'var(--v-muted)', background: 'transparent', border: '1px solid var(--v-glass-border)' }} onClick={() => setFunding(false)}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFunding(true)} style={{ ...S.btn, flex: 1, fontSize: 11, padding: '7px' }}>
            + {lang === 'en' ? 'Add funds' : 'Financer'}
          </button>
          <button onClick={() => onMarkBought(item.id)} style={{ ...S.btn, fontSize: 11, padding: '7px 10px', background: isReady ? 'rgba(78,255,145,0.15)' : 'transparent', color: isReady ? 'var(--v-green)' : 'var(--v-muted)', border: `1px solid ${isReady ? 'rgba(78,255,145,0.4)' : 'var(--v-glass-border)'}` }}>✓</button>
          <button onClick={() => onDelete(item.id)} style={{ background: 'rgba(255,78,78,0.1)', border: '1px solid rgba(255,78,78,0.3)', borderRadius: 4, padding: '7px 10px', color: 'var(--v-red)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>✕</button>
        </div>
      )}
    </div>
  )
}
