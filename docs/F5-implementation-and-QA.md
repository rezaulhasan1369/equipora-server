# F5 implementation and owner acceptance

Date: 2026-11-19. Status: **Ready for owner visual acceptance; not production-ready.** All changes remain local and uncommitted. F3/F4 evidence is preserved. No production data, provider secrets, infrastructure, DNS, SSL or Atlas rules were changed.

## Implemented scope

- Branding/navbar: supplied transparent symbol with typeset Equipora wordmark, slate palette, translucent sticky header, scroll transition, active navigation and existing authentication controls. Mobile menu supports Escape, focus return/trapping and background inertness. This lockup remains an owner-review candidate.
- Footer: supplied desktop/tablet/mobile artwork retained unchanged; compressed WebP derivatives selected using picture breakpoints. Text sits above the focal artwork for contrast. Fictional partner marks are disclosed; newsletter signup is honestly unavailable. Privacy, terms and individual image credits have working routes.
- Motion: all three supplied VP9 alpha WebMs integrated into hero, process and closing CTA. Muted inline playback, visibility-based loading/pause, reduced-motion static posters, reserved aspect ratios, pause controls and failed-resource fallback are implemented. Original files are unchanged.
- Catalog: 30 explicitly synthetic local records, five per required category, owned by the isolated fixture Owner. Original BDT draft remains unchanged; USD test rates were independently authored, not converted. Featured results still use the existing server limit of six. Existing pending/approval workflow remains intact.
- Images: 30 local WebP derivatives with source, author, license and modification metadata; see /asset-credits. Demo image caching only applies while the canonical image remains unchanged, so Owner replacement uploads remain visible.
- Confirmed QA corrections: accessible logo naming, mobile dashboard navigation wrapping, equal card bottoms, footer contrast, smaller disclosure text without clipping, and viewport-height loading reservation to prevent a footer flash/layout shift.

See [resource inventory](F5-resource-inventory.md) for file properties, mapping and provenance. Primary client files are components/brand.tsx, shell.tsx, motion-film.tsx, home.tsx, equipment card/details/dashboard components, app/style.css, app/layout.tsx, disclosure pages, lib/equipment-image.ts and demo type metadata. Server F5 work is restricted to the optional isolated fixture loader, catalog preparation script/data, focused fixture tests and documentation; production business API behavior was not changed by F5.

## Verification evidence

| Check | Result and scope |
|---|---|
| TypeScript, frontend lint, production builds | PASS; production frontend built under Node 22.23.5 |
| Backend automated suite | 30 passing tests under cached Node 22.23.5 |
| Frontend pure tests | 6 passing tests under cached Node 22.23.5 |
| Complete browser suite | 32 passing on the preserved six-item baseline, before final CSS-only refinements |
| Expanded catalog browser suite | 12 passing on the 30-item preview |
| Final affected browser checks | 15 passing after final CSS corrections, including role-table accessibility |
| Final screenshot/axe audit | 45 states at 390, 834 and 1920px; no detected overflow, broken images or WCAG A/AA violations |
| Responsive coverage | 375, 390, 440, 768, 834, 1366, 1600, 1920 and 2560px |
| Catalog/API checks | 30 total; five/category; six featured across categories; pagination and Owner edit/Admin approval/favorite/role checks pass |
| Dependency audits | Both repositories report zero advisories; no uncontrolled upgrades |
| Secret checks | No credential literals found in scanned client source/bundles; server matches were existing dummy URI fixtures; private provider store was not decrypted |
| Git diff checks | PASS in both repositories |

Full baseline expectations deliberately retain six equipment records; do not interpret those fixed fixture counts as expectations for the optional 30-item mode. F2 real Google, ImgBB and Stripe acceptance is inherited, not repeated in this provider-disabled visual preview. Authentication/payment/upload implementation is preserved; F5 automated regressions use isolated data/mocks.

Chromium decoded actual transparent VP9 frames. Reduced-motion, offscreen pause, muted playback and blocked-WebM poster fallback passed. Safari and physical-device codec playback remain unverified. All three films total approximately 5.77 MB; only the hero film loads initially. Footer derivatives reduce their combined original byte size by approximately 96%.

Warm local measurements: mobile CLS 0, desktop CLS 0.00069, LCP 168-460ms. These are loopback smoke measurements, not field Core Web Vitals or throttled-device certification. An earlier streaming-loading layout shift was reproduced and corrected before these final measurements.

## Owner inspection

Open **http://localhost:3000**. Isolated API is on loopback port 5090 with an ephemeral in-memory replica set and --catalog=f5. No provider credentials are loaded in this preview. Keep localhost rather than switching authentication origins.

Routes: /, /equipment, /register, /login, /dashboard, /dashboard/favorites, /dashboard/rentals, /dashboard/equipment, /dashboard/add-equipment, /dashboard/users, /dashboard/profile, /privacy, /terms and /asset-credits. Use a catalog card for the current fixture equipment-detail URL; identifiers change when the isolated API restarts. Dashboard features are role-restricted.

Local fixture accounts only: customer@example.test, owner@example.test and admin@example.test; shared local-only password LocalDemo123. Never provision these as production accounts. Review each role separately and log out between accounts.

Screenshot evidence is under `.netlify/f5-qa/final/` (ignored local artifacts): home, catalog, footer, details, booking modal and role dashboard states at desktop/tablet/mobile sizes. `report.json` records all 45 checks. Performance evidence is `.netlify/f5-qa/performance-smoke.json`.

Acceptance checklist: inspect logo and header at top/scrolled positions; open/close mobile menu with keyboard; review hero and all three motion/poster states; inspect equal cards and image composition; search/filter/paginate; inspect each role's navigation, forms and tables; inspect footer artwork and disclosures. Check 375px mobile, 834px tablet, 1366px laptop and 1920px desktop, plus the supplied large-screen coverage.

## Remaining limitations and release gates

- Some licensed catalog photographs are contextual or closeups rather than uniform studio product shots: particularly EQD-005, 010, 014, 016, 018 and 020. Owner approval or consistent original product photography is recommended. Exact models/capacities are synthetic, explicitly disclosed.
- Testimonials, partners, inventory and rates are illustrative; no real customer endorsements or market statistics are claimed. Demo policy pages require real business/legal review before publication.
- Final logo lockup, supplied-film visual edges and responsive composition require owner visual acceptance. No separate approved vector wordmark was found.
- Physical-device/Safari playback and hosted performance remain acceptance tasks. Poster fallback is available.
- F3 release gates remain: owner-controlled persistent Stripe test environment, final frontend origin, Google callback, hosted webhook/credentials, approved backend business release, secure Admin provisioning and actual hosted end-to-end acceptance. Current meaningful history counts remain client 1/server 8; no artificial commits were created.

No deployment, commit, push or production configuration change is authorized by this report. Await owner visual acceptance/corrections before the controlled release approval.
