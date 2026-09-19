# v24.26

Auth reliability fix built on v24.25/v24.24.

- Removed the custom Supabase auth storage key and returned to Supabase's stable default key.
- A manual email/password login clears stale local auth state first, so a broken refresh token cannot block a fresh login.
- Successful `signInWithPassword` now passes the returned session directly to the app instead of depending only on an auth callback.
- Login failures are shown clearly (invalid credentials, unconfirmed email, rate limit, network, or raw Supabase error).
- Simplified auth boot: one initial `getSession()` plus one auth-state listener; removed the competing fallback timer.
- Keeps the improved forgot-password screen and recovery flow from v24.25.
- No SQL migration is required for v24.26.
