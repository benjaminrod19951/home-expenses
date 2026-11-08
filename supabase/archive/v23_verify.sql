-- Optional verification after running v23_unified_ledger.sql.
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='transactions'
  and column_name in (
    'source','flow_type','count_as_expense','count_as_income','income_amount','source_key',
    'reference','value_date','balance','reconciliation_status','reconciled_transaction_id',
    'linked_transaction_id','bank_description','bank_direction','bank_debit','bank_credit',
    'bank_value_date','bank_balance','original_amount','manual_override'
  )
order by column_name;
