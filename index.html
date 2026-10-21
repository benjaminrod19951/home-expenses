-- Home Expenses Manager V24
-- Run AFTER V23. Safe to run more than once.

-- 1) Future planning: expected income/expenses are kept separate from actual transactions.
create table if not exists public.planned_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null,
  plan_date date not null,
  month text not null,
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount >= 0),
  category text not null default 'אחר',
  description text not null default 'תכנון',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planned_items_household_month_idx
  on public.planned_items(household_id, month);

alter table public.planned_items enable row level security;

drop policy if exists "planned read" on public.planned_items;
drop policy if exists "planned insert" on public.planned_items;
drop policy if exists "planned update" on public.planned_items;
drop policy if exists "planned delete" on public.planned_items;

create policy "planned read" on public.planned_items for select to authenticated
  using(public.is_household_member(household_id));
create policy "planned insert" on public.planned_items for insert to authenticated
  with check(public.is_household_member(household_id) and user_id=auth.uid());
create policy "planned update" on public.planned_items for update to authenticated
  using(public.is_household_member(household_id))
  with check(public.is_household_member(household_id));
create policy "planned delete" on public.planned_items for delete to authenticated
  using(public.is_household_member(household_id));

-- 2) V23 was intentionally too conservative and put almost every incoming bank
-- credit into income_review. In V24, an ordinary incoming credit counts as income.
-- We keep likely self-transfers from Leumi, savings/deposits, and explicit internal
-- transfer descriptions out of automatic income so the user can review them.
update public.transactions
set flow_type='income',
    kind='income',
    category='הכנסה',
    count_as_expense=false,
    count_as_income=true,
    income_amount=coalesce(nullif(bank_credit,0), abs(amount)),
    manual_override=false
where source='עו״ש'
  and coalesce(manual_override,false)=false
  and coalesce(bank_credit,0) > 0
  and coalesce(flow_type,kind)='income_review'
  and lower(concat_ws(' ', merchant, bank_description)) !~
      '(בנק[[:space:]]*לאומי|לאומי[[:space:]]*לישראל|leumi|חשבון[[:space:]]*שלי|העברה[[:space:]]*עצמית|העברה.*בין|פיקדון|חיסכון|חסכון|פדיון|פירעון)';

-- 3) Ensure category-only corrections never affect counting flags.
-- No data update is needed here: the V24 app updates only category + manual_override
-- when moving expenses between categories.
