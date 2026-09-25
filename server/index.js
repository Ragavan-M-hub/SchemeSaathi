// server/index.js
// Process entry point: migrate, warn about anything unsafe, listen, and shut
// down cleanly so the SQLite file is always closed properly.

import { createApp } from "./app.js";
import { env, usingDevJwtSecret } from "./env.js";
import { closeDb, one } from "./db/index.js";

const app = createApp();

if (usingDevJwtSecret) {
  console.warn("[server] using the built-in development JWT secret — set JWT_SECRET before deploying");
}

const schemeCount = one("SELECT COUNT(*) AS count FROM schemes")?.count ?? 0;
if (schemeCount === 0) {
  console.warn("[server] no schemes found — run `npm run db:seed` to load the catalogue");
}

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`SchemeSaathi API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  console.log(`  database: ${env.DB_PATH}`);
  if (env.SERVE_CLIENT) console.log(`  serving client from: ${env.CLIENT_DIST}`);
  else console.log(`  client dev server: http://localhost:5173 (proxies /api here)`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} received, closing…`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Do not hang forever on a stuck keep-alive connection.
  setTimeout(() => {
    closeDb();
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
