import { supabase } from "../supabase.js";

// POST to our own /api functions with the user's login token (the server checks it before using Groq).
export async function postApi(path, body) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
}
