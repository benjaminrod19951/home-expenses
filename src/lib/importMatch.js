// Matching imported file rows to transactions that already exist in the database. PURE, tested.
//
// Goals: re-importing the same file (or an overlapping one, or rows in a different order) updates the
// existing rows instead of duplicating them, while two genuinely different transactions are never merged:
//  * different cards (last 4 digits) with the same purchase,
//  * installments ("תשלום 2 מתוך 10") that share the purchase date, merchant and amount,
//  * two identical purchases on the same day (paired one-to-one, never both onto one row).
// The row position in the file is never used as an identity.
import { normalizeMerchant } from "./finance.js";

const num = n => Number(n) || 0;
const sameAmount = (a, b) => Math.abs(num(a) - num(b)) < 0.005;
const compatible = (a, b) => !a || !b || a === b; // empty value = unknown, matches anything

export function installmentOf(notes) {
    const m = String(notes || "").match(/תשלום\s*(\d+)\s*(?:מתוך|מ-|\/)\s*(\d+)/);
    return m ? `${Number(m[1])}/${Number(m[2])}` : null;
}

// Identity used for NEW external ids of card rows (old rows keep their old ids).
export function cardIdentity(row, normMerchant = normalizeMerchant) {
    return ["card2", row.date, normMerchant(row.merchant), Math.abs(num(row.amount)).toFixed(2), row.card_last4 || "-", installmentOf(row.notes) || ""].join("|");
}

// Append |2, |3… to rows whose identity repeats inside the same file (first one keeps the plain id,
// so files imported before this change still match). Independent of row order.
export function withOccurrence(keys) {
    const seen = new Map();
    return keys.map(k => {
        const n = (seen.get(k) || 0) + 1;
        seen.set(k, n);
        return n === 1 ? k : `${k}|${n}`;
    });
}

function fieldsMatch(x, t) {
    if (t.source !== x.source || t.date !== x.date || !sameAmount(t.amount, x.amount))
        return false;
    if (normalizeMerchant(t.merchant) !== normalizeMerchant(x.merchant))
        return false;
    if (x.source === "אשראי") {
        return compatible(t.card_last4 || "", x.card_last4 || "") &&
            compatible(installmentOf(t.notes), installmentOf(x.notes)) &&
            compatible(t.charge_date || "", x.charge_date || "");
    }
    if (x.source === "עו״ש")
        return compatible(t.bank_direction || "", x.bank_direction || "") && compatible(t.reference || "", x.reference || "");
    return true;
}
// Higher = more certain (exact card / charge date / installment beat "unknown").
const score = (x, t) => (t.card_last4 && t.card_last4 === x.card_last4 ? 4 : 0) + (t.charge_date && t.charge_date === x.charge_date ? 2 : 0) + (installmentOf(t.notes) && installmentOf(t.notes) === installmentOf(x.notes) ? 1 : 0);

// Returns, for every imported row (same order), the existing transaction it updates, or null (= insert).
export function matchImportedRows(newRows, existingRows) {
    const pool = (existingRows || []).filter(t => t && t.id);
    const used = new Set();
    const result = new Array(newRows.length).fill(null);
    const take = (i, t) => { result[i] = t; used.add(t.id); };
    // 1) exact keys
    for (const [i, x] of newRows.entries()) {
        const t = pool.find(t => !used.has(t.id) && t.source === x.source && ((x.source_key && t.source_key === x.source_key) || (x.external_id && t.external_id === x.external_id)));
        if (t)
            take(i, t);
    }
    // 2) same transaction details (handles ids created by older versions)
    for (const [i, x] of newRows.entries()) {
        if (result[i])
            continue;
        const cands = pool.filter(t => !used.has(t.id) && fieldsMatch(x, t));
        if (cands.length) {
            cands.sort((a, b) => score(x, b) - score(x, a) || String(a.id).localeCompare(String(b.id)));
            take(i, cands[0]);
        }
    }
    return result;
}
