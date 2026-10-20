-- V17: correct financial flow model.
-- Keeps bank movements and card purchases in one transaction table,
-- but explicitly separates real expenses, real income, transfers and card payments.

alter table public.transactions add column if not exists source_key text;
alter table public.transactions add column if not exists flow_type text;
alter table public.transactions add column if not exists count_as_expense boolean;
alter table public.transactions add column if not exists count_as_income boolean;
alter table public.transactions add column if not exists income_amount numeric(14,2);

-- Stable source key lets a corrected re-import UPDATE a previously imported
-- transaction instead of creating a duplicate, even when the original parser
-- stored the wrong amount.
update public.transactions
set source_key = case
  when source = 'עו״ש' then
    'bank|' || to_char(date,'YYYY-MM-DD') || '|' || to_char(coalesce(value_date,date),'YYYY-MM-DD') || '|' || coalesce(reference,'') || '|' || regexp_replace(trim(coalesce(merchant,'')), '\s+', ' ', 'g')
  when source = 'אשראי' then
    'card|' || to_char(date,'YYYY-MM-DD') || '|' || to_char(coalesce(charge_date,date),'YYYY-MM-DD') || '|' || regexp_replace(trim(coalesce(merchant,'')), '\s+', ' ', 'g') || '|' || to_char(amount,'FM999999990.00') || '|' || coalesce(card_last4,'')
  else source || '|' || coalesce(external_id,'')
end
where source_key is null;

-- Reclassify old rows using the bank description. This specifically repairs
-- the earlier parser bug that could accidentally treat the balance column as income.
update public.transactions
set flow_type = case
  when source = 'אשראי' or kind = 'card_purchase' then 'expense'
  when source = 'עו״ש' and lower(coalesce(merchant,'')) ~ 'לאומי\s*ויזה|בנהפ[- ]?ישראכרט|מקס\s*איט\s*פיננ|ישראכרט\s*בע' then 'card_payment'
  when source = 'עו״ש' and lower(coalesce(merchant,'')) ~ 'הקמת\s*פיקדון|משיכת\s*חיסכון|פירעון\s*פיקדון|פדיון\s*פיקדון|פדיון\s*חיסכון|משיכת\s*פיקדון' then 'transfer'
  when source = 'עו״ש' and coalesce(kind,'') = 'income' and coalesce(category,'') = 'הכנסה' then 'income_review'
  when source = 'עו״ש' and coalesce(kind,'') = 'transfer' then 'transfer'
  when source = 'ידני' and coalesce(kind,'manual') = 'manual' then 'expense'
  else 'expense'
end
where flow_type is null or flow_type = '';

update public.transactions
set count_as_expense = (flow_type = 'expense'),
    count_as_income = (flow_type = 'income'),
    income_amount = case when flow_type = 'income' then coalesce(income_amount,amount) else 0 end
where count_as_expense is null or count_as_income is null or income_amount is null;

-- Savings/deposit movements are transfers by default. If a maturity contains
-- interest, the user can edit the transaction and enter only the income portion.
update public.transactions
set count_as_expense=false, count_as_income=false, income_amount=0, category=case when amount>0 then 'חיסכון / פיקדון' else category end
where flow_type='transfer' and (merchant ilike '%פיקדון%' or merchant ilike '%חיסכון%');

create index if not exists transactions_source_key_idx on public.transactions(household_id,source_key);
create index if not exists transactions_flow_type_idx on public.transactions(household_id,flow_type);

comment on column public.transactions.flow_type is 'expense | income | transfer | card_payment | income_review';
comment on column public.transactions.count_as_expense is 'Whether this movement contributes to household expense totals';
comment on column public.transactions.count_as_income is 'Whether this movement contributes to household income totals';
comment on column public.transactions.income_amount is 'Actual income portion; useful for deposit redemption where principal is not income';
