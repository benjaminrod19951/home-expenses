-- Home Expenses Manager V24.18
-- Adds explicit workspace type (home/business) while keeping the existing household_id
-- architecture. Existing households remain type 'home'. Safe to run more than once.

alter table public.households
  add column if not exists workspace_type text not null default 'home';

update public.households
set workspace_type='home'
where workspace_type is null or workspace_type not in ('home','business');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='households_workspace_type_check'
      and conrelid='public.households'::regclass
  ) then
    alter table public.households
      add constraint households_workspace_type_check
      check (workspace_type in ('home','business'));
  end if;
end $$;

-- The app creates a workspace with the existing create_household RPC, then calls
-- this helper to mark a newly-created workspace as a business. Only a member may
-- change the type, and only the two supported values are accepted.
create or replace function public.set_workspace_type(workspace_id uuid, workspace_kind text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_household_member(workspace_id) then
    raise exception 'אין הרשאה למרחב הזה';
  end if;
  if workspace_kind not in ('home','business') then
    raise exception 'סוג מרחב לא תקין';
  end if;
  update public.households
  set workspace_type=workspace_kind
  where id=workspace_id;
end $$;

grant execute on function public.set_workspace_type(uuid,text) to authenticated;
