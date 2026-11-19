# F7 release sequence and rollback plan

Prepared 2026-11-19. This file authorizes no remote operation. Current application behavior is local only; the production E8 backend, Atlas access rules, mziae.com, DNS/SSL and Netlify remain unchanged.

## Frontend: Vercel

Reconfirm the existing DPS account/team's owner-controlled scope and actual Hobby eligibility read-only before project creation. Historical team discovery is not fresh account/billing verification. An assignment demonstration must remain personal/noncommercial for Hobby; no plan purchase or billing change is authorized. See [official Hobby policy](https://vercel.com/docs/plans/hobby).

Proposed project: independent `rezaulhasan1369/equipora-client` repository, root `/`, Next.js, Node 22.x compatible with locally tested 22.23.5, install `npm ci`, build `npm run build`, framework-managed output (no static export). Select an exact stable frontend HTTPS origin before final provider/backend configuration. Do not invent a production URL, reserve a hostname or create a project under this plan.

| Environment name | Intended production setting | Scope / handling |
|---|---|---|
| `API_BASE_URL` | `https://api.mziae.com` | Server-only Vercel configuration; never `NEXT_PUBLIC_*` |
| `LOCAL_INTEGRATION_TEST` | Absent | Reserved for loopback local production-build tests; never enable on hosting |
| MongoDB, diagnostic, Google secret, Stripe secret/signing secret, ImgBB key | Absent from frontend | Keep backend-only; never copy the private provider XML or `.env` into frontend |

The frontend requires no Stripe publishable key for hosted Checkout. Platform-managed `NODE_ENV`/`PORT` remain platform-owned. Configure each approved environment separately; arbitrary preview origins must not become trusted OAuth/auth origins. A preview can write business data if connected to the real backend, so it is not automatically a safe test environment. No `vercel link`, env pull/update, account mutation or deployment has been executed.

## Backend: isolated ExonHost application

Retain Node 22.23.5, Production mode, `~/apps/equipora-api`, startup `passenger.cjs`, URL `api.mziae.com/`, independent public root `~/api-public`. Never map to the main website. Before any upload, read back mapping/resources and back up the accepted E8 artifact and private application configuration using supported cPanel mechanisms. Do not assume SSH.

After separate approval: build a reviewed artifact locally, inspect it, upload only to the isolated application directory, verify all manifest entries, install Linux production dependencies via the supported Node environment (`npm ci --omit=dev`), apply only approved environment changes privately, restart only Equipora and verify health/log/resource behavior. Do not upload Windows node_modules, `.env`, provider XML, tests, source, operator scripts or local fixtures.

The packager now uses portable `/` ZIP entry and manifest paths rather than Windows `Compress-Archive` backslashes. Latest local candidate:

- Archive: `.netlify/exonhost-b0172cf7d62c4e0dbf57b39baece9a4d.zip`
- SHA256: `9A376B4F87D96EC2B022B852B4D5A16925915821AC6CF1EB9BFEE6E7508F4549`
- Eighteen runtime files verified against manifest; no extra files/private/dev source entries; portable ZIP paths verified.
- Node 22.23.5 compiled Passenger smoke: assigned loopback PORT, API health 200, protected database health 404, no DB URI/provider secrets loaded, no writes, no tsx startup.
- Production package dependencies resolve through the current workspace install during local smoke. A fresh Linux `npm ci --omit=dev` and actual Passenger acceptance remain hosted gates; this is not a claim that Windows proved Linux installation.

The earlier backslash candidate is rejected for release. No archive has been uploaded.

## Backend variables and cross-domain authentication

| Name | Required preparation |
|---|---|
| `NODE_ENV` | `production` in the approved app |
| `PORT` | Hosting-assigned; no hardcoded production port |
| `MONGODB_URI` | Preserve the existing restricted Equipora connection privately; no credential/network changes |
| `DIAGNOSTIC_KEY` | Preserve privately; never browser-visible |
| `FRONTEND_URL` | Exact approved frontend HTTPS origin |
| `AUTH_PUBLIC_URL` | Same frontend origin, because the frontend proxies BetterAuth callbacks/cookies |
| `CORS_ORIGIN` | Exact approved frontend origin; no wildcard |
| `BETTER_AUTH_SECRET` | Secure owner-controlled stable signing configuration; coordinate any approved addition privately; never silently rotate |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Owner-controlled OAuth web client, backend-only |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Persistent test environment and actual hosted endpoint secret, backend-only |
| `IMGBB_API_KEY` | Existing approved backend integration, entered privately |

Google JavaScript origin: `<APPROVED_FRONTEND_ORIGIN>`; callback: `<APPROVED_FRONTEND_ORIGIN>/api/auth/callback/google`. Keep examiner access possible through the approved consent audience/test users. Do not add mandatory ordinary-login email verification or password reset. OAuth callback state/codes and private secrets must not appear in screenshots/logs.

Cookies are host-only on the frontend via the gateway's forwarded Set-Cookie; no `.mziae.com` domain sharing is needed. Test Secure/HttpOnly/SameSite behavior, same-origin mutation checks, foreign-Origin rejection, JWT issuer/audience, logout/session revocation and protected reloads on the exact hosted domain. Local tests do not prove these hosted behaviors.

Required-photo anonymous uploads need the existing bounded endpoint plus a production abuse-limit review. Its current socket-source/per-process counters are conservative, not shared distributed quotas under Passenger. Do not remove origin checks or trust forwarded addresses without a reviewed proxy configuration.

## Stripe test-mode readiness

Select/claim an owner-controlled persistent test sandbox privately and confirm intended ownership/permissions. Do not assume the old CLI sandbox still exists or is claimed. Stripe's [official sandbox CLI documentation](https://docs.stripe.com/cli/sandbox) states unclaimed sandboxes expire after seven days. Existing code recognizes supported `sk_test_` and `rkcs_test_` formats without rewriting prefixes; live and unsupported keys stay rejected.

Proposed hosted snapshot-event endpoint, after approval: `https://api.mziae.com/api/payments/webhook`. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`; pin/review SDK/event-version compatibility and retest. Use the hosted endpoint's signing secret, not the local CLI listener secret. No card data enters Equipora. Before hosted acceptance, verify one scoped simulated Checkout, signed fulfillment, duplicate handling, decline/cancellation/expiration, inventory release and consistent booking/payment records. These acceptance actions create production business records and require explicit write/data-scope approval even in Stripe test mode.

## Scheduler and real email: not activated

Local code is a tested stopped `node-cron` task plus a guarded completion engine. It is not wired into `app.ts`, Passenger or Netlify. A web-process timer cannot be assumed reliable: Passenger can idle-stop and multiply processes. See [Passenger lifecycle documentation](https://www.phusionpassenger.com/library/indepth/nodejs/dynamic_scaling_of_app_processes/nginx/).

Preferred candidate: provider-supported external cPanel Cron invoking a reviewed one-shot dispatcher with a verified Linux Node path, fixed private configuration, DB job lease, UTC semantics, bounded execution and sanitized results. A persistent worker is an alternative only if actually included/supported by the existing plan. Provider execution/limits/path must be verified before an executable hosted command is prepared. No job entry, daemon, cron or paid resource is created. Production dispatcher integration/guard changes remain future reviewed code, not a switch already ready to enable.

The email interface and responsive customer/owner templates are complete for local mock acceptance. Real transport remains unimplemented/disabled pending approved provider selection; do not describe this as only toggling an existing SMTP flag. Private configuration checklist: SMTP hostname/allowed port, user/password or supported token, verified sender/reply-to, permitted recipient/testing policy, TLS with certificate verification, short connect/greeting/socket deadlines, quotas, sender-domain authorization and provider idempotency/reconciliation capabilities. Proposed future names `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` are documentation only, not currently consumed settings. No env file or production secret is changed.

Future transport must disable body/credential logging and arbitrary file/URL attachment access. Review five-attempt exhaustion, claim leases, timeout handling and restart monitoring. Deterministic IDs/mock idempotency are not a promise of exactly-once SMTP delivery after a crash. Approve real transport code, supported scheduler wiring and their isolated tests before separately approving activation. Never use completion mail as a shortcut for identity-change verification.

## Examiner Admin and submission

After separately approving production writes: owner registers an intended real account privately (with the accepted photo behavior), confirms exact Equipora cluster/database/account identity, then reviews the existing `initialAdminPlan`/`applyInitialAdmin` one-shot transaction. Preconditions: user exists as Customer, no existing Admin, exact normalized email/ID match, five-minute plan, unique bootstrap marker and session revocation. There is no deployed bootstrap HTTP route or executable production provisioning command. Prepare/review that operator mechanism before execution; never grant a fixture account/password or change another project's users.

Submit Admin email/password privately, the accepted live frontend URL and both actual published repositories. README must contain real accepted URLs only. No fixture credentials, SMTP/provider credentials, private receipt or signing key belongs in Git, logs or the submission README.

## Rollout, rollback and smoke tests after approval

1. Verify all candidate index snapshots and approved full release; record exact revisions/file manifest/hashes. Before any push, inspect GitHub/Netlify/Vercel automatic deployment effects read-only. A push or preview may publish; do not change hooks or publish incidentally.
2. Confirm correct owner-controlled Vercel destination/Hobby eligibility and approved stable origin. Back up only Equipora's current artifact/config; agree first-frontend rollback behavior before first publication.
3. Approve/upload/verify backend package and Linux dependencies; apply scoped private config/provider changes; restart only Equipora. Check Node/startup/assigned PORT, `/api/health` JSON 200, denied missing/invalid diagnostic keys, safe logs and resource headroom. Preserve Atlas rules and mziae.com.
4. Approve/publish frontend with server-only API origin. Verify landing, all deep links/reloads, roles, forms, upload abuse bounds, catalog/history paging, light/dark first paint, modal/menu/keyboard behavior, CORS/cookies, OAuth/logout, Stripe test fulfillment and analytics using only approved acceptance data.
5. Keep production scheduler/mail off until their separate integration and activation approvals. Record hosted results honestly; only then update live URLs/submission status.
6. Rollback: stop new test Checkout attempts and reconcile ambiguous events, restore only the last accepted backend artifact/dependencies/private app config, restart only Equipora, and restore the previous approved frontend deployment. E8 is an infrastructure fallback, not a marketplace-compatible fallback: coordinate withdrawal/maintenance of new frontend business entry points if reverting to E8.
7. If no prior frontend deployment exists, obtain an explicit first-release maintenance/unpublish rollback decision; do not invent a target. Never roll back by dropping/restoring shared databases, deleting payment records, changing Atlas access, deleting Netlify or touching NobleNest, mziae.com, DNS, SSL or email.

All remote operations, secrets/config changes, publication, examiner provisioning, real delivery and scheduling require the owner approvals listed in F7-owner-review.md.

## F7 execution order and approval boundaries

1. Owner reviews this package and exact client/server hunk scopes. No staging/commit currently authorized.
2. After commit approval, construct and validate each proposed index snapshot in isolation. Use genuine descriptive commits in the approved dependency order; no backdating/force history. Recount against 20/12 and retain any shortfall.
3. Before push approval, inspect current GitHub/Netlify/Vercel hooks and deployment branches read-only. A push can publish a fallback/preview; preserve Netlify and obtain explicit publication scope. Push normally only after approval.
4. Record the resulting approved client/server SHAs; regenerate/recheck the backend artifact against the exact approved server tree. The existing local ZIP is a working-tree candidate, not a package of a nonexistent release commit.
5. Owner approves isolated ExonHost backup, artifact/dependency rollout and private config/provider changes. Follow the isolated directory/Node/Passenger checks above. Verify existing restricted Atlas connection with protected health/read-only ping only after the deployment/data scope is approved; never modify network rules or use fixtures against Atlas.
6. Owner approves stable Vercel destination/origin, provider callbacks and frontend publication. Apply the exact origins and private Stripe test/webhook settings; do not activate live payments. Coordinate frontend/backend compatibility; do not point newly published auth/marketplace UI at infrastructure-only E8 routes.
7. Owner separately approves exact examiner account creation/bootstrap and private handoff. This is a production database write, not a routine smoke check.
8. Scheduler/real email need supported hosting execution and new reviewed integration/transport code. First approve/configure/code-test; separately approve activation and real delivery. Current guards/mock transport remain in place.
9. With explicit test-data/write permission, perform full live Customer/Owner/Admin acceptance: OAuth/session reload/logout, listing/upload/pending/approval/update/delete, favorites/profile, filters/page state, one simulated Checkout, verified/duplicate-safe fulfillment, decline/cancel/expiration cleanup, consistent records and monthly analytics. Check resource limits, sanitized logs, mziae.com/certificate and preserved fallback.
10. If a critical check fails, stop new booking/payment actions, preserve/reconcile received events, restore only the accepted isolated backend/config and prior approved frontend deployment as above. No shared-DB restore/drop, Atlas expansion, DNS/SSL change or unrelated website change. First-frontend rollback/unpublish behavior must be approved before first publication.
11. Only after hosted acceptance update live README/submission URLs, examiner credentials and final hashes. No overall compliance claim until those gates and meaningful history are satisfied.
