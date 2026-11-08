import { monthOffset, num } from "./format.js";

export const DEFAULT_CATS = [
    "סופר", "מסעדות ומשלוחים", "דיור", "חשבונות", "רכב ותחבורה", "קניות", "גינון", "בעלי חיים", "בריאות", "בילויים", "מנויים", "ביגוד", "מתנות", "חופשות", "תחזוקה ותיקונים", "אחר"
];

export const isIncome = x => x.count_as_income != null ? x.count_as_income === true : (String(x.flow_type || x.kind || "") === "income");

export const isTransfer = x => ["transfer", "card_payment", "saving"].includes(String(x.flow_type || "")) || ["transfer", "card_payment", "saving"].includes(String(x.kind || "")) || ["העברה", "חיוב כרטיס אשראי", "חיסכון/פיקדון"].includes(x.category);

export const isExpense = x => !(x.source === "עו״ש" && (/אשראי|כרטיס|ממתין להתאמה/.test(String(x.category || "")) || ["card_candidate", "card_payment"].includes(x.kind))) && (Boolean(x.count_as_expense) || (!("count_as_expense" in x) && !isIncome(x) && !isTransfer(x) && num(x.amount) > 0));

export const incomeValue = x => isIncome(x) ? (x.income_amount != null ? num(x.income_amount) : num(x.amount)) : 0;

export const normalizeMerchant = s => String(s || "").toLowerCase().replace(/["'`´]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

export const merchantKey = s => {
    const n = normalizeMerchant(s);
    if (!n)
        return "";
    const aliases = [
        [/סופר פארם|super pharm|super-pharm/i, "סופר פארם"], [/שופרסל|shufersal/i, "שופרסל"], [/רמי לוי|rami levy/i, "רמי לוי"], [/wolt/i, "wolt"], [/paz|פז/i, "פז"], [/sonol|סונול/i, "סונול"], [/delek|דלק/i, "דלק"]
    ];
    for (const [re, key] of aliases)
        if (re.test(n))
            return key;
    return n.split(" ").slice(0, 2).join(" ");
};

export const catName = x => x?.category || "לא מסווג";

export const isPeriodicUtility = x => {
    const n = normalizeMerchant(`${x?.merchant || ""} ${x?.category || ""}`);
    return /(חברת החשמל|חשמל לישראל|הגיחון|גיחון|סופר ?פאוור.*גז|סופרגז|פזגז|אמישראגז|צריכת מים|חשבון מים)/i.test(n);
};

export const periodicWindowAverage = (rows, month, category) => {
    const m0 = month;
    const m1 = monthOffset(month, -1);
    return rows.filter(x => isExpense(x) && isPeriodicUtility(x) && catName(x) === category && [m0, m1].includes(x.month)).reduce((s, x) => s + num(x.amount), 0) / 2;
};

export function sortRows(rows, sort) {
    const a = [...(rows || [])];
    if (!sort?.key)
        return a;
    const k = sort.key;
    return a.sort((x, y) => {
        let av = x?.[k];
        let bv = y?.[k];
        if (k === "amount") {
            av = num(av);
            bv = num(bv);
        }
        else {
            av = String(av ?? "").toLocaleLowerCase("he");
            bv = String(bv ?? "").toLocaleLowerCase("he");
        }
        if (av < bv)
            return sort.dir === "asc" ? -1 : 1;
        if (av > bv)
            return sort.dir === "asc" ? 1 : -1;
        return 0;
    });
}
