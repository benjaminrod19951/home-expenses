import { test } from "node:test";
import assert from "node:assert/strict";
import { allocationSourceId, flowFields, manualFields, markDuplicatePayload, planDelete, planTransfer, restoreKindFix, unmarkDuplicatePayload } from "../src/lib/transactions.js";
import { isExpense, isIncome } from "../src/lib/finance.js";
import { planReconciliation } from "../src/lib/reconcile.js";
import { deleteManualTransaction, transferExpense } from "../src/services/transactionsService.js";

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
const SRC = "33333333-3333-3333-3333-333333333333";
const ws = [{ id: A, name: "בית" }, { id: B, name: "עסק" }];
const cardRow = { id: SRC, household_id: A, source: "אשראי", external_id: "card2|x", date: "2026-10-05", month: "2026-10", merchant: "מחשב", amount: 3000, kind: "card_purchase", flow_type: "expense", count_as_expense: true, payment_method: "אשראי", card_last4: "1234" };

// Minimal in-memory Supabase for the service tests
function fakeDb(rows, { failUpdateOf } = {}) {
  const db = rows.map(r => ({ ...r }));
  let seq = 100;
  const q = table => { const st = { f: [], op: "select" }; const api = {
    select() { return api; }, eq(k, v) { st.f.push(r => r[k] === v); return api; }, in(k, vs) { st.f.push(r => vs.includes(r[k])); return api; },
    limit() { return api; }, single() { st.one = true; return api; }, maybeSingle() { st.one = true; return api; },
    insert(p) { st.op = "insert"; st.p = p; return api; }, update(p) { st.op = "update"; st.p = p; return api; }, delete() { st.op = "delete"; return api; },
    then(res) { const m = r => st.f.every(f => f(r));
      if (st.op === "insert") { const row = { id: `new${++seq}`, ...st.p }; db.push(row); return res({ data: st.one ? row : [row], error: null }); }
      if (st.op === "update") { const hit = db.filter(m); if (failUpdateOf && hit.some(r => r.id === failUpdateOf)) return res({ data: null, error: { message: "network" } }); hit.forEach(r => Object.assign(r, st.p)); return res({ data: hit, error: null }); }
      if (st.op === "delete") { for (const r of db.filter(m)) db.splice(db.indexOf(r), 1); return res({ data: null, error: null }); }
      const hit = db.filter(m); return res({ data: st.one ? hit[0] || null : hit, error: null }); } }; return api; };
  return { db, from: q };
}

test("manual form: income, expense and deposit redemption count correctly (one shared formula)", () => {
  assert.deepEqual(flowFields({ flow_type: "income" }, 500), { kind: "income", flow_type: "income", count_as_expense: false, count_as_income: true, income_amount: 500 });
  assert.equal(flowFields({ flow_type: "saving", income_amount: 420 }, 50000).income_amount, 420);
  assert.equal(manualFields({ amount: 0 }, "2026-11-08").error, "צריך להזין סכום");
  assert.equal(manualFields({ amount: -80, category: "סופר" }, "2026-11-08").fields.amount, 80);
});

test("transfer: manual expense moves; imported expense is copied and stops counting at the origin", () => {
  const manual = { ...cardRow, source: "ידני", external_id: "manual-1" };
  assert.equal(planTransfer(manual, { originId: A, targetId: B, workspaces: ws }).mode, "move");
  const p = planTransfer(cardRow, { originId: A, targetId: B, workspaces: ws, userId: "u", originName: "בית" });
  assert.equal(p.mode, "allocate");
  assert.equal(p.copy.household_id, B);
  assert.equal(isExpense(p.copy), true);
  assert.equal(isExpense({ ...cardRow, ...p.sourceUpdate }), false); // counted once in total
  assert.equal(p.sourceUpdate.kind, undefined); // kind kept for an exact restore
  assert.equal(planTransfer(cardRow, { originId: A, targetId: A, workspaces: ws }).error, "יש לבחור מרחב יעד שונה");
  assert.match(planTransfer({ ...cardRow, flow_type: "income", count_as_expense: false, count_as_income: true }, { originId: A, targetId: B, workspaces: ws }).error, /רק הוצאות/);
});

test("transfer service: if updating the origin fails, the copy is removed (no double counting)", async () => {
  const sb = fakeDb([cardRow], { failUpdateOf: SRC });
  const r = await transferExpense(sb, cardRow, { originId: A, targetId: B, workspaces: ws, userId: "u" });
  assert.equal(r.ok, false);
  assert.equal(sb.db.length, 1);
  assert.equal(isExpense(sb.db[0]), true);
});

test("transfer then delete the copy: the expense comes back in the original workspace", async () => {
  const sb = fakeDb([cardRow]);
  assert.equal((await transferExpense(sb, cardRow, { originId: A, targetId: B, workspaces: ws, userId: "u", originName: "בית" })).ok, true);
  const copy = sb.db.find(r => r.household_id === B);
  assert.equal(allocationSourceId(copy), SRC);
  assert.equal(sb.db.filter(isExpense).length, 1);
  const d = await deleteManualTransaction(sb, copy, B);
  assert.equal(d.ok, true);
  assert.equal(d.restored, true);
  assert.equal(sb.db.length, 1);
  assert.equal(isExpense(sb.db[0]), true);
  assert.equal(sb.db[0].reconciliation_status, null);
});

test("delete: manual income can be deleted, imported rows cannot", async () => {
  const income = { id: "i1", household_id: A, source: "ידני", external_id: "manual-x", flow_type: "income", count_as_income: true, amount: 900 };
  assert.equal(isIncome(income), true);
  const sb = fakeDb([income, cardRow]);
  assert.equal((await deleteManualTransaction(sb, income, A)).ok, true);
  assert.equal(sb.db.length, 1);
  assert.match(planDelete(cardRow, A).error, /ידנית/);
});

test("old rows changed to kind 'transfer' get a proper kind back on restore", () => {
  assert.deepEqual(restoreKindFix({ kind: "transfer", source: "אשראי" }), { kind: "card_purchase" });
  assert.deepEqual(restoreKindFix({ kind: "card_direct", source: "אשראי" }), {});
});

test("marked duplicate is not counted, not re-counted by reconciliation, and can be undone", () => {
  const dup = { ...cardRow, id: "d2", ...markDuplicatePayload() };
  assert.equal(isExpense(dup), false);
  assert.equal(planReconciliation([dup]).updates.length, 0); // reconciliation must not turn it back into an expense
  assert.equal(isExpense({ ...dup, ...unmarkDuplicatePayload(dup) }), true);
});
