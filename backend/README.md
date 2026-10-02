# Auto-Translator founder access

The Chrome extension keeps the existing free translation path (500 words/day per Chrome installation). Founder translations go through the `owner-access` Supabase Edge Function. Every founder request validates the access token using Supabase Auth's `/user` endpoint, requires a confirmed email, and checks the server's founder identity. Client `premium` flags and user-editable metadata cannot grant founder access.

This change implements founder access only. Commercial entitlement synchronization and server-enforced quotas for all free/paid users are still separate work; the Lemon Squeezy webhook scaffold is not a completed subscription system.

## Deployment

The production function is `owner-access` in the Auto-Translator Supabase project. Entry point: `backend/edge/index.ts`. Bundle the relative `api` and `lib` modules. Gateway JWT verification is disabled because the public signup/login routes must accept unauthenticated users; the account and translation handlers perform their own verification against Supabase Auth for every request.

Supabase automatically supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the function. Supply `OWNER_EMAIL` privately (or inject it into `backend/lib/deployment-config.js` in the deployment bundle only). After first signup, optionally pin `OWNER_USER_ID` to the authenticated user's immutable UUID. Email fallback accepts only the server-configured address confirmed by Supabase, never the email provided in a translation request. Never commit the private identity config or secret keys.

The same handlers can be used in a Node/Vercel backend with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OWNER_EMAIL`, and optionally `OWNER_USER_ID`. Update the extension endpoint and host permission together if changing hosting.

## First use / another computer

Reload the unpacked extension in Chrome. Open its popup, enter the founder email and a password of at least 12 characters, and click **Create founder account**. Confirm the email using Supabase's link, then return to the popup and click **Sign in**. The project's Site URL points to `/owner-access/confirmed`, a minimal text response that asks the user to return to extension sign-in. It includes no scripts or tracking.

On another computer, install the updated extension and sign in to the same account. Refresh tokens persist in trusted extension storage only; content scripts cannot access them. The password is sent through HTTPS to Supabase Auth and is not saved by the extension. Sign-out removes local tokens and attempts to revoke the current refresh-token session; issued access tokens can remain valid until expiry.

Founder access removes the extension's daily word quota, not the upstream translation service's limits. Translation currently uses the same Google endpoint as the prior release; per-request text is limited to 12,000 characters and requests time out. No provider availability or unlimited commercial API entitlement is implied.

## Verification

`node --test backend/test/*.test.js` checks forged sessions, non-founder identities, unconfirmed accounts, registration, and translation over 500 words. `node --test tests/*.test.cjs` checks extension access boundaries and local flag bypasses. Live unauthenticated requests must return 401; other-account signup/login returns 403. End-to-end founder signup and translation require the user's private password and email confirmation, so the user completes these in Chrome.
