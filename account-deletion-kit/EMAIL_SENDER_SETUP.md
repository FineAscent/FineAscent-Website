# FineAscent customer email standard

Saved locally, November 5, 2026. No deployment, publishing, SMTP changes, key
creation, or live test sends were performed for this update.

## Approved source and local equivalents

The authority is `/Users/muneerahmed/NobelCart-Full/`:

- `supabase/functions/_shared/email-layout.mjs` → identical local
  `account-deletion-kit/email-layout.mjs`.
- `receipt-email.mjs` → identical local `account-deletion-kit/receipt-email.mjs`.
- `verification-email.mjs` → the same white code panel, NobleCart wordmark,
  FineAscent mountain, light layout, and footer in `email-template.mjs`.
  This workspace preserves its existing verification copy and expiration behavior;
  it does not add the application's separate 10-minute OTP sender.
- `auth.ts` → equivalent sender selection and explicit Brevo `replyTo` in
  `brevo.ts` and `get-started/server/handler.mjs`. The full application auth
  module is not copied over this workspace's deletion authorization logic.
- `supabase/templates/confirm-signup.html` → generated
  `auth-email-templates/confirm-signup-link.html`, preserving the button and every
  `{{ .ConfirmationURL }}` placeholder. Header table nesting is corrected.

## Identity and sending paths

Every application From and Reply-To defaults to `support@fineascent.org`.
`FROM_EMAIL` must remain `support@fineascent.org`; it is the single sender
setting. Do not reintroduce a `BREVO_OTP_FROM_EMAIL` override. Reuse the existing
Brevo credentials; the support sender is already verified. The user confirmed
delivery of the prior branded Brevo test. No repeat live test was necessary.

Deletion confirmation, account-deleted notices, verification-link and
verification-code templates, receipts, inquiry acknowledgments, and internal
inquiry messages share the approved layout and support/privacy footer. Generated
runtime codes are escaped and displayed as text, including leading zeros.
Auth link placeholders are replaced only by the auth provider. Production senders
receive actual signed links; preview links and codes stay in preview files.

The internal business-inquiry destination remains `fineascentcreative@gmail.com`.
Both messages' From/Reply-To use support; staff can find the visitor's work email
in the message body. Direct contact and privacy/SMS support links use support.
The unrelated careers contact is preserved.

The local ignored Supabase `_shared/config.ts` now renders branded deletion
messages while preserving its actual table/bucket lists and other deletion
settings. Its Brevo sender and local inquiry bundle are updated too. These files
are ignored by Git; tracked equivalents live in `account-deletion-kit/` and
`get-started/server/`. Package `email-template.mjs`, `email-layout.mjs`, and
`receipt-email.mjs` together wherever the renderer is copied.

## Checks and previews

Use Node 22.18+ for the native TypeScript Brevo tests:

```sh
node account-deletion-kit/preview-emails.mjs
node --experimental-strip-types --test account-deletion-kit/email-template.test.mjs account-deletion-kit/brevo.test.mjs get-started/inquiry.test.mjs get-started/server/handler.test.mjs
```

Open `web/email-preview.html`; it includes desktop and phone widths, both
verification methods, both deletion messages, a receipt, and both inquiry
messages. Tests mock the provider and never send email or delete contacts.
The receipt renderer is saved and previewed here; this website has no checkout
receipt sending endpoint to deploy.

## Live activation remaining — requires a later authorized release

1. Release the updated deletion and business-inquiry functions with all local
   renderer dependencies. Preserve the existing deletion project configuration.
2. Install `auth-email-templates/confirm-signup-link.html` in the intended Supabase
   project's Confirm sign up template. SMTP sender settings alone do not install
   the template. Use the code variant only for an existing code-based auth flow.
3. Confirm Supabase Auth SMTP uses support, and application `FROM_EMAIL` remains
   support. Live `FROM_EMAIL` and `BREVO_OTP_FROM_EMAIL` were already set by the
   approved setup; this change does not update hosted configuration.
4. Release the updated privacy, SMS support, and direct-contact website files.
5. The application's new OTP/receipt functions remain in NobelCart-Full and need
   their own later release; this workspace does not deploy that application.
6. After that release, verify authorized real signup/deletion/inquiry/receipt
   flows, auth expiration, delivered From/Reply-To, and receipt quantities/totals.

Keep production links dynamic. Never replace `{{ .ConfirmationURL }}` with a
homepage, example URL, or design-test URL in a live auth template.

## Changed-file inventory

- `account-deletion-kit/`: new `email-layout.mjs`, `receipt-email.mjs`,
  `brevo.test.mjs`, and this setup document; updated `email-template.mjs`,
  `email-template.test.mjs`, `preview-emails.mjs`, `brevo.ts`, `config.ts`, and
  `README.md`.
- `account-deletion-kit/auth-email-templates/`: updated README and both
  `confirm-signup-link` / `confirm-signup-code` HTML and TXT variants.
- `account-deletion-kit/web/`: regenerated verification-link, verification-code,
  confirmation, and deleted HTML/TXT previews; new receipt, inquiry, and
  inquiry-internal HTML/TXT previews; updated `email-preview.html` selector.
- `get-started/server/`: updated renderer, handler, handler tests, README, and
  dependency-copy steps in `deploy.sh`; new shared layout and receipt dependency.
- Support links updated in `get-started/index.html`,
  `noblecart/privacy-policy/index.html`, and `noblecart/sms-terms/index.html`.
- Ignored local bundles: `_shared/config.ts`, `_shared/brevo.ts`, new
  `_shared/{email-template,email-layout,receipt-email}.mjs`, and the inquiry
  handler/renderer/layout/receipt bundle under `supabase/functions/`.

Validation: 23 automated tests passed under Node 22, including mocked Brevo
payloads for both deletion source sets. All seven preview types rendered at
1000px and 390px viewport widths with loaded local logos, visible support/privacy
links, and no horizontal overflow. Representative code, link, and receipt
screenshots were visually inspected. `git diff --check` and shell syntax checks
passed. These browser previews do not emulate inbox-specific rendering.
