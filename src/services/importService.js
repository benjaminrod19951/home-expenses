// Imports ONE uploaded file: parse -> match existing rows (lib/importMatch.js) -> insert/update.
// knownTx is updated in place, so several overlapping files imported together never duplicate each other.
// Safe to repeat: if it fails half-way, running it again updates what was written and adds the rest.
import { importXlsx } from "../importers.js";
import { isExpense, isIncome } from "../lib/finance.js";
import { money, num } from "../lib/format.js";
import { matchImportedRows } from "../lib/importMatch.js";

export async function importOneFile(f, { supabase, householdId, userId, knownTx, ruleFor }) {
    let rows = await importXlsx(f);
    if (!rows.length) {
        return `${f.name}: ❌ לא נמצאו תנועות`;
    }
    // One existing row per imported row, decided once (lib/importMatch.js).
    const matched = matchImportedRows(rows, knownTx);
    rows = rows.map((x, rowIndex) => {
        const rule = ruleFor(x.merchant);
        const existing = matched[rowIndex];
        const manual = existing?.manual_override === true && !(x.source === "עו״ש" && x.flow_type === "card_payment" && existing?.reconciliation_status !== "allocated_to_other_workspace");
        return {
            ...x, household_id: householdId, user_id: userId, external_id: existing?.external_id || x.external_id, category: manual ? existing.category : (rule?.category || x.category || "לא מסווג"), flow_type: manual ? existing.flow_type : x.flow_type, kind: manual ? existing.kind : x.kind, count_as_expense: manual ? existing.count_as_expense : x.count_as_expense, count_as_income: manual ? existing.count_as_income : x.count_as_income, income_amount: manual ? existing.income_amount : x.income_amount, manual_override: manual
        };
    });
    const sourceExpenseTotal = rows.filter(isExpense).reduce((a, x) => a + num(x.amount), 0);
    const monthTotals = {};
    const monthExpenseTotals = {};
    for (const r of rows) {
        monthTotals[r.month] = (monthTotals[r.month] || 0) + num(r.amount);
        if (isExpense(r))
            monthExpenseTotals[r.month] = (monthExpenseTotals[r.month] || 0) + num(r.amount);
    }
    const source = rows[0]?.source || "קובץ";
    const fileKey = `${source}|${f.name}|${rows.length}|${Object.entries(monthTotals).sort().map(([m, v]) => `${m}:${v.toFixed(2)}`).join("|")}`;
    let { data: batch } = await supabase.from("import_batches").select("*").eq("household_id", householdId).eq("file_key", fileKey).maybeSingle();
    if (!batch) {
        const { data: b, error: be } = await supabase.from("import_batches").insert({
            household_id: householdId, user_id: userId, file_name: f.name, file_key: fileKey, source, source_total: rows.reduce((a, x) => a + num(x.amount), 0), source_expense_total: sourceExpenseTotal, source_expense_count: rows.filter(isExpense).length, row_count: rows.length, month_totals: monthTotals, month_expense_totals: monthExpenseTotals, imported_at: new Date().toISOString()
        }).select().single();
        if (be)
            throw be;
        batch = b;
    }
    rows = rows.map(x => ({ ...x, import_batch_id: batch.id }));
    let added = 0;
    let updated = 0;
    for (const [rowIndex, row] of rows.entries()) {
        const existing = matched[rowIndex];
        if (existing) {
            const manual = existing.manual_override === true && !(row.source === "עו״ש" && row.flow_type === "card_payment" && existing.reconciliation_status !== "allocated_to_other_workspace");
            const payload = manual ? {
                ...row, category: existing.category, flow_type: existing.flow_type, kind: existing.kind, count_as_expense: existing.count_as_expense, count_as_income: existing.count_as_income, income_amount: existing.income_amount, manual_override: true
            } : { ...row, manual_override: false };
            delete payload.id;
            const { error } = await supabase.from("transactions").update(payload).eq("id", existing.id);
            if (error)
                throw error;
            Object.assign(existing, payload);
            updated++;
        }
        else {
            const { data: inserted, error } = await supabase.from("transactions").insert(row).select("id").single();
            if (error)
                throw error;
            knownTx.push({ ...row, id: inserted?.id });
            added++;
        }
    }
    {
        const expenseRows = rows.filter(isExpense);
        const incomeRows = rows.filter(isIncome);
        const bankIn = rows.filter(x => x.source === "עו״ש" && x.bank_direction === "in");
        const bankOut = rows.filter(x => x.source === "עו״ש" && x.bank_direction === "out");
        const details = source === "אשראי" ? `${rows.length} עסקאות אשראי · הוצאות ${money(expenseRows.reduce((a, x) => a + num(x.amount), 0))}` : `${rows.length} תנועות בנק · ${bankOut.length} חובה ${money(bankOut.reduce((a, x) => a + num(x.bank_debit || x.amount), 0))} · ${bankIn.length} זכות ${money(bankIn.reduce((a, x) => a + num(x.bank_credit || x.amount), 0))}`;
        return `${f.name}: ${added} חדשות, ${updated} סונכרנו · ${details}`;
    }
}
