# Auto-Translator account and billing

The extension preserves its original direct Google translation connection. Anonymous and signed-in free users have a local 500-word daily quota. A validated, confirmed Supabase account receives unlimited extension usage only when its immutable ID matches the private founder ID or a live subscription has current access. Test subscriptions never grant production Premium access. Provider throttling and the 12,000-character request limit still apply.

## Deployment

Deploy `backend/edge/index.ts` and its relative dependencies as `owner-access`. Public auth routes validate signup/login through Supabase Auth. Account and checkout routes verify the user through Auth before reading billing data; webhook verifies HMAC SHA-256 over the exact raw body. The gateway JWT check is disabled because public login and signed webhooks implement separate verification.

Apply `schema.sql`, then `billing-schema.sql`. Billing tables use RLS; clients can read only their own subscription and cannot write it. Only the service role can run the atomic, idempotent subscription update. Delayed webhook events fetch the provider's current state. A cancelled subscription remains accessible until its paid period ends. Paused, expired, unpaid and fully refunded subscriptions do not grant access.

Default Supabase function secrets provide Auth and service-role credentials. Privately configure `OWNER_USER_ID` or inject it into deployment-config.js in the upload bundle only. Never commit founder identity or secret keys. Live billing requires `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_WEBHOOK_SECRET`, `LEMON_SQUEEZY_STORE_ID`, `LEMON_SQUEEZY_VARIANT_ID`. The variant must be the verified €3.99 monthly live product.

The isolated `owner-access-test` bundle sets `BILLING_TEST_MODE=true` in its private deployment-config.js and uses `LEMON_SQUEEZY_TEST_*` settings. Do not switch the production extension URL to the test function. Test checkout purchases use provider test cards only. API keys and webhook secrets stay in encrypted server settings; they are absent from the Chrome package.

Webhook endpoint: `https://cxxbcamghmyttgqikfak.supabase.co/functions/v1/owner-access/webhook`. Subscribe to subscription lifecycle and payment success/failure/recovery/refund events. Use the corresponding `owner-access-test/webhook` endpoint for test mode.

## User flow

Select Sign in from the language/settings popup. Create an account, confirm the email, then sign in. The account page shows Free or Unlimited accurately. Subscribe from the signed-in account: the server creates checkout with a signed user ID, regardless of a differing payment contact email. After payment, Refresh access reads server billing state. On another computer, install the published extension and sign in to the same account.

Remember me persists rotating tokens in trusted extension storage. Otherwise tokens last for the browser session. Passwords are not saved. Sign-out removes local tokens and requests session revocation. Login returns to the user's prior tab and closes only the verified account tab. Recovery and email confirmation use the first-party GitHub Pages callback, strip token fragments immediately and verify the session before showing a password form.

## Release gates

The Chrome Store upload remains blocked until live product/key/webhook configuration, custom SMTP with real delivery checks, and a successful test checkout with lifecycle checks are completed. Do not describe the package as ready solely because automated tests pass. Free quotas are local and can reset on reinstall; there is no claim of server-enforced free usage across devices.

Run `node --test backend/test/*.test.js tests/*.test.cjs`. Validate production unauthorized access returns 401, forged webhooks return 401, and production excludes test entitlements. Complete confirmation, recovery and payment tests without exposing private credentials in logs or chat.
