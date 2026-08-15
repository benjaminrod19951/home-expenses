# Home Expenses Manager v24.6

Changes:
- Fixed invisible dashboard labels/amounts on clickable cards (white-on-white CSS).
- Primary dashboard category can now be changed directly from the dashboard card.
- Added Categories tab for adding, deleting and merging categories.
- A category that is in use cannot be deleted until a replacement category is selected. Transactions, merchant rules and planned items are reassigned before deletion.
- Added merchant-level insights: top merchants for the selected month are clickable. The history modal compares total spend, transaction count and average transaction value by month, with drill-down to transactions.
- Keeps v24.5 bank/card reconciliation logic unchanged.

No new Supabase SQL migration is required after v24.5.
