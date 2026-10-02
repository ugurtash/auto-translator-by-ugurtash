# Auto-Translator by UgurTash 1.2.0

- Translation now starts only after the user selects text.
- Hover and mouse-movement translation have been removed to reduce visual clutter and unnecessary usage.
- Selected words, sentences, and short passages can be translated.
- Translation requests run through the MV3 service worker for more reliable cross-origin requests.
- Added in-memory translation caching for repeated selections.
- Added a speaker button using the browser Speech Synthesis API.
- Target language remains selectable from the extension popup.
- The 500-word daily free limit remains as a local prototype control.

Important: payment and server-side entitlement are not yet connected. The current premium flag is only a local prototype placeholder and is not suitable for commercial enforcement.

## 1.2.2 — Founder account sign-in

- Founder access follows the verified account across computers.
- Added founder account creation, email confirmation, sign-in, refresh and sign-out.
- Server validates founder identity on every unlimited translation; local premium flags no longer grant unlimited access.
- Session storage is restricted to trusted extension contexts.
- Free translation remains limited to 500 words per day per installation. Paid subscription integration remains incomplete.
