export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

function extensionFor(mime="") {
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: "GROQ_API_KEY לא מוגדר ב-Vercel" });
  try {
    const { audio, mimeType = "audio/webm" } = req.body || {};
    if (!audio || typeof audio !== "string") return res.status(400).json({ error: "לא התקבלה הקלטה" });
    const buffer = Buffer.from(audio, "base64");
    if (!buffer.length) return res.status(400).json({ error: "ההקלטה ריקה" });
    if (buffer.length > 3.5 * 1024 * 1024) return res.status(413).json({ error: "ההקלטה ארוכה מדי" });

    const form = new FormData();
    const ext = extensionFor(mimeType);
    form.append("file", new Blob([buffer], { type: mimeType }), `recording.${ext}`);
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "he");
    form.append("temperature", "0");
    form.append("response_format", "json");
    form.append("prompt", "תמלול בעברית של הוצאות והכנסות כספיות. שמור מספרים, שמות עסקים, תאריכים ומילים כמו קטגוריה, מזומן, ביט, אשראי והעברה.");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Groq transcription error", response.status, data);
      return res.status(response.status).json({ error: data?.error?.message || "שירות התמלול החזיר שגיאה" });
    }
    return res.status(200).json({ text: data.text || "" });
  } catch (error) {
    console.error("Transcription handler failed", error);
    return res.status(500).json({ error: "לא ניתן לתמלל כרגע" });
  }
}
