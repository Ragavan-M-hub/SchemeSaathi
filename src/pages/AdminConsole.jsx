// src/pages/AdminConsole.jsx
// Officer/admin cockpit: headline pipeline numbers plus the review queue —
// everything currently waiting on an officer decision, oldest first.

import { Link } from "react-router-dom";
import { adminApi } from "../lib/api.js";
import { useFetch } from "../hooks/useFetch.js";
import { useT } from "../i18n/LanguageContext.jsx";
import { formatINR } from "../data/schemes.js";
import StatusBadge from "../components/StatusBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function AdminConsole() {
  const t = useT();

  const overview = useFetch((opts) => adminApi.overview(opts), []);
  const queue = useFetch((opts) => adminApi.queue({ limit: 50 }, opts), []);

  const stats = overview.data?.applications;
  const byStatus = stats?.byStatus ?? {};
  const pending =
    (byStatus.submitted ?? 0) +
    (byStatus.under_review ?? 0) +
    (byStatus.documents_pending ?? 0);
  const applications = queue.data?.applications ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">{t("admin.title")}</h1>
        <p className="text-slate-600 text-sm mt-1">{t("admin.subtitle")}</p>
      </div>

      {overview.loading ? (
        <LoadingSpinner label={t("common.loading")} />
      ) : overview.error ? (
        <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
          {overview.error.message}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label={t("admin.overview.pending")} value={pending} accent="text-saffron-600" />
          <Stat
            label={t("admin.overview.approved")}
            value={byStatus.approved ?? 0}
            accent="text-leaf-600"
          />
          <Stat label={t("admin.overview.disbursed")} value={byStatus.disbursed ?? 0} />
          <Stat label={t("admin.overview.applicants")} value={overview.data?.counts?.users ?? 0} />
        </div>
      )}

      <div>
        <h2 className="font-bold text-navy-900 mb-3">{t("admin.queue.title")}</h2>
        {queue.loading ? (
          <LoadingSpinner label={t("common.loading")} />
        ) : queue.error ? (
          <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
            {queue.error.message}
          </div>
        ) : applications.length === 0 ? (
          <EmptyState icon="✅" title={t("admin.queue.empty")} />
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
                    {a.referenceNo}
                    {a.applicantName ? ` · ${a.applicantName}` : ""}
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">{t("app.amount")}</div>
                    <div className="font-semibold text-slate-800">
                      {formatINR(a.amountRequested)}
                    </div>
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
    </div>
  );
}

function Stat({ label, value, accent = "text-navy-900" }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
    </div>
  );
}
