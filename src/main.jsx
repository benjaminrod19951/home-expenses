import React, { useEffect, useState } from "react";
import { supabase, supabaseConfigError } from "./supabase.js";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.jsx";
import { Auth, PasswordRecovery } from "./components/Auth.jsx";
import "./style.css";

function Root() {
    const [session, setSession] = useState(undefined);
    const [recovery, setRecovery] = useState(false);
    useEffect(() => {
        try {
            localStorage.removeItem("home-expenses-auth-v1");
        }
        catch {
        }
        ;
        if (!supabase)
            return;
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((e, s) => {
            if (e === "PASSWORD_RECOVERY")
                setRecovery(true);
            setSession(s);
        });
        return () => subscription.unsubscribe();
    }, []);
    if (supabaseConfigError)
        return <main className="auth">
          <div className="authbox">
            <h1>🏠 הוצאות הבית</h1>
            <div className="notice">{supabaseConfigError}</div>
          </div>
        </main>;
    if (session === undefined)
        return <div className="loading">טוען…</div>;
    if (recovery)
        return <PasswordRecovery onDone={() => setRecovery(false)}/>;
    return session ? <App session={session}/> : <Auth />;
}

createRoot(document.getElementById("root")).render(<AppErrorBoundary><Root /></AppErrorBoundary>);
