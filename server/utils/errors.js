// server/utils/errors.js
// One error type for the whole API. Services throw these; the error middleware
// turns them into `{ error: { code, message, details } }` with the right status.
// Anything else that escapes is reported as a 500 with no internals leaked.

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export const badRequest = (message, code = "bad_request", details) =>
  new HttpError(400, code, message, details);

export const unauthorized = (message = "Sign in to continue", code = "unauthorized") =>
  new HttpError(401, code, message);

export const forbidden = (message = "You do not have access to this resource", code = "forbidden") =>
  new HttpError(403, code, message);

export const notFound = (message = "Not found", code = "not_found") =>
  new HttpError(404, code, message);

export const conflict = (message, code = "conflict", details) =>
  new HttpError(409, code, message, details);

export const tooManyRequests = (message = "Too many requests, please slow down") =>
  new HttpError(429, "rate_limited", message);
