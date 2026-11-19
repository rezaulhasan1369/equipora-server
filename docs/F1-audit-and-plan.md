# Equipora F1 audit and phased implementation plan

Audit date: 2026-11-18. Authoritative requirements: owner-supplied Programming Hero Assignment 9, Category 003 (B14-A9-C003). The video itself was not supplied; the full written rubric was supplied during this audit. The D0 README is historical context, not the assignment specification.

## Verified baseline

Client: independent clean Git repository, origin `rezaulhasan1369/equipora-client`; Next.js App Router 16.4.6 installed (manifest ^16.4.3), React/React DOM 19.3.1, TypeScript strict, ESLint 9. Four application files: root layout, diagnostic home page, CSS, public `/api/health`. No authentication, component library, business routes, forms, dashboard, test suite, or marketplace data source. Existing Slate Blue/White palette is retained. Local API configuration points to localhost, not production. Baseline TypeScript, lint, and production build passed under local Node 24.18.0.

Server: Express 5, MongoDB native driver 6, TypeScript strict, dotenv, CORS, Netlify wrapper and Passenger bootstrap. Existing health/diagnostic APIs only. No users, equipment, favorites, rentals, payments, business authorization, or analytics implementation. E8 production connectivity is accepted and is not evidence that those business features exist. Existing uncommitted infrastructure work is preserved.

API contract before F1: GET `/api/health` public; GET `/api/health/db` diagnostic-key protected; POST `/api/health/db/diagnostics` protected, bounded diagnostics. Frontend must never receive either MongoDB URI or diagnostic key. CORS allows exactly configured CORS_ORIGIN; no cookie/session or user-token implementation exists. Marketplace/auth endpoints must be added and tested locally before a separately approved backend release.

Vercel read-only checks: connected account is the confirmed OWNER of DPS (`dps25`), which is its default team; authenticated user billing reports Hobby. No Equipora project exists in that team. Team billing detail was not returned, so project-specific settings/limits are not yet verified. No project was created or linked. Personal/noncommercial assignment use must satisfy Hobby eligibility; a real commercial marketplace would need a separate hosting/plan decision.

## Requirements-to-implementation checklist (baseline)

| Requirement | Baseline | Implementation/acceptance scope |
|---|---|---|
| Next App Router + TypeScript + Express + MongoDB | Complete foundation | Preserve architecture and E8 infrastructure |
| Shared header, dynamic content, footer; responsive consistent UI | Partial diagnostic page | Public shell, responsive navigation, cards, accessible forms, loading/error/not-found |
| Email registration, name/email/photo/password; uppercase/lowercase/min 6 | Missing | Better Auth Mongo adapter, client and server validation, success/error feedback |
| Email login, Google login; default Customer | Missing | Better Auth sessions + Google provider configuration, no verification/reset flows |
| JWT + verifyToken/verifyRenter/verifyOwner/verifyAdmin | Missing | Verify cryptographic token, active session and current database role; never trust client role |
| Session survives private-route reload; role dashboards | Missing | Server session gate and client loading state; cookie/session integration across hosts |
| Public home banner + Framer Motion | Missing | Original equipment-rental visual direction within Slate Blue/White theme |
| Six approved featured items via MongoDB limit | Missing | Public bounded featured query; no fake production inventory |
| Six categories, benefits, four reviews, two extra sections | Missing | Categories/benefits/how-it-works/owner callout; clearly labeled illustrative reviews if no real reviews |
| All equipment: 3 columns; search name/location/category | Missing | Database filtering, escaped bounded text input, pagination |
| Category/type/price/availability filters; price/date sorts | Missing | Server-side validated query contract and frontend URL state |
| Private equipment details with owner/terms/quantity | Missing | Approved item access; ownership/admin exceptions for moderation |
| Customer database favorites and removal | Missing | User-scoped unique favorites; dashboard table |
| Booking modal with dates/quantity/contact/address/notes | Missing | Server quote, availability and quantity checks, duration pricing |
| Stripe Checkout, payment collection, booking after payment | Missing | Test-mode hosted checkout, signed idempotent webhook, inventory holds, no trust in success URL |
| Customer rentals/profile dashboard | Missing | User-scoped bookings and editable safe profile fields |
| Owner add equipment with imgbb image upload, pending status | Missing | Validated input; server-owned owner/status; upload credential kept private |
| Owner equipment update/delete/details and rentals | Missing | Ownership enforcement; inventory-safe edits/removal |
| Admin users/roles, equipment moderation, all rentals | Missing | Backend authorization and state transitions, no self-elevation |
| Owner/admin database-derived charts and analytics | Missing | Aggregates from scoped users/equipment/bookings/payments |
| Loading/error pages, responsive dashboards, profile section | Missing | Explicit UI states and realistic viewport checks |
| Readmes, environment examples, live URLs | Partial root README only | Per-repository documentation; secrets excluded |
| At least 20 client / 12 server meaningful commits | Not established by this audit | No commits authorized; do not manufacture commit history |
| Pagination | Optional, planned | Catalog and rental history |
| Theme toggle / cron / notification email | Optional, deferred | Do not block required scope or add paid services |

## Implementation sequence

1. Define validated domain contracts, rental pricing/availability rules, and safe local database/test configuration. Use synthetic or isolated local fixtures; never production seed writes.
2. Integrate Better Auth MongoDB adapter, Google provider, JWT verification and current-role middleware. Use a fixed-target same-origin Next gateway to preserve host-only cookies without exposing backend secrets. Test tampering, roles, expiry and reload behavior.
3. Add equipment/favorites/profile/moderation APIs and responsive public pages. Search/filter/sort happens on the server. Empty inventory remains an honest empty state.
4. Add booking reservations, test-mode Stripe Checkout and signature-verified idempotent fulfillment. Payment secrets/webhook signing stay backend-only. Test concurrency, cancellation, duplicate webhooks and unavailable inventory before readiness claims.
5. Build user/owner/admin dashboards and real scoped analytics, then verify accessible forms, loading/error/empty/success states and mobile/tablet/desktop behavior.
6. Run lint/TypeScript/tests/build/security scans; prepare Vercel root `/` for the independent client repository, Node 22.x, and exact environment/origin configuration. Do not deploy or modify production settings.

## External configuration and approvals

Required before live auth/payment acceptance: private Better Auth signing secret and approved public auth/frontend origins; Google OAuth client/callback configuration; Stripe test secret and webhook signing secret/endpoint; imgbb upload key; isolated test MongoDB environment. Do not reuse diagnostic keys as application secrets. Any role bootstrap must target an explicitly approved account; no production user/role writes are authorized here.

Production backend release, frontend project creation/publication, production origin/secret changes, commits and pushes require separate approval. The existing website, certificates, DNS, Atlas rules and Netlify fallback remain unchanged.

Sources checked for deployment preparation: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [supported Node runtimes](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). Eligibility and actual project settings must be rechecked at approval time.
