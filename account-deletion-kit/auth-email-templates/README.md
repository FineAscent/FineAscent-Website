# NobleCart verification email — Supabase Auth

NobleCart uses a verification link. Use **confirm-signup-link.html** with the
matching matte design, black transparent wordmark, and mountain corner stamp.

The button and copyable fallback preserve Supabase’s dynamic
`{{ .ConfirmationURL }}`. No verification code is included in this template,
and the existing confirmation flow and expiry settings are unchanged.

## Activate in Supabase

1. Open the correct Supabase project → **Authentication → Email Templates**.
2. Open **Confirm sign up** for new-account email verification.
3. Set the subject to **Verify your NobleCart email**.
4. Paste the complete contents of `confirm-signup-link.html` into the email body.
5. Preview and save. Test with a test account and its real confirmation link.
   Do not use the static preview link for a real verification.

Supabase Auth controls verification email content even when Brevo is configured
as the SMTP transport. Updating the Brevo deletion functions or pushing the
website alone does not activate this template in hosted Supabase.

Production image URLs must be publicly available before using the template:

- `https://raw.githubusercontent.com/FineAscent/FineAscent-Website/d81c1579aa11e6986029ead9a7dc590c222abbfe/images/noblecart-wordmark-black.png`
- `https://fineascent.org/images/logo2.png`

Set Supabase Auth’s separate SMTP From and Reply-To (where available) to
`support@fineascent.org`. Every application support link uses this address.

The code template is an optional, inactive variant. Its `{{ .Token }}` panel
receives the real code from Supabase; do not paste a preview code into production.
The optional fallback keeps `{{ .ConfirmationURL }}` intact. Existing expiration
and verification behavior are preserved. TXT files are provided
as plain-text references; hosted Supabase's dashboard body field uses HTML.

## Regenerate and preview

From the repository root:

```bash
node account-deletion-kit/preview-emails.mjs
node --test account-deletion-kit/email-template.test.mjs
```

Open `account-deletion-kit/web/email-preview.html`, which defaults to the
verification-link preview. Local previews use local image paths; dashboard
files use absolute HTTPS image URLs.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
