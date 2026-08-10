# Home Expenses V17

V17 introduces a strict financial-flow model:

- Card purchases and real bank expenses appear together in the household expense table.
- Credit-card settlement lines in the bank account are classified as `card_payment` and are not counted as a second expense.
- Savings/deposit opening and redemption are classified as transfers by default. The transaction editor lets the user enter only the actual income portion (e.g. interest) when a deposit redemption contains both principal and interest.
- Unknown bank credits are classified as `income_review` instead of being silently counted as income.
- Explicit salary/benefit/pension credits can be counted as income.
- A stable `source_key` lets corrected imports update an old, incorrectly parsed bank row instead of creating a duplicate.
- Leumi `.xls` HTML exports are parsed from the HTML table first, preventing the balance column from being mistaken for the credit column.

## Supabase

Run `supabase/v17_financial_flow.sql` once in Supabase SQL Editor before deploying V17.

Then upload the project contents to GitHub and let Vercel deploy it.
