// server/middleware/error.js
// Single JSON error envelope: { error: { code, message, details? } }.
// Express 5 forwards rejected promises here automatically, so route handlers
// can be plain `async` functions without a try/catch wrapper.

import { env } from "../env.js";
import { HttpError } from "../utils/errors.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "route_not_found", message: `No API route for ${req.method} ${req.originalUrl}` },
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Body-parser rejects malformed JSON with a 400 and a `type` of its own.
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "invalid_json", message: "Request body is not valid JSON" } });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "payload_too_large", message: "Request body is too large" } });
  }
  if (err?.code === "CORS_NOT_ALLOWED") {
    return res.status(403).json({ error: { code: "cors_not_allowed", message: err.message } });
  }

  // Anything else is a bug: log it server-side, tell the client nothing useful.
  if (!env.isTest) console.error("[error]", err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Something went wrong on our side. Please try again.",
      ...(env.isProd ? {} : { details: { message: err?.message } }),
    },
  });
}
