import { createClient } from "@supabase/supabase-js";

const rawUrl = typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : "";
const rawKey = typeof __SUPABASE_KEY__ !== "undefined" ? __SUPABASE_KEY__ : "";

const supabaseUrl = String(rawUrl).trim().replace(/\/+$/, "");
const supabaseKey = String(rawKey).trim();

export const supabaseConfigError = !supabaseUrl
  ? "Supabase URL חסר. ב-Vercel ודא שקיים SUPABASE_URL או VITE_SUPABASE_URL."
  : !supabaseKey
    ? "מפתח Supabase חסר. ב-Vercel ודא שקיים SUPABASE_PUBLISHABLE_KEY או SUPABASE_ANON_KEY."
    : !/^https:\/\/[^/]+\.supabase\.co$/i.test(supabaseUrl)
      ? `כתובת Supabase אינה תקינה: ${supabaseUrl}`
      : "";

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
