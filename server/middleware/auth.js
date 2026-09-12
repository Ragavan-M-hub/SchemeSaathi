// server/middleware/auth.js
// JWT auth. The token is issued in an httpOnly cookie (the browser path, with
// the Vite dev proxy keeping it same-origin) and also accepted as
// `Authorization: Bearer <token>` so curl and split-host clients work.

import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { findUserById, publicUser } from "../services/users.js";
import { forbidden, unauthorized } from "../utils/errors.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: env.CROSS_SITE_COOKIES ? "none" : "lax",
  // SameSite=None is only honoured on secure cookies.
  secure: env.CROSS_SITE_COOKIES || env.isProd,
  path: "/",
  maxAge: SEVEN_DAYS_MS,
});

export function setAuthCookie(res, token) {
  res.cookie(env.COOKIE_NAME, token, cookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie(env.COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

function readToken(req) {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return req.cookies?.[env.COOKIE_NAME] ?? null;
}

/**
 * Populates `req.user` when a valid token is present. Never rejects — public
 * endpoints stay public, and personalised ones simply see a null user.
 */
export function attachUser(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const row = findUserById(payload.sub);
    // A token for a deleted user is treated as no token at all.
    if (row) req.user = publicUser(row);
  } catch {
    // Expired or tampered token: ignore it rather than 401-ing a public route.
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

/** requireRole("officer", "admin") — admins are allowed wherever officers are. */
export function requireRole(...roles) {
  const allowed = new Set(roles);
  if (allowed.has("officer")) allowed.add("admin");
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowed.has(req.user.role)) {
      return next(forbidden("This area is restricted to " + roles.join(" / ") + " accounts"));
    }
    next();
  };
}
