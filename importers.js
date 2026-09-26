export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };

function cleanJsonText(text="") {
  const s = String(text || "").trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : s).trim();
}

async function chooseModel(key) {
  const preferred = [
    "openai/gpt-oss-20b",
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
  ];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json().catch(()=>({}));
    const ids = new Set((d?.data || []).map(x => x?.id).filter(Boolean));
    return preferred.find(id => ids.has(id)) || "llama-3.1-8b-instant";
  } catch {
    return "llama-3.1-8b-instant";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: "GROQ_API_KEY לא מוגדר ב-Vercel" });
  try {
    const transcript = String(req.body?.transcript || "").trim();
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.map(String).filter(Boolean).slice(0, 120) : [];
    if (!transcript) return res.status(400).json({ error: "לא התקבל תמלול לפענוח" });

    const system = `אתה ממיר תמלול דיבור בעברית לרשימת תנועות כספיות. החזר JSON בלבד: {"entries":[...]}.\nכל entry: type=expense|income, merchant, amount מספר חיובי, category, payment_method, date_hint.\n\nכללים קריטיים:\n- העתק סכומים בדיוק מהתמלול. 380 חייב להישאר 380; 3880 חייב להישאר 3880. אל תוסיף או תסיר ספרות ואפסים.\n- אם סכום נאמר במילים, המר אותו למספר רק אם הוא חד-משמעי.\n- merchant הוא התיאור שנאמר ליד הסכום; אל תחליף אותו ב\"תנועה ידנית\" אם יש תיאור אמיתי.\n- קטע אחרי הסכום יכול להיות קטגוריה. אם נאמר \"קטגוריה X\" השתמש ב-X אם הוא נמצא ברשימה.\n- category חייבת להיות אחת מהקטגוריות שסופקו; אם אין התאמה בטוחה החזר \"לא מסווג\". אל תמציא קטגוריה.\n- הכנסה: מילים כמו הכנסה, קיבלתי, נכנס, זיכוי. אחרת ברירת מחדל expense.\n- payment_method: מזומן, ביט, אשראי, העברה, עו\"ש. אם לא נאמר: expense=מזומן, income=העברה.\n- date_hint: today, yesterday, day_before_yesterday או null.\n- אל תאחד תנועות. אל תיצור שורה בלי סכום. שמור סדר.\n- מילים כמו היום/אתמול/שלשום אינן חלק מה-merchant.\n- אם הטקסט אומר למשל \"שתי מנורות 380 שקל קטגוריה עיצוב הבית\", החזר merchant=\"שתי מנורות\", amount=380, category=\"עיצוב הבית\" אם היא קיימת.`;
    const user = `קטגוריות קיימות:\n${categories.map(c=>`- ${c}`).join("\n")}\n\nתמלול מלא:\n${transcript}`;
    const model = await chooseModel(key);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Groq parser error", response.status, model, data);
      return res.status(response.status).json({ error: data?.error?.message || "שירות הפענוח החזיר שגיאה" });
    }
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
