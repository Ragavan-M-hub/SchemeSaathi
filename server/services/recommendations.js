// server/services/recommendations.js
// Persists every recommender run. Two reasons this is a table and not just a
// response: the dashboard can show "your last match" after a refresh or on a
// new device, and the admin console can see which purposes people actually ask
// for. Anonymous runs are allowed so guests can try the tool.

import { query, one, run, nowIso, newId, parseJson } from "../db/index.js";
import { matchSchemes } from "./matcher.js";

const rowToRun = (row) => ({
  id: row.id,
  userId: row.user_id,
  input: parseJson(row.input, {}),
  results: parseJson(row.results, []),
  createdAt: row.created_at,
});

/** Runs the matcher and stores a compact record of the outcome. */
export function createRun(input, userId = null) {
  const match = matchSchemes(input);
  const id = newId();
  const createdAt = nowIso();

  run(
    `INSERT INTO recommendation_runs (id, user_id, input, results, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      JSON.stringify(match.input),
      JSON.stringify(
        match.all.map((scheme) => ({
          schemeId: scheme.id,
          score: scheme.score,
          coveragePct: scheme.coveragePct,
          reasons: scheme.reasons,
        }))
      ),
      createdAt,
    ]
  );

  return { id, createdAt, ...match };
}

export function listRuns(userId, limit = 10) {
  return query(
    `SELECT * FROM recommendation_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  ).map(rowToRun);
}

export function latestRun(userId) {
  const row = one(
    `SELECT * FROM recommendation_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return row ? rowToRun(row) : null;
}

/** Which purposes are being requested — admin console analytics. */
export function runSummary() {
  return {
    total: one("SELECT COUNT(*) AS count FROM recommendation_runs")?.count ?? 0,
    byPurpose: query(
      `SELECT json_extract(input, '$.purpose') AS purpose, COUNT(*) AS count
         FROM recommendation_runs
        GROUP BY purpose
        ORDER BY count DESC`
    ),
    recent: query("SELECT * FROM recommendation_runs ORDER BY created_at DESC LIMIT 10").map(
      rowToRun
    ),
  };
}
