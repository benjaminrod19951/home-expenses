// Credit card ⇄ bank reconciliation — PURE planning (no Supabase, no React).
//
// Business rules (see AI_GUIDE.md):
//  * Card detail rows are the source of truth for card purchases (month = transaction date).
//  * A card settlement debit in the bank account is NEVER an expense — matched or not.
//  * The bank debit is kept only as reconciliation evidence and linked to the card rows it explains.
//
// planReconciliation(rows) returns the FINAL desired state for every row as a list of minimal updates.
// It never "resets then re-matches": running it again on the same data returns zero updates (idempotent),
// and if applying the updates fails half-way, the next run simply finishes the job.
// Matching does not depend on previous statuses, so the result is deterministic.
import { normalizeMerchant } from "./finance.js";

export const RECON_FIELDS = "id,date,month,merchant,bank_description,bank_direction,amount,source,flow_type,kind,category,count_as_expense,count_as_income,linked_transaction_id,reconciliation_status,manual_override,charge_date,card_last4,reference";
export const CARD_PAYMENT_CATEGORY = "חיוב כרטיס אשראי";
const OTHER_WS = "allocated_to_other_workspace";
const USER_DUPLICATE = "user_marked_duplicate"; // set by the user in "בדיקת נתונים"; never re-counted
const num = n => Number(n) || 0;
const same = (a, b, t = 0.02) => Math.abs(num(a) - num(b)) < t;
const dayMs = d => (d ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) : NaN);
export const diffDays = (a, b) => Math.abs(dayMs(a) - dayMs(b)) / 86400000;

export function cardProvider(x) {
    const n = normalizeMerchant(`${x.merchant || ""} ${x.bank_description || ""}`);
    if (/לאומי\s*ויזה|לאומי.*ויזה|leumi.*visa/i.test(n))
        return "leumi_visa";
    if (/ישראכרט|isracard/i.test(n))
        return "isracard";
    if (/מקס\s*(איט|it|פיננ)?|\bmax\b/i.test(n))
        return "max";
    if (/כאל|cal\s*(card|כרטיס)/i.test(n))
        return "cal";
    return null;
}

export const isBankCardCharge = x => x.source === "עו״ש" && x.bank_direction !== "in" &&
    Boolean(cardProvider(x) || /אשראי|כרטיס|ממתין להתאמה/.test(`${x.category || ""} ${x.merchant || ""}`));

const cardBase = c => {
    const wantedMonth = String(c.date || "").slice(0, 7);
    const kind = String(c.kind || "").startsWith("card_") ? c.kind : "card_purchase";
    const needs = c.count_as_expense !== true || c.count_as_income === true ||
        ["card_duplicate", "card_payment"].includes(String(c.flow_type || "")) ||
        (wantedMonth && c.month !== wantedMonth) || kind !== c.kind;
    return { needs, fields: { flow_type: "expense", count_as_expense: true, count_as_income: false, kind, ...(wantedMonth ? { month: wantedMonth } : {}) } };
};

export function planReconciliation(rows, { dateTolerance = 3 } = {}) {
    const all = (rows || []).filter(x => x.reconciliation_status !== USER_DUPLICATE).map(x => ({ ...x }));
    const card = all.filter(x => x.source === "אשראי");
    const bank = all.filter(isBankCardCharge);
    const bases = new Map(card.map(c => [c.id, cardBase(c)]));
    const kindOf = c => bases.get(c.id).fields.kind;
    const statementCards = card.filter(c => kindOf(c) === "card_purchase");
    const directCards = card.filter(c => ["card_direct", "card_foreign"].includes(kindOf(c)));

    const knownLast4 = [...new Set(card.map(x => String(x.card_last4 || "")).filter(x => /^\d{4}$/.test(x)))];
    const bankLast4 = b => {
        const ref = String(b.reference || "").replace(/\D/g, "");
        return knownLast4.find(x => ref.endsWith(x)) || null;
    };
    const providerCards = new Map();
    for (const b of bank) {
        const l4 = bankLast4(b), p = cardProvider(b);
        if (l4 && p)
            providerCards.set(p, new Set([...(providerCards.get(p) || []), l4]));
    }
    const allowedForProvider = (last4, p) => !last4 || ![...providerCards.entries()].some(([prov, set]) => prov !== p && set.has(last4));

    const usedBank = new Set(bank.filter(b => b.reconciliation_status === OTHER_WS).map(b => b.id));
    const usedCard = new Set();
    const matches = [];
    const mark = (b, cards, status) => {
        matches.push({ bankId: b.id, cardIds: cards.map(c => c.id), status });
        usedBank.add(b.id);
        cards.forEach(c => usedCard.add(c.id));
    };
    // Statement totals: all statement rows of one card with one charge date must add up to the bank debit.
    const statementPass = (b, dateOk, status) => {
        const l4 = bankLast4(b), p = cardProvider(b);
        const groups = new Map();
        for (const c of statementCards) {
            if (usedCard.has(c.id) || !c.charge_date || !dateOk(c.charge_date, b.date))
                continue;
            const k = `${c.charge_date}|${String(c.card_last4 || "")}`;
            if (!groups.has(k))
                groups.set(k, []);
            groups.get(k).push(c);
        }
        const found = [...groups.values()].filter(cs => {
            const last4 = String(cs[0].card_last4 || "");
            if (l4 && last4 !== l4)
                return false;
            if (!allowedForProvider(last4, p))
                return false;
            return same(cs.reduce((a, c) => a + num(c.amount), 0), b.amount);
        });
        if (found.length === 1)
            mark(b, found[0], status);
    };
    const directPass = (b, dateOk, status) => {
        const l4 = bankLast4(b), p = cardProvider(b);
        let cs = directCards.filter(c => !usedCard.has(c.id) && c.charge_date && dateOk(c.charge_date, b.date) && same(c.amount, b.amount));
        cs = l4 ? cs.filter(c => String(c.card_last4 || "") === l4) : cs.filter(c => allowedForProvider(String(c.card_last4 || ""), p));
        if (cs.length === 1)
            mark(b, [cs[0]], status);
    };
    const byAmount = [...bank].sort((a, b) => num(b.amount) - num(a.amount) || String(a.id).localeCompare(String(b.id)));
    const exact = (a, b) => a === b;
    const near = (a, b) => diffDays(a, b) <= dateTolerance;
    // PASS 1 — statements, exact charge date. PASS 1b — statements, bank posted a few days off (weekend/holiday).
    for (const b of byAmount) if (!usedBank.has(b.id)) statementPass(b, exact, "card_statement_sum_match");
    for (const b of byAmount) if (!usedBank.has(b.id)) statementPass(b, near, "card_statement_sum_match_near_date");
    // PASS 2/3 — immediate-debit and foreign rows are one-to-one.
    for (const b of byAmount) if (!usedBank.has(b.id)) directPass(b, exact, "card_exact_charge_match");
    for (const b of byAmount) if (!usedBank.has(b.id)) directPass(b, near, "card_exact_charge_match_near_date");

    // Desired final state
    const desired = new Map();
    const matchByBank = new Map(matches.map(m => [m.bankId, m]));
    const matchByCard = new Map();
    for (const m of matches) for (const id of m.cardIds) matchByCard.set(id, m);
    for (const c of card) {
        if (c.reconciliation_status === OTHER_WS)
            continue;
        const base = bases.get(c.id), m = matchByCard.get(c.id);
        const want = base.needs ? { ...base.fields } : {};
        if (m)
            Object.assign(want, { reconciliation_status: "card_detail_reconciled", linked_transaction_id: m.cardIds.length === 1 ? m.bankId : null });
        else if (c.reconciliation_status === "card_detail_reconciled" || base.needs)
            Object.assign(want, { reconciliation_status: "card_detail_primary", linked_transaction_id: null }); // stale link -> clear
        desired.set(c.id, want);
    }
    for (const b of bank) {
        if (b.reconciliation_status === OTHER_WS)
            continue;
        const m = matchByBank.get(b.id);
        desired.set(b.id, {
            flow_type: "card_payment", kind: "card_payment", category: CARD_PAYMENT_CATEGORY, count_as_expense: false, count_as_income: false,
            reconciliation_status: m ? m.status : "card_bank_unmatched", linked_transaction_id: m && m.cardIds.length === 1 ? m.cardIds[0] : null,
        });
    }
    const byId = new Map(all.map(x => [x.id, x]));
    const updates = [];
    for (const [id, want] of desired) {
        const cur = byId.get(id), payload = {};
        for (const [k, v] of Object.entries(want))
            if ((cur[k] ?? null) !== (v ?? null))
                payload[k] = v;
        if (Object.keys(payload).length)
            updates.push({ id, payload });
    }
    // Explain unmatched bank debits: closest statement total of the same card within a week.
    const diagnostics = bank.filter(b => !usedBank.has(b.id) && b.reconciliation_status !== OTHER_WS).map(b => {
        const l4 = bankLast4(b);
        const groups = new Map();
        for (const c of statementCards) {
            if (!c.charge_date || diffDays(c.charge_date, b.date) > 7 || (l4 && String(c.card_last4 || "") !== l4))
                continue;
            const k = `${c.charge_date}|${c.card_last4 || ""}`;
            groups.set(k, (groups.get(k) || 0) + num(c.amount));
        }
        let best = null;
        for (const [k, total] of groups) {
            const d = num(b.amount) - total;
            if (!best || Math.abs(d) < Math.abs(best.difference))
                best = { chargeDate: k.split("|")[0], last4: k.split("|")[1] || null, cardTotal: total, difference: d };
        }
        return { bankId: b.id, date: b.date, amount: num(b.amount), merchant: b.merchant, last4: l4, nearest: best };
    });
    return { updates, matches, diagnostics };
}
