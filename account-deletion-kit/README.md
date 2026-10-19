# Account deletion kit — Supabase + Brevo

A drop-in Supabase Edge Function that permanently erases a user: their Brevo
contact, their storage objects, their application rows, and finally their
`auth.users` record. It reports the outcome of every step individually so a
partial failure tells you exactly what to retry.

The deletion flow is configurable in `config.ts`. The shared email design in
`email-template.mjs` is branded for NobleCart by FineAscent.

## Files

| File | Purpose |
| --- | --- |
| `config.ts` | Tables, buckets, Brevo settings, authorization rules. Edit this. |
| `brevo.ts` | Confirmation email, farewell email, contact erasure. |
| `email-template.mjs` | Shared matte HTML/plain-text email design and copy. |
| `preview-emails.mjs` | Generates local previews without sending email. |
| `web/email-preview.html` | Desktop/phone preview of both email variants. |
| `purge.ts` | Storage, table rows, auth user, audit row. |
| `index.ts` | The `delete-account` function. Requires a JWT, deletes the caller. |
| `request-deletion.ts` | The public `request-account-deletion` function. Emails a link, deletes nothing. |
| `web/delete-account.html` | Public form: email + reason. |
| `web/confirm.html` | Landing page for the emailed link; performs the deletion. |
| `sql/audit_table.sql` | Deletion audit table. |
| `sql/deletion_requests.sql` | Pending requests and rate limiting. |

## The security model, in one paragraph

Read this before changing anything, because the whole design rests on it.

**An email address is not proof of identity.** If a public endpoint deleted
whatever account matched the email in its request body, anyone could erase any
customer by typing their address into your form. So the public endpoint never
deletes: it emails a one-time link. Clicking that link is what proves the
visitor controls the mailbox, and redeeming it produces a normal Supabase
session. The deletion endpoint then takes its target from **the verified JWT and
nothing else** — it never reads a user id from the request body. Control of the
inbox is the only credential that deletes an account, which is exactly the
property you want: not staff, not an attacker with a list of your customers'
emails, and not anyone holding the service role key can delete an account
through this path.

## Install

Two functions, two tables, two pages.

```bash
mkdir -p supabase/functions/delete-account supabase/functions/request-account-deletion

# The authenticated deleter.
cp config.ts brevo.ts purge.ts email-template.mjs supabase/functions/delete-account/
cp index.ts                    supabase/functions/delete-account/index.ts

# The public request endpoint.
cp config.ts brevo.ts purge.ts email-template.mjs supabase/functions/request-account-deletion/
cp request-deletion.ts         supabase/functions/request-account-deletion/index.ts

psql "$DATABASE_URL" -f sql/audit_table.sql
psql "$DATABASE_URL" -f sql/deletion_requests.sql
```

Both functions share `config.ts`, so if you prefer, put the shared files in
`supabase/functions/_shared/` and adjust the imports rather than copying twice.

### Preview and customize the emails

From this repository's root:

```bash
node account-deletion-kit/preview-emails.mjs
node --test account-deletion-kit/email-template.test.mjs
```

Open `account-deletion-kit/web/email-preview.html`. It switches between the
confirmation and account-deleted messages at desktop and phone widths. The
generated HTML/text uses the same template as Brevo, with the mountain image
loaded locally for the preview. Its example confirmation
URL uses `example.invalid` and cannot delete an account. No mail is sent by the
preview or tests.

`email-template.mjs` holds the wordmark, support/privacy links, matte colors,
shared layout, and message copy. The wordmark uses the transparent PNG at
`https://fineascent.org/images/noblecart-wordmark-black.png` without a background, with
NobleCart alt text if images are blocked. The small top-right mountain tag uses
the original PNG at `https://fineascent.org/images/logo2.png`; keep both public assets available
when sending. Essential styles are inline, with a 600px maximum
width, mobile adjustments, and an Outlook width wrapper. Each message includes
a plain-text version; the confirmation also includes a copyable fallback link.

The configured sender name is NobleCart. The sender email is still a placeholder:
set `brevo.sender.email` in `config.ts` to your **Brevo-verified** sender before
deployment. Deploying the updated functions activates the new emails; changing
the website alone does not change already-deployed functions. Inbox checks in
Gmail, Outlook, and Apple Mail remain necessary before production use; browser
previews do not emulate those clients.

### Secrets

```bash
supabase secrets set BREVO_API_KEY=xkeysib-...
supabase secrets set IP_HASH_SALT="$(openssl rand -hex 32)"
supabase secrets set TURNSTILE_SECRET=0x...   # optional, see Bot protection
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Do not
set them yourself and never put the service role key in a web page — it bypasses
every row level security policy you have. The Brevo key comes from
**Settings → API keys** and needs transactional email and contact delete rights.

### Deploy, with the right JWT setting on each

This is the step people get wrong. The public endpoint must skip gateway JWT
verification, because its callers are signed out by definition. The deleter must
**not**.

```bash
supabase functions deploy request-account-deletion --no-verify-jwt
supabase functions deploy delete-account
```

Or pin it in `supabase/config.toml` so a future deploy cannot forget:

```toml
[functions.request-account-deletion]
verify_jwt = false

[functions.delete-account]
verify_jwt = true
```

`--no-verify-jwt` sounds alarming and is fine here: that function only ever
sends an email to an address it was given, and answers identically whether or
not the account exists. It has no destructive capability at all.

### Configure

In `config.ts`, set at minimum:

- `confirmUrl` — the deployed URL of `web/confirm.html`, HTTPS.
- `allowedOrigins` — your real domains. Leaving `["*"]` in production lets any
  site call these endpoints from a visitor's browser.
- `brevo.sender` — a from-address on a domain you have authenticated in Brevo.
- `tables` and `buckets` — see below.
- Leave `selfServiceOnly: true`.

Then fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` in both HTML pages and host
them. The anon key is designed to be public; the service role key is not.

## Configure

Open `config.ts`. The two lists that matter most:

**`tables`** — rows to delete, in dependency order, children before parents. You
can omit anything with `on delete cascade` from `auth.users`, since deleting the
auth user removes it. List a table explicitly when its foreign key has no
cascade, when it references something other than `auth.users`, or when you want
the deletion to show up as its own line in the result report.

**`buckets`** — storage folders to empty. The prefix is a function of the user
id, so the common one-folder-per-user layout is just:

```ts
{ bucket: "avatars", prefix: (userId: string) => `${userId}/` }
```

Listing recurses into subfolders, so nested paths are covered.

The rest are switches: whether to send the farewell email, whether to delete the
Brevo contact, whether a Brevo failure should abort the whole thing
(`requireBrevoSuccess`), whether the auth deletion is soft, and which table
receives the audit row.

`selfServiceOnly: true` is the setting that makes an account deletable only by
its owner. With it on, a `userId` in the request body is rejected outright
rather than honoured, so there is no admin override and no code path that
deletes anyone other than the holder of the JWT. Only turn it off if you
deliberately want staff deletion, and then implement `isAdmin`:

```ts
selfServiceOnly: false,
isAdmin: async (callerId, admin) => {
  const { data } = await admin.from("profiles").select("is_admin").eq("id", callerId).single();
  return data?.is_admin === true;
},
```

## The API contract

Two endpoints. Your coworker wires the form to the first one; the second is
called by the confirmation page and needs no work.

### 1. `POST /functions/v1/request-account-deletion` — public

Input is the form. Output is an email. It deletes nothing.

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/request-account-deletion" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{"email":"user@example.com","reason":"no longer shopping here"}'
```

| Field | Required | Meaning |
| --- | --- | --- |
| `email` | yes | Address to send the confirmation link to. |
| `reason` | no | Free text, up to 2000 chars, ends up on the audit row. |
| `captchaToken` | only with Turnstile | Token from the widget. |

The reply is always the same, whether or not that address has an account:

```json
{
  "ok": true,
  "message": "If an account exists for that address, we've emailed a confirmation link. The account is only deleted once you click it."
}
```

That uniformity is deliberate. A reply of "no such user" would let anyone test
addresses against your customer list, so the endpoint reveals nothing —
including when it silently drops a request for exceeding the rate limit. The
only `4xx` responses are a malformed email and a failed captcha.

### 2. `POST /functions/v1/delete-account` — requires a JWT

Called by `web/confirm.html` with the session from the redeemed link. The target
is the token holder; the body carries no identity.

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/delete-account" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"confirm":"DELETE"}'
```

| Field | Required | Meaning |
| --- | --- | --- |
| `confirm` | yes | Must be the literal string `"DELETE"`. |
| `reason` | no | Overrides the reason from the form. |
| `userId` | no | Rejected with `403` while `selfServiceOnly` is on. |

The `confirm` field exists purely so a mis-wired client cannot erase an account
by firing an empty POST.

### Response

`200` when every step succeeded, `207` when the account was deleted but some
step failed, `502` when `requireBrevoSuccess` is on and Brevo failed before
anything was touched.

```json
{
  "ok": true,
  "userId": "715ed5db-f090-4b8c-a067-640ecee36aa0",
  "email": "user@example.com",
  "steps": [
    { "step": "brevo.farewell_email", "ok": true },
    { "step": "brevo.delete_contact", "ok": true },
    { "step": "audit", "ok": true },
    { "step": "storage.avatars", "ok": true, "detail": "3 object(s)" },
    { "step": "table.public.orders", "ok": true, "detail": "12 row(s)" },
    { "step": "auth.delete_user", "ok": true, "detail": "hard deleted" }
  ]
}
```

Other status codes: `401` missing or invalid token, `403` deleting someone else
without admin rights, `404` unknown user, `400` bad body or missing `confirm`.

## How it is ordered, and why

1. **Resolve the user's email.** Brevo is keyed on the email address, and once
   the auth row is gone there is no way to recover it.
2. **Send the farewell email, then delete the Brevo contact.** Both happen
   before any Supabase data is touched, so `requireBrevoSuccess: true` can abort
   with the account completely intact.
3. **Write the audit row.** Before the purge, while there is still a user to
   attribute it to.
4. **Delete storage objects, then table rows** in the configured order.
5. **Delete the auth user last.**

Step 5 is the decision worth understanding. Deleting the auth user first would
lock the account out immediately, but if a later step failed you would have
destroyed the identity and orphaned the data with nothing left to key a retry
on. Doing it last means any failure leaves a live account you can simply call
the function against again.

That ordering depends on every step being safe to repeat, and they are: a Brevo
`404` on an already-deleted contact counts as success, deleting zero rows is not
an error, and removing storage objects that no longer exist is a no-op. The one
non-idempotent step is the farewell email — a retry sends it twice. Set
`sendFarewell: false` if that matters more to you than the notification.

## Failure modes

**Brevo is down or the key is wrong.** With the default
`requireBrevoSuccess: false` the account is still deleted and you get a `207`
with the failing step named. The user is gone from your database but still a
contact in Brevo, so re-run the function or delete the contact by hand. Flip the
flag to `true` if leaving a stale contact is worse than leaving a live account.

**A table delete fails.** Usually a foreign key from a table you did not list.
Add it to `tables` above its parent and re-run.

**The auth delete fails but everything else succeeded.** You get a `207` with an
account that has no data. Re-running is safe.

## Hardening the public endpoint

The request endpoint is the only unauthenticated surface here, and it cannot
delete anything. What it *can* do is send email, so the abuse to defend against
is someone burning your Brevo quota or spamming a customer's inbox with
deletion notices. Four things stop that.

**Rate limits.** Three requests per email and ten per IP per hour, from
`CONFIG.rateLimit`, counted against `account_deletion_requests`. Over the limit,
the request is dropped and the caller still gets the normal reply.

**Hashed IPs.** The rate limiter stores a salted SHA-256 of the address, so the
table is not an IP log. Set `IP_HASH_SALT` to a random 32-byte hex string and
never rotate it casually — changing it resets everyone's counter.

**Bot protection.** Set `TURNSTILE_SECRET` and the function requires a valid
Cloudflare Turnstile token; leave it unset and the check is skipped entirely.
For a public page that sends mail, turn it on. Put your site key in
`web/delete-account.html`, or delete the widget div and the script tag if you
are not using it.

**Origin allowlist.** Replace `allowedOrigins: ["*"]` with your real domains so
another site cannot invoke these endpoints from your customers' browsers.

Worth knowing: CORS is not an authentication control. It stops a *browser* on
another origin, not `curl`. The security of this design comes from the JWT
requirement on the deleter, not from the allowlist.

### What an attacker gets

| Attempt | Result |
| --- | --- |
| Submits a victim's email on your form | Victim receives an email. Nothing is deleted unless the victim clicks. |
| Calls `delete-account` with `{"userId": "<victim>"}` | `403`. The target comes from the JWT. |
| Calls `delete-account` with no token | `401` at the gateway, before your code runs. |
| Guesses a `token_hash` | Cryptographically random, one-time, expires in an hour. |
| Probes which emails have accounts | Identical response every time. |
| Floods the form | Rate limited and captcha-gated; replies stay uniform. |
| Steals the anon key from your page | It is public by design and grants nothing beyond RLS. |
| Intercepts the confirmation link | Owning the mailbox is the credential. Same exposure as password reset. |

That last row is the real residual risk, and it is inherent to every
email-based flow: whoever reads the inbox can delete the account. Shorten the
link lifetime under **Authentication → Email** if you want a tighter window.

## Brevo: delete versus suppress

Deleting a contact is full erasure — it also wipes that contact's email history
and statistics, and it does **not** prevent the address from being added again.
If the same person signs up later they come back as a fresh contact and will
receive mail normally.

If your actual requirement is "never email this person again," deleting is the
wrong tool; the address needs to go on the blocklist instead, which means
keeping the contact and marking it. This kit does full deletion, which is what
GDPR erasure requests call for. Change `deleteContact` to `false` and add a
blocklist call in `brevo.ts` if you need suppression.

## Before you trust it in production

Run through this on a **staging project** with a throwaway account. Never
rehearse it against production, since nothing here is reversible.

Happy path:

- Submit the form, receive the email, click the link, confirm the deletion
  reports every step `ok`.
- Confirm the contact is gone from the Brevo dashboard.
- Confirm no rows survive in any table that referenced the user.
- Confirm the reason you typed shows up on the `account_deletions` row.

Security checks, all of which should fail safely:

- Submit an address with no account. You should get the same reply as a real
  one, and no email.
- Reuse a confirmation link. The second attempt should report an expired link.
- Call `delete-account` with no `Authorization` header: `401`.
- Call `delete-account` with a valid token and someone else's `userId`: `403`,
  and confirm afterwards that *neither* account was deleted.
- Submit the form four times for one address within an hour. The fourth should
  still return the normal message but send no email.
- Confirm `request-account-deletion` is the only function deployed with
  `--no-verify-jwt`.
- Search your deployed pages for the service role key. It must appear nowhere:
  `rg -i "service_role" web/`

Then, before going live, confirm `allowedOrigins` is not `["*"]`, `confirmUrl`
is HTTPS, and `selfServiceOnly` is still `true`.
