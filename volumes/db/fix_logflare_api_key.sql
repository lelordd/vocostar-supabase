-- Fix: Sync Logflare API key in _analytics.users to match LOGFLARE_PUBLIC_ACCESS_TOKEN env var.
-- Logflare stores its API key in the DB on first boot. If the env var was empty at first boot,
-- Logflare auto-generated a random key. This script overrides it with the correct token.

\set logflare_key `echo "$LOGFLARE_PUBLIC_ACCESS_TOKEN"`

\c _supabase

-- Update all existing Logflare users to use the configured public access token
UPDATE _analytics.users SET api_key = :'logflare_key' WHERE api_key IS NOT NULL;

\c postgres
