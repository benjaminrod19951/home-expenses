import { createClient } from "@supabase/supabase-js";

const buildUrl = typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : "";
const buildKey = typeof __SUPABASE_KEY__ !== "undefined" ? __SUPABASE_KEY__ : "";

const runtimeUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "";
const runtimeKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const supabaseUrl = String(buildUrl || runtimeUrl).trim().replace(/\/+$/, "");
const supabaseKey = String(buildKey || runtimeKey).trim();

export const supabaseConfigError = !supabaseUrl
  ? "Supabase URL חסר. ודא שב-Vercel/Supabase integration קיים SUPABASE_URL (או VITE_SUPABASE_URL)."
  : !supabaseKey
    ? "מפתח Supabase ציבורי חסר. ודא שקיים SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY."
    : !/^https:\/\/[^/]+\.supabase\.co$/i.test(supabaseUrl)
      ? `כתובת Supabase אינה תקינה: ${supabaseUrl}`
      : "";

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "home-expenses-auth-v1",
      },
    });
