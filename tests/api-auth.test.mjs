import { test } from "node:test";
import assert from "node:assert/strict";
import { requireUser } from "../api/_auth.js";

const fakeRes = () => { const res = { code: 200, body: null }; res.status = c => { res.code = c; return res; }; res.json = b => { res.body = b; return res; }; return res; };
process.env.SUPABASE_URL = "https://demo.supabase.co";
process.env.SUPABASE_ANON_KEY = "public-key";

test("request without login is rejected (401)", async () => {
  const res = fakeRes();
  assert.equal(await requireUser({ headers: {} }, res), null);
  assert.equal(res.code, 401);
});
test("valid token is accepted", async () => {
  globalThis.fetch = async (url, opts) => ({ ok: url.endsWith("/auth/v1/user") && opts.headers.Authorization === "Bearer good", json: async () => ({ id: "u1" }) });
  assert.deepEqual(await requireUser({ headers: { authorization: "Bearer good" } }, fakeRes()), { id: "u1" });
});
test("expired token is rejected", async () => {
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  const res = fakeRes();
  assert.equal(await requireUser({ headers: { authorization: "Bearer old" } }, res), null);
  assert.equal(res.code, 401);
});
