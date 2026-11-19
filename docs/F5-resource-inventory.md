# F5 visual resources and mapping

Date: 2026-11-19. Resources were inspected before implementation. No approved artwork was regenerated. Local changes only; no production/provider configuration or database changes.

## Supplied primary assets

All paths below are relative to client/public/assets.

| Asset | Verified properties | Mapping |
|---|---|---|
| footer/footer-desktop.png | 2172x724 RGB PNG; 1,593,962 bytes; atmospheric dark blue, excavator silhouette at right, luminous wave lower band | Desktop/laptop footer |
| footer/footer-tablet.png | 1448x1086 RGB PNG; 1,665,322 bytes | Tablet footer, 601-1100px |
| footer/footer-mobile.png | 1024x1536 RGB PNG; 1,584,242 bytes | Mobile footer, <=600px |
| motion/hero-equipment-orbit.webm | 960x720; 8s; 2,194,839 bytes; rotating excavator/platform study | Hero visual |
| motion/how-it-works.webm | 800x800; 8s; 1,467,633 bytes; search/schedule/pickup/completion diagram | Process section, alongside explanatory text |
| motion/precision-equilibrium.webm | 640x640; 8s; 2,109,284 bytes; shield/balance sculpture | Closing owner CTA |

Chromium decodes all three films and reports VP9 WebM support. Canvas inspection of an actual decoded frame found partial/transparent pixels in approximately 79%, 95% and 90% of their canvases respectively. This confirms useful transparency in the tested browser, not universal codec support. Original alpha-edge artifacts/style are preserved; no silent artwork repainting occurred.

SHA256 comparisons against assets-source/original-footer and assets-source/webm-source prove all six supplied primary files remain byte-for-byte unchanged. The PNG sources remain in public assets. Actual footer WebP derivatives are 67,444 / 79,804 / 55,004 bytes, approximately 96% smaller in aggregate than the source PNGs. Resizing/encoding preserves aspect ratio and does not bake text into artwork.

No poster frames existed initially. Extracted real frames near two seconds from the supplied films; wrote transparent WebP posters (96,704 / 131,824 / 101,450 bytes) alongside them. They are derivatives, not newly invented illustrations. They supply reduced-motion, codec/network failure and pre-playback fallback. Video source is assigned only when its section is intersecting; noncritical films are not eagerly downloaded on initial load.

## Branding and references

Available: slate and white transparent PNG symbols at 64/128/256/512 square; original concept PNG. Inspected 256px symbols have an alpha channel. Use 128px source at 38-44 CSS pixels in the header/footer; icons use supplied 64/256/512 assets. No stretched/cropped symbol. Wordmark is accessible typeset **Equipora** with a small descriptive tagline, not an invented owner-approved raster logo. The design-token draft calls the symbol a concept; the integrated identity remains a visual-acceptance candidate. No supplied SVG/full wordmark lockup was found.

Inspected assets-source/design-references/equipora-approved-slate-blue-visual-reference.png: slate/white atmospheric hero, substantial equipment visual, rounded navigation/cards and dark footer. Kept the color/spacing/composition direction while omitting unsupported activity totals, fake real reviews, app-store availability and active newsletter claims shown in that reference. Primary token is #6C7A89; readable control/text variants are derived darker slate. The supplied low-poly/diagram motion artwork is used as-is rather than claiming photoreal equivalence to the reference.

Inspected available reference code at D:/Company Website/naira_software_solutions/src/components/layout/header.tsx and navigation-theme.ts, including portfolio theme behavior. Adapted sticky scroll-state transition, glass surface, keyboard loop, inert background and scroll lock. No NAIRA name/colors/services/menu branding was copied, and that separate project was not modified. This is the available shared-header reference, not a claim that a separate personal-portfolio design file was located.

The design-token JSON is explicitly a pre-build draft and contains stale filenames/claims (an absent SVG wave; motion not yet created). Actual supplied PNGs/WebMs and the owner's F5 brief take precedence. No absent resource was assumed to exist.

## Thirty-item demonstration catalog

Reviewed the existing JSON and CSV draft in assets-source/catalog. JSON has 30 synthetic entries, five per required category, with suggested but nonexistent image paths. It uses BDT while the verified application prices and Checkout use USD. The original draft files remain untouched.

scripts/f5-demo-catalog.json is the fixed normalized local fixture: meaningful names/descriptions, six categories, five per category, locations/stock/conditions/terms/owner relationships, independently authored illustrative USD rates. It preserves sourceCurrency=BDT as provenance and explicitly states the new rates are **not a currency conversion**. Most rentals are daily; two fixtures exercise weekly/monthly types. A fixed --catalog=f5 flag enables it only inside the existing disposable MongoDB runner. Default six-item F3 fixture mode remains unchanged. No Atlas seed command was introduced.

All 30 photos were prepared as 900x660 padded WebP derivatives (3,212,020 bytes total). Original search suggestions were visually reviewed; unrelated bulb/dog/historical-tent results were replaced with equipment-related images. Wikimedia thumbnail throttling affected some requests; cached derivatives were reused and only missing/mismatched targets retried with bounded requests. No credentials were sent to image sources. A few remaining photographs are contextual/close-up rather than studio product shots; exact capacity/model is fictional and explicitly disclosed. See the contact sheet for owner selection, particularly EQD-005, 010, 014, 016, 018 and 020.

Per-item title/author/source/license/modification notices are retained in client/public/assets/equipment/credits.json and rendered at /asset-credits. Licenses vary by source (CC BY/CC BY-SA and public domain); preserve individual attribution/ShareAlike conditions when distributing derivatives. These are illustrative photos, not equipment-provider endorsements or proof of exact model/stock. Owner can later supply consistent original product photography after visual review.

Local public image resolution is permitted only for fixed EQD-xxx IDs with demoOnly and unchanged demoImageSource. Owner replacement images take precedence; no arbitrary file path or network proxy was added. The canonical HTTPS image value remains valid for strict equipment updates. User-created normal equipment continues using its original image behavior.

## Footer honesty and asset policy

Responsive picture sources choose desktop/tablet/mobile artwork. Content remains above the luminous focal band, preserving silhouette/framing and text readability. Fictional partner marks are visibly identified as demonstration branding/no endorsements. Only the verified GitHub repository destination is linked; no social profiles/app-store availability invented. No newsletter field or fake subscription result; a short disabled-feature disclosure is shown. /privacy and /terms are functional demo disclosures, explicitly not approved production legal policies. /asset-credits provides actual source attribution.

See F5-implementation-and-QA.md for executed tests, screenshots, limitations and owner review instructions. Neither resource preparation nor a successful local preview authorizes publication.
