// src/pages/ApplicationDetail.jsx
// One application in full: loan terms, the document checklist (with role-aware
// actions), the status-change controls the server says this actor may use, and
// the append-only event timeline.

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { applicationsApi, ApiError } from "../lib/api.js";
import { useFetch } from "../hooks/useFetch.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useT } from "../i18n/LanguageContext.jsx";
import { formatINR } from "../data/schemes.js";
import StatusBadge from "../components/StatusBadge.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx";

const DOC_STYLES = {
  pending: "bg-slate-100 text-slate-600",
  uploaded: "bg-sky-100 text-sky-700",
  verified: "bg-leaf-500/10 text-leaf-600",
  rejected: "bg-red-100 text-red-700",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const t = useT();
  const { isOfficer } = useAuth();

  const { data, loading, error, setData } = useFetch(
    (opts) => applicationsApi.get(id, opts),
    [id]
  );

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const app = data?.application;

  const runTransition = async (to) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await applicationsApi.transition(id, { to, note: note || undefined });
      setData(res);
      setNote("");
    } catch (err) {
      setActionError(describeError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const runDocUpdate = async (documentId, status) => {
    setBusy(true);
    setActionError(null);
    try {
      // No real file bytes — the demo records upload metadata only.
      const payload =
        status === "uploaded"
          ? { status, fileName: "document.pdf", fileSize: 240000 }
          : { status };
      const res = await applicationsApi.updateDocument(id, documentId, payload);
      setData(res);
    } catch (err) {
      setActionError(describeError(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" label={t("common.loading")} />;
  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/applications" className="text-navy-700 text-sm font-semibold hover:underline">
          {t("app.back")}
        </Link>
        <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
          {error.message}
        </div>
      </div>
    );
  }
  if (!app) return null;

  return (
    <div className="space-y-6">
      <Link to="/applications" className="text-navy-700 text-sm font-semibold hover:underline">
        {t("app.back")}
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-navy-900">{app.schemeName}</h1>
            <div className="text-sm text-slate-500 mt-1">
              {t("app.ref")}: {app.referenceNo}
              {app.partnerName ? ` · ${app.partnerName}` : ""}
            </div>
            {isOfficer && app.applicantName && (
              <div className="text-sm text-slate-500 mt-0.5">
                {t("admin.applicant")}: {app.applicantName} ({app.applicantEmail})
              </div>
            )}
          </div>
          <StatusBadge status={app.status} />
        </div>
      </div>

      {/* Loan terms */}
      <div className="card">
        <h2 className="font-bold text-navy-900 mb-3">{t("app.detail.terms")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Term label={t("app.amount")} value={formatINR(app.amountRequested)} />
          <Term label={t("app.emi")} value={`${formatINR(app.emi)}/mo`} />
          <Term
            label={t("app.detail.tenure")}
            value={`${app.tenureYears} ${t("app.detail.years")}`}
          />
          <Term label={t("app.detail.rate")} value={`${app.interestRate}%`} />
          <Term
            label={t("app.detail.moratorium")}
            value={`${app.moratoriumMonths} ${t("app.detail.months")}`}
          />
          <Term label={t("app.submitted")} value={formatDate(app.submittedAt)} />
          <Term label={t("app.created")} value={formatDate(app.createdAt)} />
          {app.amortization && (
            <Term label={t("emi.totalInterest")} value={formatINR(app.amortization.totalInterest)} />
          )}
        </div>
        {app.purposeNote && <p className="text-sm text-slate-600 mt-4">{app.purposeNote}</p>}
      </div>

      {actionError && (
        <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <h2 className="font-bold text-navy-900 mb-3">{t("app.detail.actions")}</h2>
        {app.missingDocuments.length > 0 && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            {t("app.detail.missing")} {app.missingDocuments.join(", ")}
          </div>
        )}
        {app.allowedTransitions.length === 0 ? (
          <p className="text-sm text-slate-500">{t("app.detail.noActions")}</p>
        ) : (
          <div className="space-y-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("app.detail.notePlaceholder")}
              className="input"
            />
            <div className="flex flex-wrap gap-2">
              {app.allowedTransitions.map((to) => (
                <button
                  key={to}
                  disabled={busy}
                  onClick={() => runTransition(to)}
                  className={`btn-primary !py-2 ${
                    to === "rejected" ? "!bg-red-600 hover:!bg-red-700" : ""
                  }`}
                >
                  → {t(`status.${to}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Document checklist */}
      <div className="card">
        <h2 className="font-bold text-navy-900 mb-3">{t("app.detail.checklist")}</h2>
        <div className="divide-y divide-slate-100">
          {app.documents.map((doc) => (
            <div key={doc.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{doc.name}</div>
                {doc.note && <div className="text-xs text-slate-500">{doc.note}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                    DOC_STYLES[doc.status] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t(`doc.${doc.status}`)}
                </span>
                {!isOfficer && doc.status !== "verified" && (
                  <button
                    disabled={busy}
                    onClick={() => runDocUpdate(doc.id, "uploaded")}
                    className="btn-ghost !py-1.5 !px-3 text-xs"
                  >
                    {t("app.detail.markUploaded")}
                  </button>
                )}
                {isOfficer && (
                  <>
                    <button
                      disabled={busy || doc.status === "verified"}
                      onClick={() => runDocUpdate(doc.id, "verified")}
                      className="btn-ghost !py-1.5 !px-3 text-xs text-leaf-600"
                    >
                      {t("app.detail.verify")}
                    </button>
                    <button
                      disabled={busy || doc.status === "rejected"}
                      onClick={() => runDocUpdate(doc.id, "rejected")}
                      className="btn-ghost !py-1.5 !px-3 text-xs text-red-600"
                    >
                      {t("app.detail.reject")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h2 className="font-bold text-navy-900 mb-3">{t("app.detail.timeline")}</h2>
        <ol className="space-y-3">
          {app.events.map((ev) => (
            <li key={ev.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-navy-700 mt-1.5" />
                <div className="flex-1 w-px bg-slate-200" />
              </div>
              <div className="pb-1">
                <div className="text-sm text-slate-800">
                  <StatusBadge status={ev.toStatus} />
                </div>
                {ev.note && <div className="text-sm text-slate-600 mt-1">{ev.note}</div>}
                <div className="text-xs text-slate-400 mt-1">
                  {formatDate(ev.createdAt)}
                  {ev.actorName ? ` · ${t("app.detail.by")} ${ev.actorName}` : ""}
                  {ev.actorRole ? ` (${ev.actorRole})` : ""}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Term({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function describeError(err, t) {
  if (err instanceof ApiError) {
    if (err.code === "documents_incomplete" && err.details?.missing) {
      return `${t("app.detail.missing")} ${err.details.missing.join(", ")}`;
    }
    return err.message;
  }
  return t("common.error");
}
