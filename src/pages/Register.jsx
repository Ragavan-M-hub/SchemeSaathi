// src/pages/Register.jsx
// Self-registration for applicants. Officers/admins are seeded server-side, so
// this only ever creates an "applicant" account.

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useT, useLanguage } from "../i18n/LanguageContext.jsx";
import { ApiError } from "../lib/api.js";

export default function Register() {
  const t = useT();
  const { lang } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    state: "",
    district: "",
    preferredLang: lang,
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      // Drop blank optionals so the server sees them as absent, not "".
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== "")
      );
      await register(payload);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details && typeof err.details === "object") {
        setFieldErrors(err.details);
        setError(err.message);
      } else {
        setError(
          err instanceof ApiError ? err.message : "Something went wrong. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key) => {
    const v = fieldErrors[key];
    if (!v) return null;
    return <div className="text-xs text-red-600 mt-1">{Array.isArray(v) ? v[0] : v}</div>;
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-navy-900">{t("auth.register.title")}</h1>
        <p className="text-slate-600 mt-1 text-sm">{t("auth.register.subtitle")}</p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
            {t("auth.name")}
          </label>
          <input id="name" required value={form.name} onChange={set("name")} className="input" />
          {fieldError("name")}
        </div>

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
          />
          {fieldError("email")}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={set("password")}
            className="input"
          />
          <div className="text-xs text-slate-500 mt-1">{t("auth.password.hint")}</div>
          {fieldError("password")}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
            {t("auth.phone")} <span className="text-slate-400">({t("auth.optional")})</span>
          </label>
          <input id="phone" value={form.phone} onChange={set("phone")} className="input" />
          {fieldError("phone")}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-1">
              {t("auth.state")} <span className="text-slate-400">({t("auth.optional")})</span>
            </label>
            <input id="state" value={form.state} onChange={set("state")} className="input" />
          </div>
          <div>
            <label htmlFor="district" className="block text-sm font-medium text-slate-700 mb-1">
              {t("auth.district")} <span className="text-slate-400">({t("auth.optional")})</span>
            </label>
            <input id="district" value={form.district} onChange={set("district")} className="input" />
          </div>
        </div>

        <div>
          <label htmlFor="preferredLang" className="block text-sm font-medium text-slate-700 mb-1">
            {t("auth.preferredLang")}
          </label>
          <select
            id="preferredLang"
            value={form.preferredLang}
            onChange={set("preferredLang")}
            className="input"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="mr">मराठी</option>
          </select>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t("auth.register.submitting") : t("auth.register.submit")}
        </button>

        <p className="text-sm text-center text-slate-600">
          {t("auth.register.haveAccount")}{" "}
          <Link to="/login" className="text-navy-700 font-semibold hover:underline">
            {t("auth.login.submit")}
          </Link>
        </p>
      </form>
    </div>
  );
}
