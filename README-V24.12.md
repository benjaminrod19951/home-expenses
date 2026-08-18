# Home Expenses Manager v24.12

## Quick expense fixes
- Removes temporal words (today/yesterday/day-before-yesterday) before merchant/category matching.
- Learns category suggestions from existing transaction history as well as merchant rules.
- Voice button now checks microphone permission/support and shows a real listening state.
- On browsers without Web Speech Recognition, focuses the text field and directs the user to the phone keyboard dictation microphone instead of silently failing.

No database migration is required from v24.11.
