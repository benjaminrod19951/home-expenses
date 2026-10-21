-- Home Expenses Manager v24.2 — clean re-import
-- PURPOSE: remove only imported transaction data so the original bank/card files
-- can be imported again from scratch.
-- PRESERVES: households, household_members, categories, merchant_category_rules,
-- budgets, planned_items, MANUAL transactions (source='ידני'), users/auth and all schema changes.
--
-- SAFETY: this script runs only when the database currently has exactly ONE
-- household with imported data. If more than one is found, it stops instead of
-- deleting another household's information.

begin;

-- Backup the rows before deletion. Re-running the script appends another backup
-- copy, marked with the current backup timestamp.
create table if not exists public.transactions_backup_v242
as select t.*, now()::timestamptz as backup_at
from public.transactions t
where false;

create table if not exists public.import_batches_backup_v242
as select b.*, now()::timestamptz as backup_at
from public.import_batches b
where false;

do $$
declare
  target_household uuid;
  household_count integer;
begin
  select count(distinct household_id), min(household_id)
    into household_count, target_household
  from (
    select household_id from public.transactions where import_batch_id is not null or source in ('אשראי','עו״ש')
    union all
    select household_id from public.import_batches
  ) s;

  if household_count = 0 then
    raise notice 'No imported transactions/import batches found. Nothing to reset.';
    return;
  end if;

  if household_count <> 1 then
    raise exception 'Safety stop: found % households with imported data. This reset expects exactly one.', household_count;
  end if;

  insert into public.transactions_backup_v242
  select t.*, now()::timestamptz
  from public.transactions t
  where t.household_id = target_household
    and (t.import_batch_id is not null or t.source in ('אשראי','עו״ש'));

  insert into public.import_batches_backup_v242
  select b.*, now()::timestamptz
  from public.import_batches b
  where b.household_id = target_household;

  -- Transactions reference import_batches, so delete them first.
  delete from public.transactions
  where household_id = target_household
    and (import_batch_id is not null or source in ('אשראי','עו״ש'));

  delete from public.import_batches
  where household_id = target_household;

  raise notice 'Clean re-import reset completed for household %. Categories, rules, budgets and planning were preserved.', target_household;
end $$;

commit;

-- Verification: both counts should be 0 after the reset.
select 'imported_transactions' as table_name, count(*) as rows_remaining
from public.transactions
where import_batch_id is not null or source in ('אשראי','עו״ש')
union all
select 'import_batches', count(*) from public.import_batches;
