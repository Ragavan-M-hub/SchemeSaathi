// server/routes/partners.routes.js
// Partner locator. Distance and the High-NPA exclusion are computed server-side
// so the "we filtered these out to protect you" list is authoritative.

import { Router } from "express";
import { z } from "zod";
import { validate, q } from "../middleware/validate.js";
import { notFound } from "../utils/errors.js";
import { getPartner, listPartners, partnerSummary } from "../services/partners.js";
import { markStep } from "../services/users.js";
import { id, optionalBool, optionalNumber, optionalString } from "./_schemas.js";

export const partnersRouter = Router();

const listQuery = z.object({
  schemeId: optionalString(64),
  type: optionalString(20),
  state: optionalString(60),
  lat: optionalNumber({ min: -90, max: 90 }),
  lng: optionalNumber({ min: -180, max: 180 }),
  sort: z
    .preprocess((v) => (v === "" ? undefined : v), z.enum(["distance", "health", "processing", "name"]).optional())
    .default("distance"),
  includeHighNpa: optionalBool.default(false),
});

partnersRouter.get("/partners", validate({ query: listQuery }), (req, res) => {
  const result = listPartners(q(req));
  if (req.user && result.origin) markStep(req.user.id, "partners");

  res.json({
    partners: result.partners,
    excluded: result.excluded,
    origin: result.origin,
    count: result.partners.length,
  });
});

partnersRouter.get("/partners/summary", (_req, res) => {
  res.json(partnerSummary());
});

partnersRouter.get("/partners/:id", validate({ params: z.object({ id }) }), (req, res) => {
  const partner = getPartner(req.params.id);
  if (!partner) throw notFound("Partner not found", "partner_not_found");
  res.json({ partner });
});
