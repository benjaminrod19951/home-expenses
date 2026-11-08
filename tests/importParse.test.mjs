import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyBank, excelDate, excelSerialToISO, parseCardRows, signedMoney } from "../src/lib/importParse.js";
import { isExpense, isIncome, isTransfer } from "../src/lib/finance.js";

test("Excel serial dates are calendar dates, in any time zone", () => {
  assert.equal(excelSerialToISO(46295), "2026-09-30");
  assert.equal(excelDate(46295), "2026-09-30");
  assert.equal(excelDate("30/09/2026"), "2026-09-30");
  assert.equal(excelDate("30.09.26"), "2026-09-30");
  assert.equal(excelDate("2026-09-30"), "2026-09-30");
  assert.equal(excelDate(46022), "2025-12-31"); // year boundary
});
test("money parsing: shekel sign, thousands, parentheses = negative", () => {
  assert.equal(signedMoney("₪1,234.50"), 1234.5);
  assert.equal(signedMoney("(50)"), -50);
});
test("card refund stays negative and reduces expenses", () => {
  const rows = parseCardRows([["תאריך עסקה", "שם בית העסק", "סכום חיוב"], ["01/09/2026", "זארה", 300], ["03/09/2026", "זארה", -100]], "עסקאות");
  assert.equal(rows.filter(isExpense).reduce((s, r) => s + r.amount, 0), 200);
});
test("card sheet kinds: regular, immediate debit, foreign", () => {
  const r = [["תאריך עסקה", "שם בית העסק", "סכום חיוב"], ["01/09/2026", "x", 10]];
  assert.equal(parseCardRows(r, "עסקאות במועד החיוב")[0].kind, "card_purchase");
  assert.equal(parseCardRows(r, "חיוב מיידי")[0].kind, "card_direct");
});
test("bank classification: card payment, savings, own transfer, salary, ordinary credit", () => {
  const card = classifyBank("לאומי ויזה חיוב", "out"), saving = classifyBank("הקמת פיקדון", "out"), transfer = classifyBank("העברה בין חשבונות", "out"), salary = classifyBank("משכורת", "in");
  assert.equal(card.kind, "card_payment"); assert.equal(card.count_as_expense, false);
  assert.equal(isTransfer({ ...saving }), true); assert.equal(saving.count_as_expense, false);
  assert.equal(transfer.kind, "transfer"); assert.equal(transfer.count_as_income, false);
  assert.equal(isIncome(salary), true);
  assert.equal(classifyBank("העברה מבנק לאומי", "in").kind, "income_review"); // possible own transfer -> review
});
