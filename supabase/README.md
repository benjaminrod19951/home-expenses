# Supabase

- `schema.sql` — the original base schema (households, members, transactions, categories).
- `archive/` — every upgrade script from V8 to V24.23, written for earlier versions and should already be applied to the live database (the current app depends on the columns they add).
  They are kept for reference only. **Do not run them again** — some of them delete or re-classify data.

## Migrations to run (in this order, once each; first the PREVIEW part alone, then the whole file)
1. `migrations/2026-11-08-v24-45-membership-security.sql` — no direct self-join to another workspace.
2. `migrations/2026-11-08-v24-46-join-code-limit.sql` — max 10 wrong share codes per user per hour.
Neither changes existing data. Both are safe to run twice.

## Read-only checks (change nothing)
- `checks/security_audit.sql` — RLS on every table, all policies, privileged functions.
- `checks/duplicates_preview.sql` — transactions that may have been stored twice.

## Rules for future database changes
New file `migrations/YYYY-MM-DD-short-name.sql`: a PREVIEW query first, safe to run twice
(`if not exists`, `drop ... if exists`), a VERIFY query, and a commented ROLLBACK. Never delete data automatically.
