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
