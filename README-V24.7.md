# Home Expenses Manager v24.7

## Card ↔ bank reconciliation rebuilt from the real uploaded files

### Source of truth
- Detailed credit-card files are the source of truth for merchant, category and expense details.
- Bank files are the source of truth for cash movement and are used to verify settlement.
- A matched bank card debit is never counted as an additional expense.
- If no matching card detail exists yet, the bank debit remains an expense so money is never lost.

### Two dates, two jobs
- `date` / transaction date controls the expense month shown in analytics.
- `charge_date` controls reconciliation with the bank.
- Therefore a July purchase that settles in August remains a July expense.

### Matching order
1. Exact card transaction: charge date + amount + card last4 when available from the bank reference.
2. Statement/group settlement: the signed sum of all remaining card rows on the same charge date + last4 equals one bank debit.
3. Conservative ±3-day exact fallback only when the match is unique.

Refunds/credits in card files stay signed and are included in statement totals.

### Verified against the supplied files
Across the seven uploaded card exports and the supplied Leumi bank export, all 57 Leumi Visa bank debits for which the corresponding card charge-date data exists were explainable by the detailed card data. Later bank debits for which the next card statement was not supplied intentionally remain unmatched expenses until that file is imported.

No Supabase schema migration is required for v24.7 if v24.x is already installed.
