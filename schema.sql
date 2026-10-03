-- V24.1 — repair malformed historical Leumi bank imports.
-- The old parser could shift columns and turn dates such as 09/07/2026 into 9,072,026.
-- This script backs up ONLY unmistakably corrupted rows, then removes them so the bank file can be re-imported.

begin;

create table if not exists public.transactions_corrupt_bank_backup_v241
as select * from public.transactions with no data;

insert into public.transactions_corrupt_bank_backup_v241
select t.*
from public.transactions t
where t.source = 'עו״ש'
  and coalesce(t.merchant,'') ~ '^\\s*[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}\\s*$'
  and abs(coalesce(t.amount,0)) >= 1000000
  and not exists (
    select 1 from public.transactions_corrupt_bank_backup_v241 b where b.id=t.id
  );

delete from public.transactions t
where t.source = 'עו״ש'
  and coalesce(t.merchant,'') ~ '^\\s*[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}\\s*$'
  and abs(coalesce(t.amount,0)) >= 1000000;

commit;

-- Verification: this should return zero rows.
select id,date,merchant,amount,bank_debit,bank_credit
from public.transactions
where source='עו״ש'
  and coalesce(merchant,'') ~ '^\\s*[0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4}\\s*$'
  and abs(coalesce(amount,0)) >= 1000000;
