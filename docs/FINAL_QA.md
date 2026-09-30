# Final QA checklist

This repository keeps the live storefront and the unified seller panel in one frontend deployment.

## Automated gates

`Code check` now validates:

- storefront runtime JavaScript syntax
- every panel JavaScript file
- HTML/local asset integrity
- dynamic section registry coverage
- Visual Editor draft/publish/version/media controls
- legacy safe-merge routes
- accessibility/reduced-motion safeguards
- duplicate IDs on the storefront home shell
- absence of `javascript:` URLs and `document.write` in dynamic runtime code

## Runtime safeguards

- Backend-powered home has a safe default configuration if published layout data is unavailable.
- Product images are lazy-loaded; educational videos use `preload="none"` and are paused when they leave the viewport.
- Campaign countdown uses backend `serverNow` clock skew rather than a fake page-only timer.
- Storefront Editor previews the real page while bypassing the cinematic intro.
- Draft changes are not live until Publish.
- Storefront versions can be restored to draft.
- Media upload/delete remains authenticated through the backend.
- Reduced-motion, keyboard focus, high-contrast/forced-color and minimum touch-target rules are additive QA layers.

## Manual browser QA still required for release-sensitive visual changes

Automated checks cannot prove pixel-level rendering, GPU/frame-rate behavior, device browser quirks, or third-party network availability. For changes to the cinematic intro, payment UI, or major responsive styling, visually smoke-test at least one current mobile browser and one desktop browser before treating appearance/performance as verified.
