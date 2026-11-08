import { test } from "node:test";
import assert from "node:assert/strict";
import { orderModels, isModelError, _resetModelCache } from "../api/_groqModels.js";

process.env.GROQ_API_KEY = "test-key";
process.env.SUPABASE_URL = "https://demo.supabase.co";
process.env.SUPABASE_ANON_KEY = "public-key";
const { default: handler } = await import("../api/parse-quick.js");

const fakeRes = () => { const r = { code: 200, body: null }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; return r; };
const req = { method: "POST", headers: { authorization: "Bearer good" }, body: { transcript: "150 שקל טיטולים", categories: ["תינוק"], historyMerchants: [] } };
const json = (status, body) => ({ ok: status < 300, status, json: async () => body });

test("model order: env override, then preferred models this key can use, never whisper/guard", () => {
  assert.deepEqual(orderModels(["whisper-large-v3", "llama-3.1-8b-instant", "openai/gpt-oss-20b"], ""), ["openai/gpt-oss-20b", "llama-3.1-8b-instant"]);
  assert.equal(orderModels(["x-model", "openai/gpt-oss-20b"], "x-model")[0], "x-model");
  assert.equal(orderModels([], "")[0], "openai/gpt-oss-120b"); // model list unavailable
  assert.equal(isModelError(404, "The model `llama-3.3-70b-versatile` does not exist or you do not have access to it."), true);
});

test("regression: a retired/inaccessible model falls back to the next one instead of failing", async () => {
  _resetModelCache();
  const calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (url.endsWith("/auth/v1/user")) return json(200, { id: "u1" });
    if (url.endsWith("/models")) return json(200, { data: [{ id: "llama-3.3-70b-versatile" }, { id: "llama-3.1-8b-instant" }] });
    const model = JSON.parse(opts.body).model;
    calls.push(model);
    if (model === "llama-3.3-70b-versatile") return json(404, { error: { message: "The model `llama-3.3-70b-versatile` does not exist or you do not have access to it." } });
    return json(200, { choices: [{ message: { content: '{"entries":[{"type":"expense","merchant":"טיטולים","amount":150,"category":"תינוק"}]}' } }] });
  };
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.model, "llama-3.1-8b-instant");
  assert.equal(res.body.entries[0].amount, 150);
  assert.deepEqual(calls, ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]);
});

test("a wrong API key is reported once, not retried on every model", async () => {
  _resetModelCache();
  let chatCalls = 0;
  globalThis.fetch = async url => {
    if (url.endsWith("/auth/v1/user")) return json(200, { id: "u1" });
    if (url.endsWith("/models")) return json(401, { error: { message: "Invalid API Key" } });
    chatCalls++;
    return json(401, { error: { message: "Invalid API Key" } });
  };
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.code, 401);
  assert.equal(chatCalls, 1);
});
