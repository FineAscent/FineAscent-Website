#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
cp account-deletion-kit/email-template.mjs account-deletion-kit/email-layout.mjs account-deletion-kit/receipt-email.mjs get-started/server/
mkdir -p supabase/functions/business-inquiry
cp get-started/server/index.ts get-started/server/handler.mjs get-started/server/email-template.mjs get-started/server/email-layout.mjs get-started/server/receipt-email.mjs supabase/functions/business-inquiry/
supabase functions deploy business-inquiry --project-ref pkofxkcbdyqcunwjrnnx --no-verify-jwt --use-api
