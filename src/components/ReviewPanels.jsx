import React from "react";
import { money, num } from "../lib/format.js";

export function IncomeReviewPanel({ rows, onEdit }) {
    if (!rows.length)
        return null;
    return <section className="panel full">
      <div className="sectionhead">
        <div>
          <h2>⚠️ הכנסות לבדיקה</h2>
          <p>רק תנועות שנראות כמו העברה מחשבון עצמי/מקור לא ברור נשארות כאן. הכנסות רגילות מבנק אחר, Bit וכדומה נספרות מיד.</p>
        </div>
        <b>{money(rows.reduce((s, x) => s + num(x.amount), 0))}</b>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>תאריך</th><th>תיאור</th><th>סכום</th><th>מקור</th><th></th></tr></thead>
          <tbody>
            {rows.slice(0, 50).map(x => <tr key={x.id}>
      <td>{x.date}</td>
      <td>{x.merchant}</td>
      <td className="amountcell">{money(x.amount)}</td>
      <td>{x.source}</td>
      <td>
        <button className="secondary smallbtn" onClick={() => onEdit(x)}>סווג הכנסה / העברה</button>
      </td>
    </tr>)}
          </tbody>
        </table>
      </div>
    </section>;
}

export function SavingsReviewPanel({ rows, onEdit }) {
    if (!rows.length)
        return null;
    return <section className="panel full savings-review">
      <div className="sectionhead">
        <div>
          <h2>🏦 חיסכון / פיקדון שחזר לחשבון</h2>
          <p>הקרן שחזרה אינה הכנסה. פתחי את התנועה והזיני רק את הריבית/הרווח — ורק החלק הזה יתווסף להכנסות.</p>
        </div>
        <b>{money(rows.reduce((s, x) => s + num(x.amount), 0))}</b>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th>תאריך</th><th>תיאור</th><th>חזר לחשבון</th><th>רווח שנרשם</th><th></th></tr></thead>
          <tbody>
            {rows.slice(0, 50).map(x => <tr key={x.id}>
      <td>{x.date}</td>
      <td>{x.merchant || x.bank_description || "חיסכון/פיקדון"}</td>
      <td className="amountcell">{money(x.amount)}</td>
      <td className="amountcell">{num(x.income_amount) > 0 ? money(x.income_amount) : "טרם הוגדר"}</td>
      <td>
        <button className="secondary smallbtn" onClick={() => onEdit(x)}>
          {num(x.income_amount) > 0 ? "עדכון רווח" : "פיצול קרן / רווח"}
        </button>
      </td>
    </tr>)}
          </tbody>
        </table>
      </div>
    </section>;
}
