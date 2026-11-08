import React, { useState } from "react";
import { money, monthLabel, today } from "../lib/format.js";
import { explainChange } from "../lib/insights.js";

// Insights tab: what made spending go up compared with last month (optionally inside one category).
export function WhyIncreasePanel({ expenseRows, month, cats }) {
    const [category, setCategory] = useState("");
    const r = explainChange(expenseRows, month, { category, todayISO: today() });
    const diff = r.total - r.prevTotal;
    const period = r.running ? `1–${r.day} ב${monthLabel(month)} לעומת 1–${r.day} ב${monthLabel(r.prevMonth)}` : `${monthLabel(month)} לעומת ${monthLabel(r.prevMonth)}`;
    return <div className="panel full why-panel">
      <div className="sectionhead">
        <div>
          <h2>📈 למה ההוצאות השתנו?</h2>
          <p>{period}</p>
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="קטגוריה">
          <option value="">כל הקטגוריות</option>
          {cats.filter(c => c !== "לא מסווג").map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="why-total">
        {money(r.total)} לעומת {money(r.prevTotal)} · <b className={diff > 0 ? "grocery-rise" : diff < 0 ? "grocery-fall" : ""}>{diff > 0 ? "+" : diff < 0 ? "−" : ""}{money(Math.abs(diff))}</b>
      </p>
      <div className="why-grid">
        <div>
          <h3>מה עלה</h3>
          {r.increases.length ? r.increases.slice(0, 6).map(x => <div className="why-row" key={x.key}>
            <span>{x.label}{x.isNew && <em className="why-new">חדש</em>}</span>
            <b className="grocery-rise">+{money(x.delta)}</b>
          </div>) : <p className="muted">אין עליות.</p>}
        </div>
        <div>
          <h3>מה ירד</h3>
          {r.decreases.length ? r.decreases.slice(0, 6).map(x => <div className="why-row" key={x.key}>
            <span>{x.label}</span>
            <b className="grocery-fall">−{money(Math.abs(x.delta))}</b>
          </div>) : <p className="muted">אין ירידות.</p>}
        </div>
      </div>
    </div>;
}
