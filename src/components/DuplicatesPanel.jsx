import React, { useState } from "react";
import { money } from "../lib/format.js";

// Possible duplicates: same merchant, amount and day. The user decides per row:
// "סמן ככפילות" stops counting it (reversible from "בדיקת נתונים"); nothing is deleted.
export function DuplicateGroups({ duplicates, onMarkDuplicate, limit = 8 }) {
    const [open, setOpen] = useState("");
    return <div className="dup-list">
      {duplicates.slice(0, limit).map(d => {
        const key = `${d.date}|${d.merchant}|${d.amount}`;
        return <div key={key} className="dup-group">
          <button type="button" className="dup-row" onClick={() => setOpen(open === key ? "" : key)}>
            <span>{d.date}</span>
            <b>{d.merchant}</b>
            <span>{d.count} × {money(d.amount)} {open === key ? "▲" : "▼"}</span>
          </button>
          {open === key && <div className="dup-rows">
            {d.rows.map((x, i) => <div key={x.id} className="dup-item">
              <span>{x.source || ""}{x.card_last4 ? ` · ${x.card_last4}` : ""}{x.notes ? ` · ${x.notes}` : ""}</span>
              {i === 0 ? <small className="muted">נשאר</small> : <button type="button" className="secondary smallbtn" onClick={() => onMarkDuplicate(x)}>סמן ככפילות</button>}
            </div>)}
            <small className="muted">אם אלה באמת שתי קניות שונות, אין צורך לעשות כלום.</small>
          </div>}
        </div>;
      })}
    </div>;
}

export function DuplicatesPanel({ duplicates, onMarkDuplicate }) {
    if (!duplicates.length)
        return null;
    const extra = duplicates.reduce((s, d) => s + d.extra, 0);
    return <section className="panel dup-panel">
      <div className="sectionhead">
        <div>
          <h2>⚠️ חיובים שאולי נספרו פעמיים</h2>
          <p>אותו בית עסק, אותו סכום ואותו יום. לחיצה פותחת את השורות. לפעמים זה תקין (שתי קניות זהות).</p>
        </div>
        <strong title="הסכום שנספר מעבר לפעם הראשונה">{money(extra)}</strong>
      </div>
      <DuplicateGroups duplicates={duplicates} onMarkDuplicate={onMarkDuplicate}/>
    </section>;
}
