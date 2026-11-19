# F3 final local QA and readiness

Date: 2026-11-19 (Asia/Dhaka). Decision: **ready for owner local visual acceptance; not approved or ready for immediate production publication/final submission**. The [complete matrix](F3-requirements-matrix.md) records qualifications; the [release plan](F3-release-plan.md) specifies exact deployment, private configuration and rollback gates.

## Scope and data safety

Preserved E8 production infrastructure, restricted Atlas rules, mziae.com, DNS/SSL, Netlify and Vercel. No production/provider settings changed, no production data writes, no live payments, no commits/pushes/deployments. F2's accepted provider evidence is retained in its report; F3 restarted only local processes with fresh disposable MongoDB fixtures and **no provider credentials** for deterministic QA. The previous ephemeral F2 records are historical test evidence, not production inventory. Browser actions changed only fresh local fixtures.

The user story is Customer discovery/details/favorite/booking/payment/rental history, Owner listing/rental business, and Admin moderation/users/rental management/analytics. Each layer is independently authorized; a protected UI is not evidence of backend access control.

## Executed checks

| Check | Result and scope |
|---|---|
| Backend TypeScript and compiled build | PASS; Node 22.23.5 baseline build/tests and final checks; no source/runtime TLS changes |
| Backend regression suite | 29/29 PASS; strict auth/roles/revocation, profile, catalog, inventory concurrency, signed fulfillment/idempotency, Admin bootstrap and existing actual Netlify handler diagnostics |
| E7/E8 operator safety tests | 22/22 PASS with mocks; no Atlas operation executed |
| Frontend lint/TypeScript | PASS; server has no configured ESLint task, uses strict TypeScript |
| Frontend gateway policy tests | 5/5 PASS |
| Next production build | PASS under Node 22.23.5; dynamic auth/detail/dashboard routes present, no static-export conversion |
| Full browser suite before expanded accessibility checks | 17/17 PASS |
| Final browser suite | 20/20 PASS, including three new role-table accessibility cases and WCAG 2.1 label checks |
| Full and production-only dependency audits | Both repositories: zero current npm findings; no upgrades/overrides applied |
| Passenger compiled-startup smoke | PASS: passenger.cjs loads compiled JS, synthetic assigned PORT respected, health 200; no tsx or DB request; temporary cwd prevented .env loading |
| Git diff whitespace | PASS in both repos; only standard CRLF normalization warnings |
| Provider secrets / Git / browser scan | See bounded security evidence below; no configured provider value matches |

The startup smoke initially attempted to delete its empty temporary cwd before the Windows child fully exited. Startup itself passed; the empty directory was then removed and cleanup verified. This was a harness cleanup issue, not an application startup failure.

## Functional evidence

- Customer: weak-password validation, email registration/login, exact return-to behavior, protected reload, profile update, persisted favorites/removal, modal fields and duration/quantity quote, safe missing-Stripe configuration error. F2 separately proves real Google and actual sandbox Checkout success/decline/cleanup.
- Owner: role-scoped navigation/listings, add/update/delete through real local API; image response mocked **only** in the deterministic CRUD browser case. F2 has the actual imgbb upload/render. Pending-by-default status and ownership/active-inventory guards are server enforced.
- Admin: user/equipment/rental tables, role/disabled controls, pending approval UI and backend approval; role change revokes sessions and Customer administration is denied. Added date-constrained ongoing/completed transition tests using only an explicitly shifted disposable booking period.
- All-role profile updates and Owner/Admin nonzero analytics now have API assertions: one completed booking, matching revenue, monthly earnings and monthly booking data, and scoped rentals. Nonzero chart rendering is source-reviewed; visual captures mainly show honest empty chart state on fresh fixtures, not fabricated business activity.
- Catalog direct local checks passed name/category/location searches; category, daily/weekly, price bounds, availability filters; both price sort directions; recent sort accepted; disjoint pagination. Not every combination or large-dataset performance case is tested.
- Security boundaries: anonymous details/login redirect, JWT validation and active-session checks, current-role revocation, forbidden Admin API, gateway diagnostic/webhook exclusion and foreign mutation-origin rejection. All published endpoint health and cross-domain cookie behavior must be retested after an approved rollout.
- F2 real payment evidence: signed fulfillment existed before replay; exactly one paid booking/payment; two locally re-signed genuine-event duplicates left counts unchanged; tamper rejected 400; actual decline created no paid record; genuine expiration webhook released the hold. Stripe-hosted resend retries were not exercised. No real provider probes repeated during F3.

## Visual/responsive/accessibility audit

Initial expanded capture: **80 screens**, at widths 390/834/1366/1920. Public home/catalog/login/register and role-specific overview/profile/rentals/favorites/equipment/add/users plus unconfirmed payment/cancellation-return states. No page-level horizontal overflow. Images were eagerly decoded before capture; no broken images. Earlier fast suite screenshots sometimes show unloaded lazy images; that is not evidence of permanent image failure.

Expanded axe checking found two actual defects:

1. Card links displayed “View details” but their aria-label was “View <name>”, violating label/content-name matching. Changed to “View details for <name>”.
2. Table headers used #657586 on #f4f6f8, measured 4.36:1 at small text size. Changed only the text to existing palette color #53677a. No layout, palette redesign or new feature was introduced.

After rebuild, **50 screen/state checks** passed with zero WCAG 2 A/AA and 2.1 A/AA violations, zero page overflow and zero broken images. Final coverage includes the public/auth pages, all role tables/profile/overview, unconfirmed payment/cancel-return, details and native booking modal at all four widths, plus explicitly **mocked paid confirmation rendering** at mobile/desktop. This last UI mock is not substituted for F2's actual payment proof. Final 20-case suite also passes independently.

Representative screenshots were visually inspected: desktop/mobile home, mobile Owner form, desktop Admin users and tablet details. Typography hierarchy, whitespace, header/logo alignment, card grid, image sizing and controls retain the accepted design. Mobile workspace links and wide data tables use contained horizontal scrolling; the owner should confirm their discoverability and small-text comfort. Some fixture photography is illustrative (event crowd/vehicle); actual publication needs appropriate owner-provided listing imagery. No claim is made that all 130 captures received individual human visual inspection.

Artifacts are local and ignored: `server/.netlify/f3-qa/report.json` with initial screenshots; `server/.netlify/f3-qa/final/report.json` and final PNGs; client `playwright-report` / `test-results`. They contain synthetic fixture information only and must not be indiscriminately staged. Loading/error/empty implementations were inspected; API failure and not-found browser states execute in the suite. Exact suspense timing, every React error-boundary branch, 320px screens, other browser engines, full keyboard-only/screen-reader sessions and performance budgets are not certified by this audit.

## Security and dependency findings

Fresh full **and production-only** npm audits report zero vulnerabilities in both repos. The official GHSA-fc5q-39xc-vjpf page marks the advisory **withdrawn November 18, 2026**, so the earlier F2 snapshot of 14 high propagated findings is historical, not current. No dependency changed to produce the zero result. The page's withdrawal wording is ambiguous; the linked maintainer discussion disputes treating caller-chosen pathological glob patterns as a library security vulnerability. This is advisory-status evidence, not proof of an upstream patch. [Advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), [maintainer discussion](https://github.com/micromatch/picomatch/pull/235).

Installed npm picomatch chains remain ESLint/build tooling; no production dependency-tree entry. Next also vendors a compiled copy used by local/remote image-pattern helpers; its version metadata does not settle patch status. Equipora exposes no caller-defined glob API and defines no remote/local image patterns; user images are unoptimized. Continue keeping build/config patterns owner-controlled. A clean npm production audit alone does not certify vendored code or eliminate every runtime risk. No uncontrolled upgrade, vendor patch or exploit execution was performed.

Scanning evidence:

- Candidate scan covered 62 server and 53 client files at the scan checkpoint; history scan covered 82 server and 13 client blobs. Three server candidate matches/four historical matches were credential-shaped MongoDB URIs in existing diagnostic test-fixture files, not provider tokens. No private .env or providers.xml was tracked. Pattern scanning is bounded and can miss unknown secret formats.
- A private exact-value comparison decrypted existing provider configuration only in memory, removed the transient environment before spawning Git children, and emitted counts only. **Zero configured provider values** matched either candidate tree, either history or browser static output. No .env values were read for this scan.
- Browser scan covered 20 JS/JSON static files. One server-secret **name** match was BETTER_AUTH_SECRET in Better Auth's generic environment accessor; no injected value was present and private exact-value comparison returned zero. Do not inaccurately report zero name markers or treat this accessor name as a leaked signing secret. Production signing/MongoDB/diagnostic values are not supplied to this local frontend build.
- Existing server-only env/gateway design remains. No local production env files, encrypted provider files or process credentials were printed. This is not an exhaustive repository-security certification or an authorized production secret rotation.

## GitHub/documentation and submission readiness

Client history: **1** commit; server: **8**. Deficits against 20/12 are **19 client / 4 server**. Existing uncommitted F1/F2/infrastructure work is preserved; Git diff --stat alone excludes untracked implementation and is not the release file manifest. No artificial history, staging or commits performed.

Updated both READMEs to reflect verified local providers, encrypted setup, current limitations and F3 evidence. Prepared the detailed requirement matrix and exact release/env/Admin/rollback sequence. Live frontend link, final published hashes and privately delivered examiner Admin credentials remain incomplete submission items. Main backend URL is accepted infrastructure, not proof that marketplace/auth routes have been deployed.

## F3 changed-file summary

- Client `components/equipment-card.tsx`: accessible name includes visible link text.
- Client `app/style.css`: table-header contrast correction only.
- Client `tests/browser/assignment.spec.ts`: WCAG 2.1 label coverage and role-table regression checks (20 total cases).
- Server `tests/marketplace.test.ts`: all-role profile, unauthorized admin-user mutation, rental management/date boundaries and nonzero analytics assertions; only disposable fixtures.
- Both READMEs: verified provider status, secure setup and release/submission gates.
- Server `.gitignore`: ignore all runtime `.env*` variants while retaining `.env.example`; no existing environment file modified.
- Server `docs/F3-requirements-matrix.md`, this report, `docs/F3-release-plan.md`: final deliverables.
- Server `docs/F1-deployment-readiness.md`: historical-plan pointer to current F3 evidence.
- Ignored local screenshots/reports: QA artifacts only, not release source.

All other existing dirty files predate F3 and must not be swept into a future commit without review. No backend business/runtime logic, provider secret, DB configuration, Passenger mapping or infrastructure was changed by these F3 corrections.

## Owner visual acceptance and next gates

Local app remains at `http://localhost:3000` with credential-free disposable fixtures. Test emails: customer@example.test, owner@example.test, admin@example.test; password LocalDemo123 is **local-only**. Use these to review home/catalog/details/modal, auth layouts and each dashboard at mobile/tablet/desktop. Real provider login/payment is deliberately unavailable in this credential-free QA runner; accepted F2 evidence remains the provider checkpoint. Do not restart using the ordinary production-linked dev command.

Next decision is visual/content acceptance, not deployment authorization. Outstanding blockers: genuine/approved review content, commit-history deficit, final frontend hostname/project and Hobby eligibility, claimed/persistent owner-controlled Stripe test environment and hosted signing secret, final Google audience/callback, approved ExonHost business release/env changes and Linux dependencies, controlled first Admin execution, approved production acceptance data and exact-domain QA. See the release plan for separate permissions. Optional theme/cron/email features remain intentionally omitted.
