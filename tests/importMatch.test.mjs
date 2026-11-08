import { test } from "node:test";
import assert from "node:assert/strict";
import { matchImportedRows, withOccurrence, installmentOf, cardIdentity } from "../src/lib/importMatch.js";
import { parseCardRows } from "../src/lib/importParse.js";

const HEAD = ["תאריך עסקה", "שם בית העסק", "סכום חיוב", "4 ספרות אחרונות", "תאריך חיוב", "הערות"];
const sheet = lines => parseCardRows([HEAD, ...lines], "עסקאות");
const store = rows => rows.map((r, i) => ({ ...r, id: `db${i + 1}` }));
const ids = m => m.map(x => x && x.id);

test("re-importing the same file updates the same rows", () => {
  const f = sheet([["01/09/2026", "רמי לוי", 120, "1234", "10/10/2026", ""], ["02/09/2026", "פז", 200, "1234", "10/10/2026", ""]]);
  assert.deepEqual(ids(matchImportedRows(sheet([["01/09/2026", "רמי לוי", 120, "1234", "10/10/2026", ""], ["02/09/2026", "פז", 200, "1234", "10/10/2026", ""]]), store(f))), ["db1", "db2"]);
});

test("different row order still matches the same rows", () => {
  const db = store(sheet([["01/09/2026", "רמי לוי", 120, "1234", "10/10/2026", ""], ["02/09/2026", "פז", 200, "1234", "10/10/2026", ""]]));
  assert.deepEqual(ids(matchImportedRows(sheet([["02/09/2026", "פז", 200, "1234", "10/10/2026", ""], ["01/09/2026", "רמי לוי", 120, "1234", "10/10/2026", ""]]), db)), ["db2", "db1"]);
});

test("two identical purchases on the same day stay two rows; a third copy is new", () => {
  const two = [["05/09/2026", "קפה", 18, "1234", "10/10/2026", ""], ["05/09/2026", "קפה", 18, "1234", "10/10/2026", ""]];
  const db = store(sheet(two));
  assert.notEqual(db[0].external_id, db[1].external_id);
  const m = matchImportedRows(sheet([...two, ["05/09/2026", "קפה", 18, "1234", "10/10/2026", ""]]), db);
  assert.deepEqual(ids(m), ["db1", "db2", null]);
});

test("same purchase on two different cards is never merged", () => {
  const db = store(sheet([["05/09/2026", "סופר", 50, "1111", "10/10/2026", ""]]));
  assert.deepEqual(ids(matchImportedRows(sheet([["05/09/2026", "סופר", 50, "2222", "10/10/2026", ""]]), db)), [null]);
});

test("installments with the same purchase date are separate transactions", () => {
  assert.equal(installmentOf("תשלום 2 מתוך 10"), "2/10");
  const db = store(sheet([["01/06/2026", "ריהוט", 300, "1234", "10/07/2026", "תשלום 1 מתוך 10"]]));
  assert.deepEqual(ids(matchImportedRows(sheet([["01/06/2026", "ריהוט", 300, "1234", "10/08/2026", "תשלום 2 מתוך 10"]]), db)), [null]);
});

test("rows saved by older versions (old external id, no card in id) are matched by details", () => {
  const old = [{ id: "legacy1", source: "אשראי", date: "2026-09-05", merchant: "רמי לוי", amount: 120, card_last4: "1234", charge_date: "2026-10-10", external_id: "card|2026-09-05|רמי לוי|120.00", source_key: "old-format" }];
  assert.deepEqual(ids(matchImportedRows(sheet([["05/09/2026", "רמי לוי", 120, "1234", "10/10/2026", ""]]), old)), ["legacy1"]);
});

test("overlapping files: a pending row without charge date later gets one — still the same transaction", () => {
  const db = store(sheet([["05/09/2026", "רמי לוי", 120, "1234", "", ""]]));
  assert.deepEqual(ids(matchImportedRows(sheet([["05/09/2026", "רמי לוי", 120, "1234", "10/10/2026", ""]]), db)), ["db1"]);
});

test("transaction date and charge date in different months are both kept", () => {
  const [r] = sheet([["30/09/2026", "פז", 200, "1234", "10/10/2026", ""]]);
  assert.equal(r.date, "2026-09-30");
  assert.equal(r.month, "2026-09");
  assert.equal(r.charge_date, "2026-10-10");
});

test("occurrence suffix does not depend on order", () => {
  assert.deepEqual(withOccurrence(["a", "b", "a"]), ["a", "b", "a|2"]);
  assert.match(cardIdentity({ date: "2026-09-05", merchant: "X", amount: -10, card_last4: "1", notes: "" }), /^card2\|2026-09-05\|x\|10\.00\|1\|$/);
});
