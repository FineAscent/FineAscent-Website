# NobleCart business inquiries

`business-inquiry` is deployed to Supabase project `pkofxkcbdyqcunwjrnnx`.
The front end calls its public URL. No API keys are shipped to the browser.

- Inbox: **fineascentcreative@gmail.com**. Subject: `NobleCart inquiry — Company`.
- The inbox message's Reply-To is the visitor's validated work email.
- A separate fixed, branded acknowledgment goes to the visitor in the same
  Brevo batch. No visitor message text is echoed in that acknowledgment.
- The UI confirms only after Brevo accepts both message versions. Provider
  acceptance is not proof of final inbox delivery; Brevo logs track that.
- Sending disables inputs and repeat clicks. Failed requests preserve values.
  Unchanged retries reuse a UUID. Brevo's batch idempotency key and private
  database reservation prevent duplicates (including ambiguous timeout retries).
- A honeypot, strict origins, bounded request size, validation, and database-backed
  hourly limits protect the public endpoint: 30 total requests, 3 per hashed IP,
  and 2 per hashed email. CORS alone is not authentication or bot protection.
- SQL tables store only IDs, hashes, counters, and delivery states, never the
  visitor's message. Old counters (2 days) and metadata (7 days) are pruned on
  the next reservation. Full message content passes through Brevo to the inbox.

## Deploy

`schema.sql` is installed in the project. It creates only inquiry metadata tables
and a service-role-only reservation function. Both tables have RLS enabled and
no anonymous/authenticated grants. Apply that schema before first deployment.

Secrets already configured in Supabase: `BREVO_API_KEY`, `IP_HASH_SALT`, and
`FROM_EMAIL` (a verified sender). Supabase injects `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Never copy secret values into the website.

From the repository root:

```sh
node --test get-started/inquiry.test.mjs get-started/server/handler.test.mjs
sh get-started/server/deploy.sh
```

The deploy script refreshes the shared renderer from
`account-deletion-kit/email-template.mjs` and copies this bundle into the ignored
Supabase working directory. It deploys **only** `business-inquiry`; it does not
change authentication or other functions. No website publishing is performed.

## Preview

Serve the repository with `python3 -m http.server 8765 --bind 127.0.0.1` and open
`http://127.0.0.1:8765/get-started/`. File URLs have a null Origin and cannot use
the live endpoint. Production origins are `https://fineascent.org` and
`https://www.fineascent.org`; localhost port 8765 is allowed for local review.

Tests use fake provider responses and send no email. Live tests must use an
inbox explicitly approved for testing, with clearly labeled test content.
