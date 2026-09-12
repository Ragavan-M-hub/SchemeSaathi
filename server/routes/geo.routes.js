// server/routes/geo.routes.js
// Offline geocoder endpoints. Returning 200 with `place: null` (rather than 404)
// keeps "city not found" a normal UI state instead of a client-side error path.

import { Router } from "express";
import { z } from "zod";
import { validate, q } from "../middleware/validate.js";
import { lookupLocation, suggestPlaces } from "../services/geo.js";
import { markStep, saveProfile } from "../services/users.js";
import { optionalNumber } from "./_schemas.js";

export const geoRouter = Router();

const queryText = z.object({ q: z.string().trim().min(1).max(80) });

geoRouter.get("/geo/lookup", validate({ query: queryText }), (req, res) => {
  const place = lookupLocation(q(req).q);

  // Remember where a signed-in applicant is searching from, so the partner map
  // and their dashboard open in the right place next time.
  if (req.user && place) {
    saveProfile(req.user.id, { location: { lat: place.lat, lng: place.lng, label: place.label } });
    markStep(req.user.id, "partners");
  }

  res.json({ place, query: q(req).q });
});

geoRouter.get(
  "/geo/suggest",
  validate({
    query: z.object({
      q: z.string().trim().max(80).optional().default(""),
      limit: optionalNumber({ min: 1, max: 25, int: true }).default(8),
    }),
  }),
  (req, res) => {
    res.json({ places: suggestPlaces(q(req).q, q(req).limit) });
  }
);
