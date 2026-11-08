// Shared by the /api functions (files starting with "_" are not exposed as routes by Vercel).
// Only a signed-in user of this app may use the Groq key. Without this check anyone who
// found the URL could run transcriptions on your account.
const env = (...names) => names.map(n => process.env[n]).find(v => v && String(v).trim())?.trim() || "";

export async function requireUser(req, res) {
  const url = env("SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const key = env(
    "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  if (!url || !key) {
    res.status(503).json({ error: "חסרים משתני Supabase בשרת (SUPABASE_URL ומפתח ציבורי) ב-Vercel" });
    return null;
  }
  const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    res.status(401).json({ error: "נדרשת התחברות" });
    return null;
  }
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      res.status(401).json({ error: "ההתחברות פגה. רענני את הדף והתחברי מחדש." });
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error("Auth check failed", e);
    res.status(503).json({ error: "לא ניתן לאמת התחברות כרגע" });
    return null;
  }
}
