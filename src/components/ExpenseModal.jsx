import { isManual } from "../lib/transactions.js";
import React, { useState } from "react";
import { X } from "lucide-react";
import { num, today } from "../lib/format.js";

export function ExpenseModal({ cats, initial, onClose, onSave, onDelete, onAddCategory, onApplyRule, workspaces, currentWorkspaceId, onTransfer, transferError }) {
    const [transferTarget, setTransferTarget] = useState("");
    const [f, setF] = useState(initial || {
        date: today(), amount: "", category: "סופר", merchant: "", payment_method: "מזומן", card_last4: "", notes: "", flow_type: "expense", count_as_expense: true, count_as_income: false, income_amount: 0
    });
    const flow = f.flow_type || ((f.count_as_income || f.kind === "income") ? "income" : (f.kind === "transfer" ? "transfer" : "expense"));
    const set = (k, v) => setF({ ...f, [k]: v });
    const canDelete = isManual(initial); // manual expense or income (lib/transactions.js)
    return <div className="overlay">
      <div className="modal">
        <div className="modalhead">
          <h2>{initial ? "✏️ עריכת תנועה" : "➕ הוצאה ידנית"}</h2>
          <button className="x" onClick={onClose}><X /></button>
        </div>
        <label>סוג תנועה<select value={flow} onChange={e => {
            const v = e.target.value;
            setF({
                ...f, flow_type: v, count_as_expense: v === "expense", count_as_income: v === "income", income_amount: v === "income" ? num(f.income_amount || f.amount) : 0
            });
        }}>
      <option value="expense">הוצאה</option>
      <option value="income">הכנסה</option>
      <option value="transfer">העברה / תנועה פנימית</option>
      <option value="card_payment">תשלום כרטיס אשראי (לא הוצאה נוספת)</option>
      <option value="income_review">הכנסה לבדיקה</option>
      <option value="saving">חיסכון / פיקדון</option>
    </select></label>
        <label>סכום<input autoFocus type="number" inputMode="decimal" value={f.amount} onChange={e => set("amount", e.target.value)}/></label>
        {["income", "saving"].includes(flow) && <label>
      {flow === "saving" ? "מתוך הסכום שחזר, כמה הוא רווח אמיתי?" : "מתוך הסכום, כמה נחשב הכנסה אמיתית?"}
      <input type="number" inputMode="decimal" value={f.income_amount ?? (flow === "income" ? f.amount : 0)} onChange={e => set("income_amount", e.target.value)}/>
      <small>
        {flow === "saving" ? "לדוגמה: הופקדו בעבר 50,000 ₪ וחזרו 52,000 ₪ — הזן 2,000 ₪. הקרן נשארת תנועה פנימית ורק הרווח נספר כהכנסה." : "לדוגמה: פירעון פיקדון — הקרן אינה הכנסה; הזן כאן רק את הריבית/הרווח."}
      </small>
    </label>}
        <label>קטגוריה<div className="inline">
      <select value={f.category || "לא מסווג"} onChange={e => set("category", e.target.value)}>
        {cats.map(c => <option key={c}>{c}</option>)}
        <option>לא מסווג</option>
      </select>
      <button type="button" onClick={onAddCategory}>+ חדשה</button>
    </div></label>
        <label>בית עסק / תיאור<input value={f.merchant || ""} onChange={e => set("merchant", e.target.value)}/></label>
        <label>אמצעי תשלום<select value={f.payment_method || "אשראי"} onChange={e => set("payment_method", e.target.value)}>
      <option>מזומן</option>
      <option>אשראי</option>
      <option>עו״ש</option>
      <option>העברה</option>
    </select></label>
        <label>4 ספרות אחרונות של הכרטיס<input inputMode="numeric" maxLength="4" value={f.card_last4 || ""} onChange={e => set("card_last4", e.target.value.replace(/\D/g, "").slice(-4))}/></label>
        <label>תאריך<input type="date" value={f.date || today()} onChange={e => set("date", e.target.value)}/></label>
        <label>הערה<input value={f.notes || ""} onChange={e => set("notes", e.target.value)}/></label>
        {flow === "expense" && <label className="checkline"><input type="checkbox" checked={Boolean(f.exclude_from_average)} onChange={e => set("exclude_from_average", e.target.checked)}/> הוצאה חריגה — לא לכלול בממוצע החודשי <small>ההוצאה עדיין נספרת בסך ההוצאות ובקטגוריה; רק הממוצע השוטף מתעלם ממנה.</small></label>}
        <button className="save" onClick={() => onSave({
            ...f, flow_type: flow, count_as_expense: flow === "expense", count_as_income: flow === "income" || (flow === "saving" && num(f.income_amount) > 0), income_amount: ["income", "saving"].includes(flow) ? Math.min(num(f.income_amount ?? (flow === "income" ? f.amount : 0)), Math.abs(num(f.amount))) : 0
        })}>שמירה</button>
        {initial && onTransfer && (workspaces || []).filter(w => w.id !== currentWorkspaceId).length > 0 && <div className="transfer-workspace">
      <label>העברת הוצאה למרחב אחר <select id="transfer-target" value={transferTarget} onChange={e => setTransferTarget(e.target.value)}>
      <option value="">בחר מרחב יעד…</option>
      {workspaces.filter(w => w.id !== currentWorkspaceId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
    </select></label>
      <button type="button" className="secondary" onClick={() => {
                if (transferTarget)
                    onTransfer(initial, transferTarget);
                else
                    alert("בחר מרחב יעד");
            }}>העבר למרחב שנבחר</button>
      {transferError && <div className="quick-error" role="alert">{transferError}</div>}
      <small>בהוצאה שיובאה מהבנק או מהאשראי נשמרת תנועת המקור לצורכי התאמה, אך היא לא נספרת כהוצאה במרחב המקורי.</small>
    </div>}
        {canDelete && onDelete && <button className="secondary danger-action" onClick={() => onDelete(initial)}>🗑️ מחיקת תנועה ידנית</button>}
        {initial && onApplyRule && <button className="secondary" onClick={() => onApplyRule(initial, f.category)}>🧠 למד את העסק — החל על כל החודשים והייבואים הבאים</button>}
      </div>
    </div>;
}
