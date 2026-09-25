// src/pages/Login.jsx
// Email/password sign-in. On success we send the user back to wherever a guard
// bounced them from (location.state.from), or the dashboard by default.

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useT } from "../i18n/LanguageContext.jsx";
import { ApiError } from "../lib/api.js";

const DEMO_ACCOUNTS = [
  { email: "asha@example.com", label: "Applicant (Marathi)" },
  { email: "ravi@example.com", label: "Applicant (Hindi)" },
  { email: "officer@example.com", label: "Reviewing officer" },
  { email: "admin@example.com", label: "Admin" },
];

export default function Login() {
  const t = useT();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (email) => setForm({ email, password: "demo1234" });

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-navy-900">{t("auth.login.title")}</h1>
        <p className="text-slate-600 mt-1 text-sm">{t("auth.login.subtitle")}</p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set("email")}
            className="input"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={set("password")}
            className="input"
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>

        <p className="text-sm text-center text-slate-600">
          {t("auth.login.noAccount")}{" "}
          <Link to="/register" className="text-navy-700 font-semibold hover:underline">
            {t("auth.register.submit")}
          </Link>
        </p>
      </form>

      <div className="card bg-slate-50">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {t("auth.demo.title")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => fillDemo(a.email)}
              className="text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-navy-300 transition text-xs"
            >
              <div className="font-semibold text-slate-800">{a.label}</div>
              <div className="text-slate-500 truncate">{a.email}</div>
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-2">{t("auth.demo.hint")}</div>
      </div>
    </div>
  );
}
