// Grocery (supermarket) analysis — PURE calculations for components/GroceryAnalysis.jsx. Tested in tests/grocery.test.mjs.
// Weeks always run Sunday → Saturday; a week that crosses a month boundary stays one week.
// Calendar arithmetic is done on "YYYY-MM-DD" strings in UTC, so time zone / daylight saving never shift a day.
import { catName, isExpense, merchantKey, normalizeMerchant } from "./finance.js";

export const GROCERY_CATEGORIES = ["סופר", "מזון וצריכה"];
export const OTHER = "אחר";
const num = n => Number(n) || 0;
const sum = rows => rows.reduce((s, x) => s + num(x.amount), 0);
const toUTC = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUTC = ms => new Date(ms).toISOString().slice(0, 10); // safe: the value is UTC midnight by construction
export const addDaysISO = (iso, n) => fromUTC(toUTC(iso) + n * 86400000);
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const weekStartOf = iso => addDaysISO(iso, -new Date(toUTC(iso)).getUTCDay());
const ddmm = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
export const merchantGroupKey = x => merchantKey(x.merchant) || normalizeMerchant(x.merchant) || "עסק ללא שם";

export const groceryRows = transactions => (transactions || []).filter(x =>
    isExpense(x) && GROCERY_CATEGORIES.includes(catName(x)) && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || "")));

export const groceryMonths = rows => [...new Set(rows.map(x => x.date.slice(0, 7)))].sort().reverse();

// Periods to compare. mode "weeks": the last `weeks` Sunday-weeks; mode "months": the chosen months.
export function buildPeriods(rows, mode, { months = [], weeks = 8, todayISO }) {
    if (mode === "months") {
        return [...months].sort().map(m => {
            const pr = rows.filter(x => x.date.startsWith(m));
            const running = String(todayISO).slice(0, 7) === m;
            return { key: m, label: m, start: `${m}-01`, rows: pr, total: sum(pr), partial: running, partialDays: running ? Number(todayISO.slice(8, 10)) : null };
        });
    }
    const latest = rows.reduce((a, x) => (x.date > a ? x.date : a), "");
    // Show up to the current week; if the data stopped long ago, end at the last week that has data.
    const anchor = latest && daysBetween(latest, todayISO) > 56 ? latest : todayISO;
    const lastStart = weekStartOf(anchor);
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
        const start = addDaysISO(lastStart, -7 * i), end = addDaysISO(start, 6);
        const pr = rows.filter(x => x.date >= start && x.date <= end);
        const partial = todayISO >= start && todayISO < end;
        out.push({ key: start, label: `${ddmm(start)}–${ddmm(end)}`, start, end, rows: pr, total: sum(pr), partial, partialDays: partial ? daysBetween(start, todayISO) + 1 : null });
    }
    return out;
}

// Main merchants are chosen from the periods on screen (not all history); the rest are grouped as "אחר".
export function merchantGroups(periods, topN = 5) {
    const totals = new Map();
    for (const p of periods) for (const x of p.rows) totals.set(merchantGroupKey(x), (totals.get(merchantGroupKey(x)) || 0) + num(x.amount));
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const main = ranked.length > topN + 1 ? ranked.slice(0, topN) : ranked; // no "אחר" for a single leftover merchant
    const names = ranked.length > main.length ? [...main, OTHER] : main;
    const groupOf = x => (main.includes(merchantGroupKey(x)) ? merchantGroupKey(x) : OTHER);
    // Display name = the most frequent original merchant name in the group ("הקצביה של משה", not "הקצביה של").
    const counts = new Map();
    for (const p of periods) for (const x of p.rows) {
        const k = merchantGroupKey(x), c = counts.get(k) || new Map();
        c.set(x.merchant, (c.get(x.merchant) || 0) + 1);
        counts.set(k, c);
    }
    const labels = new Map([...counts.entries()].map(([k, c]) => [k, [...c.entries()].sort((a, b) => b[1] - a[1])[0][0] || k]));
    labels.set(OTHER, OTHER);
    return { names, groupOf, labelOf: k => labels.get(k) || k };
}

export function breakdown(rows, groupOf) {
    const values = new Map(), detail = new Map();
    for (const x of rows) {
        const g = groupOf(x);
        values.set(g, (values.get(g) || 0) + num(x.amount));
        detail.set(g, [...(detail.get(g) || []), x]);
    }
    return { values, detail };
}

// Merchants hidden inside "אחר" for a period, biggest first.
export function otherMerchants(rows, groupOf) {
    const m = new Map();
    for (const x of rows) if (groupOf(x) === OTHER) {
        const k = merchantGroupKey(x);
        const a = m.get(k) || { merchant: x.merchant || k, total: 0, rows: [] };
        a.total += num(x.amount);
        a.rows.push(x);
        m.set(k, a);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
}

// Rows of a period limited to its first `days` days (to compare a partial week/month fairly).
export const firstDays = (period, days) => (days == null ? period.rows : period.rows.filter(x => daysBetween(period.start, x.date) < days));

// Comparison of one period against the previous one and against the average of the other full periods.
// For a partial period, both comparisons use the same number of days, never a full week/month.
export function comparePeriod(periods, index, names, groupOf) {
    const cur = periods[index];
    if (!cur)
        return null;
    const days = cur.partial ? cur.partialDays : null;
    const prevP = index > 0 ? periods[index - 1] : null;
    const others = periods.filter((p, i) => i !== index && !p.partial);
    const curB = breakdown(cur.rows, groupOf);
    const prevB = prevP ? breakdown(firstDays(prevP, days), groupOf) : null;
    const otherB = others.map(p => breakdown(firstDays(p, days), groupOf));
    const avgOf = name => (otherB.length ? otherB.reduce((s, b) => s + (b.values.get(name) || 0), 0) / otherB.length : null);
    const prevTotal = prevP ? sum(firstDays(prevP, days)) : null;
    const avgTotal = others.length ? others.reduce((s, p) => s + sum(firstDays(p, days)), 0) / others.length : null;
    const change = (v, base) => (base == null ? null : { amount: v - base, pct: base ? (v - base) / base : null });
    const merchants = names.map(name => {
        const amount = curB.values.get(name) || 0;
        const prev = prevB ? prevB.values.get(name) || 0 : null;
        const avg = avgOf(name);
        return { name, amount, share: cur.total ? amount / cur.total : 0, prev, avg, vsPrev: change(amount, prev), vsAvg: change(amount, avg), rows: curB.detail.get(name) || [] };
    }).filter(m => m.amount > 0 || (m.prev || 0) > 0);
    const contributors = merchants.filter(m => m.vsPrev && m.vsPrev.amount > 0.5).sort((a, b) => b.vsPrev.amount - a.vsPrev.amount).slice(0, 3);
    return { period: cur, days, previous: prevP, total: cur.total, prevTotal, avgTotal, vsPrev: change(cur.total, prevTotal), vsAvg: change(cur.total, avgTotal), merchants, contributors, comparedPeriods: others.length };
}
