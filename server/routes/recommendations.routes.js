// server/routes/recommendations.routes.js
// The matcher endpoint. Works for guests (nothing is stored against a user) and
// for signed-in applicants (the run is saved and the answers update the profile,
// so the journey survives a refresh or a device change).

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createRun, latestRun, listRuns } from "../services/recommendations.js";
import { markStep, saveProfile } from "../services/users.js";
import { matchInput } from "./_schemas.js";

export const recommendationsRouter = Router();

recommendationsRouter.post(
  "/recommendations",
  validate({ body: matchInput }),
  (req, res) => {
    const run = createRun(req.body, req.user?.id ?? null);

    if (req.user) {
      saveProfile(req.user.id, req.body);
      markStep(req.user.id, "recommender");
    }

    res.status(201).json({
      runId: run.id,
      input: run.input,
      ranked: run.ranked,
      all: run.all,
      excluded: run.excluded,
    });
  }
);

recommendationsRouter.get("/recommendations", requireAuth, (req, res) => {
  res.json({ runs: listRuns(req.user.id) });
});

recommendationsRouter.get("/recommendations/latest", requireAuth, (req, res) => {
  res.json({ run: latestRun(req.user.id) });
});
