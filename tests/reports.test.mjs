import { test } from "node:test";
import assert from "node:assert/strict";
import { monthSummary, toExportRows } from "../src/lib/reports.js";
import { buildPeriods, groceryRows } from "../src/lib/grocery.js";

const tx = [
  { id: 1, month: "2026-10", date: "2026-10-03", merchant: "רמי לוי", amount: 400, category: "סופר", source: "אשראי", count_as_expense: true },
  { id: 2, month: "2026-10", date: "2026-10-10", merchant: "לאומי ויזה", amount: 3900, category: "חיוב כרטיס אשראי", source: "עו״ש", kind: "card_payment", flow_type: "card_payment", count_as_expense: false },
  { id: 3, month: "2026-10", date: "2026-10-01", merchant: "משכורת", amount: 16500, source: "עו״ש", flow_type: "income", count_as_income: true, count_as_expense: false },
  { id: 4, month: "2026-10", date: "2026-10-15", merchant: "פיקדון", amount: 5000, source: "עו״ש", flow_type: "saving", kind: "saving", count_as_expense: false, count_as_income: false },
  { id: 5, month: "2026-10", date: "2026-10-20", merchant: "חשמל", amount: 780, category: "חשבונות", source: "עו״ש", count_as_expense: true, exclude_from_average: true },
  { id: 6, month: "2026-10", date: "2026-10-22", merchant: "זיכוי", amount: -100, category: "סופר", source: "אשראי", count_as_expense: true },
];

test("month totals: card settlement, savings and income are not expenses", () => {
  const s = monthSummary(tx, "2026-10");
  assert.equal(s.total, 1080);
  assert.equal(s.income, 16500);
  assert.equal(s.normalizedTotal, 300);
  assert.equal(s.excludedTotal, 780);
});
test("dashboard, export and grocery chart agree on the same source data", () => {
  const s = monthSummary(tx, "2026-10");
  const exported = toExportRows(s.expenses);
  assert.equal(exported.reduce((a, x) => a + x["סכום"], 0), s.total);
  const [oct] = buildPeriods(groceryRows(tx), "months", { months: ["2026-10"], todayISO: "2026-11-08" });
  assert.equal(oct.total, s.byCategory.get("סופר"));
});
