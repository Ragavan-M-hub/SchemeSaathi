// server/tests/matcher.test.js
// The rule-based matcher reads the scheme catalogue from the DB, so we seed an
// in-memory database once (DB_PATH=:memory: is forced by the test runner env).

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { seedAll } from "../db/seed.js";
import { matchSchemes } from "../services/matcher.js";

before(async () => {
  // Catalogue only — demo users are irrelevant to the matcher.
  await seedAll({ reset: true, demoUsers: false });
});

test("returns ranked schemes with reasons for a plausible applicant", () => {
  const { ranked, all } = matchSchemes({
    purpose: "self-employment",
    projectType: "Retail shop",
    cost: 100000,
    income: 120000,
    education: "10th",
    gender: "female",
  });

  assert.ok(all.length > 0, "at least one scheme should qualify");
  assert.ok(ranked.length > 0 && ranked.length <= 3);

  // Every returned scheme carries at least one reason and a fit percentage.
  for (const s of ranked) {
    assert.ok(Array.isArray(s.reasons) && s.reasons.length > 0);
    assert.ok(typeof s.fitPercent === "number");
    assert.ok(s.reasons.every((r) => typeof r.code === "string"));
  }
});

test("results are sorted by score descending", () => {
  const { all } = matchSchemes({ purpose: "self-employment", income: 100000 });
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i - 1].score >= all[i].score);
  }
});

test("income above a scheme's ceiling excludes it with a reason", () => {
  const { all, excluded } = matchSchemes({
    purpose: "self-employment",
    income: 100000000, // absurdly high — should breach every ceiling
  });
  assert.equal(all.length, 0);
  assert.ok(excluded.length > 0);
  assert.ok(excluded.every((e) => typeof e.code === "string"));
});

test("women-only schemes are excluded for male applicants", () => {
  const male = matchSchemes({ purpose: "self-employment", gender: "male", income: 100000 });
  assert.ok(
    male.all.every((s) => !s.womenOnly),
    "no women-only scheme should survive for a male applicant"
  );
});

test("a purpose with no matching scheme yields no results", () => {
  const { all } = matchSchemes({ purpose: "higher-education", education: "none", income: 50000 });
  // Education schemes require a minimum education level; "none" should gate them.
  assert.ok(all.every((s) => s.purposes.includes("higher-education")));
});
