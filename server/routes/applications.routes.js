// server/routes/applications.routes.js
// The loan-application workflow. Applicants see their own applications;
// officers and admins see every application. Status changes go through the
// service's state machine, never by writing `status` directly.

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate, q } from "../middleware/validate.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  DOC_STATUS,
  STATUS,
  applicationStats,
  createApplication,
  getApplication,
  listApplications,
  transitionApplication,
  updateApplication,
  updateDocument,
} from "../services/applications.js";
import { markStep } from "../services/users.js";
import { id, optionalBool, optionalNumber, optionalString } from "./_schemas.js";

export const applicationsRouter = Router();

applicationsRouter.use(requireAuth);

const isOfficer = (user) => user.role === "officer" || user.role === "admin";
const statusEnum = z.enum(Object.values(STATUS));

applicationsRouter.get(
  "/",
  validate({
    query: z.object({
      status: z.preprocess((v) => (v === "" ? undefined : v), statusEnum.optional()),
      schemeId: optionalString(64),
      q: optionalString(80),
      mine: optionalBool.default(false),
      limit: optionalNumber({ min: 1, max: 200, int: true }).default(100),
    }),
  }),
  (req, res) => {
    const filters = q(req);
    // An officer sees the whole pipeline unless they explicitly ask for `mine`.
    const scopeToUser = !isOfficer(req.user) || filters.mine;

    const applications = listApplications({
      ...filters,
      userId: scopeToUser ? req.user.id : undefined,
    });
    res.json({ applications, count: applications.length });
  }
);

applicationsRouter.get("/stats", (req, res) => {
  res.json({
    mine: applicationStats({ userId: req.user.id }),
    ...(isOfficer(req.user) ? { all: applicationStats() } : {}),
  });
});

const createBody = z.object({
  schemeId: id,
  partnerId: optionalString(64),
  amountRequested: optionalNumber({ min: 1000, max: 1e9, int: true }),
  tenureYears: optionalNumber({ min: 1, max: 30, int: true }),
  interestRate: optionalNumber({ min: 0, max: 100 }),
  moratoriumMonths: optionalNumber({ min: 0, max: 360, int: true }),
  purposeNote: optionalString(500),
});

applicationsRouter.post(
  "/",
  writeLimiter,
  validate({ body: createBody }),
  (req, res) => {
    const application = createApplication(req.user.id, req.body);
    markStep(req.user.id, "application");
    res.status(201).json({ application });
  }
);

applicationsRouter.get("/:id", validate({ params: z.object({ id }) }), (req, res) => {
  res.json({ application: getApplication(req.params.id, req.user) });
});

applicationsRouter.patch(
  "/:id",
  validate({ params: z.object({ id }), body: createBody.omit({ schemeId: true }) }),
  (req, res) => {
    res.json({ application: updateApplication(req.params.id, req.body, req.user) });
  }
);

applicationsRouter.post(
  "/:id/transitions",
  writeLimiter,
  validate({
    params: z.object({ id }),
    body: z.object({ to: statusEnum, note: optionalString(500) }),
  }),
  (req, res) => {
    res.json({ application: transitionApplication(req.params.id, req.body, req.user) });
  }
);

applicationsRouter.patch(
  "/:id/documents/:documentId",
  validate({
    params: z.object({ id, documentId: id }),
    body: z.object({
      status: z.enum(Object.values(DOC_STATUS)).optional(),
      // No file bytes are stored — see the note in services/applications.js.
      fileName: optionalString(200),
      fileSize: optionalNumber({ min: 0, max: 50 * 1024 * 1024, int: true }),
      note: optionalString(300),
    }),
  }),
  (req, res) => {
    res.json({
      application: updateDocument(req.params.id, req.params.documentId, req.body, req.user),
    });
  }
);
