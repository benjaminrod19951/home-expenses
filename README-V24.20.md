# Home Expenses Manager v24.20

## Voice entry fixes
- Shows the complete raw transcript before parsing.
- New recordings append to the transcript but do not overwrite or mutate the existing draft table.
- Explicit **Parse / update table** step. Nothing is saved automatically.
- Switches transcription from `whisper-large-v3-turbo` to the more accurate multilingual `whisper-large-v3`.
- Adds server-side structured parsing through Groq (`llama-3.3-70b-versatile`) using the workspace category list, with the existing local parser as fallback.
- Draft remains fully editable: expense/income, merchant, amount, category, payment method and date.
- No database migration is required. Existing `GROQ_API_KEY` is used by both server endpoints.
