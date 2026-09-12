// server/routes/_schemas.js
// Shared zod pieces. Query strings arrive as strings, so numbers and booleans
// are coerced here and empty values are treated as "not provided" (a blank
// `?maxIncome=` must not become 0 and silently filter everything out).

import { z } from "zod";

const blankToUndefined = (value) =>
  value === "" || value === null || value === undefined ? undefined : value;

export const id = z.string().trim().min(1).max(64);

export const optionalString = (max = 200) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const optionalNumber = ({ min = 0, max = 1e12, int = false } = {}) =>
  z.preprocess(
    blankToUndefined,
    (int ? z.coerce.number().int() : z.coerce.number()).min(min).max(max).optional()
  );

export const requiredNumber = ({ min = 0, max = 1e12, int = false } = {}) =>
  (int ? z.coerce.number().int() : z.coerce.number()).min(min).max(max);

export const optionalBool = z.preprocess(
  blankToUndefined,
  z
    .union([z.boolean(), z.enum(["1", "0", "true", "false", "yes", "no", "on", "off"])])
    .transform((v) => v === true || ["1", "true", "yes", "on"].includes(v))
    .optional()
);

export const LANGS = ["en", "hi", "mr"];
export const PURPOSES = ["self-employment", "higher-education", "skill-training"];
export const EDUCATIONS = ["none", "10th", "12th", "graduate"];
export const GENDERS = ["male", "female", "other"];

export const langQuery = z.object({
  lang: z.preprocess(blankToUndefined, z.enum(LANGS).optional().default("en")),
});

/** The recommender's answers — every field optional so partial runs still work. */
export const matchInput = z.object({
  purpose: z.enum(PURPOSES),
  projectType: optionalString(120),
  cost: optionalNumber({ min: 0, max: 1e9, int: true }),
  income: optionalNumber({ min: 0, max: 1e9, int: true }),
  education: z.preprocess(blankToUndefined, z.enum(EDUCATIONS).optional().default("none")),
  gender: z.preprocess(blankToUndefined, z.enum(GENDERS).optional()),
});

/** Loan terms for the EMI engine. Bounds match the amortisation clamps. */
export const emiInput = z.object({
  principal: requiredNumber({ min: 0, max: 1e10 }),
  annualRate: requiredNumber({ min: 0, max: 100 }),
  tenureYears: requiredNumber({ min: 1, max: 30, int: true }),
  moratoriumMonths: optionalNumber({ min: 0, max: 360, int: true }).default(0),
  schemeId: optionalString(64),
});

export const locationInput = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    label: optionalString(120),
  })
  .nullable()
  .optional();
