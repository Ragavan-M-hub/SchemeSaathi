// server/services/applications.js
// The loan-application workflow: reference numbers, a document checklist
// derived from the scheme, an explicit status state machine, and an append-only
// event log that the UI renders as a timeline.
//
// Note on documents: this build records upload *metadata* (name, size, status)
// rather than storing files. That keeps the demo deployable anywhere while the
// officer review flow stays realistic — swap `updateDocument` for a real
// storage write and nothing else changes.

import { query, one, run, tx, nowIso, newId } from "../db/index.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { computeAmortization } from "./amortization.js";
import { getScheme } from "./schemes.js";
import { partnerExists } from "./partners.js";

export const STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  DOCUMENTS_PENDING: "documents_pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DISBURSED: "disbursed",
  WITHDRAWN: "withdrawn",
};

export const DOC_STATUS = {
  PENDING: "pending",
  UPLOADED: "uploaded",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

/**
 * Allowed status moves and who may make them.
 *   applicant — the owner of the application
 *   officer   — officer or admin (admins inherit officer powers)
 */
export const TRANSITIONS = {
  [STATUS.DRAFT]: {
    [STATUS.SUBMITTED]: ["applicant"],
    [STATUS.WITHDRAWN]: ["applicant"],
  },
  [STATUS.SUBMITTED]: {
    [STATUS.UNDER_REVIEW]: ["officer"],
    [STATUS.DOCUMENTS_PENDING]: ["officer"],
    [STATUS.REJECTED]: ["officer"],
    [STATUS.WITHDRAWN]: ["applicant"],
  },
  [STATUS.UNDER_REVIEW]: {
    [STATUS.DOCUMENTS_PENDING]: ["officer"],
    [STATUS.APPROVED]: ["officer"],
    [STATUS.REJECTED]: ["officer"],
    [STATUS.WITHDRAWN]: ["applicant"],
  },
  [STATUS.DOCUMENTS_PENDING]: {
    // The applicant pushes it back for review once the checklist is complete.
    [STATUS.UNDER_REVIEW]: ["applicant", "officer"],
    [STATUS.REJECTED]: ["officer"],
    [STATUS.WITHDRAWN]: ["applicant"],
  },
  [STATUS.APPROVED]: {
    [STATUS.DISBURSED]: ["officer"],
  },
  [STATUS.REJECTED]: {},
  [STATUS.DISBURSED]: {},
  [STATUS.WITHDRAWN]: {},
};

export const TERMINAL_STATUSES = Object.entries(TRANSITIONS)
  .filter(([, next]) => Object.keys(next).length === 0)
  .map(([status]) => status);

const isOfficerRole = (role) => role === "officer" || role === "admin";

/** What this actor may do to this application right now. */
export function allowedTransitions(status, { role, isOwner }) {
  const next = TRANSITIONS[status] ?? {};
  return Object.entries(next)
    .filter(([, actors]) =>
      actors.some((actor) =>
        actor === "officer" ? isOfficerRole(role) : isOwner && role === "applicant"
      )
    )
    .map(([to]) => to);
}

/* ------------------------------ mapping ------------------------------ */

export function rowToApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    referenceNo: row.reference_no,
    userId: row.user_id,
    schemeId: row.scheme_id,
    schemeName: row.scheme_name ?? undefined,
    partnerId: row.partner_id,
    partnerName: row.partner_name ?? undefined,
    applicantName: row.applicant_name ?? undefined,
    applicantEmail: row.applicant_email ?? undefined,
    amountRequested: row.amount_requested,
    tenureYears: row.tenure_years,
    interestRate: row.interest_rate,
    moratoriumMonths: row.moratorium_months,
    emi: row.emi,
    purposeNote: row.purpose_note,
    status: row.status,
    officerNote: row.officer_note,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentCount: row.doc_count ?? undefined,
    documentsReady: row.doc_ready ?? undefined,
  };
}

const SELECT = `
  SELECT a.*,
         s.name AS scheme_name,
         p.name AS partner_name,
         u.name AS applicant_name,
         u.email AS applicant_email,
         (SELECT COUNT(*) FROM application_documents d WHERE d.application_id = a.id) AS doc_count,
         (SELECT COUNT(*) FROM application_documents d
           WHERE d.application_id = a.id AND d.status IN ('uploaded', 'verified')) AS doc_ready
  FROM applications a
  JOIN schemes s ON s.id = a.scheme_id
  JOIN users u ON u.id = a.user_id
  LEFT JOIN partners p ON p.id = a.partner_id
`;

const rowToDocument = (row) => ({
  id: row.id,
  name: row.name,
  status: row.status,
  fileName: row.file_name,
  fileSize: row.file_size,
  note: row.note,
  uploadedAt: row.uploaded_at,
  updatedAt: row.updated_at,
});

const rowToEvent = (row) => ({
  id: row.id,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  note: row.note,
  actorRole: row.actor_role,
  actorName: row.actor_name ?? null,
  createdAt: row.created_at,
});

/* ------------------------------- reads ------------------------------- */

export function listApplications({ userId, status, schemeId, q, limit = 100 } = {}) {
  const where = [];
  const params = [];

  if (userId) {
    where.push("a.user_id = ?");
    params.push(userId);
  }
  if (status) {
    where.push("a.status = ?");
    params.push(status);
  }
  if (schemeId) {
    where.push("a.scheme_id = ?");
    params.push(schemeId);
  }
  if (q) {
    where.push("(a.reference_no LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  params.push(limit);

  return query(
    `${SELECT}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.created_at DESC
     LIMIT ?`,
    params
  ).map(rowToApplication);
}

export function getApplicationRow(id) {
  return one(`${SELECT} WHERE a.id = ? OR a.reference_no = ?`, [id, id]);
}

/** Full detail: application + checklist + timeline + the scheme it targets. */
export function getApplication(id, actor = {}) {
  const row = getApplicationRow(id);
  if (!row) throw notFound("Application not found", "application_not_found");

  const isOwner = actor.id === row.user_id;
  if (!isOwner && !isOfficerRole(actor.role)) {
    throw forbidden("This application belongs to another applicant");
  }

  const documents = query(
    "SELECT * FROM application_documents WHERE application_id = ? ORDER BY sort_order, name",
    [row.id]
  ).map(rowToDocument);

  const events = query(
    `SELECT e.*, u.name AS actor_name
       FROM application_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.application_id = ?
      ORDER BY e.created_at, e.id`,
    [row.id]
  ).map(rowToEvent);

  const missingDocuments = documents
    .filter((d) => d.status === DOC_STATUS.PENDING || d.status === DOC_STATUS.REJECTED)
    .map((d) => d.name);

  const application = rowToApplication(row);

  return {
    ...application,
    scheme: getScheme(row.scheme_id),
    documents,
    events,
    missingDocuments,
    readyToSubmit: missingDocuments.length === 0,
    amortization: computeAmortization({
      principal: application.amountRequested,
      annualRate: application.interestRate,
      tenureYears: application.tenureYears,
      moratoriumMonths: application.moratoriumMonths,
    }),
    allowedTransitions: allowedTransitions(application.status, {
      role: actor.role,
      isOwner,
    }),
  };
}

/** Counts by status (+ money totals), for the applicant and officer dashboards. */
export function applicationStats({ userId } = {}) {
  const where = userId ? "WHERE user_id = ?" : "";
  const params = userId ? [userId] : [];

  const byStatus = Object.fromEntries(
    query(`SELECT status, COUNT(*) AS count FROM applications ${where} GROUP BY status`, params).map(
      (row) => [row.status, row.count]
    )
  );

  const totals = one(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(amount_requested), 0) AS requested,
            COALESCE(SUM(CASE WHEN status IN ('approved', 'disbursed')
                              THEN amount_requested ELSE 0 END), 0) AS approved
       FROM applications ${where}`,
    params
  );

  return {
    byStatus: Object.fromEntries(
      Object.values(STATUS).map((status) => [status, byStatus[status] ?? 0])
    ),
    total: totals?.total ?? 0,
    amountRequested: totals?.requested ?? 0,
    amountApproved: totals?.approved ?? 0,
  };
}

/* ------------------------------- writes ------------------------------- */

/**
 * `SS-2026-0001`, sequential per calendar year. Called inside the creating
 * transaction; the UNIQUE index on reference_no is the real guard, and the
 * retry loop covers the race between two concurrent inserts.
 */
function nextReferenceNo(year) {
  const row = one(
    `SELECT reference_no FROM applications
      WHERE reference_no LIKE ?
      ORDER BY reference_no DESC LIMIT 1`,
    [`SS-${year}-%`]
  );
  const last = row ? Number(row.reference_no.split("-")[2]) : 0;
  return `SS-${year}-${String(last + 1).padStart(4, "0")}`;
}

export function createApplication(userId, input = {}) {
  const scheme = getScheme(input.schemeId);
  if (!scheme) throw badRequest("Unknown scheme", "scheme_not_found");
  if (input.partnerId && !partnerExists(input.partnerId)) {
    throw badRequest("Unknown partner", "partner_not_found");
  }

  // Fall back to the scheme's own terms for anything the applicant left blank.
  const amount = Math.round(Number(input.amountRequested) || scheme.loan.min);
  const tenureYears = Math.round(Number(input.tenureYears) || scheme.tenureYears);
  const interestRate = Number(input.interestRate ?? scheme.interest.min);
  const moratoriumMonths = Math.round(
    Number(input.moratoriumMonths ?? scheme.moratoriumMonths) || 0
  );

  const { emi } = computeAmortization({
    principal: amount,
    annualRate: interestRate,
    tenureYears,
    moratoriumMonths,
  });

  const now = nowIso();
  const year = now.slice(0, 4);
  const id = newId();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      tx(() => {
        run(
          `INSERT INTO applications (id, reference_no, user_id, scheme_id, partner_id,
                                     amount_requested, tenure_years, interest_rate,
                                     moratorium_months, emi, purpose_note, status,
                                     created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
          [
            id, nextReferenceNo(year), userId, scheme.id, input.partnerId ?? null,
            amount, tenureYears, interestRate, moratoriumMonths, emi,
            input.purposeNote ?? null, now, now,
          ]
        );

        // The checklist is a snapshot: editing the scheme later must not change
        // what an in-flight application was asked to provide.
        scheme.documents.forEach((name, index) => {
          run(
            `INSERT INTO application_documents (id, application_id, name, status, sort_order, updated_at)
             VALUES (?, ?, ?, 'pending', ?, ?)`,
            [newId(), id, name, index, now]
          );
        });

        recordEvent(id, {
          fromStatus: null,
          toStatus: STATUS.DRAFT,
          note: "Application created",
          actor: { id: userId, role: "applicant" },
          at: now,
        });
      });
      return getApplication(id, { id: userId, role: "applicant" });
    } catch (error) {
      const clash = String(error?.message ?? "").includes("reference_no");
      if (!clash || attempt === 4) throw error;
    }
  }
  // Unreachable: the loop either returns or rethrows.
  throw badRequest("Could not allocate a reference number", "reference_no_exhausted");
}

const APPLICATION_PATCH_COLUMNS = {
  partnerId: "partner_id",
  amountRequested: "amount_requested",
  tenureYears: "tenure_years",
  interestRate: "interest_rate",
  moratoriumMonths: "moratorium_months",
  purposeNote: "purpose_note",
};

/** Only a draft is editable — after submission the terms are what was reviewed. */
export function updateApplication(id, patch, actor) {
  const row = getApplicationRow(id);
  if (!row) throw notFound("Application not found", "application_not_found");
  if (row.user_id !== actor.id) throw forbidden("This application belongs to another applicant");
  if (row.status !== STATUS.DRAFT) {
    throw badRequest("Only draft applications can be edited", "not_editable");
  }
  if (patch.partnerId && !partnerExists(patch.partnerId)) {
    throw badRequest("Unknown partner", "partner_not_found");
  }

  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(APPLICATION_PATCH_COLUMNS)) {
    if (patch[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(patch[key]);
    }
  }

  if (sets.length > 0) {
    const merged = {
      principal: patch.amountRequested ?? row.amount_requested,
      annualRate: patch.interestRate ?? row.interest_rate,
      tenureYears: patch.tenureYears ?? row.tenure_years,
      moratoriumMonths: patch.moratoriumMonths ?? row.moratorium_months,
    };
    sets.push("emi = ?", "updated_at = ?");
    params.push(computeAmortization(merged).emi, nowIso(), row.id);
    run(`UPDATE applications SET ${sets.join(", ")} WHERE id = ?`, params);
  }
  return getApplication(row.id, actor);
}

function recordEvent(applicationId, { fromStatus, toStatus, note, actor, at }) {
  run(
    `INSERT INTO application_events (id, application_id, from_status, to_status, note,
                                     actor_user_id, actor_role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId(), applicationId, fromStatus, toStatus, note ?? null, actor?.id ?? null, actor?.role ?? null, at]
  );
}

/**
 * Move an application through the state machine. Every move is authorised
 * against TRANSITIONS and written to the event log in the same transaction.
 */
export function transitionApplication(id, { to, note }, actor) {
  const row = getApplicationRow(id);
  if (!row) throw notFound("Application not found", "application_not_found");

  const isOwner = row.user_id === actor.id;
  if (!isOwner && !isOfficerRole(actor.role)) {
    throw forbidden("This application belongs to another applicant");
  }
  if (!Object.values(STATUS).includes(to)) {
    throw badRequest(`Unknown status "${to}"`, "unknown_status");
  }

  const permitted = allowedTransitions(row.status, { role: actor.role, isOwner });
  if (!permitted.includes(to)) {
    throw badRequest(`Cannot move an application from ${row.status} to ${to}`, "invalid_transition", {
      from: row.status,
      allowed: permitted,
    });
  }

  // Submitting (or re-submitting after a document request) requires a complete
  // checklist — the same rule the UI shows next to the disabled button.
  if (to === STATUS.SUBMITTED || (to === STATUS.UNDER_REVIEW && isOwner)) {
    const missing = query(
      `SELECT name FROM application_documents
        WHERE application_id = ? AND status IN ('pending', 'rejected')
        ORDER BY sort_order`,
      [row.id]
    ).map((d) => d.name);
    if (missing.length > 0) {
      throw badRequest("Some documents are still outstanding", "documents_incomplete", { missing });
    }
  }

  const now = nowIso();
  const sets = ["status = ?", "updated_at = ?"];
  const params = [to, now];

  if (to === STATUS.SUBMITTED) {
    sets.push("submitted_at = ?");
    params.push(now);
  }
  if ([STATUS.APPROVED, STATUS.REJECTED, STATUS.DISBURSED].includes(to)) {
    sets.push("decided_at = ?");
    params.push(now);
  }
  if (isOfficerRole(actor.role) && note) {
    sets.push("officer_note = ?");
    params.push(note);
  }
  params.push(row.id);

  tx(() => {
    run(`UPDATE applications SET ${sets.join(", ")} WHERE id = ?`, params);
    recordEvent(row.id, {
      fromStatus: row.status,
      toStatus: to,
      note,
      actor: { id: actor.id, role: isOfficerRole(actor.role) ? actor.role : "applicant" },
      at: now,
    });
  });

  return getApplication(row.id, actor);
}

/**
 * Applicants mark items uploaded; officers verify or reject them.
 * A rejected document sends the application back to `documents_pending`.
 */
export function updateDocument(applicationId, documentId, patch, actor) {
  const row = getApplicationRow(applicationId);
  if (!row) throw notFound("Application not found", "application_not_found");

  const isOwner = row.user_id === actor.id;
  const isOfficer = isOfficerRole(actor.role);
  if (!isOwner && !isOfficer) throw forbidden("This application belongs to another applicant");

  const doc = one("SELECT * FROM application_documents WHERE id = ? AND application_id = ?", [
    documentId,
    row.id,
  ]);
  if (!doc) throw notFound("Document not found", "document_not_found");

  const status = patch.status;
  if (!isOfficer && (status === DOC_STATUS.VERIFIED || status === DOC_STATUS.REJECTED)) {
    throw forbidden("Only an officer can verify or reject a document");
  }
  if (isOwner && !isOfficer && TERMINAL_STATUSES.includes(row.status)) {
    throw badRequest("This application is closed", "application_closed");
  }

  const now = nowIso();
  const nextStatus = status ?? doc.status;
  const uploading = nextStatus === DOC_STATUS.UPLOADED;

  tx(() => {
    run(
      `UPDATE application_documents
          SET status = ?, file_name = ?, file_size = ?, note = ?, uploaded_at = ?, updated_at = ?
        WHERE id = ?`,
      [
        nextStatus,
        patch.fileName ?? doc.file_name,
        patch.fileSize ?? doc.file_size,
        patch.note ?? doc.note,
        uploading ? now : doc.uploaded_at,
        now,
        doc.id,
      ]
    );

    // An officer rejecting a document reopens the checklist for the applicant.
    if (nextStatus === DOC_STATUS.REJECTED && row.status !== STATUS.DOCUMENTS_PENDING) {
      const reopenable = [STATUS.SUBMITTED, STATUS.UNDER_REVIEW];
      if (reopenable.includes(row.status)) {
        run("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?", [
          STATUS.DOCUMENTS_PENDING,
          now,
          row.id,
        ]);
        recordEvent(row.id, {
          fromStatus: row.status,
          toStatus: STATUS.DOCUMENTS_PENDING,
          note: `${doc.name} needs to be re-submitted`,
          actor,
          at: now,
        });
      }
    } else {
      run("UPDATE applications SET updated_at = ? WHERE id = ?", [now, row.id]);
    }
  });

  return getApplication(row.id, actor);
}

/** Officer queue: everything waiting on a human decision, oldest first. */
export function reviewQueue({ limit = 50 } = {}) {
  return query(
    `${SELECT}
      WHERE a.status IN ('submitted', 'under_review', 'documents_pending')
      ORDER BY CASE a.status WHEN 'submitted' THEN 0 WHEN 'under_review' THEN 1 ELSE 2 END,
               a.submitted_at, a.created_at
      LIMIT ?`,
    [limit]
  ).map(rowToApplication);
}
