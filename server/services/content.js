// server/services/content.js
// Translated content served from the database: the plain-language glossary and
// the demo personas. Both fall back to English per row, so a partially
// translated language still renders something useful instead of blanks.

import { query, parseJson } from "../db/index.js";

const FALLBACK_LANG = "en";

export function listGlossary(lang = FALLBACK_LANG) {
  const rows = query(
    `SELECT * FROM glossary WHERE lang IN (?, ?) ORDER BY sort_order, term_key`,
    [lang, FALLBACK_LANG]
  );

  const byKey = new Map();
  for (const row of rows) {
    const existing = byKey.get(row.term_key);
    // Requested language wins; English only fills the gaps.
    if (!existing || row.lang === lang) {
      byKey.set(row.term_key, {
        key: row.term_key,
        lang: row.lang,
        term: row.term,
        plain: row.plain,
        example: row.example,
      });
    }
  }
  return [...byKey.values()];
}

export function listPersonas(lang = FALLBACK_LANG) {
  return query("SELECT * FROM personas ORDER BY sort_order, id").map((row) => {
    const labels = parseJson(row.labels, {});
    return {
      id: row.id,
      emoji: row.emoji,
      label: labels[lang] ?? labels[FALLBACK_LANG] ?? row.id,
      labels,
      form: parseJson(row.form, {}),
    };
  });
}
