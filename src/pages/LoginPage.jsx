import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export function LoginPage() {
  const { user, isConfigured } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const hasRequiredFields =
    mode === "signup"
      ? Boolean(fullName.trim() && email.trim() && password.trim())
      : Boolean(email.trim() && password.trim());
  const canSubmit = isConfigured && hasRequiredFields && !loading;

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isConfigured) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
      } else {
        const { data, error: signupError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (signupError) throw signupError;
        if (data?.user) {
          setMessage("Account created. Please check your email for confirmation.");
        } else {
          setError("Sign-up failed. Please verify details and try again.");
        }
      }
    } catch (err) {
      const fallback =
        mode === "signup"
          ? "Sign-up failed. Please verify your details and try again."
          : "Login failed. Please check your email and password.";
      setError(err.message || fallback);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout
      title="Welcome"
      subtitle="Sign in to manage your income and expenses"
    >
      <section className="mx-auto w-full max-w-lg card text-left md:mt-8">
        {!isConfigured ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
            before signing in. If you just updated `.env`, restart `npm run dev`.
          </p>
        ) : null}

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={mode === "login" ? "btn-primary" : "btn-secondary"}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "signup" ? "btn-primary" : "btn-secondary"}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <div>
              <label className="field-label">Full name</label>
              <input
                className="input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>
          ) : null}

          <div>
            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          <button className="btn-primary w-full" type="submit" disabled={!canSubmit}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </section>
    </Layout>
  );
}
