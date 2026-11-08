import { requireUser } from "./_auth.js";
import { availableModels, isFormatError, isModelError, orderModels } from "./_groqModels.js";

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };

function cleanJsonText(text="") {
  const s = String(text || "").trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : s).trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: "GROQ_API_KEY לא מוגדר ב-Vercel" });
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const transcript = String(req.body?.transcript || "").trim();
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.map(String).filter(Boolean).slice(0, 120) : [];
    const historyMerchants = Array.isArray(req.body?.historyMerchants) ? req.body.historyMerchants.map(String).filter(Boolean).slice(0, 120) : [];
    if (!transcript) return res.status(400).json({ error: "לא התקבל תמלול לפענוח" });

    const system = 'החזר JSON בלבד במבנה {"entries":[{"type":"expense","merchant":"","amount":0,"category":"","payment_method":"מזומן","date_hint":null}]}. פענח כל הוצאה בנפרד. סכומים חייבים להיות מדויקים. type יכול להיות expense או income. date_hint יכול להיות today,yesterday,day_before_yesterday או null. בחר קטגוריה מהרשימה או לא מסווג. אל תמציא עסקאות. הסכום יכול להיאמר לפני או אחרי הפריט ("150 שקל, טיטולים, תינוק"). מילה ששווה לשם קטגוריה מהרשימה היא הקטגוריה ולא חלק מהתיאור. merchant הוא מה שנקנה או שם בית העסק (למשל "טיטולים", "פרחים") ולעולם לא ריק כשנאמר פריט.';
    // All categories must reach the model, otherwise it cannot choose e.g. "תינוק" (the old 220-character cut dropped them).
    const categoryList = categories.slice(0,80).join(', ').slice(0,1500);
    const merchantList = historyMerchants.slice(0,40).join(', ').slice(0,600);
    const user = `קטגוריות: ${categoryList}\nעסקים מוכרים: ${merchantList}\nתמלול: ${transcript.slice(0,3500)}`;
    // Model is chosen from what this API key can use (api/_groqModels.js); a retired model no longer breaks parsing.
    const models = orderModels(await availableModels(key), process.env.GROQ_PARSE_MODEL).slice(0, 4);
    let data = {}, model = "", lastStatus = 502, lastError = "שירות הפענוח החזיר שגיאה";
    for (const m of models) {
      for (const jsonMode of [true, false]) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: m,
            temperature: 0,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
            messages: [{ role: "system", content: system }, { role: "user", content: user }]
          })
        });
        const d = await response.json().catch(() => ({}));
        if (response.ok) { data = d; model = m; break; }
        lastStatus = response.status; lastError = d?.error?.message || lastError;
        console.error("Groq parser error", response.status, m, lastError);
        if (jsonMode && isFormatError(lastError)) continue;   // same model, without JSON mode
        break;                                                // next model (or stop below)
      }
      if (model) break;
      if (!isModelError(lastStatus, lastError) && !isFormatError(lastError)) break; // e.g. bad key / rate limit: do not hammer
    }
    if (!model) return res.status(lastStatus >= 400 ? lastStatus : 502).json({ error: lastError });
    const raw = data?.choices?.[0]?.message?.content || "";
    let parsed;
    try { parsed = JSON.parse(cleanJsonText(raw)); }
    catch { return res.status(502).json({ error: "שירות הפענוח החזיר תשובה לא תקינה" }); }
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return res.status(200).json({ entries, model });
  } catch (error) {
    console.error("Quick parser failed", error);
    return res.status(500).json({ error: "לא ניתן לפענח כרגע" });
  }
}
