import { postApi } from "../lib/api.js";
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, MicOff, Save, Trash2, X } from "lucide-react";
import { normalizeMerchant } from "../lib/finance.js";
import { dateOffset, money, num, today } from "../lib/format.js";
import { correctTranscriptSpelling, mergeAiWithLocal, parseQuickEntries, quickCategory } from "../lib/speech.js";

export function QuickExpenseModal({ cats, rules, history, workspaceId, onClose, onSaveAll }) {
    const draftKey = `quick-entry-draft:${workspaceId || "default"}`;
    const restored = (() => {
        try {
            return JSON.parse(localStorage.getItem(draftKey) || "null") || {};
        }
        catch {
            return {};
        }
    })();
    const [text, setText] = useState(restored.text || "");
    const [rows, setRows] = useState(Array.isArray(restored.rows) ? restored.rows : []);
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState(restored.text ? "שוחזרה טיוטה שלא נשמרה מהפעם הקודמת." : "");
    const [reloadInfo, setReloadInfo] = useState("");
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const textareaRef = useRef(null);
    const timerRef = useRef(null);
    const parseTimerRef = useRef(null);
    const parseSeqRef = useRef(0);
    const manualEditedRef = useRef(false);
    const dateFromHint = h => h === "day_before_yesterday" ? dateOffset(-2) : h === "yesterday" ? dateOffset(-1) : today();
    const normalizeAiRows = entries => (entries || []).map((e, i) => {
        const amount = Math.abs(Number(e?.amount) || 0);
        if (!amount)
            return null;
        const type = e?.type === "income" ? "income" : "expense";
        const rawCat = String(e?.category || "").trim();
        const matchedCat = cats.find(c => normalizeMerchant(c) === normalizeMerchant(rawCat)) || cats.find(c => normalizeMerchant(c).includes(normalizeMerchant(rawCat)) || normalizeMerchant(rawCat).includes(normalizeMerchant(c)));
        const merchant = String(e?.merchant || e?.description || e?.item || e?.name || "").trim() || "תנועה ידנית";
        const learned = quickCategory(merchant, cats, rules, history);
        const category = matchedCat || (learned && cats.includes(learned) ? learned : null) || (cats.includes("אחר") ? "אחר" : "לא מסווג");
        const payment = ["מזומן", "ביט", "אשראי", "העברה", "עו״ש"].includes(e?.payment_method) ? e.payment_method : (type === "income" ? "העברה" : "מזומן");
        return {
            _key: `q-${Date.now()}-${i}`, type, date: dateFromHint(e?.date_hint), amount, category, merchant, payment_method: payment, notes: `הזנה מהירה מתוך תמלול: ${text.slice(0, 500)}`
        };
    }).filter(Boolean);
    const parse = async (source = text, { silent = false } = {}) => {
        const clean = String(source || "").trim();
        if (!clean) {
            setRows([]);
            setParsing(false);
            return;
        }
        const seq = ++parseSeqRef.current;
        setParsing(true);
        setError("");
        if (!silent)
            setNotice("מנתח את ההוצאות…");
        const local = parseQuickEntries(clean, cats, rules, history);
        try {
            const res = await postApi("/api/parse-quick", {
                    transcript: clean, categories: cats, historyMerchants: [...new Set((history || []).map(x => x.merchant).filter(Boolean))].slice(0, 120)
                });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data.error || "שירות הפענוח החזיר שגיאה");
            if (seq !== parseSeqRef.current)
                return;
            const ai = mergeAiWithLocal(normalizeAiRows(data.entries), local); // fill empty descriptions from the local parse
            // Do not silently drop expenses if AI misses one of the locally recognized entries.
            if (!ai.length || ai.length < local.length) {
                if (local.length) {
                    setRows(local);
                    setNotice(`זוהו ${local.length} תנועות בפענוח מקומי; שירות ה-AI החזיר פחות תנועות. יש לבדוק לפני שמירה.`);
                    return;
                }
                throw new Error("לא זוהו תנועות עם סכומים בתמלול");
            }
            setRows(ai);
            setNotice(`זוהו ${ai.length} תנועות. בדוק את כולן לפני אישור.`);
        }
        catch (e) {
            if (seq !== parseSeqRef.current)
                return;
            if (local.length) {
                setRows(local);
                setError(`פענוח AI לא זמין: ${e?.message || e}. מוצגות ${local.length} תנועות מפענוח מקומי — יש לבדוק אותן.`);
            }
            else
                setError(`${e?.message || e}. הטקסט נשמר; אפשר לתקן ולנסות שוב.`);
        }
        finally {
            if (seq === parseSeqRef.current)
                setParsing(false);
        }
    };
    useEffect(() => {
        try {
            localStorage.setItem(draftKey, JSON.stringify({ text, rows }));
        }
        catch {
        }
    }, [draftKey, text, rows]);
    useEffect(() => {
        try {
            const nav = performance.getEntriesByType?.("navigation")?.[0];
            const marker = sessionStorage.getItem("quick-recording-active");
            if (marker && nav?.type === "reload")
                setReloadInfo("זוהה רענון של הדף בזמן הזנה קולית. הטיוטה שוחזרה אוטומטית. אם זה חוזר, שלחי צילום של ההודעה הזו והדפדפן שבו זה קורה.");
            sessionStorage.removeItem("quick-recording-active");
        }
        catch {
        }
    }, []);
    useEffect(() => {
        clearTimeout(parseTimerRef.current);
        if (!text.trim() || recording || transcribing || manualEditedRef.current)
            return;
        parseTimerRef.current = setTimeout(() => parse(text, { silent: true }), 700);
        return () => clearTimeout(parseTimerRef.current);
    }, [text, recording, transcribing, cats.join("|")]);
    useEffect(() => () => {
        clearTimeout(parseTimerRef.current);
        clearTimeout(timerRef.current);
        try {
            streamRef.current?.getTracks().forEach(t => t.stop());
        }
        catch {
        }
    }, []);
    const blobToBase64 = blob => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
    const transcribe = async (blob) => {
        setTranscribing(true);
        setError("");
        setNotice("מתמלל את ההקלטה…");
        try {
            if (blob.size > 3.5 * 1024 * 1024)
                throw new Error("ההקלטה ארוכה מדי. נסי הקלטה קצרה יותר.");
            const audio = await blobToBase64(blob);
            const res = await postApi("/api/transcribe", {
                    audio, mimeType: blob.type || "audio/webm", vocabulary: [...new Set([
                            ...(cats || []), ...(rules || []).flatMap(r => [r.merchant_label, r.merchant_key]), ...(history || []).slice(0, 500).map(x => x.merchant)
                        ])].filter(Boolean).slice(0, 180)
                });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data.error || "שירות התמלול החזיר שגיאה");
            const transcript = String(data.text || "").trim();
            if (!transcript)
                throw new Error("לא התקבל טקסט מההקלטה");
            manualEditedRef.current = false;
            parseSeqRef.current++;
            const corrected = correctTranscriptSpelling(transcript, history);
            setText(prev => prev.trim() ? `${prev.trim()}\n${corrected}` : corrected);
            setNotice("התמלול נוסף. הטבלה תתעדכן אוטומטית בעוד רגע — אפשר לתקן את הטקסט בכל שלב.");
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
        catch (e) {
            setError(e?.message || String(e));
            setNotice("");
        }
        finally {
            setTranscribing(false);
        }
    };
    const startVoice = async () => {
        setError("");
        setNotice("");
        if (!window.isSecureContext)
            return setError("הקלטה קולית זמינה רק ב-HTTPS.");
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
            return setError("הדפדפן הזה לא תומך בהקלטת אודיו מהאתר. אפשר להשתמש בהכתבה של המקלדת.");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
            const mime = candidates.find(x => MediaRecorder.isTypeSupported?.(x)) || "";
            const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            recorderRef.current = recorder;
            chunksRef.current = [];
            recorder.ondataavailable = e => {
                if (e.data?.size)
                    chunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                clearTimeout(timerRef.current);
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || "audio/webm" });
                chunksRef.current = [];
                setRecording(false);
                if (blob.size)
                    transcribe(blob);
            };
            recorder.onerror = e => {
                setRecording(false);
                setError(`שגיאת הקלטה: ${e?.error?.message || "לא ניתן להקליט"}`);
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start(250);
            try {
                sessionStorage.setItem("quick-recording-active", String(Date.now()));
            }
            catch {
            }
            setRecording(true);
            setNotice("מקליט… אפשר לומר כמה תנועות ברצף.");
            timerRef.current = setTimeout(() => {
                if (recorder.state === "recording")
                    recorder.stop();
            }, 60000);
        }
        catch (e) {
            const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError";
            setError(denied ? "הרשאת המיקרופון חסומה לאתר. אשרי Microphone בהגדרות האתר ואז נסי שוב." : `לא ניתן לפתוח את המיקרופון: ${e?.message || e}`);
        }
    };
    const stopVoice = () => {
        clearTimeout(timerRef.current);
        try {
            sessionStorage.removeItem("quick-recording-active");
        }
        catch {
        }
        const r = recorderRef.current;
        if (r?.state === "recording")
            r.stop();
    };
    const update = (i, k, v) => {
        manualEditedRef.current = true;
        parseSeqRef.current++;
        setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
    };
    const expenseSum = rows.filter(r => r.type === "expense").reduce((s, r) => s + num(r.amount), 0);
    const incomeSum = rows.filter(r => r.type === "income").reduce((s, r) => s + num(r.amount), 0);
    const submitRows = async () => {
        if (savingRef.current || parsing || transcribing || recording)
            return;
        savingRef.current = true;
        setSaving(true);
        try {
            await onSaveAll(rows);
        }
        finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
    const clearDraft = () => {
        if (recording)
            stopVoice();
        clearTimeout(parseTimerRef.current);
        parseSeqRef.current++;
        manualEditedRef.current = false;
        setText("");
        setRows([]);
        setError("");
        setNotice("");
        try {
            localStorage.removeItem(draftKey);
        }
        catch {
        }
    };
    return <div className="overlay">
      <div className="modal wide quick-modal">
        <div className="modalhead">
          <div>
            <h2>🎙️ הזנה מהירה</h2>
            <p className="muted">הקלטה → תמלול מלא → טבלת טיוטה שמתעדכנת אוטומטית. אפשר לתקן את המשפט או כל תא. שום דבר לא נשמר עד לאישור הסופי.</p>
          </div>
          <button className="x" onClick={onClose}><X /></button>
        </div>
        <div className="quick-input">
          <label className="quick-transcript-label">
            <b>התמלול המלא</b>
            <span className="muted"> — זה מקור האמת. תיקון בטקסט יעדכן אוטומטית את הטבלה.</span>
          </label>
          <textarea ref={textareaRef} value={text} onChange={e => {
            manualEditedRef.current = false;
            parseSeqRef.current++;
            setText(e.target.value);
            setNotice("התמלול השתנה — הטבלה תתעדכן אוטומטית.");
        }} placeholder="כאן יופיע כל המשפט שתומלל. אפשר גם להקליד: סופר 350 שקל קטגוריה סופר, דאג 50 שקל קטגוריה בעלי חיים…"/>
          <div className="quick-actions">
            <button className={recording ? "voicebtn listening" : "voicebtn"} disabled={transcribing || parsing} onClick={recording ? stopVoice : startVoice}>
              {recording ? <><MicOff /> סיום הקלטה</> : <><Mic /> {transcribing ? "מתמלל…" : "הקלטה חדשה / נוספת"}</>}
            </button>
            <button className="secondary inline-secondary" disabled={recording || transcribing || parsing || !text.trim()} onClick={() => parse(text)}><Keyboard /> {parsing ? "מעדכן טבלה…" : "עדכן עכשיו"}</button>
            <button className="secondary inline-secondary" disabled={recording || transcribing || parsing} onClick={clearDraft}>נקה טיוטה</button>
          </div>
          {recording && <div className="listening-note">● מקליט… לחצי “סיום הקלטה” כשתסיימי.</div>}
          {transcribing && <div className="voice-support-note">התמלול מתבצע בשרת באמצעות Whisper Large v3. לאחר מכן הטקסט יוצג כאן והטבלה תתעדכן אוטומטית. הטיוטה נשמרת מקומית גם במקרה של רענון.</div>}
          {notice && <div className="quick-notice">{notice}</div>}
          {reloadInfo && <div className="quick-notice">🔄 {reloadInfo}</div>}
          {error && <div className="quick-error">{error}</div>}
        </div>
        {rows.length > 0 && <>
      <div className="quick-summary">טיוטה בלבד: זוהו <b>{rows.length}</b> תנועות · הוצאות <b>{money(expenseSum)}</b> · הכנסות <b>{money(incomeSum)}</b>. אפשר לערוך כל תא או למחוק שורה.</div>
      <div className="tablewrap quick-table">
        <table>
          <thead>
            <tr>
              <th>סוג</th>
              <th>תיאור</th>
              <th>סכום</th>
              <th>קטגוריה</th>
              <th>אמצעי</th>
              <th>תאריך</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => <tr key={r._key}>
      <td>
        <select value={r.type || "expense"} onChange={e => update(i, "type", e.target.value)}>
          <option value="expense">הוצאה</option>
          <option value="income">הכנסה</option>
        </select>
      </td>
      <td><input value={r.merchant} onChange={e => update(i, "merchant", e.target.value)}/></td>
      <td>
        <input type="number" step="0.01" value={r.amount} onChange={e => update(i, "amount", e.target.value)}/>
      </td>
      <td>
        <select value={r.category} onChange={e => update(i, "category", e.target.value)}>
          {cats.map(c => <option key={c}>{c}</option>)}
          <option>לא מסווג</option>
        </select>
      </td>
      <td>
        <select value={r.payment_method} onChange={e => update(i, "payment_method", e.target.value)}>
          <option>מזומן</option>
          <option>ביט</option>
          <option>אשראי</option>
          <option>העברה</option>
          <option>עו״ש</option>
        </select>
      </td>
      <td><input type="date" value={r.date} onChange={e => update(i, "date", e.target.value)}/></td>
      <td>
        <button className="iconbtn danger" onClick={() => {
                    manualEditedRef.current = true;
                    parseSeqRef.current++;
                    setRows(rs => rs.filter((_, idx) => idx !== i));
                }}>
          <Trash2 />
        </button>
      </td>
    </tr>)}
          </tbody>
        </table>
      </div>
      <button className="save quick-save" disabled={saving || parsing || transcribing || recording} onClick={submitRows}><Save /> {saving ? "שומר…" : `אשר ושמור את כל ${rows.length} התנועות`}</button>
    </>}
      </div>
    </div>;
}
