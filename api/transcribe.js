import { requireUser } from "./_auth.js";
import { buildWhisperPrompt, isPromptLengthError } from "./_whisperPrompt.js";

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
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const { audio, mimeType = "audio/webm", vocabulary = [] } = req.body || {};
    if (!audio || typeof audio !== "string") return res.status(400).json({ error: "לא התקבלה הקלטה" });
    const buffer = Buffer.from(audio, "base64");
    if (!buffer.length) return res.status(400).json({ error: "ההקלטה ריקה" });
    if (buffer.length > 3.5 * 1024 * 1024) return res.status(413).json({ error: "ההקלטה ארוכה מדי" });

    const ext = extensionFor(mimeType);
    const send = async (prompt) => {
      const form = new FormData();
      form.append("file", new Blob([buffer], { type: mimeType }), `recording.${ext}`);
      form.append("model", "whisper-large-v3");
      form.append("language", "he");
      form.append("temperature", "0");
      form.append("response_format", "json");
      if (prompt) form.append("prompt", prompt);
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: form,
      });
      return { response, data: await response.json().catch(() => ({})) };
    };
    // Vocabulary hint is byte-limited (api/_whisperPrompt.js). If Groq still rejects its length,
    // transcribe once more without it rather than failing the recording.
    let { response, data } = await send(buildWhisperPrompt(vocabulary));
    if (!response.ok && isPromptLengthError(data?.error?.message)) {
      console.warn("Whisper prompt rejected, retrying without vocabulary", data?.error?.message);
      ({ response, data } = await send(""));
    }
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
