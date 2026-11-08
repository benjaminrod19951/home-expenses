import { normalizeMerchant } from "./finance.js";
import { dateOffset, today } from "./format.js";

export const HEB_UNITS = {
    "אפס": 0, "אחד": 1, "אחת": 1, "שניים": 2, "שתיים": 2, "שני": 2, "שתי": 2, "שלושה": 3, "שלוש": 3, "ארבעה": 4, "ארבע": 4, "חמישה": 5, "חמש": 5, "שישה": 6, "שש": 6, "שבעה": 7, "שבע": 7, "שמונה": 8, "תשעה": 9, "תשע": 9, "עשרה": 10, "עשר": 10, "אחד עשר": 11, "אחת עשרה": 11, "שנים עשר": 12, "שתים עשרה": 12, "עשרים": 20, "שלושים": 30, "ארבעים": 40, "חמישים": 50, "שישים": 60, "שבעים": 70, "שמונים": 80, "תשעים": 90
};

const NUMBER_WORDS = new Set(["מאה", "מאתיים", "מאות", "אלף", "אלפיים"]);
const isNumberWord = w => HEB_UNITS[w] != null || NUMBER_WORDS.has(w);
export function stripNumberPrefix(word) {
    const w = String(word || "");
    if (isNumberWord(w))
        return w;
    for (const prefix of ["וב", "ול", "ו", "ב", "ל", "כ"]) {
        if (w.startsWith(prefix) && isNumberWord(w.slice(prefix.length)))
            return w.slice(prefix.length);
    }
    return w;
}
export function hebrewNumber(text) {
    let t = String(text || "").replace(/-/g, " ").replace(/\s+/g, " ").trim();
    if (!t)
        return null;
    const direct = Number(t.replace(/,/g, ""));
    if (Number.isFinite(direct))
        return direct;
    let total = 0;
    let current = 0;
    let used = false;
    const tokens = t.split(" ");
    for (let i = 0; i < tokens.length; i++) {
        // Strip a Hebrew prefix only when the rest is a number word: "במאה" -> "מאה", "ושלושים" -> "שלושים".
        // ("בשופרסל" stays as is.) Before this, "במאה עשרים וחמישה" was read as 25 instead of 125.
        let tok = stripNumberPrefix(tokens[i]);
        const pair = `${tok} ${stripNumberPrefix(tokens[i + 1] || "")}`.trim();
        if (HEB_UNITS[pair] != null) {
            current += HEB_UNITS[pair];
            i++;
            used = true;
            continue;
        }
        if (HEB_UNITS[tok] != null) {
            current += HEB_UNITS[tok];
            used = true;
            continue;
        }
        if (tok === "מאה") {
            current += (current ? 0 : 1) * 100;
            used = true;
            continue;
        }
        if (tok === "מאתיים") {
            current += 200;
            used = true;
            continue;
        }
        if (tok === "מאות") {
            const prev = current || 1;
            current = prev * 100;
            used = true;
            continue;
        }
        if (tok === "אלף") {
            total += (current || 1) * 1000;
            current = 0;
            used = true;
            continue;
        }
        if (tok === "אלפיים") {
            total += 2000;
            used = true;
            continue;
        }
    }
    return used ? total + current : null;
}

// Digits: "1,200" or "1200" (the old pattern read "9000" as 900 — it took up to 3 digits without a comma).
export function amountFromSpeech(text) {
    const digit = String(text || "").match(/(?:₪\s*)?(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)\s*(?:₪|ש(?:קל|קלים)|שח)?/i);
    if (digit)
        return Math.abs(Number(digit[1].replace(/,/g, "")));
    const before = String(text || "").match(/((?:[א-ת]+\s+){0,5}[א-ת]+)\s+(?:שקל|שקלים|שח|₪)/i);
    return before ? hebrewNumber(before[1]) : null;
}

export function extractExplicitCategory(text, cats) {
    const raw = String(text || "");
    const m = raw.match(/(?:קטגוריה|קטגוריית)\s+(.+?)(?=\s+(?:היום|אתמול|שלשום|מחר|במזומן|מזומן|בביט|ביט|באשראי|אשראי|בהעברה|העברה|הכנסה|הוצאה|קיבלתי|קיבלנו|שילמתי|שילמנו)|[,;.]|$)/i);
    if (!m)
        return null;
    const q = normalizeMerchant(m[1]);
    if (!q)
        return null;
    return cats.find(c => normalizeMerchant(c) === q) || cats.find(c => normalizeMerchant(c).includes(q) || q.includes(normalizeMerchant(c))) || null;
}

export function stripExplicitCategory(text, cats) {
    let t = String(text || "");
    const explicit = extractExplicitCategory(t, cats);
    if (explicit) {
        const esc = explicit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        t = t.replace(new RegExp(`(?:קטגוריה|קטגוריית)\\s+${esc}`, "i"), " ");
    }
    else
        t = t.replace(/(?:קטגוריה|קטגוריית)\s+[^,;.]+(?=$|[,;.])/i, " ");
    return t;
}

// NOTE: JavaScript's \b only knows English letters, so it never matched next to Hebrew words
// (e.g. "שילמתי", "במזומן" stayed in the description). Hebrew-aware boundaries are used instead.
export function cleanQuickText(text, cats = []) {
    let t = stripExplicitCategory(text, cats);
    t = t.replace(/(?<![\p{L}\p{N}])(?:היום|אתמול|שלשום|מחר)(?![\p{L}\p{N}])/gu, " ").replace(/(?<![\p{L}\p{N}])(?:במזומן|מזומן|באשראי|אשראי|בביט|ביט|בהעברה|העברה)(?![\p{L}\p{N}])/gu, " ").replace(/(?:₪\s*)?\d[\d,.]*\s*(?:₪|שקל(?:ים)?|שח)?/gi, " ").replace(/(?<![\p{L}\p{N}])(?:ו|ב|וב|ל|ול)?(?:אפס|אחד|אחת|שניים|שתיים|שני|שתי|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש|שישה|שש|שבעה|שבע|שמונה|תשעה|תשע|עשרה|עשר|עשרים|שלושים|ארבעים|חמישים|שישים|שבעים|שמונים|תשעים|מאה|מאתיים|מאות|אלף|אלפיים)(?![\p{L}\p{N}])/gu, " ").replace(/(?<![\p{L}\p{N}])(?:שקל|שקלים|שח)(?![\p{L}\p{N}])/gu, " ");
    t = t.replace(/(?<![\p{L}\p{N}])(?:שילמתי|שילמנו|הוצאתי|הוצאה|הוצאות|קניתי|קנייה|הייתי|היה|עבור|קיבלתי|קיבלנו|הכנסה|הכנסות|נכנס|נכנסה|התקבל|התקבלה|זיכוי|לי|לה|לו|אז|נגיד)(?![\p{L}\p{N}])/gu, " ").replace(/^\s*(?:על|ב|מ)\s+/g, " ").replace(/\s+/g, " ").trim().replace(/^[,.-]+|[,.-]+$/g, "");
    return t;
}

export function historyCategory(cleaned, history) {
    const q = normalizeMerchant(cleaned);
    if (q.length < 2)
        return null;
    const qWords = q.split(" ").filter(w => w.length > 1);
    const matches = (history || []).filter(x => x.category && x.category !== "לא מסווג").map(x => ({ x, n: normalizeMerchant(x.merchant) })).filter(({ n }) => n && (n === q || n.includes(q) || q.includes(n) || (qWords.length && qWords.every(w => n.includes(w)))));
    if (!matches.length && qWords.length === 1 && qWords[0].length >= 3) {
        const token = qWords[0];
        matches.push(...(history || []).filter(x => x.category && x.category !== "לא מסווג" && normalizeMerchant(x.merchant).split(" ").includes(token)).map(x => ({ x, n: normalizeMerchant(x.merchant) })));
    }
    if (!matches.length)
        return null;
    const counts = new Map();
    for (const { x } of matches)
        counts.set(x.category, (counts.get(x.category) || 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1])
        return null;
    return ranked[0][0];
}

export function quickCategory(text, cats, rules, history = []) {
    const explicit = extractExplicitCategory(text, cats);
    if (explicit)
        return explicit;
    const cleaned = cleanQuickText(text, cats);
    const n = normalizeMerchant(cleaned);
    const direct = cats.find(c => normalizeMerchant(c) && n.includes(normalizeMerchant(c)));
    if (direct)
        return direct;
    const rule = [...rules].sort((a, b) => String(b.merchant_key || "").length - String(a.merchant_key || "").length).find(r => {
        const k = normalizeMerchant(r.merchant_key || r.merchant_label);
        return k && n.length >= 2 && (n.includes(k) || k.includes(n)); // empty text must not match every rule
    });
    if (rule?.category)
        return rule.category;
    const learned = historyCategory(cleaned, history);
    if (learned && cats.includes(learned))
        return learned;
    const guesses = [
        [/סופר|מכולת|רמי לוי|שופרסל|ויקטורי|אושר עד/, "סופר"], [/כלב|חתול|וטרינר|אוכל.*כלב|אוכל.*חתול/, "בעלי חיים"], [/מטפלת|בייביסיטר|גן ילדים|צהרון/, cats.includes("ילדים") ? "ילדים" : "אחר"], [/חשמל|גיחון|מים|גז|סופרגז|פזגז|אמישראגז/, "חשבונות"], [/דלק|חניה|חניון|כביש 6|מוסך/, "רכב ותחבורה"], [/מסעדה|קפה|וולט|wolt|תן ביס|משלוח/, "מסעדות ומשלוחים"], [/סופר פארם|בית מרקחת|תרופה|רופא|קופת חולים/, "בריאות"], [/נטפליקס|spotify|ספוטיפיי|youtube|יוטיוב|google one|מנוי/, "מנויים"], [/בגד|נעל|זארה|h&m/, "ביגוד"]
    ];
    for (const [re, cat] of guesses)
        if (re.test(n) && cats.includes(cat))
            return cat;
    return cats.includes("אחר") ? "אחר" : (cats[0] || "לא מסווג");
}

export function correctTranscriptSpelling(value, history = []) {
    let result = String(value || "");
    // Conservative substitutions only; amounts and dates remain untouched.
    const replacements = [[/(^|\s)בלאדות(?=\s|$|[,.;])/gu, "$1ולדות"]];
    for (const [pattern, replacement] of replacements)
        result = result.replace(pattern, replacement);
    // Prefer a previously used merchant name only for a near-exact single-word typo.
    const names = [...new Set((history || []).map(x => String(x.merchant || "").trim()).filter(x => x.length >= 3 && x.length <= 35))];
    const distance = (a, b) => {
        if (Math.abs(a.length - b.length) > 1)
            return 3;
        let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
        for (let i = 1; i <= a.length; i++) {
            const next = [i];
            for (let j = 1; j <= b.length; j++)
                next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = next;
        }
        return prev[b.length];
    };
    result = result.replace(/[א-ת]{4,}/gu, word => {
        const matches = names.filter(n => /^[א-ת]+$/.test(n) && distance(word, n) === 1);
        return matches.length === 1 ? matches[0] : word;
    });
    return result;
}

export function quickMerchant(text, cats = []) {
    return cleanQuickText(text, cats) || "תנועה ידנית";
}

// Words that describe the same entry when they follow an amount ("120 שקל קטגוריה סופר", "120 שקל במזומן").
const SAME_ENTRY_AFTER_AMOUNT = "(?:קטגוריה|קטגוריית|במזומן|מזומן|באשראי|אשראי|בביט|ביט|בהעברה|העברה|היום|אתמול|שלשום)";
const CURRENCY_FOLLOWED_BY_TEXT = new RegExp(`(שקל(?:ים)?|שח|₪)\\s+(?=[^,;.\\s])(?!${SAME_ENTRY_AFTER_AMOUNT}(?![\\p{L}\\p{N}]))`, "gu");

export function splitQuickSpeech(text) {
    const marked = String(text || "").replace(/\n+/g, ". ").replace(CURRENCY_FOLLOWED_BY_TEXT, "$1||| ");
    // "," and "." inside a number ("1,200", "12.50") are not separators
    return marked.split(/\s*(?:\|\|\||(?<!\d),|,(?!\d)|;|(?<!\d)\.|\.(?!\d)| ואז | ואחר כך | בנוסף | וגם )\s*/).map(x => x.trim()).filter(Boolean);
}

// Pieces without an amount ("טיטולים", "תינוק") belong to a neighbouring amount:
//  * speech starts with an amount ("150 שקל, טיטולים, תינוק, 250 שקל, ...") -> they belong to the amount BEFORE them;
//  * speech starts with text ("טיטולים, תינוק, 150 שקל, ...") -> they belong to the amount AFTER them.
export function groupQuickPieces(pieces) {
    const hasAmount = p => amountFromSpeech(p) != null;
    const groups = [];
    if (!pieces.length)
        return groups;
    if (hasAmount(pieces[0])) {
        for (const p of pieces) {
            if (hasAmount(p) || !groups.length)
                groups.push([p]);
            else
                groups[groups.length - 1].push(p);
        }
    }
    else {
        let pending = [];
        for (const p of pieces) {
            pending.push(p);
            if (hasAmount(p)) {
                groups.push(pending);
                pending = [];
            }
        }
        if (pending.length && groups.length)
            groups[groups.length - 1].push(...pending); // trailing words after the last amount
    }
    return groups.filter(g => g.some(hasAmount));
}

export function quickEntryType(part) {
    return /(?:^|\s)(?:הכנסה|הכנסות|קיבלתי|קיבלנו|נכנס(?:ה)?|התקבל(?:ה)?|זיכוי)(?:\s|$)/.test(String(part || "")) ? "income" : "expense";
}

export function parseQuickEntries(text, cats, rules, history = []) {
    const isCategoryWord = p => cats.find(c => c !== "לא מסווג" && normalizeMerchant(c) === normalizeMerchant(p)) || null;
    return groupQuickPieces(splitQuickSpeech(text)).map((pieces, i) => {
        const part = pieces.join(", ");
        const amount = amountFromSpeech(part);
        if (!amount)
            return null;
        const type = quickEntryType(part);
        const payment = /מזומן/.test(part) ? "מזומן" : /ביט/.test(part) ? "ביט" : /אשראי/.test(part) ? "אשראי" : /העברה/.test(part) ? "העברה" : type === "income" ? "העברה" : "מזומן";
        const date = /שלשום/.test(part) ? dateOffset(-2) : /אתמול/.test(part) ? dateOffset(-1) : today();
        const categoryPiece = pieces.map(isCategoryWord).find(Boolean);
        const textPieces = pieces.filter(p => !isCategoryWord(p) || pieces.length === 1);
        const merchant = quickMerchant(textPieces.join(" "), cats);
        const category = categoryPiece || quickCategory(part, cats, rules, history);
        return {
            _key: `q-${Date.now()}-${i}`, type, date, amount, category, merchant, payment_method: payment, notes: `הזנה מהירה: ${part}`
        };
    }).filter(Boolean);
}
