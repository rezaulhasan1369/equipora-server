# F4 owner visual acceptance guide

Prepared 2026-11-19 (Asia/Dhaka). F3 checkpoint preserved. No application/design changes, commits, pushes, deployment or production modifications in F4. Review approval is visual/content approval only; it does not authorize the next release.

## Preview health and scope

- Frontend: http://localhost:3000 ; `/api/health` returned 200 with equipora-client.
- Isolated backend: http://127.0.0.1:5090 ; `/api/health` returned 200 with equipora-api. Its command is the isolated runner with one child MongoDB process.
- Catalog gateway returned 200. Current fixtures remain available. Local provider keys are disabled in this QA runner; real Google/imgbb/Stripe acceptance was completed separately in F2. Do not test those providers during this visual pass or use production credentials.
- Fixture logins and role checks were reverified for Customer, Owner and Admin. Services remain running; no restart was needed. Restarting the isolated API resets data, IDs and sessions.

## Exact routes

| Screen | Local URL / expected behavior |
|---|---|
| Homepage | http://localhost:3000/ |
| Catalog | http://localhost:3000/equipment |
| Current fixture details | http://localhost:3000/equipment/6afe33105417fb167fe7b6e3 — Outdoor Event Sound System; sign-in required |
| Registration | http://localhost:3000/register |
| Login | http://localhost:3000/login |
| All role overviews | http://localhost:3000/dashboard — content depends on logged-in role |
| Customer My Rentals | http://localhost:3000/dashboard/rentals |
| Customer Favorites | http://localhost:3000/dashboard/favorites |
| All role profiles | http://localhost:3000/dashboard/profile |
| Owner Add Equipment | http://localhost:3000/dashboard/add-equipment |
| Owner My Equipment / Admin All Equipment | http://localhost:3000/dashboard/equipment |
| Owner equipment rentals / Admin All Rentals | http://localhost:3000/dashboard/rentals |
| Admin All Users | http://localhost:3000/dashboard/users |
| Booking modal | Open current details as Customer, then Book now; no separate modal URL |
| Cancellation-return layout | http://localhost:3000/dashboard/rentals?payment=cancelled — Customer rental/hold page, not a separate cancellation page |
| Unconfirmed payment layout | http://localhost:3000/payment/success?session_id=cs_test_f4 — synthetic nonexistent ID, intentionally cannot confirm payment |
| Not found | http://localhost:3000/visual-review-not-found |

If the details ID becomes invalid after a local restart, select an existing catalog card to obtain its new URL. Wrong-role actions must remain unavailable/denied; switching account changes the same dashboard route rather than using /customer, /owner or /admin URLs.

## Synthetic fixture accounts

| Role | Email | Display name |
|---|---|---|
| Customer | customer@example.test | Jamie Park |
| Owner | owner@example.test | Alex Morgan |
| Admin | admin@example.test | Sam Rivera |

All three use **LocalDemo123**. These are public synthetic local-test credentials, not provider or production credentials. Log out before switching accounts, or use separate browser profiles. Do not change roles, disable accounts or delete fixtures during visual inspection; those controls work and may change later screens. Names/profile details may reflect previous local QA updates.

## Structured inspection order

1. Anonymous: home top-to-bottom, catalog filters/cards, registration/login, narrow navigation toggle. Select Details anonymously and confirm login return-to behavior.
2. Customer: details, save/remove favorite, booking modal and Escape/close button, profile, rentals empty state and private-route reload. Review the quote with future dates; do not proceed to a real provider from the credential-free runner.
3. Owner: overview, My Equipment table, Add Equipment form, equipment-rentals empty state and profile. Inspect upload control visually; provider upload is deliberately not configured here.
4. Admin: overview/charts empty state, All Users, All Equipment, All Rentals and profile. Inspect controls without changing access or moderation unless you deliberately want to alter disposable fixtures.
5. Review unconfirmed payment, cancellation-return and not-found layouts. F3's paid-confirmation screenshot uses an explicitly marked UI mock; actual signed payment was independently verified in F2. No fake URL should display a paid booking.

## Acceptance checklist

Use browser zoom 100%; device emulation is sufficient for layout inspection, with optional real-device checks. These are CSS viewport sizes, not hardware requirements.

| Viewport | Check |
|---|---|
| Desktop 1920x1080 | Header/logo consistency, hero proportions, three-column equipment grid, section spacing, full-width role workspace/table alignment |
| Laptop 1366x900 | Heading wrapping, card equal heights, filters, actions visible, comfortable form/table density |
| Tablet 834x1112 | Details columns, form widths, navigation transitions, no page overflow or overlapping controls |
| Mobile 390x844 | Toggle navigation; stacked sections/cards/forms; booking modal fits/scrolls; workspace links scroll horizontally; wide tables scroll inside their own container |

At each width confirm:

- [ ] Typography and muted text are comfortable; headings, logo, buttons and borders feel consistent.
- [ ] Images are loaded, cropped appropriately and have sensible subjects; equal card sizes and stable spacing.
- [ ] No unintended clipping, overlap, page-wide horizontal scroll, inaccessible action or broken link.
- [ ] Focus is visible while tabbing; field labels/errors make sense; modal closes with Escape and its close button.
- [ ] Contrast remains acceptable; table headers and card-link names include F3 accessibility corrections.
- [ ] Empty/error/unconfirmed states are honest and readable; no synthetic payment or review is presented as real.
- [ ] All roles' layout/navigation is appropriate; reload keeps the session; logout blocks private routes.

## Comparison with project design references

Available references: `D:/Equipora/README.md` (historical D0 brief), F1 audit/implementation reports, the accepted existing frontend source and F3 screenshots. No separate Figma file, exported design board or reference mockup was found in the searched workspace. Pixel-perfect comparison to an unavailable mockup cannot be claimed.

The root brief calls for Slate Blue **#6C7A89** / White **#FFFFFF** with transparent 3D assets. Current UI retains the slate/white family, but primary controls use darker **#596A7C**; F3 table headers use existing muted **#53677A** for contrast. This is family-level consistency rather than literal token equality. Hero/listings use photography and outline icons, **not transparent 3D artwork**. That design-reference gap requires an owner decision; no assets, colors or layout were replaced in this preparation.

Current home includes banner, six featured items/categories, benefits, How It Works, review cards and owner callout. There is no old Twitter bird; footer uses an X glyph without inventing a social account. Registration uses the navbar's Get started CTA instead of the literal Register label; it links correctly. Owner/Admin identity currently uses an initial avatar, while editable photo is shown in Profile.

## Illustrative/placeholder content and review observations

- Four names/comments/five-star ratings on the home page are explicitly **illustrative**, not real verified testimonials. Content permission/assignment acceptance remains unresolved.
- Six listings, their prices, stock, locations, owner brand/model/descriptions/terms and photographs are disposable local fixtures, not published inventory. Some images are conceptual (crowd for sound equipment; sports car for utility vehicle); review subject accuracy before publication.
- Dashboard totals are real aggregates from the disposable database, including synthetic registrations/listing changes from QA. Zero bookings/revenue are honest fresh-fixture states, not evidence that charts are broken or platform adoption claims. Nonzero analytics were tested independently in the backend suite.
- Initial-letter avatars, missing-photo/empty-state copy and the mocked paid-confirmation screenshot are demo presentation. No hardcoded fake platform-wide usage statistics were identified.
- No new confirmed clipping/contrast/broken interaction was found in the F3 final 50-state audit. Mobile workspace navigation intentionally reveals only part of the row until scrolled; wide tables also intentionally scroll. Discoverability, small table/footer text and conceptual fixture imagery merit owner visual review even though automated overflow/axe checks passed.
- F3 fixed confirmed card-link accessible-name and table-header contrast defects. No redesign is proposed or performed in F4. Automated checks do not replace your visual acceptance or full screen-reader testing.

Representative final artifacts: `server/.netlify/f3-qa/final/home-1920.png`, `home-390.png`, `owner-add-390.png`, `admin-users-1920.png`, `details-834.png`, `booking-modal-390.png`; report.json records all 50 final states. The screenshots are ignored local QA artifacts with synthetic data. No real OAuth URLs, credentials or Checkout identifiers are required for this review.

## Owner response

Respond with **accepted**, **accepted with notes**, or **corrections required**. For each correction give screen/route, viewport and the visible issue (for example: Owner Add Equipment / 390px / workspace links difficult to discover). State separately whether photography/darker slate are accepted in place of the root brief's transparent 3D/exact token direction, and whether illustrative review content is acceptable for this checkpoint. Screenshots are optional; keep private browser/account/provider information out of them.

After delivering this guide, wait for owner feedback. Do not prepare or execute a new release approval, provider setup, commit/push or deployment based on visual-review preparation alone. F3 release blockers remain documented separately.
