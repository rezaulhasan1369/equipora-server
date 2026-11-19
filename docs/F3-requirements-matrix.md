# F3 assignment compliance matrix

Audit: 2026-11-19, Asia/Dhaka. Authority: the owner's full written Programming Hero Assignment 9, Category 003 brief. B14-A9-C003.mp4 was named but its contents were not supplied; video-only differences cannot be certified. This matrix supersedes the F1 baseline, not the assignment itself.

Legend: **PASS** = implemented with local execution evidence; **CODE** = present in source but not exhaustively exercised; **PARTIAL** = material qualification; **BLOCKED** = submission/release prerequisite; **OPTIONAL** = deliberately omitted optional scope. No status implies production acceptance.

Evidence keys: **API** = `tests/marketplace.test.ts`; **SEC** = `tests/f2-security.test.ts` and gateway policy tests; **BROWSER** = `client/tests/browser/assignment.spec.ts`; **VISUAL** = F3 screenshot/axe review; **PROVIDERS** = [F2 acceptance](F2-readiness.md); **RELEASE** = [F3 release plan](F3-release-plan.md). Client paths below refer to the independent sibling client repository.

## Foundation, presentation and submission

| ID | Requirement | Status / evidence / qualification |
|---|---|---|
| G01 | Equipment Rental Platform connecting owners and customers | PASS: listing, browsing, reservation, hosted test payment, role management; API/BROWSER/PROVIDERS |
| G02 | Next.js App Router; UI library; TypeScript/JavaScript | PASS: Next 16.4.6, React 19.3.1, TypeScript, DaisyUI/Tailwind; production build |
| G03 | Better Auth + MongoDB adapter + JWT/RBAC; Express/MongoDB | PASS: `src/auth.ts`, `src/marketplace.ts`, native MongoDB, API/SEC |
| G04 | Stripe payment gateway | PASS locally, hosted test payment/signature verified; persistent hosted test setup BLOCKED |
| G05 | Header / route-dependent main / footer | PASS: root layout, shell and App Router; BROWSER/VISUAL |
| G06 | Unique, recruiter-oriented design; not copied from prior coursework | PARTIAL: consistent existing design reviewed; subjective acceptance and comparison to unavailable prior projects require owner review |
| G07 | Consistent heading/logo/button styles, paragraph spacing, alignment | PASS local visual checks; owner aesthetic acceptance pending |
| G08 | Equal card dimensions/images and grid layout | PASS: fixed image aspect/height, equal card layout, VISUAL; remote images are third-party dependencies |
| G09 | Mobile, tablet, laptop, desktop responsive | PASS: 390/834/1366/1920 widths; dashboard tables intentionally scroll inside their containers |
| G10 | New X logo rather than Twitter bird | PASS: footer X glyph; no obsolete bird used; no social account/destination invented |
| G11 | Frontend configuration and MongoDB credentials through env | PASS: server-only gateway origin, backend env, ignored runtime files, encrypted local providers; security scan qualified in QA report |
| G12 | At least 20 meaningful client commits | BLOCKED: current history 1; no commits authorized or manufactured |
| G13 | At least 12 meaningful server commits | BLOCKED: current history 8; infrastructure history does not establish business-feature publication |
| G14 | Both READMEs: name, purpose, live URL, features, packages | PARTIAL: source/setup/packages documented; backend accepted URL present; frontend live URL honestly pending publication |
| G15 | Working live server, no CORS/404/504 errors on valid routes | BLOCKED for full application: E8 infrastructure accepted; business backend release and exact-domain production smoke tests pending. Intentional invalid-route 404s are correct |
| G16 | Live landing page; reload every route without error | PASS locally for covered routes; hosted deployment and all production routes must be checked after approval |
| G17 | Private-route reload retains login | PASS: all-role reload tests; Google callback/logout real acceptance in F2; no production claim |
| G18 | Submit Admin email/password | BLOCKED: secure production account and separately approved provisioning required; local fixture password must never be submitted as production access |
| G19 | Submit live frontend URL and both GitHub URLs | PARTIAL: repositories identified as rezaulhasan1369/equipora-client and equipora-server; frontend URL and final published revisions pending |

## Authentication and authorization

| ID | Requirement | Status / evidence / qualification |
|---|---|---|
| A01 | Registration name/email/photo/password | PASS: registration form supports HTTPS image URL; Better Auth email/password. Photo input is optional, not an upload in registration |
| A02 | Uppercase, lowercase, minimum 6 characters; validation feedback | PASS: frontend and backend checks, invalid-password API/browser tests |
| A03 | Login/Register reciprocal links | PASS: auth form return-path-preserving links; VISUAL |
| A04 | Success toast/SweetAlert after login/registration | PASS: shared toast and BROWSER registration/login |
| A05 | JWT access token upon login | PASS: Better Auth JWT endpoint; cryptographic issuer/audience/algorithm/expiry plus active DB session verification |
| A06 | Google login; default Customer | PASS: real F2 Google callback, token-exchange/account evidence and default-role check |
| A07 | Customer/Owner/Admin role middleware | PASS: verifyToken, verifyRenter, verifyOwner, verifyAdmin; API denial/revocation checks |
| A08 | Protected pages/endpoints and respective dashboards | PASS: server session layout and client role gates plus independent backend enforcement; API/BROWSER |
| A09 | No email verification or forgotten-password inconvenience | PASS: no examiner verification/reset flow; no email delivery dependency introduced |
| A10 | Session persistence/logout authorization | PASS: private reload, current-role invalidation, JWT replay rejected after logout; real Google logout redirects to login |

## Home

| ID | Requirement | Status / evidence / qualification |
|---|---|---|
| H01 | Navbar logo/name/Home/All Equipment | PASS: shell; VISUAL |
| H02 | Login/Register when anonymous; Dashboard/Logout when signed in | PASS: Get started links to Register; role-aware shell |
| H03 | About/Contact/How it works optional links | OPTIONAL: How it works anchor included; separate About/Contact not implemented |
| H04 | Banner high-quality image/title/purpose description | PASS: home component; image-load-aware VISUAL |
| H05 | Exactly six approved featured items via MongoDB limit | PASS: featured limit is server-enforced at six, status approved, API; fresh fixture browser sees six. Production requires approved inventory |
| H06 | Featured card details redirects anonymous users to login | PASS: returnTo flow and BROWSER |
| H07 | Six specified categories | PASS: Construction, Photography, Vehicles & Transportation, Agriculture, Electronics, Event Equipment |
| H08 | Why Choose Us benefits | PASS: price/access, owner identification, flexible periods, secure checkout; no unsupported owner-verification claim |
| H09 | At least four customer reviews with names/ratings/comments | PARTIAL: four explicitly illustrative cards, not genuine customer feedback. Owner must approve legitimate assignment-demo content or supply real permissioned reviews; do not remove disclosure or invent customers |
| H10 | At least two additional relevant sections | PASS: How It Works and owner participation callout |
| H11 | Framer Motion in banner/featured/categories | PASS: motion wrappers; reduced-motion support; runtime package. Review/extra animation optional and omitted |

## Catalog and equipment details

| ID | Requirement | Status / evidence / qualification |
|---|---|---|
| E01 | Public All Equipment; approved items only; three-column desktop grid | PASS: backend approval filter, catalog UI, BROWSER/VISUAL |
| E02 | Cards: image/name/category/price/type/location/availability/details | PASS: EquipmentCard; accessible link name corrected during F3 |
| E03 | Backend search name/location and challenge title/category | PASS: escaped server regex across name/location/category; UI query; API/BROWSER |
| E04 | Backend category/rental-type/price-range/availability filters | PASS: direct F3 fixture checks exercised each category of filter; every combined permutation not exhaustively browser-tested |
| E05 | Backend low/high price and recently-added sort | PASS: direct F3 checks verified both price directions and accepted recent sort; equal-time fixture ordering and all combined permutations not exhaustively exercised |
| E06 | Private details route | PASS: anonymous redirection and authenticated detail browser checks |
| E07 | Details name/description/category/rental price/type/location/quantity/image | PASS: Details component, VISUAL |
| E08 | Owner information and rental terms | PASS: owner name, condition/brand/model and terms; owner profile image is not required by the written details list |
| E09 | Database favorites, Customer list and removal | PASS: unique user/item association, scoped APIs and real local UI workflows |

## Booking and payment

| ID | Requirement | Status / evidence / qualification |
|---|---|---|
| P01 | Book Now opens modal | PASS: native dialog, keyboard close/focus behavior and VISUAL |
| P02 | Start/end/quantity/contact/delivery address/notes fields | PASS: form and strict backend schema; notes optional |
| P03 | Total based on duration and quantity | PASS: authoritative integer cents; end-exclusive days, weekly ceil/7, monthly ceil/30; unit/API tests |
| P04 | Availability checked before payment | PASS: transactional inventory holds and concurrency tests prevent overselling |
| P05 | Redirect to secure Stripe Checkout | PASS: actual sandbox Checkout, fixed HTTPS destination validation |
| P06 | After successful payment create booking, payment status/transaction in payments | PASS: signature-verified webhook, actual F2 paid record consistency |
| P07 | Payment success page | PASS: server-backed payment proof; UI never treats redirect alone as payment. F2 actual flow, F3 confirmed-state rendering mock explicitly distinguished |
| P08 | Duplicate delivery, decline, cancellation/expiration failure handling | PASS: F2 real decline/no unpaid booking, genuine expiration delivery, two locally re-signed genuine-event replays; not a hosted Stripe resend test |
| P09 | Persistent payment configuration appropriate for submission | BLOCKED: unclaimed CLI sandbox expires; owner claim/stable owner-controlled sandbox/test credentials and hosted signing secret required; no live payments authorized |

## Dashboards

| ID | Requirement | Status / evidence / qualification |
|---|---|---|
| D01 | Responsive full-width dashboard, theme, charts, user section | PASS: role sidebar, fluid content, scoped analytics and charts, VISUAL; table overflow stays contained |
| C01 | Customer routes My Rentals/Favorites/Profile | PASS: mapped App Router dashboard pages, role-aware navigation |
| C02 | Rentals table equipment/start/end/booking date/total/payment/booking status | PASS: API scope and UI; paid/confirmed F2 acceptance |
| C03 | Favorites table View Details/Remove | PASS: BROWSER and API |
| C04 | Every role profile: name/email/image/phone/address and update | PASS for name/image/phone/address; email displayed read-only by design. All-role profile update API tested. If rubric expects mutable login email, clarify before adding identity-change scope |
| O01 | Owner Add Equipment/My Equipment/My Equipment Rental/Profile | PASS: role routes and navigation |
| O02 | Add equipment all specified fields | PASS: name/description/category/location/price/type/quantity/condition/brand/model/image/terms; owner/status server-controlled |
| O03 | imgbb image upload; Pending status | PASS: actual bounded F2 upload; F3 CRUD browser upload response mocked and labeled; API defaults pending |
| O04 | Own-equipment table name/category/price/quantity/status | PASS: owner-scoped API and browser |
| O05 | Update/Delete/View Details | PASS: ownership guards, browser CRUD, active-reservation delete rejection; deletion soft to preserve history |
| O06 | Owner rentals table customer/equipment/duration/quantity/amount/payment/status | PASS: scoped rentals API, rendered columns; nonzero record scope tested |
| M01 | Admin All Users/All Equipment/All Rentals/Profile | PASS: role navigation and APIs |
| M02 | Users name/email/role/registration date; change role/manage users | PASS: role and disable controls, API enforcement, session revocation; no client-only privilege control |
| M03 | Equipment approve/reject/update/delete; pending/approved/rejected | PASS: strict status API, approval test, UI controls; all three code paths present |
| M04 | All rentals customer/owner/equipment/duration/amount/payment/status | PASS: all-record Admin scope, tables and date-constrained management transitions |
| M05 | Admin analytics users/equipment/bookings/pending/completed/revenue/monthly bookings | PASS: database aggregates and two charts; API nonzero data tests; production empty data remains honest |
| M06 | Owner analytics listed/completed/earnings/monthly earnings | PASS: owner-scoped database aggregates and revenue chart; nonzero API tests |

## Challenges, states and optional scope

| ID | Requirement | Status / evidence / qualification |
|---|---|---|
| X01 | Challenge 1 server search/filter by title/category/availability | PASS implementation; query/API evidence, see E03-E05 limitations |
| X02 | Challenge 2 named custom JWT/role middlewares | PASS: exported required middleware functions and tamper/role/session enforcement |
| X03 | Challenge 3 Admin/Owner dynamic analytics | PASS: M05/M06; no hardcoded business totals |
| X04 | Loading page | PASS: app/loading.tsx and component status states; exact network/suspense timing not exhaustively captured |
| X05 | Error page | PASS: app/error.tsx, API error feedback and not-found, browser failure test; every possible React error boundary not fault-injected |
| X06 | Accessible form feedback/loading/empty/success/error | PASS covered local cases; F3 corrected table contrast and label-name mismatch; automated axe is not a full screen-reader certification |
| OPT1 | Catalog and booking-history pagination | PASS: catalog/rentals plus management tables; optional enhancement present |
| OPT2 | Dark/light toggle persisted to localStorage | OPTIONAL: not implemented; approved light theme retained |
| OPT3 | Scheduled automatic completion via node-cron | OPTIONAL: not implemented; Admin date-constrained transitions available |
| OPT4 | Completion notification emails | OPTIONAL: not implemented; no mail provider/credentials introduced |

No fabricated commit history, production fixture seeding or invented testimonials is proposed to turn a qualified status into PASS. See the QA and release reports for the explicit owner decision gates.
