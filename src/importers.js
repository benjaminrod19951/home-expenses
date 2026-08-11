import * as XLSX from 'xlsx';

const clean=s=>String(s??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const norm=s=>clean(s).toLowerCase().replace(/["'`´]/g,'');
const moneyNumber=v=>{
  if(v===null||v===undefined||v==='') return 0;
  if(typeof v==='number') return Math.abs(v);
  const s=String(v).replace(/₪|\s/g,'').replace(/,/g,'').replace(/[()]/g,'');
  const n=parseFloat(s.replace(/[^0-9.\-]/g,''));
  return Number.isFinite(n)?Math.abs(n):0;
};
function excelDate(v){
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  if(typeof v==='number' && v>30000 && v<60000){const d=XLSX.SSF.parse_date_code(v);return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
  const s=clean(v); if(!s)return '';
  let m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/); if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return s.slice(0,10);
}
function findHeader(rows){
  for(let i=0;i<Math.min(rows.length,80);i++){
    const r=rows[i].map(norm); const hasDate=r.some(x=>x==='תאריך'||x.includes('תאריך')); const hasDesc=r.some(x=>x.includes('תיאור')||x.includes('פעולה')); const hasDebit=r.some(x=>x.includes('בחובה')||x==='חובה'); const hasCredit=r.some(x=>x.includes('בזכות')||x==='זכות');
    if(hasDate&&hasDesc&&(hasDebit||hasCredit)) return {index:i,headers:r,raw:rows[i]};
  }
  return null;
}
function idx(headers,tests){return headers.findIndex(h=>tests.some(t=>h===t||h.includes(t)));}
function classifyBank(desc,amount,direction){
  const n=norm(desc);
  const cardPayment=/(לאומי\s*ויזה|לאומי.*ויזה|ישראכרט|בנהפ.*ישראכרט|מקס|מקס.*פיננ|ויזה|כאל|cal)/i.test(n);
  const saving=/(פיקדון|חיסכון|חסכון|משיכת חיסכון|פירעון פיקדון|הקמת פיקדון)/i.test(n);
  const internal=/(העברה.*בין|העברה עצמית|חשבון שלי|חשבון.*שלי|פייבוקס שלי|לאומי.*שלי)/i.test(n);
  if(direction==='out' && cardPayment) return {kind:'card_payment',flow_type:'card_payment',category:'חיוב כרטיס אשראי',payment_method:'עו״ש'};
  if(saving) return {kind:'saving',flow_type:'saving',category:'חיסכון/פיקדון',payment_method:'עו״ש'};
  if(internal) return {kind:'transfer',flow_type:'transfer',category:'העברה',payment_method:'עו״ש'};
  if(direction==='in') return {kind:'income',flow_type:'income',category:'הכנסה',payment_method:'עו״ש'};
  return {kind:'expense',flow_type:'expense',category:'אחר',payment_method:'עו״ש'};
}
function importCreditRows(rows,fileName){
  // Generic credit-card fallback: locate a header containing date + merchant/description + amount.
  for(let i=0;i<Math.min(rows.length,80);i++){
    const headers=rows[i].map(norm);
    const dateI=idx(headers,['תאריך','תאריך עסקה','date']);
    const descI=idx(headers,['בית עסק','שם בית העסק','בית העסק/תיאור','תיאור','עסק','merchant']);
    const amountI=idx(headers,['סכום','חיוב','עסקה','amount']);
    if(dateI<0||descI<0||amountI<0) continue;
    const out=[];
    for(let r=i+1;r<rows.length;r++){
      const row=rows[r]; if(!row?.length) continue;
      const date=excelDate(row[dateI]); const merchant=clean(row[descI]); const amount=moneyNumber(row[amountI]);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!merchant||!amount) continue;
      const sourceKey=['card',date,norm(merchant),amount.toFixed(2)].join('|');
      out.push({date,month:date.slice(0,7),merchant,amount,category:'אחר',source:'אשראי',kind:'expense',flow_type:'expense',payment_method:'אשראי',card_last4:null,notes:null,original_amount:amount,income_amount:0,external_id:sourceKey});
    }
    if(out.length) return out;
  }
  return [];
}
export async function importXlsx(file){
  const buf=await file.arrayBuffer();
  let wb;
  try{wb=XLSX.read(buf,{type:'array',cellDates:true,raw:true});}catch(e){throw new Error('לא ניתן לקרוא את הקובץ: '+e.message)}
  const all=[];
  for(const sheet of wb.SheetNames){
    const ws=wb.Sheets[sheet]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});
    const h=findHeader(rows); if(!h) continue;
    const {index,headers}=h; const dateI=idx(headers,['תאריך']); const valueDateI=idx(headers,['תאריך ערך','תאריך הפך']); const descI=idx(headers,['תיאור','פעולה']); const refI=idx(headers,['אסמכתא']); const debitI=idx(headers,['בחובה','חובה']); const creditI=idx(headers,['בזכות','זכות']); const balanceI=idx(headers,['יתרה']); const noteI=idx(headers,['הערה']);
    for(let r=index+1;r<rows.length;r++){
      const row=rows[r]; if(!row||!row.length)continue;
      const date=excelDate(row[dateI]); if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
      const debit=moneyNumber(row[debitI]), credit=moneyNumber(row[creditI]); if(debit===0&&credit===0)continue;
      const direction=debit>0?'out':'in', amount=direction==='out'?debit:credit; const merchant=clean(row[descI])||'תנועת בנק';
      const meta=classifyBank(merchant,amount,direction); const ref=clean(row[refI]);
      const sourceKey=['bank',date,excelDate(row[valueDateI]),norm(merchant),ref,debit.toFixed(2),credit.toFixed(2)].join('|');
      all.push({date,month:date.slice(0,7),merchant,amount,category:meta.category,source:'עו״ש',kind:meta.kind,flow_type:meta.flow_type,payment_method:'עו״ש',card_last4:null,notes:clean(row[noteI])||null,bank_description:merchant,bank_direction:direction,bank_debit:debit,bank_credit:credit,bank_value_date:excelDate(row[valueDateI])||null,bank_balance:moneyNumber(row[balanceI]),original_amount:amount,income_amount:meta.kind==='income'?amount:0,external_id:sourceKey});
    }
  }
  if(all.length) return all;
  // Not a bank export: try a generic credit-card table.
  const creditRows=[];
  for(const sheet of wb.SheetNames){const ws=wb.Sheets[sheet];creditRows.push(...XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true}));}
  const credit=importCreditRows(creditRows,file.name);
  if(credit.length) return credit;
  throw new Error('לא נמצאה טבלת בנק או אשראי. לקובץ בנק נדרשות עמודות תאריך, תיאור, בחובה/בזכות.');
}
