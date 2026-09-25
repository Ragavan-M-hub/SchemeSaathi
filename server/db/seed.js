// server/db/seed.js
// Idempotent seeding: every catalogue row is an upsert keyed on its natural id,
// so running this against an existing database refreshes content without
// touching user data (accounts, applications, saved scenarios).
//
//   npm run db:seed     # upsert catalogue (+ demo accounts outside production)
//   npm run db:reset    # delete the database file first, then seed
//
// RESET_DB=1 is destructive by design and only ever used through db:reset.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { env } from "../env.js";
import { migrate, run, one, tx, closeDb, nowIso } from "./index.js";
import { schemeSeed } from "../data/schemes.data.js";
import { partnerSeed, healthForNpa } from "../data/partners.data.js";
import { glossarySeed, glossaryLanguages } from "../data/glossary.data.js";
import { cityCoords, pincodePrefixes } from "../data/geo.data.js";
import { personaSeed } from "../data/personas.data.js";
import { createUser, findUserByEmail, publicUser, saveProfile } from "../services/users.js";
import {
  createApplication,
  transitionApplication,
  updateDocument,
} from "../services/applications.js";

const json = (value) => JSON.stringify(value ?? []);

/** Deletes the SQLite file and its WAL sidecars. No-op for :memory:. */
export function resetDatabase() {
  if (env.DB_PATH === ":memory:") return false;
  let removed = false;
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = env.DB_PATH + suffix;
    if (fs.existsSync(file)) {
      fs.rmSync(file);
      removed = true;
    }
  }
  return removed;
}

function seedSchemes() {
  schemeSeed.forEach((scheme, index) => {
    run(
      `INSERT INTO schemes (id, name, nodal_agency, category, description, loan_min, loan_max,
                            income_ceiling, interest_min, interest_max, moratorium_months,
                            tenure_years, eligible_types, documents, apply_url, name_key,
                            description_key, purposes, min_education, women_only, sort_order,
                            active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name, nodal_agency = excluded.nodal_agency,
         category = excluded.category, description = excluded.description,
         loan_min = excluded.loan_min, loan_max = excluded.loan_max,
         income_ceiling = excluded.income_ceiling, interest_min = excluded.interest_min,
         interest_max = excluded.interest_max, moratorium_months = excluded.moratorium_months,
         tenure_years = excluded.tenure_years, eligible_types = excluded.eligible_types,
         documents = excluded.documents, apply_url = excluded.apply_url,
         name_key = excluded.name_key, description_key = excluded.description_key,
         purposes = excluded.purposes, min_education = excluded.min_education,
         women_only = excluded.women_only, sort_order = excluded.sort_order,
         active = 1, updated_at = excluded.updated_at`,
      [
        scheme.id, scheme.name, scheme.nodalAgency, scheme.category, scheme.description,
        scheme.loan.min, scheme.loan.max, scheme.incomeCeiling,
        scheme.interest.min, scheme.interest.max, scheme.moratoriumMonths, scheme.tenureYears,
        json(scheme.eligibleTypes), json(scheme.documents), scheme.applyUrl,
        scheme.nameKey, scheme.descriptionKey, json(scheme.purposes),
        scheme.minEducation ?? "none", scheme.womenOnly ? 1 : 0, index,
        nowIso(), nowIso(),
      ]
    );
  });
  return schemeSeed.length;
}

function seedPartners() {
  for (const partner of partnerSeed) {
    // health is derived, never hand-written, so the badge always agrees with NPA.
    const health = healthForNpa(partner.npaPercent);
    run(
      `INSERT INTO partners (id, name, type, city, state, lat, lng, health, npa_percent,
                             avg_processing_days, contact, url, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name, type = excluded.type, city = excluded.city,
         state = excluded.state, lat = excluded.lat, lng = excluded.lng,
         health = excluded.health, npa_percent = excluded.npa_percent,
         avg_processing_days = excluded.avg_processing_days, contact = excluded.contact,
         url = excluded.url, active = 1, updated_at = excluded.updated_at`,
      [
        partner.id, partner.name, partner.type, partner.city, partner.state,
        partner.lat, partner.lng, health, partner.npaPercent, partner.avgProcessingDays,
        partner.contact, partner.url, nowIso(), nowIso(),
      ]
    );

    // Replace the join rows wholesale: the seed file is the source of truth.
    run("DELETE FROM partner_schemes WHERE partner_id = ?", [partner.id]);
    for (const schemeId of partner.schemes) {
      run("INSERT INTO partner_schemes (partner_id, scheme_id) VALUES (?, ?)", [
        partner.id,
        schemeId,
      ]);
    }
  }
  return partnerSeed.length;
}

function seedGlossary() {
  let count = 0;
  Object.entries(glossarySeed).forEach(([termKey, byLang], index) => {
    for (const lang of glossaryLanguages) {
      const entry = byLang[lang];
      if (!entry) continue;
      run(
        `INSERT INTO glossary (term_key, lang, term, plain, example, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (term_key, lang) DO UPDATE SET
           term = excluded.term, plain = excluded.plain,
           example = excluded.example, sort_order = excluded.sort_order`,
        [termKey, lang, entry.term, entry.plain, entry.example ?? null, index]
      );
      count++;
    }
  });
  return count;
}

function seedGeoPlaces() {
  const upsert = (kind, key, place) => {
    // "Mumbai, MH" -> state code "MH"; plain labels leave state null.
    const [, stateCode] = place.label.split(",").map((s) => s.trim());
    run(
      `INSERT INTO geo_places (kind, "key", label, lat, lng, state)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (kind, "key") DO UPDATE SET
         label = excluded.label, lat = excluded.lat, lng = excluded.lng, state = excluded.state`,
      [kind, key, place.label, place.lat, place.lng, stateCode ?? null]
    );
  };

  for (const [key, place] of Object.entries(cityCoords)) upsert("city", key, place);
  for (const [key, place] of Object.entries(pincodePrefixes)) upsert("pincode_prefix", key, place);

  return Object.keys(cityCoords).length + Object.keys(pincodePrefixes).length;
}

function seedPersonas() {
  personaSeed.forEach((persona, index) => {
    run(
      `INSERT INTO personas (id, emoji, labels, form, sort_order)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         emoji = excluded.emoji, labels = excluded.labels,
         form = excluded.form, sort_order = excluded.sort_order`,
      [persona.id, persona.emoji, JSON.stringify(persona.label), JSON.stringify(persona.form), index]
    );
  });
  return personaSeed.length;
}

/** Catalogue content only — no user rows are touched. */
export function seedCatalogue() {
  return tx(() => ({
    schemes: seedSchemes(),
    partners: seedPartners(),
    glossary: seedGlossary(),
    geoPlaces: seedGeoPlaces(),
    personas: seedPersonas(),
  }));
}

/* --------------------------- demo accounts --------------------------- */

const DEMO_USERS = [
  {
    name: "Asha Kamble",
    email: "asha@example.com",
    role: "applicant",
    state: "Maharashtra",
    district: "Mumbai",
    preferredLang: "mr",
    profile: {
      purpose: "self-employment",
      projectType: "Beauty parlour / salon",
      cost: 120000,
      income: 150000,
      education: "12th",
      gender: "female",
      location: { lat: 19.076, lng: 72.8777, label: "Mumbai, MH" },
      stepsCompleted: { recommender: true, emi: true, partners: true },
    },
  },
  {
    name: "Ravi Chauhan",
    email: "ravi@example.com",
    role: "applicant",
    state: "Uttar Pradesh",
    district: "Lucknow",
    preferredLang: "hi",
    profile: {
      purpose: "higher-education",
      projectType: "Engineering / Medical in India",
      cost: 600000,
      income: 240000,
      education: "12th",
      gender: "male",
      location: { lat: 26.8467, lng: 80.9462, label: "Lucknow, UP" },
      stepsCompleted: { recommender: true },
    },
  },
  { name: "Neha Deshmukh", email: "officer@example.com", role: "officer", state: "Maharashtra" },
  { name: "SchemeSaathi Admin", email: "admin@example.com", role: "admin" },
];

/**
 * Creates the demo accounts and a few applications at different workflow
 * stages, so the dashboard and the officer console have something to show.
 * Existing accounts are left exactly as they are.
 */
export async function seedDemoUsers() {
  const created = [];
  const byEmail = new Map();

  for (const demo of DEMO_USERS) {
    let user = publicUser(findUserByEmail(demo.email));
    if (!user) {
      user = await createUser({ ...demo, password: env.DEMO_PASSWORD });
      created.push(user.email);
    }
    if (demo.profile) saveProfile(user.id, demo.profile);
    byEmail.set(demo.email, user);
  }

  const officer = { id: byEmail.get("officer@example.com").id, role: "officer" };
  const asha = { id: byEmail.get("asha@example.com").id, role: "applicant" };
  const ravi = { id: byEmail.get("ravi@example.com").id, role: "applicant" };

  const applications = [];
  // Only seed applications for a user who has none, so re-running does not pile
  // up duplicates.
  if (!hasApplications(asha.id)) {
    applications.push(
      await seedApplication({
        actor: asha,
        officer,
        input: {
          schemeId: "mahila-samriddhi",
          partnerId: "sca-mh",
          amountRequested: 120000,
          tenureYears: 5,
          interestRate: 5,
          moratoriumMonths: 9,
          purposeNote: "Setting up a two-chair salon in Kurla with one trainee.",
        },
        advanceTo: ["submitted", "under_review"],
      })
    );
    applications.push(
      await seedApplication({
        actor: asha,
        officer,
        input: {
          schemeId: "aajeevika",
          partnerId: "mfi-ujjivan",
          amountRequested: 60000,
          tenureYears: 4,
          interestRate: 6,
          moratoriumMonths: 3,
          purposeNote: "Working capital for festival season stock.",
        },
        uploadDocuments: false,
        advanceTo: [],
      })
    );
  }

  if (!hasApplications(ravi.id)) {
    applications.push(
      await seedApplication({
        actor: ravi,
        officer,
        input: {
          schemeId: "education-loan",
          partnerId: "psb-sbi",
          amountRequested: 600000,
          tenureYears: 10,
          interestRate: 3.5,
          moratoriumMonths: 12,
          purposeNote: "B.Tech (Computer Science) — 4-year programme, tuition + hostel.",
        },
        advanceTo: ["submitted", "under_review", "approved"],
      })
    );
  }

  return { createdUsers: created, applications: applications.filter(Boolean).length };
}

const hasApplications = (userId) =>
  (one("SELECT COUNT(*) AS count FROM applications WHERE user_id = ?", [userId])?.count ?? 0) > 0;

async function seedApplication({ actor, officer, input, advanceTo = [], uploadDocuments = true }) {
  let app = createApplication(actor.id, input);

  if (uploadDocuments) {
    for (const doc of app.documents) {
      app = updateDocument(app.id, doc.id, {
        status: "uploaded",
        fileName: `${doc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.pdf`,
        fileSize: 180_000 + Math.round(Math.random() * 400_000),
      }, actor);
    }
  }

  for (const to of advanceTo) {
    const byOfficer = to !== "submitted";
    app = transitionApplication(
      app.id,
      { to, note: NOTES[to] },
      byOfficer ? officer : actor
    );
  }
  return app;
}

const NOTES = {
  submitted: "Submitted with a complete document set.",
  under_review: "Verified against the scheme's income ceiling; pending branch confirmation.",
  approved: "Sanctioned at the concessional rate. Disbursement scheduled with the branch.",
};

/* ------------------------------- runner ------------------------------- */

/**
 * @param {{reset?: boolean, demoUsers?: boolean}} options
 */
export async function seedAll(options = {}) {
  const reset = options.reset ?? /^(1|true|yes)$/i.test(process.env.RESET_DB ?? "");
  const demoUsers = options.demoUsers ?? env.SEED_DEMO_USERS;

  const wiped = reset ? resetDatabase() : false;
  migrate();

  const counts = seedCatalogue();
  const demo = demoUsers ? await seedDemoUsers() : { createdUsers: [], applications: 0 };

  return { wiped, dbPath: env.DB_PATH, ...counts, demo };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const result = await seedAll();
  if (result.wiped) console.log("⚠ existing database file deleted (RESET_DB)");
  console.log(`✔ seeded ${result.dbPath}`);
  console.log(
    `  schemes ${result.schemes} · partners ${result.partners} · glossary ${result.glossary} ` +
      `· places ${result.geoPlaces} · personas ${result.personas}`
  );
  if (result.demo.createdUsers.length > 0) {
    console.log(`  demo accounts: ${result.demo.createdUsers.join(", ")}`);
    console.log(`  demo password: ${env.DEMO_PASSWORD}`);
  }
  if (result.demo.applications > 0) {
    console.log(`  demo applications: ${result.demo.applications}`);
  }
  closeDb();
}
