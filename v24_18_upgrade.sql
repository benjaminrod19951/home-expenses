-- V23: audited unified-ledger upgrade.
-- Safe to run on the existing database. Idempotent: columns/indexes use IF NOT EXISTS.
-- Main fixes: no reference to nonexistent `description`, stable count flags,
-- safer bank classification, legacy repair, and manual-edit protection.

alter table public.transactions add column if not exists source text;
alter table public.transactions add column if not exists flow_type text;
alter table public.transactions add column if not exists count_as_expense boolean;
alter table public.transactions add column if not exists count_as_income boolean;
alter table public.transactions add column if not exists income_amount numeric(14,2);
alter table public.transactions add column if not exists source_key text;
alter table public.transactions add column if not exists reference text;
alter table public.transactions add column if not exists value_date date;
alter table public.transactions add column if not exists balance numeric(14,2);
alter table public.transactions add column if not exists reconciliation_status text default 'unmatched';
alter table public.transactions add column if not exists reconciled_transaction_id uuid references public.transactions(id) on delete set null;
alter table public.transactions add column if not exists linked_transaction_id uuid references public.transactions(id) on delete set null;
alter table public.transactions add column if not exists bank_description text;
alter table public.transactions add column if not exists bank_direction text;
alter table public.transactions add column if not exists bank_debit numeric(14,2);
alter table public.transactions add column if not exists bank_credit numeric(14,2);
alter table public.transactions add column if not exists bank_value_date date;
alter table public.transactions add column if not exists bank_balance numeric(14,2);
alter table public.transactions add column if not exists original_amount numeric(14,2);
alter table public.transactions add column if not exists manual_override boolean not null default false;

-- Keep the two generations of bank metadata aligned where one side is missing.
update public.transactions
set bank_description = coalesce(bank_description, merchant),
    bank_value_date = coalesce(bank_value_date, value_date),
    bank_balance = coalesce(bank_balance, balance),
    value_date = coalesce(value_date, bank_value_date),
    balance = coalesce(balance, bank_balance),
    source_key = coalesce(source_key, external_id)
where source = 'עו״ש';

-- Reclassify BANK rows only. Previous V22 omitted the source restriction and
-- could accidentally classify a normal credit-card merchant containing "מקס".
update public.transactions
set flow_type = 'card_payment',
    kind = 'card_payment',
    category = 'חיוב כרטיס אשראי',
    count_as_expense = false,
    count_as_income = false,
    income_amount = 0
where source = 'עו״ש'
  and coalesce(manual_override,false) = false
  and lower(concat_ws(' ', merchant, bank_description)) ~
      '(לאומי[[:space:]]*ויזה|לאומי.*ויזה|ישראכרט|מקס[[:space:]]*(איט|it|פיננ)|כאל|cal[[:space:]]*(card|כרטיס))';

-- Savings/deposit principal movements are internal cash movements, not expenses/income.
update public.transactions
set flow_type = 'saving',
    kind = 'saving',
    category = 'חיסכון/פיקדון',
    count_as_expense = false,
    count_as_income = false,
    income_amount = 0
where source = 'עו״ש'
  and coalesce(manual_override,false) = false
  and lower(concat_ws(' ', merchant, bank_description)) ~
      '(פיקדון|חיסכון|חסכון|משיכת חיסכון|משיכת פיקדון|פירעון פיקדון|פדיון פיקדון|פדיון חיסכון|הקמת פיקדון)';

-- Backfill counting flags for legacy rows without overriding explicit values.
update public.transactions
set count_as_expense = case
      when coalesce(flow_type,kind) = 'expense' then true
      else false
    end,
    count_as_income = case
      when coalesce(flow_type,kind) = 'income' then true
      else false
    end,
    income_amount = case
      when coalesce(flow_type,kind) = 'income' then coalesce(income_amount, amount)
      else coalesce(income_amount,0)
    end
where count_as_expense is null or count_as_income is null;

-- V18 legacy parser repair: remove only impossible rows where amount equals DDMMYYYY.
delete from public.transactions t
where t.source = 'עו״ש'
  and t.amount >= 10000000
  and t.amount <= 99999999
  and round(t.amount) = to_number(to_char(t.date, 'DDMMYYYY'), '99999999');

create index if not exists transactions_household_date_idx on public.transactions(household_id,date);
create index if not exists transactions_household_source_idx on public.transactions(household_id,source);
create index if not exists transactions_household_flow_idx on public.transactions(household_id,flow_type);
create index if not exists transactions_household_external_idx on public.transactions(household_id,external_id);
create index if not exists transactions_reference_idx on public.transactions(household_id,reference);
create index if not exists transactions_kind_idx on public.transactions(household_id,kind);
