// server/routes/index.js
// Mounts every router under /api. Ordering matters only for the meta route
// below, which documents what the others expose.

import { Router } from "express";
import { adminRouter } from "./admin.routes.js";
import { applicationsRouter } from "./applications.routes.js";
import { authRouter } from "./auth.routes.js";
import { chatRouter } from "./chat.routes.js";
import { contentRouter } from "./content.routes.js";
import { dashboardRouter } from "./dashboard.routes.js";
import { emiRouter } from "./emi.routes.js";
import { geoRouter } from "./geo.routes.js";
import { healthRouter } from "./health.routes.js";
import { partnersRouter } from "./partners.routes.js";
import { profileRouter } from "./profile.routes.js";
import { recommendationsRouter } from "./recommendations.routes.js";
import { schemesRouter } from "./schemes.routes.js";

export const apiRouter = Router();

apiRouter.use(
  healthRouter,
  authRouter,
  schemesRouter,
  recommendationsRouter,
  emiRouter,
  partnersRouter,
  geoRouter,
  contentRouter,
  dashboardRouter,
  chatRouter
);

// These three guard *every* path with a router-level requireAuth/requireRole,
// so they must be mounted under an explicit prefix. Mounted bare (at "/"), that
// blanket middleware would also run for unrelated /api paths and turn unknown
// routes into 401/403s instead of letting them fall through to notFoundHandler.
apiRouter.use("/profile", profileRouter);
apiRouter.use("/applications", applicationsRouter);
apiRouter.use("/admin", adminRouter);

/** Self-describing index, handy when poking at the API by hand. */
apiRouter.get("/", (_req, res) => {
  res.json({
    name: "SchemeSaathi API",
    version: 1,
    endpoints: {
      health: "GET /api/health",
      auth: [
        "POST /api/auth/register",
        "POST /api/auth/login",
        "POST /api/auth/logout",
        "GET /api/auth/me",
        "PATCH /api/auth/me",
        "POST /api/auth/change-password",
      ],
      schemes: ["GET /api/schemes", "GET /api/schemes/eligible-types", "GET /api/schemes/:id"],
      recommendations: [
        "POST /api/recommendations",
        "GET /api/recommendations",
        "GET /api/recommendations/latest",
      ],
      emi: [
        "POST /api/emi/calculate",
        "GET /api/emi/scenarios",
        "POST /api/emi/scenarios",
        "DELETE /api/emi/scenarios/:id",
      ],
      partners: ["GET /api/partners", "GET /api/partners/summary", "GET /api/partners/:id"],
      geo: ["GET /api/geo/lookup?q=", "GET /api/geo/suggest?q="],
      content: ["GET /api/glossary?lang=", "GET /api/personas?lang="],
      profile: [
        "GET /api/profile",
        "PATCH /api/profile",
        "DELETE /api/profile",
        "POST /api/profile/steps/:step",
        "POST /api/profile/saved-schemes",
        "DELETE /api/profile/saved-schemes/:schemeId",
      ],
      applications: [
        "GET /api/applications",
        "POST /api/applications",
        "GET /api/applications/stats",
        "GET /api/applications/:id",
        "PATCH /api/applications/:id",
        "POST /api/applications/:id/transitions",
        "PATCH /api/applications/:id/documents/:documentId",
      ],
      dashboard: "GET /api/dashboard",
      chat: "POST /api/chat",
      admin: ["GET /api/admin/overview", "GET /api/admin/queue", "GET /api/admin/users"],
    },
  });
});
