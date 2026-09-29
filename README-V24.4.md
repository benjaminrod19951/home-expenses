# Home Expenses Manager V24.4

V24.4 changes direct-card reconciliation so the most informative record wins.

- If a bank debit matches exactly one card transaction by amount and nearby date, the **card transaction remains the counted expense**. Its merchant and category stay visible.
- The matching bank row becomes `card_payment`, is linked to the card row, and is not counted again.
- If there is no safe card match, the bank debit stays a real expense so foreign/direct charges are never silently lost.
- The migration repairs V24.3 rows that used the opposite ownership rule.

Run `supabase/v24_4_upgrade.sql` once, then deploy this project to GitHub/Vercel.
