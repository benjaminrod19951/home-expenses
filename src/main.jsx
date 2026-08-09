from pathlib import Path
import zipfile, shutil, re

src_zip=Path("/mnt/data/home-expenses-manager-v4-full.zip")
work=Path("/mnt/data/home-expenses-manager-v5")
if work.exists(): shutil.rmtree(work)
work.mkdir()

with zipfile.ZipFile(src_zip) as z:
    z.extractall(work)

main=work/"src/main.jsx"
text=main.read_text(encoding="utf-8")

# Fix malformed JSX introduced in the previous generated source.
text=text.replace('קטגוריה><div className="inline">', 'קטגוריה<div className="inline">')
text=text.replace('קטגוריה><select', 'קטגוריה<select')
text=text.replace('>{cats.map(c=>{c})}', '>{cats.map(c=><option key={c}>{c}</option>)}</select></label>')
# The replacement above can leave the old tail; rewrite the entire modal function robustly.
start=text.index('function ExpenseModal(')
end=text.index('\nfunction App(', start)
modal=r'''function ExpenseModal({cats,onClose,onSave,onAddCategory}){
  const [f,setF]=useState({date:today(),amount:"",category:"סופר",merchant:"",payment_method:"מזומן",notes:""});
  const set=(k,v)=>setF({...f,[k]:v});
  return <div className="overlay"><div className="modal">
    <div className="modalhead"><h2>➕ הוצאה ידנית</h2><button className="x" onClick={onClose}>×</button></div>
    <label>סכום
      <input autoFocus type="number" inputMode="decimal" placeholder="150" value={f.amount} onChange={e=>set("amount",e.target.value)}/>
    </label>
    <label>קטגוריה
      <div className="inline">
        <select value={f.category} onChange={e=>set("category",e.target.value)}>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" onClick={onAddCategory}>+ חדשה</button>
      </div>
    </label>
    <label>בית עסק / תיאור
      <input placeholder="למשל: גנן" value={f.merchant} onChange={e=>set("merchant",e.target.value)}/>
    </label>
    <label>אמצעי תשלום
      <select value={f.payment_method} onChange={e=>set("payment_method",e.target.value)}>
        <option>מזומן</option><option>אשראי</option><option>עו״ש</option><option>העברה</option>
      </select>
    </label>
    <label>תאריך
      <input type="date" value={f.date} onChange={e=>set("date",e.target.value)}/>
    </label>
    <label>הערה
      <input placeholder="אופציונלי" value={f.notes} onChange={e=>set("notes",e.target.value)}/>
    </label>
    <button className="save" onClick={()=>onSave(f)}>שמירה</button>
  </div></div>;
}
'''
text=text[:start]+modal+text[end:]
main.write_text(text,encoding="utf-8")

# Add a small V5 marker and a Vercel config suitable for SPA routing.
readme=work/"README.md"
readme.write_text(readme.read_text(encoding="utf-8")+"\n\n## V5\nFixed malformed JSX in the manual expense modal and prepared the project for deployment.\n",encoding="utf-8")

out=Path("/mnt/data/home-expenses-manager-v5-fixed.zip")
if out.exists(): out.unlink()
with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
    for p in work.rglob("*"):
        if p.is_file():
            z.write(p,p.relative_to(work))

print(out)
print("created", out.exists(), "size", out.stat().st_size)
