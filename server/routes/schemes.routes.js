// server/routes/schemes.routes.js
// The public catalogue. Read-only: the seeder owns scheme content.

import { Router } from "express";
import { z } from "zod";
import { validate, q } from "../middleware/validate.js";
import { notFound } from "../utils/errors.js";
import {
  eligibleTypesByPurpose,
  getScheme,
  listSchemes,
} from "../services/schemes.js";
import { listPartners } from "../services/partners.js";
import { id, optionalNumber, optionalString, PURPOSES } from "./_schemas.js";

export const schemesRouter = Router();

schemesRouter.get(
  "/schemes",
  validate({
    query: z.object({
      category: optionalString(30),
      purpose: z.preprocess((v) => (v === "" ? undefined : v), z.enum(PURPOSES).optional()),
      q: optionalString(80),
      maxIncome: optionalNumber({ min: 0, max: 1e9, int: true }),
    }),
  }),
  (req, res) => {
    const schemes = listSchemes(q(req));
    res.json({ schemes, count: schemes.length });
  }
);

/** Drives the recommender's "what kind of project?" step. */
schemesRouter.get("/schemes/eligible-types", (_req, res) => {
  res.json({ byPurpose: eligibleTypesByPurpose() });
});

schemesRouter.get("/schemes/:id", validate({ params: z.object({ id }) }), (req, res) => {
  const scheme = getScheme(req.params.id);
  if (!scheme) throw notFound("Scheme not found", "scheme_not_found");

  // The detail view always shows who can actually process this scheme.
  const { partners, excluded } = listPartners({ schemeId: scheme.id, sort: "health" });
  res.json({ scheme, partners, excludedPartners: excluded });
});
