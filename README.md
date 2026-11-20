# Equipora API — Equipment Rental Platform

Express, MongoDB and TypeScript backend for Programming Hero Assignment 9, Category 003.

## Status

Accepted live infrastructure: https://api.mziae.com, Node 22.23.5 with Passenger on ExonHost. The F1 business API changes in this working tree are **local only** and have not been deployed over E8. Existing Atlas access, production credentials, DNS, SSL, website and Netlify fallback remain unchanged.

## Local functionality

- Better Auth email/password and Google integration, MongoDB adapter and signed JWTs.
- Active-session and current-role enforcement with customer/owner/admin middleware.
- Approved equipment catalog; backend search, filtering, sorting and pagination.
- Owner equipment creation, editing and deletion; admin moderation and user-role management.
- Customer favorites, safe profile updates, scoped rentals and payments.
- Transactional inventory holds and duration/quantity pricing; Stripe test Checkout, signed idempotent webhook fulfillment and safe hold cancellation.
- Owner/admin database-derived analytics.
- Existing health and bounded diagnostic endpoints remain protected.

F2 verified real Google OAuth, imgbb upload and Stripe sandbox Checkout/webhooks using disposable local data. F3 adds final QA and release preparation. These results do not establish hosted provider acceptance; no production users, roles, bookings or equipment were seeded.

## Safe local development

Use Node 22.23.5 or compatible supported Node >=22.12. Install with `npm ci`, then run:

```powershell
npm run dev:isolated
```

This starts a loopback-only API on port 5090 and a disposable MongoDB replica set. It never loads `.env`, overrides any inherited database URI, and deletes inherited provider/diagnostic variables from its process. The first run may download MongoDB's test binary (approximately 780 MB). Its fixture accounts all use `LocalDemo123` and emails `customer@example.test`, `owner@example.test`, and `admin@example.test`; these exist only in the ephemeral database. Do not create these accounts in production.

The ordinary `npm run dev` loads the existing `.env`. **Do not use it for development if that file points at production.** No provider secret is needed for the isolated command. It generates a temporary Better Auth secret in memory and removes the test database when stopped.

## Validation

```powershell
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

`npm test` uses a separate ephemeral replica set for marketplace tests, covering registration, JWT/roles, session revocation, filtering, moderation, favorites, concurrent reservations and signed duplicate-safe payment fulfillment. Existing diagnostic regression tests use mocks. Neither test path imports `.env` or writes to Atlas.

Email-template browser acceptance belongs to this repository. With local Chrome installed,
run `npm run test:email-browser` for explicit test typechecking plus real Playwright/axe
checks of both recipient variants at mobile, tablet and desktop widths. It renders
synthetic HTML locally without SMTP or an application server. `npm run test:all`
runs the backend regressions and these browser cases. Generated output stays in
ignored `.netlify/email-browser`; no adjacent client checkout is required.

## Contract and configuration

See [F1 audit and requirements](docs/F1-audit-and-plan.md), [deployment and rollback](docs/F1-deployment-readiness.md) and [manual provider setup](docs/F1-provider-setup.md). `.env.example` contains names and blank placeholders only. The frontend uses same-origin gateways; no diagnostic, MongoDB, Google secret, imgbb key or Stripe secret belongs in `NEXT_PUBLIC_*`.

## Packages

Express 5, MongoDB native driver, Better Auth MongoDB adapter/JWT plugin, jose, Stripe SDK, Zod, CORS and dotenv. TypeScript, tsx and mongodb-memory-server support local development/tests. Existing Netlify wrapper dependencies and Passenger startup are preserved.

Production release, secrets/origin changes, provider settings, admin provisioning, commits, pushes and Vercel publication require separate owner approval.

## F3 release-readiness evidence

- [Complete assignment compliance matrix](docs/F3-requirements-matrix.md)
- [Functional, visual and security QA](docs/F3-qa-report.md)
- [Controlled release, environment map, Admin and rollback plan](docs/F3-release-plan.md)

For private provider testing, use `scripts/local-providers.ps1 -Action Set -Provider Google|Imgbb|Stripe` through PowerShell (choose one provider, not the literal pipe expression). Prompts are hidden; saved values are Windows-user DPAPI-encrypted outside both repositories. Run via `-Action Run`; use `-Action Status` for booleans only. Existing `.env` stays unchanged. Supported backend test key prefixes are sk_test_ and rkcs_test_; claimable sandboxes expire unless claimed and are not automatically suitable for hosted use. No live payments are enabled.

The rubric's meaningful commit counts remain unmet (client 1/server 8). Frontend live URL, hosted business/provider acceptance and secure initial Admin provisioning are pending owner approvals. Do not submit local fixture credentials as production access.
## F5 local visual acceptance

See [F5 implementation and QA](docs/F5-implementation-and-QA.md) and [resource inventory](docs/F5-resource-inventory.md). The optional isolated preview uses scripts/dev-isolated.ts --catalog=f5 for 30 synthetic records; the default six-item test baseline is preserved. No production database is used. Owner visual acceptance and separate release approval remain required.


## F6.4 local closure and release preparation

Current evidence is in [the consolidated matrix](docs/F6-deficiencies.md), [F6.4 report](docs/F6.4-report.md), [exact commit scopes](docs/F6.4-commit-plan.json) and [release/rollback plan](docs/F6.4-release-plan.md). All four optional features pass local/mock acceptance; production scheduling and real delivery are disabled and need reviewed integration. BetterAuth 1.7.25 keeps login-email changes disabled until a secure reauthentication/address-confirmation/session workflow is approved. No ordinary login email-verification/reset gate is added.

Prepare a backend candidate locally with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-exonhost-package.ps1`. It builds compiled JavaScript, uses portable ZIP/manifest paths and excludes private/dev/operator files. Inspect and verify every hash before any approved upload. This command is local preparation, not deployment; Linux production dependency installation and actual hosted smoke tests are still required. Never run local fixtures against Atlas or submit fixture credentials.
