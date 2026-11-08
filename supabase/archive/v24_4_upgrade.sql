-- Home Expenses Manager V24.4
-- Run once after V24.3. Safe to run again.
-- Reconciliation policy:
--   1) If a matching detailed card transaction exists, the CARD row owns the expense.
--   2) The matching bank debit is settlement only and is not counted again.
--   3) If no safe card match exists, the bank debit remains an expense.

-- Repair V24.3 direct matches where the bank row was made primary.
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
  and reconciliation_status='direct_bank_owned';

-- Restore the detailed card rows that V24.3 marked as duplicates.
update public.transactions
set flow_type='expense',
    kind='card_purchase',
    count_as_expense=true,
    count_as_income=false,
    reconciliation_status=null,
    linked_transaction_id=null
where source='אשראי'
  and coalesce(manual_override,false)=false
  and reconciliation_status='direct_duplicate';

-- Also repair any remaining automatically-created card_duplicate rows from this logic.
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
