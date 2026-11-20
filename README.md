# Equipora API — Equipment Rental Platform

Express 5 + MongoDB + TypeScript backend for **Equipora**, an equipment rental marketplace that connects
equipment owners with customers (Programming Hero Assignment 9, Category 003).

| | |
|---|---|
| Live API | https://api.mziae.com (health: https://api.mziae.com/api/health) |
| Live frontend | https://equipora-client.vercel.app |
| Frontend repository | https://github.com/rezaulhasan1369/equipora-client |
| Backend repository | https://github.com/rezaulhasan1369/equipora-server |
| Hosting | ExonHost cPanel, Node.js 22.23.5 under Passenger (isolated application, own subdomain) |
| Database | MongoDB Atlas (dedicated Equipora project, restricted network access) |

## Features

- **Authentication** — Better Auth (email/password + Google provider) with the MongoDB adapter. Registration
  requires name, email, HTTPS photo URL and a password with upper- and lower-case letters (min. 6). New accounts
  are always `customer`; the role cannot be chosen by the client.
- **JWT + role middleware** — Better Auth JWT plugin (EdDSA, 15-minute tokens, issuer/audience = frontend origin).
  `verifyToken` checks the signature *and* that the referenced session is still active, then loads the role from
  the database. `verifyRenter`, `verifyOwner`, `verifyAdmin` enforce roles server-side.
- **Catalog** — approved, non-deleted equipment only; server-side search (name/location/category), filters
  (category, rental type, price range, availability), sorting (price, newest) and pagination; six featured items.
- **Owners** — create/update/delete own equipment (new listings start `pending`), ImgBB image upload, own rentals,
  database-derived earnings analytics.
- **Admins** — user role/disable management (revokes sessions), equipment approve/reject, rental status
  management, platform analytics.
- **Customers** — favorites, read-only price quotes, availability calendar, Stripe Checkout (test mode),
  rental history with timeline, receipts and notifications.
- **Booking integrity** — authoritative integer-cent pricing, transactional inventory holds (no overselling),
  signature-verified idempotent Stripe webhook fulfillment, hold release on cancellation/expiry.
- **Registration photo upload** — `POST /api/registration-image` (origin-checked, quota-limited, file-signature
  validated, fixed ImgBB destination; the ImgBB key never leaves the server).

## API overview

All routes are under `/api`. "JWT" = `Authorization: Bearer <token>` from Better Auth `/api/auth/token`.

| Method & path | Access |
|---|---|
| `GET /health` | public |
| `GET /health/db` | diagnostic key only (404 otherwise) |
| `ALL /auth/*` | Better Auth (sign-up/in/out, session, token, JWKS, Google) |
| `POST /registration-image` | frontend origin only, quota-limited |
| `GET /equipment` (`search, category, rentalType, min, max, available, sort, page, limit, featured`) | public |
| `GET /equipment/selection?ids=` | public (comparison/recently viewed, max 8 IDs) |
| `GET /equipment/:id` | JWT |
| `GET /equipment/:id/availability` | JWT |
| `POST /equipment/:id/quote` | JWT, customer (read-only estimate) |
| `GET,PATCH /me` | JWT (name/image/phone/address only) |
| `GET /favorites`, `PUT,DELETE /favorites/:id` | JWT, customer |
| `GET /owner/equipment`, `POST /equipment` | JWT, owner |
| `POST /uploads` | JWT (equipment image upload to ImgBB) |
| `PATCH,DELETE /equipment/:id` | JWT, owning owner or admin |
| `POST /checkout`, `GET /checkout/holds`, `POST /checkout/:id/cancel` | JWT, customer |
| `GET /payments/:sessionId` | JWT, customer (own payment) |
| `POST /payments/webhook` | Stripe signature only |
| `GET /rentals`, `GET /rentals/:id/activity`, `GET /rentals/:id/receipt` | JWT, scoped by role/participation |
| `GET /notifications`, `PATCH /notifications/:id/read` | JWT |
| `GET /analytics` | JWT, owner (own) or admin (platform) |
| `GET /admin/users`, `PATCH /admin/users/:id` | JWT, admin |
| `GET /admin/equipment`, `PATCH /admin/equipment/:id/status`, `PATCH /admin/rentals/:id` | JWT, admin |

Every API response is `Cache-Control: no-store` with `nosniff`, `X-Frame-Options: DENY` and no `X-Powered-By`.
CORS allows exactly one configured frontend origin.

## Environment variables (names only — never commit values)

| Name | Purpose |
|---|---|
| `NODE_ENV` | `production` on the host |
| `PORT` | set by the host (Passenger); not configured manually |
| `MONGODB_URI` | Atlas connection string for the dedicated least-privilege user |
| `DIAGNOSTIC_KEY` | protects `/api/health/db` |
| `FRONTEND_URL`, `AUTH_PUBLIC_URL`, `CORS_ORIGIN` | exact frontend origin (`https://equipora-client.vercel.app`) |
| `BETTER_AUTH_SECRET` | stable ≥32-character signing secret (also encrypts JWT keys — never rotate casually) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth web client |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe **test-mode** key (`sk_test_`/`rkcs_test_`) and endpoint signing secret |
| `IMGBB_API_KEY` | ImgBB uploads |

`.env.example` lists the names with blank values.

## Local development

Node 22.12+ (production uses 22.23.5). `npm ci`, then:

```powershell
npm run dev:isolated   # loopback API on :5090 with a disposable in-memory MongoDB and fixtures
```

The isolated mode never reads `.env` and refuses database URIs. Fixture accounts (`customer@`, `owner@`,
`admin@example.test`, password `LocalDemo123`) exist only in that throwaway database — never in production.
Add `--catalog=f5 --experience=f74` for the 30-item catalog and rental fixtures used by the full browser suite.
`npm run dev` uses `.env`; do not point it at production.

## Validation

```powershell
npm run typecheck
npm test               # 42 tests: API, security, hosted-auth configuration, F13 operator script, diagnostics
npm run build
npm audit --omit=dev
npm run test:email-browser   # optional: email template rendering (local Chrome)
```

Tests use ephemeral in-memory MongoDB replica sets and never touch Atlas.

## Deployment (ExonHost)

1. Build a release package from a committed revision:
   `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-exonhost-package.ps1`
   (contains only `dist/`, `package.json`, `package-lock.json`, `passenger.cjs` and a SHA-256 manifest).
2. Back up the current application files and `.env` to a private directory outside the public roots.
3. Upload/extract into a staging folder inside the application directory, verify every manifest hash, then copy
   into place. If dependencies changed, run **Run NPM Install** in cPanel → Setup Node.js App.
4. Restart only this application by updating `tmp/restart.txt`; verify `/api/health`, database health and CORS.
5. Rollback: restore the backed-up files/`.env` and restart. The database is never rolled back or dropped.

## Initial Admin (owner-approved, one-time)

`scripts/f13-initial-admin.mjs` promotes one **existing** customer account to the first Admin: dry run by default,
explicit hash confirmation, one-shot guards, single MongoDB transaction (bootstrap marker + role change + session
revocation) and a matching one-shot rollback. It never accepts passwords or prints emails. See
[docs/F13-admin-promotion-plan.md](docs/F13-admin-promotion-plan.md). Running it in production requires owner approval.

## Packages

express, mongodb, better-auth (MongoDB adapter, JWT plugin), jose, stripe, zod, cors, dotenv, node-cron and
nodemailer (completion jobs/email — implemented with mocks, not activated in production). Development:
typescript, tsx, mongodb-memory-server, Playwright, axe-core.

## Documentation

- [Requirement matrix](docs/F3-requirements-matrix.md), [deficiency tracking](docs/F6-deficiencies.md)
- [Final completion report (F14)](docs/F14-final-report.md)
- [F13 Admin promotion plan](docs/F13-admin-promotion-plan.md)
- Historical phase reports F1–F7 in `docs/`
