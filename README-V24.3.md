# Home Expenses Manager V24.3

## Changes
- Fixes Visa Direct / immediate card expenses: bank row owns a direct expense; duplicated card row is excluded.
- Monthly card statement is excluded only when it matches the aggregate card purchases for the charge date.
- Unmatched bank card debit stays an expense instead of disappearing.
- Selectable primary dashboard category (Settings are under Budgets).
- Category comparison automatically falls back two months when previous month is zero (useful for bi-monthly utilities).
- Income cards are clickable and open the month's income transaction table.
- Import integrity check now verifies raw file rows independently of cross-source de-duplication.

Run `supabase/v24_3_upgrade.sql` before deploying the app.
