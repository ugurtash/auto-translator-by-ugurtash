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

## 1.2.3 — Account settings

- Removed the account form and all founder labels from the translation popup.
- Moved account sign-in to the Chrome extension Options page.
- Unlimited access is identified server-side and shown with a standard usage label.

## 1.2.4 — Sign-in entry point

- Added a discreet Sign in button at the bottom right of the translation popup.
- The button opens the existing email/password account page and becomes Account after sign-in.
- The upgrade button is hidden for verified unlimited access.

## 1.2.5 — Account flow and translation recovery

- Clear confirmation-email and password-reset notifications.
- Forgot password flow with a secure recovery page.
- Remember me persists session tokens only; unchecked sessions are kept in browser-session storage.
- Successful sign-in returns to the previously active tab and reopens translation controls where supported.
- Founder entitlement is checked on the server; translation uses the extension's original provider connection to avoid failures from the cloud proxy.

## 1.2.6 — Close sign-in tab after returning

- After successful sign-in, return to the original tab and close only the extension account tab.
- Keep account settings open if the original tab has been closed.

## 1.2.7 — Customer accounts and subscription billing
- General verified customer accounts; founder access pinned privately to the Auth user ID.
- Signed checkout binds subscriptions to the account across computers, even when billing contact email differs.
- Raw-body HMAC verification, service-only atomic billing updates, provider-state reconciliation and isolated test billing.
- Signed-in free accounts retain the original free translation path. Correct plan labels and local usage date display.
- Checkout opens from account settings; access can be refreshed after purchase. Updated privacy description.
- Verified SMTP email delivery, normal customer confirmation/login, session refresh and a successful test purchase linked through the signed webhook. Test purchases do not grant production access.
- 40 automated checks pass. Live billing is configured; the live product remains Draft until launch. Chrome Web Store screenshots and dashboard review remain before submission.
