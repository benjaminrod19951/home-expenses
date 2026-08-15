# Home Expenses Manager V24

V24 combines the richer category/analytics UI from the older versions with the audited bank/card ledger from V23.

## Before deploying

Your database already has the V23 columns, so in Supabase SQL Editor run only:

`supabase/v24_upgrade.sql`

Then optionally run:

`supabase/v24_verify.sql`

## Deploy

Upload the contents of this ZIP to the existing GitHub repository. Vercel can keep using the existing Supabase environment variables/integration. Do not commit real Supabase keys.

## Main V24 changes

- Bank import uses **transaction date**, description, reference, debit and credit. Value date and opening balance do not affect classification.
- Debit > 0 = money out. Debit = 0 and credit > 0 = money in.
- Ordinary incoming credits are counted as income immediately; likely self-transfers/Leumi/savings remain for review.
- A deposit redemption can be edited so only the profit portion counts as real income.
- Direct bank/card duplicates are linked only on a strong amount/date/merchant match; unmatched bank debits remain expenses so foreign/direct charges are not lost.
- Category dashboard, month comparison, drill-down, multi-select recategorization, merchant rules, budgets and category integrity checks are restored.
- Category-only changes do not modify `count_as_expense` or the transaction amount.
- Future planning supports expected income and future expenses, with a combined history + plan forecast and projected savings.

## V24.1 bank-import repair
If older bank imports display impossible multi-million shekel amounts with a date in the merchant field, run `supabase/v24_1_repair_bank_import.sql` once, then re-import the Leumi bank file. The repair backs up only the unmistakably malformed rows before deleting them. The importer now rejects shifted rows defensively.
