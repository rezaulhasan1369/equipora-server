# F7 local authentication investigation

2026-11-19. No commits, pushes, deployments, production writes or provider-setting changes. Existing F7.1A commits, staged documentation and deferred operator files are preserved. This report is a new untracked file.

## Root cause established before correction

The active local API was the F7 disposable QA runner, started without provider configuration. `scripts/dev-isolated.ts` explicitly removes inherited Google/Stripe/ImgBB credentials and imports only its explicit private provider input. BetterAuth initializes once per process; `src/auth.ts` registers Google only when both Google variables are present. The encrypted provider store existed and its sanitized Status reported Google configured, but that does not populate an already running credential-free process.

Reproduced the exact Google-unavailable message. The browser's `/api/auth/sign-in/social` returned HTTP 404, and a separate local request confirmed BetterAuth's `PROVIDER_NOT_FOUND` code. Password login was independently successful. No browser page exceptions were recorded. A wrong password returned 401 with a password-login error; submitting password login cleared the earlier Google error. The UI did not incorrectly reuse the Google error during password submission.

This is a runtime configuration mismatch, not evidence of an F7 source regression. Authentication, runner and application code match the accepted source; provider configuration was not removed by a Git commit. F7 QA deliberately used a provider-free process to avoid external calls. BetterAuth's sensitive logger is disabled; no raw provider errors, tokens or callback query strings were enabled in logs.

## Smallest correction

Restarted only the positively identified disposable local API using Node 22.23.5, the existing encrypted Google client configuration and `--catalog=f5`. Only Google was loaded for this investigation; Stripe and ImgBB stores were preserved but are not loaded into this authentication-focused runtime. No application source, login design, production configuration or credential value was changed. A private hash comparison verified the encrypted store unchanged. The disposable database/session reset is local only; existing browser sessions from the prior process must sign in again.

The corrected social endpoint returns HTTP 200 and prepares Google's authorization destination. Private checks confirm the redirect URI is exactly `http://localhost:3000/api/auth/callback/google` and OAuth state is present. No authorization URL, client identifier, state, code or token was printed or persisted in this report. Remote Google console settings were not independently inspected; interactive acceptance remains the end-to-end check.

BetterAuth base URL, frontend origin and trusted origin are localhost:3000. JWT issuer/audience use that origin. Local HTTP sessions have HttpOnly cookies without Secure; HTTPS configuration enables Secure automatically. No TLS/cookie-security check was disabled. Role fields have `defaultValue: customer` and `input: false`; server JWT/RBAC remains intact.

## Verification

| Check | Result |
|---|---|
| Original Google failure | Reproduced: 404 / provider missing |
| Restored Google launch/callback configuration | 200; fixed Google destination, expected callback and state |
| Valid fixture email/password | PASS; dashboard reached |
| Wrong fixture password | 401; method-appropriate error |
| Previous Google error clearing on password submission | PASS |
| Existing-session restoration / private-route refresh | PASS |
| JWT exchange / Customer role | PASS |
| HttpOnly loopback session cookie | PASS |
| Logout / invalidation / protected-route denial | PASS |
| Backend TypeScript and compiled build | PASS |
| Targeted isolated backend auth/registration/RBAC/security tests | 6 passed |
| Frontend TypeScript / lint / normal production build | PASS |
| Targeted real-browser authentication/role/origin tests | 8 passed |
| Both Git index tree IDs | Unchanged |
| New real Google callback and new-user role readback | PASS: owner reached dashboard; read-only isolated DB confirms one Google account, Customer role and one active linked session |

Evidence is ignored under `.netlify/auth-investigation`. Initial sanitized database readback confirmed zero Google accounts/sessions in the newly created disposable database. The owner then reported successful interactive Google sign-in and dashboard arrival. Subsequent read-only verification against the positively identified disposable MongoDB child confirmed exactly one Google OAuth account, its linked user's Customer role and one active linked session. No personal user fields, credentials, codes or tokens were printed. Both original Git index tree IDs remain unchanged. This verifies a fresh local Google registration/callback/session; it does not claim a new production test or a separately repeated Google-specific logout/refresh test. Existing fixture session-refresh/logout acceptance remains recorded above. Google Cloud Testing audience/test-user restrictions still apply; no provider settings were changed.

No F7 documentation whitespace fix, staging, history alteration or release action is included in this investigation. Existing release/standalone-build blockers remain separate.
