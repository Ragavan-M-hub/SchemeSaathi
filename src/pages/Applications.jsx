// src/pages/Applications.jsx
// The signed-in user's loan applications. Officers see the whole pipeline here
// too (the API scopes by role); a status filter narrows the list.

import { useState } from "react";
import { Link } from "react-router-dom";
import { applicationsApi } from "../lib/api.js";
import { useFetch } from "../hooks/useFetch.js";
import { useT } from "../i18n/LanguageContext.jsx";
import { formatINR } from "../data/schemes.js";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

const STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "documents_pending",
  "approved",
  "rejected",
  "disbursed",
  "withdrawn",
];

export default function Applications() {
  const t = useT();
  const [status, setStatus] = useState("");

  const { data, loading, error } = useFetch(
    (opts) => applicationsApi.list({ status: status || undefined }, opts),
    [status]
  );

  const applications = data?.applications ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{t("app.list.title")}</h1>
          <p className="text-slate-600 text-sm mt-1">{t("app.list.subtitle")}</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input sm:w-56"
          aria-label={t("app.list.filter.all")}
        >
          <option value="">{t("app.list.filter.all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner size="lg" label={t("common.loading")} />
      ) : error ? (
        <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
          {error.message}
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon="📋"
          title={t("app.list.empty.title")}
          description={t("app.list.empty.desc")}
          action={
            <Link to="/schemes" className="btn-primary">
              {t("app.list.empty.cta")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {applications.map((a) => (
            <Link
              key={a.id}
              to={`/applications/${a.id}`}
              className="card hover:border-navy-300 transition flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-navy-900 truncate">{a.schemeName}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {t("app.ref")}: {a.referenceNo}
                  {a.partnerName ? ` · ${a.partnerName}` : ""}
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">{t("app.amount")}</div>
                  <div className="font-semibold text-slate-800">{formatINR(a.amountRequested)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t("app.emi")}</div>
                  <div className="font-semibold text-slate-800">{formatINR(a.emi)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{t("app.docs")}</div>
                  <div className="font-semibold text-slate-800">
                    {a.documentsReady}/{a.documentCount}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
