// Pure analysis helpers for the dashboard. No React, no Supabase — covered by tests/insights.test.mjs.
import { daysInMonth, monthOffset, num } from "./format.js";
import { merchantKey } from "./finance.js";

const dayOf = x => Number(String(x?.date || "").slice(8, 10)) || 0;
const sum = rows => rows.reduce((s, x) => s + num(x.amount), 0);

// For the month that is still running, comparing 8 days to a full previous month is misleading
// ("-92%"). Return how far into the month we are, so callers compare to the same days last month.
export function monthProgress(activeMonth, todayISO) {
    const running = activeMonth === String(todayISO).slice(0, 7);
    const day = running ? Number(String(todayISO).slice(8, 10)) : daysInMonth(activeMonth);
    return { running, day, days: daysInMonth(activeMonth) };
}

// Sum of rows dated on day 1..cutoffDay of their month.
export const totalUpToDay = (rows, cutoffDay) => sum(rows.filter(x => dayOf(x) <= cutoffDay));

// Forecast for a running month: what was spent so far + what was spent in the rest of last month.
// (A straight-line forecast exaggerates: a mortgage on the 2nd would project to tens of thousands.)
export function forecastMonthEnd({ currentRows, previousRows, day }) {
    const soFar = sum(currentRows);
    const restLastMonth = sum(previousRows.filter(x => dayOf(x) > day));
    return { soFar, restLastMonth, forecast: soFar + restLastMonth };
}

// Same merchant + same amount + same date, counted more than once. Often a double import or a
// double charge; sometimes legitimate (two identical coffees), so we only *flag* it for review.
export function findPossibleDuplicates(expenseRows, minAmount = 20) {
    const groups = new Map();
    for (const x of expenseRows) {
        const amount = num(x.amount);
        if (amount < minAmount || !x.date)
            continue;
        const key = `${x.date}|${merchantKey(x.merchant) || x.merchant}|${amount.toFixed(2)}`;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(x);
    }
    return [...groups.values()]
        .filter(rows => rows.length > 1)
        .map(rows => ({ date: rows[0].date, merchant: rows[0].merchant, amount: num(rows[0].amount), count: rows.length, extra: num(rows[0].amount) * (rows.length - 1), rows }))
        .sort((a, b) => b.extra - a.extra);
}

const median = arr => {
    const a = [...arr].sort((x, y) => x - y);
    return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : 0;
};

// Fixed monthly charges (subscriptions, insurance, mortgage, arnona...): one charge per month,
// in at least 3 of the last 6 months, with a stable amount. Flags a price increase on the latest charge.
export function detectFixedCharges(expenseRows, refMonth, { lookback = 6, minMonths = 3 } = {}) {
    const inWindow = new Set(Array.from({ length: lookback }, (_, i) => monthOffset(refMonth, -i)));
    const byMerchant = new Map();
    for (const x of expenseRows) {
        if (!inWindow.has(x.month))
            continue;
        const k = merchantKey(x.merchant);
        if (!k)
            continue;
        if (!byMerchant.has(k))
            byMerchant.set(k, []);
        byMerchant.get(k).push(x);
    }
    const out = [];
    for (const [key, rows] of byMerchant) {
        const perMonth = new Map();
        for (const x of rows)
            perMonth.set(x.month, [...(perMonth.get(x.month) || []), x]);
        if (perMonth.size < minMonths || [...perMonth.values()].some(r => r.length > 1))
            continue; // weekly shopping etc. is not a fixed charge
        const ordered = [...perMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, r]) => ({ month, row: r[0], amount: num(r[0].amount) }));
        // Stability is judged on the earlier months; the latest charge may be a price change.
        const earlier = ordered.slice(0, -1);
        const latest = ordered[ordered.length - 1];
        const typical = median(earlier.map(x => x.amount));
        if (!typical || earlier.some(x => Math.abs(x.amount - typical) / typical > 0.1))
            continue; // amounts jump around -> not a fixed charge
        if (latest.amount < typical * 0.5 || latest.amount > typical * 1.6)
            continue; // latest looks like a one-off, not the same charge
        const before = typical;
        const increase = latest.amount - before;
        const increased = increase >= 2 && increase / before >= 0.03;
        out.push({ key, merchant: latest.row.merchant || key, months: ordered.length, typical, latestAmount: latest.amount, latestMonth: latest.month, previousAmount: before, increased, increase: increased ? increase : 0, rows: ordered.map(x => x.row) });
    }
    return out.sort((a, b) => Number(b.increased) - Number(a.increased) || b.typical - a.typical);
}

// "Why did spending go up?" — this month vs last month, by category, or by merchant inside one category.
// A running month is compared to the same days of last month.
export function explainChange(expenseRows, month, { category = "", todayISO } = {}) {
    const { running, day } = monthProgress(month, todayISO);
    const prevMonth = monthOffset(month, -1);
    const inCat = x => !category || (x.category || "לא מסווג") === category;
    const cur = expenseRows.filter(x => x.month === month && inCat(x) && (!running || dayOf(x) <= day));
    const prev = expenseRows.filter(x => x.month === prevMonth && inCat(x) && (!running || dayOf(x) <= day));
    const keyOf = category ? (x => merchantKey(x.merchant) || x.merchant || "ללא שם") : (x => x.category || "לא מסווג");
    const groups = new Map();
    const add = (x, field) => {
        const k = keyOf(x), g = groups.get(k) || { key: k, label: category ? (x.merchant || k) : k, current: 0, previous: 0 };
        g[field] += num(x.amount);
        groups.set(k, g);
    };
    cur.forEach(x => add(x, "current"));
    prev.forEach(x => add(x, "previous"));
    const rows = [...groups.values()].map(g => ({ ...g, delta: g.current - g.previous, isNew: g.previous === 0 && g.current > 0 }));
    return {
        running, day, prevMonth, total: sum(cur), prevTotal: sum(prev),
        increases: rows.filter(r => r.delta > 0.5).sort((a, b) => b.delta - a.delta),
        decreases: rows.filter(r => r.delta < -0.5).sort((a, b) => a.delta - b.delta),
    };
}
