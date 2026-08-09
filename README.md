[README.md](https://github.com/user-attachments/files/30881245/README.md)
# Home Expenses Manager V7

This version adds:
- Full scrollable expense table for the selected month (no 20-row cutoff).
- Edit existing transactions, including category, merchant, amount, date, payment method and card last four digits.
- Click any category to open a detailed list of its transactions.
- Click comparison cells to drill into that category/month.
- Dedicated multi-month comparison view with categories as rows and months as columns.
- Display of the last four digits of the credit card on imported transactions and in details.
- Manual expenses can also store the last four card digits.

Keep the existing Supabase/Vercel environment variables. No database migration is required because the existing transactions table already contains `card_last4` and supports updates.
