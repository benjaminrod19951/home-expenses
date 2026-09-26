# v24.28

Authentication rollback verification build.

- Login component is based directly on the v24.21 authentication flow.
- Supabase client configuration is identical to v24.21.
- Only a minimal Forgot password action and recovery screen were added.
- Removes the legacy custom auth key introduced in v24.22.
- Adds a visible `v24.28` badge on the login screen so the deployed frontend can be verified immediately.
- Keeps all current expense features, including monthly totals without exceptional expenses.
- No SQL migration required.
