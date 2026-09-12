// server/utils/format.js
// Formatting helpers shared by services that build human-readable strings.
// Mirrors the client's `formatINR` exactly so server-rendered text (matcher
// reasons, application timeline notes) looks identical to client-rendered text.

export const formatINR = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const formatPercent = (n) => `${Number(n || 0)}%`;

/** 12 → "12 months", 1 → "1 month" */
export const formatMonths = (n) => `${n} month${Number(n) === 1 ? "" : "s"}`;
