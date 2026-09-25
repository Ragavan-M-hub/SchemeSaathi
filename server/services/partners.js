// server/services/partners.js
// Channel-partner repository. The locator's "High NPA lenders are excluded to
// protect you" rule lives here rather than in the UI, so every client (web,
// future mobile, an officer tool) applies the same safety filter.

import { query, one } from "../db/index.js";
import { HEALTH } from "../data/partners.data.js";
import { withDistance } from "./geo.js";

const HEALTH_RANK = { [HEALTH.HEALTHY]: 0, [HEALTH.CAUTION]: 1, [HEALTH.HIGH_NPA]: 2 };

const SELECT = `
  SELECT p.id, p.name, p.type, p.city, p.state, p.lat, p.lng, p.health,
         p.npa_percent, p.avg_processing_days, p.contact, p.url,
         (SELECT group_concat(ps.scheme_id)
            FROM partner_schemes ps WHERE ps.partner_id = p.id) AS scheme_ids
  FROM partners p
`;

export function rowToPartner(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    city: row.city,
    state: row.state,
    lat: row.lat,
    lng: row.lng,
    health: row.health,
    npaPercent: row.npa_percent,
    avgProcessingDays: row.avg_processing_days,
    contact: row.contact,
    url: row.url,
    // Kept under the client's original property name so the map/list code that
    // reads `eligibleSchemes` needed no change.
    eligibleSchemes: row.scheme_ids ? row.scheme_ids.split(",") : [],
  };
}

/**
 * @param {{schemeId?:string, type?:string, state?:string, lat?:number, lng?:number,
 *          sort?:"distance"|"health"|"processing"|"name", includeHighNpa?:boolean}} options
 */
export function listPartners(options = {}) {
  const { schemeId, type, state, lat, lng, sort = "distance", includeHighNpa = false } = options;

  const where = ["p.active = 1"];
  const params = [];

  if (schemeId) {
    where.push(
      "EXISTS (SELECT 1 FROM partner_schemes ps WHERE ps.partner_id = p.id AND ps.scheme_id = ?)"
    );
    params.push(schemeId);
  }
  if (type) {
    where.push("p.type = ?");
    params.push(type);
  }
  if (state && state !== "All") {
    // Pan-India lenders (state = 'All') stay visible for every state filter.
    where.push("(p.state = ? OR p.state = 'All')");
    params.push(state);
  }

  const all = query(`${SELECT} WHERE ${where.join(" AND ")}`, params).map(rowToPartner);

  const origin =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat: Number(lat), lng: Number(lng) } : null;

  const safe = includeHighNpa ? all : all.filter((p) => p.health !== HEALTH.HIGH_NPA);
  const excluded = includeHighNpa ? [] : all.filter((p) => p.health === HEALTH.HIGH_NPA);

  return {
    origin,
    partners: sortPartners(withDistance(safe, origin), sort),
    excluded: withDistance(excluded, origin).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      city: p.city,
      state: p.state,
      health: p.health,
      npaPercent: p.npaPercent,
      reason: "high_npa",
    })),
  };
}

function sortPartners(partners, sort) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const sorted = [...partners];

  if (sort === "health") {
    sorted.sort(
      (a, b) =>
        HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
        (a.npaPercent ?? 99) - (b.npaPercent ?? 99) ||
        byName(a, b)
    );
  } else if (sort === "processing") {
    sorted.sort((a, b) => (a.avgProcessingDays ?? 999) - (b.avgProcessingDays ?? 999) || byName(a, b));
  } else if (sort === "name") {
    sorted.sort(byName);
  } else {
    // "distance": partners without a known distance fall to the end rather than
    // sorting as 0 km away.
    sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byName(a, b));
  }
  return sorted;
}

export function getPartner(id) {
  return rowToPartner(one(`${SELECT} WHERE p.id = ? AND p.active = 1`, [id]));
}

export function partnerExists(id) {
  return one("SELECT 1 AS ok FROM partners WHERE id = ? AND active = 1", [id]) !== null;
}

/** Best partner for a scheme near a point — used to pre-fill an application. */
export function suggestPartner({ schemeId, lat, lng }) {
  const { partners } = listPartners({ schemeId, lat, lng, sort: lat && lng ? "distance" : "health" });
  return partners[0] ?? null;
}

/** Aggregates for the admin console. */
export function partnerSummary() {
  return {
    byHealth: query(
      `SELECT health, COUNT(*) AS count FROM partners WHERE active = 1 GROUP BY health`
    ),
    byType: query(`SELECT type, COUNT(*) AS count FROM partners WHERE active = 1 GROUP BY type`),
    avgProcessingDays: one(
      `SELECT ROUND(AVG(avg_processing_days), 1) AS value FROM partners WHERE active = 1`
    )?.value ?? null,
  };
}
