# F5 floating navbar owner review

2026-11-19. Local-only navigation enhancement; no commit, push, deployment or infrastructure change.

The desktop navbar retains its expanded brand, centered public navigation and authentication actions at the top. After 112px of scrolling, the inner surface narrows to a centered maximum 1100px glass capsule, 12px below the viewport top. It restores below 80px. Width, maximum width, radius, color, border, shadow and vertical position transition over 400ms with restrained easing. Hysteresis prevents threshold flicker; a passive listener schedules at most one animation-frame callback and updates React state only when the floating state changes.

The sticky outer header reserves an unchanged 86px desktop / 76px compact height. Only the inner surface is painted and transformed; surrounding space remains transparent and pointer-transparent. Content is not scaled or moved by the transition. Public links and authentication controls use separate layout groups. Tablet widths through 1100px use the compact menu; small screens keep the logo and toggle uncrowded with authentication actions inside the accessible menu. No new dropdown system was introduced.

Escape/focus return, focus trapping, inert background, scroll lock, menu route closure, responsive menu reset and visible keyboard focus are preserved. Resizing to desktop closes an open compact menu. Reduced-motion explicitly disables the transition (overriding the existing global tiny-duration motion rule).

Implementation: client components/shell.tsx Header only, appended navigation-specific app/style.css rules and tests/browser/floating-navbar.spec.ts. One unused test variable in the existing footer test was removed to keep lint clean. Footer markup and owner-approved home destinations, hero, videos, catalog, business API and providers are unchanged. No environment values were read or modified.

## Acceptance evidence

Production build under Node 22.23.5, TypeScript and lint passed. Browser coverage uses the production build and isolated 30-item local API, with no live provider requests or production data.

Required sizes: 375x812, 390x844, 768x1024, 834x1112, 1366x900, 1600x900, 1920x1080, 2560x1440. Checks cover initial, floating and restored states; threshold hysteresis; content-position invariance; overflow; sticky top spacing; keyboard/menu interaction; overlay accessibility; navigation clicks; resize cleanup; reduced motion; and Customer/Owner/Admin signed-in controls at desktop/mobile widths. Existing F5 motion, footer and homepage-icon destination regressions are included.

Screenshots are local ignored artifacts under `.netlify/navbar-qa/`: nav-WIDTH-top.png, nav-WIDTH-floating.png, nav-WIDTH-restored.png and compact-menu captures. They show the actual production preview, not a rendered mockup. Inspect at http://localhost:3000.

No reference screen-recording attachment was available in the current context. Implementation follows the owner's detailed timing/state requirements; exact frame-for-frame correspondence remains an owner visual acceptance task. Real Safari/device testing is not claimed. Await visual approval; no release is authorized.

Final results: 33 browser checks pass (12 existing F5, nine footer/home-icon checks, eight navbar viewport checks, one resize/reduced-motion check and three authenticated-role checks); six frontend pure tests pass. All required viewport accessibility scans pass. Header transitions preserve the main element's document position in every viewport; this verifies the navbar's reserved layout, not a field-wide Core Web Vitals certification. Final build, TypeScript, lint and both repositories' diff checks pass. An initial reduced-motion assertion caught the pre-existing global 0.01ms important transition rule; the navbar now explicitly overrides it with none. The inherited painted outer header was also removed before final screenshots. No backend code or provider integration was changed or retested against live services.
