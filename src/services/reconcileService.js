// Runs the card ⇄ bank reconciliation against Supabase. Logic lives in lib/reconcile.js (pure, tested).
import { fetchAllRows } from "../lib/db.js";
import { planReconciliation, RECON_FIELDS } from "../lib/reconcile.js";

export async function runReconciliation(supabase, householdId) {
    const { data, error } = await fetchAllRows(() => supabase.from("transactions").select(RECON_FIELDS).eq("household_id", householdId).order("id", { ascending: true }));
    if (error)
        return { changed: false, applied: 0, failed: 0, diagnostics: [], error };
    const plan = planReconciliation(data || []);
    // Rows that need the same change are written together (fewer requests).
    const groups = new Map();
    for (const u of plan.updates) {
        const key = JSON.stringify(u.payload);
        groups.set(key, [...(groups.get(key) || []), u.id]);
    }
    let applied = 0, failed = 0, lastError = null;
    for (const [key, ids] of groups) {
        for (let i = 0; i < ids.length; i += 100) {
            const chunk = ids.slice(i, i + 100);
            const { error: e } = await supabase.from("transactions").update(JSON.parse(key)).eq("household_id", householdId).in("id", chunk);
            if (e) { failed += chunk.length; lastError = e; }
            else applied += chunk.length;
        }
    }
    return { changed: applied > 0, applied, failed, matches: plan.matches, diagnostics: plan.diagnostics, error: lastError };
}
