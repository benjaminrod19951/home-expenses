import React, { useState } from "react";
import { supabase, supabaseConfigError } from "../supabase.js";

export function Auth() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [signup, setSignup] = useState(false);
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    async function submit() {
        if (supabaseConfigError)
            return setMsg(supabaseConfigError);
        setBusy(true);
        try {
            const r = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
            if (r.error)
                setMsg(r.error.message);
            else if (signup)
                setMsg("נשלח אימייל לאישור החשבון.");
        }
        catch (e) {
            setMsg(String(e?.message || e));
        }
        finally {
            setBusy(false);
        }
    }
    async function forgot() {
        if (supabaseConfigError)
            return setMsg(supabaseConfigError);
        const address = email.trim();
        if (!address)
            return setMsg("הכניסי קודם את כתובת האימייל של החשבון.");
        setBusy(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}${window.location.pathname}` });
            if (error)
                setMsg(error.message);
            else
                setMsg("נשלח קישור לאיפוס הסיסמה. בדקי גם ספאם וקידומי מכירות.");
        }
        catch (e) {
            setMsg(String(e?.message || e));
        }
        finally {
            setBusy(false);
        }
    }
    return <main className="auth">
      <div className="authbox">
        <h1>🏠 הוצאות הבית</h1>
        <p>ניהול משותף של ההוצאות שלכם</p>
        <small className="version-badge">v24.47</small>
        <input dir="ltr" placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)}/>
        <input dir="ltr" type="password" placeholder="סיסמה" value={password} onChange={e => setPassword(e.target.value)}/>
        <button disabled={busy} onClick={submit}>{busy ? "רגע…" : signup ? "הרשמה" : "כניסה"}</button>
        {!signup && <button className="link" disabled={busy} onClick={forgot}>שכחתי סיסמה</button>}
        <button className="link" disabled={busy} onClick={() => setSignup(!signup)}>
          {signup ? "כבר יש חשבון? כניסה" : "אין לך חשבון? הרשמה"}
        </button>
        {msg && <div className="notice">{msg}</div>}
      </div>
    </main>;
}

export function PasswordRecovery({ onDone }) {
    const [p1, setP1] = useState("");
    const [p2, setP2] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    async function save() {
        if (p1.length < 6)
            return setMsg("הסיסמה חייבת להכיל לפחות 6 תווים");
        if (p1 !== p2)
            return setMsg("הסיסמאות אינן זהות");
        setBusy(true);
        const { error } = await supabase.auth.updateUser({ password: p1 });
        setBusy(false);
        if (error)
            return setMsg(error.message);
        setMsg("הסיסמה עודכנה בהצלחה.");
        setTimeout(() => onDone?.(), 600);
    }
    return <main className="auth">
      <div className="authbox">
        <h1>🔐 בחירת סיסמה חדשה</h1>
        <p>הקישור לאיפוס הסיסמה אומת. בחרי סיסמה חדשה.</p>
        <input dir="ltr" type="password" autoComplete="new-password" placeholder="סיסמה חדשה" value={p1} onChange={e => setP1(e.target.value)}/>
        <input dir="ltr" type="password" autoComplete="new-password" placeholder="אימות סיסמה" value={p2} onChange={e => setP2(e.target.value)} onKeyDown={e => e.key === "Enter" && save()}/>
        <button disabled={busy} onClick={save}>{busy ? "שומר…" : "עדכן סיסמה"}</button>
        {msg && <div className="notice">{msg}</div>}
      </div>
    </main>;
}
