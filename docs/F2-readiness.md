# F2 integration and release-readiness checkpoint

Date: 2026-11-18. F1 remains the accepted local implementation. No production changes, database migrations/writes, commits, pushes, paid operations or provider settings changes are authorized/performed in F2.

## Provider review and private configuration

Google uses Better Auth on Express through the frontend's fixed same-origin gateway. AUTH_PUBLIC_URL and FRONTEND_URL identify the frontend origin; the local callback is exactly `http://localhost:3000/api/auth/callback/google`. New users default to Customer. Sessions use HttpOnly host-only cookies; protected API calls verify JWTs and current session/role state. Review corrected external OAuth redirect validation to reject HTTP/embedded credentials and added safe failure/loading handling to the Google button.

Stripe remains test-only (`sk_test_` and `livemode: false`). Prices and quantities come from the server; reservations use MongoDB transactions. Fulfillment requires a valid signed webhook, matching reservation/session/amount/currency/customer, and unique payment/booking identifiers. Success-page navigation is not proof of payment. Ambiguous provider outcomes retain holds for reconciliation; cancellation checks Stripe before releasing inventory. No real payment or actual provider Checkout has been run.

imgbb accepts authenticated, bounded JPG/PNG/WebP data and uses only the fixed HTTPS API with a timeout and bounded response. The key stays backend-only. The F1 owner CRUD browser test mocks only this upload response; a real upload remains unverified.

`scripts/local-providers.ps1` prepares masked Windows-user DPAPI-encrypted configuration at `%LOCALAPPDATA%\Equipora\providers.xml`, outside both repositories. Its Set action merges one provider at a time without displaying values. Status reports booleans only. Run decrypts only into a short-lived child-process environment for the isolated runner. The encrypted file now exists with Google configured; Stripe and imgbb remain unconfigured. No credential values were printed. PowerShell syntax validation passed.

The isolated runner consumes/removes the transient JSON before starting MongoDB, rejects unknown configuration names and live Stripe keys, sanitizes JSON errors, never loads the existing `.env`, and always creates its own disposable local database/signing secret. Existing plaintext provider-file support is retained for compatibility; the encrypted helper is now preferred. Neither path may contain database/diagnostic/production settings.

## First owner action â€” Google only

1. Open your owner-controlled Google Cloud Console and choose a dedicated/intended Equipora project.
2. Configure Google Auth Platform branding/consent as Equipora; keep the app in Testing and add your Google account as a test user. Only basic OpenID/email/profile identity is needed.
3. Create a **Web application** OAuth client with JavaScript origin `http://localhost:3000` and redirect URI `http://localhost:3000/api/auth/callback/google`.
4. From `D:\Equipora\server`, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-providers.ps1 -Action Set -Provider Google
```

5. Enter Client ID and Client Secret at the masked prompts. Do not put them in chat, `.env`, screenshots, command arguments or commits. The execution-policy override applies only to that PowerShell process.
6. Report only that Google configuration was saved. The agent will restart the local API using `-Action Run` and coordinate your manual Google sign-in. Do not start a second API while port 5090 is occupied.
7. Acceptance must verify the Google-created account is Customer, the cookie/session survives private-route reload, logout invalidates access, and no secret is exposed. At the owner's updated request, imgbb is next, followed by Stripe test mode.

No production OAuth URI/domain/billing setting should be changed in this local step. Official references: [Better Auth Google](https://better-auth.com/docs/authentication/google), [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## GHSA-fc5q-39xc-vjpf

Confirmed installed chains are ESLint tooling:

- eslint-config-next â†’ @next/eslint-plugin-next â†’ fast-glob â†’ micromatch â†’ picomatch 2.3.2.
- eslint-config-next â†’ eslint-import-resolver-typescript â†’ tinyglobby/fdir â†’ picomatch 4.0.7.

`npm ls picomatch --omit=dev --all` returns an empty production dependency tree. Both production-only audits report zero vulnerabilities. Full frontend audit reports 14 high transitive findings propagated from this one advisory; the direct affected dependency is eslint-config-next. The advisory affects versions through 4.0.7 and reports no patched release at review time. No dependency upgrade, override, vendored patch or framework downgrade was applied.

Application request handlers do not accept glob patterns or import picomatch. **Runtime qualification:** Next.js also ships `next/dist/compiled/picomatch/index.js`, outside the npm-listed dependency graph. Its bundled package metadata omits a version. Installed `next/dist/shared/lib/match-remote-pattern.js` and `match-local-pattern.js` call that copy using developer-configured hostname/path patterns; URL input is the string being matched, not a caller-supplied glob. Equipora defines no user-controlled patterns and its user-supplied images use `unoptimized`. This establishes the reported npm findings as development/build exposure, but does not prove all bundled runtime code is patched or that every framework call site is safe. The clean production-only audit cannot settle vendored-library exposure. Record this uncertainty at release review rather than declaring the whole issue development-only.

Builds still execute development dependencies. Keep configuration/source owner-controlled, do not introduce untrusted glob patterns, monitor the upstream fix and review vendored framework copies at release approval. No public exploit path was identified by this review; this is not a proof of universal unreachability. [Primary advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).

## Initial Admin preparation

`src/admin-bootstrap.ts` prepares an initial-Admin plan only for an existing exact user ID/email in the Equipora database, with a five-minute expiry and no existing Admin. Its transaction uses a unique singleton bootstrap record, compares the target's current Customer role/disabled state, promotes exactly one account and revokes its sessions. No password is accepted, generated or hardcoded. The user must first establish their own account through Better Auth email/password registration or Google.

There is **no HTTP endpoint or production execution CLI** for this operation. Transaction logic is exercised only against disposable MongoDB in tests. Production execution requires separate owner approval of the exact account and a reviewed execution mechanism. F1's public synthetic fixture Admin/password is local-test-only and must never become the initial production Admin.

## Repository and release audit

- Client history: one foundation commit. Server history: eight foundation/diagnostic commits. No F1/F2 business commits exist yet, and the required 20 client/12 server meaningful commits are not satisfied. Do not rewrite/manufacture history.
- Local working trees include accepted F1 changes and earlier E5â€“E8 changes; preserve them and stage only reviewed scope when commits are eventually approved.
- Runtime `.env` names were inventoried without values: client `.env.local` has API_BASE_URL; server `.env` has PORT/MONGODB_URI/DIAGNOSTIC_KEY/CORS_ORIGIN. No provider credentials are present under those names. `.env.example` contains placeholders, not configured credentials.
- DPS remains the intended owner-controlled Vercel scope; a fresh read-only project search found no Equipora project. No project was created or linked. Root `/`, Next.js, Node 22.x, server-only production API_BASE_URL, exact approved auth origins and personal/noncommercial Hobby eligibility remain the plan.
- Before any future push, inspect Netlify automatic deployment triggers so preserving the fallback is not accidentally defeated by a Git push.

The F1 coordinated release/rollback plan remains applicable: [deployment readiness](F1-deployment-readiness.md). Production secret/origin changes, backend behavior release, Admin provisioning, Git publication and Vercel publication all remain approval gates.

## Verification status

F2 checks: 27 backend tests passed under Node 22.23.5 including the two new configuration/Admin tests; frontend policy tests: 5 passed; frontend lint/TypeScript and production build passed. All 17 browser acceptance checks passed against the reviewed local production build, including viewport layouts, accessibility, private reloads, owner CRUD and unhandled-page-error checks. Private helper PowerShell syntax passed. Google is now configured privately; Stripe and imgbb remain unconfigured. This checkpoint must not be called full integration or production acceptance.

## Google acceptance update — 2026-11-19

The owner completed Google consent and observed the local Customer Dashboard, account information and Customer role. A read-only check scoped to the MongoDB child of the isolated API confirmed exactly one Google account linked to an enabled Customer, verified email, provider-token-exchange evidence and an unexpired session. Only boolean results were emitted; no private identifiers, tokens or provider values were printed.

Three existing local browser regressions passed: Customer session reload/profile/favorites, Owner dashboard reload, and gateway restrictions. An additional isolated synthetic Customer browser check confirmed authenticated API 200, Admin API 403, logout followed by replay of the same JWT 401, and private-route redirection to login. Initial ad hoc attempts used the wrong button label and omitted the required bearer header; correcting the verification harness produced the stated passing results without application changes. These checks establish the shared session/RBAC behavior; the owner's Google post-logout route-protection check is now accepted as owner-observed evidence (see below); a separate Google-account reload while signed in was not explicitly reported. The real Google callback and token exchange succeeded locally; production Google remains unconfigured/unverified.

## Next provider — imgbb

Open https://api.imgbb.com/ in the owner's browser, sign in/create an owner-controlled account and obtain an API key using the available API-key control. No OAuth callback or production origin change is required. Store it only through the existing masked helper:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-providers.ps1 -Action Set -Provider Imgbb
```

This merges the key into the existing encrypted file and preserves Google configuration. Do not send the key in chat or place it in command arguments, source, public environment variables or screenshots. Report only that imgbb was saved. The current API does not hot-reload provider configuration; restart will be coordinated after Google-session acceptance and resets the disposable database/sessions. Real upload acceptance will use a synthetic nonprivate image, verify authenticated upload and returned HTTPS image rendering, and avoid production writes. Stripe remains deferred until imgbb acceptance.
## Google manual logout acceptance - 2026-11-19

PASS (owner-observed): after successful Google sign-in, the owner logged out and manually revisited `http://localhost:3000/dashboard`. Equipora redirected to `http://localhost:3000/login?returnTo=/dashboard`; the Customer Dashboard was inaccessible. This completes the requested real-Google post-logout route-protection check. It supplements the independently verified local account/session evidence and synthetic-session JWT revocation checks above. No production settings or data were changed.

Private configuration status at this checkpoint: Google configured; imgbb and Stripe not configured. Real imgbb upload testing awaits masked API-key entry using the existing encrypted helper. The existing runtime `.env` must remain unchanged.
## Real imgbb acceptance - 2026-11-19

PASS: encrypted helper Status confirmed Google and imgbb configured, Stripe absent, without printing values. Restarted only the isolated local API to load the key; disposable fixtures/sessions were reset. One real upload used the Owner Add Equipment form with no response mock: a generated 360x180 PNG containing only synthetic test text. The gateway/upload returned HTTP 200, the UI displayed success and the remote HTTPS image decoded at the expected dimensions. The response contained only the image URL; no provider key or deletion capability was returned or recorded. No listing was submitted and no production database writes occurred. This synthetic image was uploaded to the owner's imgbb account; automatic expiration/deletion was not requested by the existing upload implementation.

Rejection checks: missing authentication 401; invalid image signature 400; extra caller-supplied URL field 400; oversized JSON 413. Unhandled page errors: zero. The existing upload code retains its fixed provider destination, 10-second deadline, redirect rejection, 2 MB image limit and 32 KB response limit. No application source changes were needed for this acceptance test.

Next: Stripe test-mode/sandbox setup. The Stripe CLI is not currently on PATH. The owner must select an owner-controlled sandbox/test environment and obtain the test secret privately; live keys/payments are forbidden. CLI installation/authentication and a local webhook listener must be prepared before storing the paired Stripe key and webhook secret through the existing encrypted helper. Do not create production webhook endpoints or modify production configuration.
## Stripe sandbox preparation - 2026-11-19

Owner reports a test sandbox created. Verified installed CLI version 1.55.13 through `stripe.cmd --version` and reviewed local `listen --help` without reading CLI credential files. The npm shim resolves to @stripe/cli. Use stripe.cmd to avoid the PowerShell script execution-policy issue. No Stripe API requests, Checkout sessions or simulated payments have been executed at this checkpoint.

Reviewed `scripts/local-providers.ps1`: `Set -Provider Stripe` reads STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET through hidden SecureString prompts, requires sk_test_ and whsec_ prefixes, merges existing Google/imgbb fields, and stores the result with current-Windows-user DPAPI encryption outside both repositories. Values are not accepted as command arguments or printed. Exact storage command (run only when both values are ready):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/local-providers.ps1 -Action Set -Provider Stripe
```

No browser publishable key is needed for hosted Checkout. The CLI signing secret must belong to the same sandbox as the test secret. Keep CLI authentication and all secret-bearing terminal output private. Do not share raw CLI logs, screenshots, sandbox handoff files or configuration contents.

First manual step: in the CLI context for the newly created Equipora test sandbox, start a local-only webhook listener and leave it running:

```powershell
stripe.cmd listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired --events-from '@self' --forward-to http://127.0.0.1:5090/api/payments/webhook
```

This uses test mode by default, fixed loopback forwarding, only the events handled by the application, no live flag, no TLS bypass, and no dashboard endpoint creation. Its ready message includes the local webhook signing secret: keep that value private for the masked storage prompt. Do not start a payment yet. After listener readiness, guide masked entry, verify private configuration flags, and coordinate an isolated API restart. The listener and API must use the same sandbox; never guess if sandbox ownership/selection is uncertain. Actual Checkout, signed delivery, duplicate delivery, decline/cancellation, authorization and record consistency remain pending credentials and local execution.

Official reference: https://docs.stripe.com/cli/listen
## Stripe masked-entry failure investigation - 2026-11-19

The owner reported failure immediately after the Stripe secret prompt, before the webhook prompt. The old catch collapsed every exception into private_provider_configuration_failed and discarded the entered value. Consequently the exact historical rejection cannot be reconstructed without guessing. No rejected secret was stored or retained for inspection.

Verified the owner's existing encrypted file decrypts: Google and imgbb remain configured, Stripe is absent, and no pending file exists. The helper, TypeScript local-provider validator and runtime Stripe factory all require sk_test_. Official Stripe documentation also identifies rk_test_ restricted sandbox keys and pk_test_ publishable sandbox keys. Restricted test keys are currently unsupported; publishable keys cannot serve as backend secrets. A sandbox alone does not establish which key type was entered. No Stripe settings or keys were created, changed, read from CLI configuration or weakened.

Focused local correction: scripts/local-providers.ps1 now emits only predefined category and stage values for input/storage/runner failures, never exception text. It distinguishes restricted test keys, live keys, publishable keys, unrecognized secret format, empty/oversized/control-character/edge-whitespace inputs and invalid webhook format. It retains the existing sk_test_ and whsec_ requirements, adds NUL/edge-whitespace rejection, and does not silently trim or accept a different key class. Save occurs only after both hidden prompts validate; failure before save preserves the encrypted file.

Added tests/local-provider-helper.test.ts, using only synthetic fixture credentials, an isolated temporary LOCALAPPDATA and actual Windows DPAPI. Tested all fixed rejection categories; each invalid-key attempt left the saved file byte-for-byte unchanged. Successful paired entry preserved Google/imgbb flags and exact synthetic values. Initial test harness JSON-array handling was corrected for Windows PowerShell; final tests pass. No real credentials enter test output.

Validation: helper syntax errors 0; TypeScript PASS; production build PASS; backend regression cases 28/28 PASS; git diff --check PASS. Rechecked the owner's Google/imgbb presence without revealing values. Changes in this checkpoint are limited to the helper, its new test and this report; earlier work is preserved. No production changes, commits or pushes occurred.

Safe retry: keep the test listener running, use the same masked Set -Provider Stripe command, and privately enter the intended sandbox's supported sk_test_ backend key (no surrounding quotes/whitespace) followed by that listener's whsec_ value. Never replace a prefix or use a live key. If the sandbox only supplies rk_test_, stop and report only the fixed unsupported category; restricted-key support requires a reviewed permission-aware implementation, not bypassing validation. Share only the helper's sanitized status/category/stage. Actual Checkout and webhook acceptance remain pending.
## Approved claimable-sandbox compatibility - 2026-11-19

Owner approved local support for the documented rkcs_test_ secret format. Stripe CLI sandbox documentation explicitly returns this format as secret_key (https://docs.stripe.com/cli/sandbox); Stripe's own demonstration uses a claimable sandbox for Checkout (https://stripe.dev/blog/claimable-sandboxes-frictionless-stripe-accounts-for-agents). Earlier sk_test_-only guidance was incomplete for this workflow. Prefix-format acceptance does not prove an actual key's validity, sandbox identity, expiration or API permissions; real provider acceptance remains pending private entry.

Focused implementation:
- scripts/local-providers.ps1: anchored, case-sensitive allowlist for sk_test_ and rkcs_test_, with a nonempty alphanumeric suffix; hidden prompts/DPAPI merge and fixed failure categories retained.
- src/local-provider-config.ts: shared isStripeTestSecret guard enforces the same accepted formats, a 4096-character ceiling and no edge whitespace; local configuration uses it.
- src/marketplace.ts: runtime Stripe factory uses the shared guard, retaining the existing SDK timeout/retry behavior and all webhook/test-mode checks. No key rewriting, credential logging or TLS changes.
- tests/f2-security.test.ts and tests/local-provider-helper.test.ts: accepted legacy/claimable formats, runtime SDK construction without network calls, malformed/empty/suffix/case/whitespace/control/live/publishable/unsupported-key rejection, real synthetic DPAPI preservation and unchanged saved files after rejection. Windows truncates NUL during environment assignment, so NUL rejection is tested at the input-validation boundary rather than on an already altered environment value.

Validation PASS: backend TypeScript, compiled production build, all 29 backend tests (including actual handler regressions), frontend lint and TypeScript, five gateway policy tests, helper syntax (0 errors), git diff --check. Backend production dependency audit: zero vulnerabilities; no dependencies changed. Focused literal scan across the five changed code/test files found zero credential-like literals; it did not inspect private runtime files. Existing frontend advisory assessment above remains applicable. The backend has no configured ESLint task; TypeScript checks are its configured static check. Frontend production build was not repeated because no frontend code changed.

Private Status still confirms Google and imgbb configured, Stripe unset. No owner credential file was changed by implementation or synthetic tests. No commits, pushes, production/provider changes or payment requests occurred. Retry the existing masked Set -Provider Stripe command using the unchanged rkcs_test_ key and the same sandbox listener's whsec_ secret. Keep the listener open. After saved confirmation, verify status and restart only the disposable API, then execute local test Checkout/signature/replay/decline/cancellation/authorization/record-consistency acceptance. These real Stripe checks are not yet claimed as passed.
## Real Stripe sandbox preflight - 2026-11-19

Private configuration Status confirms Google, imgbb and Stripe configured; no values printed. Started a fresh disposable local API with encrypted provider configuration and the existing local frontend build on Node 22.23.5. Existing production environment files were not loaded or changed.

Real sandbox evidence: synthetic Customer email/password login returned 200; local checkout endpoint created a Stripe-hosted Checkout URL with a server-calculated amount (200). The URL/session identifier was not printed or persisted in the report. Cancelled this same session through the Customer-scoped application cancellation endpoint (200), which retrieves/expires the real provider session before releasing its hold. Remaining held reservations: 0; rental bookings: 0. Anonymous Checkout rejected 401; a deliberately invalid webhook signature rejected 400. No simulated card payment has yet been completed, and no successful signed event delivery is claimed from these checks.

Next manual step: keep the sandbox listener running; sign in on localhost:3000 with the disposable Customer fixture, open a listing, fill future dates/quantity and synthetic contact/address values, then continue to hosted Checkout. Use only Stripe's documented interactive success card 4242 4242 4242 4242, future expiry, any three-digit CVC and synthetic billing information (https://docs.stripe.com/testing). After one successful simulated payment, leave the resulting local page open and report only success/error category. Do not send Checkout URLs, session identifiers, keys or raw listener logs. Then verify signed fulfillment, booking/payment consistency and duplicate delivery; decline testing remains a separate subsequent step. No production writes, commits, pushes or deployment occurred.
## Real sandbox payment and idempotency acceptance - 2026-11-19

Owner completed one simulated hosted Checkout payment. Verified read-only against the disposable local database before any replay: exactly one payment and one booking existed, linked to a paid reservation. Booking paymentStatus=paid and bookingStatus=confirmed. Reservation/booking/payment identifiers, customer/owner associations and totals matched privately.

Stripe test-mode readback confirmed Checkout complete, payment paid, livemode=false, USD amount and payment-intent transaction matching the saved record. Retrieved the genuine checkout.session.completed event for that session privately. Existing signed fulfillment before replay establishes that the original local webhook handler accepted and persisted the payment; no operator fulfillment call or direct database writes were performed by verification.

Duplicate test: replayed that genuine event twice to the local raw-body webhook with freshly generated signatures using the stored listener secret; both returned 200. Database counts remained exactly one booking and one payment. This tests handler idempotency with a locally re-signed genuine event; it is not a Stripe-hosted resend/delivery-retry test. Payload tampering while retaining the signature returned 400. No event body, keys, signatures, transaction IDs, Checkout URLs or private identifiers were printed or retained in this report.

Customer acceptance: server-backed payment-proof endpoint reported paid=true; rentals endpoint returned one record; browser My Rentals table displayed paid/confirmed and retained that state after private-route reload. All checks used isolated local fixtures. No production changes, commits or pushes. Remaining real Stripe scenario: interactive declined card followed by cancellation/hold-release and confirmation that existing paid booking/payment records remain unchanged. Do not call F2 complete before that check and remaining release gates.
## Real declined-payment and cleanup acceptance - 2026-11-19

Owner observed the documented declined-card result in hosted Checkout. Read-only Stripe readback of the sole held local reservation confirmed livemode=false, Checkout open/unpaid and its PaymentIntent requires_payment_method with last_payment_error.code=card_declined. No booking or payment existed for that declined session; totals remained one prior paid booking and one payment.

The initial Customer-scoped cancellation verification used the synthetic Customer fixture, while the declined reservation belonged to another local Customer account. That scoped attempt did not release the target; a zero-hold response for the fixture was not evidence of global cleanup. Global database/provider readback exposed this mismatch, and no success was claimed from the scoped result. No user identity, session or token was disclosed or borrowed.

Cleanup was performed only after positively matching the sole held reservation to an open/unpaid, test-only Stripe session with matching reservation metadata and a card_declined error. Expired exactly that session through the Stripe test API. The genuine checkout.session.expired delivery then changed its local reservation to expired. Verified remaining global holds=0, payment count=1, booking count=1 and the original paid booking/payment association, amount and confirmed status intact. This validates real expiration-webhook cleanup; real Customer-scoped cancellation had already passed in the earlier synthetic Checkout preflight. No direct database cleanup writes were used.

Local provider acceptance now covers actual Google callback/token exchange/default Customer/logout, real imgbb upload/render, actual sandbox hosted Checkout payment and signed fulfillment, genuine-event locally re-signed duplicate delivery, tamper/unauthorized rejection, interactive decline/no unpaid booking, application cancellation preflight and genuine expiration-webhook cleanup. This is local test acceptance, not production publication or Stripe-hosted resend verification. Existing release gates and the qualified dependency advisory assessment remain open. No application source changes were required in this turn. Production data/configuration, Git history and deployed services remain unchanged.