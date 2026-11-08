// Reads an uploaded file (Leumi HTML .xls, .xlsx, .csv) and hands the rows to lib/importParse.js.
import * as XLSX from 'xlsx';
import { bankRowsFromHtml, parseBankRows, parseCardRows } from './lib/importParse.js';

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
  try{wb=XLSX.read(buf,{type:'array',cellDates:false,raw:true});}
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
    card.push(...parseCardRows(rows,sheet));
  }
  if(card.length)return card;
  throw new Error('לא נמצאה טבלת בנק או אשראי מוכרת בקובץ.');
}
