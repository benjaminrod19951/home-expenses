-- READ-ONLY security audit. Changes nothing. Run in Supabase SQL Editor and review the results.

-- A) Tables in "public" WITHOUT row level security (should be empty, apart from backup tables you may delete)
select tablename from pg_tables
where schemaname = 'public' and rowsecurity = false
order by tablename;

-- B) Every policy (who can read / insert / update / delete what)
select tablename, policyname, cmd, roles, qual as "using", with_check
from pg_policies where schemaname = 'public'
order by tablename, cmd, policyname;

-- C) Functions that run with elevated rights (SECURITY DEFINER) and who may call them
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       array(select grantee::regrole::text from aclexplode(p.proacl) where privilege_type = 'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by p.proname;

-- D) Expected after the v24.45 migration:
--    * household_members: SELECT policy only, no INSERT policy.
--    * transactions / categories / budgets / merchant_category_rules / planned_items / import_batches:
--      every policy uses is_household_member(household_id).
--    * create_household, join_household_by_code, set_workspace_type: EXECUTE for "authenticated" only (not "anon").
