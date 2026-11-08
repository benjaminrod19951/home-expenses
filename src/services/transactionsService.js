// Executes the plans from lib/transactions.js against Supabase. No UI here: callers show messages.
import { planDelete, planTransfer, restoreKindFix } from "../lib/transactions.js";

export async function transferExpense(supabase, row, ctx) {
    const plan = planTransfer(row, ctx);
    if (plan.error)
        return { ok: false, error: plan.error };
    const { originId, targetId } = ctx;
    if (plan.mode === "move") {
        const { data, error } = await supabase.from("transactions").update(plan.update).eq("id", row.id).eq("household_id", originId).select("id");
        if (error)
            return { ok: false, error: error.message };
        return data?.length === 1 ? { ok: true } : { ok: false, error: "לא ניתן להעביר את ההוצאה — בדוק הרשאות" };
    }
    const { data: existing, error: lookupError } = await supabase.from("transactions").select("id").eq("household_id", targetId).eq("external_id", plan.copy.external_id).limit(1);
    if (lookupError)
        return { ok: false, error: lookupError.message };
    if (existing?.length)
        return { ok: false, error: "הוצאה זו כבר הועברה למרחב היעד" };
    const { data: inserted, error: insertError } = await supabase.from("transactions").insert(plan.copy).select("id").single();
    if (insertError)
        return { ok: false, error: insertError.message };
    const { data: updated, error: updateError } = await supabase.from("transactions").update(plan.sourceUpdate).eq("id", row.id).eq("household_id", originId).select("id");
    if (updateError || updated?.length !== 1) {
        // undo the copy so the expense is not counted twice
        await supabase.from("transactions").delete().eq("id", inserted.id).eq("household_id", targetId);
        return { ok: false, error: updateError?.message || "לא ניתן לעדכן את תנועת המקור" };
    }
    return { ok: true };
}

export async function deleteManualTransaction(supabase, row, homeId) {
    const plan = planDelete(row, homeId);
    if (plan.error)
        return { ok: false, error: plan.error };
    let restored = false, restoreError = null;
    if (plan.restore) {
        // Restore first: if it fails, nothing is deleted and the expense is still counted once.
        const { data: src } = await supabase.from("transactions").select("id,kind,source").eq("id", plan.restore.id).maybeSingle();
        if (src) {
            const { error } = await supabase.from("transactions").update({ ...plan.restore.payload, ...restoreKindFix(src) }).eq("id", src.id);
            if (error)
                return { ok: false, error: `לא ניתן להחזיר את ההוצאה למרחב המקור: ${error.message}` };
            restored = true;
        }
        else
            restoreError = "תנועת המקור לא נמצאה (אולי אין לך גישה למרחב המקור)";
    }
    const { error } = await supabase.from("transactions").delete().eq("id", plan.deleteId).eq("household_id", plan.householdId);
    if (error)
        return { ok: false, error: error.message };
    return { ok: true, restored, warning: restoreError };
}

export async function updateRows(supabase, homeId, ids, payload) {
    const { error } = await supabase.from("transactions").update(payload).eq("household_id", homeId).in("id", ids);
    return error ? { ok: false, error: error.message } : { ok: true };
}
