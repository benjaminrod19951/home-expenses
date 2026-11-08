import React from "react";

export class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("App render error", error, info);
    }
    render() {
        if (this.state.error)
            return <main className="auth">
              <div className="authbox">
                <h1>🏠 הוצאות הבית</h1>
                <div className="notice"><b>האפליקציה נתקלה בשגיאה בזמן הטעינה.</b><br />רענני את הדף. אם זה חוזר, העתיקי לי את הטקסט הבא:<br /><code>{String(this.state.error?.message || this.state.error)}</code></div>
                <button className="save" onClick={() => window.location.reload()}>רענון</button>
              </div>
            </main>;
        return this.props.children;
    }
}
