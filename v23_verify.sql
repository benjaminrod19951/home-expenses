-- Home Expenses Manager V24.8
-- Run once after any V24.x version. Safe to run again.

-- V24.3 introduced categories.is_primary, but the original categories RLS only
-- allowed SELECT / INSERT / DELETE. Without UPDATE permission the dashboard
-- category selector could appear to change and then immediately revert.

drop policy if exists "cat update" on public.categories;
create policy "cat update" on public.categories
for update to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

-- Keep the preference column/indexes present even if V24.3 SQL was skipped.
alter table public.categories
  add column if not exists is_primary boolean not null default false;

create unique index if not exists categories_household_name_uidx
  on public.categories(household_id, name);

create unique index if not exists categories_one_primary_per_household_uidx
  on public.categories(household_id)
  where is_primary = true;
