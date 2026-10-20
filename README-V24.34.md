# v24.34 — index.html deployment repair

This release keeps the v24.33 application logic unchanged and explicitly restores the root `index.html` Vite entrypoint. The HTML must not contain SQL.

Upload the extracted contents at the repository root. No database migration required.
