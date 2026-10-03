# v24.33

Monthly credit-card reconciliation fix.

- A bank credit-card debit posted in month M is matched primarily against detailed card purchases from month M-1.
- Purchase expense month remains the actual transaction month.
- Bank settlement is retained but becomes `count_as_expense=false` only after a unique reconciliation.
- Card last-4 is required when available from the bank reference.
- Direct/foreign one-to-one matching remains separate.
- A bounded end-of-month boundary fallback may exclude up to 3 purchases from the final 3 calendar days only when they exactly explain the statement delta.
- Household/source protections from v24.31 remain.
- No SQL migration required.
