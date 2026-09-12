// server/env.js
// Central place for configuration. Reads .env (if present) and falls back to
// safe development defaults. Anything security-sensitive refuses to use a
// default in production.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, "..");

dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });

const bool = (v, fallback = false) =>
  v === undefined ? fallback : /^(1|true|yes|on)$/i.test(String(v));

const int = (v, fallback) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

const DEV_JWT_SECRET = "schemesaathi-dev-secret-do-not-use-in-production";

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (isProd) {
    throw new Error(
      "JWT_SECRET is required when NODE_ENV=production. Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  return DEV_JWT_SECRET;
}

// ":memory:" is honoured for tests; otherwise the DB lives next to the repo.
function resolveDbPath() {
  const raw = process.env.DB_PATH || (isTest ? ":memory:" : "./data/schemesaathi.db");
  if (raw === ":memory:") return raw;
  const abs = path.isAbsolute(raw) ? raw : path.join(ROOT_DIR, raw);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return abs;
}

export const env = {
  NODE_ENV,
  isProd,
  isTest,
  isDev: !isProd && !isTest,

  PORT: int(process.env.PORT, 4000),
  HOST: process.env.HOST || "0.0.0.0",

  DB_PATH: resolveDbPath(),

  GROQ_API_KEY: process.env.GROQ_API_KEY || "",

  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  COOKIE_NAME: process.env.COOKIE_NAME || "ss_token",
  // Split-host deployments (e.g. Vercel + Render) need SameSite=None; Secure.
  CROSS_SITE_COOKIES: bool(process.env.CROSS_SITE_COOKIES, false),
  BCRYPT_ROUNDS: int(process.env.BCRYPT_ROUNDS, isTest ? 4 : 10),

  // Comma-separated list. Requests with no Origin header (curl, same-origin) pass.
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Serve the built SPA from the API process (single-service deploys).
  SERVE_CLIENT: bool(process.env.SERVE_CLIENT, isProd),
  CLIENT_DIST: path.join(ROOT_DIR, "dist"),

  SEED_DEMO_USERS: bool(process.env.SEED_DEMO_USERS, !isProd),
  DEMO_PASSWORD: process.env.DEMO_PASSWORD || "demo1234",
  LOG_LEVEL: process.env.LOG_LEVEL || (isTest ? "silent" : "dev"),
};

export const usingDevJwtSecret = env.JWT_SECRET === DEV_JWT_SECRET;
