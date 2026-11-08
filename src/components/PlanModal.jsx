import React, { useState } from "react";
import { X } from "lucide-react";
import { today } from "../lib/format.js";

export function PlanModal({ cats, initial, onClose, onSave }) {
    const [f, setF] = useState(initial || {
        plan_date: today(), type: "expense", amount: "", category: "אחר", description: "", notes: ""
    });
    return <div className="overlay">
      <div className="modal">
        <div className="modalhead">
          <h2>{initial ? "✏️ עריכת תכנון" : "📅 תכנון עתידי"}</h2>
          <button className="x" onClick={onClose}><X /></button>
        </div>
        <label>סוג<select value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
      <option value="income">הכנסה צפויה</option>
      <option value="expense">הוצאה צפויה</option>
    </select></label>
        <label>תאריך<input type="date" value={f.plan_date} onChange={e => setF({ ...f, plan_date: e.target.value })}/></label>
        <label>סכום<input autoFocus type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })}/></label>
        <label>תיאור<input value={f.description || ""} placeholder={f.type === "expense" ? "למשל: חתונה של דנה" : "למשל: משכורת צפויה"} onChange={e => setF({ ...f, description: e.target.value })}/></label>
        <label>קטגוריה<select value={f.category || "אחר"} onChange={e => setF({ ...f, category: e.target.value })}>
      {cats.map(c => <option key={c}>{c}</option>)}
    </select></label>
        <label>הערה<input value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })}/></label>
        <button className="save" onClick={() => onSave(f)}>שמירה</button>
      </div>
    </div>;
}
