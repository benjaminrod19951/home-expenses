import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { fetchAllRows } from "./lib/db.js";
import { runReconciliation } from "./services/reconcileService.js";
import { importOneFile } from "./services/importService.js";
import { deleteManualTransaction as deleteManualTx, transferExpense as transferExpenseTx, updateRows } from "./services/transactionsService.js";
import { isMarkedDuplicate, manualFields, planTransfer, markDuplicatePayload, unmarkDuplicatePayload } from "./lib/transactions.js";
import { generateJoinCode, normalizeJoinCode } from "./lib/joinCode.js";
import { importXlsx } from "./importers.js";
import { AlertTriangle, ArrowDownUp, BarChart3, Download, Eye, Filter, Lightbulb, LogOut, Mic, Pencil, Plus, RefreshCw, ShoppingCart, Target, Trash2, Upload, Wallet, X } from "lucide-react";
import { DataCheckModal } from "./components/DataCheckModal.jsx";
import { ExpenseModal } from "./components/ExpenseModal.jsx";
import { DuplicatesPanel } from "./components/DuplicatesPanel.jsx";
import { WhyIncreasePanel } from "./components/WhyIncreasePanel.jsx";
import { FixedChargesPanel } from "./components/FixedChargesPanel.jsx";
import { GroceryWeeklyAnalysis } from "./components/GroceryAnalysis.jsx";
import { PlanModal } from "./components/PlanModal.jsx";
import { QuickExpenseModal } from "./components/QuickExpenseModal.jsx";
import { IncomeReviewPanel, SavingsReviewPanel } from "./components/ReviewPanels.jsx";
import { TransactionDetails, TransactionTable } from "./components/TransactionTable.jsx";
import { DEFAULT_CATS, catName, incomeValue, isExpense, isIncome, isPeriodicUtility, merchantKey, normalizeMerchant, periodicWindowAverage, sortRows } from "./lib/finance.js";
import { money, monthLabel, monthOffset, num, pct, today } from "./lib/format.js";
import { detectFixedCharges, findPossibleDuplicates, forecastMonthEnd, monthProgress, totalUpToDay } from "./lib/insights.js";
import { exportRowsToExcel } from "./lib/exportExcel.js";
import { monthSummary } from "./lib/reports.js";

export function App({ session }) {
    const loadSeqRef = useRef(0);
    const activeWorkspaceRef = useRef(localStorage.getItem("active_workspace_id") || "");
    const quickWorkspaceIdRef = useRef(null);
    const [transferError, setTransferError] = useState("");
    const [reconDiagnostics, setReconDiagnostics] = useState([]);
    const [home, setHome] = useState(null);
    const [workspaces, setWorkspaces] = useState([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => localStorage.getItem("active_workspace_id") || "");
    const [tx, setTx] = useState([]);
    const [cats, setCats] = useState(DEFAULT_CATS);
    const [categoryRows, setCategoryRows] = useState([]);
    const [rules, setRules] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [imports, setImports] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [modal, setModal] = useState(null);
    const [planModal, setPlanModal] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState("");
    const [view, setView] = useState("month");
    const [detail, setDetail] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkCategory, setBulkCategory] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState({ key: "date", dir: "desc" });
    const [categoryReplacement, setCategoryReplacement] = useState({});
    const [merchantDetail, setMerchantDetail] = useState(null);
    const [primaryOverride, setPrimaryOverride] = useState("");
    const [checkOpen, setCheckOpen] = useState(false);
    const [quickOpen, setQuickOpen] = useState(false);
    const [reconOpen, setReconOpen] = useState(false);
    async function load(workspaceIdOverride = "") {
        const seq = ++loadSeqRef.current;
        const switching = Boolean(workspaceIdOverride && workspaceIdOverride !== home?.id);
        if (!home || switching)
            setLoading(true);
        const { data: members, error: me } = await supabase.from("household_members").select("household_id").eq("user_id", session.user.id);
        if (me) {
            setMsg(me.message);
            setLoading(false);
            return;
        }
        if (!members?.length) {
            setWorkspaces([]);
            setHome(null);
            setLoading(false);
            return;
        }
        const ids = [...new Set(members.map(x => x.household_id).filter(Boolean))];
        const { data: homes, error: homesError } = await supabase.from("households").select("*").in("id", ids).order("created_at", { ascending: true });
        if (homesError) {
            setMsg(homesError.message);
            setLoading(false);
            return;
        }
        if (seq !== loadSeqRef.current)
            return;
        const available = homes || [];
        setWorkspaces(available);
        const remembered = workspaceIdOverride || activeWorkspaceRef.current || localStorage.getItem("active_workspace_id") || activeWorkspaceId || "";
        const chosen = available.find(x => x.id === remembered) || available[0];
        if (!chosen) {
            setHome(null);
            setLoading(false);
            return;
        }
        const hid = chosen.id;
        activeWorkspaceRef.current = hid;
        setActiveWorkspaceId(hid);
        localStorage.setItem("active_workspace_id", hid);
        const [{ data: t, error: te }, { data: c }, { data: r }, { data: b }, { data: ib }, { data: pl }] = await Promise.all([
            fetchAllRows(() => supabase.from("transactions").select("*").eq("household_id", hid).order("date", { ascending: false }).order("id", { ascending: true })),
            supabase.from("categories").select("*").eq("household_id", hid),
            supabase.from("merchant_category_rules").select("*").eq("household_id", hid).order("merchant_label"),
            supabase.from("budgets").select("*").eq("household_id", hid),
            supabase.from("import_batches").select("*").eq("household_id", hid).order("created_at", { ascending: false }),
            supabase.from("planned_items").select("*").eq("household_id", hid).order("plan_date", { ascending: true })
        ]);
        if (seq !== loadSeqRef.current)
            return;
        if (te) {
            setMsg(te.message || "שגיאה בטעינת הנתונים");
            setLoading(false);
            return;
        }
        setHome(chosen);
        setTx(t || []);
        setCategoryRows(c || []);
        setPrimaryOverride((c || []).find(x => x.is_primary)?.name || "");
        const savedCats = (c || []).map(x => x.name);
        const referencedCats = [
            ...(t || []).map(catName), ...(r || []).map(x => x.category), ...(b || []).map(x => x.category), ...(pl || []).map(x => x.category)
        ].filter(Boolean);
        setCats([...new Set([...(savedCats.length ? savedCats : DEFAULT_CATS), ...referencedCats, "לא מסווג"])]);
        setRules(r || []);
        setBudgets(b || []);
        setImports(ib || []);
        setPlans(pl || []);
        setSelectedIds(new Set());
        setLoading(false);
    }
    useEffect(() => {
        load();
    }, []);
    useEffect(() => {
        if (home?.id) {
            reconcileDirectBankCard().then(changed => {
                if (changed)
                    load(home.id);
            });
        }
    }, [home?.id]);
    async function switchWorkspace(id) {
        if (!id || id === home?.id)
            return;
        setSelectedMonth("");
        setCategoryFilter(null);
        setSearch("");
        setDetail(null);
        setModal(null);
        setPlanModal(null);
        setQuickOpen(false);
        setMsg("");
        activeWorkspaceRef.current = id;
        setActiveWorkspaceId(id);
        localStorage.setItem("active_workspace_id", id);
        await load(id);
    }
    async function createWorkspace(kind) {
        const workspaceKind = kind || ((prompt("איזה מרחב ליצור? כתבי בית או עסק", "עסק") || "").trim() === "עסק" ? "business" : "home");
        const defaultName = workspaceKind === "business" ? "העסק שלי" : "הבית שלנו";
        const name = (prompt(workspaceKind === "business" ? "שם העסק:" : "שם הבית:", defaultName) || "").trim();
        if (!name)
            return;
        const code = generateJoinCode(); // 10 chars, crypto-random (lib/joinCode.js)
        const { data: hid, error } = await supabase.rpc("create_household", { house_name: name, code });
        if (error)
            return setMsg(error.message);
        if (workspaceKind === "business") {
            const { error: kindError } = await supabase.rpc("set_workspace_type", { workspace_id: hid, workspace_kind: "business" });
            if (kindError)
                return setMsg("המרחב נוצר, אבל לא ניתן לסמן אותו כעסק: " + kindError.message);
        }
        setMsg(`${workspaceKind === "business" ? "העסק" : "הבית"} נוצר. קוד שיתוף: ${code}`);
        setSelectedMonth("");
        await load(hid);
    }
    async function createHome() {
        return createWorkspace("home");
    }
    async function joinHome() {
        const code = normalizeJoinCode(prompt("הכנס את קוד הבית / העסק:"));
        if (!code)
            return;
        const { data: hid, error } = await supabase.rpc("join_household_by_code", { code });
        if (error)
            return setMsg(error.message);
        if (!hid)
            return setMsg("הקוד לא נמצא. בדוק שהוקלד נכון.");
        setSelectedMonth("");
        await load(hid);
    }
    async function addCategory() {
        const name = prompt("שם הקטגוריה:");
        if (!name?.trim())
            return;
        const clean = name.trim();
        const { error } = await supabase.from("categories").upsert({ household_id: home.id, name: clean }, { onConflict: "household_id,name" });
        if (error)
            setMsg(error.message);
        else {
            setMsg(`נוספה קטגוריה: ${clean}`);
            load(home?.id || "");
        }
    }
    async function deleteOrMergeCategory(source) {
        if (!source || source === "לא מסווג")
            return setMsg("לא ניתן למחוק את הקטגוריה 'לא מסווג'");
        const txCount = tx.filter(x => catName(x) === source).length;
        const ruleCount = rules.filter(x => x.category === source).length;
        const planCount = plans.filter(x => x.category === source).length;
        const budgetCount = budgets.filter(x => x.category === source).length;
        const used = txCount + ruleCount + planCount + budgetCount;
        const target = categoryReplacement[source] || "";
        if (used > 0 && !target)
            return setMsg(`ב-${source} יש שימושים. בחרי קודם קטגוריית יעד להעברה.`);
        if (target === source)
            return setMsg("קטגוריית היעד חייבת להיות שונה");
        const message = used > 0 ? `להעביר את כל ${txCount} התנועות, ${ruleCount} החוקים ו-${planCount} פריטי התכנון מ-${source} אל ${target}, ואז למחוק את הקטגוריה?` : `למחוק את הקטגוריה ${source}?`;
        if (!confirm(message))
            return;
        try {
            const sourceRow = categoryRows.find(x => x.name === source);
            if (used > 0) {
                if (txCount) {
                    const { error } = await supabase.from("transactions").update({ category: target, manual_override: true }).eq("household_id", home.id).eq("category", source);
                    if (error)
                        throw error;
                }
                if (ruleCount) {
                    const { error } = await supabase.from("merchant_category_rules").update({ category: target }).eq("household_id", home.id).eq("category", source);
                    if (error)
                        throw error;
                }
                if (planCount) {
                    const { error } = await supabase.from("planned_items").update({ category: target, updated_at: new Date().toISOString() }).eq("household_id", home.id).eq("category", source);
                    if (error)
                        throw error;
                }
                if (budgetCount) {
                    await supabase.from("budgets").delete().eq("household_id", home.id).eq("category", source);
                }
                if (sourceRow?.is_primary) {
                    await supabase.from("categories").update({ is_primary: false }).eq("household_id", home.id);
                    const targetRow = categoryRows.find(x => x.name === target);
                    if (targetRow)
                        await supabase.from("categories").update({ is_primary: true }).eq("id", targetRow.id);
                    else
                        await supabase.from("categories").upsert({ household_id: home.id, name: target, is_primary: true }, { onConflict: "household_id,name" });
                }
            }
            if (sourceRow) {
                const { error } = await supabase.from("categories").delete().eq("id", sourceRow.id);
                if (error)
                    throw error;
            }
            setCategoryReplacement(r => {
                const n = { ...r };
                delete n[source];
                return n;
            });
            setMsg(used > 0 ? `${source} אוחדה לתוך ${target}` : `${source} נמחקה`);
            await load(home?.id || "");
        }
        catch (err) {
            setMsg("שגיאה בניהול קטגוריה: " + err.message);
        }
    }
    const matchingRule = merchant => {
        const n = normalizeMerchant(merchant);
        const key = merchantKey(merchant);
        return rules.find(r => r.merchant_key === key) || rules.find(r => r.merchant_key && n.includes(r.merchant_key)) || null;
    };
    async function createMerchantRule(transaction, category) {
        const key = merchantKey(transaction.merchant);
        if (!key)
            return setMsg("לא ניתן לזהות את העסק");
        const { error } = await supabase.from("merchant_category_rules").upsert({ household_id: home.id, merchant_key: key, merchant_label: key, category }, { onConflict: "household_id,merchant_key" });
        if (error)
            return setMsg(error.message);
        const candidates = tx.filter(x => isExpense(x) && merchantKey(x.merchant) === key);
        if (candidates.length) {
            const { error: e } = await supabase.from("transactions").update({ category, manual_override: true }).in("id", candidates.map(x => x.id));
            if (e)
                return setMsg(e.message);
        }
        setMsg(`נשמר כלל: ${key} → ${category}. ${candidates.length} הוצאות עודכנו.`);
        setModal(null);
        setDetail(null);
        load(home?.id || "");
    }
    async function deleteRule(id) {
        if (!confirm("למחוק את כלל העסק?"))
            return;
        const { error } = await supabase.from("merchant_category_rules").delete().eq("id", id);
        if (error)
            setMsg(error.message);
        else
            load(home?.id || "");
    }
    async function applyBulk(ids, category, clear) {
        if (!category || !ids.length)
            return;
        const { error } = await supabase.from("transactions").update({ category, manual_override: true }).in("id", ids);
        if (error)
            return setMsg(error.message);
        setMsg(`${ids.length} הוצאות הועברו ל-${category}`);
        clear?.(new Set());
        load(home?.id || "");
    }
    async function setAverageExclusion(ids, excluded, clear) {
        if (!ids?.length)
            return;
        const { error } = await supabase.from("transactions").update({ exclude_from_average: Boolean(excluded) }).in("id", ids);
        if (error)
            return setMsg(error.message);
        setMsg(excluded ? `${ids.length} הוצאות הוחרגו מהממוצע השוטף` : `${ids.length} הוצאות הוחזרו לחישוב הממוצע`);
        clear?.(new Set());
        load(home.id);
    }
    async function applyBulkRule(ids, category, clear) {
        if (!category || !ids.length)
            return;
        const selectedRows = tx.filter(x => ids.includes(x.id) && isExpense(x));
        const keys = [...new Set(selectedRows.map(x => merchantKey(x.merchant)).filter(Boolean))];
        if (!keys.length)
            return setMsg("לא ניתן לזהות את העסקים שנבחרו");
        // A rule is global for the household: when the user chooses “העבר + כלל",
        // apply it not only to the selected rows, but to every existing transaction
        // in every month that belongs to the same normalized merchant.
        for (const key of keys) {
            const { error } = await supabase.from("merchant_category_rules").upsert({
                household_id: home.id,
                merchant_key: key,
                merchant_label: key,
                category
            }, { onConflict: "household_id,merchant_key" });
            if (error)
                return setMsg(error.message);
        }
        const allMatching = tx.filter(x => isExpense(x) && keys.includes(merchantKey(x.merchant)));
        if (allMatching.length) {
            const { error } = await supabase.from("transactions").update({ category, manual_override: true }).in("id", allMatching.map(x => x.id));
            if (error)
                return setMsg(error.message);
        }
        setMsg(`נוצרו ${keys.length} כללי עסק. ${allMatching.length} הוצאות מכל החודשים עודכנו ל-${category}.`);
        clear?.(new Set());
        load(home?.id || "");
    }
    async function saveManual(f) {
        const { fields, error: formError } = manualFields(f, today());
        if (formError)
            return setMsg(formError);
        const row = { ...fields, household_id: home.id, user_id: session.user.id, external_id: `manual-${crypto.randomUUID()}`, source: "ידני", payment_method: f.payment_method };
        const { error } = await supabase.from("transactions").insert(row);
        if (error)
            setMsg(error.message);
        else {
            setModal(null);
            setMsg("התנועה נוספה");
            load(home?.id || "");
        }
    }
    async function saveQuickEntries(rows) {
        const targetWorkspaceId = quickWorkspaceIdRef.current || home?.id;
        if (!targetWorkspaceId) {
            setMsg("לא נבחר מרחב לשמירה");
            return false;
        }
        const clean = rows.filter(r => num(r.amount) > 0).map(r => {
            const d = r.date || today();
            const flow = r.type === "income" ? "income" : "expense";
            const amount = Math.abs(num(r.amount));
            return {
                household_id: targetWorkspaceId, user_id: session.user.id, external_id: `manual-quick-${r._key || crypto.randomUUID()}`, date: d, month: d.slice(0, 7), merchant: r.merchant?.trim() || r.category || (flow === "income" ? "הכנסה ידנית" : "הוצאה ידנית"), amount, category: r.category || "לא מסווג", source: "ידני", kind: flow, flow_type: flow, count_as_expense: flow === "expense", count_as_income: flow === "income", income_amount: flow === "income" ? amount : 0, payment_method: r.payment_method || (flow === "income" ? "העברה" : "מזומן"), card_last4: null, notes: r.notes?.trim() || "הזנה מהירה", manual_override: true
            };
        });
        if (!clean.length) {
            setMsg("לא נמצאו תנועות לשמירה");
            return false;
        }
        // Each draft row has a stable key, so saving twice (double click / retry after a network error) cannot duplicate.
        const { error } = await supabase.from("transactions").upsert(clean, { onConflict: "household_id,external_id", ignoreDuplicates: true });
        if (error) {
            setMsg(error.message);
            return false;
        }
        const expenses = clean.filter(r => r.flow_type === "expense").reduce((s, r) => s + num(r.amount), 0);
        const income = clean.filter(r => r.flow_type === "income").reduce((s, r) => s + num(r.amount), 0);
        setMsg(`${clean.length} תנועות נוספו · הוצאות ${money(expenses)} · הכנסות ${money(income)}`);
        await load(targetWorkspaceId);
        return true;
    }
    // Logic and checks: lib/transactions.js (planTransfer) + services/transactionsService.js.
    async function transferExpense(row, targetId) {
        setTransferError("");
        const target = workspaces.find(w => w.id === targetId);
        const check = planTransfer(row, { originId: home?.id, targetId, workspaces, userId: session.user.id, originName: home?.name });
        if (check.error) {
            setTransferError(check.error);
            return setMsg(check.error);
        }
        if (target && !confirm(`להעביר את ${row.merchant || "ההוצאה"} (${money(row.amount)}) למרחב ${target.name}?`))
            return;
        const r = await transferExpenseTx(supabase, row, { originId: home?.id, targetId, workspaces, userId: session.user.id, originName: home?.name });
        if (!r.ok) {
            const errorText = `העברה נכשלה: ${r.error}`;
            setTransferError(errorText);
            return setMsg(errorText);
        }
        setModal(null);
        setDetail(null);
        setMsg("ההוצאה הועברה. תנועת הבנק המקורית נשמרת ללא ספירה כפולה.");
        await load(home.id);
    }
    async function updateTransaction(f) {
        const { fields, error: formError } = manualFields(f, today());
        if (formError)
            return setMsg(formError);
        const { error } = await supabase.from("transactions").update({ ...fields, payment_method: f.payment_method || "אשראי" }).eq("id", f.id).eq("household_id", home.id);
        if (error)
            setMsg(error.message);
        else {
            setModal(null);
            setDetail(null);
            setMsg("התנועה עודכנה");
            load(home?.id || "");
        }
    }
    // Manual expense or income. Deleting a copy moved from another workspace restores the original there.
    async function deleteManualTransaction(row) {
        if (!confirm(`למחוק את ${row.merchant || "התנועה"} בסך ${money(row.amount)}?`))
            return;
        const r = await deleteManualTx(supabase, row, home.id);
        if (!r.ok)
            return setMsg(r.error);
        setModal(null);
        setDetail(null);
        setMsg(r.restored ? "נמחק, וההוצאה חזרה להיספר במרחב המקורי" : r.warning ? `נמחק. שים לב: ${r.warning}` : "התנועה נמחקה");
        await load(home.id);
    }
    async function markDuplicate(row) {
        if (!confirm(`לסמן את ${row.merchant} (${money(row.amount)}, ${row.date}) ככפילות? השורה לא תיספר יותר (לא נמחקת, ואפשר לבטל).`))
            return;
        const r = await updateRows(supabase, home.id, [row.id], markDuplicatePayload());
        setMsg(r.ok ? "סומן ככפילות" : r.error);
        if (r.ok)
            await load(home.id);
    }
    async function unmarkDuplicate(row) {
        const r = await updateRows(supabase, home.id, [row.id], unmarkDuplicatePayload(row));
        setMsg(r.ok ? "הסימון בוטל — השורה נספרת שוב" : r.error);
        if (r.ok)
            await load(home.id);
    }
    async function reconcileDirectBankCard() {
        const result = await runReconciliation(supabase, home.id);
        setReconDiagnostics(result.diagnostics || []);
        if (result.failed)
            setMsg(`התאמת אשראי לבנק: ${result.failed} עדכונים לא נשמרו (${result.error?.message || "שגיאת תקשורת"}). ההתאמה תושלם בטעינה הבאה.`);
        return result.changed;
    }
    async function importFiles(e) {
        try {
            setMsg("מנתח את הקבצים…");
            let report = [];
            // Rows already in the database, plus rows added by earlier files in this same import
            // (so two overlapping files imported together do not duplicate each other).
            const knownTx = [...tx];
            for (const f of [...e.target.files]) {
                report.push(await importOneFile(f, { supabase, householdId: home.id, userId: session.user.id, knownTx, ruleFor: matchingRule }));
            }
            await reconcileDirectBankCard();
            setMsg(`ייבוא הסתיים. ${report.join(" · ")}`);
            load(home?.id || "");
        }
        catch (err) {
            // Part of the file may already be saved; importing it again completes it without duplicates.
            setMsg("שגיאה בייבוא: " + err.message + " — אפשר לייבא שוב את אותו קובץ, הוא ישלים בלי כפילויות.");
            load(home?.id || "");
        }
        finally {
            e.target.value = "";
        }
    }
    async function savePlan(f) {
        const amount = Math.abs(num(f.amount));
        if (!amount || !f.plan_date)
            return setMsg("יש להזין תאריך וסכום");
        const row = {
            household_id: home.id, user_id: session.user.id, plan_date: f.plan_date, month: f.plan_date.slice(0, 7), type: f.type || "expense", amount, category: f.category || "אחר", description: f.description?.trim() || "תכנון", notes: f.notes?.trim() || null
        };
        const q = f.id ? supabase.from("planned_items").update(row).eq("id", f.id) : supabase.from("planned_items").insert(row);
        const { error } = await q;
        if (error)
            setMsg(error.message);
        else {
            setPlanModal(null);
            setMsg("התכנון נשמר");
            load(home?.id || "");
        }
    }
    async function deletePlan(id) {
        if (!confirm("למחוק את הפריט המתוכנן?"))
            return;
        const { error } = await supabase.from("planned_items").delete().eq("id", id);
        if (error)
            setMsg(error.message);
        else
            load(home?.id || "");
    }
    async function savePrimaryCategory(name) {
        if (!name)
            return;
        setPrimaryOverride(name);
        const { error: clearError } = await supabase.from("categories").update({ is_primary: false }).eq("household_id", home.id);
        if (clearError) {
            setMsg("לא ניתן לשנות קטגוריה ראשית: " + clearError.message);
            return;
        }
        const existing = categoryRows.find(x => x.name === name);
        const q = existing ? supabase.from("categories").update({ is_primary: true }).eq("id", existing.id) : supabase.from("categories").upsert({ household_id: home.id, name, is_primary: true }, { onConflict: "household_id,name" });
        const { error } = await q;
        if (error)
            setMsg("לא ניתן לשמור קטגוריה ראשית: " + error.message);
        else {
            setMsg(`הקטגוריה הראשית בדשבורד שונתה ל-${name}`);
            await load(home?.id || "");
        }
    }
    async function saveBudget(category, value) {
        const limit = Math.max(0, num(value));
        if (!limit) {
            await supabase.from("budgets").delete().eq("household_id", home.id).eq("category", category);
            return load(home?.id || "");
        }
        const { error } = await supabase.from("budgets").upsert({
            household_id: home.id, category, monthly_limit: limit, updated_at: new Date().toISOString()
        }, { onConflict: "household_id,category" });
        if (error)
            setMsg(error.message);
        else
            load(home?.id || "");
    }
    if (loading)
        return <div className="loading">טוען…</div>;
    if (!home)
        return <main className="auth">
          <div className="authbox">
            <h1>💼 ניהול כספים</h1>
            <p>צרי מרחב לבית או לעסק, או הצטרפי למרחב קיים.</p>
            <button onClick={() => createWorkspace("home")}>🏠 צור בית חדש</button>
            <button onClick={() => createWorkspace("business")}>💼 צור עסק חדש</button>
            <button onClick={joinHome}>הצטרף עם קוד</button>
            {msg && <div className="notice">{msg}</div>}
            <button className="link" onClick={() => supabase.auth.signOut()}>יציאה</button>
          </div>
        </main>;
    const months = [...new Set([...tx.map(x => x.month), ...plans.map(x => x.month)].filter(Boolean))].sort().reverse();
    // Open on the current month (or the latest month with data), never on a future month that only has planned items.
    const active = selectedMonth || months.find(m => m <= today().slice(0, 7)) || months[0] || today().slice(0, 7);
    // Month figures come from lib/reports.js (shared with the export and covered by tests).
    const summary = monthSummary(tx, active);
    const current = summary.rows;
    const expenses = summary.expenses;
    const previousMonth = monthOffset(active, -1);
    const twoMonthsAgo = monthOffset(active, -2);
    const previous = tx.filter(x => x.month === previousMonth && isExpense(x));
    const previous2 = tx.filter(x => x.month === twoMonthsAgo && isExpense(x));
    const income = summary.income;
    const incomeReview = current.filter(x => String(x.flow_type || "") === "income_review" || x.category === "הכנסה לבדיקה").reduce((s, x) => s + num(x.amount), 0);
    const total = summary.total;
    const prevTotal = previous.reduce((s, x) => s + num(x.amount), 0);
    const normalizedTotal = expenses.filter(x => !x.exclude_from_average).reduce((s, x) => s + num(x.amount), 0);
    const excludedTotal = expenses.filter(x => x.exclude_from_average).reduce((s, x) => s + num(x.amount), 0);
    const prevNormalizedTotal = previous.filter(x => !x.exclude_from_average).reduce((s, x) => s + num(x.amount), 0);
    const prevExcludedTotal = previous.filter(x => x.exclude_from_average).reduce((s, x) => s + num(x.amount), 0);
    // While a month is still running, compare to the same days of last month (1–8 vs 1–8), not to a full month.
    const progress = monthProgress(active, today());
    const prevSamePeriod = progress.running ? totalUpToDay(previous, progress.day) : prevTotal;
    const prevNormalizedSamePeriod = progress.running ? totalUpToDay(previous.filter(x => !x.exclude_from_average), progress.day) : prevNormalizedTotal;
    const compareLabel = progress.running ? `לעומת 1–${progress.day} ב${monthLabel(previousMonth)}` : `לעומת ${monthLabel(previousMonth)}`;
    const forecast = progress.running && previous.length ? forecastMonthEnd({ currentRows: expenses, previousRows: previous, day: progress.day }) : null;
    const duplicates = findPossibleDuplicates(expenses);
    const allDuplicates = findPossibleDuplicates(tx.filter(isExpense));
    const markedDuplicates = tx.filter(isMarkedDuplicate);
    const fixedCharges = detectFixedCharges(tx.filter(isExpense), active);
    const cash = expenses.filter(x => x.payment_method === "מזומן").reduce((s, x) => s + num(x.amount), 0);
    const card = expenses.filter(x => x.payment_method === "אשראי").reduce((s, x) => s + num(x.amount), 0);
    const bankExpenses = expenses.filter(x => x.payment_method === "עו״ש").reduce((s, x) => s + num(x.amount), 0);
    const incomeReviewRows = current.filter(x => String(x.flow_type || "") === "income_review" || x.category === "הכנסה לבדיקה");
    const savingReturnRows = current.filter(x => String(x.flow_type || x.kind || "") === "saving" && (x.bank_direction === "in" || num(x.bank_credit) > 0 || x.count_as_income === true));
    const allCategoryNames = [...new Set([...cats, ...expenses.map(catName), ...previous.map(catName), ...previous2.map(catName), "לא מסווג"])].filter(Boolean);
    const categoryTotals = allCategoryNames.map(c => {
        const value = expenses.filter(x => catName(x) === c).reduce((s, x) => s + num(x.amount), 0);
        const recentRows = tx.filter(x => isExpense(x) && catName(x) === c && [active, previousMonth, twoMonthsAgo, monthOffset(active, -3)].includes(x.month));
        const periodic = recentRows.some(isPeriodicUtility);
        if (periodic) {
            const currentPeriodicAvg = periodicWindowAverage(tx, active, c);
            const priorPeriodicAvg = periodicWindowAverage(tx, twoMonthsAgo, c);
            const currentNonPeriodic = expenses.filter(x => catName(x) === c && !isPeriodicUtility(x)).reduce((s, x) => s + num(x.amount), 0);
            const priorNonPeriodic = previous.filter(x => catName(x) === c && !isPeriodicUtility(x)).reduce((s, x) => s + num(x.amount), 0);
            const currentAvg = currentNonPeriodic + currentPeriodicAvg;
            const priorAvg = priorNonPeriodic + priorPeriodicAvg;
            return {
                name: c, value, prev: priorAvg, compareMonth: twoMonthsAgo, share: total ? value / total : 0, periodic: true, monthlyEquivalent: currentAvg
            };
        }
        const prev1 = previous.filter(x => catName(x) === c).reduce((s, x) => s + num(x.amount), 0);
        const prev2 = previous2.filter(x => catName(x) === c).reduce((s, x) => s + num(x.amount), 0);
        const prev = prev1 || prev2;
        const compareMonth = prev1 ? previousMonth : (prev2 ? twoMonthsAgo : null);
        return {
            name: c, value, prev, compareMonth, share: total ? value / total : 0, periodic: false, monthlyEquivalent: value
        };
    }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "he"));
    const categoryGrandTotal = categoryTotals.reduce((s, x) => s + x.value, 0);
    const categoryMismatch = Math.abs(categoryGrandTotal - total) > 0.01;
    const activeCardBatchIds = new Set(tx.filter(x => x.source === "אשראי" && x.month === active && x.import_batch_id).map(x => x.import_batch_id));
    const cardMonthBatches = imports.filter(b => b.source === "אשראי" && activeCardBatchIds.has(b.id));
    const cardBatchChecks = cardMonthBatches.map(b => {
        const rows = tx.filter(x => x.import_batch_id === b.id && x.source === "אשראי");
        const expected = num(b.source_expense_total);
        return {
            batch: b, expected, expectedCount: num(b.source_expense_count || b.row_count), rowCount: rows.length, rows
        };
    });
    const sourceMismatchRows = cardBatchChecks.filter(x => x.rowCount === 0 && x.expectedCount > 0);
    const unmatchedCardBank = current.filter(x => x.source === "עו״ש" && x.reconciliation_status === "card_bank_unmatched");
    const dataIssueCount = sourceMismatchRows.length + (unmatchedCardBank.length ? 1 : 0) + (categoryMismatch ? 1 : 0);
    const primaryCategory = primaryOverride || categoryRows.find(x => x.is_primary)?.name || cats.find(c => c !== "לא מסווג") || "סופר";
    const primaryRow = categoryTotals.find(x => x.name === primaryCategory);
    const primaryValue = primaryRow?.value || 0;
    const primaryCompareValue = primaryRow?.periodic ? (primaryRow?.monthlyEquivalent || 0) : primaryValue;
    const primaryPrev = primaryRow?.prev || 0;
    const filteredExpenses = sortRows(expenses.filter(x => !categoryFilter || catName(x) === categoryFilter).filter(x => !search || normalizeMerchant(`${x.merchant} ${catName(x)} ${x.notes || ""}`).includes(normalizeMerchant(search))).map(x => ({ ...x, rule: matchingRule(x.merchant) })), sort);
    const comparisonCats = [...new Set([...cats, ...tx.map(catName)])].filter(Boolean).map(name => ({
        name, values: months.map(m => tx.filter(x => x.month === m && isExpense(x) && catName(x) === name).reduce((s, x) => s + num(x.amount), 0))
    })).filter(r => r.values.some(v => v));
    const recurringMap = new Map();
    tx.filter(isExpense).forEach(x => {
        const k = merchantKey(x.merchant);
        if (!k)
            return;
        const a = recurringMap.get(k) || { merchant: k, count: 0, months: new Set(), sum: 0 };
        a.count++;
        a.months.add(x.month);
        a.sum += num(x.amount);
        recurringMap.set(k, a);
    });
    const recurring = [...recurringMap.values()].filter(x => x.months.size >= 3).sort((a, b) => b.months.size - a.months.size || b.sum - a.sum).slice(0, 12);
    const currentMerchantMap = new Map();
    expenses.forEach(x => {
        const k = merchantKey(x.merchant);
        if (!k)
            return;
        const a = currentMerchantMap.get(k) || { merchant: k, count: 0, sum: 0 };
        a.count++;
        a.sum += num(x.amount);
        currentMerchantMap.set(k, a);
    });
    const topMerchants = [...currentMerchantMap.values()].sort((a, b) => b.sum - a.sum).slice(0, 10);
    const topCategories = [...categoryTotals].sort((a, b) => b.value - a.value).slice(0, 5);
    const budgetRows = cats.map(c => {
        const b = budgets.find(x => x.category === c);
        const spent = categoryTotals.find(x => x.name === c)?.value || 0;
        return b ? { ...b, spent, ratio: num(b.monthly_limit) ? spent / num(b.monthly_limit) : 0 } : null;
    }).filter(Boolean).sort((a, b) => b.ratio - a.ratio);
    const savingRate = income > 0 ? (income - total) / income : null;
    const insights = [];
    if (prevSamePeriod && total > prevSamePeriod * 1.1)
        insights.push({
            type: "warn", text: `ההוצאות עלו ב-${pct(total, prevSamePeriod)} ${compareLabel}.`
        });
    fixedCharges.filter(x => x.increased && x.latestMonth === active).forEach(x => insights.push({
        type: "warn", text: `${x.merchant} התייקר: ${money(x.previousAmount)} ← ${money(x.latestAmount)} בחודש.`
    }));
    if (duplicates.length)
        insights.push({ type: "warn", text: `${duplicates.length === 1 ? "חיוב אחד נראה כפול" : `${duplicates.length} חיובים נראים כפולים`} החודש (${money(duplicates.reduce((a, d) => a + d.extra, 0))}). כדאי לבדוק בלשונית "חודש".` });
    if (primaryCompareValue > primaryPrev * 1.15 && primaryPrev > 0)
        insights.push({
            type: "warn", text: `${primaryCategory} עלתה ב-${pct(primaryCompareValue, primaryPrev)} לפי ${primaryRow?.periodic ? "ממוצע דו־חודשי" : "ההשוואה"}.`
        });
    budgetRows.filter(x => x.ratio >= 1).forEach(x => insights.push({
        type: "warn", text: `חרגתם מתקציב ${x.category} ב-${money(x.spent - num(x.monthly_limit))}.`
    }));
    budgetRows.filter(x => x.ratio >= .8 && x.ratio < 1).forEach(x => insights.push({ type: "info", text: `${x.category}: ניצלתם ${Math.round(x.ratio * 100)}% מהתקציב.` }));
    if (income > 0)
        insights.push({
            type: savingRate >= .2 ? "good" : "info", text: `שיעור החיסכון בחודש: ${Math.round(savingRate * 100)}% (${money(income - total)}).`
        });
    const openCategory = name => setDetail({
        title: `${name} · ${monthLabel(active)}`, rows: expenses.filter(x => catName(x) === name)
    });
    const onSort = k => setSort(s => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }));
    return <div className="app"><header>
      <div className="workspace-head">
        <h1>{home.workspace_type === "business" ? "💼 העסק" : "🏠 הבית"}</h1>
        <div className="workspace-switch">
          <select aria-label="בחירת מרחב" value={home.id} onChange={e => switchWorkspace(e.target.value)}>
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.workspace_type === "business" ? "💼" : "🏠"} {w.name}</option>)}
          </select>
          <button className="secondary smallbtn" onClick={() => createWorkspace()}>+ מרחב</button>
        </div>
        <p>{home.name} · קוד: <b>{home.join_code}</b></p>
      </div>
      <div className="actions">
        <button className="quick-header" onClick={() => {
            quickWorkspaceIdRef.current = home.id;
            setQuickOpen(true);
        }}><Mic /> הזנה מהירה</button>
        <button onClick={() => setModal({ mode: "new" })}><Plus /> הוצאה</button>
        <label className="upload"><Upload /> ייבוא<input type="file" multiple accept=".xlsx,.xls,.csv" onChange={importFiles}/></label>
        <button onClick={() => load(home.id)} title="רענון" aria-label="רענון"><RefreshCw /></button>
        <button onClick={() => supabase.auth.signOut()} title="יציאה" aria-label="יציאה"><LogOut /></button>
      </div>
    </header>
 <nav className="topnav">
   <div className="tabs">
     {[
            ["month", "חודש"], ["income", "הכנסות"], ["compare", "השוואה"], ["planning", "תכנון קדימה"], ["insights", "תובנות"], ["categories", "קטגוריות"], ["rules", "חוקים"], ["budgets", "תקציבים"]
        ].map(([k, l]) => <button key={k} className={view === k ? "tab active" : "tab"} onClick={() => setView(k)}>
      {l}
    </button>)}
   </div>
   {["month", "income", "planning"].includes(view) && <select value={active} onChange={e => setSelectedMonth(e.target.value)}>
      {months.map(m => <option key={m}>{m}</option>)}
    </select>}
   <span className="navmsg">{msg}</span>
   <small title="גרסת אפליקציה">v24.46</small>
 </nav>
 {view === "income" && <>
   <section className="cards">
     <button className="card cardbutton" onClick={() => setDetail({ title: `הכנסות · ${monthLabel(active)}`, rows: current.filter(isIncome) })}>
       <Wallet />
       <span>הכנסות מאושרות</span>
       <strong>{money(income)}</strong>
       <small>{current.filter(isIncome).length} תנועות · לחצי לפירוט</small>
     </button>
     <div className="card">
       <AlertTriangle />
       <span>לבדיקה</span>
       <strong>{money(incomeReview)}</strong>
       <small>לא נספר עד שתסווגי</small>
     </div>
     <div className="card">
       <Target />
       <span>מאזן החודש</span>
       <strong>{money(income - total)}</strong>
       <small>הכנסות מאושרות פחות הוצאות</small>
     </div>
   </section>
   <IncomeReviewPanel rows={incomeReviewRows} onEdit={x => {
                setTransferError("");
                setModal({ mode: "edit", transaction: x });
            }}/>
   <SavingsReviewPanel rows={savingReturnRows} onEdit={x => {
                setTransferError("");
                setModal({ mode: "edit", transaction: x });
            }}/>
   <section className="panel">
     <div className="sectionhead">
       <div>
         <h2>כל ההכנסות · {monthLabel(active)}</h2>
         <p>הכנסות רגילות נספרות מיד. אפשר לערוך תנועה ולהפוך אותה להעברה פנימית או לקבוע שרק חלק ממנה הוא רווח אמיתי.</p>
       </div>
     </div>
     <div className="tablewrap">
       <table>
         <thead>
           <tr><th>תאריך</th><th>תיאור</th><th>סכום שנכנס</th><th>הכנסה אמיתית</th><th>מקור</th><th></th></tr>
         </thead>
         <tbody>
           {current.filter(x => isIncome(x) || String(x.flow_type || "") === "income_review" || String(x.flow_type || x.kind || "") === "saving").map(x => <tr key={x.id}>
      <td>{x.date}</td>
      <td>{x.merchant}</td>
      <td>{money(x.amount)}</td>
      <td>
        {String(x.flow_type || x.kind || "") === "saving" ? (num(x.income_amount) > 0 ? money(x.income_amount) : "קרן בלבד / להגדרת רווח") : isIncome(x) ? money(incomeValue(x)) : "ממתין לבדיקה"}
      </td>
      <td>{x.source || "—"}</td>
      <td>
        <button className="iconbtn" onClick={() => setModal({ mode: "edit", transaction: x })}>
          <Pencil />
        </button>
      </td>
    </tr>)}
         </tbody>
       </table>
     </div>
   </section>
 </>}
 {view === "planning" && (() => {
            const p = plans.filter(x => x.month === active);
            const pi = p.filter(x => x.type === "income").reduce((a, x) => a + num(x.amount), 0);
            const pe = p.filter(x => x.type === "expense").reduce((a, x) => a + num(x.amount), 0);
            const actualIncome = current.filter(isIncome).reduce((a, x) => a + incomeValue(x), 0);
            const actualExpenses = current.filter(isExpense).reduce((a, x) => a + num(x.amount), 0);
            const forecastIncome = actualIncome + pi;
            const forecastExpenses = actualExpenses + pe;
            return <>
          <section className="cards">
            <div className="card">
              <Wallet />
              <span>הכנסות בפועל + מתוכננות</span>
              <strong>{money(forecastIncome)}</strong>
              <small>בפועל {money(actualIncome)} · תכנון {money(pi)}</small>
            </div>
            <div className="card">
              <Target />
              <span>הוצאות בפועל + מתוכננות</span>
              <strong>{money(forecastExpenses)}</strong>
              <small>בפועל {money(actualExpenses)} · תכנון {money(pe)}</small>
            </div>
            <div className="card">
              <BarChart3 />
              <span>צפי לחיסכון</span>
              <strong>{money(forecastIncome - forecastExpenses)}</strong>
              <small>לפי מה שידוע ומתוכנן כרגע</small>
            </div>
          </section>
          <section className="panel">
            <div className="sectionhead">
              <div>
                <h2>📅 תכנון קדימה · {monthLabel(active)}</h2>
                <p>הוסיפי הכנסות צפויות והוצאות עתידיות כמו חתונה, חופשה או תשלום גדול. הן לא משנות את ההוצאות בפועל — רק את התחזית.</p>
              </div>
              <button onClick={() => setPlanModal({})}><Plus /> הוסף תכנון</button>
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>תאריך</th><th>סוג</th><th>תיאור</th><th>קטגוריה</th><th>סכום</th><th></th></tr>
                </thead>
                <tbody>
                  {p.map(x => <tr key={x.id}>
          <td>{x.plan_date}</td>
          <td>{x.type === "income" ? "הכנסה צפויה" : "הוצאה צפויה"}</td>
          <td>{x.description}</td>
          <td>{x.category}</td>
          <td>{money(x.amount)}</td>
          <td>
            <button className="iconbtn" onClick={() => setPlanModal(x)}><Pencil /></button>
            <button className="iconbtn danger" onClick={() => deletePlan(x.id)}><Trash2 /></button>
          </td>
        </tr>)}
                </tbody>
              </table>
              {!p.length && <div className="empty">אין עדיין תכנון לחודש הזה.</div>}
            </div>
          </section>
          <section className="panel">
            <div className="sectionhead">
              <div><h2>היסטוריה + תוכנית</h2><p>תמונה חודשית משולבת: מה כבר קרה בפועל ומה מתוכנן קדימה.</p></div>
            </div>
            <div className="tablewrap comparison">
              <table>
                <thead>
                  <tr>
                    <th>חודש</th>
                    <th>הכנסות בפועל</th>
                    <th>הוצאות בפועל</th>
                    <th>הכנסות מתוכננות</th>
                    <th>הוצאות מתוכננות</th>
                    <th>מאזן צפוי</th>
                  </tr>
                </thead>
                <tbody>
                  {[...new Set([...tx.map(x => x.month), ...plans.map(x => x.month)].filter(Boolean))].sort().map(m => {
                    const mi = tx.filter(x => x.month === m && isIncome(x)).reduce((a, x) => a + incomeValue(x), 0);
                    const me = tx.filter(x => x.month === m && isExpense(x)).reduce((a, x) => a + num(x.amount), 0);
                    const mpi = plans.filter(x => x.month === m && x.type === "income").reduce((a, x) => a + num(x.amount), 0);
                    const mpe = plans.filter(x => x.month === m && x.type === "expense").reduce((a, x) => a + num(x.amount), 0);
                    return <tr key={m}>
              <td>{monthLabel(m)}</td>
              <td>{money(mi)}</td>
              <td>{money(me)}</td>
              <td>{money(mpi)}</td>
              <td>{money(mpe)}</td>
              <td><b>{money(mi + mpi - me - mpe)}</b></td>
            </tr>;
                })}
                </tbody>
              </table>
            </div>
          </section>
        </>;
        })()}
 {view === "compare" && <section className="panel compare">
   <div className="sectionhead">
     <div>
       <h2>השוואת חודשים</h2>
       <p>לחצו על סכום כדי לפתוח את העסקאות. בתחתית מופיעים גם הסכום בפועל וגם ההוצאה השוטפת ללא חריגות.</p>
     </div>
   </div>
   <div className="tablewrap comparison">
     <table>
       <thead><tr><th>קטגוריה</th>{months.map(m => <th key={m}>{monthLabel(m)}</th>)}</tr></thead>
       <tbody>
         {comparisonCats.map(r => <tr key={r.name}>
   <th>{r.name}</th>
   {r.values.map((v, i) => {
                    const m = months[i];
                    const periodic = tx.some(x => isExpense(x) && catName(x) === r.name && [m, monthOffset(m, -1)].includes(x.month) && isPeriodicUtility(x));
                    const avg = periodic ? periodicWindowAverage(tx, m, r.name) : 0;
                    return <td key={m}>
          {v ? <button className="amountlink" onClick={() => setDetail({
                                title: `${r.name} · ${monthLabel(m)}`, rows: tx.filter(x => x.month === m && catName(x) === r.name && isExpense(x))
                            })}>
          {money(v)}
        </button> : "—"}
          {periodic && <small className="periodic-note">ממוצע דו־חודשי: {money(avg)}</small>}
        </td>;
                })}
 </tr>)}
         <tr className="grand">
           <th>סה״כ הוצאות בפועל</th>
           {months.map(m => <td key={m}>
      {money(tx.filter(x => x.month === m && isExpense(x)).reduce((s, x) => s + num(x.amount), 0))}
    </td>)}
         </tr>
         <tr className="grand normalized-row">
           <th>שוטף ללא חריגות</th>
           {months.map(m => <td key={m}>
      {money(tx.filter(x => x.month === m && isExpense(x) && !x.exclude_from_average).reduce((s, x) => s + num(x.amount), 0))}
    </td>)}
         </tr>
         <tr>
           <th>חריגות</th>
           {months.map(m => <td key={m}>
      {money(tx.filter(x => x.month === m && isExpense(x) && x.exclude_from_average).reduce((s, x) => s + num(x.amount), 0))}
    </td>)}
         </tr>
       </tbody>
     </table>
   </div>
 </section>}
 {view === "insights" && <section className="insightsgrid">
   <div className="panel">
     <h2>💡 מה השתנה?</h2>
     {insights.length ? insights.map((x, i) => <div className={`insight ${x.type}`} key={i}><Lightbulb /><span>{x.text}</span></div>) : <div className="empty">אין כרגע חריגות בולטות.</div>}
   </div>
   <div className="panel">
     <h2>🏆 הקטגוריות הגדולות</h2>
     <div className="category-list insight-list">
       {topCategories.map(x => <button className="row categoryrow" key={x.name} onClick={() => openCategory(x.name)}>
   <span className="categoryname">{x.name}</span>
   <b className="categoryamount">{money(x.value)}</b>
   <span className="categoryshare">{Math.round(x.share * 100)}%</span>
   <Eye />
 </button>)}
     </div>
   </div>
   <div className="panel">
     <h2>🧾 עסקים מובילים בחודש</h2>
     <p>לחצי על עסק כדי לראות לפי חודשים גם את הסכום וגם את מספר העסקאות.</p>
     <div className="merchant-insight-list">
       {topMerchants.map(x => <button className="merchant-insight-row" key={x.merchant} onClick={() => setMerchantDetail(x.merchant)}>
   <span><b>{x.merchant}</b><small>{x.count} עסקאות</small></span>
   <strong>{money(x.sum)}</strong>
   <Eye />
 </button>)}
     </div>
   </div>
   <div className="panel full">
     <div className="sectionhead">
       <div>
         <h2>💳 התאמת חיובי אשראי לעו״ש</h2>
         <p>בדיקת בקרה בלבד. ההוצאות המפורטות נשארות מהאשראי וחיוב העו״ש אינו נספר שוב.</p>
       </div>
       <button className="secondary smallbtn" onClick={() => setReconOpen(v => !v)}>
         {reconOpen ? "סגור פירוט" : "פתח פירוט התאמות"}
       </button>
     </div>
     {reconOpen && <div className="tablewrap">
   <table>
     <thead>
       <tr><th>תאריך</th><th>חיוב בעו״ש</th><th>סכום</th><th>עסקאות אשראי בסביבה</th><th>סטטוס</th></tr>
     </thead>
     <tbody>
       {tx.filter(x => x.kind === "card_payment" || x.kind === "card_statement").slice(0, 30).map(x => {
                    const paymentMonth = x.date?.slice(0, 7);
                    const prevPaymentMonth = paymentMonth ? monthOffset(paymentMonth, -1) : null;
                    const nearby = tx.filter(y => y.kind === "card_purchase" && ([paymentMonth, prevPaymentMonth].includes(String(y.charge_date || y.month).slice(0, 7))));
                    const grouped = [...nearby.reduce((m, y) => {
                            const k = y.charge_date || y.month;
                            m.set(k, (m.get(k) || 0) + num(y.amount));
                            return m;
                        }, new Map())];
                    const exact = grouped.find(([, v]) => Math.abs(v - num(x.amount)) < 0.01);
                    return <tr key={x.id}>
          <td>{x.date}</td>
          <td>{x.merchant}</td>
          <td className="amountcell">{money(x.amount)}</td>
          <td>
            {nearby.length ? grouped.map(([m, v]) => <span key={m} className="recongroup">{m}: {money(v)} </span>) : "לא נמצאו עסקאות אשראי מיובאות"}
          </td>
          <td>
            <span className={exact ? "statusgood" : "statuswarn"}>{exact ? "✓ תואם" : "⚠️ נדרש לבדוק"}</span>
          </td>
        </tr>;
                })}
     </tbody>
   </table>
 </div>}
   </div>
   <div className="panel full">
     <h2>⚡ הוצאות תקופתיות</h2>
     <p>חשמל, מים וגז מוצגים כאן לפי ממוצע דו־חודשי לצורך מגמה בלבד. סך ההוצאה החודשי בדשבורד נשאר הסכום ששולם בפועל.</p>
     <div className="tablewrap">
       <table>
         <thead><tr><th>עסק</th><th>חיובים ב־4 חודשים</th><th>סה״כ</th><th>ממוצע חודשי</th></tr></thead>
         <tbody>
           {[...tx.filter(x => isExpense(x) && isPeriodicUtility(x) && [active, previousMonth, twoMonthsAgo, monthOffset(active, -3)].includes(x.month)).reduce((m, x) => {
                    const k = merchantKey(x.merchant);
                    const a = m.get(k) || { merchant: k, count: 0, sum: 0 };
                    a.count++;
                    a.sum += num(x.amount);
                    m.set(k, a);
                    return m;
                }, new Map()).values()].map(x => <tr key={x.merchant}>
          <td>{x.merchant}</td>
          <td>{x.count}</td>
          <td>{money(x.sum)}</td>
          <td>{money(x.sum / 4)}</td>
        </tr>)}
         </tbody>
       </table>
     </div>
   </div>
   <WhyIncreasePanel expenseRows={tx.filter(isExpense)} month={active} cats={cats}/>
   <FixedChargesPanel charges={fixedCharges} onOpenRows={(title, rows) => setDetail({ title, rows })}/>
   <div className="panel full">
     <h2>🔁 הוצאות חוזרות שזוהו</h2>
     <p>עסקים שמופיעים לפחות ב־3 חודשים. זו אינדיקציה, לא קביעה אוטומטית שמדובר במנוי.</p>
     <div className="tablewrap">
       <table>
         <thead><tr><th>עסק</th><th>חודשים</th><th>מספר עסקאות</th><th>סה״כ</th></tr></thead>
         <tbody>
           {recurring.map(x => <tr key={x.merchant} className="clickable-row" onClick={() => setMerchantDetail(x.merchant)}>
          <td>
            <button className="linklike" onClick={e => {
                    e.stopPropagation();
                    setMerchantDetail(x.merchant);
                }}>
              {x.merchant}
            </button>
          </td>
          <td>{x.months.size}</td>
          <td>{x.count}</td>
          <td className="amountcell">{money(x.sum)}</td>
        </tr>)}
         </tbody>
       </table>
     </div>
   </div>
 </section>}
 {view === "categories" && <section className="panel">
   <div className="sectionhead">
     <div>
       <h2>🗂️ ניהול קטגוריות</h2>
       <p>אפשר להוסיף, לבחור קטגוריה ראשית ולמחוק קטגוריות מיותרות. אם יש שימוש בקטגוריה, חייבים להעביר אותו לקטגוריה אחרת לפני המחיקה.</p>
     </div>
     <button onClick={addCategory}><Plus /> קטגוריה חדשה</button>
   </div>
   <div className="primary-setting">
     <label>קטגוריה ראשית בדשבורד <select value={primaryCategory} onChange={e => savePrimaryCategory(e.target.value)}>
   {cats.filter(c => c !== "לא מסווג").map(c => <option key={c}>{c}</option>)}
 </select></label>
     <small>אפשר לשנות גם ישירות מהכרטיס בדשבורד.</small>
   </div>
   <div className="category-manage-list">
     {cats.filter(c => c !== "לא מסווג").map(c => {
                const usageTx = tx.filter(x => catName(x) === c).length;
                const usageRules = rules.filter(x => x.category === c).length;
                const usagePlans = plans.filter(x => x.category === c).length;
                const used = usageTx + usageRules + usagePlans + budgets.filter(x => x.category === c).length;
                return <div className="category-manage-row" key={c}>
          <div>
            <b>{c}</b>
            <small>{usageTx} תנועות · {usageRules} חוקים · {usagePlans} תכנונים{c === primaryCategory ? " · ראשית" : ""}</small>
          </div>
          {used > 0 && <select value={categoryReplacement[c] || ""} onChange={e => setCategoryReplacement(r => ({ ...r, [c]: e.target.value }))}>
          <option value="">העבר לפני מחיקה אל…</option>
          {cats.filter(x => x !== c).map(x => <option key={x}>{x}</option>)}
        </select>}
          <button className="iconbtn danger" title={used > 0 && !categoryReplacement[c] ? "בחרי קטגוריית יעד קודם" : "מחיקת קטגוריה"} onClick={() => deleteOrMergeCategory(c)} disabled={used > 0 && !categoryReplacement[c]}>
            <Trash2 />
          </button>
        </div>;
            })}
   </div>
 </section>}
 {view === "rules" && <section className="panel">
   <div className="sectionhead">
     <div>
       <h2>🧠 כללי סיווג עסק</h2>
       <p>כלל משפיע על כל החודשים וגם על ייבואים עתידיים. אפשר ליצור כלל מתוך עריכת הוצאה או מבחירת כמה עסקאות.</p>
     </div>
   </div>
   {rules.length ? <div className="ruleslist">
   {rules.map(r => <div className="rule" key={r.id}>
   <div><b>{r.merchant_label}</b><span>→ {r.category}</span></div>
   <button className="iconbtn danger" onClick={() => deleteRule(r.id)}><Trash2 /></button>
 </div>)}
 </div> : <div className="empty">עדיין אין חוקים. פתח הוצאה, בחר קטגוריה ולחץ "למד את העסק".</div>}
 </section>}
 {view === "budgets" && <section className="panel">
   <div className="sectionhead">
     <div><h2>🎯 תקציבים חודשיים</h2><p>הגדר גבול לכל קטגוריה. 80% מסומן כאזהרה ו־100% כחריגה.</p></div>
   </div>
   <div className="primary-setting">
     <label>קטגוריה ראשית בדשבורד <select value={primaryCategory} onChange={e => savePrimaryCategory(e.target.value)}>
   {cats.map(c => <option key={c}>{c}</option>)}
 </select></label>
     <small>הכרטיס השני בדשבורד יציג את הקטגוריה שתבחרי כאן.</small>
   </div>
   <div className="budgetgrid">
     {cats.map(c => {
                const b = budgets.find(x => x.category === c);
                const spent = categoryTotals.find(x => x.name === c)?.value || 0;
                const limit = b ? num(b.monthly_limit) : 0;
                const ratio = limit ? spent / limit : 0;
                return <div className="budget" key={c}>
          <div className="budgethead">
            <b>{c}</b>
            <span>{limit ? money(spent) + " / " + money(limit) : "ללא תקציב"}</span>
          </div>
          {limit && <div className="progress">
          <div className={ratio >= 1 ? "over" : ratio >= .8 ? "near" : ""} style={{ width: `${Math.min(100, ratio * 100)}%` }}/>
        </div>}
          <div className="budgetedit">
            <input type="number" placeholder="תקציב חודשי" defaultValue={limit || ""} onBlur={e => saveBudget(c, e.target.value)}/>
            {limit > 0 && <span>{Math.round(ratio * 100)}%</span>}
          </div>
        </div>;
            })}
   </div>
 </section>}
 {view === "month" && <>
   <section className="cards">
     <div className="card">
       <Wallet />
       <span>הוצאות</span>
       <strong>{money(total)}</strong>
       <small>{prevSamePeriod ? `${pct(total, prevSamePeriod)} ${compareLabel}` : ""}</small>
     </div>
     <div className="card primary-card">
       <ShoppingCart />
       <div className="card-title-line">
         <span>קטגוריה ראשית</span>
         <select className="cardselect" value={primaryCategory} onChange={e => savePrimaryCategory(e.target.value)}>
           {cats.filter(c => c !== "לא מסווג").map(c => <option key={c}>{c}</option>)}
         </select>
       </div>
       <button className="cardvalue" onClick={() => openCategory(primaryCategory)}>
         {money(primaryValue)}
       </button>
       <small>
         {primaryRow?.periodic ? (primaryPrev ? `${pct(primaryRow.monthlyEquivalent, primaryPrev)} · ממוצע דו־חודשי ${money(primaryRow.monthlyEquivalent)}` : `ממוצע דו־חודשי ${money(primaryRow.monthlyEquivalent)}`) : (primaryPrev ? `${pct(primaryValue, primaryPrev)} לעומת ${monthLabel(primaryRow?.compareMonth)}` : "לחצי על הסכום לפירוט")}
       </small>
     </div>
     <button className="card cardbutton" onClick={() => setDetail({ title: `הכנסות · ${monthLabel(active)}`, rows: current.filter(isIncome) })}>
       <Wallet />
       <span>הכנסות</span>
       <strong>{money(income)}</strong>
       <small>{income ? `חיסכון ${money(income - total)}` : "רק הכנסות שאושרו נספרות"}{incomeReview > 0 ? ` · לבדיקה ${money(incomeReview)}` : ""} · לחצי לפירוט</small>
     </button>
     <div className="card">
       <ArrowDownUp />
       <span>מספר הוצאות</span>
       <strong>{expenses.length}</strong>
       <small>מזומן {money(cash)} · אשראי {money(card)} · עו״ש {money(bankExpenses)}</small>
     </div>
   </section>
   <section className="average-strip">
     <div className="panel average-panel month-spend-summary">
       <div>
         <b>הוצאות בפועל · {monthLabel(active)}</b>
         <strong>{money(total)}</strong>
         <small>
           {prevSamePeriod ? `${pct(total, prevSamePeriod)} ${compareLabel}` : "כל ההוצאות ששולמו בחודש"}
         </small>
       </div>
       <div>
         <b>שוטף ללא חריגות</b>
         <strong>{money(normalizedTotal)}</strong>
         <small>
           {prevNormalizedSamePeriod ? `${pct(normalizedTotal, prevNormalizedSamePeriod)} ${compareLabel} ללא חריגות` : "ההוצאה שמייצגת את החודש הרגיל"}
         </small>
       </div>
       <div>
         <b>חריגות בחודש</b>
         <strong>{money(excludedTotal)}</strong>
         <small>
           {excludedTotal ? `${expenses.filter(x => x.exclude_from_average).length} הוצאות מסומנות כחריגות` : "לא סומנו חריגות בחודש הזה"}
         </small>
       </div>
       {forecast && <div>
         <b>צפי לסוף החודש</b>
         <strong>{money(forecast.forecast)}</strong>
         <small>עד היום {money(forecast.soFar)} + שאר החודש לפי {monthLabel(previousMonth)} {money(forecast.restLastMonth)}</small>
       </div>}
     </div>
   </section>
   <IncomeReviewPanel rows={incomeReviewRows} onEdit={x => {
                setTransferError("");
                setModal({ mode: "edit", transaction: x });
            }}/>
   <SavingsReviewPanel rows={savingReturnRows} onEdit={x => {
                setTransferError("");
                setModal({ mode: "edit", transaction: x });
            }}/>
   <DuplicatesPanel duplicates={duplicates} onMarkDuplicate={markDuplicate}/>
   <GroceryWeeklyAnalysis transactions={tx} onOpenRows={(name, rows) => setDetail({ title: `קניות ב${name} · ${rows.length} עסקאות`, rows })}/>
   <section className="grid">
     <div className="panel category-panel">
       <div className="sectionhead">
         <h2>לפי קטגוריה</h2>
         <span className="muted">לחץ לפירוט · {categoryTotals.length} קטגוריות</span>
       </div>
       <div className="category-list">
         {categoryTotals.map(x => <button className="row categoryrow" key={x.name} onClick={() => openCategory(x.name)}>
      <span className="categoryname">{x.name}</span>
      <b className="categoryamount">{money(x.value)}</b>
      <span className="categoryshare">{Math.round(x.share * 100)}%</span>
      <span className="categorychange">
        {x.periodic ? (x.prev ? `${pct(x.monthlyEquivalent, x.prev)} · ממוצע דו־חודשי ${money(x.monthlyEquivalent)}` : `ממוצע דו־חודשי ${money(x.monthlyEquivalent)}`) : (x.prev ? `${pct(x.value, x.prev)} לעומת ${monthLabel(x.compareMonth)}` : "")}
      </span>
      <Eye />
    </button>)}
       </div>
       <div className="category-total">
         <span>סה״כ</span>
         <b>{money(categoryGrandTotal)}</b>
         <span>{total ? "100%" : "0%"}</span>
       </div>
     </div>
     <div className="panel">
       <div className="sectionhead">
         <h2>חיפוש וסינון</h2>
         <button className="secondary smallbtn" onClick={() => {
                setSearch("");
                setCategoryFilter(null);
            }}><Filter /> נקה</button>
       </div>
       <input className="search" placeholder="חפש עסק, קטגוריה או הערה…" value={search} onChange={e => setSearch(e.target.value)}/>
       <div className="filters">
         <button className={!categoryFilter ? "chip active" : "chip"} onClick={() => setCategoryFilter(null)}>הכול</button>
         {categoryTotals.map(x => <button key={x.name} className={categoryFilter === x.name ? "chip active" : "chip"} onClick={() => setCategoryFilter(x.name)}>
      {x.name}
    </button>)}
       </div>
     </div>
   </section>
   <section className="panel fulltable">
     <div className="sectionhead">
       <div>
         <h2>כל ההוצאות</h2>
         <p>כל העסקאות מוצגות. אפשר לבחור כמה, למיין כל עמודה ולסנן לפי קטגוריה.</p>
       </div>
       <div className="table-tools">
         <span className="muted">{filteredExpenses.length} · {money(filteredExpenses.reduce((s, x) => s + num(x.amount), 0))}</span>
         <button type="button" className="secondary smallbtn export-btn" disabled={!filteredExpenses.length} onClick={() => exportRowsToExcel(filteredExpenses, `הוצאות-${active}.xlsx`)}><Download /> ייצוא לאקסל</button>
       </div>
     </div>
     <button className={`data-check-summary ${dataIssueCount ? "has-issues" : "ok"}`} onClick={() => setCheckOpen(true)}>
       {dataIssueCount ? <>⚠️ בדיקת נתונים: נמצאו {dataIssueCount} נושאים לבדיקה <span>לחצי לפירוט</span></> : <>✓ בדיקת נתונים תקינה <span>לחצי לפרטים</span></>}
     </button>
     <TransactionTable rows={filteredExpenses} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onEdit={x => {
                setTransferError("");
                setModal({ mode: "edit", transaction: x });
            }} sort={sort} onSort={onSort} bulkCategory={bulkCategory} setBulkCategory={setBulkCategory} cats={cats} onBulk={() => applyBulk([...selectedIds], bulkCategory, clear => setSelectedIds(clear))} onBulkRule={() => applyBulkRule([...selectedIds], bulkCategory, clear => setSelectedIds(clear))} onBulkAverage={excluded => setAverageExclusion([...selectedIds], excluded, clear => setSelectedIds(clear))}/>
   </section>
 </>}
 {checkOpen && <DataCheckModal active={active} cardBatchChecks={cardBatchChecks} unmatchedCardBank={unmatchedCardBank} reconDiagnostics={reconDiagnostics} allDuplicates={allDuplicates} markedDuplicates={markedDuplicates} onMarkDuplicate={markDuplicate} onUnmarkDuplicate={unmarkDuplicate} categoryMismatch={categoryMismatch} categoryGrandTotal={categoryGrandTotal} total={total} onClose={() => setCheckOpen(false)} onOpenRows={(title, rows) => {
                setCheckOpen(false);
                setDetail({ title, rows });
            }}/>}
 {merchantDetail && (() => {
            const rows = tx.filter(x => isExpense(x) && merchantKey(x.merchant) === merchantDetail);
            const byMonth = [...rows.reduce((m, x) => {
                    const a = m.get(x.month) || { month: x.month, count: 0, sum: 0 };
                    a.count++;
                    a.sum += num(x.amount);
                    m.set(x.month, a);
                    return m;
                }, new Map()).values()].sort((a, b) => String(b.month).localeCompare(String(a.month)));
            return <div className="overlay">
          <div className="modal wide">
            <div className="modalhead">
              <div>
                <h2>{merchantDetail} · היסטוריה</h2>
                <p className="muted">השוואה בין חודשים: סכום כולל מול מספר עסקאות.</p>
              </div>
              <button className="x" onClick={() => setMerchantDetail(null)}><X /></button>
            </div>
            <div className="tablewrap compact merchant-history">
              <table>
                <thead><tr><th>חודש</th><th>מספר עסקאות</th><th>סה״כ</th><th>ממוצע לעסקה</th><th></th></tr></thead>
                <tbody>
                  {byMonth.map(r => <tr key={r.month}>
          <td>{monthLabel(r.month)}</td>
          <td>{r.count}</td>
          <td className="amountcell">{money(r.sum)}</td>
          <td className="amountcell">{money(r.sum / r.count)}</td>
          <td>
            <button className="secondary smallbtn" onClick={() => {
                        setMerchantDetail(null);
                        setDetail({
                            title: `${merchantDetail} · ${monthLabel(r.month)}`, rows: rows.filter(x => x.month === r.month)
                        });
                    }}>פירוט</button>
          </td>
        </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>;
        })()} {quickOpen && <QuickExpenseModal cats={cats} rules={rules} history={tx} workspaceId={quickWorkspaceIdRef.current || home?.id} onClose={() => setQuickOpen(false)} onSaveAll={async (rows) => {
                const workspaceId = quickWorkspaceIdRef.current;
                const ok = await saveQuickEntries(rows);
                if (!ok)
                    return;
                try {
                    localStorage.removeItem(`quick-entry-draft:${workspaceId || "default"}`);
                }
                catch {
                }
                setQuickOpen(false);
            }}/>} {planModal && <PlanModal cats={cats} initial={planModal.id ? planModal : null} onClose={() => setPlanModal(null)} onSave={savePlan}/>} {modal && <ExpenseModal cats={cats} initial={modal.mode === "edit" ? modal.transaction : null} onClose={() => setModal(null)} onSave={modal.mode === "edit" ? updateTransaction : saveManual} onDelete={deleteManualTransaction} workspaces={workspaces} currentWorkspaceId={home.id} onTransfer={transferExpense} transferError={transferError} onAddCategory={addCategory} onApplyRule={(t, c) => createMerchantRule(t, c)}/>} {detail && <TransactionDetails title={detail.title} rows={detail.rows} cats={cats} onClose={() => setDetail(null)} onEdit={x => {
                setDetail(null);
                setModal({ mode: "edit", transaction: x });
            }} onBulk={(ids, cat, clear) => applyBulk(ids, cat, clear)} onBulkRule={(ids, cat, clear) => applyBulkRule(ids, cat, clear)}/>}</div>;
}
