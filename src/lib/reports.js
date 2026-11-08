// Monthly report figures and export rows — PURE. The dashboard, the transactions table and the
// Excel export all use these, so their totals always agree (tests/reports.test.mjs).
import { catName, incomeValue, isExpense, isIncome } from "./finance.js";

const num = n => Number(n) || 0;
const sum = rows => rows.reduce((s, x) => s + num(x.amount), 0);

export function monthSummary(transactions, month) {
    const rows = (transactions || []).filter(x => x.month === month);
    const expenses = rows.filter(isExpense);
    const incomeRows = rows.filter(isIncome);
    const byCategory = new Map();
    for (const x of expenses)
        byCategory.set(catName(x), (byCategory.get(catName(x)) || 0) + num(x.amount));
    return {
        rows, expenses, incomeRows,
        total: sum(expenses),
        income: incomeRows.reduce((s, x) => s + incomeValue(x), 0),
        normalizedTotal: sum(expenses.filter(x => !x.exclude_from_average)),
        excludedTotal: sum(expenses.filter(x => x.exclude_from_average)),
        byCategory,
    };
}

export const toExportRows = rows => (rows || []).map(x => ({
    "תאריך": x.date || "",
    "בית עסק": x.merchant || "",
    "קטגוריה": x.category || "לא מסווג",
    "סכום": num(x.amount),
    "אמצעי תשלום": x.payment_method || "",
    "מקור": x.source || "",
    "כרטיס": x.card_last4 || "",
    "הערות": x.notes || "",
}));
