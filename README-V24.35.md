# v24.35
- Verified manual income/expense deletion: delete() returns deleted id; reports RLS permission failure instead of false success.
- Direct delete button for manually entered income in income table.
- Weekly analytics on Insights tab, Sunday–Saturday across calendar month boundaries; category filter, drill-down, comparison, four historical weeks baseline, rising categories and merchants.
- No database migrations required for these changes. If deletion reports an RLS restriction, database policies need separate inspection; do not run unverified SQL.
