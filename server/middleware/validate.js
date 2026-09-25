// server/middleware/validate.js
// zod-backed request validation. `safeParse` keeps validation failures on the
// normal error path (400 + field details) instead of throwing raw ZodErrors,
// and the parsed value replaces the raw one so handlers get coerced types.

import { badRequest } from "../utils/errors.js";

const flatten = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));

/**
 * @param {{body?: import("zod").ZodTypeAny, query?: import("zod").ZodTypeAny, params?: import("zod").ZodTypeAny}} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    for (const part of ["params", "query", "body"]) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(
          badRequest("Some fields need attention", "validation_failed", {
            in: part,
            issues: flatten(result.error),
          })
        );
      }
      // Express 5 exposes req.query via a getter, so assign to a plain field.
      if (part === "query") req.validatedQuery = result.data;
      else req[part] = result.data;
    }
    next();
  };
}

/** Handlers read query params through this so coercion is never skipped. */
export const q = (req) => req.validatedQuery ?? req.query ?? {};
