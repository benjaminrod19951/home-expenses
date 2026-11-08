// Shared formatting and date helpers. Pure functions, covered by tests/format.test.mjs.

export const money = n => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n) || 0);

export const num = n => Number(n) || 0;

// IMPORTANT: never use toISOString() for calendar dates. It converts to UTC, and in Israel
// (UTC+2/+3) that moves the date one day back around midnight.
export const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Excel/SheetJS dates arrive around LOCAL midnight (sometimes a few seconds before it).
// Rounding to local noon always gives the right calendar day.
export const dateToLocalISO = d => localISO(new Date(d.getTime() + 12 * 3600 * 1000));

export const today = () => localISO(new Date());

export const monthLabel = m => {
    if (!m)
        return "";
    const [y, mo] = m.split("-");
    return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(Number(y), Number(mo) - 1, 1));
};

export const pct = (a, b) => b ? `${((a / b - 1) * 100).toFixed(0)}%` : "—";

export const monthOffset = (m, delta) => {
    if (!m)
        return "";
    const [y, mo] = m.split("-").map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const dateOffset = days => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return localISO(d);
};

// Grocery drill-down uses transaction dates, not statement/bank settlement months.

export const sundayOf = value => {
    const d = new Date(`${value}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return null;
    d.setDate(d.getDate() - d.getDay());
    return d;
};

export const addCalendarDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
};

export const median = arr => {
    if (!arr.length)
        return 0;
    const a = [...arr].sort((x, y) => x - y);
    return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};

export const daysInMonth = month => {
    const [y, m] = String(month).split("-").map(Number);
    return new Date(y, m, 0).getDate();
};
