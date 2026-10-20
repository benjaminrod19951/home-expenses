-- V11/V12 source-audit migration.
-- Keeps the original imported totals independent from editable transaction rows.
create table if not exists public.import_batches(
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_key text not null,
  source text not null,
  source_total numeric(14,2) not null default 0,
  source_expense_total numeric(14,2) not null default 0,
  source_expense_count integer not null default 0,
  row_count integer not null default 0,
  month_totals jsonb not null default '{}'::jsonb,
  month_expense_totals jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(household_id,file_key)
);

alter table public.import_batches enable row level security;
drop policy if exists "import batch read" on public.import_batches;
drop policy if exists "import batch insert" on public.import_batches;
drop policy if exists "import batch update" on public.import_batches;
drop policy if exists "import batch delete" on public.import_batches;
create policy "import batch read" on public.import_batches for select to authenticated using(is_household_member(household_id));
create policy "import batch insert" on public.import_batches for insert to authenticated with check(is_household_member(household_id) and user_id=auth.uid());
create policy "import batch update" on public.import_batches for update to authenticated using(is_household_member(household_id)) with check(is_household_member(household_id));
create policy "import batch delete" on public.import_batches for delete to authenticated using(is_household_member(household_id));

alter table public.transactions add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;
create index if not exists transactions_import_batch_idx on public.transactions(import_batch_id);
