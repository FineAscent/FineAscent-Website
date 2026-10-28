#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
cp account-deletion-kit/email-template.mjs get-started/server/email-template.mjs
mkdir -p supabase/functions/business-inquiry
cp get-started/server/index.ts get-started/server/handler.mjs get-started/server/email-template.mjs supabase/functions/business-inquiry/
supabase functions deploy business-inquiry --project-ref pkofxkcbdyqcunwjrnnx --no-verify-jwt --use-api
