// server/services/scenarios.js
// Saved EMI scenarios — the "compare two schemes" feature of the calculator,
// persisted per user instead of living in component state.

import { query, one, run, nowIso, newId } from "../db/index.js";
import { notFound } from "../utils/errors.js";
import { computeAmortization } from "./amortization.js";

const MAX_PER_USER = 20;

const rowToScenario = (row) => ({
  id: row.id,
  schemeId: row.scheme_id,
  schemeName: row.scheme_name ?? null,
  label: row.label,
  principal: row.principal,
  annualRate: row.annual_rate,
  tenureYears: row.tenure_years,
  moratoriumMonths: row.moratorium_months,
  emi: row.emi,
  totalInterest: row.total_interest,
  totalPayment: row.total_payment,
  createdAt: row.created_at,
});

const SELECT = `
  SELECT e.*, s.name AS scheme_name
  FROM emi_scenarios e
  LEFT JOIN schemes s ON s.id = e.scheme_id
`;

export function listScenarios(userId) {
  return query(`${SELECT} WHERE e.user_id = ? ORDER BY e.created_at DESC`, [userId]).map(
    rowToScenario
  );
}

export function saveScenario(userId, input) {
  const result = computeAmortization({
    principal: input.principal,
    annualRate: input.annualRate,
    tenureYears: input.tenureYears,
    moratoriumMonths: input.moratoriumMonths,
  });

  const id = newId();
  run(
    `INSERT INTO emi_scenarios (id, user_id, scheme_id, label, principal, annual_rate,
                                tenure_years, moratorium_months, emi, total_interest,
                                total_payment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.schemeId ?? null,
      input.label?.trim() || "Scenario",
      result.input.principal,
      result.input.annualRate,
      result.input.tenureYears,
      result.input.moratoriumMonths,
      result.emi,
      result.totalInterest,
      result.totalPayment,
      nowIso(),
    ]
  );

  // Keep the list bounded so a demo session cannot grow it without limit.
  run(
    `DELETE FROM emi_scenarios
      WHERE user_id = ?
        AND id NOT IN (
          SELECT id FROM emi_scenarios WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
        )`,
    [userId, userId, MAX_PER_USER]
  );

  return rowToScenario(one(`${SELECT} WHERE e.id = ?`, [id]));
}

export function deleteScenario(userId, id) {
  const row = one("SELECT id FROM emi_scenarios WHERE id = ? AND user_id = ?", [id, userId]);
  if (!row) throw notFound("Scenario not found", "scenario_not_found");
  run("DELETE FROM emi_scenarios WHERE id = ?", [id]);
  return { ok: true };
}
