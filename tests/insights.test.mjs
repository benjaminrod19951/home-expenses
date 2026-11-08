import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFixedCharges, findPossibleDuplicates, forecastMonthEnd, monthProgress, totalUpToDay } from "../src/lib/insights.js";

const r = (date, merchant, amount) => ({ date, month: date.slice(0, 7), merchant, amount });

test("running month is compared to the same days of last month", () => {
  assert.deepEqual(monthProgress("2026-11", "2026-11-08"), { running: true, day: 8, days: 30 });
  assert.equal(monthProgress("2026-10", "2026-11-08").running, false);
  const prev = [r("2026-10-02", "a", 100), r("2026-10-08", "b", 50), r("2026-10-20", "c", 999)];
  assert.equal(totalUpToDay(prev, 8), 150);
});
test("forecast = spent so far + rest of last month", () => {
  const f = forecastMonthEnd({ currentRows: [r("2026-11-02", "a", 300)], previousRows: [r("2026-10-02", "a", 280), r("2026-10-20", "b", 700)], day: 8 });
  assert.deepEqual(f, { soFar: 300, restLastMonth: 700, forecast: 1000 });
});
test("duplicates: same merchant, amount and day", () => {
  const d = findPossibleDuplicates([r("2026-11-03", "Wolt", 142), r("2026-11-03", "WOLT", 142), r("2026-11-04", "Wolt", 142), r("2026-11-03", "קפה", 12), r("2026-11-03", "קפה", 12)]);
  assert.equal(d.length, 1); // small amounts are ignored
  assert.equal(d[0].count, 2);
  assert.equal(d[0].extra, 142);
});
test("fixed charge with a price increase", () => {
  const rows = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"].map(m => r(`${m}-06`, "נטפליקס", 54.9)).concat([r("2026-11-06", "נטפליקס", 69.9)]);
  const [n] = detectFixedCharges(rows, "2026-11");
  assert.equal(n.increased, true);
  assert.equal(Math.round(n.increase * 10) / 10, 15);
});
test("weekly shopping is not a fixed charge", () => {
  const rows = [];
  for (const m of ["2026-08", "2026-09", "2026-10"]) for (const d of ["05", "12", "19"]) rows.push(r(`${m}-${d}`, "שופרסל", 400));
  assert.equal(detectFixedCharges(rows, "2026-10").length, 0);
});

import { explainChange } from "../src/lib/insights.js";
test("why spending changed: by category, then by merchant inside a category", () => {
  const rows = [r("2026-09-05", "רמי לוי", 500), r("2026-10-05", "רמי לוי", 700), r("2026-10-06", "קצב", 200), r("2026-09-07", "פז", 300)]
    .map(x => ({ ...x, category: x.merchant === "פז" ? "רכב" : "סופר" }));
  const all = explainChange(rows, "2026-10", { todayISO: "2026-11-08" });
  assert.equal(all.increases[0].key, "סופר");
  assert.equal(all.increases[0].delta, 400);
  assert.equal(all.decreases[0].key, "רכב");
  const sup = explainChange(rows, "2026-10", { category: "סופר", todayISO: "2026-11-08" });
  assert.deepEqual(sup.increases.map(x => [x.label, x.delta, x.isNew]), [["רמי לוי", 200, false], ["קצב", 200, true]]);
});
