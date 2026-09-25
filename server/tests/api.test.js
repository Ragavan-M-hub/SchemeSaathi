// server/tests/api.test.js
// End-to-end API tests driven in-process: the real Express app is mounted on an
// ephemeral port and exercised with fetch. The token comes back in the login/
// register body, so we send it as `Authorization: Bearer` (no cookie jar needed).
//
// DB_PATH=:memory: is forced by the test runner (NODE_ENV=test), so this never
// touches the developer's real database.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { seedAll } from "../db/seed.js";
import { closeDb } from "../db/index.js";

let server;
let base;

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  await seedAll({ reset: true, demoUsers: true });
  const app = createApp({ runMigrations: false });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server?.close();
  closeDb();
});

test("health endpoint is public and OK", async () => {
  const { status, body } = await api("/health");
  assert.equal(status, 200);
  assert.ok(body.ok ?? body.status ?? true);
});

test("register + me round-trips a new applicant", async () => {
  const email = `test_${Date.now()}@example.com`;
  const reg = await api("/auth/register", {
    method: "POST",
    body: { name: "Test User", email, password: "supersecret" },
  });
  assert.equal(reg.status, 201);
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.role, "applicant");

  const me = await api("/auth/me", { token: reg.body.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, email);
});

test("login rejects a bad password", async () => {
  const { status } = await api("/auth/login", {
    method: "POST",
    body: { email: "asha@example.com", password: "wrong-password" },
  });
  assert.ok(status === 400 || status === 401);
});

test("recommendations work for a guest", async () => {
  const { status, body } = await api("/recommendations", {
    method: "POST",
    body: { purpose: "self-employment", cost: 100000, income: 120000, education: "10th" },
  });
  assert.equal(status, 201);
  assert.ok(Array.isArray(body.ranked));
  assert.ok(body.ranked.length > 0);
});

test("EMI calculation is public and returns a schedule", async () => {
  const { status, body } = await api("/emi/calculate", {
    method: "POST",
    body: { principal: 100000, annualRate: 12, tenureYears: 1, moratoriumMonths: 0 },
  });
  assert.equal(status, 200);
  assert.equal(body.emi, 8885); // closed-form rounded
  assert.equal(body.schedule.length, 12);
});

test("partners exclude High-NPA lenders from the main list", async () => {
  const { status, body } = await api("/partners?lat=19.076&lng=72.877");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.partners));
  assert.ok(body.partners.every((p) => p.health !== "High NPA"));
});

test("protected routes reject anonymous callers", async () => {
  const { status } = await api("/applications");
  assert.equal(status, 401);
});

test("application state machine: submit → review → approve, with a rejection path", async () => {
  // Sign in as an applicant and an officer.
  const applicant = (
    await api("/auth/login", {
      method: "POST",
      body: { email: "asha@example.com", password: "demo1234" },
    })
  ).body;
  const officer = (
    await api("/auth/login", {
      method: "POST",
      body: { email: "officer@example.com", password: "demo1234" },
    })
  ).body;
  assert.ok(applicant.token && officer.token);

  // Pick a scheme the applicant can apply to.
  const recs = await api("/recommendations", {
    method: "POST",
    body: { purpose: "self-employment", cost: 80000, income: 100000, education: "10th" },
  });
  const schemeId = recs.body.ranked[0].id;

  // Create an application (draft).
  const created = await api("/applications", {
    method: "POST",
    token: applicant.token,
    body: { schemeId, amountRequested: 80000, purposeNote: "Test application" },
  });
  assert.equal(created.status, 201);
  const appId = created.body.application.id;
  assert.equal(created.body.application.status, "draft");

  // Mark every document uploaded so the checklist is complete.
  const full = await api(`/applications/${appId}`, { token: applicant.token });
  for (const doc of full.body.application.documents) {
    await api(`/applications/${appId}/documents/${doc.id}`, {
      method: "PATCH",
      token: applicant.token,
      body: { status: "uploaded", fileName: "doc.pdf", fileSize: 1000 },
    });
  }

  // Submit.
  const submitted = await api(`/applications/${appId}/transitions`, {
    method: "POST",
    token: applicant.token,
    body: { to: "submitted" },
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.application.status, "submitted");

  // An applicant cannot approve their own application.
  const illegal = await api(`/applications/${appId}/transitions`, {
    method: "POST",
    token: applicant.token,
    body: { to: "approved" },
  });
  assert.equal(illegal.status, 400);

  // Officer moves it to review, then approves.
  const review = await api(`/applications/${appId}/transitions`, {
    method: "POST",
    token: officer.token,
    body: { to: "under_review" },
  });
  assert.equal(review.body.application.status, "under_review");

  const approved = await api(`/applications/${appId}/transitions`, {
    method: "POST",
    token: officer.token,
    body: { to: "approved", note: "Sanctioned." },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.application.status, "approved");
});

test("officer can reject a submitted application", async () => {
  const applicant = (
    await api("/auth/login", {
      method: "POST",
      body: { email: "ravi@example.com", password: "demo1234" },
    })
  ).body;
  const officer = (
    await api("/auth/login", {
      method: "POST",
      body: { email: "officer@example.com", password: "demo1234" },
    })
  ).body;

  const recs = await api("/recommendations", {
    method: "POST",
    body: { purpose: "self-employment", cost: 60000, income: 90000, education: "10th" },
  });
  const schemeId = recs.body.ranked[0].id;

  const created = await api("/applications", {
    method: "POST",
    token: applicant.token,
    body: { schemeId, amountRequested: 60000 },
  });
  const appId = created.body.application.id;

  const full = await api(`/applications/${appId}`, { token: applicant.token });
  for (const doc of full.body.application.documents) {
    await api(`/applications/${appId}/documents/${doc.id}`, {
      method: "PATCH",
      token: applicant.token,
      body: { status: "uploaded", fileName: "doc.pdf", fileSize: 1000 },
    });
  }
  await api(`/applications/${appId}/transitions`, {
    method: "POST",
    token: applicant.token,
    body: { to: "submitted" },
  });

  const rejected = await api(`/applications/${appId}/transitions`, {
    method: "POST",
    token: officer.token,
    body: { to: "rejected", note: "Does not meet criteria." },
  });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.application.status, "rejected");
  // Terminal: no further transitions offered.
  assert.equal(rejected.body.application.allowedTransitions.length, 0);
});
