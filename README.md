# Home Expenses — מדריך והיסטוריית גרסאות

כל התיעוד ההיסטורי רוכז בקובץ אחד. אין להריץ קובצי SQL ישנים מחדש ללא בדיקת התאמה למסד הנתונים.


---

## מקור: README.md

# Home Expenses V18

V18 introduces a strict financial-flow model:

- Card purchases and real bank expenses appear together in the household expense table.
- Credit-card settlement lines in the bank account are classified as `card_payment` and are not counted as a second expense.
- Savings/deposit opening and redemption are classified as transfers by default. The transaction editor lets the user enter only the actual income portion (e.g. interest) when a deposit redemption contains both principal and interest.
- Unknown bank credits are classified as `income_review` instead of being silently counted as income.
- Explicit salary/benefit/pension credits can be counted as income.
- A stable `source_key` lets corrected imports update an old, incorrectly parsed bank row instead of creating a duplicate.
- Leumi `.xls` HTML exports are parsed from the HTML table first, preventing the balance column from being mistaken for the credit column.

## Supabase

Run `supabase/v17_financial_flow.sql` once in Supabase SQL Editor before deploying V18.

Then upload the project contents to GitHub and let Vercel deploy it.


V18 fixes the Leumi HTML .xls importer and repairs the legacy DDMMYYYY-as-amount corruption before loading transactions.


---

## מקור: README-V23.md

# Home Expenses Manager V23 — audited unified ledger

## מה תוקן
- תוקנה שגיאת Supabase `column description does not exist`; נעשה שימוש ב-`merchant` + `bank_description` בלבד.
- מיגרציית V23 מוסיפה בעצמה את כל עמודות ה-ledger הדרושות, כולל `linked_transaction_id`, flags לחישוב ו-`manual_override`.
- סיווג חיוב כרטיס/פיקדון ב-SQL מוגבל לתנועות עו״ש בלבד, כדי לא לסווג בטעות בית עסק בכרטיס.
- יבוא קובץ `.xls` של לאומי (HTML disguised as XLS) נקרא מפורשות לפי כותרות חובה/זכות; יתרה אינה משמשת כסכום התנועה.
- יבוא אשראי קורא את כל הגיליונות, שומר קטגוריה, 4 ספרות, תאריך חיוב ותאריך עסקה.
- זיכוי/ביטול עסקה בכרטיס נשמר בסכום שלילי ולכן מפחית הוצאות במקום להפוך להוצאה חיובית.
- עסקאות אשראי משויכות לחודש החיוב (`charge_date`) לצורך סיכום חודשי, תוך שמירת תאריך העסקה המקורי.
- זכות בנקאית לא ודאית מסומנת `income_review` ואינה נספרת כהכנסה עד לאישור ידני.
- עריכה ידנית מסומנת `manual_override`, כך שיבוא חוזר לא דורס את הסיווג/קטגוריה שאושרו ידנית.
- נוספה התאמה סמנטית ליבוא חוזר כדי לצמצם כפילויות שנוצרו בגלל שינויי `external_id` בין V17/V20/V22.
- תצוגת מטבע שומרת אגורות (עד שתי ספרות) במקום לעגל תמיד לשקל שלם.

## התקנה / שדרוג
1. ב-Supabase SQL Editor להריץ פעם אחת את `supabase/v23_unified_ledger.sql`.
2. לפרוס את תיקיית V23 ב-Vercel/סביבת Vite כרגיל.
3. לייבא מחדש קובץ בנק וקבצי אשראי. מנגנון ה-upsert + ההתאמה הסמנטית נועד לעדכן רשומות קיימות במקום להכפיל אותן ככל שניתן.

> אין צורך להריץ שוב את `v20_financial_flow.sql`; הוא נשאר בתיקייה רק כתיעוד לגרסה הקודמת.


---

## מקור: README-V24.md

# Home Expenses Manager V24.8

See `README-V24.8.md` for the latest changes.

# Current release: v24.7

# Home Expenses Manager V24

V24 combines the richer category/analytics UI from the older versions with the audited bank/card ledger from V23.

## Before deploying

Your database already has the V23 columns, so in Supabase SQL Editor run only:

`supabase/v24_upgrade.sql`

Then optionally run:

`supabase/v24_verify.sql`

## Deploy

Upload the contents of this ZIP to the existing GitHub repository. Vercel can keep using the existing Supabase environment variables/integration. Do not commit real Supabase keys.

## Main V24 changes

- Bank import uses **transaction date**, description, reference, debit and credit. Value date and opening balance do not affect classification.
- Debit > 0 = money out. Debit = 0 and credit > 0 = money in.
- Ordinary incoming credits are counted as income immediately; likely self-transfers/Leumi/savings remain for review.
- A deposit redemption can be edited so only the profit portion counts as real income.
- Direct bank/card duplicates are linked only on a strong amount/date/merchant match; unmatched bank debits remain expenses so foreign/direct charges are not lost.
- Category dashboard, month comparison, drill-down, multi-select recategorization, merchant rules, budgets and category integrity checks are restored.
- Category-only changes do not modify `count_as_expense` or the transaction amount.
- Future planning supports expected income and future expenses, with a combined history + plan forecast and projected savings.

## V24.1 bank-import repair
If older bank imports display impossible multi-million shekel amounts with a date in the merchant field, run `supabase/v24_1_repair_bank_import.sql` once, then re-import the Leumi bank file. The repair backs up only the unmistakably malformed rows before deleting them. The importer now rejects shifted rows defensively.


## V24.4
See README-V24.4.md. Card details now take precedence over matching generic bank debits.


---

## מקור: README-V24.2.md

# Home Expenses Manager v24.2

גרסת clean re-import לאחר בעיית קריאת קובץ הבנק.

## סדר עבודה מומלץ
1. ב-Supabase SQL Editor להריץ `supabase/v24_2_clean_reimport.sql` פעם אחת.
2. לוודא שבתוצאת הבדיקה בסוף מופיע `0` עבור `transactions` ו-`import_batches`.
3. להעלות את תוכן הפרויקט ל-GitHub; Vercel יבנה מחדש אוטומטית.
4. באפליקציה לייבא קודם את כל קובצי האשראי המקוריים.
5. לבדוק שסיכום הייבוא נראה הגיוני.
6. לאחר מכן לייבא את קובץ הבנק המקורי.

האיפוס אינו מוחק קטגוריות, כללי בתי עסק, תקציבים או תכנון עתידי. לפני המחיקה נוצרים גיבויים בטבלאות `transactions_backup_v242` ו-`import_batches_backup_v242`.

v24.2 מחזקת את קריאת קובץ ה-HTML של לאומי כדי לבחור רק את טבלת 8 העמודות האמיתית, ולא wrapper שמכיל את הטבלה כטקסט שטוח. לאחר כל ייבוא מוצג סיכום של מספר הרשומות והסכומים שנקלטו.


---

## מקור: README-V24.3.md

# Home Expenses Manager V24.3

## Changes
- Fixes Visa Direct / immediate card expenses: bank row owns a direct expense; duplicated card row is excluded.
- Monthly card statement is excluded only when it matches the aggregate card purchases for the charge date.
- Unmatched bank card debit stays an expense instead of disappearing.
- Selectable primary dashboard category (Settings are under Budgets).
- Category comparison automatically falls back two months when previous month is zero (useful for bi-monthly utilities).
- Income cards are clickable and open the month's income transaction table.
- Import integrity check now verifies raw file rows independently of cross-source de-duplication.

Run `supabase/v24_3_upgrade.sql` before deploying the app.


---

## מקור: README-V24.4.md

# Home Expenses Manager V24.4

V24.4 changes direct-card reconciliation so the most informative record wins.

- If a bank debit matches exactly one card transaction by amount and nearby date, the **card transaction remains the counted expense**. Its merchant and category stay visible.
- The matching bank row becomes `card_payment`, is linked to the card row, and is not counted again.
- If there is no safe card match, the bank debit stays a real expense so foreign/direct charges are never silently lost.
- The migration repairs V24.3 rows that used the opposite ownership rule.

Run `supabase/v24_4_upgrade.sql` once, then deploy this project to GitHub/Vercel.


---

## מקור: README-V24.5.md

# Home Expenses Manager v24.5

תיקון reconciliation של כרטיסי אשראי מול עו״ש.

## העיקרון
- קובץ האשראי המפורט הוא מקור האמת להוצאה כאשר קיימת התאמה.
- חיוב בנקאי של חברת כרטיסים לא נספר כהוצאה נוספת אם הוא מוסבר על ידי עסקאות האשראי.
- התאמה ראשונה: סכום מצטבר לפי 4 ספרות אחרונות + תאריך חיוב.
- התאמה שנייה: חיוב Direct בודד לפי סכום ותאריך.
- התאמה שלישית: סכום חודשי מצטבר לפי חברת כרטיס, כאשר אין התאמה שורה-מול-שורה.
- חיוב בנקאי שאין לו פירוט אשראי מתאים נשאר הוצאה כדי שלא יאבד.

## תיקון נתונים קיימים
בטעינת האפליקציה v24.5 משחזרת אוטומטית שורות אשראי שנוטרלו בגרסאות קודמות ומבצעת reconciliation מחדש. אין צורך למחוק ולייבא מחדש.

## בדיקת מקור
בדיקת המקור בדשבורד משווה כעת את קובצי האשראי עצמם לעסקאות האשראי שנקלטו, ולא מערבבת תנועות settlement מהבנק.


---

## מקור: README-V24.6.md

# Home Expenses Manager v24.6

Changes:
- Fixed invisible dashboard labels/amounts on clickable cards (white-on-white CSS).
- Primary dashboard category can now be changed directly from the dashboard card.
- Added Categories tab for adding, deleting and merging categories.
- A category that is in use cannot be deleted until a replacement category is selected. Transactions, merchant rules and planned items are reassigned before deletion.
- Added merchant-level insights: top merchants for the selected month are clickable. The history modal compares total spend, transaction count and average transaction value by month, with drill-down to transactions.
- Keeps v24.5 bank/card reconciliation logic unchanged.

No new Supabase SQL migration is required after v24.5.


---

## מקור: README-V24.7.md

# Home Expenses Manager v24.7

## Card ↔ bank reconciliation rebuilt from the real uploaded files

### Source of truth
- Detailed credit-card files are the source of truth for merchant, category and expense details.
- Bank files are the source of truth for cash movement and are used to verify settlement.
- A matched bank card debit is never counted as an additional expense.
- If no matching card detail exists yet, the bank debit remains an expense so money is never lost.

### Two dates, two jobs
- `date` / transaction date controls the expense month shown in analytics.
- `charge_date` controls reconciliation with the bank.
- Therefore a July purchase that settles in August remains a July expense.

### Matching order
1. Exact card transaction: charge date + amount + card last4 when available from the bank reference.
2. Statement/group settlement: the signed sum of all remaining card rows on the same charge date + last4 equals one bank debit.
3. Conservative ±3-day exact fallback only when the match is unique.

Refunds/credits in card files stay signed and are included in statement totals.

### Verified against the supplied files
Across the seven uploaded card exports and the supplied Leumi bank export, all 57 Leumi Visa bank debits for which the corresponding card charge-date data exists were explainable by the detailed card data. Later bank debits for which the next card statement was not supplied intentionally remain unmatched expenses until that file is imported.

No Supabase schema migration is required for v24.7 if v24.x is already installed.


---

## מקור: README-V24.8.md

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


---

## מקור: README-V24.9.md

# v24.9

- Reconciliation no longer excludes credit-card rows after manual category edits (`manual_override`). Category edits cannot break Visa settlement matching.
- Card-file integrity checks are batch-wide, not transaction-month vs charge-month comparisons. False June/July ~11k gaps are removed.
- Data Check only raises issues that can affect totals: unmatched bank card debits, genuinely empty imported batches, or category-total mismatch.
- Known electricity/water/gas merchants use a two-month rolling monthly-equivalent for trend percentages. Actual paid expense totals are unchanged.
- Comparison table and Insights show the two-month monthly-equivalent for periodic utilities.


---

## מקור: README-V24.10.md

# Home Expenses Manager v24.10

## הוצאה מהירה – קול או טקסט

- כפתור **הוצאה מהירה** קבוע בראש האפליקציה.
- אפשר להכתיב מספר הוצאות ברצף בהקלטה אחת (עברית `he-IL`).
- אפשר גם להקליד טקסט חופשי כאשר זיהוי קולי אינו זמין.
- המערכת מפרקת את הדיבור לשורות נפרדות ומנסה לזהות סכום, תיאור, קטגוריה, אמצעי תשלום ותאריך.
- לפני השמירה מוצגת טבלת ביקורת: אפשר לתקן כל שדה או למחוק שורה.
- **שמור הכל** מכניס את כל ההוצאות בבת אחת כעסקאות ידניות, ולכן הן אינן משתתפות אוטומטית ב-reconciliation של קבצי בנק/אשראי.
- אין שינוי schema ואין SQL חדש בגרסה זו.

### דוגמאות
`סופר 120 שקל, מטפלת היום 160 שקל, אוכל לכלב 210 שקל`

`אתמול חניה 45 במזומן, היום מכולת 83 שקל`

> זיהוי קולי תלוי בתמיכת הדפדפן ובהרשאת מיקרופון. ההקלדה והטבלה זמינות תמיד.


---

## מקור: README-V24.11.md

# Home Expenses Manager v24.11

Changes from v24.10:

- Incoming savings/deposit redemptions are surfaced in the income area instead of disappearing.
- A savings return can be split into principal + real profit. Only the entered profit counts as income.
- Credit-card reconciliation in Insights is collapsed by default and expands on demand.
- Recurring-expense rows are clickable and open merchant history by month, then transaction-level detail.
- Keeps all v24.10 quick multi-expense voice/manual entry features.

No database schema migration is required when upgrading from the existing v24.x schema.


---

## מקור: README-V24.12.md

# Home Expenses Manager v24.12

## Quick expense fixes
- Removes temporal words (today/yesterday/day-before-yesterday) before merchant/category matching.
- Learns category suggestions from existing transaction history as well as merchant rules.
- Voice button now checks microphone permission/support and shows a real listening state.
- On browsers without Web Speech Recognition, focuses the text field and directs the user to the phone keyboard dictation microphone instead of silently failing.

No database migration is required from v24.11.


---

## מקור: README-V24.13.md

# v24.13

- Microphone permission is never requested during page load.
- Removed getUserMedia permission preflight; SpeechRecognition asks for permission only after clicking the voice button.
- Added explicit HTTPS/support/error messages for Opera and other browsers.
- Added a React error boundary so runtime errors show a useful message instead of a blank page.
- Keeps v24.12 quick-expense parsing and learned category matching.


---

## מקור: README-V24.14.md

# V24.14

Hotfix: restores the missing `sortRows` helper used by the monthly expenses table. No database migration is required.


---

## מקור: README-V24.15.md

# Home Expenses Manager v24.15

Hotfix release for v24.14. Restores UI components accidentally removed during the recent quick-expense/microphone changes: Auth, ExpenseModal, TransactionTable, TransactionDetails, IncomeReviewPanel, SavingsReviewPanel, DataCheckModal and SortHeader. Keeps v24.14 behavior including deferred microphone permission and the runtime error boundary.

No Supabase SQL migration is required.


---

## מקור: README-V24.16.md

# V24.16

- Microphone permission is requested explicitly only after the user clicks the voice button.
- Opera/Chromium now shows a visible "requesting microphone permission" state and actionable permission errors.
- After permission is granted, Web Speech Recognition starts; a watchdog reports when Opera exposes the API but does not actually start transcription.
- No microphone API runs during application/page load.


---

## מקור: README-V24.17.md

# v24.17

Hotfix packaging release.

- Verified `package.json` is valid JSON and not HTML.
- Keeps all v24.16 application changes.
- No Supabase SQL migration is required.

When uploading to GitHub, replace the existing root `package.json` with the one from this package.


---

## מקור: README-V24.18.md

# V24.18

- Workspace switcher: one account can manage multiple homes/businesses and switch between them.
- New business workspace creation while preserving the existing shared join-code model.
- Every transaction, category, rule, budget, import and plan remains isolated by `household_id`.
- Manual/quick expenses can now be edited **and deleted**. Imported bank/card transactions cannot be deleted from the edit modal, protecting reconciliation history.
- Planned items already support edit/delete and remain unchanged.

Before deploying V24.18, run `supabase/v24_18_upgrade.sql` once in Supabase.


---

## מקור: README-V24.19.md

# v24.19 – server-side voice transcription + quick income/expense entry

## New
- Voice no longer uses browser SpeechRecognition. The browser records audio with MediaRecorder and sends it to `/api/transcribe`.
- `/api/transcribe` runs on Vercel and sends the audio to Groq Whisper (`whisper-large-v3-turbo`).
- Add `GROQ_API_KEY` in Vercel Project Settings -> Environment Variables. Never put the real key in GitHub.
- Quick entry supports both expenses and incomes.
- Voice/text can explicitly say `קטגוריה <name>` and the parser matches it to an existing category.
- Every transcription becomes a review table first. Type, description, amount, category, payment method and date can all be edited or individual rows removed before final save.
- Nothing is inserted into Supabase until the user clicks the final save button.

## Examples
- `סופר 120 שקל קטגוריה סופר, מטפלת 160 שקל קטגוריה תינוק`
- `הכנסה קיבלתי בביט 350 שקל קטגוריה עבודה`

## Setup
1. Create a Groq API key.
2. Vercel -> Project -> Settings -> Environment Variables.
3. Add `GROQ_API_KEY` for Production (and Preview if desired).
4. Redeploy.

No Supabase SQL migration is required for v24.19.


---

## מקור: README-V24.20.md

# Home Expenses Manager v24.20

## Voice entry fixes
- Shows the complete raw transcript before parsing.
- New recordings append to the transcript but do not overwrite or mutate the existing draft table.
- Explicit **Parse / update table** step. Nothing is saved automatically.
- Switches transcription from `whisper-large-v3-turbo` to the more accurate multilingual `whisper-large-v3`.
- Adds server-side structured parsing through Groq (`llama-3.3-70b-versatile`) using the workspace category list, with the existing local parser as fallback.
- Draft remains fully editable: expense/income, merchant, amount, category, payment method and date.
- No database migration is required. Existing `GROQ_API_KEY` is used by both server endpoints.


---

## מקור: README-V24.21.md

# v24.21

- Quick-entry transcript is now the source of truth; the draft table auto-refreshes after a short debounce whenever transcript text changes.
- Recording additions also trigger automatic draft refresh. A manual “Update now” button remains available.
- Quick-entry text and draft rows are persisted in localStorage per workspace so an unexpected page reload does not erase the draft.
- Removed the unsafe local-parser fallback that could invent wrong rows when Groq parsing failed. Existing draft remains untouched on parser failure.
- Parser API dynamically selects an available Groq chat model instead of assuming access to llama-3.3-70b-versatile.
- Stronger instructions preserve numeric digits exactly and keep real merchant descriptions rather than replacing them with generic “manual transaction”.


---

## מקור: README-V24.22.md

# v24.22

- Stable Supabase auth boot: avoids login/App flicker and refresh loops.
- Explicit persistent session in localStorage. Users stay signed in until logout.
- Forgot-password flow using Supabase resetPasswordForEmail.
- Password recovery screen after opening the email link.
- Includes all v24.21 quick-entry/voice improvements.

No database migration is required for v24.22.


---

## מקור: README-V24.23.md

# v24.23

- Personal transcription vocabulary: categories, merchant rules and recent merchant names are sent as Whisper prompt context.
- Quick-entry draft reload diagnostics and recovery remain enabled.
- Added `transactions.exclude_from_average`. Mark exceptional expenses so they remain real expenses but are excluded from the normalized monthly average.
- Dashboard shows actual monthly average and normalized monthly average without exceptional expenses.

Run `supabase/v24_23_upgrade.sql` once before using the new average flag.


---

## מקור: README-V24.24.md

# v24.24

- Removed the confusing six-month average from the main monthly view.
- Every selected month now shows actual expenses, ongoing expenses excluding marked exceptions, and the total marked as exceptional.
- Ongoing monthly expenses are compared with the previous month on the same basis (excluding exceptions).
- The month-comparison table now contains three summary rows: actual total, ongoing total without exceptions, and exceptions.
- No new Supabase migration is required beyond v24.23.


---

## מקור: README-V24.25.md

# v24.25

- Password reset now has a dedicated screen and requires an explicit email before sending.
- Reset status and Supabase errors are shown clearly instead of silently failing.
- Reset redirect uses the deployed site origin, reducing Redirect URL mismatches.
- Recovery links are recognized for both hash-token and PKCE/code flows.
- Includes all v24.24 monthly actual-vs-without-exceptions improvements.
- No database migration is required.

Supabase configuration: Authentication → URL Configuration should contain the deployed Vercel production URL in Site URL and Redirect URLs. Email provider/rate limits are controlled by Supabase and cannot be bypassed by the frontend.


---

## מקור: README-V24.26.md

# v24.26

Auth reliability fix built on v24.25/v24.24.

- Removed the custom Supabase auth storage key and returned to Supabase's stable default key.
- A manual email/password login clears stale local auth state first, so a broken refresh token cannot block a fresh login.
- Successful `signInWithPassword` now passes the returned session directly to the app instead of depending only on an auth callback.
- Login failures are shown clearly (invalid credentials, unconfirmed email, rate limit, network, or raw Supabase error).
- Simplified auth boot: one initial `getSession()` plus one auth-state listener; removed the competing fallback timer.
- Keeps the improved forgot-password screen and recovery flow from v24.25.
- No SQL migration is required for v24.26.


---

## מקור: README-V24.27.md

# v24.27

Auth rollback release.

- Restored the Supabase client auth configuration exactly to v24.21.
- Restored the v24.21 login/session flow (getSession + onAuthStateChange).
- Removed the v24.22-v24.26 custom auth/session logic.
- Added only a minimal Forgot Password call on top of the v24.21 login screen.
- Keeps PasswordRecovery for choosing a new password after opening the email link.
- Keeps all application features added through v24.24+.
- No SQL migration required.


---

## מקור: README-V24.28.md

# v24.28

Authentication rollback verification build.

- Login component is based directly on the v24.21 authentication flow.
- Supabase client configuration is identical to v24.21.
- Only a minimal Forgot password action and recovery screen were added.
- Removes the legacy custom auth key introduced in v24.22.
- Adds a visible `v24.28` badge on the login screen so the deployed frontend can be verified immediately.
- Keeps all current expense features, including monthly totals without exceptional expenses.
- No SQL migration required.


---

## מקור: README-V24.29.md

# v24.29

Workspace stability release.

- Prevents stale/asynchronous loads from switching the UI back to an older workspace.
- Every save/reload operation now reloads the current workspace explicitly.
- Quick entry captures the workspace ID before saving and saves all rows to that exact workspace.
- Background refreshes inside the same workspace no longer replace the whole app with the loading screen.
- Switching workspaces closes quick entry so a draft cannot accidentally cross workspaces.
- Keeps separate quick-entry drafts per workspace.
- No SQL migration required.


---

## מקור: README-V24.30.md

# v24.30

Clean redeploy package based on v24.29.

- Keeps the v24.29 workspace/quick-entry race-condition fixes.
- Keeps the v24.28 authentication rollback.
- package.json validated as strict JSON.
- Production build verified locally before packaging.
- No SQL migration required beyond previously required migrations.


---

## מקור: README-V24.31.md

# v24.31

Import safety release.

- Bank imports can update only existing bank (`עו״ש`) rows.
- Card imports can update only existing card (`אשראי`) rows.
- Manual (`ידני`) rows are never candidates for import overwrite.
- Reconciliation updates are constrained by household and expected source.
- No SQL migration required.


---

## מקור: README-V24.32.md

# v24.32

Credit-card statement reconciliation improvement.

- Keeps exact statement matching.
- Adds narrow statement-boundary matching when 1–3 purchases from the final 3 days explain the exact bank/card difference.
- Does not use a broad amount tolerance.
- Boundary purchases remain normal card expenses and remain available for a later statement reconciliation.
- Keeps household/source protections from v24.31.
- No SQL migration required.


---

## מקור: README-V24.33.md

# v24.33

Monthly credit-card reconciliation fix.

- A bank credit-card debit posted in month M is matched primarily against detailed card purchases from month M-1.
- Purchase expense month remains the actual transaction month.
- Bank settlement is retained but becomes `count_as_expense=false` only after a unique reconciliation.
- Card last-4 is required when available from the bank reference.
- Direct/foreign one-to-one matching remains separate.
- A bounded end-of-month boundary fallback may exclude up to 3 purchases from the final 3 calendar days only when they exactly explain the statement delta.
- Household/source protections from v24.31 remain.
- No SQL migration required.


---

## מקור: README-V24.34.md

# v24.34 — index.html deployment repair

This release keeps the v24.33 application logic unchanged and explicitly restores the root `index.html` Vite entrypoint. The HTML must not contain SQL.

Upload the extracted contents at the repository root. No database migration required.


---

## מקור: README-V24.35.md

# v24.35
- Verified manual income/expense deletion: delete() returns deleted id; reports RLS permission failure instead of false success.
- Direct delete button for manually entered income in income table.
- Weekly analytics on Insights tab, Sunday–Saturday across calendar month boundaries; category filter, drill-down, comparison, four historical weeks baseline, rising categories and merchants.
- No database migrations required for these changes. If deletion reports an RLS restriction, database policies need separate inspection; do not run unverified SQL.


---

## מקור: README-V24.36.md

v24.36: Restored weekly Sunday-Saturday analysis inside Insights, including cross-month weeks; verified manual income deletion code; repaired project package.json. No SQL migration required.


---

## מקור: README-V24.37.md

# v24.37 — ניתוח קניות בתוך ההוצאות

נוסף כרטיס "למה ההוצאות בסופר גדלו?" במסך חודש/הוצאות. בחירת קטגוריה ושבוע ראשון–שבת, כולל שבועות שחוצים חודשים; השוואה לשמונה שבועות קודמים מלאים, פירוט מספר ביקורים בבית עסק, עלות ממוצעת והערכת השפעת קניות נוספות; פתיחת עסקאות. לא נדרש SQL.

הערה: התאמת אשראי לא שונתה בגרסה זו; חיובים שאינם מותאמים ממשיכים להיות מסומנים לבדיקה.
