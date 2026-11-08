-- V9 upgrade: budgets + merchant rules (idempotent)
create table if not exists public.budgets(
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check(monthly_limit >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(household_id,category)
);
alter table public.budgets enable row level security;
drop policy if exists "budget read" on public.budgets;
drop policy if exists "budget insert" on public.budgets;
drop policy if exists "budget update" on public.budgets;
drop policy if exists "budget delete" on public.budgets;
create policy "budget read" on public.budgets for select to authenticated using(is_household_member(household_id));
create policy "budget insert" on public.budgets for insert to authenticated with check(is_household_member(household_id));
create policy "budget update" on public.budgets for update to authenticated using(is_household_member(household_id)) with check(is_household_member(household_id));
create policy "budget delete" on public.budgets for delete to authenticated using(is_household_member(household_id));

create table if not exists public.merchant_category_rules(
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_key text not null,
  merchant_label text not null,
  category text not null,
  created_at timestamptz default now(),
  unique(household_id,merchant_key)
);
alter table public.merchant_category_rules enable row level security;
drop policy if exists "merchant rule read" on public.merchant_category_rules;
drop policy if exists "merchant rule insert" on public.merchant_category_rules;
drop policy if exists "merchant rule update" on public.merchant_category_rules;
drop policy if exists "merchant rule delete" on public.merchant_category_rules;
create policy "merchant rule read" on public.merchant_category_rules for select to authenticated using(is_household_member(household_id));
create policy "merchant rule insert" on public.merchant_category_rules for insert to authenticated with check(is_household_member(household_id));
create policy "merchant rule update" on public.merchant_category_rules for update to authenticated using(is_household_member(household_id)) with check(is_household_member(household_id));
create policy "merchant rule delete" on public.merchant_category_rules for delete to authenticated using(is_household_member(household_id));
