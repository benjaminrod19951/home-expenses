-- v24.46 — limit guessing of workspace share codes.
-- * At most 10 wrong codes per user per hour (then: "too many attempts").
-- * A wrong code now returns NULL instead of an error, so the failed attempt can be recorded
--   (an error would roll the record back). The app (v24.46+) shows "הקוד לא נמצא" for NULL.
-- * Existing 6-character codes keep working; new workspaces get 10-character codes from the app.
-- Same function name and parameters as before. Safe to run more than once. Changes no existing data.

-- ===== 1) PREVIEW — the current function (run alone first) =====
select pg_get_functiondef('public.join_household_by_code(text)'::regprocedure);

-- ===== 2) FIX =====
create table if not exists public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);
create index if not exists join_attempts_user_time_idx on public.join_attempts(user_id, attempted_at);
alter table public.join_attempts enable row level security; -- no policies: only the function below writes/reads it

create or replace function public.join_household_by_code(code text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare hid uuid; failures int;
begin
  if auth.uid() is null then raise exception 'נדרשת התחברות'; end if;
  select count(*) into failures from join_attempts
   where user_id = auth.uid() and success = false and attempted_at > now() - interval '1 hour';
  if failures >= 10 then raise exception 'יותר מדי ניסיונות שגויים. נסה שוב בעוד שעה.'; end if;

  select id into hid from households where join_code = upper(trim(code));
  insert into join_attempts(user_id, success) values (auth.uid(), hid is not null);
  if hid is null then return null; end if;   -- wrong code

  insert into household_members values (hid, auth.uid()) on conflict do nothing;
  return hid;
end $$;

revoke all on function public.join_household_by_code(text) from public, anon;
grant execute on function public.join_household_by_code(text) to authenticated;

-- ===== 3) VERIFY =====
select pg_get_functiondef('public.join_household_by_code(text)'::regprocedure) like '%join_attempts%' as rate_limit_installed;

-- ===== ROLLBACK (restores the previous function; keeps the join_attempts table, which is harmless) =====
-- create or replace function public.join_household_by_code(code text)
-- returns uuid language plpgsql security definer set search_path=public
-- as $$ declare hid uuid; begin
--   select id into hid from households where join_code=upper(trim(code));
--   if hid is null then raise exception 'קוד הבית לא נמצא'; end if;
--   insert into household_members values(hid,auth.uid()) on conflict do nothing;
--   return hid; end $$;
