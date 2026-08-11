import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabaseConfigError=(!url||!key)?'חסרים מפתחות Supabase ב-Vercel Environment Variables. צריך להגדיר SUPABASE URL + PUBLISHABLE/ANON KEY.' : '';
export const supabase=supabaseConfigError?null:createClient(url,key);
