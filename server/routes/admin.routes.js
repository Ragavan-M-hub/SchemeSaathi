// server/routes/admin.routes.js
// Officer / admin console. Officers get the review queue and pipeline numbers;
// the user list is admin-only, since it exposes contact details.

import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate, q } from "../middleware/validate.js";
import { one } from "../db/index.js";
import { applicationStats, reviewQueue } from "../services/applications.js";
import { partnerSummary } from "../services/partners.js";
import { runSummary } from "../services/recommendations.js";
import { listUsers } from "../services/users.js";
import { optionalNumber, optionalString } from "./_schemas.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("officer"));

adminRouter.get("/overview", (_req, res) => {
  const counts = one(
    `SELECT (SELECT COUNT(*) FROM users)               AS users,
            (SELECT COUNT(*) FROM applications)        AS applications,
            (SELECT COUNT(*) FROM schemes WHERE active = 1)  AS schemes,
            (SELECT COUNT(*) FROM partners WHERE active = 1) AS partners,
            (SELECT COUNT(*) FROM recommendation_runs) AS runs`
  );

  res.json({
    counts,
    applications: applicationStats(),
    partners: partnerSummary(),
    recommendations: runSummary(),
  });
});

adminRouter.get(
  "/queue",
  validate({ query: z.object({ limit: optionalNumber({ min: 1, max: 200, int: true }).default(50) }) }),
  (req, res) => {
    const applications = reviewQueue({ limit: q(req).limit });
    res.json({ applications, count: applications.length });
  }
);

adminRouter.get(
  "/users",
  requireRole("admin"),
  validate({
    query: z.object({
      role: optionalString(20),
      limit: optionalNumber({ min: 1, max: 500, int: true }).default(100),
    }),
  }),
  (req, res) => {
    const users = listUsers(q(req));
    res.json({ users, count: users.length });
  }
);
