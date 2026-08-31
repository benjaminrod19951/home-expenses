# v24.21

- Quick-entry transcript is now the source of truth; the draft table auto-refreshes after a short debounce whenever transcript text changes.
- Recording additions also trigger automatic draft refresh. A manual “Update now” button remains available.
- Quick-entry text and draft rows are persisted in localStorage per workspace so an unexpected page reload does not erase the draft.
- Removed the unsafe local-parser fallback that could invent wrong rows when Groq parsing failed. Existing draft remains untouched on parser failure.
- Parser API dynamically selects an available Groq chat model instead of assuming access to llama-3.3-70b-versatile.
- Stronger instructions preserve numeric digits exactly and keep real merchant descriptions rather than replacing them with generic “manual transaction”.
