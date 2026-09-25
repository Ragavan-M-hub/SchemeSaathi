// server/services/amortization.js
// Two-phase amortisation, matching how Indian concessional education/skill
// loans actually work:
//   Phase 1 (moratorium) — interest-only, principal untouched.
//   Phase 2 (repayment)  — level EMI over the remaining months.
// Pure function, no I/O, so it is unit-testable and safe to call per request.

const MAX_TENURE_YEARS = 30;

/**
 * @param {{principal:number, annualRate:number, tenureYears:number, moratoriumMonths:number}} input
 */
export function computeAmortization({ principal, annualRate, tenureYears, moratoriumMonths }) {
  const P = clamp(Number(principal) || 0, 0, 1e12);
  const annual = clamp(Number(annualRate) || 0, 0, 100);
  const years = clamp(Math.round(Number(tenureYears) || 0), 1, MAX_TENURE_YEARS);
  const totalMonths = years * 12;
  const moratorium = clamp(Math.round(Number(moratoriumMonths) || 0), 0, totalMonths);
  const repaymentMonths = totalMonths - moratorium;
  const r = annual / 12 / 100;

  const schedule = [];
  let balance = P;
  let emi = 0;

  for (let m = 1; m <= moratorium; m++) {
    const interest = balance * r;
    schedule.push({
      month: m,
      payment: interest,
      principal: 0,
      interest,
      balance,
      isMoratorium: true,
    });
  }

  if (repaymentMonths > 0) {
    emi = r === 0 ? P / repaymentMonths : levelEmi(P, r, repaymentMonths);

    for (let m = moratorium + 1; m <= totalMonths; m++) {
      const interest = balance * r;
      let principalPart;
      let payment;

      if (m === totalMonths) {
        // Final instalment absorbs any rounding drift so the balance lands on 0.
        principalPart = balance;
        payment = principalPart + interest;
        balance = 0;
      } else {
        principalPart = Math.max(0, emi - interest);
        payment = emi;
        balance = Math.max(0, balance - principalPart);
      }

      schedule.push({
        month: m,
        payment,
        principal: principalPart,
        interest,
        balance,
        isMoratorium: false,
      });
    }
  }

  const totalPayment = sum(schedule, "payment");
  // Summing the interest column (rather than totalPayment - principal) stays
  // correct in the degenerate case where the moratorium spans the full tenure
  // and no principal is ever repaid.
  const totalInterest = sum(schedule, "interest");
  const moratoriumInterest = sum(
    schedule.filter((x) => x.isMoratorium),
    "interest"
  );

  const yearly = [];
  for (let y = 0; y < years; y++) {
    const slice = schedule.slice(y * 12, (y + 1) * 12);
    if (slice.length === 0) break;
    yearly.push({
      year: `Y${y + 1}`,
      principal: round(sum(slice, "principal")),
      interest: round(sum(slice, "interest")),
    });
  }

  return {
    input: {
      principal: P,
      annualRate: annual,
      tenureYears: years,
      moratoriumMonths: moratorium,
    },
    emi: round(emi),
    moratoriumPayment: round(schedule[0]?.isMoratorium ? schedule[0].payment : 0),
    totalInterest: round(totalInterest),
    totalPayment: round(totalPayment),
    moratoriumInterest: round(moratoriumInterest),
    outstandingAtEnd: round(balance),
    months: schedule.length,
    schedule: schedule.map((row) => ({
      ...row,
      payment: round(row.payment),
      principal: round(row.principal),
      interest: round(row.interest),
      balance: round(row.balance),
    })),
    yearly,
  };
}

/** Soft, human-readable checks — the API returns these instead of rejecting input. */
export function amortizationWarnings({ principal, annualRate, tenureYears, moratoriumMonths }, scheme) {
  const warnings = [];
  if (scheme) {
    if (principal > scheme.loan.max) warnings.push({ code: "loan_above_max", value: scheme.loan.max });
    if (principal < scheme.loan.min) warnings.push({ code: "loan_below_min", value: scheme.loan.min });
    if (annualRate > scheme.interest.max) warnings.push({ code: "rate_above_max", value: scheme.interest.max });
    if (annualRate < scheme.interest.min) warnings.push({ code: "rate_below_min", value: scheme.interest.min });
    if (tenureYears > scheme.tenureYears) warnings.push({ code: "tenure_above_max", value: scheme.tenureYears });
  }
  if (moratoriumMonths >= tenureYears * 12) warnings.push({ code: "moratorium_covers_tenure", value: moratoriumMonths });
  return warnings;
}

const levelEmi = (P, r, n) => {
  const factor = Math.pow(1 + r, n);
  return (P * r * factor) / (factor - 1);
};

const sum = (rows, key) => rows.reduce((acc, row) => acc + row[key], 0);
const round = (n) => Math.round(Number(n) || 0);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
