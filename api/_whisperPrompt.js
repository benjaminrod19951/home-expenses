// Builds the Whisper "prompt" (vocabulary hint) for Groq.
// Groq's limit is 896 *bytes* in UTF-8, not JavaScript characters: every Hebrew letter is 2 bytes.
// (v24.43 counted characters: 642 characters of Hebrew = ~1,060 bytes -> "prompt length must be 896 characters or fewer".)
// The limit does not depend on the length of the recording.
export const WHISPER_PROMPT_MAX_BYTES = 800; // safety margin under 896
const INTRO = "תמלל בעברית בדיוק, במיוחד סכומים ושמות בתי עסק. מילון: ";
const bytes = s => new TextEncoder().encode(s).length;

export function buildWhisperPrompt(vocabulary, maxBytes = WHISPER_PROMPT_MAX_BYTES) {
    const terms = Array.isArray(vocabulary) ? [...new Set(vocabulary.map(x => String(x || "").trim()).filter(Boolean))] : [];
    let prompt = INTRO.trim();
    let used = 0;
    for (const term of terms) {
        const next = (used ? `${prompt}, ` : `${INTRO}`) + term;
        if (bytes(next) > maxBytes)
            continue; // skip a long term, a shorter one may still fit
        prompt = next;
        used++;
    }
    return prompt;
}

export const isPromptLengthError = message => /prompt.*(length|long|characters)/i.test(String(message || ""));
