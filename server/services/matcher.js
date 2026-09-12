// server/services/matcher.js
// Rule-based scheme matcher — the "AI" of the demo, deliberately transparent:
// every point a scheme scores is recorded as a reason, so the UI can show
// "why this fits you" instead of an opaque ranking.
//
// Two changes from the original client-side version:
//   1. Eligibility comes from scheme *data* (purposes / minEducation /
//      womenOnly) rather than a hard-coded category map, so adding a scheme is
//      a seed change instead of a code change.
//   2. Reasons are emitted as {code, params} plus pre-rendered English text.
//      The client can translate the codes; anything that just prints strings
//      (or a PDF/export later) can use `text` as-is.

import { listSchemes } from "./schemes.js";
import { formatINR } from "../utils/format.js";

/** Education answers, ranked so "is the applicant at least X?" is a comparison. */
export const EDUCATION_LEVEL = {
  none: 0,
  "10th": 10,
  "12th": 12,
  graduate: 16,
};

/** Highest score a single scheme can collect — used to show a % fit in the UI. */
export const MAX_SCORE = 4 + 3 + 2 + 1 + 1 + 1 + 1;

const educationRank = (value) => EDUCATION_LEVEL[value] ?? 0;

export function matchSchemes(input = {}) {
  const purpose = input.purpose || null;
  const projectType = input.projectType || null;
  const cost = Math.max(0, Number(input.cost) || 0);
  const income = Math.max(0, Number(input.income) || 0);
  const education = input.education || "none";
  const gender = input.gender || null;

  const results = [];
  const excluded = [];

  for (const scheme of listSchemes()) {
    const skip = disqualify(scheme, { purpose, cost, income, education, gender });
    if (skip) {
      excluded.push({ id: scheme.id, name: scheme.name, ...skip });
      continue;
    }

    let score = 0;
    const reasons = [];
    const add = (points, code, params = {}, text = "") => {
      score += points;
      reasons.push({ code, params, text });
    };

    // Baseline eligibility always leads, so every card has at least one reason.
    reasons.push({
      code: "income_eligible",
      params: { income },
      text: `Eligible for your family income of ${formatINR(income)}/year`,
    });

    // 1. The applicant's specific plan is on the scheme's eligible list (+4).
    if (projectType && scheme.eligibleTypes.includes(projectType)) {
      add(4, "type_match", { projectType }, `Matches your plan for "${projectType}"`);
    }

    // 2. How much of the stated cost the ceiling actually covers (+3 / +1).
    const coverage = cost > 0 ? Math.min(cost, scheme.loan.max) : scheme.loan.max;
    const coveragePct = cost > 0 ? Math.round((coverage / cost) * 100) : 100;
    if (coveragePct >= 100) {
      add(3, "covers_full_cost", { cost }, `Covers your full estimated cost of ${formatINR(cost)}`);
    } else if (coveragePct >= 75) {
      add(
        1,
        "covers_partial",
        { percent: coveragePct, amount: coverage },
        `Covers ${coveragePct}% of your cost (${formatINR(coverage)})`
      );
    }

    // 3. Interest band (+2 very low, +1 concessional).
    const avgInterest = (scheme.interest.min + scheme.interest.max) / 2;
    const rateParams = { min: scheme.interest.min, max: scheme.interest.max };
    if (avgInterest <= 5) {
      add(2, "very_low_interest", rateParams, `Very low interest (${scheme.interest.min}–${scheme.interest.max}%)`);
    } else if (avgInterest <= 7) {
      add(1, "concessional_interest", rateParams, `Concessional interest rate (${scheme.interest.min}–${scheme.interest.max}%)`);
    }

    // 4. A long moratorium is a real cash-flow benefit for a new venture (+1).
    if (scheme.moratoriumMonths >= 9) {
      add(
        1,
        "long_moratorium",
        { months: scheme.moratoriumMonths },
        `Long moratorium of ${scheme.moratoriumMonths} months — pay after your business/course is set up`
      );
    }

    // 5. Comfortable headroom under the income ceiling (+1).
    if (scheme.incomeCeiling > 0 && income / scheme.incomeCeiling <= 0.6) {
      add(1, "income_headroom", {}, "Your family income comfortably fits the eligibility criteria");
    }

    // 6. Fewer documents means a realistically completable application (+1).
    if (scheme.documents.length <= 5) {
      add(
        1,
        "light_documentation",
        { count: scheme.documents.length },
        `Light documentation — only ${scheme.documents.length} documents needed`
      );
    }

    // 7. Women-only schemes carry priority processing for eligible applicants (+1).
    if (scheme.womenOnly && gender === "female") {
      add(1, "women_priority", {}, "Reserved for women applicants — lower interest and priority processing");
    }

    results.push({
      ...scheme,
      score,
      maxScore: MAX_SCORE,
      fitPercent: Math.round((score / MAX_SCORE) * 100),
      coveragePct,
      reasons,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break on the cheaper scheme — the applicant-friendly default.
    const aInt = (a.interest.min + a.interest.max) / 2;
    const bInt = (b.interest.min + b.interest.max) / 2;
    if (aInt !== bInt) return aInt - bInt;
    return a.name.localeCompare(b.name);
  });

  return {
    input: { purpose, projectType, cost, income, education, gender },
    ranked: results.slice(0, 3),
    all: results,
    excluded,
  };
}

/**
 * Hard eligibility gates. Returns null when the scheme qualifies, otherwise a
 * structured reason so the API can explain the omission instead of silently
 * dropping the scheme.
 */
function disqualify(scheme, { purpose, cost, income, education, gender }) {
  if (purpose && !scheme.purposes.includes(purpose)) {
    return { code: "purpose_mismatch", params: { purpose } };
  }
  if (income > scheme.incomeCeiling) {
    return { code: "income_above_ceiling", params: { ceiling: scheme.incomeCeiling } };
  }
  // A floor above what the applicant needs means the scheme cannot be used.
  if (cost > 0 && scheme.loan.min > cost) {
    return { code: "min_loan_above_cost", params: { min: scheme.loan.min } };
  }
  if (educationRank(education) < educationRank(scheme.minEducation)) {
    return { code: "education_below_min", params: { minEducation: scheme.minEducation } };
  }
  if (scheme.womenOnly && gender && gender !== "female") {
    return { code: "women_only", params: {} };
  }
  return null;
}
