import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { authErrorMessage, useAuth } from "../auth/AuthContext.jsx";

/** Only follow ?next= links inside this site, so a crafted link can't bounce users elsewhere. */
function safeNext(next) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Log-in and sign-up share one form. `mode` is "login" or "signup".
 * Other pages send users here with /login?next=/bills/119/hr/1 to come back afterwards.
 */
export default function AuthPage({ mode }) {
  const isSignUp = mode === "signup";
  const { user, loading, configured, signUp, logIn, logInWithGoogle } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const { search } = useLocation();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <div className="auth-card">
        <h1>{isSignUp ? "Create an account" : "Log in"}</h1>
        <p className="error">
          Firebase isn't set up on this machine yet. Copy <code>frontend/.env.example</code> to{" "}
          <code>frontend/.env.local</code>, fill in the Firebase web config, and restart <code>npm run dev</code>.
        </p>
      </div>
    );
  }
  if (loading) return <p className="muted">Loading…</p>;
  if (user) return <Navigate to={next} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      await action();
      navigate(next, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (isSignUp && !form.name.trim()) return setError("Please enter your name.");
    run(() =>
      isSignUp ? signUp(form.name.trim(), form.email.trim(), form.password) : logIn(form.email.trim(), form.password)
    );
  }

  return (
    <div className="auth-card">
      <h1>{isSignUp ? "Create an account" : "Log in"}</h1>
      <p className="muted">
        {isSignUp ? "Follow bills and members and get notified when they change." : "Welcome back to Capitol Ledger."}
      </p>

      <form onSubmit={onSubmit} className="auth-form">
        {isSignUp && (
          <label>
            Name
            <input value={form.name} onChange={set("name")} autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={6}
            required
          />
          {isSignUp && <span className="muted small">At least 6 characters.</span>}
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : isSignUp ? "Sign up" : "Log in"}
        </button>
      </form>

      <div className="auth-divider"><span>or</span></div>
      <button type="button" className="btn-google" disabled={busy} onClick={() => run(logInWithGoogle)}>
        Continue with Google
      </button>

      <p className="auth-switch">
        {isSignUp ? "Already have an account? " : "New to Capitol Ledger? "}
        <Link to={`${isSignUp ? "/login" : "/signup"}${search}`}>{isSignUp ? "Log in" : "Create an account"}</Link>
      </p>
    </div>
  );
}
