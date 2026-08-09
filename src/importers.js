import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const norm = v => String(v ?? "").trim().toLowerCase().replace(/\s+/g," ");
const num = v => {
  if (typeof v === "number") return v;
  return Number(String(v ?? "").replace(/[₪,\s"]/g,"").replace(/[^0-9.-]/g,"")) || 0;
};
const isoDate = v => {
  if (v instanceof Date) return v.toISOString().slice(0,10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}` : "";
  }
  const s = String(v ?? "");
  let m = s.match(/(\d{2})[-/.](\d{2})[-/.](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const month = d => d ? d.slice(0,7) : "";

export function classify(category, merchant) {
  const x = norm(`${category} ${merchant}`);
  if (/סופר|מזון|grocery|food|שופרסל|רמי לוי|ויקטורי|טיב טעם|מעיין 2000/.test(x)) return "סופר";
  if (/מסעד|restaurant|wolt|10bis|תן ביס|קפה/.test(x)) return "מסעדות ומשלוחים";
  if (/דלק|תחבורה|paz|sonol|delek/.test(x)) return "רכב ותחבורה";
  if (/רפואה|בתי מרקחת|בריאות|סופר פארם|pharm/.test(x)) return "בריאות";
  if (/netflix|spotify|youtube|google one|chatgpt|מנוי|תקשורת/.test(x)) return "מנויים";
  if (/חשמל|גז|מים|ארנונה|עירייה/.test(x)) return "חשבונות";
  if (/פנאי|בידור|ספורט/.test(x)) return "בילויים";
  return "אחר";
}

function parseCardRows(rows, sourceName) {
  const headerIndex = rows.findIndex(r => r.some(v => norm(v) === "תאריך עסקה"));
  if (headerIndex < 0) return [];
  const h = rows[headerIndex].map(v => String(v ?? ""));
  const exact = t => h.findIndex(x => norm(x) === t);
  const includes = t => h.findIndex(x => norm(x).includes(t));
  const iDate = exact("תאריך עסקה");
  const iMerchant = exact("שם בית העסק");
  const iCat = exact("קטגוריה");
  const iCard = includes("4 ספרות");
  const iAmount = exact("סכום חיוב");
  const iCharge = exact("תאריך חיוב");

  return rows.slice(headerIndex+1).map((r,i) => {
    const date = isoDate(r[iDate]);
    const merchant = String(r[iMerchant] ?? "").trim();
    const amount = num(r[iAmount]);
    const charge = isoDate(r[iCharge]);
    if (!date || !merchant || !amount) return null;
    return {
      date,
      month: month(charge || date),
      merchant,
      amount,
      category: classify(r[iCat], merchant),
      source: "אשראי",
      kind: "card_purchase",
      payment_method: "אשראי",
      card_last4: String(r[iCard] ?? ""),
      charge_date: charge || null,
      external_id: `card-${sourceName}-${i}-${date}-${merchant}-${amount}`
    };
  }).filter(Boolean);
}

export async function importXlsx(file) {
  const wb = XLSX.read(await file.arrayBuffer(), {type:"array", cellDates:true});
  const result = [];
  for (const sheet of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:""});
    result.push(...parseCardRows(rows, `${file.name}:${sheet}`));
  }
  return result;
}

function bankCategory(desc) {
  const d = norm(desc);
  if (/ויזה|ישראכרט|מקס/.test(d)) return "חיוב כרטיס אשראי";
  if (/משכנת/.test(d)) return "דיור";
  if (/עיריית|חשמל|מים|ארנונה/.test(d)) return "חשבונות";
  if (/קרן מכבי|רופא|מרפאה/.test(d)) return "בריאות";
  if (/העברה|פיקדון|חיסכון|פייבוקס|מבנק/.test(d)) return "העברה";
  if (/קצבת|משכורת/.test(d)) return "הכנסה";
  return "אחר";
}

export async function importBankPdf(file) {
  const pdf = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  let text = "";
  for (let p=1; p<=pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    text += content.items.map(i=>i.str).join(" ") + "\n";
  }

  const result = [];
  for (const line of text.split(/\r?\n/).map(x=>x.trim())) {
    const m = line.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s+(?:₪\s*)?([\d,]+\.\d{2})\s+(?:₪\s*)?([\d,]+\.\d{2})\s*₪?$/);
    if (!m) continue;
    const date = isoDate(m[1]);
    const merchant = m[2].trim();
    const amount = Math.max(num(m[3]), num(m[4]));
    const category = bankCategory(merchant);
    result.push({
      date, month:month(date), merchant, amount, category,
      source:"עו״ש",
      kind:category==="חיוב כרטיס אשראי" ? "card_statement" : "bank_movement",
      payment_method:"עו״ש",
      external_id:`bank-${file.name}-${date}-${merchant}-${amount}`
    });
  }
  return result;
}