-- V8: persistent merchant/category rules for the shared household.
-- Run this once in Supabase SQL Editor.
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

create policy "merchant rule read" on public.merchant_category_rules
for select to authenticated
using(is_household_member(household_id));

create policy "merchant rule insert" on public.merchant_category_rules
for insert to authenticated
with check(is_household_member(household_id));

create policy "merchant rule update" on public.merchant_category_rules
for update to authenticated
using(is_household_member(household_id))
with check(is_household_member(household_id));

create policy "merchant rule delete" on public.merchant_category_rules
for delete to authenticated
using(is_household_member(household_id));
