// api/index.js
// Vercel serverless entry point. This does not duplicate any business logic —
// it just wraps the same Express app that `npm start` runs, so everything in
// server/ (routes, services, middleware) is shared unmodified.
//
// Two things are specific to running Express as a Vercel Function:
//
// 1. There is no long-running `app.listen()`. Vercel invokes this default
//    export per request; we build the Express app once (module scope is
//    reused across invocations on a warm instance) and hand it the req/res.
//
// 2. SQLite needs a writable file, and Vercel's deployed bundle is read-only
//    outside of /tmp (see server/env.js — DB_PATH already points at
//    /tmp/schemesaathi.db here). /tmp starts empty on every cold start and
//    is not shared across concurrent instances, so the first request on a
//    fresh instance seeds the scheme catalogue (and, if SEED_DEMO_USERS is
//    on, the demo accounts) before falling through to the app.
//
// Caveat: this makes writes (registrations, applications, admin edits)
// durable only for the lifetime of that one warm instance, not across cold
// starts or between concurrent instances — fine for a demo, not for real
// production data. For that, swap server/db for a hosted database (e.g.
// Turso/libSQL, Neon/Postgres) reachable over the network instead of a local
// file; the rest of the app (routes/services) talks to server/db's query
// helpers and would not need to change.

import { createApp } from "../server/app.js";
import { env } from "../server/env.js";
import { one } from "../server/db/index.js";
import { seedAll } from "../server/db/seed.js";

let app;
let seeding;

function getApp() {
  // createApp() calls migrate() internally, which is cheap and idempotent
  // (CREATE TABLE ... IF NOT EXISTS), so it's safe to build lazily like this.
  if (!app) app = createApp();
  return app;
}

/** Seeds the catalogue (+ demo accounts) once per instance, only if empty. */
function ensureSeeded() {
  if (!seeding) {
    seeding = (async () => {
      const count = one("SELECT COUNT(*) AS count FROM schemes")?.count ?? 0;
      if (count === 0) {
        await seedAll({ demoUsers: env.SEED_DEMO_USERS });
      }
    })().catch((err) => {
      // Let the next request try again instead of leaving this instance
      // permanently "seeded" with an error.
      seeding = null;
      throw err;
    });
  }
  return seeding;
}

export default async function handler(req, res) {
  const expressApp = getApp();
  await ensureSeeded();
  expressApp(req, res);
}
