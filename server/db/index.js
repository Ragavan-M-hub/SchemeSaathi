// server/db/index.js
// Thin wrapper over node:sqlite (built into Node 22.5+ / stable in 24+).
// Using the built-in driver keeps the project free of native build steps —
// `npm install` works the same on Windows, macOS, Linux and CI.

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, "schema.sql");

let db = null;
const stmtCache = new Map();

export function getDb() {
  if (db) return db;

  db = new DatabaseSync(env.DB_PATH);
  db.exec("PRAGMA foreign_keys = ON");
  if (env.DB_PATH !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL");
  }
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

/** Applies schema.sql. Idempotent — every statement is CREATE ... IF NOT EXISTS. */
export function migrate() {
  const conn = getDb();
  conn.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [
    "schema_applied_at",
    nowIso(),
  ]);
  return conn;
}

export function closeDb() {
  stmtCache.clear();
  if (db) {
    db.close();
    db = null;
  }
}

// node:sqlite only binds null | number | bigint | string | Uint8Array, so
// booleans and undefined (both easy to produce from JSON bodies) are mapped here
// rather than at every call site.
function normalize(params) {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    return p;
  });
}

function prepare(sql) {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = getDb().prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

// Rows arrive as null-prototype objects; copying them keeps downstream code
// (spread, hasOwnProperty, JSON) predictable.
const plain = (row) => (row ? { ...row } : row);

export function query(sql, params = []) {
  return prepare(sql).all(...normalize(params)).map(plain);
}

export function one(sql, params = []) {
  const row = prepare(sql).get(...normalize(params));
  return row === undefined ? null : plain(row);
}

export function run(sql, params = []) {
  return prepare(sql).run(...normalize(params));
}

export function exists(sql, params = []) {
  return one(sql, params) !== null;
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export function tx(fn) {
  const conn = getDb();
  conn.exec("BEGIN");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      conn.exec("ROLLBACK");
    } catch {
      // A failed rollback means the tx was already closed — surface the original error.
    }
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();
export const newId = () => randomUUID();

export function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
