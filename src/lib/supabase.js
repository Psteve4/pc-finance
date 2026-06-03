import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// URSSAF rates for auto-entrepreneur (2024)
export const URSSAF_RATES = {
  bnc_services: 0.22,    // Services BNC (liberal professions)
  bic_services: 0.212,   // Services BIC
  commerce: 0.123,       // Sale of goods
}

export const ACCOUNTS = [
  { id: 'wise_piers',    name: 'Wise – Piers',    owner: 'piers',   type: 'wise',    color: '#00B9FF' },
  { id: 'wise_canelle',  name: 'Wise – Canelle',  owner: 'canelle', type: 'wise',    color: '#00B9FF' },
  { id: 'mono_piers',    name: 'Monobanque – Piers',    owner: 'piers',   type: 'manual',  color: '#FFD700' },
  { id: 'mono_canelle',  name: 'Monobanque – Canelle',  owner: 'canelle', type: 'manual',  color: '#FFD700' },
  { id: 'laposte',       name: 'La Poste – Canelle',    owner: 'canelle', type: 'manual',  color: '#F7A600' },
  { id: 'wise_assets',   name: 'Wise Assets – MSCI World', owner: 'piers', type: 'investment', color: '#4eff91' },
]

export const EXPENSE_CATEGORIES = [
  'Food & Groceries', 'Rent', 'Transport', 'Utilities',
  'Health', 'Entertainment', 'Clothing', 'Travel',
  'Business', 'Savings/Investment', 'Other'
]

export const RENT_AMOUNT = 800
export const FOOD_BUDGET = 400
