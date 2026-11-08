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
    const historyMerchants = Array.isArray(req.body?.historyMerchants) ? req.body.historyMerchants.map(String).filter(Boolean).slice(0, 120) : [];
    if (!transcript) return res.status(400).json({ error: "לא התקבל תמלול לפענוח" });

    // Keep prompts compact: some provider models reject long prompts.
    const system = 'החזר JSON בלבד במבנה {"entries":[{"type":"expense","merchant":"","amount":0,"category":"","payment_method":"מזומן","date_hint":null}]}. פענח כל הוצאה בנפרד. סכומים חייבים להיות מדויקים. type יכול להיות expense או income. date_hint יכול להיות today,yesterday,day_before_yesterday או null. בחר קטגוריה מהרשימה או לא מסווג. אל תמציא עסקאות.';
    const categoryList = categories.slice(0,30).join(', ').slice(0,220);
    const merchantList = historyMerchants.slice(0,12).join(', ').slice(0,140);
    const user = `קטגוריות: ${categoryList}\nעסקים מוכרים: ${merchantList}\nתמלול: ${transcript.slice(0,3500)}`;
    // Use a model with a normal chat context window, not an unexpectedly constrained model.
    const model = 'llama-3.3-70b-versatile';
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
