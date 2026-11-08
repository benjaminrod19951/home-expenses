-- Home Expenses Manager V24.3
-- Run once after V24/V24.2. Safe to run again.

-- Dashboard category preference.
alter table public.categories
  add column if not exists is_primary boolean not null default false;

-- Make category upserts/preferences reliable without changing existing rows.
create unique index if not exists categories_household_name_uidx
  on public.categories(household_id, name);
create unique index if not exists categories_one_primary_per_household_uidx
  on public.categories(household_id)
  where is_primary = true;

-- V24.2 marked every bank debit that looked like a card brand as a card payment.
-- That can hide Visa Direct / immediate foreign charges. Put all AUTO-classified
-- rows back into a conservative candidate state. V24.3 then reconciles them:
--   * monthly statement matched to aggregate card rows -> bank row excluded
--   * immediate/direct exact transaction -> bank row counts, card copy excluded
--   * no safe match -> bank row remains an expense (never disappears)
update public.transactions
set flow_type='card_candidate',
    kind='card_candidate',
    category='אשראי ישיר / התאמה',
    count_as_expense=true,
    count_as_income=false,
    reconciliation_status=null,
    linked_transaction_id=null
where source='עו"ש'
  and coalesce(manual_override,false)=false
  and coalesce(flow_type,kind)='card_payment'
  and lower(concat_ws(' ',merchant,bank_description)) ~ '(לאומי[[:space:]]*ויזה|לאומי.*ויזה|ישראכרט|מקס|כאל|cal)';

-- Undo only automatic direct-card duplicate flags from older reconciliation.
-- They will be recomputed by V24.3 using bank-owned direct charges.
update public.transactions
set flow_type='expense',
    kind='card_purchase',
    count_as_expense=true,
    count_as_income=false,
    reconciliation_status=null,
    linked_transaction_id=null
where source='אשראי'
  and coalesce(manual_override,false)=false
  and coalesce(flow_type,kind)='card_duplicate';
