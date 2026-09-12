# SchemeSaathi

A full-stack demo that helps first-time applicants find, understand, and apply
for India's SC concessional-finance schemes (NSFDC-style micro-finance, term
loans, education and skill loans, and Mahila schemes).

It pairs a **React + Vite** single-page app with a real **Node/Express + SQLite**
API: JWT auth over an httpOnly cookie, a transparent rule-based scheme matcher,
a server-side EMI/amortisation engine, partner geo-search with lender-health
exclusion, and a full loan-application workflow (document checklists + an
audited status state machine) with an officer/admin console.

Available in **English, Hindi, and Marathi**.

---

## Stack

| Layer     | Tech                                                                    |
| --------- | ----------------------------------------------------------------------- |
| Client    | React 19, Vite 8, React Router 7, Tailwind CSS 3, Recharts, Leaflet     |
| Server    | Node (Express 5), better-sqlite3, zod, jsonwebtoken, bcryptjs, helmet   |
| Database  | SQLite (file-based; `:memory:` for tests)                               |

The client talks to the API through same-origin `/api` calls with
`credentials: "include"`. In development, Vite proxies `/api` to the API on port
4000; in production the API can serve the built SPA itself (`SERVE_CLIENT=1`).

---

## Prerequisites

- Node.js 20+ (uses the built-in `node --test` runner and `node --watch`)
- npm

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. (Optional) create a local .env — safe defaults work without one
cp .env.example .env

# 3. Seed the SQLite database with the scheme catalogue + demo users
npm run db:seed

# 4. Run the API and the Vite dev server together
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000 (the dev server proxies `/api` here)

### Demo accounts

Seeded when `SEED_DEMO_USERS` is on (default in development). Password for all:
**`demo1234`**.

| Email                 | Role      | Notes                       |
| --------------------- | --------- | --------------------------- |
| `asha@example.com`    | applicant | Marathi UI, sample apps     |
| `ravi@example.com`    | applicant | Hindi UI, sample apps       |
| `officer@example.com` | officer   | Review queue + decisions    |
| `admin@example.com`   | admin     | Officer powers + user list  |

The Login page has one-click buttons that fill these in.

---

## Scripts

| Script               | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `npm run dev`        | API (`node --watch`) + Vite dev server, concurrently               |
| `npm run dev:server` | API only                                                           |
| `npm run dev:client` | Vite only                                                          |
| `npm run build`      | Build the client into `dist/`                                      |
| `npm start`          | Run the API in production mode (serves `dist/` when built)         |
| `npm run db:migrate` | Create/upgrade the SQLite schema                                   |
| `npm run db:seed`    | Migrate + load the scheme catalogue and demo data                  |
| `npm run db:reset`   | Delete the DB file and re-seed from scratch                        |
| `npm test`           | Run the server test suite against an in-memory DB                  |
| `npm run lint`       | ESLint over the whole repo                                         |

---

## Configuration

All configuration is via environment variables — see [`.env.example`](.env.example)
for the full list with defaults. The essentials:

- **`JWT_SECRET`** — required in production; the server refuses to boot without
  it. Any value works in development (a built-in dev secret is used, with a
  warning).
- **`DB_PATH`** — SQLite file path, or `:memory:`. Defaults to
  `./data/schemesaathi.db`.
- **`CORS_ORIGINS`** — comma-separated browser origins allowed to send cookies.
- **`CROSS_SITE_COOKIES`** — set to `1` for split-host deploys (client and API
  on different domains) so cookies go out as `SameSite=None; Secure`.
- **`SERVE_CLIENT`** — set to `1` to have the API serve the built SPA from
  `dist/` (single-service deploy). Defaults on in production.

---

## API surface

All routes are under `/api`. A few highlights:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET  /schemes`, `GET /schemes/:id`
- `POST /recommendations` — run the matcher (works for guests; saved for users)
- `POST /emi/calculate` — server-side amortisation with scheme-aware warnings
- `GET  /partners?lat&lng&schemeId&sort` — distance + High-NPA exclusion
- `GET  /geo/lookup?q=` — city/pincode geocoder
- `GET  /dashboard` — one call that assembles the applicant home screen
- `POST /applications`, `GET /applications/:id`,
  `POST /applications/:id/transitions`,
  `PATCH /applications/:id/documents/:documentId`
- `GET  /admin/overview`, `GET /admin/queue` (officer/admin only)

### Note on document uploads

Document uploads are **metadata-only**. The demo records a filename, size, and
status against each checklist item to drive the workflow (and the "documents
complete" gate before submission), but **no file bytes are ever stored or
transmitted**. Wiring real object storage would be a drop-in change at the
`updateDocument` service boundary.

---

## Testing

```bash
npm test
```

Runs `node --test` with `NODE_ENV=test`, which forces an in-memory SQLite
database — your real `data/schemesaathi.db` is never touched. Coverage includes
the amortisation engine, the scheme matcher, and full API integration tests
(auth, recommendations, EMI, partner exclusion, and the application state
machine including a rejection path).

---

## Production build & deploy

**Single service** (API serves the SPA):

```bash
npm run build
JWT_SECRET=<generated> SERVE_CLIENT=1 NODE_ENV=production npm start
```

**Split hosting** (static client + separate API): deploy `dist/` to a static
host, deploy the `server/` process elsewhere, point the client's `/api` at the
API host, and set `CORS_ORIGINS` + `CROSS_SITE_COOKIES=1` on the API.

Generate a production secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Project layout

```
schemesaathi/
├── server/            Express API
│   ├── app.js         app factory (test-mountable)
│   ├── index.js       process entry point
│   ├── db/            migrate + seed
│   ├── routes/        HTTP layer (thin; validation via zod)
│   ├── services/      business logic (matcher, amortisation, applications…)
│   ├── data/          scheme/partner/geo seed catalogues
│   └── tests/         node --test suites
├── src/               React client
│   ├── pages/         route screens
│   ├── components/    shared UI
│   ├── context/       auth + app state
│   ├── hooks/         useFetch
│   ├── i18n/          en / hi / mr translations
│   └── lib/api.js     typed fetch wrapper
└── .env.example       configuration reference
```
