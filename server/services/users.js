// server/services/users.js
// Users, their recommender profile, and saved schemes. Password hashes never
// leave this module: every caller gets `publicUser()` output.

import bcrypt from "bcryptjs";
import { query, one, run, tx, nowIso, newId, parseJson } from "../db/index.js";
import { env } from "../env.js";
import { conflict, notFound, unauthorized } from "../utils/errors.js";

const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    socialCategory: row.social_category,
    state: row.state,
    district: row.district,
    preferredLang: row.preferred_lang,
    createdAt: row.created_at,
  };
}

export function findUserById(id) {
  return one("SELECT * FROM users WHERE id = ?", [id]);
}

export function findUserByEmail(email) {
  return one("SELECT * FROM users WHERE email = ?", [normalizeEmail(email)]);
}

export async function createUser(input) {
  const email = normalizeEmail(input.email);
  if (findUserByEmail(email)) {
    throw conflict("An account with this email already exists", "email_taken");
  }

  const now = nowIso();
  const user = {
    id: newId(),
    name: String(input.name).trim(),
    email,
    phone: input.phone ?? null,
    password_hash: await bcrypt.hash(input.password, env.BCRYPT_ROUNDS),
    role: input.role ?? "applicant",
    social_category: input.socialCategory ?? "SC",
    state: input.state ?? null,
    district: input.district ?? null,
    preferred_lang: input.preferredLang ?? "en",
    created_at: now,
    updated_at: now,
  };

  tx(() => {
    run(
      `INSERT INTO users (id, name, email, phone, password_hash, role, social_category,
                          state, district, preferred_lang, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id, user.name, user.email, user.phone, user.password_hash, user.role,
        user.social_category, user.state, user.district, user.preferred_lang,
        user.created_at, user.updated_at,
      ]
    );
    // Every user gets a profile row up front, so reads never special-case null.
    run(`INSERT INTO profiles (user_id, steps_completed, updated_at) VALUES (?, '{}', ?)`, [
      user.id,
      now,
    ]);
  });

  return publicUser(user);
}

/** @returns {Promise<object>} the raw user row on success. */
export async function verifyCredentials(email, password) {
  const row = findUserByEmail(email);
  // Compare against a dummy hash when the email is unknown so a missing account
  // and a wrong password take the same time to answer.
  const hash = row?.password_hash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const ok = await bcrypt.compare(String(password ?? ""), hash);
  if (!row || !ok) throw unauthorized("Email or password is incorrect", "invalid_credentials");
  return row;
}

const USER_PATCH_COLUMNS = {
  name: "name",
  phone: "phone",
  state: "state",
  district: "district",
  preferredLang: "preferred_lang",
  socialCategory: "social_category",
};

export function updateUser(id, patch = {}) {
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(USER_PATCH_COLUMNS)) {
    if (patch[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(patch[key]);
    }
  }
  if (sets.length > 0) {
    sets.push("updated_at = ?");
    params.push(nowIso(), id);
    run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
  }
  const row = findUserById(id);
  if (!row) throw notFound("User not found", "user_not_found");
  return publicUser(row);
}

export async function changePassword(id, currentPassword, newPassword) {
  const row = findUserById(id);
  if (!row) throw notFound("User not found", "user_not_found");
  const ok = await bcrypt.compare(String(currentPassword ?? ""), row.password_hash);
  if (!ok) throw unauthorized("Current password is incorrect", "invalid_credentials");
  run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
    await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS),
    nowIso(),
    id,
  ]);
  return { ok: true };
}

/* ------------------------------ profile ------------------------------ */

export function rowToProfile(row) {
  if (!row) return null;
  return {
    purpose: row.purpose,
    projectType: row.project_type,
    cost: row.cost,
    income: row.income,
    education: row.education,
    gender: row.gender,
    location:
      row.lat !== null && row.lng !== null
        ? { lat: row.lat, lng: row.lng, label: row.location_label }
        : null,
    stepsCompleted: parseJson(row.steps_completed, {}),
    updatedAt: row.updated_at,
  };
}

export function getProfile(userId) {
  const row = one("SELECT * FROM profiles WHERE user_id = ?", [userId]);
  if (row) return rowToProfile(row);
  // Defensive: a user created before profiles existed still gets a usable shape.
  run(`INSERT INTO profiles (user_id, steps_completed, updated_at) VALUES (?, '{}', ?)`, [
    userId,
    nowIso(),
  ]);
  return rowToProfile(one("SELECT * FROM profiles WHERE user_id = ?", [userId]));
}

const PROFILE_PATCH_COLUMNS = {
  purpose: "purpose",
  projectType: "project_type",
  cost: "cost",
  income: "income",
  education: "education",
  gender: "gender",
};

export function saveProfile(userId, patch = {}) {
  getProfile(userId); // ensure the row exists

  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(PROFILE_PATCH_COLUMNS)) {
    if (patch[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(patch[key]);
    }
  }
  if (patch.location !== undefined) {
    sets.push("lat = ?", "lng = ?", "location_label = ?");
    params.push(patch.location?.lat ?? null, patch.location?.lng ?? null, patch.location?.label ?? null);
  }
  if (patch.stepsCompleted !== undefined) {
    sets.push("steps_completed = ?");
    params.push(JSON.stringify(patch.stepsCompleted ?? {}));
  }

  if (sets.length > 0) {
    sets.push("updated_at = ?");
    params.push(nowIso(), userId);
    run(`UPDATE profiles SET ${sets.join(", ")} WHERE user_id = ?`, params);
  }
  return getProfile(userId);
}

/** Mark one journey step done, merging rather than overwriting the others. */
export function markStep(userId, step, value = true) {
  const profile = getProfile(userId);
  return saveProfile(userId, { stepsCompleted: { ...profile.stepsCompleted, [step]: value } });
}

/* --------------------------- saved schemes --------------------------- */

export function listSavedSchemeIds(userId) {
  return query(
    "SELECT scheme_id FROM saved_schemes WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  ).map((row) => row.scheme_id);
}

export function saveScheme(userId, schemeId) {
  run(
    `INSERT INTO saved_schemes (user_id, scheme_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id, scheme_id) DO NOTHING`,
    [userId, schemeId, nowIso()]
  );
  return listSavedSchemeIds(userId);
}

export function unsaveScheme(userId, schemeId) {
  run("DELETE FROM saved_schemes WHERE user_id = ? AND scheme_id = ?", [userId, schemeId]);
  return listSavedSchemeIds(userId);
}

/** Admin console listing. */
export function listUsers({ role, limit = 100 } = {}) {
  const where = role ? "WHERE role = ?" : "";
  const params = role ? [role, limit] : [limit];
  return query(
    `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ?`,
    params
  ).map(publicUser);
}
