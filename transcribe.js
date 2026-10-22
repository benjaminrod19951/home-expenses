import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Supabase's Vercel integration may expose SUPABASE_* variables without VITE_.
  // Read them only at build time and expose only the public URL/public key to the browser.
  const env = loadEnv(mode, process.cwd(), "");

  const url = (
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();

  const key = (
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  return {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(url),
      __SUPABASE_KEY__: JSON.stringify(key),
    },
  };
});
