import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {supabase} from "./supabase";
import {importXlsx,importBankPdf} from "./importers";
import {Plus,Upload,LogOut,RefreshCw,Wallet,ShoppingCart,ArrowDownUp} from "lucide-react";
import "./style.css";

const DEFAULT_CATS=["סופר","מסעדות ומשלוחים","דיור","חשבונות","רכב ותחבורה","קניות","גינון","בעלי חיים","בריאות","בילויים","מנויים","ביגוד","מתנות","חופשות","תחזוקה ותיקונים","אחר"];
const money=n=>new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",maximumFractionDigits:0}).format(n||0);
const isExpense=x=>!["הכנסה","העברה","חיוב כרטיס אשראי"].includes(x.category);
const today=()=>new Date().toISOString().slice(0,10);

function Auth(){
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[signup,setSignup]=useState(false),[msg,setMsg]=useState("");
  async function submit(){
    const r=signup
      ? await supabase.auth.signUp({email,password})
      : await supabase.auth.signInWithPassword({email,password});
    if(r.error)setMsg(r.error.message);
    else if(signup)setMsg("נשלח אליך אימייל לאישור החשבון.");
  }
  return <main className="auth"><div className="authbox">
    <h1>🏠 הוצאות הבית</h1>
    <p>ניהול משותף של ההוצאות שלכם</p>
    <input dir="ltr" placeholder="אימייל" value={email} onChange={e=>setEmail(e.target.value)}/>
    <input dir="ltr" type="password" placeholder="סיסמה" value={password} onChange={e=>setPassword(e.target.value)}/>
    <button onClick={submit}>{signup?"הרשמה":"כניסה"}</button>
    <button className="link" onClick={()=>setSignup(!signup)}>{signup?"כבר יש חשבון? כניסה":"אין לך חשבון? הרשמה"}</button>
    {msg&&<div className="notice">{msg}</div>}
  </div></main>;
}

function ExpenseModal({cats,onClose,onSave,onAddCategory}){
  const [f,setF]=useState({date:today(),amount:"",category:"סופר",merchant:"",payment_method:"מזומן",notes:""});
  const set=(k,v)=>setF({...f,[k]:v});
  return <div className="overlay"><div className="modal">
    <div className="modalhead"><h2>➕ הוצאה ידנית</h2><button className="x" onClick={onClose}>×</button></div>
    <label>סכום<input autoFocus type="number" inputMode="decimal" placeholder="150" value={f.amount} onChange={e=>set("amount",e.target.value)}/></label>
    <label>קטגוריה><div className="inline"><select value={f.category} onChange={e=>set("category",e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select><button onClick={onAddCategory}>+ חדשה</button></div></label>
    <label>בית עסק / תיאור<input placeholder="למשל: גנן" value={f.merchant} onChange={e=>set("merchant",e.target.value)}/></label>
    <label>אמצעי תשלום<select value={f.payment_method} onChange={e=>set("payment_method",e.target.value)}><option>מזומן</option><option>אשראי</option><option>עו״ש</option><option>העברה</option></select></label>
    <label>תאריך<input type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></label>
    <label>הערה<input placeholder="אופציונלי" value={f.notes} onChange={e=>set("notes",e.target.value)}/></label>
    <button className="save" onClick={()=>onSave(f)}>שמירה</button>
  </div></div>;
}

function App({session}){
  const [home,setHome]=useState(null),[tx,setTx]=useState([]),[cats,setCats]=useState(DEFAULT_CATS),[loading,setLoading]=useState(true),[msg,setMsg]=useState(""),[modal,setModal]=useState(false),[selectedMonth,setSelectedMonth]=useState("");
  async function load(){
    setLoading(true);
    const {data:members,error:me}=await supabase.from("household_members").select("household_id").eq("user_id",session.user.id);
    if(me){setMsg(me.message);setLoading(false);return}
    if(!members?.length){setHome(null);setLoading(false);return}
    const hid=members[0].household_id;
    const [{data:h},{data:t},{data:c}]=await Promise.all([
      supabase.from("households").select("*").eq("id",hid).single(),
      supabase.from("transactions").select("*").eq("household_id",hid).order("date",{ascending:false}),
      supabase.from("categories").select("name").eq("household_id",hid)
    ]);
    setHome(h);setTx(t||[]);
    const custom=(c||[]).map(x=>x.name);
    setCats([...new Set([...DEFAULT_CATS,...custom])]);
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  async function createHome(){
    const code=Math.random().toString(36).slice(2,8).toUpperCase();
    const {error}=await supabase.rpc("create_household",{house_name:"הבית שלנו",code});
    if(error)setMsg(error.message);else{setMsg(`הבית נוצר. קוד הבית שלכם: ${code}`);load()}
  }
  async function joinHome(){
    const code=prompt("הכנס את קוד הבית שקיבלת:");
    if(!code)return;
    const {error}=await supabase.rpc("join_household_by_code",{code});
    if(error)setMsg(error.message);else load();
  }
  async function addCategory(){
    const name=prompt("שם הקטגוריה החדשה:");
    if(!name?.trim())return;
    const {error}=await supabase.from("categories").insert({household_id:home.id,name:name.trim()});
    if(error)setMsg(error.message);else setCats(c=>[...new Set([...c,name.trim()])]);
  }
  async function saveManual(f){
    const amount=Math.abs(Number(f.amount));
    if(!amount)return setMsg("צריך להזין סכום");
    const d=f.date||today();
    const row={
      household_id:home.id,user_id:session.user.id,
      external_id:`manual-${crypto.randomUUID()}`,
      date:d,month:d.slice(0,7),
      merchant:f.merchant?.trim()||f.category,amount,
      category:f.category,source:"ידני",kind:"manual",
      payment_method:f.payment_method,notes:f.notes?.trim()||null
    };
    const {error}=await supabase.from("transactions").insert(row);
    if(error)setMsg(error.message);else{setModal(false);setMsg("ההוצאה נוספה");load()}
  }
  async function importFiles(e){
    try{
      setMsg("מייבא קבצים…");
      let rows=[];
      for(const f of [...e.target.files]){
        const imported=f.name.toLowerCase().endsWith(".pdf")?await importBankPdf(f):await importXlsx(f);
        rows.push(...imported);
      }
      rows=rows.map(x=>({...x,household_id:home.id,user_id:session.user.id}));
      if(rows.length){
        const {error}=await supabase.from("transactions").upsert(rows,{onConflict:"household_id,external_id"});
        if(error)throw error;
      }
      setMsg(`הייבוא הסתיים: ${rows.length} תנועות`);
      load();
    }catch(err){setMsg("שגיאה בייבוא: "+err.message)}
    finally{e.target.value=""}
  }

  if(loading)return <div className="loading">טוען…</div>;
  if(!home)return <main className="auth"><div className="authbox">
    <h1>🏠 הוצאות הבית</h1><p>צריך לבחור בית משותף.</p>
    <button onClick={createHome}>צור בית חדש</button>
    <button onClick={joinHome}>הצטרף לבית קיים</button>
    {msg&&<div className="notice">{msg}</div>}
    <button className="link" onClick={()=>supabase.auth.signOut()}>יציאה</button>
  </div></main>;

  const months=[...new Set(tx.map(x=>x.month))].sort().reverse();
  const active=selectedMonth||months[0]||today().slice(0,7);
  const current=tx.filter(x=>x.month===active);
  const expenses=current.filter(isExpense);
  const previousMonth=months[months.indexOf(active)+1];
  const previous=tx.filter(x=>x.month===previousMonth&&isExpense(x));
  const total=expenses.reduce((s,x)=>s+Number(x.amount),0);
  const prevTotal=previous.reduce((s,x)=>s+Number(x.amount),0);
  const cash=expenses.filter(x=>x.payment_method==="מזומן").reduce((s,x)=>s+Number(x.amount),0);
  const card=expenses.filter(x=>x.payment_method==="אשראי").reduce((s,x)=>s+Number(x.amount),0);
  const bank=expenses.filter(x=>x.payment_method==="עו״ש").reduce((s,x)=>s+Number(x.amount),0);
  const categoryTotals=cats.map(c=>({name:c,value:expenses.filter(x=>x.category===c).reduce((s,x)=>s+Number(x.amount),0)})).filter(x=>x.value).sort((a,b)=>b.value-a.value);
  const supermarket=categoryTotals.find(x=>x.name==="סופר")?.value||0;
  const prevSuper=previous.filter(x=>x.category==="סופר").reduce((s,x)=>s+Number(x.amount),0);
  const pct=(a,b)=>b?`${((a/b-1)*100).toFixed(0)}%`: "";
  return <div className="app">
    <header><div><h1>🏠 הוצאות הבית</h1><p>{home.name} · קוד משותף: <b>{home.join_code}</b></p></div>
      <div className="actions">
        <button onClick={()=>setModal(true)}><Plus/> הוצאה</button>
        <label className="upload"><Upload/> ייבוא<input type="file" multiple accept=".xlsx,.xls,.csv,.pdf" onChange={importFiles}/></label>
        <button aria-label="רענון" onClick={load}><RefreshCw/></button>
        <button aria-label="יציאה" onClick={()=>supabase.auth.signOut()}><LogOut/></button>
      </div>
    </header>
    <nav><select value={active} onChange={e=>setSelectedMonth(e.target.value)}>{months.map(m=><option key={m}>{m}</option>)}</select><span>{msg}</span></nav>
    <section className="cards">
      <div className="card"><Wallet/><span>הוצאות אמיתיות</span><strong>{money(total)}</strong><small>{prevTotal?pct(total,prevTotal)+" לעומת החודש הקודם":"אין חודש קודם"}</small></div>
      <div className="card"><ShoppingCart/><span>סופר</span><strong>{money(supermarket)}</strong><small>{prevSuper?pct(supermarket,prevSuper)+" לעומת החודש הקודם":""}</small></div>
      <div className="card"><Wallet/><span>מזומן</span><strong>{money(cash)}</strong><small>אשראי {money(card)} · עו״ש {money(bank)}</small></div>
      <div className="card"><ArrowDownUp/><span>מספר הוצאות</span><strong>{expenses.length}</strong><small>חיובי אשראי בעו״ש לא נספרים</small></div>
    </section>
    <section className="grid">
      <div className="panel"><h2>לפי קטגוריה</h2>{categoryTotals.map(x=><div className="row" key={x.name}><span>{x.name}</span><b>{money(x.value)}</b></div>)}</div>
      <div className="panel"><h2>הוצאות אחרונות</h2>{current.filter(isExpense).slice(0,20).map(x=><div className="tr" key={x.id||x.external_id}><span>{x.date}</span><span>{x.merchant}</span><span>{x.category}</span><b>{money(x.amount)}</b></div>)}</div>
    </section>
    {modal&&<ExpenseModal cats={cats} onClose={()=>setModal(false)} onSave={saveManual} onAddCategory={addCategory}/>}
  </div>;
}

function Root(){
  const [session,setSession]=useState(undefined);
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);
  if(session===undefined)return <div className="loading">טוען…</div>;
  return session?<App session={session}/>:<Auth/>;
}
createRoot(document.getElementById("root")).render(<Root/>);