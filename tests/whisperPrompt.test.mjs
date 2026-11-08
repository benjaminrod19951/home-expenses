import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWhisperPrompt, isPromptLengthError, WHISPER_PROMPT_MAX_BYTES } from "../api/_whisperPrompt.js";

const bytes = s => new TextEncoder().encode(s).length;
const hebrewVocab = Array.from({ length: 300 }, (_, i) => ["רמי לוי", "שופרסל דיל", "הקצביה של משה", "פירות וירקות אבי", "סופר פארם", "מסעדות ומשלוחים"][i % 6] + " " + i);

test("regression: long Hebrew history stays under Groq's 896-byte limit (was 1,058)", () => {
  const p = buildWhisperPrompt(hebrewVocab);
  assert.ok(bytes(p) <= WHISPER_PROMPT_MAX_BYTES, `${bytes(p)} bytes`);
  assert.ok(bytes(p) < 896);
  assert.ok(p.includes("רמי לוי"));
});
test("empty / missing vocabulary still gives a short valid prompt", () => {
  assert.ok(bytes(buildWhisperPrompt([])) < 200);
  assert.ok(bytes(buildWhisperPrompt(undefined)) < 200);
});
test("a single huge term is skipped instead of breaking the limit", () => {
  const p = buildWhisperPrompt(["א".repeat(2000), "פז"]);
  assert.ok(bytes(p) <= WHISPER_PROMPT_MAX_BYTES);
  assert.ok(p.endsWith("פז"));
});
test("Groq's prompt-length error is recognised (for the retry without vocabulary)", () => {
  assert.equal(isPromptLengthError("prompt length must be 896 characters or fewer, but provided prompt contains 1058 characters"), true);
  assert.equal(isPromptLengthError("invalid api key"), false);
});
