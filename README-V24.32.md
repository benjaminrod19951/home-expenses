# v24.32

Credit-card statement reconciliation improvement.

- Keeps exact statement matching.
- Adds narrow statement-boundary matching when 1–3 purchases from the final 3 days explain the exact bank/card difference.
- Does not use a broad amount tolerance.
- Boundary purchases remain normal card expenses and remain available for a later statement reconciliation.
- Keeps household/source protections from v24.31.
- No SQL migration required.
