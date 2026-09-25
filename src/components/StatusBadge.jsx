// src/components/StatusBadge.jsx
// Colour-coded pill for an application status. Colours map to the state machine
// in server/services/applications.js so the same status always reads the same.

import { useT } from "../i18n/LanguageContext.jsx";

const STYLES = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-sky-100 text-sky-700",
  under_review: "bg-saffron-500/10 text-saffron-600",
  documents_pending: "bg-amber-100 text-amber-700",
  approved: "bg-leaf-500/10 text-leaf-600",
  rejected: "bg-red-100 text-red-700",
  disbursed: "bg-emerald-100 text-emerald-700",
  withdrawn: "bg-slate-200 text-slate-500",
};

export default function StatusBadge({ status }) {
  const t = useT();
  const cls = STYLES[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {t(`status.${status}`)}
    </span>
  );
}
