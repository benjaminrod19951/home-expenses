# v24.23

- Personal transcription vocabulary: categories, merchant rules and recent merchant names are sent as Whisper prompt context.
- Quick-entry draft reload diagnostics and recovery remain enabled.
- Added `transactions.exclude_from_average`. Mark exceptional expenses so they remain real expenses but are excluded from the normalized monthly average.
- Dashboard shows actual monthly average and normalized monthly average without exceptional expenses.

Run `supabase/v24_23_upgrade.sql` once before using the new average flag.
