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

export async function importBankXls(file) {
  // Bank exports from Leumi often have an .xls extension but are actually HTML.
  // We use two parsers: SheetJS first, then DOMParser as a fallback.
  const buf = await file.arrayBuffer();
  const parseBankRows = (rows) => {
    if (!rows?.length) return [];
    const headerIndex = rows.findIndex(r => {
      const s = r.map(norm).join(" | ");
      return /תאריך/.test(s) && (/תיאור/.test(s) || /פרטים/.test(s)) && (/בחובה|חובה/.test(s));
    });
    if (headerIndex < 0) return [];
    const h = rows[headerIndex].map(norm);
    const find = (...names) => {
      for (const n of names) {
        const nn = norm(n);
        const i = h.findIndex(x => x === nn || x.includes(nn));
        if (i >= 0) return i;
      }
      return -1;
    };
    const iDate=find("תאריך"), iValue=find("תאריך ערך"), iDesc=find("תיאור","פרטים"),
      iRef=find("אסמכתא"), iDebit=find("בחובה","חובה"), iCredit=find("בזכות","זכות"),
      iBalance=find("יתרה בש"), iNote=find("הערה","הערות");
    if(iDate<0 || iDesc<0 || iDebit<0 || iCredit<0) return [];
    const result=[];
    for(let i=headerIndex+1;i<rows.length;i++){
      const r=rows[i]||[];
      const date=isoDate(r[iDate]);
      if(!date) continue;
      const merchant=String(r[iDesc]??"").trim();
      if(!merchant) continue;
      const debit=Math.abs(num(r[iDebit]));
      const credit=Math.abs(num(r[iCredit]));
      if(!debit && !credit) continue;
      const isCardPayment=/לאומי\s*(ויזה|כאל)|בנהפ[- ]?ישראכרט|ישראכרט|מקס|ויזה|כאל|mastercard|visa/i.test(merchant);
      const isTransfer=/העברה|הפקדה|פייבוקס|ביט|מבנק|בנקאי|חיסכון|פיקדון/i.test(merchant);
      const kind = credit ? "income" : (isCardPayment ? "card_payment" : (isTransfer ? "transfer" : "bank_expense"));
      const category = credit ? "הכנסה" : (isCardPayment ? "חיוב כרטיס אשראי" : (isTransfer ? "העברה" : bankCategory(merchant)));
      const amount = credit || debit;
      const ref=String(r[iRef]??"").trim();
      const valueDate=isoDate(r[iValue]) || date;
      const external_id=`bank-${date}-${valueDate}-${ref}-${merchant}-${amount.toFixed(2)}-${credit?"credit":"debit"}`;
      result.push({date,value_date:valueDate,month:month(date),merchant,amount,category,source:"עו״ש",kind,payment_method:"עו״ש",reference:ref,notes:String(r[iNote]??"").trim()||null,balance:num(r[iBalance])||null,external_id});
    }
    return result;
  };

  // SheetJS can parse HTML disguised as XLS and is generally more robust with
  // the very large Leumi export than relying on DOMParser alone.
  try {
    const wb = XLSX.read(buf, {type:"array", cellDates:true});
    for (const sheet of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:""});
      const parsed = parseBankRows(rows);
      if (parsed.length) return parsed;
    }
  } catch (_) {}

  // Fallback for browsers where SheetJS does not expose the HTML table.
  const text = new TextDecoder("utf-8").decode(buf);
  if (/<table[\s>]/i.test(text)) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    for (const table of [...doc.querySelectorAll("table")]) {
      const rows=[...table.querySelectorAll("tr")].map(tr=>[...tr.querySelectorAll("th,td")].map(td=>td.textContent.replace(/\u00a0/g," ").trim())).filter(r=>r.length);
      const parsed=parseBankRows(rows);
      if(parsed.length) return parsed;
    }
  }
  return [];
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