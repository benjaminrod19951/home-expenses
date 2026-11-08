import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Pencil, X } from "lucide-react";
import { sortRows } from "../lib/finance.js";
import { money, num } from "../lib/format.js";

export function SortHeader({ label, column, sort, onSort }) {
    const active = sort.key === column;
    return <th>
      <button className="sortbtn" onClick={() => onSort(column)}>
        {label}
        {active ? (sort.dir === "asc" ? <ArrowUp /> : <ArrowDown />) : <ArrowUpDown />}
      </button>
    </th>;
}

export function TransactionTable({ rows, selectedIds, setSelectedIds, onEdit, sort, onSort, bulkCategory, setBulkCategory, cats, onBulk, onBulkRule, onBulkAverage }) {
    const allSelected = rows.length > 0 && rows.every(x => selectedIds.has(x.id));
    return <>
      <div className="tablewrap">
        <table className="transactions-table">
          <thead>
            <tr>
              <th className="selectcol">
                <input type="checkbox" checked={allSelected} onChange={e => setSelectedIds(e.target.checked ? new Set(rows.map(x => x.id)) : new Set())}/>
              </th>
              <SortHeader label="תאריך" column="date" sort={sort} onSort={onSort}/>
              <SortHeader label="עסק" column="merchant" sort={sort} onSort={onSort}/>
              <SortHeader label="קטגוריה" column="category" sort={sort} onSort={onSort}/>
              <SortHeader label="סכום" column="amount" sort={sort} onSort={onSort}/>
              <SortHeader label="אמצעי" column="payment_method" sort={sort} onSort={onSort}/>
              <SortHeader label="כרטיס" column="card_last4" sort={sort} onSort={onSort}/>
              <SortHeader label="מקור" column="source" sort={sort} onSort={onSort}/>
              <th>ממוצע</th>
              <th>כלל</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(x => <tr key={x.id || x.external_id}>
      <td>
        <input type="checkbox" checked={selectedIds.has(x.id)} onChange={e => {
                const n = new Set(selectedIds);
                e.target.checked ? n.add(x.id) : n.delete(x.id);
                setSelectedIds(n);
            }}/>
      </td>
      <td>{x.date}</td>
      <td>{x.merchant || "—"}</td>
      <td>{x.category || "לא מסווג"}</td>
      <td className="amountcell">{money(x.amount)}</td>
      <td>{x.payment_method || "—"}</td>
      <td>{x.card_last4 ? `•••• ${x.card_last4}` : "—"}</td>
      <td>{x.source || "—"}</td>
      <td>{x.exclude_from_average ? <span title="לא נכלל בממוצע השוטף">חריגה</span> : "✓"}</td>
      <td>{x.rule ? <CheckCircle2 className="ok"/> : ""}</td>
      <td><button className="iconbtn" onClick={() => onEdit(x)}><Pencil /></button></td>
    </tr>)}
          </tbody>
        </table>
        {!rows.length && <div className="empty">אין הוצאות להצגה.</div>}
      </div>
      {selectedIds.size > 0 && <div className="bulkbar">
      <b>{selectedIds.size} נבחרו</b>
      <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
        <option value="">בחר קטגוריה…</option>
        {cats.map(c => <option key={c}>{c}</option>)}
        <option>לא מסווג</option>
      </select>
      <button onClick={onBulk} disabled={!bulkCategory}>העבר לקטגוריה</button>
      <button onClick={onBulkRule} disabled={!bulkCategory}>העבר + צור כלל לעסק</button>
      {onBulkAverage && <>
      <button className="secondary" onClick={() => onBulkAverage(true)}>לא לכלול בממוצע</button>
      <button className="secondary" onClick={() => onBulkAverage(false)}>החזר לממוצע</button>
    </>}
      <button className="link" onClick={() => setSelectedIds(new Set())}>בטל</button>
    </div>}
    </>;
}

export function TransactionDetails({ title, rows, onClose, onEdit, cats, onBulk, onBulkRule }) {
    const [selected, setSelected] = useState(new Set());
    const [bulkCategory, setBulkCategory] = useState("");
    const [sort, setSort] = useState({ key: "date", dir: "desc" });
    const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
    const all = rows.length > 0 && rows.every(x => selected.has(x.id));
    const doSort = k => setSort(s => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" }));
    return <div className="overlay">
      <div className="modal wide">
        <div className="modalhead">
          <div>
            <h2>{title}</h2>
            <p className="muted">{rows.length} תנועות · {money(rows.reduce((s, x) => s + num(x.amount), 0))}</p>
          </div>
          <button className="x" onClick={onClose}><X /></button>
        </div>
        <div className="detail-actions">
          <label><input type="checkbox" checked={all} onChange={e => setSelected(e.target.checked ? new Set(rows.map(x => x.id)) : new Set())}/> בחר הכול</label>
          {selected.size > 0 && <>
      <b>{selected.size} נבחרו</b>
      <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
        <option value="">בחר קטגוריה…</option>
        {cats.map(c => <option key={c}>{c}</option>)}
        <option>לא מסווג</option>
      </select>
      <button onClick={() => onBulk([...selected], bulkCategory, setSelected)} disabled={!bulkCategory}>העבר</button>
      <button onClick={() => onBulkRule([...selected], bulkCategory, setSelected)} disabled={!bulkCategory}>העבר + כלל</button>
    </>}
        </div>
        <div className="tablewrap compact">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>✓</th>
                <SortHeader label="תאריך" column="date" sort={sort} onSort={doSort}/>
                <SortHeader label="עסק" column="merchant" sort={sort} onSort={doSort}/>
                <SortHeader label="קטגוריה" column="category" sort={sort} onSort={doSort}/>
                <SortHeader label="סכום" column="amount" sort={sort} onSort={doSort}/>
                <SortHeader label="אמצעי" column="payment_method" sort={sort} onSort={doSort}/>
                <SortHeader label="כרטיס" column="card_last4" sort={sort} onSort={doSort}/>
                <th>ממוצע</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(x => <tr key={x.id || x.external_id}>
      <td>
        <input type="checkbox" checked={selected.has(x.id)} onChange={e => {
                const n = new Set(selected);
                e.target.checked ? n.add(x.id) : n.delete(x.id);
                setSelected(n);
            }}/>
      </td>
      <td>{x.date}</td>
      <td>{x.merchant || "—"}</td>
      <td>{x.category || "לא מסווג"}</td>
      <td className="amountcell">{money(x.amount)}</td>
      <td>{x.payment_method || "—"}</td>
      <td>{x.card_last4 ? `•••• ${x.card_last4}` : "—"}</td>
      <td>{x.exclude_from_average ? "חריגה" : "✓"}</td>
      <td><button className="iconbtn" onClick={() => onEdit(x)}><Pencil /></button></td>
    </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}
