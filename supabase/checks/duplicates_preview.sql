-- READ-ONLY: possible duplicate transactions already stored. Changes nothing.
-- Identical rows are not always duplicates (two equal purchases on the same day happen),
-- so review the list before deleting anything — delete only from the app, row by row.

-- Card rows: same day, merchant, amount, card and installment note
select household_id, date, merchant, amount, card_last4, notes, count(*) as copies,
       array_agg(id order by created_at) as ids, array_agg(external_id order by created_at) as external_ids
from public.transactions
where source = 'אשראי'
group by household_id, date, merchant, amount, card_last4, notes
having count(*) > 1
order by date desc;

-- Bank rows: same day, description, reference, debit and credit
select household_id, date, bank_description, reference, bank_debit, bank_credit, count(*) as copies,
       array_agg(id order by created_at) as ids
from public.transactions
where source = 'עו״ש'
group by household_id, date, bank_description, reference, bank_debit, bank_credit
having count(*) > 1
order by date desc;
