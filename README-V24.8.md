# Home Expenses Manager V24.8

## What changed

- Card reconciliation now closes **regular statement totals first**, using only `card_purchase` rows grouped by `charge_date + card_last4`. Direct/foreign rows cannot consume a statement match.
- Direct/foreign purchases are reconciled only afterward, one-to-one by charge date, amount and card.
- Card detail remains the expense source of truth; matched bank settlement rows are excluded from expense totals.
- Fixed dashboard primary-category preference. V24.8 adds the missing Supabase RLS UPDATE policy for `categories` and updates the UI optimistically.
- Replaced the three reconciliation banners with one compact **Data check** control. Only actual issues are shown in the detail window.
- Credit-card source validation is now monthly and uses the actual ILS charged `amount`, not `original_amount` (which may be foreign currency).
- Internal category-total validation is hidden when it is correct.

## Upgrade

1. Run `supabase/v24_8_upgrade.sql` once in Supabase SQL Editor.
2. Upload the project files to GitHub and let Vercel redeploy.
3. No re-import is required solely for this version. The app recalculates automatic card reconciliation on load.
