import { test } from "node:test";
import assert from "node:assert/strict";
import { generateJoinCode, JOIN_ALPHABET, normalizeJoinCode } from "../src/lib/joinCode.js";

test("join codes: 10 characters, no look-alike characters, not repeated", () => {
  const codes = new Set(Array.from({ length: 500 }, () => generateJoinCode()));
  assert.equal(codes.size, 500);
  for (const c of codes) {
    assert.equal(c.length, 10);
    assert.ok([...c].every(ch => JOIN_ALPHABET.includes(ch)));
    assert.ok(!/[01OIL]/.test(c));
  }
});
test("typed codes are normalized (spaces, lowercase, dashes)", () => {
  assert.equal(normalizeJoinCode(" ab12-cd "), "AB12CD");
});
