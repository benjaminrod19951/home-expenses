import React from "react";
import { money, monthLabel } from "../lib/format.js";

// Subscriptions and other fixed monthly charges, with price increases highlighted.
export function FixedChargesPanel({ charges, onOpenRows }) {
    const monthlyTotal = charges.reduce((s, x) => s + x.typical, 0);
    return <div className="panel full">
      <div className="sectionhead">
        <div>
          <h2>📌 מנויים וחיובים קבועים</h2>
          <p>חיוב אחד בחודש, לפחות 3 חודשים, בסכום יציב. מסומן כשהחיוב האחרון יקר מהרגיל.</p>
        </div>
        {charges.length > 0 && <strong title="סכום החיובים הקבועים בחודש רגיל">{money(monthlyTotal)} בחודש</strong>}
      </div>
      {charges.length ? <div className="tablewrap compact fixed-charges">
        <table>
          <thead><tr><th>עסק</th><th>חודשים</th><th>סכום רגיל</th><th>חיוב אחרון</th><th>שינוי</th></tr></thead>
          <tbody>
            {charges.map(x => <tr key={x.key} className="clickable-row" onClick={() => onOpenRows(`${x.merchant} · חיובים קבועים`, x.rows)}>
              <td>{x.merchant}</td>
              <td>{x.months}</td>
              <td>{money(x.typical)}</td>
              <td>{money(x.latestAmount)} · {monthLabel(x.latestMonth)}</td>
              <td>{x.increased ? <span className="price-up">▲ {money(x.increase)}</span> : "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div> : <div className="empty">עוד לא זוהו חיובים קבועים. צריך לפחות 3 חודשים של נתונים.</div>}
    </div>;
}
