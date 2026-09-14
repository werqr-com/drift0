import { useState } from "react";

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthFormProps {
  mode: AuthMode;
  initialError?: string | null;
}

export function AuthForm({ mode, initialError = null }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const titles: Record<AuthMode, string> = {
    login: "Sign in",
    register: "Create account",
    forgot: "Reset password",
    reset: "Set new password",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const endpoints: Record<AuthMode, string> = {
        login: "/api/auth/login",
        register: "/api/auth/signup",
        forgot: "/api/auth/forgot",
        reset: "/api/auth/reset",
      };

      const body: Record<string, string> = {};
      if (mode !== "reset") body.email = email;
      if (mode === "login" || mode === "register" || mode === "reset") {
        body.password = password;
      }
      if (mode === "register" && displayName) body.display_name = displayName;

      const res = await fetch(endpoints[mode], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      if (mode === "login") {
        window.location.href = "/";
        return;
      }
      if (mode === "register") {
        if (data.needsConfirmation) {
          setMessage(data.message || "Check your email to confirm your account");
        } else {
          window.location.href = "/";
        }
        return;
      }
      if (mode === "forgot") {
        setMessage(data.message || "Check your email for a reset link");
        return;
      }
      if (mode === "reset") {
        setMessage("Password updated. Redirecting…");
        setTimeout(() => {
          window.location.href = "/";
        }, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-logo">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
        <h1>Drift0</h1>
      </div>
      <h2>{titles[mode]}</h2>

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && (
          <div className="form-group full">
            <label>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />
          </div>
        )}
        {mode !== "reset" && (
          <div className="form-group full">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
        )}
        {(mode === "login" || mode === "register" || mode === "reset") && (
          <div className="form-group full">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-message">{message}</div>}

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "Please wait…" : titles[mode]}
        </button>
      </form>

      <div className="auth-links">
        {mode === "login" && (
          <>
            <a href="/register">Create account</a>
            <a href="/forgot-password">Forgot password?</a>
          </>
        )}
        {mode === "register" && <a href="/login">Already have an account?</a>}
        {mode === "forgot" && <a href="/login">Back to sign in</a>}
        {mode === "reset" && <a href="/">Back to app</a>}
        <a href="/">Continue without account</a>
      </div>
    </div>
  );
}
