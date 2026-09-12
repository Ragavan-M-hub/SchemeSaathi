// server/middleware/rateLimit.js
// Rate limits, disabled under NODE_ENV=test so the suite is not throttled.
// Login/register get a tighter bucket than reads: those are the endpoints worth
// brute-forcing.

import rateLimit from "express-rate-limit";
import { env } from "../env.js";

const passthrough = (_req, _res, next) => next();

const make = (options) =>
  env.isTest
    ? passthrough
    : rateLimit({
        standardHeaders: "draft-7",
        legacyHeaders: false,
        handler: (_req, res) =>
          res.status(429).json({
            error: { code: "rate_limited", message: options.message },
          }),
        ...options,
      });

export const apiLimiter = make({
  windowMs: 60_000,
  limit: 300,
  message: "Too many requests. Please wait a moment and try again.",
});

export const authLimiter = make({
  windowMs: 10 * 60_000,
  limit: 30,
  // Failed logins are what we care about; a successful sign-in should not count.
  skipSuccessfulRequests: true,
  message: "Too many attempts. Please wait a few minutes before trying again.",
});

export const writeLimiter = make({
  windowMs: 60_000,
  limit: 60,
  message: "Too many changes at once. Please slow down.",
});
