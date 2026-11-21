# Equipora — Final Project Completion Report (F14, updated after F13/F15)

Autonomous completion run: 2026-11-20 → 2026-11-21 (Asia/Dhaka). Assignment deadline: 2026-11-22 23:59 BDT.

## 0. Final status (supersedes the F14 snapshot below where they differ) — 2026-11-21

| Item | Status | Evidence |
|---|---|---|
| **F13 initial Admin** | **PASS** (owner-reported acceptance + automated evidence) | Owner ran `f13:apply` once: `PROMOTED`, account hash `2b1b27f8fc02`, `customer`→`admin`, 0 remaining sessions, bootstrap marker present, single one-shot lock. Owner reports Admin dashboard, user management, authentication and browser checks working. Cleanup done (script, target and confirm files removed; release `package.json` restored; `0600` audit files and lock kept). No role changes or rollback since. |
| **F15 demonstration inventory** | **PASS** | Owner ran `f15:demo-inventory` once: `SEEDED`, 30 inserted / 30 approved. Public API: 30 listings, 5 per category, all `demoOnly`, `seedBatch: f15-demo`, "Synthetic portfolio listing" disclosure, owner display "Equipora demonstration inventory". Featured = 6 items, 6 categories. Search/filter/sort, compare/recent selection, local licensed images (credits at `/asset-credits`) work; detail page and detail API require login (redirect / 401). Script only inserts equipment — no users, bookings or payments; rollback (script retained, inert) removes only the batch. |
| **UI/UX** | **FROZEN** | Final mobile admin refinement live: client `9dca8ca`, Vercel deployment `BiLz1ZoJAo95W8VEaQADqK6DbDzN`. Only critical functional/security/accessibility fixes may follow. |
| Git | client `main` = `9dca8ca3d4c9` (29 commits); server `main` = `13f5559` + this report's docs commit | pushed fast-forward, no force; `AGENTS.md` and private infra files preserved untracked |
| Production | healthy | API/DB/auth/CORS OK, no new error logs, `.env` unchanged, backend runtime release `e582e0a`; `mziae.com` unchanged |
| Tests (latest) | server `npm test` 43/43 · client unit 14/14 · TypeScript/lint/build/audit pass · browser 166/166 (isolated stack) | |

**Requirements now:** 171 detail rows → **168 PASS · 3 PARTIAL**. Newly PASS: G18/S01/S02 (Admin account exists and is owner-held — submit privately), H05 production featured six, G06 (owner approved and froze the design).
Remaining PARTIAL: **P09** hosted Stripe configuration, **C04/PRO2** profile email editing (deliberately read-only for security).

**Remaining owner-only blockers for full hosted functionality:**
1. **Google sign-in (production):** add origin `https://equipora-client.vercel.app` and redirect `https://equipora-client.vercel.app/api/auth/callback/google` in Google Cloud Console; approve copying the stored Google client ID/secret to the production `.env`. Until then email/password login works; the Google button reports unavailable.
2. **Stripe test payments (production):** rotate the exposed webhook secret, create endpoint `https://api.mziae.com/api/payments/webhook` (completed / async_payment_succeeded / expired), approve adding the test key + endpoint secret. Until then "Continue to Stripe Checkout" returns "Stripe test payments are not configured" (no transactions are faked).

**Submission readiness:** READY for Programming Hero submission with the live site, both repositories and the owner's Admin credentials; Google sign-in and live sandbox checkout are configuration-dependent (items 1–2) and should be configured before the examiner tests them if time allows.

## 1. Executive summary

| Question | Answer |
|---|---|
| Overall status | **Feature-complete and deployed; submission-ready except owner-only items** (Admin credentials, Google/Stripe production configuration, production inventory) |
| Deployment succeeded? | **Yes** — backend `e582e0a` on ExonHost, frontend `30e7b99` on Vercel |
| Production healthy? | **Yes** — API/database/auth/CORS healthy, 240 hosted page renders with no overflow/console/link/axe problems, main website untouched |
| Submission-ready? | **PARTIAL** — the examiner Admin account (F13), Google sign-in and Stripe test payments in production, and visible inventory need the owner (section 9) |

Most important finding of this run: production returned **HTTP 429** on ordinary page loads. All visitors reach the API
through the Vercel gateway, so they shared one Better Auth rate-limit bucket (60/min) that `get-session` and `token`
calls exhausted. Fixed (read-only session endpoints exempt; sign-in/sign-up brute-force limits unchanged), regression-
tested (test fails without the fix) and verified live: 104 audit problems → 0 real problems; 120 concurrent session
reads → 120 × 200.

## 2. Requirements

Source of truth: owner's written Programming Hero Assignment 9, Category 003 brief, tracked in
`server/docs/F3-requirements-matrix.md` and `server/docs/F6-deficiencies.md` (171 overlapping detail rows).

**Mandatory / submission rows (171):** 164 PASS · 4 PARTIAL · 0 FAILED · 3 OWNER APPROVAL REQUIRED.

| Moved to PASS in F9–F14 | Evidence |
|---|---|
| G12 ≥20 client commits | 28 genuine commits |
| G13 ≥12 server commits | 22 genuine commits |
| S03/G19 live URL, S04/S05 published repositories | https://equipora-client.vercel.app; both GitHub repositories at the reported SHAs |
| G14 READMEs with live URLs, features, packages | rewritten in both repositories (F14) |
| G15 working live server without CORS/404/504 on valid routes | business API deployed, hosted audit and smoke tests |

| Remaining | Status | Reason |
|---|---|---|
| G18, S01, S02 examiner Admin email/password | OWNER APPROVAL REQUIRED | Admin promotion is owner-only (F13 prepared and tested, not executed) |
| P09 persistent hosted Stripe test configuration | PARTIAL | exposed CLI webhook secret must be rotated; owner must create the hosted endpoint/secret |
| C04 / PRO2 profile email editing | PARTIAL | deliberate: email stays read-only until a secure re-authentication/confirmation flow exists (name/photo/phone/address editable) |
| G06 originality / visual acceptance | PARTIAL | subjective owner acceptance |

**Hosted (production) qualifications of rows that PASS locally:**
- A06 Google login — works locally (F2 real callback); **production not configured** (no Google keys/redirect URI on the production origin) → OWNER APPROVAL REQUIRED.
- P05–P08 Stripe Checkout/webhook — verified locally/sandbox; **production returns 503 "Stripe test payments are not configured"** until the owner configures test keys + hosted webhook.
- H05/E01 featured items and catalog — implemented and tested; **production database has 0 approved listings**, so the live catalog shows its empty state.
- H09 reviews — four clearly disclosed illustrative reviews; owner decides whether to keep them.

**Optional (4):** catalog/history pagination PASS · persisted light/dark theme PASS · scheduled completion job PASS locally (mock; not activated in production: Passenger is not a reliable scheduler) · completion email PASS locally (mock transport; no real email provider).

## 3. Development in this run (F14)

**Backend (`equipora-server`)**
| Commit | Change |
|---|---|
| `86d707e` fix(auth) | stop routine session reads exhausting the shared gateway rate-limit bucket (`src/auth.ts`) |
| `41c1c8b` feat(api) | every API response `no-store` + `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (`src/app.ts`) |
| `0faa4b5` test(auth) | `tests/f123-hosted-auth.test.ts` — production auth configuration end to end |
| `e582e0a` feat(ops) | `scripts/f13-initial-admin.mjs` + `tests/f13-initial-admin.test.ts` + `docs/F13-admin-promotion-plan.md` (not executed) |
| docs commit | README rewrite, this report as `docs/F14-final-report.md` |

**Frontend (`equipora-client`)**
| Commit | Change |
|---|---|
| `d49f484` fix(theme) | dark-mode auth divider (white strip) and loading text contrast 3.6:1 → 10.3:1 |
| `91a7248` chore(security) | remove `X-Powered-By: Next.js` |
| `92b9d4a` fix(gateway) | retry idempotent GET/HEAD once after an outright connection failure (never mutations/timeouts) |
| `03a1dff` perf(deploy) | `vercel.json` runs functions in `bom1` (Mumbai) next to the edge and the Bangladesh-hosted API: session check ≈0.65 s → ≈0.2 s |
| `2bbbb21` docs(readme) | submission README |
| `30e7b99` fix(theme) | dark-mode hero "See how it works" link was nearly invisible on the light hero |

Earlier in this session (already published before F14): F12.2 registration photo options (`b8de394`), F9.1 navbar parity (`fa65b55`).

**Defects fixed:** production 429 on page loads/dashboards (critical), dark-mode contrast ×3, missing cache/hardening headers on direct API responses, framework header disclosure, slow cross-continent function region.

**Deferred intentionally:** profile email editing (security), real email transport and production scheduler (need provider decisions), Admin promotion, provider secrets, production inventory.

## 4. Testing (real commands, this run)

| Suite | Command | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|---|
| Server TypeScript | `npm run typecheck` | PASS | – | – | also on a clean `git archive` of `e582e0a` |
| Server build | `npm run build` | PASS | – | – | |
| Server unit/integration/security | `npm test` | 42 | 0 | 0 | in-memory MongoDB; includes hosted-auth, F13, API, security, diagnostics |
| Server dependency audit | `npm audit --omit=dev` | 0 vulnerabilities | | | |
| Client TypeScript / lint | `npm run typecheck`, `npm run lint` | PASS | – | – | |
| Client unit | `npm test` | 13 | 0 | 0 | gateway policy, image and registration-photo rules |
| Client build | `npm run build` | PASS | – | – | local config and `API_BASE_URL=https://api.mziae.com` |
| Client dependency audit | `npm audit --omit=dev` | 0 vulnerabilities | | | |
| Browser E2E (Playwright + axe) | `playwright test` (isolated stack :3102 + fixture API :5091) | 166 | 0 | 0 | 146 on the f5/f74 fixtures + 20 `assignment.spec` on the baseline fixtures it targets, against the final gateway. First full run: 158/166 — 7 were fixture-count expectations (pass on the intended fixtures), 1 was a real dark-mode contrast defect (fixed) |
| Hosted audit (production, read-only) | `audit.mjs` | 240 page renders, 44 axe scans with 0 violations, 17 internal links OK | 0 real problems | – | 12 routes × 10 viewports (320–2560 px) × 2 themes; remaining log entries are the intentional 404 page and aborted requests during the signed-out `/dashboard` redirect |
| Hosted concurrency | 120 session reads, 10 concurrent | 120 × 200 | 0 | – | before the fix: 429s |
| Payment sandbox | – | NOT TESTED in production | | | production Stripe not configured (owner); local sandbox evidence from F2 |

## 5. Git

| Repository | Branch | HEAD | Push |
|---|---|---|---|
| client `rezaulhasan1369/equipora-client` | `main` | `30e7b9960381d8dd5acfaa9ed481662e5c2cca4b` (28 commits) | fast-forward, no force; remote == local |
| server `rezaulhasan1369/equipora-server` | `main` | `ce3a66bfe7e0c8a37f763b712067d8e132b42f58` (22 commits incl. the F14 docs commit; runtime code = release `e582e0a`) | fast-forward, no force; remote == local |

Working trees: client keeps the owner's untracked `AGENTS.md`; server keeps the untracked private ExonHost/Atlas
investigation docs and operator scripts (intentionally never committed — they contain infrastructure identifiers).
No secrets in any commit (scanned).

## 6. Deployment

| | Frontend | Backend |
|---|---|---|
| URL | https://equipora-client.vercel.app | https://api.mziae.com |
| Identifier | Vercel deployment `FJYXus5B8m7k1CQvquFySgCuUBJ7` (commit `30e7b99`, project `dps25/equipora-client`, functions `bom1`) | release `e582e0a`, package `equipora-api-e582e0a.zip` SHA-256 `666F635495358B8C64C75F7CE040EA05E885F49E9364E64C8D966795D759486D` (22 files manifest-verified; only `dist/app.js`, `dist/auth.js` changed; no dependency change) |
| Time | 2026-11-21 ≈00:17 BDT | 2026-11-20 ≈23:41 BDT |
| Health | 200; HSTS, nosniff, DENY framing, referrer & permissions policies, no `X-Powered-By`; dashboard `no-store` | health 200, database reachable, auth 200, CORS exact-origin, untrusted origin 403, diagnostics 404, no new error logs; CPU 6%, RAM ≈109/700 MiB |
| Rollback | promote previous Vercel deployment (`4qSFozn1…` / earlier) | restore `~/equipora-backups/f14-app-20261120` (hash-verified: dist, package files, manifest, `.env`) and update `tmp/restart.txt`; older backups `e8-app`, `f121-env`, `f122b-env` retained |

Main website `mziae.com`: HTTP 200; document root, certificate and `.htaccess` hash unchanged; no change to DNS, SSL,
Atlas rules, database roles or other applications. Production data: untouched (no writes by this run).

## 7. F12.3 (first hosted account) and F13

| F12.3 gate | Status | Evidence |
|---|---|---|
| ImgBB upload | PASS | owner upload + photo displayed; endpoint configured (F12.2B) |
| Customer registration / role | PASS (code + test); owner-browser confirmation PENDING OWNER BROWSER VERIFICATION | role is server-assigned (`role` input rejected — tested); `/me` and JWT carry the DB role |
| MongoDB account creation | PASS | registration + re-login succeeded; credential/session records proven by the hosted-config test |
| Login / re-login | PASS | owner |
| Cookie security | PASS (automated, production configuration); owner DevTools check PENDING OWNER BROWSER VERIFICATION | `__Secure-` prefix, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain, 7-day Max-Age |
| Session after refresh | PASS | owner + server-side session layouts |
| JWT authorization | PASS (automated) | EdDSA via JWKS, issuer/audience = frontend origin, 15 min, session-bound; missing/forged/unsigned → 401; customer → admin/owner routes 403 |
| Logout and revocation | PASS (automated); owner `activeSessions` count PENDING OWNER BROWSER VERIFICATION | session row deleted, old cookie → null session, old JWT → 401, re-login → exactly one session |
| Production health / isolation | PASS | section 6 |

Owner browser check (optional, read-only): open `D:/Equipora/f123-browser-check.js`, read it, and paste it into the DevTools Console on the signed-in site (it prints only roles, status codes and yes/no flags).

**F13:** implementation READY (script + 1 test, plan in `server/docs/F13-admin-promotion-plan.md`). **Production Admin promotion was NOT performed**; no production role was changed.

## 8. Security review (summary)

Strong: server-assigned roles, DB-sourced role checks, session-bound JWT verification, strict origin checks on auth
mutations and uploads, exact-origin CORS, gateway path allow-list/size limits/redirect checks, `no-store` everywhere,
transactional inventory, signature-verified idempotent webhooks, no secrets in client bundles or Git, private
backups outside public roots.
Residual risks (documented, not silently changed): credential endpoints share the gateway's rate-limit bucket (3
sign-ins per 10 s site-wide — protects against brute force but could be exhausted deliberately; a signed client-IP
header between gateway and API would fix it and needs a new shared secret = owner decision); anonymous registration
uploads share one hourly quota (10/process); the exposed Stripe CLI webhook secret must be rotated.

## 9. Owner actions (only items that genuinely need the owner)

1. **Admin (F13):** approve the plan; create `~/apps/equipora-api/.f13-target.json` with your email; run the dry run and then the confirmed run as documented. Then submit that Admin email/password privately.
2. **Google sign-in in production:** in Google Cloud Console add origin `https://equipora-client.vercel.app` and redirect URI `https://equipora-client.vercel.app/api/auth/callback/google` (and publish the consent screen or add the examiner as a test user); approve copying the Google client ID/secret (already stored encrypted locally) into the production `.env`.
3. **Stripe test payments in production:** rotate the exposed webhook secret; use a persistent claimed sandbox; create the endpoint `https://api.mziae.com/api/payments/webhook` (events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`); approve adding `STRIPE_SECRET_KEY` (test) and the endpoint's `STRIPE_WEBHOOK_SECRET`.
4. **Inventory:** after F13, promote/create an Owner account, add at least six real listings and approve them as Admin so the homepage shows six featured items.
5. **Content/visual acceptance:** confirm the illustrative reviews and overall design.
6. Confirm the Vercel project's `dps25` workspace is acceptable (it is your Hobby production project).
7. Optional: run the read-only browser check for the PENDING OWNER BROWSER VERIFICATION items.
