# Home Expenses V9

V9 builds on V8 and adds a broader household-finance workflow:

- Full transaction table with search/filter and bulk selection.
- Edit any transaction, including category, merchant, payment method and card last 4.
- Merchant rules that apply across historical transactions and future imports.
- Bulk recategorization and bulk creation of merchant rules.
- Category drill-down from monthly and comparison views.
- Side-by-side month comparison with clickable category/month totals.
- Insights: month-over-month changes, budget alerts, savings rate when income exists, top categories.
- Recurring-expense detection as an indication (not an automatic subscription classification).
- Monthly budgets with 80%/100% thresholds.
- Card last-4 display when supplied by the imported file.
- Shared household data through Supabase.

## Supabase migration
Run `supabase/v9_upgrade.sql` once in Supabase SQL Editor. It is idempotent.

## Vercel
Keep the existing Supabase/Vercel integration variables. `vite.config.js` exposes only the public Supabase URL and publishable/anon key to the browser at build time.
