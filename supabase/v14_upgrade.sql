-- V14: bank HTML/XLS import + bank/card reconciliation metadata
alter table public.transactions add column if not exists reference text;
alter table public.transactions add column if not exists value_date date;
alter table public.transactions add column if not exists balance numeric(14,2);
alter table public.transactions add column if not exists reconciliation_status text default 'unmatched';
alter table public.transactions add column if not exists reconciled_transaction_id uuid references public.transactions(id) on delete set null;
create index if not exists transactions_reference_idx on public.transactions(household_id,reference);
create index if not exists transactions_kind_idx on public.transactions(household_id,kind);

-- The existing import_batches table from V11 remains the source-of-truth for the
-- original file totals. No existing transaction is deleted by this migration.
