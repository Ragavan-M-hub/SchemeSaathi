// src/pages/Dashboard.jsx
// The signed-in applicant's home: profile summary, headline application stats,
// the next suggested step, saved schemes, and recent applications — all from a
// single /dashboard call the server assembles.

import { Link } from "react-router-dom";
import { dashboardApi } from "../lib/api.js";
import { useFetch } from "../hooks/useFetch.js";
import { useT } from "../i18n/LanguageContext.jsx";
import { formatINR } from "../data/schemes.js";
import StatusBadge from "../components/StatusBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import EmptyState from "../components/EmptyState.jsx";

// Where each "next step" points, plus the label key to describe it.
const NEXT_STEP = {
  recommender: { to: "/schemes", key: "dash.next.recommender" },
  emi: { to: "/emi", key: "dash.next.emi" },
  partners: { to: "/partners", key: "dash.next.partners" },
  application: { to: "/schemes", key: "dash.next.application" },
  track: { to: "/applications", key: "dash.next.track" },
};

export default function Dashboard() {
  const t = useT();
  const { data, loading, error } = useFetch((opts) => dashboardApi.get(opts), []);

  if (loading) return <LoadingSpinner size="lg" label={t("common.loading")} />;
  if (error) {
    return (
      <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
        {error.message}
      </div>
    );
  }
  if (!data) return null;

  const { user, profile, stats, savedSchemes = [], applications = [] } = data;
  const next = NEXT_STEP[data.nextStep] ?? NEXT_STEP.track;

  const profileBits = [profile?.state, profile?.district].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="card bg-gradient-to-r from-navy-700 to-navy-900 text-white">
        <div className="text-sm text-slate-200">{t("dash.welcome")}</div>
        <div className="text-2xl font-bold">{user?.name}</div>
        {profileBits && <div className="text-slate-200 mt-1">{profileBits}</div>}
      </div>

      {/* Headline stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">{t("dash.stat.applications")}</div>
          <div className="text-3xl font-bold text-navy-900">{stats?.total ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">{t("dash.stat.approved")}</div>
          <div className="text-3xl font-bold text-leaf-600">
            {formatINR(stats?.amountApproved ?? 0)}
          </div>
        </div>
        <Link to={next.to} className="card hover:border-navy-300 transition">
          <div className="text-sm text-slate-500">{t("dash.stat.nextStep")}</div>
          <div className="text-base font-semibold text-slate-800 mt-1">{t(next.key)}</div>
        </Link>
      </div>

      {/* Saved schemes */}
      {savedSchemes.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-navy-900 text-lg mb-3">{t("dash.saved")}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {savedSchemes.map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-lg p-3">
                <div className="font-semibold text-navy-900">{s.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.nodalAgency}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {formatINR(s.loan.min)} – {formatINR(s.loan.max)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent applications */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-navy-900 text-lg">{t("dash.myApps")}</h2>
          {applications.length > 0 && (
            <Link to="/applications" className="text-sm font-semibold text-navy-700 hover:underline">
              {t("dash.viewAll")}
            </Link>
          )}
        </div>
        {applications.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t("dash.empty.title")}
            description={t("dash.empty.desc")}
            action={
              <Link to="/schemes" className="btn-primary">
                {t("dash.empty.cta")}
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3">
            {applications.map((a) => (
              <Link
                key={a.id}
                to={`/applications/${a.id}`}
                className="border border-slate-200 rounded-lg p-3 hover:border-navy-300 transition flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-navy-900 truncate">{a.schemeName}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{a.referenceNo}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-500">{t("app.amount")}</div>
                  <div className="font-semibold text-slate-800">
                    {formatINR(a.amountRequested)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link to="/schemes" className="btn-primary flex-1">
          {t("dash.action.find")}
        </Link>
        <Link to="/emi" className="btn-ghost flex-1">
          {t("dash.action.emi")}
        </Link>
      </div>
    </div>
  );
}
