// Choosing the Groq chat model for parsing quick entries.
// v24.43 hard-coded "llama-3.3-70b-versatile"; when Groq retired it / the account had no access, every AI parse failed
// ("The model ... does not exist or you do not have access to it"). Now: optional GROQ_PARSE_MODEL env var,
// then a preference list, filtered by the models this API key can actually use; on a model error, try the next one.
export const PREFERRED_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "llama-3.1-8b-instant",
];
const NOT_CHAT = /whisper|tts|guard|playai|orpheus|distil|compound|allam/i;

export function orderModels(availableIds, envModel) {
  const avail = (availableIds || []).filter(id => id && !NOT_CHAT.test(id));
  const wanted = [envModel, ...PREFERRED_MODELS].filter(Boolean);
  if (!avail.length) return [...new Set(wanted)]; // model list unavailable: try the preference list
  const inList = wanted.filter(id => avail.includes(id));
  const rest = avail.filter(id => !inList.includes(id)).sort();
  return [...new Set([...inList, ...rest])];
}

export const isModelError = (status, message) =>
  status === 404 || /model.*(does not exist|not found|decommission|deprecated|no access|not have access|not supported)/i.test(String(message || ""));
export const isFormatError = message => /response_format|json_object|json mode/i.test(String(message || ""));

let cache = { at: 0, ids: [] };
export async function availableModels(key, fetchFn = fetch) {
  if (Date.now() - cache.at < 10 * 60 * 1000 && cache.ids.length) return cache.ids;
  try {
    const r = await fetchFn("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json().catch(() => ({}));
    const ids = (d?.data || []).filter(m => m && m.active !== false).map(m => m.id);
    if (ids.length) cache = { at: Date.now(), ids };
    return ids;
  } catch {
    return [];
  }
}
export const _resetModelCache = () => { cache = { at: 0, ids: [] }; };
