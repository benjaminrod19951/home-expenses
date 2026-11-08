import { test } from "node:test";
import assert from "node:assert/strict";
import { addDaysISO, buildPeriods, comparePeriod, merchantGroups, weekStartOf, groceryRows } from "../src/lib/grocery.js";

const r = (date, merchant, amount) => ({ id: `${date}${merchant}${amount}`, date, month: date.slice(0, 7), merchant, amount, category: "סופר", count_as_expense: true });

test("weeks start on Sunday, across months, years and daylight-saving changes", () => {
  assert.equal(weekStartOf("2026-10-01"), "2026-09-27"); // week crosses Sep/Oct
  assert.equal(weekStartOf("2026-11-08"), "2026-11-08"); // a Sunday
  assert.equal(weekStartOf("2027-01-01"), "2026-12-27"); // crosses the year
  assert.equal(weekStartOf("2026-03-28"), "2026-03-22"); // Israel DST starts 27.3.2026
  assert.equal(weekStartOf("2026-10-25"), "2026-10-25"); // DST ends that Sunday
  assert.equal(addDaysISO("2026-03-26", 3), "2026-03-29");
});
test("a week crossing a month is one period with all its days", () => {
  const rows = [r("2026-09-29", "רמי לוי", 300), r("2026-10-02", "רמי לוי", 200)];
  const p = buildPeriods(rows, "weeks", { weeks: 1, todayISO: "2026-10-03" });
  assert.equal(p.length, 1);
  assert.equal(p[0].total, 500);
  assert.equal(p[0].partial, false); // Saturday = full week
});
test("current week is partial and compared to the same days of earlier weeks", () => {
  const rows = [r("2026-10-25", "רמי לוי", 300), r("2026-10-30", "רמי לוי", 400), r("2026-11-01", "רמי לוי", 320)];
  const p = buildPeriods(rows, "weeks", { weeks: 2, todayISO: "2026-11-02" });
  assert.equal(p[1].partial, true);
  assert.equal(p[1].partialDays, 2);
  const { names, groupOf } = merchantGroups(p);
  const c = comparePeriod(p, 1, names, groupOf);
  assert.equal(c.prevTotal, 300); // only Sun–Mon of last week, not 700
  assert.equal(c.vsPrev.amount, 20);
});
test("main merchants come from the selected periods; the rest is 'אחר' and contributors are found", () => {
  const rows = [r("2026-11-01", "רמי לוי", 500), r("2026-11-02", "קצב", 200), r("2026-11-03", "a", 10), r("2026-11-03", "b", 10), r("2026-11-03", "c", 10), r("2026-11-03", "d", 10), r("2026-11-03", "e", 10),
    r("2026-10-25", "רמי לוי", 300), r("2026-10-26", "קצב", 200)];
  const p = buildPeriods(rows, "weeks", { weeks: 2, todayISO: "2026-11-07" });
  const { names, groupOf } = merchantGroups(p);
  assert.equal(names.length, 6);
  assert.equal(names[5], "אחר");
  const c = comparePeriod(p, 1, names, groupOf);
  assert.equal(c.contributors[0].name, "רמי לוי");
  assert.equal(c.contributors[0].vsPrev.amount, 200);
  assert.equal(c.merchants.reduce((s, m) => s + m.amount, 0), c.total); // parts add up to the bar
});
test("only real grocery expenses are used", () => {
  const rows = groceryRows([r("2026-11-01", "רמי לוי", 100), { ...r("2026-11-01", "פז", 200), category: "רכב ותחבורה" }, { ...r("2026-11-01", "x", 50), count_as_expense: false }]);
  assert.equal(rows.length, 1);
});
