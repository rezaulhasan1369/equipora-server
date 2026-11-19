# F7 exact proposed Git commits

No commits, index staging, branch changes or pushes are executed. Both bases are local main: client b7b86e26490958b103729be635b8ea4711f42b93, server 6f024f6f53c15fc617ec09d8379f13cf2717bd49. Read together with [owner review](F7-owner-review.md) and [release/rollback](F7-release-plan.md).

Current shortfall is nineteen client/four server commits. There are twenty client/seven server proposed coherent review units, but that is not a guaranteed final count: repeated monolithic files require explicit hunks. Validate each cumulative candidate index in a separate export before committing; combine units if they cannot stand independently. No empty commits, retrospective dates or arbitrary file splitting. Chronology below is the proposed future review order, not an invented past timeline. Do not run blanket git add.

## server

### S01 - chore(server): prepare compiled Node 22 runtime and auth contracts

Depends on: existing foundation.

Exact paths (repository-relative):

- `package.json`
- `package-lock.json`
- `.env.example`
- `.gitignore`
- `tsconfig.build.json`
- `passenger.cjs`
- `src/domain.ts`
- `src/auth.ts`
- `src/local-provider-config.ts`

Hunk boundary: Keep required auth/schema dependencies and scripts; node-cron/nodemailer dependency hunks stay with S05. Existing src/local.ts is unchanged.

Required validation before committing this snapshot:

- npm run typecheck
- npm run build
- compiled Passenger/PORT/health smoke without DB secrets

Status: **proposed; no intermediate snapshot certification**.

### S02 - feat(api): implement scoped rental marketplace and signed payment lifecycle

Depends on: S01.

Exact paths (repository-relative):

- `src/marketplace.ts`
- `src/registration-image.ts`
- `src/app.ts`
- `tests/marketplace.test.ts`
- `tests/registration-image.test.ts`

Hunk boundary: Current marketplace is one tightly coupled module; treat its routes/transactions/indexes as an atomic integration rather than fake separate whole-file commits. Preserve existing diagnostic middleware hunks.

Required validation before committing this snapshot:

- npm run typecheck
- npm run build
- isolated API/RBAC/filter/pagination/checkout/webhook tests
- required-photo upload origin/size/quota tests

Status: **proposed; no intermediate snapshot certification**.

### S03 - feat(operator): secure private provider entry and initial Admin planning

Depends on: S02.

Exact paths (repository-relative):

- `src/admin-bootstrap.ts`
- `scripts/local-providers.ps1`
- `tests/f2-security.test.ts`
- `tests/local-provider-helper.test.ts`

Hunk boundary: No actual credential store or production Admin operation included.

Required validation before committing this snapshot:

- npm run typecheck
- npm run build
- DPAPI helper mocked inputs
- test/live key rejection
- bootstrap atomicity/scope/revocation

Status: **proposed; no intermediate snapshot certification**.

### S04 - feat(fixtures): preserve isolated thirty-item catalog and asset provenance

Depends on: S03.

Exact paths (repository-relative):

- `scripts/dev-isolated.ts`
- `scripts/f5-demo-catalog.json`
- `scripts/prepare-f5-catalog.mjs`
- `tests/f5-demo.test.ts`

Hunk boundary: Only disposable MongoDB runner; source catalog is synthetic, USD demo values explicitly authored.

Required validation before committing this snapshot:

- npm run typecheck
- npm run build
- thirty unique IDs/five per category
- server-enforced six approved featured
- no production URI input

Status: **proposed; no intermediate snapshot certification**.

### S05 - feat(jobs): prepare isolated completion and mock notification outbox

Depends on: S04.

Exact paths (repository-relative):

- `src/rental-completion.ts`
- `src/completion-email.ts`
- `tests/completion.test.ts`
- `package.json`
- `package-lock.json`

Hunk boundary: Only exact node-cron/nodemailer dependency changes here; no runtime entry point activates jobs or email.

Required validation before committing this snapshot:

- npm run typecheck
- npm run build
- UTC/eligibility/concurrency/retry/claim-token/idempotency
- responsive escaped HTML/text
- production refusal

Status: **proposed; no intermediate snapshot certification**.

### S06 - fix(packaging): generate Linux-portable hashed backend archives

Depends on: S05.

Exact paths (repository-relative):

- `scripts/prepare-exonhost-package.ps1`

Hunk boundary: Use slash-separated manifest/ZIP entries with .NET ZIP APIs; exclude private/dev/operator files.

Required validation before committing this snapshot:

- npm run typecheck
- npm run build
- build ZIP + verify every manifest hash
- reject backslash/private/unexpected entries
- compiled startup smoke

Status: **proposed; no intermediate snapshot certification**.

### S07 - docs(server): consolidate assignment evidence and controlled release plan

Depends on: S06.

Exact paths (repository-relative):

- `README.md`
- `docs/F1-audit-and-plan.md`
- `docs/F1-deployment-readiness.md`
- `docs/F1-implementation-results.md`
- `docs/F1-provider-setup.md`
- `docs/F2-readiness.md`
- `docs/F3-qa-report.md`
- `docs/F3-release-plan.md`
- `docs/F3-requirements-matrix.md`
- `docs/F4-owner-visual-review.md`
- `docs/F5-floating-navbar.md`
- `docs/F5-implementation-and-QA.md`
- `docs/F5-resource-inventory.md`
- `docs/F5.1-footer-correction.md`
- `docs/F5.2-navbar-background.md`
- `docs/F6-deficiencies.md`
- `docs/F6.2-verification-and-commit-plan.md`
- `docs/F6.4-commit-plan.json`
- `docs/F6.4-release-plan.md`
- `docs/F6.4-report.md`
- `docs/F7-owner-review.md`
- `docs/F7-commit-plan.md`
- `docs/F7-commit-plan.json`
- `docs/F7-release-plan.md`

Hunk boundary: Current reports and genuine history/approval constraints; do not sweep historical network operators into runtime publication.

Required validation before committing this snapshot:

- npm run typecheck
- npm run build
- links/env-name review
- current evidence/counts
- secret and whitespace scans

Status: **proposed; no intermediate snapshot certification**.

## client

### C01 - chore(client): prepare typed Next.js tooling and application contracts

Depends on: existing foundation.

Exact paths (repository-relative):

- `package.json`
- `package-lock.json`
- `.gitignore`
- `.env.example`
- `eslint.config.mjs`
- `next.config.ts`
- `postcss.config.mjs`
- `lib/types.ts`
- `app/style.css`

Hunk boundary: Only base tokens/reset/container/form primitives in CSS; feature selectors stay with later features. Dependency lock regenerated from each cumulative package state, never edited manually.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- npm test once tests land

Status: **proposed; no intermediate snapshot certification**.

### C02 - feat(api): add secure same-origin authentication and backend gateways

Depends on: C01.

Exact paths (repository-relative):

- `lib/api.ts`
- `lib/auth-client.ts`
- `lib/gateway-policy.ts`
- `lib/gateway.ts`
- `lib/server-session.ts`
- `app/api/auth/[...path]/route.ts`
- `app/api/backend/[...path]/route.ts`
- `app/api/health/route.ts`
- `tests/gateway-policy.test.mjs`

Hunk boundary: Whole files; requires server S02 for integrated runtime checks.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- node --test tests/gateway-policy.test.mjs
- foreign-Origin/redirect/diagnostic-proxy rejection

Status: **proposed; no intermediate snapshot certification**.

### C03 - feat(session): provide shared session and accessible toast context

Depends on: C02.

Exact paths (repository-relative):

- `components/session.tsx`
- `components/toast.tsx`
- `app/layout.tsx`

Hunk boundary: Only SessionProvider/ToastProvider imports/wrappers; keep shell/theme integration out until C17/C19.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- context mount/unmount smoke

Status: **proposed; no intermediate snapshot certification**.

### C04 - feat(dashboard): add protected role workspace and database analytics

Depends on: C03.

Exact paths (repository-relative):

- `components/dashboard-shell.tsx`
- `components/dashboard.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`
- `app/style.css`

Hunk boundary: dashboard.tsx: imports/types/useData/State/Gate/Overview only, plus dashboard/sidebar/stat/chart CSS. Retain only imports used by selected exports.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- authenticated fixture GET /dashboard for each role
- nonzero scoped /analytics assertions

Status: **proposed; no intermediate snapshot certification**.

### C05 - feat(auth): add email and Google sign-in with required profile photo

Depends on: C04.

Exact paths (repository-relative):

- `components/auth-form.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `playwright.config.ts`
- `tests/browser/assignment.spec.ts`
- `tests/browser/f63-acceptance.spec.ts`
- `app/style.css`

Hunk boundary: Only auth helpers/cases from browser tests and auth-form CSS; do not stage unrelated test cases yet.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- registration/password/photo/upload cases
- Google launch mocked; historical actual F2 acceptance remains separate

Status: **proposed; no intermediate snapshot certification**.

### C06 - feat(catalog): integrate server filtering pagination and credited demo images

Depends on: C05.

Exact paths (repository-relative):

- `components/catalog.tsx`
- `components/equipment-card.tsx`
- `lib/equipment-image.ts`
- `app/equipment/page.tsx`
- `app/asset-credits/page.tsx`
- `tests/equipment-image.test.mjs`
- `public/assets/equipment/credits.json`
- `public/assets/equipment/eqd-001.webp`
- `public/assets/equipment/eqd-002.webp`
- `public/assets/equipment/eqd-003.webp`
- `public/assets/equipment/eqd-004.webp`
- `public/assets/equipment/eqd-005.webp`
- `public/assets/equipment/eqd-006.webp`
- `public/assets/equipment/eqd-007.webp`
- `public/assets/equipment/eqd-008.webp`
- `public/assets/equipment/eqd-009.webp`
- `public/assets/equipment/eqd-010.webp`
- `public/assets/equipment/eqd-011.webp`
- `public/assets/equipment/eqd-012.webp`
- `public/assets/equipment/eqd-013.webp`
- `public/assets/equipment/eqd-014.webp`
- `public/assets/equipment/eqd-015.webp`
- `public/assets/equipment/eqd-016.webp`
- `public/assets/equipment/eqd-017.webp`
- `public/assets/equipment/eqd-018.webp`
- `public/assets/equipment/eqd-019.webp`
- `public/assets/equipment/eqd-020.webp`
- `public/assets/equipment/eqd-021.webp`
- `public/assets/equipment/eqd-022.webp`
- `public/assets/equipment/eqd-023.webp`
- `public/assets/equipment/eqd-024.webp`
- `public/assets/equipment/eqd-025.webp`
- `public/assets/equipment/eqd-026.webp`
- `public/assets/equipment/eqd-027.webp`
- `public/assets/equipment/eqd-028.webp`
- `public/assets/equipment/eqd-029.webp`
- `public/assets/equipment/eqd-030.webp`
- `app/style.css`

Hunk boundary: Catalog/card/pager/image-credit styles only; all thirty image derivatives and exact per-image credits included together.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- filter/sort/search URL persistence
- thirty catalog/six featured API assertions

Status: **proposed; no intermediate snapshot certification**.

### C07 - feat(equipment): protect details and persist customer favorites

Depends on: C06.

Exact paths (repository-relative):

- `components/details.tsx`
- `app/equipment/[id]/page.tsx`
- `app/style.css`
- `tests/browser/assignment.spec.ts`

Hunk boundary: Details read-only data/loading/terms/favorite flow and associated imports/state only; booking handler/button/dialog deferred to C08.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- anonymous redirect and authenticated detail/favorite tests

Status: **proposed; no intermediate snapshot certification**.

### C08 - feat(booking): add accessible rental dialog and availability checkout

Depends on: C07.

Exact paths (repository-relative):

- `components/details.tsx`
- `app/style.css`
- `tests/browser/assignment.spec.ts`

Hunk boundary: Remaining book handler/modal/state/button and modal/quote CSS; no reinterpretation of production payment config.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- date/quantity quote
- invalid dates/role denial/provider-unconfigured safe failure

Status: **proposed; no intermediate snapshot certification**.

### C09 - feat(rentals): add scoped history pagination and cancellation feedback

Depends on: C08.

Exact paths (repository-relative):

- `components/dashboard.tsx`
- `app/dashboard/rentals/page.tsx`
- `app/style.css`
- `tests/browser/f63-acceptance.spec.ts`

Hunk boundary: Row/CheckoutHolds/Rentals and related imports/history styles; stage only matching history URL-state test case.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- customer separate start/end columns
- 15+3 actual scoped API pages; browser history response fixture explicitly labeled

Status: **proposed; no intermediate snapshot certification**.

### C10 - feat(payments): render authoritative payment confirmation states

Depends on: C09.

Exact paths (repository-relative):

- `components/dashboard.tsx`
- `app/payment/success/page.tsx`
- `tests/browser/assignment.spec.ts`

Hunk boundary: PaymentSuccess export and its related status test only.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- paid/pending/error result states
- never confirm from redirect alone

Status: **proposed; no intermediate snapshot certification**.

### C11 - feat(favorites): add customer saved-equipment workspace

Depends on: C10.

Exact paths (repository-relative):

- `components/dashboard.tsx`
- `app/dashboard/favorites/page.tsx`
- `tests/browser/assignment.spec.ts`

Hunk boundary: Favorites export and customer favorite table tests.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- save/remove/view-details flow

Status: **proposed; no intermediate snapshot certification**.

### C12 - feat(profile): edit all-role profile fields while protecting identity

Depends on: C11.

Exact paths (repository-relative):

- `components/dashboard.tsx`
- `app/dashboard/profile/page.tsx`
- `tests/browser/f62-fields.spec.ts`

Hunk boundary: Profile export and matching field/persistence cases; read-only email explanation retained.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- name/image/phone/address persistence for all roles
- email/role PATCH rejection

Status: **proposed; no intermediate snapshot certification**.

### C13 - feat(owner): add bounded equipment image upload and listing editor

Depends on: C12.

Exact paths (repository-relative):

- `components/dashboard.tsx`
- `app/dashboard/add-equipment/page.tsx`
- `app/dashboard/equipment/[id]/edit/page.tsx`
- `app/style.css`
- `tests/browser/assignment.spec.ts`

Hunk boundary: EquipmentForm export and associated imports/upload/form-meta styles and owner form test.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- required field checks
- mocked upload + actual local listing submission/update

Status: **proposed; no intermediate snapshot certification**.

### C14 - feat(equipment): manage owner listings and admin moderation

Depends on: C13.

Exact paths (repository-relative):

- `components/dashboard.tsx`
- `app/dashboard/equipment/page.tsx`
- `tests/browser/assignment.spec.ts`

Hunk boundary: ManagementResult/ManagementPager/EquipmentManager exports and matching role/CRUD cases.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- Owner create/update/delete
- Admin approve/reject/pending and update/delete
- ownership/API guards

Status: **proposed; no intermediate snapshot certification**.

### C15 - feat(admin): manage user roles and access with session revocation

Depends on: C14.

Exact paths (repository-relative):

- `components/dashboard.tsx`
- `app/dashboard/users/page.tsx`
- `tests/browser/f62-fields.spec.ts`

Hunk boundary: UsersManager export and matching user columns/role-options assertions.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- customer/owner/admin role transitions
- disable/revoked-session API assertions

Status: **proposed; no intermediate snapshot certification**.

### C16 - feat(home): complete required marketplace sections and motion assets

Depends on: C15.

Exact paths (repository-relative):

- `components/home.tsx`
- `components/motion-film.tsx`
- `app/page.tsx`
- `public/assets/motion/hero-equipment-orbit-poster.webp`
- `public/assets/motion/hero-equipment-orbit.webm`
- `public/assets/motion/how-it-works-poster.webp`
- `public/assets/motion/how-it-works.webm`
- `public/assets/motion/precision-equilibrium-poster.webp`
- `public/assets/motion/precision-equilibrium.webm`
- `app/style.css`
- `tests/browser/f5-visual.spec.ts`

Hunk boundary: Home/motion CSS and corresponding motion-only cases; preserve supplied binaries and exact original hashes.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- six featured/four disclosed reviews/two extras
- reduced-motion, poster fallback and offscreen pause

Status: **proposed; no intermediate snapshot certification**.

### C17 - feat(brand): integrate responsive navigation and cinematic footer

Depends on: C16.

Exact paths (repository-relative):

- `components/brand.tsx`
- `components/shell.tsx`
- `app/layout.tsx`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `public/assets/branding/equipora-symbol-original-concept.png`
- `public/assets/branding/equipora-symbol-slate-128.png`
- `public/assets/branding/equipora-symbol-slate-256.png`
- `public/assets/branding/equipora-symbol-slate-512.png`
- `public/assets/branding/equipora-symbol-slate-64.png`
- `public/assets/branding/equipora-symbol-white-128.png`
- `public/assets/branding/equipora-symbol-white-256.png`
- `public/assets/branding/equipora-symbol-white-512.png`
- `public/assets/branding/equipora-symbol-white-64.png`
- `public/assets/footer/footer-desktop.png`
- `public/assets/footer/footer-desktop.webp`
- `public/assets/footer/footer-mobile.png`
- `public/assets/footer/footer-mobile.webp`
- `public/assets/footer/footer-tablet.png`
- `public/assets/footer/footer-tablet.webp`
- `app/style.css`
- `tests/browser/f51-footer.spec.ts`

Hunk boundary: Brand/header/footer integration; initially omit floating-state hysteresis and theme toggle/head bootstrap until C18/C19. Include metadata icon paths only when corresponding assets land.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- full-width expanded brand/nav
- responsive artwork, legal links and three home-targeted demo icons

Status: **proposed; no intermediate snapshot certification**.

### C18 - feat(navbar): animate stable full-width to floating glass capsule

Depends on: C17.

Exact paths (repository-relative):

- `components/shell.tsx`
- `app/style.css`
- `tests/browser/floating-navbar.spec.ts`

Hunk boundary: Floating Header effect/state and F5 navbar/F5.2 surface CSS hunks; do not touch footer or hero.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- 112/80px hysteresis
- eight sizes, restored geometry, keyboard/menu/resize/reduced motion

Status: **proposed; no intermediate snapshot certification**.

### C19 - feat(theme): persist accessible light and dark mode with system fallback

Depends on: C18.

Exact paths (repository-relative):

- `components/theme-toggle.tsx`
- `components/shell.tsx`
- `app/layout.tsx`
- `app/style.css`
- `tests/browser/f63-acceptance.spec.ts`

Hunk boundary: Theme import/control/static head initializer and dark-only CSS; stage matching theme tests including first-frame fallback.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- stored/system/cross-tab/blocked storage
- public/dashboard/modal/table/footer contrast

Status: **proposed; no intermediate snapshot certification**.

### C20 - test(client): consolidate acceptance coverage and release guidance

Depends on: C19.

Exact paths (repository-relative):

- `app/loading.tsx`
- `app/error.tsx`
- `app/not-found.tsx`
- `README.md`
- `tests/browser/assignment.spec.ts`
- `tests/browser/f5-visual.spec.ts`
- `tests/browser/f62-fields.spec.ts`
- `tests/browser/f63-acceptance.spec.ts`
- `app/style.css`

Hunk boundary: Remaining cross-route errors/loading/empty accessibility work and cross-feature test/documentation hunks. Previously staged cases are not duplicate new commits.

Required validation before committing this snapshot:

- npm run typecheck
- npm run lint
- npm run build
- complete isolated browser suite
- no unexpected page errors
- secret scan + git diff --check

Status: **proposed; no intermediate snapshot certification**.

## Deferred historical/operator files

These are inventoried but are not an implicit business-release publication scope. Review separately; none belongs in the ExonHost runtime ZIP.

- server/`docs/D0.7-tls-investigation.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`docs/D0.9-recovery-assessment.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`docs/D1.1-temporary-access-test-plan.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`docs/EXONHOST-E5-hostname-result.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`docs/EXONHOST-E6-runtime-checkpoint.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`docs/EXONHOST-E7-controlled-test.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`docs/EXONHOST-E8-production-acceptance.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`docs/EXONHOST-release-plan.md`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`scripts/cpanel-readonly.ps1`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`scripts/exonhost-e7-experiment.mjs`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`scripts/exonhost-e7-observer.cjs`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`scripts/exonhost-e8-finalize.mjs`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`scripts/run-d11.mjs`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`tests/exonhost-e7.test.mjs`: Historical/operator scope; explicit review separate from business release and never runtime archive
- server/`tests/exonhost-e8.test.mjs`: Historical/operator scope; explicit review separate from business release and never runtime archive
- client/`AGENTS.md`: Next-generated guidance; owner publication decision, not a feature-count filler

## Excluded from every proposed commit

Actual .env/runtime/production/local files (only blank .env.example is allowed); DPAPI provider/ExonHost XML; private receipts/keys/claim links; node_modules; .next; dist; .netlify; ZIPs/manifests generated under .netlify; test-results/playwright-report/coverage and tsbuildinfo. Reviewed supplied static artwork/derivatives and their license metadata under public/assets are intentional application source assets, not build output. Known synthetic test credentials are test fixtures, never examiner/production access.

Before any approved commit: recheck the exact staged diff, secret scan and snapshot validation. Before any approved push: read-only inspect automatic deploy effects, intended branch and remote. Preview publication also needs approval. No real publication is authorized by this file.
