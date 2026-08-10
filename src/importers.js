import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const norm = v => String(v ?? "").trim().toLowerCase().replace(/\s+/g," ");
const num = v => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/\u00a0/g," ").trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[₪,\s"]/g,"").replace(/[^0-9.]/g,"");
  const n = Number(s) || 0;
  return negative ? -n : n;
};
const isoDate = v => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0,10);
  if (typeof v === "number") { const d=XLSX.SSF.parse_date_code(v); return d?`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`:""; }
  const s=String(v??"").trim();
  let m=s.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/); if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  m=s.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/); return m?`${m[1]}-${m[2]}-${m[3]}`:"";
};
const month=d=>d?d.slice(0,7):"";

export function classify(category, merchant){
  const x=norm(`${category} ${merchant}`);
  if(/סופר|מזון|grocery|food|שופרסל|רמי לוי|ויקטורי|טיב טעם|מעיין 2000/.test(x))return "סופר";
  if(/מסעד|restaurant|wolt|10bis|תן ביס|קפה/.test(x))return "מסעדות ומשלוחים";
  if(/דלק|תחבורה|paz|sonol|delek/.test(x))return "רכב ותחבורה";
  if(/רפואה|בתי מרקחת|בריאות|סופר פארם|pharm/.test(x))return "בריאות";
  if(/netflix|spotify|youtube|google one|chatgpt|מנוי|תקשורת/.test(x))return "מנויים";
  if(/חשמל|גז|מים|ארנונה|עירייה/.test(x))return "חשבונות";
  if(/פנאי|בידור|ספורט/.test(x))return "בילויים";
  return "אחר";
}

function parseCardRows(rows, sourceName){
  const headerIndex=rows.findIndex(r=>r.some(v=>norm(v)==="תאריך עסקה")); if(headerIndex<0)return [];
  const h=rows[headerIndex].map(v=>String(v??"")); const exact=t=>h.findIndex(x=>norm(x)===t); const includes=t=>h.findIndex(x=>norm(x).includes(t));
  const iDate=exact("תאריך עסקה"),iMerchant=exact("שם בית העסק"),iCat=exact("קטגוריה"),iCard=includes("4 ספרות"),iAmount=exact("סכום חיוב"),iCharge=exact("תאריך חיוב");
  return rows.slice(headerIndex+1).map((r,i)=>{
    const date=isoDate(r[iDate]),merchant=String(r[iMerchant]??"").trim(),amount=Math.abs(num(r[iAmount])),charge=isoDate(r[iCharge]);
    if(!date||!merchant||!amount)return null;
    const cardLast4=String(r[iCard]??"").replace(/\D/g,"").slice(-4);
    const sourceKey=`card|${date}|${charge||date}|${normalizeMerchantKey(merchant)}|${amount.toFixed(2)}|${cardLast4}`;
    return {date,month:month(charge||date),merchant,amount,category:classify(r[iCat],merchant),source:"אשראי",kind:"card_purchase",flow_type:"expense",count_as_expense:true,count_as_income:false,income_amount:0,payment_method:"אשראי",card_last4:cardLast4||null,charge_date:charge||null,source_key:sourceKey,external_id:sourceKey};
  }).filter(Boolean);
}

function normalizeMerchantKey(s){return String(s??"").replace(/\s+/g," ").trim();}

function classifyBankRow(merchant,debit,credit){
  const d=norm(merchant);
  const cardPayment=/לאומי\s*ויזה|בנהפ[- ]?ישראכרט|מקס\s*איט\s*פיננ|ישראכרט\s*בע"?מ/.test(d);
  const savings=/הקמת\s*פיקדון|משיכת\s*חיסכון|פירעון\s*פיקדון|פדיון\s*פיקדון|פדיון\s*חיסכון|משיכת\s*פיקדון/.test(d);
  const explicitIncome=/משכורת|שכר|קצבת|קיצבה|פנסיה|שכר\s*עבודה|ביטוח\s*לאומי/.test(d);
  if(debit>0){
    if(cardPayment)return {kind:"card_payment",flow_type:"card_payment",category:"חיוב כרטיס אשראי",count_as_expense:false,count_as_income:false,income_amount:0,payment_method:"עו״ש"};
    if(savings)return {kind:"transfer",flow_type:"transfer",category:"חיסכון / פיקדון",count_as_expense:false,count_as_income:false,income_amount:0,payment_method:"עו״ש"};
    return {kind:"bank_expense",flow_type:"expense",category:bankCategory(merchant),count_as_expense:true,count_as_income:false,income_amount:0,payment_method:"עו״ש"};
  }
  if(credit>0){
    if(savings)return {kind:"transfer",flow_type:"transfer",category:"משיכת חיסכון / פיקדון",count_as_expense:false,count_as_income:false,income_amount:0,payment_method:"עו״ש"};
    if(explicitIncome)return {kind:"income",flow_type:"income",category:"הכנסה",count_as_expense:false,count_as_income:true,income_amount:credit,payment_method:"עו״ש"};
    return {kind:"income_review",flow_type:"income_review",category:"הכנסה לבדיקה",count_as_expense:false,count_as_income:false,income_amount:0,payment_method:"עו״ש"};
  }
  return {kind:"transfer",flow_type:"transfer",category:"העברה",count_as_expense:false,count_as_income:false,income_amount:0,payment_method:"עו״ש"};
}

function parseBankRows(rows){
  if(!rows?.length)return [];
  const headerIndex=rows.findIndex(r=>{
    const a=r.map(norm); return a.includes("תאריך")&&a.includes("תאריך ערך")&&a.includes("תיאור")&&a.includes("אסמכתא")&&(a.includes("בחובה")||a.includes("חובה"))&&(a.includes("בזכות")||a.includes("זכות"));
  });
  if(headerIndex<0)return [];
  const h=rows[headerIndex].map(norm);
  const find=(...names)=>{for(const n of names){const nn=norm(n);const i=h.findIndex(x=>x===nn||x.includes(nn));if(i>=0)return i;}return -1;};
  const iDate=find("תאריך"),iValue=find("תאריך ערך"),iDesc=find("תיאור","פרטים"),iRef=find("אסמכתא"),iDebit=find("בחובה","חובה"),iCredit=find("בזכות","זכות"),iBalance=find("היתרה בש"),iNote=find("הערה","הערות");
  if([iDate,iDesc,iDebit,iCredit].some(i=>i<0))return [];
  const out=[];
  for(let i=headerIndex+1;i<rows.length;i++){
    const r=rows[i]||[]; const date=isoDate(r[iDate]); if(!date)continue; const merchant=String(r[iDesc]??"").replace(/\s+/g," ").trim(); if(!merchant)continue;
    const debit=Math.abs(num(r[iDebit])),credit=Math.abs(num(r[iCredit])); if(!debit&&!credit)continue;
    const c=classifyBankRow(merchant,debit,credit); const amount=debit||credit; const ref=String(r[iRef]??"").trim(); const valueDate=isoDate(r[iValue])||date;
    const sourceKey=`bank|${date}|${valueDate}|${ref}|${normalizeMerchantKey(merchant)}`;
    out.push({date,value_date:valueDate,month:month(date),merchant,amount,category:c.category,source:"עו״ש",kind:c.kind,flow_type:c.flow_type,count_as_expense:c.count_as_expense,count_as_income:c.count_as_income,income_amount:c.income_amount,payment_method:c.payment_method,reference:ref,notes:String(r[iNote]??"").trim()||null,balance:iBalance>=0?num(r[iBalance]):null,source_key:sourceKey,external_id:sourceKey});
  }
  return out;
}

export async function importBankXls(file){
  const buf=await file.arrayBuffer();

  // Leumi exports use .xls as a wrapper around an HTML document.  Do NOT let
  // SheetJS guess the structure first: the real bank table has 8 columns and
  // must map debit/credit/balance by their Hebrew headers.
  const decodeHtml = (s) => s
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/&#x27;/gi,"'")
    .replace(/<br\s*\/?>/gi," ")
    .replace(/<[^>]*>/g," ")
    .replace(/\s+/g," ")
    .trim();

  try {
    const text=new TextDecoder("utf-8").decode(buf);
    // Find the table whose header contains all bank columns.  This avoids
    // accidentally reading the summary tables at the top of the export.
    const tables=[...text.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
    for(const html of tables){
      const probe=decodeHtml(html);
      if(!probe.includes("תאריך ערך") || !probe.includes("תיאור") || !probe.includes("אסמכתא") || !probe.includes("בחובה") || !probe.includes("בזכות")) continue;
      const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>
        [...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>decodeHtml(c[1]))
      ).filter(r=>r.length);
      const parsed=parseBankRows(rows);
      if(parsed.length) return parsed;
    }
  } catch(_) {}

  // Fallback for browsers where regex/HTML parsing is not available.
  try {
    const doc=new DOMParser().parseFromString(new TextDecoder("utf-8").decode(buf),"text/html");
    for(const table of [...doc.querySelectorAll("table")]){
      const rows=[...table.querySelectorAll("tr")].map(tr=>[...tr.querySelectorAll("th,td")].map(td=>td.textContent.replace(/\u00a0/g," ").replace(/\s+/g," ").trim())).filter(r=>r.length);
      const parsed=parseBankRows(rows);
      if(parsed.length)return parsed;
    }
  } catch(_) {}

  // Last resort: a genuine binary Excel workbook.
  try{
    const wb=XLSX.read(buf,{type:"array",cellDates:true});
    for(const sheet of wb.SheetNames){
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:""});
      const parsed=parseBankRows(rows); if(parsed.length)return parsed;
    }
  }catch(_){}
  return [];
}
export async function importXlsx(file){
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true}); const result=[];
  for(const sheet of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:""});result.push(...parseCardRows(rows,`${file.name}:${sheet}`));}
  return result;
}

function bankCategory(desc){
  const d=norm(desc);
  if(/משכנת/.test(d))return "דיור";
  if(/עיריית|חשמל|מים|ארנונה/.test(d))return "חשבונות";
  if(/קרן מכבי|רופא|מרפאה/.test(d))return "בריאות";
  if(/דלק|פז|סונול|טן\s+חברה/.test(d))return "רכב ותחבורה";
  if(/העברה|פייבוקס|ביט/.test(d))return "העברה";
  return "אחר";
}

export async function importBankPdf(file){
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise; let text="";
  for(let p=1;p<=pdf.numPages;p++){const content=await (await pdf.getPage(p)).getTextContent();text+=content.items.map(i=>i.str).join(" ")+"\n";}
  const result=[];
  for(const line of text.split(/\r?\n/).map(x=>x.trim())){
    const m=line.match(/^(\d{2}[./]\d{2}[./]\d{4})\s+(.+?)\s+(?:₪\s*)?([\d,]+\.\d{2})\s+(?:₪\s*)?([\d,]+\.\d{2})\s*₪?$/); if(!m)continue;
    const date=isoDate(m[1]),merchant=m[2].trim(),a=Math.abs(num(m[3])),b=Math.abs(num(m[4])); const credit=a===0?b:0,debit=b===0?a:Math.max(a,b); const c=classifyBankRow(merchant,debit,credit); const amount=debit||credit; const sourceKey=`bank|${date}|||${normalizeMerchantKey(merchant)}|${amount.toFixed(2)}`;
    result.push({date,month:month(date),merchant,amount,category:c.category,source:"עו״ש",kind:c.kind,flow_type:c.flow_type,count_as_expense:c.count_as_expense,count_as_income:c.count_as_income,income_amount:c.income_amount,payment_method:"עו״ש",source_key:sourceKey,external_id:sourceKey});
  }
  return result;
}
