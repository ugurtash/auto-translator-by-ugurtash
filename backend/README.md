# Auto-Translator Backend

Production boundary for translation, daily usage enforcement, Lemon Squeezy entitlement synchronization, and owner unlimited access.

## Planned production flow

Extension -> backend -> translation provider
Lemon Squeezy -> signed webhook -> backend -> entitlement
Owner account -> role=owner -> unlimited

## Required environment variables

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LEMON_SQUEEZY_WEBHOOK_SECRET
TRANSLATION_PROVIDER_URL
TRANSLATION_PROVIDER_KEY
OWNER_EMAIL

No secret belongs in the Chrome extension.

## Status

The scaffold is intentionally non-production until the dedicated database and secrets are configured. The current extension must not be submitted as a paid production release until the backend enforces usage and entitlement server-side.
