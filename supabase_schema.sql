-- ============================================================
-- P & C Finance App — Supabase Schema
-- Run this entire file in Supabase → SQL Editor → New Query
-- ============================================================

-- Monthly salaries (Piers)
create table if not exists mt_salaries (
  id         bigserial primary key,
  month      text not null,        -- 'yyyy-MM'
  person     text not null,        -- 'piers'
  amount     numeric not null default 0,
  created_at timestamptz default now(),
  unique (month, person)
);

-- Expenses
create table if not exists mt_expenses (
  id          bigserial primary key,
  amount      numeric not null,
  category    text,
  account_id  text,
  description text,
  date        date not null,
  created_at  timestamptz default now()
);

-- Account balances (manually updated)
create table if not exists mt_balances (
  id         bigserial primary key,
  account_id text not null unique,
  balance    numeric not null default 0,
  updated_at timestamptz default now()
);

-- Canelle income
create table if not exists cv_income (
  id                    bigserial primary key,
  client                text,
  amount_gross          numeric not null,
  amount_urssaf         numeric not null,
  amount_after_urssaf   numeric not null,
  amount_to_piers_wise  numeric default 0,
  amount_company        numeric default 0,
  amount_salary         numeric default 0,
  date                  date not null,
  category              text default 'bnc_services',
  description           text,
  created_at            timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────
-- Since this is a private app with a single shared password,
-- we use a simple "anon can do everything" policy.
-- The app itself handles authentication.

alter table mt_salaries  enable row level security;
alter table mt_expenses  enable row level security;
alter table mt_balances  enable row level security;
alter table cv_income    enable row level security;

create policy "allow all" on mt_salaries  for all using (true) with check (true);
create policy "allow all" on mt_expenses  for all using (true) with check (true);
create policy "allow all" on mt_balances  for all using (true) with check (true);
create policy "allow all" on cv_income    for all using (true) with check (true);
