-- v24.45 — security: nobody can add themselves to another household/workspace directly.
--
-- PROBLEM (verified in supabase/schema.sql): the policy "member insert" on household_members allowed
-- any logged-in user to insert the row (household_id = ANY id, user_id = themselves) through the API,
-- i.e. to join someone else's workspace just by knowing its id.
-- FIX: remove direct INSERT on household_members. Joining stays possible ONLY through
-- create_household() and join_household_by_code(), which are SECURITY DEFINER and keep working.
-- The app never inserts into household_members directly (checked in the code).
--
-- Safe to run more than once. Does not touch any data.

-- ===== 1) PREVIEW — run alone first and look at the result =====
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'household_members'
order by cmd, policyname;

-- ===== 2) FIX =====
do $$
declare p record;
begin
  for p in select policyname, cmd from pg_policies
           where schemaname = 'public' and tablename = 'household_members' loop
    if p.cmd = 'INSERT' then
      execute format('drop policy %I on public.household_members', p.policyname);
      raise notice 'dropped INSERT policy: %', p.policyname;
    elsif p.cmd = 'ALL' then
      raise notice 'REVIEW MANUALLY: policy % covers ALL commands (including INSERT)', p.policyname;
    end if;
  end loop;
end $$;

-- ===== 3) VERIFY — should return no INSERT rows =====
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'household_members';

-- ===== ROLLBACK (only if something stopped working; restores the old, unsafe behaviour) =====
-- create policy "member insert" on public.household_members for insert to authenticated with check (user_id = auth.uid());
