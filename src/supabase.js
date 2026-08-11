import {createClient} from '@supabase/supabase-js';
const rawUrl=import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const url=String(rawUrl).trim().replace(/\/$/,'');
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '';
const badUrl=url && !/^https:\/\/[^\s/]+\.supabase\.co$/i.test(url);

export const supabaseConfigError=(!url||!key)?'חסרים מפתחות Supabase ב-Vercel Environment Variables. צריך להגדיר SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (או SUPABASE_ANON_KEY).' : (badUrl?'כתובת SUPABASE_URL אינה תקינה. היא צריכה להיות כתובת הפרויקט, למשל https://xxxxx.supabase.co, בלי /dashboard או /project.':'');
export const supabase=supabaseConfigError?null:createClient(url,key);
