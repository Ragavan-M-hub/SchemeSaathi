// server/app.js
// Express app factory. Kept separate from index.js so tests can mount the app
// on an ephemeral port (or drive it in-process) without starting the real server.

import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./env.js";
import { migrate } from "./db/index.js";
import { attachUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { apiRouter } from "./routes/index.js";

function corsOptions() {
  return {
    // Cookies are only sent when the exact origin is echoed back, so the
    // allowlist is explicit rather than `*`.
    origin(origin, callback) {
      // No Origin header: same-origin navigation, curl, or a health probe.
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      const error = new Error(`Origin ${origin} is not allowed`);
      error.code = "CORS_NOT_ALLOWED";
      callback(error);
    },
    credentials: true,
  };
}

const csp = {
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    // Leaflet writes inline style attributes on its panes and markers.
    "style-src": ["'self'", "'unsafe-inline'"],
    // OpenStreetMap raster tiles are fetched from tile.openstreetmap.org.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "connect-src": ["'self'", "https:"],
    "font-src": ["'self'", "data:"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'self'"],
    // Left off so a plain http://localhost deploy is not force-upgraded.
    "upgrade-insecure-requests": null,
  },
};

export function createApp({ runMigrations = true } = {}) {
  if (runMigrations) migrate();

  const app = express();
  app.disable("x-powered-by");
  // Only trust proxy headers where there really is a proxy in front.
  app.set("trust proxy", env.isProd ? 1 : false);

  app.use(helmet({ contentSecurityPolicy: csp, crossOriginEmbedderPolicy: false }));
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  if (env.LOG_LEVEL !== "silent") app.use(morgan(env.LOG_LEVEL));

  app.use(attachUser);
  app.use("/api", apiLimiter, apiRouter);
  // Unknown /api paths must stay JSON — never fall through to the SPA shell.
  app.use("/api", notFoundHandler);

  if (env.SERVE_CLIENT) mountClient(app);

  app.use(errorHandler);
  return app;
}

/** Serves the built SPA (dist/) with a history-API fallback. */
function mountClient(app) {
  const indexHtml = path.join(env.CLIENT_DIST, "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.warn(
      `[server] SERVE_CLIENT is on but ${indexHtml} is missing — run \`npm run build\` first.`
    );
    return;
  }

  app.use(
    express.static(env.CLIENT_DIST, {
      // Hashed assets can be cached hard; index.html must not be.
      setHeaders(res, filePath) {
        if (filePath === indexHtml) res.setHeader("Cache-Control", "no-cache");
      },
      maxAge: "1y",
      index: false,
    })
  );

  // Express 5 dropped string wildcards from path-to-regexp, so the fallback is
  // plain middleware rather than app.get("*").
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
}
