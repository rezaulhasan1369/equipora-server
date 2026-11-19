# F7 owner review: Git and release candidate

2026-11-19. Local preparation only. No staging, commits, pushes, deployment, provider changes or production writes were performed. This continues F6; it does not replace the authoritative compliance matrix.

## Review package

- [Exact proposed commits and file/hunk boundaries](F7-commit-plan.md), with [machine-readable plan](F7-commit-plan.json).
- [Production configuration, execution order and rollback](F7-release-plan.md).
- [Outstanding requirement rows and identity tradeoff](F6.4-report.md), continuing [F6 deficiencies](F6-deficiencies.md).

## Actual Git state

| Repository | Branch / local HEAD | Existing commits | Minimum / current deficit |
|---|---|---:|---:|
| Client | main / b7b86e26490958b103729be635b8ea4711f42b93 | 1 | 20 / 19 |
| Server | main / 6f024f6f53c15fc617ec09d8379f13cf2717bd49 | 8 | 12 / 4 |

Origins are the expected rezaulhasan1369/equipora-client and equipora-server HTTPS GitHub repositories. These are local observations, not a fresh remote synchronization claim. Both indexes are empty; both working trees intentionally contain the accumulated real application work. At initial F7 inventory the server had 5 modified tracked and 56 untracked files; client had 10 modified tracked and 106 untracked files. The four F7 review documents are additional server files.

Twenty client and seven server forward commit groups are proposed, with descriptive messages, exact paths, shared-file hunk boundaries, dependencies and validation requirements. Their subjects cover the actual gateway, auth, dashboards, marketplace, booking, branding, themes, jobs, packaging and documentation changes. They are proposals, not existing history. The final working tree passing does not certify each intermediate snapshot. Validate cumulative snapshots before committing; combine inseparable groups and report any resulting shortfall honestly. Do not backdate, create empty commits, split arbitrary files for counts or run blanket git add. No artificial modifications were made for history.

## Source, secrets, artifacts and accepted visuals

The read-only inventory at `.netlify/f7/source-inventory.json` records every changed/untracked candidate path, byte size and SHA256, branches, remotes, index state and historical pattern findings. This ignored local evidence is not an application asset or proposed commit.

No tracked private environment/provider files or generated dependency/build directories were found. Ignore checks cover actual .env files, node_modules, dist/.next, .netlify, test reports and TypeScript build metadata. Only the reviewed nonsecret `.env.example` templates are eligible. DPAPI provider and ExonHost credential XML files remain outside both repositories; their secret values were not read during F7. A bounded credential-pattern scan of 21 compiled browser JavaScript/JSON assets also returned zero matches; this is not an exhaustive proof for unknown secret formats.

Never commit actual environment files, encrypted credential stores, private keys, webhook secrets, sandbox claim links, network receipts, generated ZIPs, local logs/traces/screenshots or node_modules/build/test output. Sixteen historical/operator items are explicitly deferred in the plan rather than silently bundled into the business release. Known dummy MongoDB URI matches in four historical test blobs are synthetic fixtures; candidate pattern matches are zero. This bounded scan does not prove detection of every possible secret format; inspect each eventual staged diff again.

The 52 changed/new public assets total 15,093,934 bytes. The largest file is the existing 2,194,839-byte hero WebM; other large assets are the two motion WebMs and responsive footer PNGs. These are intentional reviewed application assets with provenance/credits, not build artifacts. No artwork, hero, catalog, navbar or footer source was changed in F7. Required registration photo and Google behavior remain intact. Footer social icons deliberately retain homepage destinations. Thirty local demo equipment records and the separate six-item featured query are preserved.

The existing Linux-portable working-tree backend ZIP contains 18 manifest-verified files; SHA256 is `9A376B4F87D96EC2B022B852B4D5A16925915821AC6CF1EB9BFEE6E7508F4549`. It is ignored, not uploaded, and must be regenerated from the approved server revision after commits. F6.4 packaged startup evidence verifies Node 22.23.5, Passenger bootstrap, assigned port, compiled JavaScript without tsx, health 200 and denied database diagnostics. Dependency resolution used the workspace installation; Linux production npm ci remains a hosted gate.

## F7 validation

| Check | Evidence / result |
|---|---|
| Server TypeScript and compiled build | PASS; no separate server lint script exists |
| Backend TypeScript regression suite | 33 passed, zero failed; isolated MongoDB only |
| Legacy diagnostic/operator mock suite | 22 passed, zero failed; no remote access changes |
| Client TypeScript, ESLint, production build | PASS; Next.js 16.4.6 |
| Client policy/image unit suite | 6 passed, zero failed |
| Browser, RBAC, accessibility and responsive suite | 68 passed, zero failed, against the local production frontend and isolated backend; includes F5/F6.3 and 375-2560px navbar cases |
| npm production and complete dependency audits | Zero advisories in both repositories; fresh registry responses |
| Git whitespace checks | PASS in both repositories; only configured LF/CRLF conversion notices |
| Candidate secret patterns and tracked forbidden paths | Zero candidate pattern matches; zero forbidden tracked paths |

Backend evidence: `.netlify/f7/backend.tap`, `legacy.tap`; browser evidence: `browser.log`; registry responses: `*audit*.json`. These are ignored local evidence. Existing F2 real Google/ImgBB/sandbox acceptance is historical; this phase does not repeat external provider operations or claim new hosted verification.

## Optional features and remaining gates

| Feature | Local status | Hosted status |
|---|---|---|
| Equipment and booking-history pagination | PASS, server-side and browser/API evidence | Await backend/frontend release and exact-domain QA |
| Persistent light/dark theme | PASS, first-paint/persistence/storage-failure tests | Await frontend publication/QA |
| Rental completion | PASS, eligibility, concurrency and idempotency tests; stopped task | No production activation; supported one-shot dispatcher integration/execution remains required |
| Completion email | PASS, mock delivery, templates, duplicate/retry tests | Real provider transport integration/configuration and approved delivery remain required |

Do not treat an in-process node-cron timer as reliable scheduling under Passenger. Its idle shutdown and multiple processes require a verified provider-supported execution mechanism plus reviewed job coordination. Real SMTP/provider transport is not already implemented behind a toggle.

The existing F6 matrix still has 9 PARTIAL and 6 MISSING mandatory detail rows. Open items include owner visual/originality acceptance, hosted business functionality, published sources/live URL, meaningful history, persistent hosted Stripe test configuration and private examiner Admin credentials. Profile email editing remains an explicit identity gap: email is read-only, native change-email disabled, and ordinary profile PATCH cannot change identity or role. Name, image, phone and address remain editable. Do not bypass address confirmation or weaken existing examiner login merely to mark this row complete.

Vercel account/team ownership and Hobby eligibility, deployment hooks, stable frontend origin, production Google callbacks, persistent owner-controlled Stripe test credentials and hosted webhook signing secret all require fresh scoped verification/configuration. Local credentials are not automatically deployment credentials. Scheduler/mail integration and safe initial Admin operator execution need further reviewed implementation before activation. No production secrets were inspected or changed here.

## Approvals before irreversible actions

1. Approve exact Git groups; then validate and review each staged snapshot before genuine commits. This is not push approval.
2. Review automatic deployment effects before separately approving normal GitHub pushes; preserve Netlify fallback.
3. Approve isolated ExonHost backup/release, Linux dependencies and private application configuration. Preserve existing Atlas rules, website, DNS and certificates.
4. Approve Vercel destination/publication and exact Google/Stripe test/ImgBB production configuration; no live payments.
5. Approve exact production acceptance-data writes and private examiner Admin provisioning; never seed local fixtures into Atlas.
6. Review supported scheduler/real-mail integration code and isolated tests, then separately approve scheduling and real delivery.

The release plan specifies rollback to the accepted isolated backend/config and prior frontend deployment, with event reconciliation and coordinated withdrawal of marketplace entry points if reverting to infrastructure-only E8. First frontend publication requires an agreed maintenance/unpublish fallback because no prior frontend deployment may exist. Never restore/drop shared databases or change Atlas access as rollback.

**Assessment:** locally reviewable release candidate, not overall assignment completion or publication approval. No critical hosted result is inferred from local tests.
