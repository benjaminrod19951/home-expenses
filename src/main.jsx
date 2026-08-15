import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {supabase,supabaseConfigError} from './supabase';
import {importXlsx} from './importers';
import {Plus,Upload,LogOut,RefreshCw,Wallet,ShoppingCart,ArrowDownUp,Pencil,X,Eye,AlertTriangle} from 'lucide-react';
import './style.css';

const DEFAULT_CATS=['סופר','מסעדות ומשלוחים','דיור','חשבונות','רכב ותחבורה','קניות','גינון','בעלי חיים','בריאות','בילויים','מנויים','ביגוד','מתנות','חופשות','תחזוקה ותיקונים','אחר'];
const money=n=>new Intl.NumberFormat('he-IL',{style:'currency',currency:'ILS',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n)||0);
const num=n=>Number(n)||0;
const today=()=>new Date().toISOString().slice(0,10);
const normalize=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
const isIncome=x=>x.count_as_income===true||(x.count_as_income==null&&(x.flow_type==='income'||x.kind==='income'));
const isExpense=x=>x.count_as_expense===true||(x.count_as_expense==null&&(x.flow_type==='expense'||x.kind==='expense'));
const isReview=x=>x.flow_type==='income_review'||x.kind==='income_review';
const isExcluded=x=>!isExpense(x)&&!isIncome(x);
const sourceLabel=x=>x.source==='אשראי'?'אשראי':x.source==='מזומן'?'מזומן':x.source==='עו״ש'?'בנק':(x.source||'—');
const monthLabel=m=>{if(!m)return '';const[y,mo]=m.split('-');return new Intl.DateTimeFormat('he-IL',{month:'long',year:'numeric'}).format(new Date(+y,+mo-1,1));};

function Auth(){
  const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[msg,setMsg]=useState('');
  async function submit(){const r=signup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});if(r.error)setMsg(r.error.message);else if(signup)setMsg('נשלח אימייל לאישור החשבון.');}
  return <main className="auth"><div className="authbox"><h1>🏠 הוצאות הבית</h1><p>ניהול משותף של ההוצאות שלכם</p><input dir="ltr" placeholder="אימייל" value={email} onChange={e=>setEmail(e.target.value)}/><input dir="ltr" type="password" placeholder="סיסמה" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={submit}>{signup?'הרשמה':'כניסה'}</button><button className="link" onClick={()=>setSignup(!signup)}>{signup?'כבר יש חשבון? כניסה':'אין לך חשבון? הרשמה'}</button>{msg&&<div className="notice">{msg}</div>}</div></main>;
}

function EditModal({tx,onClose,onSave}){
  const[f,setF]=useState({...tx});
  return <div className="overlay"><div className="modal"><div className="modalhead"><h2>✏️ עריכת תנועה</h2><button className="x" onClick={onClose}><X/></button></div>
    <label>תיאור<input value={f.merchant||''} onChange={e=>setF({...f,merchant:e.target.value})}/></label>
    <label>סכום<input type="number" step="0.01" value={f.amount??''} onChange={e=>setF({...f,amount:e.target.value})}/></label>
    <label>סוג תנועה<select value={f.flow_type||'expense'} onChange={e=>setF({...f,flow_type:e.target.value,kind:e.target.value})}>
      <option value="expense">הוצאה</option><option value="income">הכנסה</option><option value="income_review">הכנסה לבדיקה</option><option value="transfer">העברה</option><option value="card_payment">חיוב כרטיס</option><option value="saving">חיסכון/פיקדון</option>
    </select></label>
    <label>קטגוריה<input value={f.category||''} onChange={e=>setF({...f,category:e.target.value})}/></label>
    {f.flow_type==='income'&&<label>מתוך הסכום, כמה הכנסה אמיתית?<input type="number" min="0" step="0.01" value={f.income_amount??Math.abs(num(f.amount))} onChange={e=>setF({...f,income_amount:e.target.value})}/></label>}
    <label>תאריך<input type="date" value={f.date||today()} onChange={e=>setF({...f,date:e.target.value})}/></label>
    <button className="save" onClick={()=>onSave(f)}>שמירה</button>
  </div></div>;
}

function CashModal({categories,onClose,onSave}){
  const[f,setF]=useState({date:today(),merchant:'',amount:'',category:'אחר',flow_type:'expense'});
  return <div className="overlay"><div className="modal"><div className="modalhead"><h2>➕ הוספת תנועת מזומן</h2><button className="x" onClick={onClose}><X/></button></div>
    <label>תאריך<input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label>
    <label>תיאור<input autoFocus value={f.merchant} onChange={e=>setF({...f,merchant:e.target.value})} placeholder="לדוגמה: ירקות"/></label>
    <label>סכום<input type="number" min="0" step="0.01" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label>
    <label>סוג תנועה<select value={f.flow_type} onChange={e=>setF({...f,flow_type:e.target.value})}><option value="expense">הוצאה</option><option value="income">הכנסה</option></select></label>
    <label>קטגוריה<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <button className="save" onClick={()=>onSave(f)}>הוספה</button>
  </div></div>;
}

function Details({title,rows,onClose,onEdit}){
  return <div className="overlay"><div className="modal wide"><div className="modalhead"><div><h2>{title}</h2><p>{rows.length} תנועות · {money(rows.reduce((s,x)=>s+num(x.amount),0))}</p></div><button className="x" onClick={onClose}><X/></button></div><div className="tablewrap"><table><thead><tr><th>תאריך</th><th>תיאור</th><th>סכום</th><th>סוג</th><th>קטגוריה</th><th>מקור</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.date}</td><td>{x.merchant}</td><td>{money(x.amount)}</td><td>{x.flow_type}</td><td>{x.category}</td><td>{sourceLabel(x)}</td><td><button className="iconbtn" onClick={()=>onEdit(x)}><Pencil/></button></td></tr>)}</tbody></table></div></div></div>;
}

function semanticMatch(a,b){
  if(a.source!==b.source||a.date!==b.date||normalize(a.merchant)!==normalize(b.merchant))return false;
  if(a.source==='אשראי'){
    if(Math.abs(num(a.amount))-Math.abs(num(b.amount))>0.005)return false;
    if(a.card_last4&&b.card_last4&&a.card_last4!==b.card_last4)return false;
    if(a.charge_date&&b.charge_date&&a.charge_date!==b.charge_date)return false;
    return true;
  }
  if(a.source==='עו״ש'){
    const ad=num(a.bank_debit),bd=num(b.bank_debit),ac=num(a.bank_credit),bc=num(b.bank_credit);
    if((ad||bd||ac||bc) && (Math.abs(ad-bd)>0.005||Math.abs(ac-bc)>0.005))return false;
    const av=a.bank_value_date||a.value_date||a.date,bv=b.bank_value_date||b.value_date||b.date;
    if(av&&bv&&av!==bv)return false;
    if(a.reference&&b.reference&&String(a.reference)!==String(b.reference))return false;
    return Math.abs(num(a.amount)-num(b.amount))<0.005;
  }
  return false;
}

function App({session}){
  const[home,setHome]=useState(null),[tx,setTx]=useState([]),[cats,setCats]=useState(DEFAULT_CATS),[rules,setRules]=useState([]),[loading,setLoading]=useState(true),[msg,setMsg]=useState(''),[view,setView]=useState('ledger'),[month,setMonth]=useState(''),[detail,setDetail]=useState(null),[edit,setEdit]=useState(null),[cash,setCash]=useState(false),[search,setSearch]=useState('');

  async function load(){
    setLoading(true);
    const{data:m,error:me}=await supabase.from('household_members').select('household_id').eq('user_id',session.user.id);
    if(me){setMsg(me.message);setLoading(false);return}if(!m?.length){setHome(null);setLoading(false);return}
    const hid=m[0].household_id;
    const[{data:h,error:he},{data:t,error:te},{data:c},{data:r}]=await Promise.all([
      supabase.from('households').select('*').eq('id',hid).single(),
      supabase.from('transactions').select('*').eq('household_id',hid).order('date',{ascending:false}),
      supabase.from('categories').select('name').eq('household_id',hid),
      supabase.from('merchant_category_rules').select('*').eq('household_id',hid)
    ]);
    if(he||te){setMsg((he||te)?.message);setLoading(false);return}
    setHome(h);setTx(t||[]);setCats([...new Set([...DEFAULT_CATS,...(c||[]).map(x=>x.name),...(t||[]).map(x=>x.category).filter(Boolean)])]);setRules(r||[]);setLoading(false);
  }
  useEffect(()=>{load()},[]);

  async function createHome(){const code=Math.random().toString(36).slice(2,8).toUpperCase();const{error}=await supabase.rpc('create_household',{house_name:'הבית שלנו',code});if(error)setMsg(error.message);else load()}
  async function joinHome(){const code=prompt('הכנס את קוד הבית:');if(code){const{error}=await supabase.rpc('join_household_by_code',{code});if(error)setMsg(error.message);else load()}}

  async function importFiles(e){
    try{
      setMsg('קורא את הקבצים ומזהה בנק / אשראי…');
      let rows=[];for(const f of [...e.target.files])rows.push(...await importXlsx(f));
      const usedExisting=new Set();
      rows=rows.map(x=>{
        const rule=rules.find(r=>r.merchant_key===normalize(x.merchant));
        const existing=tx.find(t=>!usedExisting.has(t.id)&&semanticMatch(t,x));
        if(existing)usedExisting.add(existing.id);
        const manual=existing?.manual_override===true;
        return {...x,
          household_id:home.id,user_id:session.user.id,
          external_id:existing?.external_id||x.external_id,
          category:rule?.category||(manual?existing.category:x.category),
          flow_type:manual?existing.flow_type:x.flow_type,
          kind:manual?existing.kind:x.kind,
          count_as_expense:manual?existing.count_as_expense:x.count_as_expense,
          count_as_income:manual?existing.count_as_income:x.count_as_income,
          income_amount:manual?existing.income_amount:x.income_amount,
          manual_override:manual
        };
      });
      const unique=new Map();for(const r of rows)unique.set(r.external_id,r);rows=[...unique.values()];
      const{error}=await supabase.from('transactions').upsert(rows,{onConflict:'household_id,external_id'});if(error)throw error;
      setMsg(`ייבוא הסתיים: ${rows.length} תנועות. חיוב הכרטיס בבנק אינו נספר שוב; זיכויי אשראי מפחיתים הוצאות.`);load();
    }catch(e2){setMsg('שגיאה בייבוא: '+e2.message)}finally{e.target.value=''}
  }

  async function saveEdit(f){
    const flow=f.flow_type||'expense';
    let amount=num(f.amount);if(flow!=='expense')amount=Math.abs(amount);
    const incomeAmount=flow==='income'?Math.max(0,Math.min(Math.abs(amount),num(f.income_amount??Math.abs(amount)))):0;
    const row={merchant:f.merchant,amount,category:f.category,flow_type:flow,kind:flow,count_as_expense:flow==='expense',count_as_income:flow==='income',income_amount:incomeAmount,date:f.date,month:f.date?.slice(0,7),manual_override:true};
    const{error}=await supabase.from('transactions').update(row).eq('id',f.id);if(error)setMsg(error.message);else{setEdit(null);setMsg('התנועה עודכנה ונשמרה כעריכה ידנית');load()}
  }

  async function saveCash(f){
    const amount=Math.abs(num(f.amount));if(!f.merchant||!amount){setMsg('יש להזין תיאור וסכום');return}
    const d=f.date||today(),flow=f.flow_type||'expense';
    const row={household_id:home.id,user_id:session.user.id,date:d,month:d.slice(0,7),merchant:f.merchant,amount,category:f.category||'אחר',source:'מזומן',kind:flow,flow_type:flow,count_as_expense:flow==='expense',count_as_income:flow==='income',payment_method:'מזומן',original_amount:amount,income_amount:flow==='income'?amount:0,manual_override:true,external_id:`cash|${crypto.randomUUID()}`};
    const{error}=await supabase.from('transactions').insert(row);if(error)setMsg(error.message);else{setCash(false);setMsg('תנועת המזומן נוספה לטבלה הראשית');load()}
  }

  if(loading)return <div className="loading">טוען…</div>;
  if(!home)return <main className="auth"><div className="authbox"><h1>🏠 הוצאות הבית</h1><button onClick={createHome}>צור בית חדש</button><button onClick={joinHome}>הצטרף לבית קיים</button>{msg&&<div className="notice">{msg}</div>}<button className="link" onClick={()=>supabase.auth.signOut()}>יציאה</button></div></main>;

  const months=[...new Set(tx.map(x=>x.month).filter(Boolean))].sort().reverse();
  const active=month||months[0]||today().slice(0,7),current=tx.filter(x=>x.month===active);
  const expenses=current.filter(isExpense),incomes=current.filter(isIncome),review=current.filter(isReview);
  const total=expenses.reduce((s,x)=>s+num(x.amount),0),income=incomes.reduce((s,x)=>s+(x.income_amount!=null?num(x.income_amount):Math.abs(num(x.amount))),0);
  const excluded=current.filter(isExcluded),catsPresent=[...new Set([...cats,...current.map(x=>x.category).filter(Boolean)])];
  const totals=catsPresent.map(c=>({name:c,value:expenses.filter(x=>x.category===c).reduce((s,x)=>s+num(x.amount),0)})).filter(x=>x.value!==0).sort((a,b)=>b.value-a.value);
  const filtered=current.filter(x=>!search||normalize(`${x.merchant} ${x.category} ${sourceLabel(x)} ${x.flow_type}`).includes(normalize(search)));

  return <div className="app"><header><div><h1>🏠 הוצאות הבית</h1><p>{home.name}</p></div><div className="actions"><button onClick={()=>setCash(true)}><Plus/> מזומן</button><label className="upload"><Upload/> ייבוא בנק/אשראי<input type="file" accept=".xls,.xlsx" multiple onChange={importFiles}/></label><button onClick={load}><RefreshCw/></button><button onClick={()=>supabase.auth.signOut()}><LogOut/></button></div></header>
    <nav><button onClick={()=>setView('ledger')} className={view==='ledger'?'active':''}>טבלה ראשית</button><button onClick={()=>setView('bank')} className={view==='bank'?'active':''}>בנק</button><button onClick={()=>setView('categories')} className={view==='categories'?'active':''}>קטגוריות</button><select value={active} onChange={e=>setMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select><span>{msg}</span></nav>

    {view==='ledger'?<><section className="cards"><div className="card"><Wallet/><span>הוצאות אמיתיות</span><strong>{money(total)}</strong><small>{expenses.length} תנועות, כולל זיכויים</small></div><div className="card"><Wallet/><span>הכנסות מאושרות</span><strong>{money(income)}</strong><small>{incomes.length} תנועות</small></div><div className="card"><ArrowDownUp/><span>לא נספר</span><strong>{money(excluded.reduce((s,x)=>s+Math.abs(num(x.amount)),0))}</strong><small>העברות / חיובי אשראי / חיסכון</small></div><div className="card"><ShoppingCart/><span>מספר הוצאות</span><strong>{expenses.length}</strong></div></section>
      {review.length>0&&<section className="panel"><div className="modalhead"><div><h2><AlertTriangle/> הכנסות לבדיקה</h2><p>{review.length} תנועות זכות שלא זוהו בוודאות כהכנסה. הן אינן נכללות בסה״כ עד שתאשרי אותן בעריכה.</p></div><strong>{money(review.reduce((s,x)=>s+num(x.amount),0))}</strong></div></section>}
      <section className="panel"><div className="modalhead"><div><h2>📒 כל התנועות</h2><p>בנק + אשראי + מזומן. תשלום כרטיס מהבנק אינו נספר כהוצאה נוספת.</p></div><input className="search" placeholder="חיפוש תיאור / קטגוריה / מקור…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="tablewrap"><table><thead><tr><th>תאריך</th><th>תיאור</th><th>סכום</th><th>סוג</th><th>קטגוריה</th><th>מקור</th><th>אמצעי</th><th></th></tr></thead><tbody>{filtered.map(x=><tr key={x.id}><td>{x.date}</td><td>{x.merchant}</td><td>{money(x.amount)}</td><td>{isExpense(x)?(num(x.amount)<0?'זיכוי':'הוצאה'):isIncome(x)?'הכנסה':isReview(x)?'הכנסה לבדיקה':x.flow_type}</td><td>{x.category}</td><td>{sourceLabel(x)}</td><td>{x.payment_method}</td><td><button className="iconbtn" onClick={()=>setEdit(x)}><Pencil/></button></td></tr>)}</tbody></table></div></section></>
    :view==='bank'?<section className="panel"><h2>🏦 תנועות בנק</h2><p>חובה ≠ 0 = כסף יצא. רק כאשר חובה = 0 בודקים את בזכות. היתרה אינה סכום התנועה.</p><div className="tablewrap"><table><thead><tr><th>תאריך</th><th>תאריך ערך</th><th>תיאור</th><th>אסמכתא</th><th>חובה</th><th>זכות</th><th>יתרה</th><th>סוג</th><th></th></tr></thead><tbody>{current.filter(x=>x.source==='עו״ש').map(x=><tr key={x.id}><td>{x.date}</td><td>{x.bank_value_date||x.value_date||'—'}</td><td>{x.bank_description||x.merchant}</td><td>{x.reference||'—'}</td><td>{num(x.bank_debit)?money(x.bank_debit):'—'}</td><td>{num(x.bank_credit)?money(x.bank_credit):'—'}</td><td>{x.bank_balance!=null?money(x.bank_balance):x.balance!=null?money(x.balance):'—'}</td><td>{x.flow_type}</td><td><button className="iconbtn" onClick={()=>setEdit(x)}><Pencil/></button></td></tr>)}</tbody></table></div></section>
    :<section className="grid"><div className="panel"><h2>לפי קטגוריה · {monthLabel(active)}</h2><div className="categorylist">{totals.map(x=><button className="row" key={x.name} onClick={()=>setDetail({title:`${x.name} · ${monthLabel(active)}`,rows:expenses.filter(y=>y.category===x.name)})}><span>{x.name}</span><b>{money(x.value)}</b><Eye/></button>)}</div><div className="categorytotal"><b>סה״כ קטגוריות: {money(totals.reduce((s,x)=>s+x.value,0))}</b></div></div><div className="panel"><h2>כללי החישוב</h2><p>עסקאות אשראי משויכות לחודש החיוב, אבל מוצג תאריך העסקה המקורי.</p><p>חיוב חברת האשראי בחשבון הבנק מסומן כ־card_payment ולכן אינו נספר פעם נוספת.</p><p>זיכוי/ביטול בכרטיס נשמר בסכום שלילי ומפחית את ההוצאות.</p><p>תנועת זכות בנקאית שאינה משכורת/קצבה ברורה עוברת ל״הכנסה לבדיקה״ ולא מנפחת אוטומטית את ההכנסות.</p></div></section>}

    {edit&&<EditModal tx={edit} onClose={()=>setEdit(null)} onSave={saveEdit}/>} {cash&&<CashModal categories={cats} onClose={()=>setCash(false)} onSave={saveCash}/>} {detail&&<Details title={detail.title} rows={detail.rows} onClose={()=>setDetail(null)} onEdit={x=>{setDetail(null);setEdit(x)}}/>}
  </div>;
}

function Root(){
  const[session,setSession]=useState(undefined);
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
  if(supabaseConfigError)return <main className="auth"><div className="authbox"><h1>🏠 הוצאות הבית</h1><div className="notice">{supabaseConfigError}</div></div></main>;
  if(session===undefined)return <div className="loading">טוען…</div>;
  return session?<App session={session}/>:<Auth/>;
}
createRoot(document.getElementById('root')).render(<Root/>);
