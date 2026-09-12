// server/services/schemes.js
// Repository for the scheme catalogue. Keeps the wire format identical to the
// shape the React components already consume (loan.min/max, interest.min/max),
// so the client only had to swap its data source, not its rendering code.

import { query, one, parseJson } from "../db/index.js";

const SELECT = `
  SELECT id, name, nodal_agency, category, description,
         loan_min, loan_max, income_ceiling, interest_min, interest_max,
         moratorium_months, tenure_years, eligible_types, documents, apply_url,
         name_key, description_key, purposes, min_education, women_only, sort_order
  FROM schemes
`;

export function rowToScheme(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    nodalAgency: row.nodal_agency,
    category: row.category,
    description: row.description,
    loan: { min: row.loan_min, max: row.loan_max },
    incomeCeiling: row.income_ceiling,
    interest: { min: row.interest_min, max: row.interest_max },
    moratoriumMonths: row.moratorium_months,
    tenureYears: row.tenure_years,
    eligibleTypes: parseJson(row.eligible_types, []),
    documents: parseJson(row.documents, []),
    applyUrl: row.apply_url,
    nameKey: row.name_key,
    descriptionKey: row.description_key,
    purposes: parseJson(row.purposes, []),
    minEducation: row.min_education,
    womenOnly: Boolean(row.women_only),
  };
}

export function listSchemes({ category, purpose, q, maxIncome, ids } = {}) {
  const where = ["active = 1"];
  const params = [];

  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (maxIncome !== undefined && maxIncome !== null) {
    where.push("income_ceiling >= ?");
    params.push(maxIncome);
  }
  if (q) {
    where.push("(name LIKE ? OR description LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (Array.isArray(ids) && ids.length > 0) {
    where.push(`id IN (${ids.map(() => "?").join(", ")})`);
    params.push(...ids);
  }

  const rows = query(
    `${SELECT} WHERE ${where.join(" AND ")} ORDER BY sort_order, name`,
    params
  );

  const schemes = rows.map(rowToScheme);
  // `purposes` is a JSON column, so this predicate stays in JS rather than SQL.
  return purpose ? schemes.filter((s) => s.purposes.includes(purpose)) : schemes;
}

export function getScheme(id) {
  return rowToScheme(one(`${SELECT} WHERE id = ? AND active = 1`, [id]));
}

export function schemeExists(id) {
  return one("SELECT 1 AS ok FROM schemes WHERE id = ? AND active = 1", [id]) !== null;
}

/** Distinct project/course types across the catalogue, grouped by purpose. */
export function eligibleTypesByPurpose() {
  const grouped = {};
  for (const scheme of listSchemes()) {
    for (const purpose of scheme.purposes) {
      grouped[purpose] ??= new Set();
      for (const type of scheme.eligibleTypes) grouped[purpose].add(type);
    }
  }
  return Object.fromEntries(
    Object.entries(grouped).map(([purpose, set]) => [purpose, [...set].sort()])
  );
}
