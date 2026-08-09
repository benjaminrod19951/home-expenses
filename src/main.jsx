import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {supabase,supabaseConfigError} from "./supabase";
import {importXlsx,importBankPdf} from "./importers";
import {Plus,Upload,LogOut,RefreshCw,Wallet,ShoppingCart,ArrowDownUp,Pencil,Eye,BarChart3,CreditCard,X,ChevronDown} from "lucide-react";
import "./style.css";

const DEFAULT_CATS=["סופר","מסעדות ומשלוחים","דיור","חשבונות","רכב ותחבורה","קניות","גינון","בעלי חיים","בריאות","בילויים","מנויים","ביגוד","מתנות","חופשות","תחזוקה ותיקונים","אחר"];
const money=n=>new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",maximumFractionDigits:0}).format(n||0);
const isExpense=x=>![("הכנסה"),("העברה"),("חיוב כרטיס אשראי")].includes(x.category);
const today=()=>new Date().toISOString().slice(0,10);
const monthLabel=m=>{if(!m)return ""; const [y,mo]=m.split("-"); return new Intl.DateTimeFormat("he-IL",{month:"long",year:"numeric"}).format(new Date(Number(y),Number(mo)-1,1));};
const pct=(a,b)=>b?`${((a/b-1)*100).toFixed(0)}%`:"—";

function Auth(){
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[signup,setSignup]=useState(false),[msg,setMsg]=useState("");
  async function submit(){
    if(supabaseConfigError){setMsg(supabaseConfigError);return;}
    const r=signup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
    if(r.error)setMsg(r.error.message); else if(signup)setMsg("נשלח אליך אימייל לאישור החשבון.");
  }
  return <main className="auth"><div className="authbox"><h1>🏠 הוצאות הבית</h1><p>ניהול משותף של ההוצאות שלכם</p><input dir="ltr" placeholder="אימייל" value={email} onChange={e=>setEmail(e.target.value)}/><input dir="ltr" type="password" placeholder="סיסמה" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={submit}>{signup?"הרשמה":"כניסה"}</button><button className="link" onClick={()=>setSignup(!signup)}>{signup?"כבר יש חשבון? כניסה":"אין לך חשבון? הרשמה"}</button>{msg&&<div className="notice">{msg}</div>}</div></main>;
}

function ExpenseModal({cats,initial,onClose,onSave,onAddCategory}){
  const [f,setF]=useState(initial||{date:today(),amount:"",category:"סופר",merchant:"",payment_method:"מזומן",card_last4:"",notes:""});
  const set=(k,v)=>setF({...f,[k]:v});
  return <div className="overlay"><div className="modal"><div className="modalhead"><h2>{initial?"✏️ עריכת הוצאה":"➕ הוצאה ידנית"}</h2><button className="x" onClick={onClose}><X/></button></div>
    <label>סכום<input autoFocus type="number" inputMode="decimal" value={f.amount} onChange={e=>set("amount",e.target.value)}/></label>
    <label>קטגוריה<div className="inline"><select value={f.category} onChange={e=>set("category",e.target.value)}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select><button type="button" onClick={onAddCategory}>+ חדשה</button></div></label>
    <label>בית עסק / תיאור<input value={f.merchant||""} onChange={e=>set("merchant",e.target.value)}/></label>
    <label>אמצעי תשלום<select value={f.payment_method||"אשראי"} onChange={e=>set("payment_method",e.target.value)}><option>מזומן</option><option>אשראי</option><option>עו״ש</option><option>העברה</option></select></label>
    <label>4 ספרות אחרונות של הכרטיס<input inputMode="numeric" maxLength="4" placeholder="למשל 1234" value={f.card_last4||""} onChange={e=>set("card_last4",e.target.value.replace(/\D/g,"").slice(-4))}/></label>
    <label>תאריך<input type="date" value={f.date||today()} onChange={e=>set("date",e.target.value)}/></label>
    <label>הערה<input value={f.notes||""} onChange={e=>set("notes",e.target.value)}/></label>
    <button className="save" onClick={()=>onSave(f)}>שמירה</button>
  </div></div>;
}

function TransactionDetails({title,rows,onClose,onEdit}){
  return <div className="overlay"><div className="modal wide"><div className="modalhead"><div><h2>{title}</h2><p className="muted">{rows.length} הוצאות · {money(rows.reduce((s,x)=>s+Number(x.amount),0))}</p></div><button className="x" onClick={onClose}><X/></button></div>
    <div className="tablewrap compact"><table><thead><tr><th>תאריך</th><th>בית עסק</th><th>סכום</th><th>אמצעי</th><th>כרטיס</th><th>קטגוריה</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id||x.external_id}><td>{x.date}</td><td>{x.merchant}</td><td>{money(x.amount)}</td><td>{x.payment_method||"—"}</td><td>{x.card_last4?`•••• ${x.card_last4}`:"—"}</td><td>{x.category}</td><td><button className="iconbtn" onClick={()=>onEdit(x)} title="עריכה"><Pencil/></button></td></tr>)}</tbody></table></div>
  </div></div>;
}

function App({session}){
  const [home,setHome]=useState(null),[tx,setTx]=useState([]),[cats,setCats]=useState(DEFAULT_CATS),[loading,setLoading]=useState(true),[msg,setMsg]=useState(""),[modal,setModal]=useState(null),[selectedMonth,setSelectedMonth]=useState(""),[view,setView]=useState("month"),[detail,setDetail]=useState(null),[categoryFilter,setCategoryFilter]=useState(null);
  async function load(){
    setLoading(true);
    const {data:members,error:me}=await supabase.from("household_members").select("household_id").eq("user_id",session.user.id);
    if(me){setMsg(me.message);setLoading(false);return;}
    if(!members?.length){setHome(null);setLoading(false);return;}
    const hid=members[0].household_id;
    const [{data:h,error:he},{data:t,error:te},{data:c}]=await Promise.all([
      supabase.from("households").select("*").eq("id",hid).single(),
      supabase.from("transactions").select("*").eq("household_id",hid).order("date",{ascending:false}),
      supabase.from("categories").select("name").eq("household_id",hid)
    ]);
    if(he||te){setMsg((he||te)?.message||"שגיאה בטעינת הנתונים");setLoading(false);return;}
    setHome(h);setTx(t||[]);setCats([...new Set([...DEFAULT_CATS,...(c||[]).map(x=>x.name)])]);setLoading(false);
  }
  useEffect(()=>{load()},[]);
  async function createHome(){const code=Math.random().toString(36).slice(2,8).toUpperCase();const {error}=await supabase.rpc("create_household",{house_name:"הבית שלנו",code});if(error)setMsg(error.message);else{setMsg(`הבית נוצר. קוד הבית שלכם: ${code}`);load();}}
  async function joinHome(){const code=prompt("הכנס את קוד הבית שקיבלת:");if(!code)return;const {error}=await supabase.rpc("join_household_by_code",{code});if(error)setMsg(error.message);else load();}
  async function addCategory(){const name=prompt("שם הקטגוריה החדשה:");if(!name?.trim())return;const clean=name.trim();const {error}=await supabase.from("categories").insert({household_id:home.id,name:clean});if(error)setMsg(error.message);else setCats(c=>[...new Set([...c,clean])]);}
  async function saveManual(f){
    const amount=Math.abs(Number(f.amount));if(!amount)return setMsg("צריך להזין סכום");const d=f.date||today();
    const row={household_id:home.id,user_id:session.user.id,external_id:`manual-${crypto.randomUUID()}`,date:d,month:d.slice(0,7),merchant:f.merchant?.trim()||f.category,amount,category:f.category,source:"ידני",kind:"manual",payment_method:f.payment_method,card_last4:f.card_last4||null,notes:f.notes?.trim()||null};
    const {error}=await supabase.from("transactions").insert(row);if(error)setMsg(error.message);else{setModal(null);setMsg("ההוצאה נוספה");load();}
  }
  async function updateTransaction(f){
    const amount=Math.abs(Number(f.amount));if(!amount)return setMsg("צריך להזין סכום");const d=f.date||today();
    const row={date:d,month:d.slice(0,7),merchant:f.merchant?.trim()||f.category,amount,category:f.category,payment_method:f.payment_method||"אשראי",card_last4:f.card_last4||null,notes:f.notes?.trim()||null};
    const {error}=await supabase.from("transactions").update(row).eq("id",f.id);if(error)setMsg(error.message);else{setModal(null);setDetail(null);setMsg("ההוצאה עודכנה");load();}
  }
  async function importFiles(e){try{setMsg("מייבא קבצים…");let rows=[];for(const f of [...e.target.files]){const imported=f.name.toLowerCase().endsWith(".pdf")?await importBankPdf(f):await importXlsx(f);rows.push(...imported);}rows=rows.map(x=>({...x,household_id:home.id,user_id:session.user.id}));if(rows.length){const {error}=await supabase.from("transactions").upsert(rows,{onConflict:"household_id,external_id"});if(error)throw error;}setMsg(`הייבוא הסתיים: ${rows.length} תנועות`);load();}catch(err){setMsg("שגיאה בייבוא: "+err.message)}finally{e.target.value=""}}
  if(loading)return <div className="loading">טוען…</div>;
  if(!home)return <main className="auth"><div className="authbox"><h1>🏠 הוצאות הבית</h1><p>צריך לבחור בית משותף.</p><button onClick={createHome}>צור בית חדש</button><button onClick={joinHome}>הצטרף לבית קיים</button>{msg&&<div className="notice">{msg}</div>}<button className="link" onClick={()=>supabase.auth.signOut()}>יציאה</button></div></main>;

  const months=[...new Set(tx.map(x=>x.month).filter(Boolean))].sort().reverse();
  const active=selectedMonth||months[0]||today().slice(0,7);
  const current=tx.filter(x=>x.month===active);const expenses=current.filter(isExpense);const previousMonth=months[months.indexOf(active)+1];const previous=tx.filter(x=>x.month===previousMonth&&isExpense(x));
  const total=expenses.reduce((s,x)=>s+Number(x.amount),0),prevTotal=previous.reduce((s,x)=>s+Number(x.amount),0);
  const cash=expenses.filter(x=>x.payment_method==="מזומן").reduce((s,x)=>s+Number(x.amount),0),card=expenses.filter(x=>x.payment_method==="אשראי").reduce((s,x)=>s+Number(x.amount),0),bank=expenses.filter(x=>x.payment_method==="עו״ש").reduce((s,x)=>s+Number(x.amount),0);
  const categoryTotals=cats.map(c=>({name:c,value:expenses.filter(x=>x.category===c).reduce((s,x)=>s+Number(x.amount),0)})).filter(x=>x.value).sort((a,b)=>b.value-a.value);
  const supermarket=categoryTotals.find(x=>x.name==="סופר")?.value||0,prevSuper=previous.filter(x=>x.category==="סופר").reduce((s,x)=>s+Number(x.amount),0);
  const filteredExpenses=categoryFilter?expenses.filter(x=>x.category===categoryFilter):expenses;
  const comparisonCats=[...new Set([...cats,...tx.map(x=>x.category)])].filter(Boolean).map(name=>({name,values:months.map(m=>tx.filter(x=>x.month===m&&isExpense(x)&&x.category===name).reduce((s,x)=>s+Number(x.amount),0))})).filter(r=>r.values.some(v=>v));
  const openCategory=name=>setDetail({title:`${name} · ${monthLabel(active)}`,rows:expenses.filter(x=>x.category===name)});
  return <div className="app">
    <header><div><h1>🏠 הוצאות הבית</h1><p>{home.name} · קוד משותף: <b>{home.join_code}</b></p></div><div className="actions"><button onClick={()=>setModal({mode:"new"})}><Plus/> הוצאה</button><label className="upload"><Upload/> ייבוא<input type="file" multiple accept=".xlsx,.xls,.csv,.pdf" onChange={importFiles}/></label><button aria-label="רענון" onClick={load}><RefreshCw/></button><button aria-label="יציאה" onClick={()=>supabase.auth.signOut()}><LogOut/></button></div></header>
    <nav className="topnav"><div className="tabs"><button className={view==="month"?"tab active":"tab"} onClick={()=>setView("month")}>חודש</button><button className={view==="compare"?"tab active":"tab"} onClick={()=>setView("compare")}><BarChart3/> השוואת חודשים</button></div>{view==="month"&&<select value={active} onChange={e=>setSelectedMonth(e.target.value)}>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select>}<span className="navmsg">{msg}</span></nav>
    {view==="compare"?<section className="compare panel"><div className="sectionhead"><div><h2>השוואה בין חודשים</h2><p>לחיצה על סכום פותחת את כל ההוצאות של אותה קטגוריה באותו חודש.</p></div></div><div className="tablewrap comparison"><table><thead><tr><th>קטגוריה</th>{months.map(m=><th key={m}>{monthLabel(m)}</th>)}</tr></thead><tbody>{comparisonCats.map(r=><tr key={r.name}><th><button className="categorylink" onClick={()=>setDetail({title:r.name,rows:tx.filter(x=>x.category===r.name&&isExpense(x))})}>{r.name}</button></th>{r.values.map((v,i)=><td key={months[i]}>{v?<button className="amountlink" onClick={()=>setDetail({title:`${r.name} · ${monthLabel(months[i])}`,rows:tx.filter(x=>x.month===months[i]&&x.category===r.name&&isExpense(x))})}>{money(v)}</button>:"—"}</td>)}</tr>)}<tr className="grand"><th>סה״כ</th>{months.map(m=><td key={m}>{money(tx.filter(x=>x.month===m&&isExpense(x)).reduce((s,x)=>s+Number(x.amount),0))}</td>)}</tr></tbody></table></div></section>:<>
      <section className="cards"><div className="card"><Wallet/><span>הוצאות אמיתיות</span><strong>{money(total)}</strong><small>{prevTotal?pct(total,prevTotal)+" לעומת החודש הקודם":"אין חודש קודם"}</small></div><div className="card"><ShoppingCart/><span>סופר</span><strong>{money(supermarket)}</strong><small>{prevSuper?pct(supermarket,prevSuper)+" לעומת החודש הקודם":""}</small></div><div className="card"><Wallet/><span>מזומן</span><strong>{money(cash)}</strong><small>אשראי {money(card)} · עו״ש {money(bank)}</small></div><div className="card"><ArrowDownUp/><span>מספר הוצאות</span><strong>{expenses.length}</strong><small>כל התנועות מוצגות בטבלה למטה</small></div></section>
      <section className="grid"><div className="panel"><div className="sectionhead"><h2>לפי קטגוריה</h2><span className="muted">לחץ על קטגוריה לפירוט</span></div>{categoryTotals.map(x=><button className="row categoryrow" key={x.name} onClick={()=>openCategory(x.name)}><span>{x.name}</span><b>{money(x.value)}</b><Eye/></button>)}</div><div className="panel"><div className="sectionhead"><h2>הוצאות {monthLabel(active)}</h2><span className="muted">{expenses.length} תנועות</span></div><div className="filters"><button className={!categoryFilter?"chip active":"chip"} onClick={()=>setCategoryFilter(null)}>הכול</button>{categoryTotals.map(x=><button key={x.name} className={categoryFilter===x.name?"chip active":"chip"} onClick={()=>setCategoryFilter(x.name)}>{x.name}</button>)}</div></div></section>
      <section className="panel fulltable"><div className="sectionhead"><div><h2>כל ההוצאות</h2><p>אין חיתוך ל־20 שורות — אפשר לגלול ולראות את כל החודש.</p></div><span className="muted">{filteredExpenses.length} תנועות · {money(filteredExpenses.reduce((s,x)=>s+Number(x.amount),0))}</span></div><div className="tablewrap"><table><thead><tr><th>תאריך</th><th>בית עסק / תיאור</th><th>קטגוריה</th><th>סכום</th><th>אמצעי תשלום</th><th>כרטיס</th><th>מקור</th><th></th></tr></thead><tbody>{filteredExpenses.map(x=><tr key={x.id||x.external_id}><td>{x.date}</td><td>{x.merchant}</td><td><button className="categorylink" onClick={()=>openCategory(x.category)}>{x.category}</button></td><td><b>{money(x.amount)}</b></td><td>{x.payment_method||"—"}</td><td>{x.card_last4?<span className="cardbadge"><CreditCard/> •••• {x.card_last4}</span>:"—"}</td><td>{x.source||"—"}</td><td><button className="iconbtn" title="עריכה" onClick={()=>setModal({mode:"edit",transaction:x})}><Pencil/></button></td></tr>)}</tbody></table>{!filteredExpenses.length&&<div className="empty">אין הוצאות להצגה בחודש הזה.</div>}</div></section>
    </>}
    {modal&&<ExpenseModal cats={cats} initial={modal.mode==="edit"?modal.transaction:null} onClose={()=>setModal(null)} onSave={modal.mode==="edit"?updateTransaction:saveManual} onAddCategory={addCategory}/>} 
    {detail&&<TransactionDetails title={detail.title} rows={detail.rows} onClose={()=>setDetail(null)} onEdit={x=>{setDetail(null);setModal({mode:"edit",transaction:x})}}/>}
  </div>;
}

function Root(){const [session,setSession]=useState(undefined);if(supabaseConfigError)return <main className="auth"><div className="authbox"><h1>🏠 הוצאות הבית</h1><p>יש בעיה בהגדרות החיבור ל-Supabase.</p><div className="notice">{supabaseConfigError}</div><p>אחרי תיקון המשתנים ב-Vercel צריך לבצע Redeploy.</p></div></main>;useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);if(session===undefined)return <div className="loading">טוען…</div>;return session?<App session={session}/>:<Auth/>}
createRoot(document.getElementById("root")).render(<Root/>);
