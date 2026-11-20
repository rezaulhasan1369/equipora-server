# F13 — Initial Admin promotion plan (OWNER APPROVAL REQUIRED)

Status: **prepared and tested locally; not executed.** No production role has been changed.

## Goal

Promote the owner's existing, registered production account (currently `customer`, created in F12.3) to the
first and only initial Admin, with the smallest possible database change and a verified rollback.

## Mechanism

- Library (deployed, hash-verified in `dist/admin-bootstrap.js`): `initialAdminPlan` + `applyInitialAdmin`,
  covered by `tests/f2-security.test.ts`.
- Operator script: `scripts/f13-initial-admin.mjs`, covered by `tests/f13-initial-admin.test.ts`
  (dry run, wrong confirmation, one-shot guard, promotion, second-Admin refusal, rollback, disabled/missing targets).

Guarantees enforced by code and tests:

| Requirement | Enforcement |
|---|---|
| Exact identity | normalized email must match exactly one account; apply additionally requires the 12-hex account hash printed by the dry run; the plan re-checks `_id` + email + role inside the update filter |
| Existing enabled Customer | `role: "customer"`, `disabled != true` |
| No existing initial Admin | zero `admin` users and no `bootstrap/initial-admin` marker; the marker's unique `_id` makes a second bootstrap impossible |
| Short-lived plan | plan expires after 5 minutes and is validated inside the transaction |
| Atomic | single MongoDB transaction: insert marker, update role, delete the account's sessions |
| Safe session handling | only the promoted account's sessions are revoked (forces re-login with the new role); no other user is affected |
| Auditability | `bootstrap/initial-admin` document with timestamp; script output records mode, result, account hash, remaining sessions |
| Safe failure | any precondition failure returns BLOCKED without writes; transaction errors commit nothing; apply/rollback are one-shot (`.f13-apply-consumed`, `.f13-rollback-consumed`) |
| Privacy | never accepts a password, never prints email, URI, tokens or session data |

## Execution (each step needs owner approval)

1. Upload `scripts/f13-initial-admin.mjs` to the application root (`~/apps/equipora-api/f13-initial-admin.mjs`,
   not under any public directory) and add a temporary script entry `"f13:admin": "node f13-initial-admin.mjs"`
   to the deployed `package.json` (record its hash first).
2. Owner creates `~/apps/equipora-api/.f13-target.json` with `{"email":"<own registered email>"}` (permissions 0600)
   using cPanel File Manager.
3. **Dry run**: owner runs `f13:admin` via Setup Node.js App → Run JS Script. Expected `result: READY`,
   `matchingAccounts: 1`, `role: customer`, `existingAdmins: 0`, and an `accountHash`.
4. Owner creates `.f13-confirm.json` with `{"accountHash":"<hash from step 3>"}` and runs `f13:admin` again.
   Expected `result: PROMOTED`, `roleNow: admin`, `remainingSessions: 0`, `bootstrapMarker: true`.
5. Clean-up: restore the release `package.json` (hash-verified), delete the uploaded script and the target/confirm
   files; keep the consumed markers.
6. Acceptance: owner logs in again; browser check expects `sessionRole/jwtRole/meRole = admin`,
   `adminUsersWithJwt = 200`; Admin dashboard pages (users, all equipment, all rentals, analytics) load; health
   checks and `mziae.com` unchanged.

## Rollback (only if needed, separately approved)

Create `.f13-rollback.json` with the same `accountHash` and run the script once: in one transaction it sets that
exact account back to `customer` (only if currently `admin`), deletes the bootstrap marker and revokes that
account's sessions. Nothing else is touched.

## Not done autonomously

The autonomous F14 run did not upload the script, create input files, run it, or change any role.
