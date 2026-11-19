> Historical F1 plan. Current evidence, advisory status, provider lifecycle and exact gates are in [F3 release plan](F3-release-plan.md) and [F3 QA](F3-qa-report.md).

# F1 coordinated deployment preparation — no publication authorized

## Verified destination and runtime

Read-only Vercel inspection confirmed connected user `rezaulhasan0416-4776` is a confirmed OWNER of DPS (`dps25`) and DPS is the account's default team. Authenticated-user billing reports Hobby; detailed team billing/usage was not returned. No Equipora project was found in DPS. No project creation, linking, environment mutation, deployment or account change occurred.

Client repository: `rezaulhasan1369/equipora-client`, independent root `/` (not `/client` within that repository). Framework Next.js; build `npm run build`; install `npm ci`; output managed by Next.js/Vercel, not static export. Package engine is 22.x and a production build was verified under exact Node 22.23.5. Installed Next.js is 16.4.6, React 19.3.1. The existing Netlify configuration/fallback remains intact.

Hobby eligibility is conditional on personal/noncommercial assignment use. Do not silently deploy a commercial rental business under Hobby or upgrade billing. Recheck account/project limits at approval time. References: [Hobby eligibility](https://vercel.com/docs/plans/hobby), [Node runtimes](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## API contract

| Endpoint | Permission | Purpose |
|---|---|---|
| `/api/auth/*` | Better Auth session/origin controls | Registration, login, Google callback, session, JWT and JWKS |
| `GET /api/equipment` | Public | Approved catalog, featured limit 6, escaped search, category/type/price/stock filters, stable sort and pagination |
| `GET /api/equipment/:id` | Signed-in user | Approved details; own pending listings/admin moderation exceptions |
| `POST /api/equipment` | Owner | Validated new pending listing; server-supplied owner/status |
| `PATCH/DELETE /api/equipment/:id` | Owning Owner or Admin | Inventory-safe edit or soft deletion; active reservations block destructive changes |
| `GET/PATCH /api/me` | Signed-in user | Safe current profile; no role/email privilege mutation |
| `GET/PUT/DELETE /api/favorites[/id]` | Customer | User-scoped database favorites |
| `GET /api/owner/equipment` | Owner | Own listings only |
| `POST /api/checkout` | Customer | Transactional availability/price verification and Stripe test Checkout |
| `GET /api/checkout/holds`, `POST /api/checkout/:id/cancel` | Customer | Own pending holds; verify processor state before releasing inventory |
| `POST /api/payments/webhook` | Stripe signature | Paid fulfillment/expiration; no user-supplied success confirmation |
| `GET /api/payments/:sessionId` | Owning Customer | Verified payment confirmation only |
| `GET /api/rentals` | Signed-in user | Customer/Owner scoped rentals; Admin all rentals; pagination |
| `/api/admin/users`, `/api/admin/users/:id` | Admin | Safe user records and role/disabled changes; revoke sessions, prevent self-demotion |
| `/api/admin/equipment`, `/api/admin/equipment/:id/status` | Admin | All listings and moderation |
| `PATCH /api/admin/rentals/:id` | Admin | Date-constrained ongoing/completed transitions |
| `GET /api/analytics` | Owner/Admin | Scoped totals, revenue and monthly payment/booking counts |
| `POST /api/uploads` | Signed-in user | Bounded image-signature-validated upload to fixed imgbb HTTPS destination |

The existing health/diagnostic endpoints remain separate. The frontend gateway does not expose database-health diagnostics or the Stripe webhook. JWT signatures, expiry, issuer and audience are checked; every protected request also checks current DB role, disabled status, active session and session expiry. Role changes invalidate existing sessions. No token is persisted to browser storage.

## Required environment configuration

Frontend Vercel: server-only `API_BASE_URL=https://api.mziae.com`. Never place MONGODB_URI, DIAGNOSTIC_KEY, BETTER_AUTH_SECRET, STRIPE_SECRET_KEY, GOOGLE_CLIENT_SECRET or IMGBB_API_KEY in NEXT_PUBLIC variables. No browser Stripe key is necessary for hosted Checkout. Do not set LOCAL_INTEGRATION_TEST on Vercel.

Backend, after separate approval: preserve MONGODB_URI, DIAGNOSTIC_KEY, PORT and E8 network rules. Add independent BETTER_AUTH_SECRET (at least 32 random characters); FRONTEND_URL and AUTH_PUBLIC_URL equal the exact approved frontend HTTPS origin; CORS_ORIGIN equal that same origin; optional provider keys documented in [manual setup](F1-provider-setup.md). These variables have not been added to production.

The browser talks to the frontend origin. Next forwards fixed-target auth/business requests to Express; host-only HttpOnly cookies are set on the frontend host. AUTH_PUBLIC_URL causes Google's callback to return through the frontend's `/api/auth/callback/google`, avoiding third-party-cookie dependency. Better Auth checks trusted origins; the Next gateway rejects foreign mutation origins. Direct credentialed browser-to-API cookies are not the chosen integration path.

## Approval-gated release sequence

1. Review the complete client/server diff, requirement checklist and provider verification results. Existing E5–E8 changes are separate pre-existing uncommitted work; do not include private `.netlify` receipts or secrets in commits.
2. Approve deliberate, meaningful source commits and pushes separately. Assignment demands at least 20 client/12 server commits. Initial history counts were 1 client/8 server; no new commits have been made. Do not fabricate history or claim these counts are satisfied.
   Before any push, inspect existing Netlify Git/branch auto-deploy behavior read-only. A push can publish automatically even without a deployment command. Do not push a triggering branch or change build settings unless that publication/hold is explicitly approved; preserve the existing fallback and its accepted artifact.
3. Approve the exact frontend project name/owner-controlled DPS destination and creation. Do not create a second Equipora project if one now exists. Obtain the exact resulting hostname before configuring auth origins/callbacks; project creation/publication and settings need approval.
4. Prepare the backend release locally (`scripts/prepare-exonhost-package.ps1` copies all compiled dist modules, package files and Passenger bootstrap). Review manifest and secret scan. Do not upload until approved. New production dependencies require Linux `npm ci --omit=dev` through the supported ExonHost Node environment. Build tooling is local/dev-only; startup remains `passenger.cjs` and compiled JS.
5. Approve backend application behavior/configuration release and provider webhook/callback changes, preserving E8 infrastructure and the main website. Bootstrap the first Admin only for an explicitly approved account using a controlled, separately approved procedure. No production admin has been provisioned.
6. Validate backend health, protected business endpoints, cookie/JWT behavior and cross-origin controls on the exact frontend origin. Complete Google, Stripe test checkout/webhook and imgbb acceptance with private credentials; do not use real payments.
7. Approve the frontend deployment. Run final checks on the exact committed/approved code, deploy without changing billing, and verify all public/private routes on refresh at mobile/tablet/desktop sizes.

## Rollback

- Keep the accepted E8 backend archive/manifest and its private runtime configuration unchanged. Before any F1 release, capture the existing private app configuration and package/release manifest through authorized mechanisms.
- Backend rollback restores only the isolated Equipora application artifact and previously approved environment configuration, reinstalls matching production dependencies and restarts only Equipora Passenger. Never alter mziae.com, DNS, certificates, Atlas rules, users or database data as part of code rollback.
- Database rollback must **not** drop collections or delete user/payment data. F1 uses additive collections/fields; reverting code may make new business routes unavailable but preserves records for reconciliation. Stop financial actions during a failed rollout and reconcile Stripe before releasing holds.
- Frontend rollback restores the previous approved Vercel deployment/alias through the provider's supported rollback after approval. Retain Netlify fallback; do not delete projects/deployments or change DNS automatically.
- Rollback is a prepared procedure, not authorization to execute it during this local phase.

## Remaining gates

Private provider credentials/callbacks and live provider acceptance; approved frontend hostname and production auth origins/secrets; first production Admin/account approval; meaningful commit requirements; review of the remaining development-only dependency advisory; backend and frontend release approvals. Until these pass, F1 is locally implemented and **not deployment accepted**.
