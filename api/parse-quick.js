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
  try {
    const transcript = String(req.body?.transcript || "").trim();
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.map(String).filter(Boolean).slice(0, 100) : [];
    if (!transcript) return res.status(400).json({ error: "לא התקבל תמלול לפענוח" });

    const system = `אתה ממיר תמלול דיבור בעברית לרשימת תנועות כספיות מובנות. החזר JSON בלבד במבנה {"entries":[...]}. כל entry: type שהוא expense או income, merchant תיאור קצר, amount מספר חיובי, category, payment_method, date_hint.\n\nכללים חשובים:\n- אל תמציא סכומים. סכום חייב להופיע בתמלול, גם אם במילים (למשל "ארבע מאות חמישים" = 450).\n- סדר התנועות חייב להישמר.\n- משפט יכול להיות בסדר סכום-תיאור או תיאור-סכום.\n- קטע קצר שמופיע מיד אחרי תנועה ושהוא שם קטגוריה יכול להיות הקטגוריה של אותה תנועה, גם אם נאמר אחרי פסיק.\n- אם המשתמש אומר במפורש "קטגוריה X", העדף את X אם היא קיימת ברשימת הקטגוריות.\n- category חייבת להיות אחת מהקטגוריות שסופקו. אם אין התאמה בטוחה, החזר "לא מסווג".\n- הכנסה מזוהה ממילים כמו הכנסה, קיבלתי, נכנס, זיכוי. אחרת ברירת מחדל expense.\n- payment_method: מזומן, ביט, אשראי, העברה, עו"ש. אם לא נאמר, בהוצאה ברירת מחדל מזומן ובהכנסה העברה.\n- date_hint יכול להיות today, yesterday, day_before_yesterday או null.\n- אל תאחד שתי תנועות שונות. אל תיצור תנועה מקטע שאין בו סכום.\n- merchant לא צריך לכלול את הסכום, מילת הזמן, אמצעי התשלום או המילה "קטגוריה".`;

    const user = `קטגוריות קיימות:\n${categories.map(c=>`- ${c}`).join("\n")}\n\nתמלול מלא:\n${transcript}`;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Groq parser error", response.status, data);
      return res.status(response.status).json({ error: data?.error?.message || "שירות הפענוח החזיר שגיאה" });
    }
    const raw = data?.choices?.[0]?.message?.content || "";
    let parsed;
    try { parsed = JSON.parse(cleanJsonText(raw)); }
    catch { return res.status(502).json({ error: "שירות הפענוח החזיר תשובה לא תקינה" }); }
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return res.status(200).json({ entries });
  } catch (error) {
    console.error("Quick parser failed", error);
    return res.status(500).json({ error: "לא ניתן לפענח כרגע" });
  }
}
