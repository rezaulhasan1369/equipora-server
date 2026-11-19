# F3 controlled release and rollback plan

Prepared 2026-11-19. This is a plan, not execution authority. No commit, push, upload, deployment, provider configuration, database write, DNS/SSL/Atlas change or billing change is authorized by F3.

## Release prerequisites

1. Owner visually accepts the existing design and two minimal accessibility corrections. Resolve review-card content and any rubric interpretation questions in [the matrix](F3-requirements-matrix.md).
2. Review both complete working-tree diffs and the proposed file scope. Server history has 8 commits; client has 1. The rubric's 12/20 meaningful-commit requirements remain unmet. Obtain approval for an honest development/publication approach; do not backdate, manufacture or promise full commit-count marks.
3. Before any future push, inspect GitHub/Netlify automatic build hooks, branches and deploy triggers read-only. A normal push can publish the fallback automatically. Preserve the accepted fallback artifact; no trigger changes or deployment suppression without explicit approval.
4. Reconfirm owner-controlled DPS Vercel destination and Hobby eligibility. Fresh read-only team lookup confirmed DPS/dps25; project search found no Equipora project. Team billing plan was not returned. Earlier ownership/Hobby checks are recorded in F1; project-specific limits/settings still need inspection at creation. Hobby is for personal/noncommercial use: an assignment demo can be evaluated on that basis, not silently operated as a commercial rental business. [Vercel policy](https://vercel.com/docs/plans/hobby).
5. Select and approve a stable frontend HTTPS hostname. A project/hostname reservation or preview publication is itself a remote operation requiring approval; do not invent a final URL or use arbitrary changing previews as trusted origins.
6. Review current ExonHost package/app limits, disk/RAM headroom, Node 22.23.5 selection, isolated mapping and exact E8 artifact/environment backup through authorized mechanisms at release time. Current production resource consumption was not re-inspected in F3.

## Stripe lifecycle and final test configuration

The CLI-created claimable sandbox is useful for local simulated payments, but is not an acceptable unreviewed long-term dependency. Official CLI documentation says unclaimed sandboxes expire after seven days; claiming preserves the account/data, followed by CLI login for permanent keys. The actual creation/expiry date and claim status have not been privately read in F3. Do not infer permanent ownership merely from an operational key. [Stripe sandbox lifecycle](https://docs.stripe.com/cli/sandbox).

Owner must manually claim the existing sandbox (or select an existing owned persistent sandbox) and confirm the intended account. Do not create duplicate sandboxes or modify live account/payment settings automatically. Retest with that owned sandbox's current test credentials before release. The application explicitly supports `sk_test_` and `rkcs_test_` formats; do not rewrite prefixes. Generic restricted `rk_test_` keys remain unsupported and would need a separately reviewed permission-aware change. No live key or live payment is permitted by this plan.

For a hosted assignment demo use **persistent test mode only**, clearly identify payment as simulated, and register a supported **snapshot-event** webhook endpoint at `https://api.mziae.com/api/payments/webhook` after approval. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`; endpoint API event format/version must be compatible with the pinned SDK and retested. The hosted endpoint's signing secret is distinct from the local CLI listener secret. Do not deploy the CLI listener, its credentials, claim links, local synthetic sessions or DPAPI file. No publishable browser key is needed for hosted Checkout. Production in the hosting sense does not authorize real monetary transactions.

## Exact environment map

| Destination | Variable | Approved future value/source |
|---|---|---|
| Vercel server runtime | API_BASE_URL | `https://api.mziae.com` |
| Vercel | Node/framework/root/build | Node 22.x; Next.js; repository root `/`; `npm ci`; `npm run build`; framework-managed output |
| Vercel | LOCAL_INTEGRATION_TEST | Must be absent; never deploy the local override |
| ExonHost | NODE_ENV | `production` via supported private runtime controls |
| ExonHost | PORT | Preserve hosting-assigned setting and Passenger behavior; do not hardcode a replacement |
| ExonHost | MONGODB_URI / DIAGNOSTIC_KEY | Preserve existing E8 values privately; no Atlas/network/user changes |
| ExonHost | FRONTEND_URL / AUTH_PUBLIC_URL / CORS_ORIGIN | The same exact approved frontend HTTPS origin, without paths or wildcards |
| ExonHost | BETTER_AUTH_SECRET | New independent random secret, at least 32 characters, private runtime control; never diagnostic key or local ephemeral secret |
| ExonHost | GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Owner-controlled OAuth Web client approved for the final hostname; reusing any local client requires an explicit provider-setting decision |
| ExonHost | STRIPE_SECRET_KEY | Validated persistent owner-controlled **test** key; never live |
| ExonHost | STRIPE_WEBHOOK_SECRET | Secret for the approved hosted snapshot webhook, not the CLI listener |
| ExonHost | IMGBB_API_KEY | Owner-controlled backend-only key; approved hosted use/configuration, not implicitly copied from the local encrypted file |

All provider secrets stay on ExonHost. Do not add NEXT_PUBLIC secret variables or place runtime files in `~/api-public`. Protect environment backups outside public roots and Git; publish only variable names/placeholders. DPAPI local storage is tied to Windows user/machine and is not an ExonHost deployment mechanism.

## Cross-domain auth/CORS acceptance

Browser requests stay on the frontend origin through `/api/auth/*` and `/api/backend/*`; Next forwards only to the fixed API origin. Cookies are host-only/HttpOnly on the frontend host; HTTPS enables Secure. JWTs are requested as needed, not stored in localStorage. Backend AUTH_PUBLIC_URL is the frontend origin so issuer/audience and the Google callback match the gateway. Do not set cookie Domain=mziae.com or depend on cross-site backend cookies.

Google JavaScript origin is the exact approved frontend origin, and redirect URI is `<FRONTEND_ORIGIN>/api/auth/callback/google`. Preserve localhost configuration for development if appropriate; never accept wildcard callbacks or unreviewed preview origins. OAuth consent audience/testing users must permit examiner access, an owner/provider decision that must be verified without enabling email-verification/reset requirements. Secrets/codes/state must not appear in screenshots or reports.

Validate same-origin POSTs, foreign-Origin rejection, approved-origin API/CORS behavior, cookie Secure/HttpOnly/SameSite attributes, token issuer/audience, active-session revocation, Google callback, and every protected route reload on the final domain. Local success does not prove production proxy headers, Passenger behavior, provider permissions or cookie handling.

## Controlled sequence after separate owner approval

1. Record exact approved revisions/artifact SHA256 and reviewed file lists. Approve meaningful commits/pushes only after automatic deployment effects are known. Do not stage historical infrastructure work indiscriminately.
2. Create/configure the approved Vercel project in DPS only with explicit authorization. Pin the intended repo/branch/root and Node version; obtain the stable hostname without unnecessary custom DNS or paid resources. Any preview publication must be approved as publication.
3. Prepare backend artifact locally using `scripts/prepare-exonhost-package.ps1`: compiled `dist`, package.json, lockfile, passenger.cjs and integrity manifest. Inspect the archive for secrets and fixture/operator files. Verify exclusion of `.env`, provider XML, receipts, local runner, tests, node_modules, source-only tsx tooling and unrelated historical docs. Record archive hash. The packaging script builds only; do not confuse its existence with an already accepted F3 artifact.
4. Back up the currently deployed E8 archive, manifest and private app configuration. Upload/extract only under `~/apps/equipora-api`; verify each manifest entry. Use supported ExonHost Node 22.23.5 environment for Linux `npm ci --omit=dev`. Do not upload Windows node_modules. Keep startup `passenger.cjs` and separate document root `~/api-public`; never remap to mziae.com.
5. Apply only approved private environment additions/changes and Google/Stripe test webhook configuration. Restart only Equipora Passenger. Verify Node/startup/assigned PORT, API health 200 and denied diagnostic health without a key, safe logs and resource limits. Preserve restricted Atlas connection without enlarging access.
6. Publish the approved frontend with server-only API_BASE_URL; perform exact-origin smoke/QA and all deep links/reloads before final acceptance. Check valid endpoints for unexpected CORS/404/504 failures. If either side is not ready, pause public business/payment workflows rather than point the app at incompatible E8 routes.
7. Initial Admin: owner registers an intended email/password account using their own private password. Approve exact account privately; confirm database scope/no existing Admin. `initialAdminPlan` and `applyInitialAdmin` are local, tested helpers, not a deployed HTTP backdoor or executable production provisioning command. Prepare/review a one-shot operator mechanism, five-minute plan and transaction, with a duplicate-resistant bootstrap record and session revocation. Execution is a separately approved production write. Never provision the fixture Admin/password. Keep examiner credentials out of README/Git/chat and deliver through an owner-controlled private channel.
8. If assignment content is needed, approve exact owner-provided real/demo listings and permissioned review content separately. Do not run the isolated fixture seed against Atlas. App acceptance registrations/equipment/bookings are production database writes even in Stripe test mode; require approval and an explicit data scope.
9. Verify Google login/default Customer/logout, Owner upload/pending listing, Admin moderation/role change, favorites/profile, rental quote/availability, one authorized **test** Checkout, genuine hosted signature fulfillment/duplicate handling, failure/cancel cleanup and analytics. Verify CPU/RAM/process usage and logs through supported hosting controls. Confirm mziae.com and its existing certificate unchanged. No account-wide AutoSSL.
10. Owner accepts final URLs, privately provisioned examiner access, final README live links, final committed hashes and submission matrix. Only then claim hosted application release acceptance.

## Rollback, scoped to new application releases

Before rollout, retain the exact E8 artifact and private configuration backup and the previous approved frontend deployment reference. Define who can authorize and execute rollback; preparing this plan is not execution approval.

- Stop further payment attempts and reconcile any received Stripe test events before changing fulfillment code. Do not release ambiguous holds by database edits.
- Restore only Equipora's prior ExonHost artifact/private app configuration, matching production dependencies, then restart only its Passenger application. Verify `/api/health`, diagnostic auth and resource health. E8 rollback removes marketplace behavior; it is not a business-feature fallback, so withdraw the new frontend business entry points as part of the coordinated rollback.
- Restore the previous approved Vercel deployment/alias using the supported rollback mechanism. If none exists for a first deployment, agree on an explicit unpublish/maintenance action before release. Keep existing Netlify artifacts and do not mutate its project/DNS without approval.
- Never drop collections, restore an entire shared database, delete payments/users, change Atlas entries or modify NobleNest. Preserve additive business data for reconciliation. Source rollback is not a database rollback.
- Provider rollback must be limited to the newly created/approved Equipora webhook/callback settings and private env additions; do not revoke unrelated keys or replace the main website certificate.

## Explicit decisions still required

Visual/content acceptance; honest commit-history deficit handling and commit/push scope; Netlify auto-deploy effects; stable frontend hostname/project/Hobby eligibility; persistent owned Stripe **test** environment and hosted webhook; Google examiner audience/final callback; approved backend env/dependency rollout; exact initial Admin target and operator execution; approved demo/acceptance data writes; production publication and coordinated rollback authority. Until these gates close: ready for owner local visual review, not ready for production deployment or final submission.
