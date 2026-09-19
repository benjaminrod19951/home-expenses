# v24.27

Auth rollback release.

- Restored the Supabase client auth configuration exactly to v24.21.
- Restored the v24.21 login/session flow (getSession + onAuthStateChange).
- Removed the v24.22-v24.26 custom auth/session logic.
- Added only a minimal Forgot Password call on top of the v24.21 login screen.
- Keeps PasswordRecovery for choosing a new password after opening the email link.
- Keeps all application features added through v24.24+.
- No SQL migration required.
