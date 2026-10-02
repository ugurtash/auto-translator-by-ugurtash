# Auto-Translator production backend

This backend is the production boundary for authentication, translation requests, server-side daily usage enforcement, Lemon Squeezy entitlement synchronization, and owner entitlement.

## Architecture

Chrome extension -> authenticated backend -> translation provider

Lemon Squeezy -> signed webhook -> backend -> entitlement

The extension must never contain Supabase service-role keys, Lemon Squeezy webhook secrets, or translation-provider secrets.

## Required environment

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
LEMON_SQUEEZY_WEBHOOK_SECRET
TRANSLATION_PROVIDER_URL
TRANSLATION_PROVIDER_KEY
OWNER_EMAIL

## Current status

The repository contains the production boundary and schema scaffold. Translation-provider integration, authenticated JWT verification, database usage enforcement, entitlement synchronization, and owner provisioning must be completed before public commercial traffic is enabled.

The live Supabase project uses public.profiles rather than a public.users table.
