// server/db/migrate.js
// Applies schema.sql. Safe to run repeatedly — every statement is
// CREATE TABLE / CREATE INDEX ... IF NOT EXISTS.
//
//   npm run db:migrate

import { pathToFileURL } from "node:url";
import { env } from "../env.js";
import { migrate, closeDb, one } from "./index.js";

export function runMigrations() {
  migrate();
  const tables = one(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  return { dbPath: env.DB_PATH, tables: tables?.count ?? 0 };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const result = runMigrations();
  console.log(`✔ schema applied to ${result.dbPath} (${result.tables} tables)`);
  closeDb();
}
