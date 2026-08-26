# V24.18

- Workspace switcher: one account can manage multiple homes/businesses and switch between them.
- New business workspace creation while preserving the existing shared join-code model.
- Every transaction, category, rule, budget, import and plan remains isolated by `household_id`.
- Manual/quick expenses can now be edited **and deleted**. Imported bank/card transactions cannot be deleted from the edit modal, protecting reconciliation history.
- Planned items already support edit/delete and remain unchanged.

Before deploying V24.18, run `supabase/v24_18_upgrade.sql` once in Supabase.
