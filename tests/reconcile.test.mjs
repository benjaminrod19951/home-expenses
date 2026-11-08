import { test } from "node:test";
import assert from "node:assert/strict";
import { planReconciliation } from "../src/lib/reconcile.js";
import { isExpense } from "../src/lib/finance.js";

let n = 0;
const card = (date, merchant, amount, charge_date, card_last4 = "1234", kind = "card_purchase") =>
  ({ id: `c${++n}`, source: "אשראי", date, month: date.slice(0, 7), merchant, amount, charge_date, card_last4, kind, flow_type: "expense", count_as_expense: true, count_as_income: false, reconciliation_status: "unmatched" });
const bank = (date, amount, reference = "", merchant = "לאומי ויזה") =>
  ({ id: `b${++n}`, source: "עו״ש", date, month: date.slice(0, 7), merchant, bank_description: merchant, bank_direction: "out", amount, reference, category: "אחר", kind: "expense", flow_type: "expense", count_as_expense: true, count_as_income: false, reconciliation_status: "unmatched" });
const apply = (rows, updates) => { const m = new Map(rows.map(r => [r.id, { ...r }])); for (const u of updates) Object.assign(m.get(u.id), u.payload); return [...m.values()]; };
const settle = rows => apply(rows, planReconciliation(rows).updates);
const byId = (rows, id) => rows.find(r => r.id === id);

test("September purchases charged in October match the October bank debit; months stay September", () => {
  const rows = [card("2026-09-12", "רמי לוי", 300, "2026-10-10"), card("2026-09-25", "פז", 200, "2026-10-10"), bank("2026-10-10", 500)];
  const out = settle(rows);
  const b = out.find(r => r.source === "עו״ש");
  assert.equal(b.reconciliation_status, "card_statement_sum_match");
  assert.equal(isExpense(b), false);
  assert.deepEqual(out.filter(r => r.source === "אשראי").map(r => [r.month, r.reconciliation_status]), [["2026-09", "card_detail_reconciled"], ["2026-09", "card_detail_reconciled"]]);
  assert.equal(out.filter(isExpense).reduce((s, r) => s + r.amount, 0), 500); // counted once
});

test("bank imported before card detail: the debit is NOT an expense, and is marked unmatched", () => {
  const out = settle([bank("2026-10-10", 500)]);
  assert.equal(out[0].reconciliation_status, "card_bank_unmatched");
  assert.equal(isExpense(out[0]), false);
  assert.equal(planReconciliation(out).diagnostics[0].nearest, null);
});

test("card imported before bank, then bank arrives: matched without duplicates", () => {
  let rows = settle([card("2026-09-12", "רמי לוי", 300, "2026-10-10")]);
  rows = settle([...rows, bank("2026-10-10", 300)]);
  assert.equal(rows.filter(isExpense).length, 1);
  assert.equal(rows.find(r => r.source === "עו״ש").linked_transaction_id, rows.find(r => r.source === "אשראי").id);
});

test("idempotent: running again on the same data writes nothing (no reset of good matches)", () => {
  const once = settle([card("2026-09-12", "רמי לוי", 300, "2026-10-10"), bank("2026-10-10", 300)]);
  assert.deepEqual(planReconciliation(once).updates, []);
});

test("failure half-way: the next run completes the job and ends in the same state", () => {
  const rows = [card("2026-09-01", "a", 100, "2026-10-02"), card("2026-09-02", "b", 50, "2026-10-02"), bank("2026-10-02", 150), card("2026-09-03", "c", 70, "2026-10-02", "5555", "card_direct"), bank("2026-10-02", 70, "5555")];
  const full = settle(rows);
  const { updates } = planReconciliation(rows);
  const half = apply(rows, updates.slice(0, Math.floor(updates.length / 2)));
  const finished = settle(half);
  const norm = rs => JSON.stringify([...rs].sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal(norm(finished), norm(full));
});

test("two cards with the same total on the same day: the bank reference decides; without it nothing is guessed", () => {
  const rows = [card("2026-09-05", "a", 400, "2026-10-10", "1111"), card("2026-09-06", "b", 400, "2026-10-10", "2222"), bank("2026-10-10", 400, "000-2222"), bank("2026-10-10", 400, "000-1111")];
  const out = settle(rows);
  const b1 = out.find(r => r.reference === "000-1111"), b2 = out.find(r => r.reference === "000-2222");
  assert.equal(byId(out, b1.linked_transaction_id).card_last4, "1111");
  assert.equal(byId(out, b2.linked_transaction_id).card_last4, "2222");
  const ambiguous = settle([card("2026-09-05", "a", 400, "2026-10-10", "1111"), card("2026-09-06", "b", 400, "2026-10-10", "2222"), bank("2026-10-10", 400)]);
  assert.equal(ambiguous.find(r => r.source === "עו״ש").reconciliation_status, "card_bank_unmatched");
});

test("partial match: difference is reported, no expense is created", () => {
  const rows = settle([card("2026-09-12", "a", 300, "2026-10-10"), bank("2026-10-10", 350)]);
  const d = planReconciliation(rows).diagnostics;
  assert.equal(d.length, 1);
  assert.equal(d[0].difference ?? d[0].nearest.difference, 50);
  assert.equal(rows.filter(isExpense).reduce((s, r) => s + r.amount, 0), 300);
});

test("bank posted two days after the statement charge date (weekend) still matches", () => {
  const out = settle([card("2026-09-12", "a", 300, "2026-10-10"), bank("2026-10-12", 300)]);
  assert.equal(out.find(r => r.source === "עו״ש").reconciliation_status, "card_statement_sum_match_near_date");
});

test("a stale link is cleared when the bank row disappears (e.g. moved/deleted)", () => {
  let rows = settle([card("2026-09-12", "a", 300, "2026-10-10"), bank("2026-10-10", 300)]);
  rows = settle(rows.filter(r => r.source === "אשראי"));
  assert.equal(rows[0].reconciliation_status, "card_detail_primary");
  assert.equal(rows[0].linked_transaction_id, null);
});
