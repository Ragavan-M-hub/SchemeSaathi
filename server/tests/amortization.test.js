// server/tests/amortization.test.js
// Unit tests for the pure amortisation engine — no DB, no HTTP.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeAmortization,
  amortizationWarnings,
} from "../services/amortization.js";

test("level EMI matches the closed-form formula", () => {
  const P = 100000;
  const annual = 12;
  const years = 1;
  const r = annual / 12 / 100;
  const n = years * 12;
  const expected = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const { emi } = computeAmortization({
    principal: P,
    annualRate: annual,
    tenureYears: years,
    moratoriumMonths: 0,
  });

  assert.equal(emi, Math.round(expected));
});

test("schedule fully amortises: final balance is exactly zero", () => {
  const { schedule } = computeAmortization({
    principal: 250000,
    annualRate: 9.5,
    tenureYears: 3,
    moratoriumMonths: 0,
  });
  assert.equal(schedule.length, 36);
  assert.equal(schedule[schedule.length - 1].balance, 0);
});

test("zero-interest loan repays principal in equal parts", () => {
  const { emi, totalInterest, totalPayment } = computeAmortization({
    principal: 120000,
    annualRate: 0,
    tenureYears: 1,
    moratoriumMonths: 0,
  });
  assert.equal(emi, 10000);
  assert.equal(totalInterest, 0);
  assert.equal(totalPayment, 120000);
});

test("moratorium months are interest-only and touch no principal", () => {
  const { schedule, moratoriumInterest } = computeAmortization({
    principal: 100000,
    annualRate: 12,
    tenureYears: 2,
    moratoriumMonths: 6,
  });
  const grace = schedule.slice(0, 6);
  assert.equal(grace.length, 6);
  for (const row of grace) {
    assert.equal(row.isMoratorium, true);
    assert.equal(row.principal, 0);
    assert.equal(row.balance, 100000); // principal untouched during grace
  }
  // 1% monthly on 100000 = 1000/mo * 6 = 6000
  assert.equal(moratoriumInterest, 6000);
});

test("warnings flag out-of-band loan terms against a scheme", () => {
  const scheme = {
    loan: { min: 50000, max: 200000 },
    interest: { min: 4, max: 8 },
    tenureYears: 5,
  };
  const warnings = amortizationWarnings(
    { principal: 500000, annualRate: 12, tenureYears: 10, moratoriumMonths: 3 },
    scheme
  );
  const codes = warnings.map((w) => w.code);
  assert.ok(codes.includes("loan_above_max"));
  assert.ok(codes.includes("rate_above_max"));
  assert.ok(codes.includes("tenure_above_max"));
});

test("a moratorium spanning the whole tenure is flagged", () => {
  const warnings = amortizationWarnings(
    { principal: 100000, annualRate: 8, tenureYears: 1, moratoriumMonths: 12 },
    null
  );
  assert.ok(warnings.some((w) => w.code === "moratorium_covers_tenure"));
});
