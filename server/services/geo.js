// server/services/geo.js
// Distance maths plus a DB-backed offline geocoder. `geo_places` holds city
// names and 3-digit pincode prefixes; swapping in a real geocoding provider
// means changing only `lookupLocation`, not any caller.

import { query, one } from "../db/index.js";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const formatDistance = (km) => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

const toPlace = (row) =>
  row ? { lat: row.lat, lng: row.lng, label: row.label, kind: row.kind, key: row.key } : null;

/**
 * Resolve a free-text location (city name or 6-digit pincode) to coordinates.
 * @returns {{lat:number, lng:number, label:string, kind:string, key:string} | null}
 */
export function lookupLocation(input) {
  const q = String(input ?? "").trim().toLowerCase();
  if (q.length < 2) return null;

  if (/^\d{6}$/.test(q)) {
    const byPincode = one(
      `SELECT * FROM geo_places WHERE kind = 'pincode_prefix' AND "key" = ?`,
      [q.slice(0, 3)]
    );
    if (byPincode) return toPlace(byPincode);
  }

  const exact = one(`SELECT * FROM geo_places WHERE kind = 'city' AND "key" = ?`, [q]);
  if (exact) return toPlace(exact);

  // Fuzzy both ways: "mum" -> mumbai, and "mumbai maharashtra" -> mumbai.
  // Prefix matches win, then the shortest key, so the result is deterministic.
  const partial = one(
    `SELECT * FROM geo_places
      WHERE kind = 'city'
        AND ("key" LIKE '%' || ? || '%' OR ? LIKE '%' || "key" || '%')
      ORDER BY ("key" LIKE ? || '%') DESC, LENGTH("key"), "key"
      LIMIT 1`,
    [q, q, q]
  );
  return toPlace(partial);
}

/** Type-ahead helper for the location box. */
export function suggestPlaces(input, limit = 8) {
  const q = String(input ?? "").trim().toLowerCase();
  const rows = q
    ? query(
        `SELECT * FROM geo_places
          WHERE kind = 'city' AND "key" LIKE '%' || ? || '%'
          ORDER BY ("key" LIKE ? || '%') DESC, LENGTH("key"), "key"
          LIMIT ?`,
        [q, q, limit]
      )
    : query(`SELECT * FROM geo_places WHERE kind = 'city' ORDER BY "key" LIMIT ?`, [limit]);
  return rows.map(toPlace);
}

/** Add a distance (km + formatted label) to anything carrying lat/lng. */
export function withDistance(items, origin) {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return items.map((item) => ({ ...item, distanceKm: null, distanceLabel: null }));
  }
  return items.map((item) => {
    const distanceKm = haversineDistance(origin.lat, origin.lng, item.lat, item.lng);
    return {
      ...item,
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceLabel: formatDistance(distanceKm),
    };
  });
}
