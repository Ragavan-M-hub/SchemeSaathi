// server/routes/emi.routes.js
// EMI calculation runs on the server so the client and the officer console can
// never disagree about a number, and so saved scenarios store a result that was
// produced by exactly one implementation.

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { amortizationWarnings, computeAmortization } from "../services/amortization.js";
import { getScheme } from "../services/schemes.js";
import { deleteScenario, listScenarios, saveScenario } from "../services/scenarios.js";
import { markStep } from "../services/users.js";
import { emiInput, id, optionalBool, optionalString } from "./_schemas.js";

export const emiRouter = Router();

emiRouter.post(
  "/emi/calculate",
  validate({
    body: emiInput.extend({
      // The month-by-month table is large; the summary cards do not need it.
      includeSchedule: optionalBool.default(true),
    }),
  }),
  (req, res) => {
    const { schemeId, includeSchedule, ...terms } = req.body;
    const scheme = schemeId ? getScheme(schemeId) : null;
    const result = computeAmortization(terms);

    if (req.user) markStep(req.user.id, "emi");

    res.json({
      ...result,
      schedule: includeSchedule ? result.schedule : undefined,
      warnings: amortizationWarnings(result.input, scheme),
      scheme: scheme ? { id: scheme.id, name: scheme.name } : null,
    });
  }
);

emiRouter.get("/emi/scenarios", requireAuth, (req, res) => {
  res.json({ scenarios: listScenarios(req.user.id) });
});

emiRouter.post(
  "/emi/scenarios",
  requireAuth,
  writeLimiter,
  validate({ body: emiInput.extend({ label: optionalString(60) }) }),
  (req, res) => {
    res.status(201).json({ scenario: saveScenario(req.user.id, req.body) });
  }
);

emiRouter.delete(
  "/emi/scenarios/:id",
  requireAuth,
  validate({ params: z.object({ id }) }),
  (req, res) => {
    res.json(deleteScenario(req.user.id, req.params.id));
  }
);
