# Home Expenses V14

V14 focuses on reliable importing and avoiding double-counting between bank account and credit-card data.

## Bank files
- Supports Israeli bank `.xls` exports that are actually HTML tables.
- Detects columns such as תאריך, תאריך ערך, תיאור/פרטים, אסמכתא, בחובה, בזכות, יתרה.
- Bank credit-card settlement rows are stored as `card_payment` / `card_statement` and are excluded from expense totals.
- Income and transfers are excluded from expense totals.

## Re-import behavior
Imports are treated as syncs, not replacement.
- A previously imported identical file is skipped.
- Existing transaction external IDs are skipped.
- New transactions are inserted.
- Original source totals remain in `import_batches`.

## Credit-card reconciliation
The app shows bank credit-card settlements separately and compares them with imported card purchases for the payment month and the previous month. This helps confirm that the bank settlement is not counted as a second expense.

## Supabase
Run `supabase/v14_upgrade.sql` in Supabase SQL Editor before deploying.
