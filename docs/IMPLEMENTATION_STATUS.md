# Implementation status

## Completed in the current architecture

- Unified seller panel remains the management source of truth on top of the real backend.
- Safe legacy CRM capabilities were merged without restoring IndexedDB as a database.
- Management UI has an additive responsive Neumorphism presentation layer.
- Storefront home is block/section based and rendered through a section registry.
- Search, category navigation, visual categories, product collections, best sellers, timed campaign blocks, educational product videos, promotional banners, support/trust content and responsive footer are supported.
- Best-seller AUTO mode is based on real sales insight data; MANUAL mode is configurable in the editor.
- Timed campaign visibility/countdown uses backend server time. Campaign blocks select products and content without overwriting catalog prices.
- Storefront Visual Editor supports add, edit, enable/disable, delete, duplicate, move up/down and drag/drop.
- Desktop/tablet/mobile preview modes exist.
- Global design tokens are configurable.
- Draft, preview, publish, version history and restore-to-draft are backend backed.
- Central storefront Media Manager is backed by authenticated backend uploads and Cloudinary.
- Publish/restore/draft actions are audit logged.
- Public storefront config has safe defaults if persisted page configuration is unavailable.
- Mobile/performance/accessibility regression safeguards are part of CI.

## Intentional boundaries

- AI agents are not implemented in this phase. Audit/approval-oriented backend boundaries were kept so agents can be added later without making them direct publishers.
- The current campaign block is a timed merchandising campaign. It does not mutate checkout/catalog price by itself; price-changing promotions require an explicit pricing-rule domain so accounting/order totals cannot diverge from the product source of truth.
- Browser/pixel-perfect visual QA remains a manual release check; automated CI covers syntax, HTML/assets and architecture regressions.
