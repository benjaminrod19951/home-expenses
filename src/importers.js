import * as XLSX from 'xlsx';

const clean=s=>String(s??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLowerCase().replace(/["'`´]/g,'');
const normalizedMerchant=s=>clean(s);

const signedMoney=v=>{
  if(v===null||v===undefined||v==='') return 0;
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  let s=String(v).replace(/₪|\s/g,'').replace(/,/g,'').trim();
  const paren=/^\(.*\)$/.test(s); s=s.replace(/[()]/g,'');
  const n=parseFloat(s.replace(/[^0-9.\-]/g,''));
  if(!Number.isFinite(n)) return 0;
  return paren?-Math.abs(n):n;
};
const absMoney=v=>Math.abs(signedMoney(v));

function excelDate(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==='number' && v>30000 && v<60000){
    const d=XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s=clean(v); if(!s)return '';
  let m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m=s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if(m)return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return s.slice(0,10);
}

function idx(headers,tests){
  return headers.findIndex(h=>tests.some(t=>h===t||h.includes(t)));
}

function classifyBank(desc,direction){
  const n=norm(desc);
  const cardPayment=/(לאומי\s*ויזה|לאומי.*ויזה|ישראכרט|מקס\s*(איט|it|פיננ)|כאל|cal\s*(card|כרטיס))/i.test(n);
  const saving=/(פיקדון|חיסכון|חסכון|משיכת חיסכון|משיכת פיקדון|פירעון פיקדון|פדיון פיקדון|פדיון חיסכון|הקמת פיקדון)/i.test(n);
  const internal=/(העברה.*בין|העברה עצמית|חשבון שלי|חשבון.*שלי|פייבוקס שלי|paybox שלי|לאומי.*שלי)/i.test(n);
  const possibleOwnLeumi=/(בנק לאומי|לאומי לישראל|leumi)/i.test(n);
  const explicitIncome=/(משכורת|שכר עבודה|קצבת|קיצבה|פנסיה|ביטוח לאומי)/i.test(n);
  if(direction==='out' && cardPayment) return {kind:'card_payment',flow_type:'card_payment',category:'חיוב כרטיס אשראי',count_as_expense:false,count_as_income:false,income_amount:0};
  if(saving) return {kind:'saving',flow_type:'saving',category:'חיסכון/פיקדון',count_as_expense:false,count_as_income:false,income_amount:0};
  if(internal) return {kind:'transfer',flow_type:'transfer',category:'העברה',count_as_expense:false,count_as_income:false,income_amount:0};
  if(direction==='in' && explicitIncome) return {kind:'income',flow_type:'income',category:'הכנסה',count_as_expense:false,count_as_income:true,income_amount:null};
  // Most incoming bank credits are real income for this household. Only likely
  // self-transfers from Leumi stay in review until the user confirms the source.
  if(direction==='in' && possibleOwnLeumi) return {kind:'income_review',flow_type:'income_review',category:'הכנסה לבדיקה',count_as_expense:false,count_as_income:false,income_amount:0};
  if(direction==='in') return {kind:'income',flow_type:'income',category:'הכנסה',count_as_expense:false,count_as_income:true,income_amount:null};
  return {kind:'expense',flow_type:'expense',category:'אחר',count_as_expense:true,count_as_income:false,income_amount:0};
}

function findBankHeader(rows){
  for(let i=0;i<Math.min(rows.length,100);i++){
    // A real Leumi header is a compact 8-column row. Ignore wrapper/nested HTML
    // rows that contain the whole transaction table flattened into one row.
    const raw=rows[i]||[];
    if(raw.length<6 || raw.length>15) continue;
    const r=raw.map(norm);
    const hasDate=r.some(x=>x==='תאריך'||x.includes('תאריך'));
    const hasDesc=r.some(x=>x.includes('תיאור')||x.includes('פעולה'));
    const hasDebit=r.some(x=>x.includes('בחובה')||x==='חובה');
    const hasCredit=r.some(x=>x.includes('בזכות')||x==='זכות');
    if(hasDate&&hasDesc&&hasDebit&&hasCredit) return {index:i,headers:r};
  }
  return null;
}

function parseBankRows(rows){
  const h=findBankHeader(rows); if(!h)return [];
  const {index,headers}=h;
  const dateI=idx(headers,['תאריך']);
  const valueDateI=idx(headers,['תאריך ערך','תאריך הפך']);
  const descI=idx(headers,['תיאור','פעולה','פרטים']);
  const refI=idx(headers,['אסמכתא']);
  const debitI=idx(headers,['בחובה','חובה']);
  const creditI=idx(headers,['בזכות','זכות']);
  const balanceI=headers.findIndex(h=>h==='יתרה'||h.includes('יתרה'));
  const noteI=idx(headers,['הערה']);
  if([dateI,descI,debitI,creditI].some(i=>i<0))return [];
  const all=[];
  for(let r=index+1;r<rows.length;r++){
    const row=rows[r]||[];
    const date=excelDate(row[dateI]); if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const merchantRaw=clean(row[descI]);
    // Defensive guard: a shifted/flattened row must never turn a date string into
    // a money amount (e.g. 09/07/2026 -> 9,072,026).
    if(/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(merchantRaw)) continue;
    const debitCell=clean(row[debitI]), creditCell=clean(row[creditI]);
    if(/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(debitCell) || /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(creditCell)) continue;
    const debit=absMoney(row[debitI]),credit=absMoney(row[creditI]);
    if(debit===0&&credit===0)continue;
    const direction=debit!==0?'out':'in';
    const amount=direction==='out'?debit:credit;
    const merchant=merchantRaw||'תנועת בנק';
    const meta=classifyBank(merchant,direction);
    const ref=refI>=0?clean(row[refI]):'';
    const valueDate=valueDateI>=0?excelDate(row[valueDateI]):'';
    const bankBalance=balanceI>=0?signedMoney(row[balanceI]):null;
    const sourceKey=['bank',date,valueDate||date,norm(merchant),ref,debit.toFixed(2),credit.toFixed(2)].join('|');
    all.push({
      date,month:date.slice(0,7),merchant,amount,category:meta.category,source:'עו״ש',kind:meta.kind,flow_type:meta.flow_type,
      count_as_expense:meta.count_as_expense,count_as_income:meta.count_as_income,payment_method:'עו״ש',card_last4:null,
      notes:noteI>=0?(clean(row[noteI])||null):null,reference:ref||null,value_date:valueDate||date,balance:bankBalance,
      bank_description:merchant,bank_direction:direction,bank_debit:debit,bank_credit:credit,bank_value_date:valueDate||date,
      bank_balance:bankBalance,original_amount:amount,income_amount:meta.kind==='income'?amount:(meta.income_amount??0),source_key:sourceKey,external_id:sourceKey
    });
  }
  return all;
}

function cardHeader(rows){
  for(let i=0;i<Math.min(rows.length,100);i++){
    const h=(rows[i]||[]).map(norm);
    const dateI=idx(h,['תאריך עסקה','תאריך']);
    const merchantI=idx(h,['שם בית העסק','בית עסק','בית העסק/תיאור','merchant']);
    const amountI=idx(h,['סכום חיוב','amount']);
    if(dateI>=0&&merchantI>=0&&amountI>=0)return {index:i,headers:h};
  }
  return null;
}

function parseCardRows(rows){
  const found=cardHeader(rows); if(!found)return [];
  const {index,headers}=found;
  const dateI=idx(headers,['תאריך עסקה','תאריך']);
  const merchantI=idx(headers,['שם בית העסק','בית עסק','בית העסק/תיאור','merchant']);
  const catI=idx(headers,['קטגוריה']);
  const cardI=idx(headers,['4 ספרות אחרונות','4 ספרות']);
  const amountI=idx(headers,['סכום חיוב','amount']);
  const chargeI=idx(headers,['תאריך חיוב']);
  const noteI=idx(headers,['הערות','הערה']);
  const originalI=idx(headers,['סכום עסקה מקורי']);
  const base=[];
  for(let r=index+1;r<rows.length;r++){
    const row=rows[r]||[];
    const date=excelDate(row[dateI]);
    const merchant=clean(row[merchantI]);
    const amount=signedMoney(row[amountI]);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!merchant||amount===0)continue;
    const chargeDate=chargeI>=0?excelDate(row[chargeI]):'';
    const cardLast4=cardI>=0?String(row[cardI]??'').replace(/\D/g,'').slice(-4):'';
    const category=catI>=0?(clean(row[catI])||'אחר'):'אחר';
    // Keep the first occurrence compatible with V20/V22 external IDs, and append
    // an occurrence suffix only when an identical transaction appears more than once.
    const fingerprint=['card',date,norm(merchant),Math.abs(amount).toFixed(2)].join('|');
    base.push({fingerprint,date,month:(chargeDate||date).slice(0,7),merchant,amount,category,source:'אשראי',kind:'expense',flow_type:'expense',
      count_as_expense:true,count_as_income:false,payment_method:'אשראי',card_last4:cardLast4||null,charge_date:chargeDate||null,
      notes:noteI>=0?(clean(row[noteI])||null):null,original_amount:originalI>=0?signedMoney(row[originalI]):amount,income_amount:0});
  }
  const seen=new Map();
  return base.map(x=>{
    const n=(seen.get(x.fingerprint)||0)+1; seen.set(x.fingerprint,n);
    const externalId=n===1?x.fingerprint:`${x.fingerprint}|${n}`;
    const sourceKey=['card',x.date,x.charge_date||x.date,norm(x.merchant),Math.abs(x.amount).toFixed(2),x.card_last4||'',n].join('|');
    const {fingerprint,...rest}=x;
    return {...rest,source_key:sourceKey,external_id:externalId};
  });
}

function decodeHtml(s){
  return String(s??'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&#x27;/gi,"'")
    .replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

function bankRowsFromHtml(text){
  const tables=[...text.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m=>m[0]);
  for(const html of tables){
    const probe=decodeHtml(html);
    if(!probe.includes('תיאור')||!probe.includes('בחובה')||!probe.includes('בזכות'))continue;
    const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>
      [...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>decodeHtml(c[1]))
    ).filter(r=>r.length);
    const parsed=parseBankRows(rows); if(parsed.length)return parsed;
  }
  return [];
}

export async function importXlsx(file){
  const buf=await file.arrayBuffer();
  // Leumi's .xls export is actually HTML. Parse it explicitly before SheetJS.
  try{
    const text=new TextDecoder('utf-8').decode(buf);
    if(/<html|<table/i.test(text)){
      const bank=bankRowsFromHtml(text); if(bank.length)return bank;
    }
  }catch(_){/* continue */}

  let wb;
  try{wb=XLSX.read(buf,{type:'array',cellDates:true,raw:true});}
  catch(e){throw new Error('לא ניתן לקרוא את הקובץ: '+e.message)}

  const bank=[];
  for(const sheet of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:true});
    const parsed=parseBankRows(rows); if(parsed.length)bank.push(...parsed);
  }
  if(bank.length)return bank;

  const card=[];
  for(const sheet of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:'',raw:true});
    card.push(...parseCardRows(rows));
  }
  if(card.length)return card;
  throw new Error('לא נמצאה טבלת בנק או אשראי מוכרת בקובץ.');
}
