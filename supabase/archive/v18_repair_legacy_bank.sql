-- V18 safety repair: remove only the legacy bank rows where the amount is
-- exactly the date encoded as DDMMYYYY (e.g. 30/07/2026 -> 30072026).
-- Run once if the automatic repair did not remove them.
delete from public.transactions t
where t.source = 'עו״ש'
  and t.amount >= 10000000
  and t.amount <= 99999999
  and round(t.amount) = to_number(to_char(t.date, 'DDMMYYYY'), '99999999');
