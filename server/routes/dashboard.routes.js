// server/routes/dashboard.routes.js
// One request that fills the whole dashboard: profile, journey progress, saved
// schemes, the last recommender run (with its schemes resolved) and recent
// applications. The client renders it; it does not assemble it.

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { applicationStats, listApplications } from "../services/applications.js";
import { latestRun } from "../services/recommendations.js";
import { listScenarios } from "../services/scenarios.js";
import { getScheme, listSchemes } from "../services/schemes.js";
import { getProfile, listSavedSchemeIds } from "../services/users.js";

export const dashboardRouter = Router();

/** The next thing worth doing, so the UI can point at one clear action. */
function nextStep(profile, applicationCount) {
  const done = profile.stepsCompleted ?? {};
  if (!done.recommender) return "recommender";
  if (!done.emi) return "emi";
  if (!done.partners) return "partners";
  if (applicationCount === 0) return "application";
  return "track";
}

dashboardRouter.get("/dashboard", requireAuth, (req, res) => {
  const profile = getProfile(req.user.id);
  const savedSchemeIds = listSavedSchemeIds(req.user.id);
  const applications = listApplications({ userId: req.user.id, limit: 5 });
  const stats = applicationStats({ userId: req.user.id });
  const run = latestRun(req.user.id);

  res.json({
    user: req.user,
    profile,
    nextStep: nextStep(profile, stats.total),
    savedSchemes: savedSchemeIds.length > 0 ? listSchemes({ ids: savedSchemeIds }) : [],
    applications,
    stats,
    scenarios: listScenarios(req.user.id).slice(0, 5),
    recommendation: run
      ? {
          id: run.id,
          createdAt: run.createdAt,
          input: run.input,
          // Resolve ids to schemes here so the client needs no second request.
          top: run.results.slice(0, 3).map((result) => ({
            ...result,
            scheme: getScheme(result.schemeId),
          })),
        }
      : null,
  });
});
