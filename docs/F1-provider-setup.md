# F1 manual provider configuration

The owner confirmed no known Google OAuth, Stripe test/webhook or imgbb configuration. The inspected local files were `client/.env.local` (only API_BASE_URL) and `server/.env` (PORT, MONGODB_URI, DIAGNOSTIC_KEY, CORS_ORIGIN). Only names and paths were inspected/reported for this inventory; values were not printed. Existing files and production secrets must remain unchanged.

Code is prepared, but external providers are not configured or verified. Follow these steps when ready; no provider/account changes have been performed by the agent.

## 1. Private local configuration

1. Create a private file outside both repositories, for example `%LOCALAPPDATA%\Equipora\providers.env`, using your editor. Do not edit the existing server `.env`.
2. Store only these names, entering values privately: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, IMGBB_API_KEY. Omit providers not yet configured. Never send values in chat, screenshots, commits or command arguments.
3. The isolated runner accepts this file explicitly: `npm run dev:isolated -- --provider-config C:\Users\User\AppData\Local\Equipora\providers.env`.
4. It rejects unknown fields (including MONGODB_URI), ignores inherited production provider/diagnostic variables, always creates its own ephemeral local database and signing secret, and accepts only Stripe test secret keys. Do not set LOCAL_INTEGRATION_TEST in any hosted environment.
5. A future production signing secret must be a new independent random secret of at least 32 characters, stored privately through ExonHost after separate approval. Never reuse DIAGNOSTIC_KEY. The local runner generates its own in-memory secret automatically.

## 2. Google OAuth

1. Sign in to your owner-controlled Google Cloud Console and choose the intended project. Creation/changes are manual owner actions; do not alter an unrelated project.
2. Configure OAuth consent for this assignment and add your test Google account as a test user while the app is in Testing.
3. Create an OAuth 2.0 **Web application** client.
4. For isolated local testing, use authorized JavaScript origin `http://localhost:3000` and exact redirect URI `http://localhost:3000/api/auth/callback/google`.
5. Save Client ID and Client Secret privately as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
6. Restart the isolated runner with the provider file, start the frontend on localhost:3000, choose Google login and verify the new user receives Customer role and survives dashboard reload.
7. After the final frontend hostname is approved, add that exact HTTPS origin and its `/api/auth/callback/google` URI. Do not add arbitrary preview URLs or wildcards. Backend AUTH_PUBLIC_URL and FRONTEND_URL must both match the frontend origin used for the gateway.

Email verification and password-reset features are intentionally not implemented, per the assignment.

Official reference: [Better Auth Google](https://better-auth.com/docs/authentication/google).

## 3. Stripe test Checkout and webhooks

1. Use your owner-controlled Stripe account in **test mode or a test sandbox**. No live charges or paid upgrade are authorized.
2. Copy the test secret key privately into STRIPE_SECRET_KEY. This implementation accepts `sk_test_` only. A browser publishable key is not required because payment uses hosted Checkout.
3. Install/use the official Stripe CLI and complete `stripe login` yourself. Never paste its authentication output into chat.
4. Run `stripe listen --forward-to http://127.0.0.1:5090/api/payments/webhook` locally. Save the displayed signing secret privately as STRIPE_WEBHOOK_SECRET. Keep the listener running.
5. Restart the isolated API with the provider file. Browse a fixture listing as the local Customer, choose future dates/quantity and continue to Checkout. Use Stripe's documented test card, never a real card.
6. Verify the **signed webhook**, not the success URL, creates one booking and payment. Refresh/replay the event and confirm there is still one record. Verify a cancelled checkout can be safely expired and its hold released.
7. For an approved future backend release, configure the exact hosted endpoint `https://api.mziae.com/api/payments/webhook` with checkout.session.completed, checkout.session.async_payment_succeeded and checkout.session.expired. This hosted signing secret differs from the local CLI secret and needs separate private production configuration approval.

Amounts are recalculated server-side in USD cents. End date is exclusive; weekly units round up by seven days, monthly units by thirty. A signed payment must match the reservation, session, amount, currency and customer. Unknown payment/network outcomes retain the inventory hold for reconciliation; they never silently release potentially paid inventory. Stripe must confirm expiration before customer cancellation releases a known session. A missed expiration webhook can leave a conservative hold; reconcile it using Stripe before releasing it.

Official references: [Stripe CLI](https://docs.stripe.com/stripe-cli/use-cli), [fulfillment](https://docs.stripe.com/checkout/fulfillment), [test payments](https://docs.stripe.com/testing).

## 4. imgbb

1. Sign in/create your owner-controlled imgbb account and obtain an API key from the official API page. Do not purchase services.
2. Store it privately as IMGBB_API_KEY. It is backend-only, not NEXT_PUBLIC.
3. Restart the isolated API with the provider file, sign in as local Owner, and upload a small JPG, PNG or WebP (maximum 2 MB) from Add Equipment.
4. Confirm the returned HTTPS image is displayed and the listing is created as Pending, not automatically approved. Approve using the local Admin and check the public catalog.

The upload endpoint authenticates, validates size/type signatures, uses only the fixed HTTPS imgbb API, has bounded timeout/response parsing, and never returns the API key. Google/Stripe/imgbb configuration errors are handled without exposing provider secrets.

Official reference: [imgbb API](https://api.imgbb.com/).

## 5. Before live acceptance

Confirm provider account ownership, callbacks, exact frontend origin, private backend configuration, webhook delivery, role/bootstrap account and the approved backend release. Production provider settings, secrets, users/roles, commits, pushes and publication all remain approval checkpoints.
