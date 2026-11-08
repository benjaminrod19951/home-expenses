import { test } from "node:test";
import assert from "node:assert/strict";
process.env.TZ = "Asia/Jerusalem"; // dates must be correct in Israel time
const { dateToLocalISO, localISO, monthOffset, daysInMonth, money } = await import("../src/lib/format.js");

test("Excel date at local midnight stays on the same day", () => {
  assert.equal(dateToLocalISO(new Date(2026, 9, 1)), "2026-10-01");
});
test("Excel date a few seconds before midnight (SheetJS quirk) rounds to the right day", () => {
  assert.equal(dateToLocalISO(new Date(2026, 9, 1, 0, 0, -21)), "2026-10-01");
});
test("Date at UTC midnight is also the right day", () => {
  assert.equal(dateToLocalISO(new Date("2026-10-01T00:00:00Z")), "2026-10-01");
});
test("localISO uses the local day just after midnight (toISOString would give yesterday)", () => {
  assert.equal(localISO(new Date("2026-11-08T00:30:00+02:00")), "2026-11-08");
});
test("monthOffset crosses years", () => {
  assert.equal(monthOffset("2026-01", -1), "2025-12");
  assert.equal(monthOffset("2026-12", 1), "2027-01");
});
test("daysInMonth", () => {
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(daysInMonth("2028-02"), 29);
  assert.equal(daysInMonth("2026-10"), 31);
});
test("money keeps agorot", () => {
  assert.match(money(54.9), /54\.9/);
});
