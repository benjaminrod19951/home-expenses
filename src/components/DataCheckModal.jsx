import { DuplicateGroups } from "./DuplicatesPanel.jsx";
import React from "react";
import { X } from "lucide-react";
import { money, monthLabel, num } from "../lib/format.js";

export function DataCheckModal({ active, cardBatchChecks, unmatchedCardBank, reconDiagnostics = [], allDuplicates = [], markedDuplicates = [], onMarkDuplicate, onUnmarkDuplicate, categoryMismatch, categoryGrandTotal, total, onClose, onOpenRows }) {
    const brokenBatches = cardBatchChecks.filter(x => x.rowCount === 0 && x.expectedCount > 0);
    return <div className="overlay">
      <div className="modal wide">
        <div className="modalhead">
          <div>
            <h2>בדיקת נתונים · {monthLabel(active)}</h2>
            <p className="muted">הבדיקה מחפשת רק בעיות שעלולות לשנות את סך ההוצאות. מעבר של עסקה בין חודש העסקה לחודש החיוב אינו נחשב פער.</p>
          </div>
          <button className="x" onClick={onClose}><X /></button>
        </div>
  {!brokenBatches.length && !unmatchedCardBank.length && !categoryMismatch && <div className="reconcile good">✓ לא נמצאו פערים שמשפיעים על סך ההוצאות בחודש הזה.</div>}
  {allDuplicates.length > 0 && <div className="check-section">
    <h3>ייתכן שנספרו פעמיים — כל ההיסטוריה ({allDuplicates.length})</h3>
    <p>אותו בית עסק, סכום ויום. "סמן ככפילות" מפסיק לספור את השורה (לא מוחק, ואפשר לבטל למטה). ייבוא חוזר שומר את הסימון.</p>
    <DuplicateGroups duplicates={allDuplicates} onMarkDuplicate={onMarkDuplicate} limit={50}/>
  </div>}
  {markedDuplicates.length > 0 && <div className="check-section">
    <h3>מסומנות ככפילות ({markedDuplicates.length})</h3>
    <div className="dup-list">
      {markedDuplicates.map(x => <div key={x.id} className="dup-item">
        <span>{x.date} · {x.merchant} · {money(x.amount)}</span>
        <button type="button" className="secondary smallbtn" onClick={() => onUnmarkDuplicate(x)}>בטל סימון</button>
      </div>)}
    </div>
  </div>}
  {cardBatchChecks.length > 0 && <div className="check-section">
    <h3>קובצי אשראי שיובאו</h3>
    <p>הסכום בקובץ נבדק על <b>כל הקובץ</b>, ולא לפי חודש תאריך העסקה. כך עסקה מיוני שנגבית ביולי לא יוצרת אזהרה שגויה.</p>
    <div className="tablewrap compact">
      <table>
        <thead>
          <tr>
            <th>קובץ</th>
            <th>עסקאות בקובץ</th>
            <th>עסקאות מקושרות כעת</th>
            <th>סך בקובץ</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {cardBatchChecks.map(x => <tr key={x.batch.id}>
    <td>{x.batch.file_name}</td>
    <td>{x.expectedCount}</td>
    <td>{x.rowCount}</td>
    <td>{money(x.expected)}</td>
    <td>
      {x.rowCount > 0 ? <span className="statusgood">✓ נקלט</span> : <span className="statuswarn">⚠️ אין עסקאות מקושרות</span>}
    </td>
  </tr>)}
        </tbody>
      </table>
    </div>
    <p className="muted">אם אותה עסקה הופיעה בשני קבצי אשראי, היא נשמרת פעם אחת בלבד ולכן מספר העסקאות המקושרות לקובץ מסוים יכול להיות קטן ממספר השורות המקורי — זו אינה הוצאה חסרה.</p>
  </div>}
  {unmatchedCardBank.length > 0 && <div className="check-section">
    <h3>חיובי אשראי מהבנק שעדיין ללא פירוט מתאים</h3>
    <p>{unmatchedCardBank.length} חיובים, בסך {money(unmatchedCardBank.reduce((s, x) => s + num(x.amount), 0))}. חיובים אלה <b>אינם נספרים כהוצאה</b> (ההוצאות נספרות רק מפירוט האשראי). אם קובץ האשראי של אותו חיוב עוד לא יובא, ייבא אותו. אם הוא יובא ועדיין אין התאמה, יש הפרש בין החיוב בבנק לסכום הפירוט:</p>
    {(() => {
        const ids = new Set(unmatchedCardBank.map(x => x.id));
        const rows = reconDiagnostics.filter(d => ids.has(d.bankId));
        return rows.length > 0 && <div className="tablewrap compact recon-diff">
      <table>
        <thead><tr><th>תאריך בבנק</th><th>חיוב בבנק</th><th>פירוט אשראי הקרוב ביותר</th><th>הפרש</th></tr></thead>
        <tbody>
          {rows.map(d => <tr key={d.bankId}>
            <td>{d.date}</td>
            <td>{money(d.amount)}{d.last4 ? ` · ${d.last4}` : ""}</td>
            <td>{d.nearest ? `${money(d.nearest.cardTotal)} · חיוב ${d.nearest.chargeDate}${d.nearest.last4 ? ` · ${d.nearest.last4}` : ""}` : "לא יובא פירוט לתאריכים האלה"}</td>
            <td>{d.nearest ? money(d.nearest.difference) : "—"}</td>
          </tr>)}
        </tbody>
      </table>
    </div>;
    })()}
    <button className="secondary" onClick={() => onOpenRows(`חיובי אשראי ללא התאמה · ${monthLabel(active)}`, unmatchedCardBank)}>הצג את החיובים</button>
  </div>}
  {categoryMismatch && <div className="check-section">
    <h3>פער אמיתי בסיכום הקטגוריות</h3>
    <p>סך הקטגוריות: {money(categoryGrandTotal)} · סך ההוצאות: {money(total)} · פער: {money(categoryGrandTotal - total)}. זהו פער פנימי אמיתי ודורש בדיקה.</p>
  </div>}
 </div>
    </div>;
}
