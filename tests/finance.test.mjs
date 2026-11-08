import { test } from "node:test";
import assert from "node:assert/strict";
import { isExpense, isIncome, merchantKey, incomeValue } from "../src/lib/finance.js";

test("card purchase counts as expense", () => {
  assert.equal(isExpense({ source: "אשראי", amount: 100, count_as_expense: true }), true);
});
test("monthly card settlement in the bank is NOT counted again", () => {
  assert.equal(isExpense({ source: "עו״ש", kind: "card_payment", category: "חיוב כרטיס אשראי", amount: 3900, count_as_expense: true }), false);
});
test("bank row waiting for card match is not an expense", () => {
  assert.equal(isExpense({ source: "עו״ש", category: "ממתין להתאמה", amount: 50, count_as_expense: true }), false);
});
test("income flags", () => {
  const salary = { flow_type: "income", count_as_income: true, amount: 16500, income_amount: null };
  assert.equal(isIncome(salary), true);
  assert.equal(incomeValue(salary), 16500);
  // deposit redemption where only the interest is real income
  assert.equal(incomeValue({ count_as_income: true, amount: 50000, income_amount: 420 }), 420);
});
test("merchant aliases group the same chain", () => {
  assert.equal(merchantKey("SHUFERSAL DEAL 123"), "שופרסל");
  assert.equal(merchantKey("סופר-פארם רמת ישי"), "סופר פארם");
});
