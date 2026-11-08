// Manual transactions, moving an expense between workspaces, deleting, and marking duplicates — PURE planning.
// services/transactionsService.js executes these plans against Supabase. Tested in tests/transactions.test.mjs.
import { isExpense } from "./finance.js";

const num = n => Number(n) || 0;
export const OTHER_WS = "allocated_to_other_workspace";
export const USER_DUPLICATE = "user_marked_duplicate";
export const ALLOCATION_PREFIX = "workspace-allocation-";

export const isManual = row => Boolean(row) && (row.source === "ידני" || String(row.external_id || "").startsWith("manual-"));

// Counting fields for a manual form (shared by "new" and "edit" — they used to be two copies of the same formula).
export function flowFields(form, amount) {
    const flow = form.flow_type || "expense";
    return {
        kind: flow, flow_type: flow,
        count_as_expense: flow === "expense",
        count_as_income: flow === "income" || (flow === "saving" && num(form.income_amount) > 0),
        income_amount: ["income", "saving"].includes(flow) ? Math.min(num(form.income_amount ?? (flow === "income" ? amount : 0)), amount) : 0,
    };
}

export function manualFields(form, todayISO) {
    const amount = Math.abs(num(form.amount));
    if (!amount)
        return { error: "צריך להזין סכום" };
    const d = form.date || todayISO;
    return {
        fields: {
            date: d, month: d.slice(0, 7), merchant: form.merchant?.trim() || form.category, amount, category: form.category || "לא מסווג",
            card_last4: form.card_last4 || null, notes: form.notes?.trim() || null, exclude_from_average: Boolean(form.exclude_from_average), manual_override: true,
            ...flowFields(form, amount),
        },
    };
}

// The id of the original transaction a workspace-allocation copy was made from.
export function allocationSourceId(row) {
    const ext = String(row?.external_id || "");
    if (!ext.startsWith(ALLOCATION_PREFIX))
        return null;
    const fromNotes = String(row.notes || "").match(/מקור ([0-9a-f-]{36})/i);
    if (fromNotes)
        return fromNotes[1];
    const rest = ext.slice(ALLOCATION_PREFIX.length); // "<sourceUuid>-<targetUuid>"
    return /^[0-9a-f-]{73}$/i.test(rest) ? rest.slice(0, 36) : null;
}

// Move an expense to another workspace.
//  * manual expense  -> moved as is.
//  * imported expense -> stays in its workspace (needed for reconciliation / re-import) but stops counting there,
//    and a manual copy is created in the target workspace.
export function planTransfer(row, { originId, targetId, workspaces, userId, originName }) {
    if (!originId || !row?.id || !targetId || targetId === originId)
        return { error: "יש לבחור מרחב יעד שונה" };
    if (!(workspaces || []).some(w => w.id === targetId))
        return { error: "מרחב היעד אינו זמין למשתמש" };
    if (!isExpense(row))
        return { error: "אפשר להעביר כרגע רק הוצאות. הכנסות ותנועות פנימיות אינן נתמכות." };
    if (isManual(row))
        return { mode: "move", update: { household_id: targetId, manual_override: true } };
    return {
        mode: "allocate",
        copy: {
            household_id: targetId, user_id: userId, external_id: `${ALLOCATION_PREFIX}${row.id}-${targetId}`, date: row.date, month: row.date.slice(0, 7),
            merchant: row.merchant, amount: row.amount, category: row.category || "לא מסווג", source: "ידני", kind: "expense", flow_type: "expense",
            count_as_expense: true, count_as_income: false, income_amount: 0, payment_method: row.payment_method || "אשראי", card_last4: row.card_last4 || null,
            notes: `שיוך הוצאה ממרחב ${originName || ""}; מקור ${row.id}`, manual_override: true, exclude_from_average: Boolean(row.exclude_from_average),
        },
        // kind is kept, so the row can be restored exactly if the copy is deleted later
        sourceUpdate: { flow_type: "transfer", count_as_expense: false, count_as_income: false, manual_override: true, reconciliation_status: OTHER_WS },
    };
}

// Only manual rows (expense OR income) can be deleted; imported rows are kept for reconciliation.
// Deleting a workspace-allocation copy also restores the original expense in its workspace,
// otherwise the expense would disappear from both workspaces.
export function planDelete(row, homeId) {
    if (!isManual(row))
        return { error: "אפשר למחוק רק תנועות שהוזנו ידנית. עסקאות בנק/אשראי נשמרות כדי לא לפגוע בהתאמות." };
    const sourceId = allocationSourceId(row);
    return { deleteId: row.id, householdId: homeId, restore: sourceId ? { id: sourceId, payload: restoredSource() } : null };
}

const restoredSource = () => ({ flow_type: "expense", count_as_expense: true, count_as_income: false, reconciliation_status: null });
// Older versions also changed kind to "transfer"; give such rows back a proper kind.
export const restoreKindFix = row => (row && row.kind === "transfer" ? { kind: row.source === "אשראי" ? "card_purchase" : "expense" } : {});

// "This is a duplicate" — reversible, and respected by re-import (manual_override) and reconciliation (status).
export const markDuplicatePayload = () => ({ flow_type: "duplicate", count_as_expense: false, count_as_income: false, manual_override: true, reconciliation_status: USER_DUPLICATE });
export const unmarkDuplicatePayload = row => ({ flow_type: row.source === "עו״ש" && row.kind === "card_payment" ? "card_payment" : "expense", count_as_expense: true, count_as_income: false, reconciliation_status: null, manual_override: true });
export const isMarkedDuplicate = row => row?.reconciliation_status === USER_DUPLICATE;
