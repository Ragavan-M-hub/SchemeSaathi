// server/routes/health.routes.js
// Liveness/readiness probe. Touches the database so a broken DB shows up as
// unhealthy rather than as a 200 with a broken app behind it.

import { Router } from "express";
import { one } from "../db/index.js";
import { env } from "../env.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  let database = "up";
  let schemes = 0;
  try {
    schemes = one("SELECT COUNT(*) AS count FROM schemes WHERE active = 1")?.count ?? 0;
  } catch {
    database = "down";
  }

  res.status(database === "up" ? 200 : 503).json({
    status: database === "up" ? "ok" : "degraded",
    env: env.NODE_ENV,
    database,
    schemes,
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});
