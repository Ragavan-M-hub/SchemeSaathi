// server/routes/profile.routes.js
// The applicant's saved journey: recommender answers, which steps are done,
// their location, and shortlisted schemes. This is the server-side replacement
// for the localStorage-only journey in the original prototype.

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { badRequest } from "../utils/errors.js";
import { schemeExists } from "../services/schemes.js";
import {
  getProfile,
  listSavedSchemeIds,
  markStep,
  saveProfile,
  saveScheme,
  unsaveScheme,
} from "../services/users.js";
import {
  EDUCATIONS,
  GENDERS,
  PURPOSES,
  id,
  locationInput,
  optionalNumber,
  optionalString,
} from "./_schemas.js";

export const profileRouter = Router();

profileRouter.use(requireAuth);

const STEPS = ["recommender", "emi", "partners", "application"];

const profileBody = z.object({
  purpose: z.preprocess((v) => (v === "" ? undefined : v), z.enum(PURPOSES).optional()),
  projectType: optionalString(120),
  cost: optionalNumber({ min: 0, max: 1e9, int: true }),
  income: optionalNumber({ min: 0, max: 1e9, int: true }),
  education: z.preprocess((v) => (v === "" ? undefined : v), z.enum(EDUCATIONS).optional()),
  gender: z.preprocess((v) => (v === "" ? undefined : v), z.enum(GENDERS).optional()),
  location: locationInput,
  stepsCompleted: z.record(z.enum(STEPS), z.boolean()).optional(),
});

profileRouter.get("/", (req, res) => {
  res.json({
    profile: getProfile(req.user.id),
    savedSchemeIds: listSavedSchemeIds(req.user.id),
  });
});

profileRouter.patch("/", validate({ body: profileBody }), (req, res) => {
  res.json({ profile: saveProfile(req.user.id, req.body) });
});

profileRouter.post(
  "/steps/:step",
  validate({ params: z.object({ step: z.enum(STEPS) }) }),
  (req, res) => {
    res.json({ profile: markStep(req.user.id, req.params.step) });
  }
);

/** Reset the journey without deleting the account or its applications. */
profileRouter.delete("/", (req, res) => {
  res.json({
    profile: saveProfile(req.user.id, {
      purpose: null,
      projectType: null,
      cost: null,
      income: null,
      education: null,
      gender: null,
      location: null,
      stepsCompleted: {},
    }),
  });
});

profileRouter.post(
  "/saved-schemes",
  validate({ body: z.object({ schemeId: id }) }),
  (req, res) => {
    if (!schemeExists(req.body.schemeId)) throw badRequest("Unknown scheme", "scheme_not_found");
    res.status(201).json({ savedSchemeIds: saveScheme(req.user.id, req.body.schemeId) });
  }
);

profileRouter.delete(
  "/saved-schemes/:schemeId",
  validate({ params: z.object({ schemeId: id }) }),
  (req, res) => {
    res.json({ savedSchemeIds: unsaveScheme(req.user.id, req.params.schemeId) });
  }
);
