-- V20: financial-flow model for bank + credit integration.
-- Safe to run after previous versions; it only adds columns/indexes.
alter table public.transactions add column if not exists flow_type text;
alter table public.transactions add column if not exists bank_description text;
alter table public.transactions add column if not exists bank_direction text;
alter table public.transactions add column if not exists bank_debit numeric;
alter table public.transactions add column if not exists bank_credit numeric;
alter table public.transactions add column if not exists bank_value_date date;
alter table public.transactions add column if not exists bank_balance numeric;
alter table public.transactions add column if not exists original_amount numeric;
alter table public.transactions add column if not exists income_amount numeric;
alter table public.transactions add column if not exists linked_transaction_id uuid;
create index if not exists transactions_household_flow_idx on public.transactions(household_id,flow_type);
create index if not exists transactions_household_external_idx on public.transactions(household_id,external_id);
-- Reclassify obvious card-payment rows already imported from the bank.
update public.transactions set flow_type='card_payment', kind='card_payment', category='חיוב כרטיס אשראי'
where source='עו״ש' and (merchant ilike '%לאומי ויזה%' or merchant ilike '%ישראכרט%' or merchant ilike '%מקס%' or merchant ilike '%כאל%' or merchant ilike '%ויזה%');
-- Obvious savings/deposit movements are not household income/expense.
update public.transactions set flow_type='saving', kind='saving', category='חיסכון/פיקדון', income_amount=0
where source='עו״ש' and merchant ~* '(פיקדון|חיסכון|חסכון|פירעון פיקדון|הקמת פיקדון)';
