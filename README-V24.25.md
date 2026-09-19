# v24.25

- Password reset now has a dedicated screen and requires an explicit email before sending.
- Reset status and Supabase errors are shown clearly instead of silently failing.
- Reset redirect uses the deployed site origin, reducing Redirect URL mismatches.
- Recovery links are recognized for both hash-token and PKCE/code flows.
- Includes all v24.24 monthly actual-vs-without-exceptions improvements.
- No database migration is required.

Supabase configuration: Authentication → URL Configuration should contain the deployed Vercel production URL in Site URL and Redirect URLs. Email provider/rate limits are controlled by Supabase and cannot be bypassed by the frontend.
