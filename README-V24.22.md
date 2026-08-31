# v24.22

- Stable Supabase auth boot: avoids login/App flicker and refresh loops.
- Explicit persistent session in localStorage. Users stay signed in until logout.
- Forgot-password flow using Supabase resetPasswordForEmail.
- Password recovery screen after opening the email link.
- Includes all v24.21 quick-entry/voice improvements.

No database migration is required for v24.22.
