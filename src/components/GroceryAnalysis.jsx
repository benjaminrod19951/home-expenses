import React, { useMemo, useState } from "react";
import { money, today } from "../lib/format.js";
import { OTHER, buildPeriods, comparePeriod, groceryMonths, groceryRows, merchantGroups, otherMerchants } from "../lib/grocery.js";

const COLORS = ["#3879d9", "#13a389", "#e4a03b", "#9b80c6", "#db6884", "#8b97a6"];
const BAR_MAX = 230; // px
const pctText = p => (p == null ? "" : `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(Math.round(p * 100))}%`);
const deltaText = c => (c == null ? "—" : `${c.amount > 0 ? "+" : c.amount < 0 ? "−" : ""}${money(Math.abs(c.amount))}${c.pct != null ? ` (${pctText(c.pct)})` : ""}`);
const deltaClass = c => (!c || Math.abs(c.amount) < 0.5 ? "" : c.amount > 0 ? "grocery-rise" : "grocery-fall");
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// "ניתוח הוצאות סופר": weekly (Sunday–Saturday) or monthly comparison, stacked by merchant.
// All numbers come from lib/grocery.js (pure, tested).
export function GroceryWeeklyAnalysis({ transactions }) {
    const [mode, setMode] = useState("weeks");
    const [weeks, setWeeks] = useState(8);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [chosenKey, setChosenKey] = useState("");
    const [openOther, setOpenOther] = useState(false);
    const todayISO = today();
    const rows = useMemo(() => groceryRows(transactions), [transactions]);
    const monthList = useMemo(() => groceryMonths(rows), [rows]);
    const months = selectedMonths.length ? selectedMonths.filter(m => monthList.includes(m)) : monthList.slice(0, 3);
    const periods = useMemo(() => buildPeriods(rows, mode, { months, weeks, todayISO }), [rows, mode, months.join(","), weeks, todayISO]);
    const { names, groupOf, labelOf } = useMemo(() => merchantGroups(periods), [periods]);
    const colorOf = name => COLORS[Math.max(0, names.indexOf(name)) % COLORS.length];
    const lastFull = [...periods].reverse().find(p => !p.partial && p.total > 0) || periods[periods.length - 1];
    const chosen = periods.find(p => p.key === chosenKey) || lastFull;
    const chosenIndex = periods.indexOf(chosen);
    const cmp = chosen ? comparePeriod(periods, chosenIndex, names, groupOf) : null;
    const max = Math.max(1, ...periods.map(p => p.total));
    const others = chosen ? otherMerchants(chosen.rows, groupOf) : [];
    const switchMode = m => { setMode(m); setChosenKey(""); setOpenOther(false); };
    const toggleMonth = (m, on) => {
        setChosenKey("");
        setSelectedMonths(prev => {
            const current = prev.length ? prev : monthList.slice(0, 3); // first click starts from the default (last 3 months)
            return on ? [...new Set([...current, m])] : current.filter(x => x !== m);
        });
    };
    const unit = mode === "weeks" ? "שבוע" : "חודש";
    const partialNote = p => (mode === "weeks" ? `שבוע חלקי: ראשון–${DAY_NAMES[p.partialDays - 1]}` : `חודש חלקי: 1–${p.partialDays}`);
    return <section className="panel grocery-analysis grocery-modern" dir="rtl">
      <div className="sectionhead">
        <div>
          <h2>🛒 ניתוח הוצאות סופר</h2>
          <p>כל עמודה מחולקת לפי בתי עסק. לחיצה על עמודה מציגה מתחת את הפירוט, ההשוואה וכל העסקאות.</p>
        </div>
      </div>
      <div className="grocery-view-tabs" role="tablist" aria-label="סוג השוואה">
        <button type="button" role="tab" aria-selected={mode === "weeks"} className={mode === "weeks" ? "active" : ""} onClick={() => switchMode("weeks")}>השוואה שבועית</button>
        <button type="button" role="tab" aria-selected={mode === "months"} className={mode === "months" ? "active" : ""} onClick={() => switchMode("months")}>השוואה חודשית</button>
      </div>
      {mode === "weeks" ? <div className="grocery-controls-row">
        <label>טווח שבועות{" "}
          <select value={weeks} onChange={e => { setWeeks(Number(e.target.value)); setChosenKey(""); }}>
            {[4, 8, 12, 26].map(n => <option key={n} value={n}>{n} שבועות אחרונים</option>)}
          </select>
        </label>
        <small>שבוע = ראשון עד שבת, גם כשהוא חוצה חודש</small>
      </div> : <div>
        <div className="grocery-filter-title">בחר חודשים להשוואה</div>
        <div className="grocery-month-options">
          {monthList.slice(0, 12).map(m => <label key={m}><input type="checkbox" checked={months.includes(m)} onChange={e => toggleMonth(m, e.target.checked)}/>{m}</label>)}
        </div>
      </div>}
      <div className="grocery-legend">
        {names.map(n => <span key={n}><i style={{ background: colorOf(n) }}/>{labelOf(n)}</span>)}
      </div>
      {periods.some(p => p.total > 0) ? <div className="grocery-bars-scroll">
        <div className="grocery-bars" style={{ minWidth: Math.max(560, periods.length * 112) }}>
          {periods.map((p, i) => {
            const prev = i > 0 ? periods[i - 1] : null;
            const change = !p.partial && prev && !prev.partial && prev.total ? (p.total - prev.total) / prev.total : null;
            const height = Math.max(p.total ? 10 : 2, (p.total / max) * BAR_MAX);
            const values = new Map();
            for (const x of p.rows) values.set(groupOf(x), (values.get(groupOf(x)) || 0) + Number(x.amount || 0));
            return <button type="button" key={p.key} className={`grocery-bar-col grocery-bar-choice ${chosen?.key === p.key ? "selected" : ""} ${p.partial ? "partial" : ""}`} onClick={() => { setChosenKey(p.key); setOpenOther(false); }} aria-label={`פירוט ${p.label}, ${money(p.total)}`}>
              <strong>{money(p.total)}</strong>
              <small className={change > 0 ? "grocery-rise" : change < 0 ? "grocery-fall" : ""}>{p.partial ? "חלקי" : change == null ? " " : pctText(change)}</small>
              <div className="grocery-stack" style={{ height: `${height}px` }}>
                {names.map(n => {
                    const v = values.get(n) || 0;
                    if (v <= 0)
                        return null;
                    const px = (v / p.total) * height;
                    return <div key={n} className="grocery-segment" title={`${labelOf(n)}: ${money(v)} · ${Math.round((v / p.total) * 100)}%`} style={{ height: `${(v / p.total) * 100}%`, background: colorOf(n) }}>
                      {px >= 24 && <span>{money(v)}{px >= 40 && <em>{Math.round((v / p.total) * 100)}%</em>}</span>}
                    </div>;
                })}
              </div>
              <small className="grocery-bar-label" dir="ltr">{p.label}</small>
            </button>;
          })}
        </div>
      </div> : <p className="muted">אין הוצאות סופר בתקופה שנבחרה.</p>}
      {cmp && chosen && <div className="grocery-detail-panel">
        <div className="grocery-detail-heading">
          <div>
            <h3>פירוט ה{unit} · <span dir="ltr">{chosen.label}</span></h3>
            {chosen.partial && <p className="grocery-partial-note">⏳ {partialNote(chosen)}. ההשוואה היא לאותם ימים בתקופות האחרות, לא ל{unit} מלא.</p>}
          </div>
          <strong>{money(cmp.total)}</strong>
        </div>
        <div className="grocery-compare-strip">
          <div><b>לעומת ה{unit} הקודם</b><span className={deltaClass(cmp.vsPrev)}>{deltaText(cmp.vsPrev)}</span></div>
          <div><b>לעומת הממוצע ({cmp.comparedPeriods} תקופות)</b><span className={deltaClass(cmp.vsAvg)}>{deltaText(cmp.vsAvg)}</span></div>
          <div><b>מה הכי העלה</b><span>{cmp.contributors.length ? cmp.contributors.map(m => `${labelOf(m.name)} +${money(m.vsPrev.amount)}`).join(" · ") : "אין עלייה לעומת הקודם"}</span></div>
        </div>
        <div className="tablewrap compact grocery-merchant-table">
          <table>
            <thead><tr><th>בית עסק</th><th>סכום</th><th>חלק</th><th>לעומת הקודם</th><th>לעומת הממוצע</th></tr></thead>
            <tbody>
              {cmp.merchants.map(m => <React.Fragment key={m.name}>
                <tr className={m.name === OTHER ? "clickable-row" : ""} onClick={m.name === OTHER ? () => setOpenOther(v => !v) : undefined}>
                  <td><i className="dot" style={{ background: colorOf(m.name) }}/>{labelOf(m.name)}{m.name === OTHER && <span className="muted"> {openOther ? "▲" : "▼"} {others.length} בתי עסק</span>}</td>
                  <td>{money(m.amount)}</td>
                  <td>{Math.round(m.share * 100)}%</td>
                  <td className={deltaClass(m.vsPrev)}>{deltaText(m.vsPrev)}</td>
                  <td className={deltaClass(m.vsAvg)}>{deltaText(m.vsAvg)}</td>
                </tr>
                {m.name === OTHER && openOther && others.map(o => <tr key={o.merchant} className="grocery-other-row">
                  <td>↳ {o.merchant}</td><td>{money(o.total)}</td><td>{cmp.total ? Math.round((o.total / cmp.total) * 100) : 0}%</td><td colSpan={2} className="muted">{o.rows.length} עסקאות</td>
                </tr>)}
              </React.Fragment>)}
            </tbody>
          </table>
        </div>
        <div className="grocery-transactions">
          <h4>כל העסקאות ב{unit} ({chosen.rows.length})</h4>
          <div className="grocery-transactions-scroll">
            <table>
              <thead><tr><th>תאריך</th><th>בית עסק</th><th>סכום</th><th>קטגוריה</th></tr></thead>
              <tbody>
                {[...chosen.rows].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((x, i) => <tr key={x.id || x.external_id || i}>
                  <td>{x.date}</td><td><i className="dot" style={{ background: colorOf(groupOf(x)) }}/>{x.merchant || "ללא שם"}</td><td>{money(x.amount)}</td><td>{x.category || "לא מסווג"}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>}
    </section>;
}
