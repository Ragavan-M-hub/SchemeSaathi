// server/routes/auth.routes.js
// Register / login / logout / whoami. The token goes out as an httpOnly cookie
// *and* in the JSON body: browsers use the cookie (same-origin through the Vite
// proxy), while curl and native clients can send `Authorization: Bearer`.

import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
} from "../middleware/auth.js";
import {
  changePassword,
  createUser,
  publicUser,
  updateUser,
  verifyCredentials,
} from "../services/users.js";
import { LANGS, optionalString } from "./_schemas.js";

export const authRouter = Router();

const password = z.string().min(8, "Use at least 8 characters").max(128);
const email = z.string().trim().toLowerCase().email("Enter a valid email address");

const registerBody = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email,
  password,
  phone: optionalString(20),
  state: optionalString(60),
  district: optionalString(60),
  preferredLang: z.enum(LANGS).optional().default("en"),
});

authRouter.post(
  "/auth/register",
  authLimiter,
  validate({ body: registerBody }),
  async (req, res) => {
    // Role is deliberately not accepted from the body — officers and admins are
    // created by the seeder, not by self-registration.
    const user = await createUser({ ...req.body, role: "applicant" });
    const token = signToken(user);
    setAuthCookie(res, token);
    res.status(201).json({ user, token });
  }
);

authRouter.post(
  "/auth/login",
  authLimiter,
  validate({ body: z.object({ email, password: z.string().min(1) }) }),
  async (req, res) => {
    const row = await verifyCredentials(req.body.email, req.body.password);
    const user = publicUser(row);
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ user, token });
  }
);

authRouter.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/auth/me", (req, res) => {
  res.json({ user: req.user ?? null });
});

authRouter.patch(
  "/auth/me",
  requireAuth,
  validate({
    body: z.object({
      name: z.string().trim().min(2).max(80).optional(),
      phone: optionalString(20),
      state: optionalString(60),
      district: optionalString(60),
      preferredLang: z.enum(LANGS).optional(),
    }),
  }),
  (req, res) => {
    res.json({ user: updateUser(req.user.id, req.body) });
  }
);

authRouter.post(
  "/auth/change-password",
  requireAuth,
  authLimiter,
  validate({
    body: z.object({ currentPassword: z.string().min(1), newPassword: password }),
  }),
  async (req, res) => {
    await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ ok: true });
  }
);
