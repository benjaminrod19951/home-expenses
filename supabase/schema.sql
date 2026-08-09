create extension if not exists pgcrypto;

create table if not exists public.households(
  id uuid primary key default gen_random_uuid(),
  name text not null default 'הבית שלנו',
  join_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.household_members(
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(household_id,user_id)
);

create table if not exists public.transactions(
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  date date not null,
  month text not null,
  merchant text not null,
  amount numeric(12,2) not null,
  category text not null,
  source text not null,
  kind text not null default 'bank_movement',
  payment_method text not null default 'אשראי',
  card_last4 text,
  charge_date date,
  notes text,
  created_at timestamptz default now(),
  unique(household_id,external_id)
);

create table if not exists public.categories(
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique(household_id,name)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;

create or replace function public.is_household_member(h uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.household_members where household_id=h and user_id=auth.uid()) $$;

create policy "household read" on public.households for select to authenticated using(is_household_member(id));
create policy "household create" on public.households for insert to authenticated with check(created_by=auth.uid());

create policy "member read" on public.household_members for select to authenticated
using(user_id=auth.uid() or is_household_member(household_id));
create policy "member insert" on public.household_members for insert to authenticated
with check(user_id=auth.uid());

create policy "tx read" on public.transactions for select to authenticated using(is_household_member(household_id));
create policy "tx insert" on public.transactions for insert to authenticated
with check(is_household_member(household_id) and user_id=auth.uid());
create policy "tx update" on public.transactions for update to authenticated
using(is_household_member(household_id)) with check(is_household_member(household_id));
create policy "tx delete" on public.transactions for delete to authenticated
using(is_household_member(household_id));

create policy "cat read" on public.categories for select to authenticated using(is_household_member(household_id));
create policy "cat insert" on public.categories for insert to authenticated with check(is_household_member(household_id));
create policy "cat delete" on public.categories for delete to authenticated using(is_household_member(household_id));

create or replace function public.create_household(house_name text,code text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare hid uuid;
begin
  insert into households(name,join_code,created_by)
  values(coalesce(nullif(trim(house_name),''),'הבית שלנו'),upper(trim(code)),auth.uid())
  returning id into hid;
  insert into household_members values(hid,auth.uid());
  return hid;
end $$;

create or replace function public.join_household_by_code(code text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare hid uuid;
begin
  select id into hid from households where join_code=upper(trim(code));
  if hid is null then raise exception 'קוד הבית לא נמצא'; end if;
  insert into household_members values(hid,auth.uid()) on conflict do nothing;
  return hid;
end $$;

grant execute on function public.create_household(text,text) to authenticated;
grant execute on function public.join_household_by_code(text) to authenticated;