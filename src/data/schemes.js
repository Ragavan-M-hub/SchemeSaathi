// src/data/schemes.js
// The scheme catalogue now lives on the server (see server/data/schemes.js and
// the /schemes API). The only piece still needed client-side is the shared INR
// formatter used across pages for display.

export const formatINR = (n) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
