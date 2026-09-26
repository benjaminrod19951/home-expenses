-- v24.23: exclude exceptional expenses from normalized monthly average

alter table public.transactions
  add column if not exists exclude_from_average boolean not null default false;

create index if not exists idx_transactions_household_exclude_average
  on public.transactions (household_id, exclude_from_average);

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='transactions' and column_name='exclude_from_average';
