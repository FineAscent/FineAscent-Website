/** Run locally with Node; creates HTML previews without sending any email. */
import { mkdir, writeFile } from 'node:fs/promises';
import { renderConfirmationEmail, renderFarewellEmail, renderVerificationEmail, renderSupabaseVerificationTemplate } from './email-template.mjs';

// Reserved invalid domain: the preview can never trigger a real account deletion.
const link = 'https://example.invalid/delete-account/confirm?token_hash=preview-only&type=magiclink';
const previewOptions = { logoUrl: '../../images/logo2.png', wordmarkUrl: '../../images/noblecart-wordmark-black.png' };
const messages = {
  'email-confirmation-preview': renderConfirmationEmail(link, previewOptions),
  'email-deleted-preview': renderFarewellEmail('Alex', previewOptions),
  'email-verification-link-preview': renderVerificationEmail({ link: 'https://example.invalid/verify-email?token=preview-only' }, previewOptions),
  'email-verification-code-preview': renderVerificationEmail({ code: '482619', fallbackLink: 'https://example.invalid/verify-email?token=preview-only' }, previewOptions),
};
for (const [name, content] of Object.entries(messages)) {
  await writeFile(new URL(`./web/${name}.html`, import.meta.url), content.html);
  await writeFile(new URL(`./web/${name}.txt`, import.meta.url), content.text);
}
await mkdir(new URL('./auth-email-templates/', import.meta.url), { recursive: true });
for (const mode of ['link', 'code']) {
  const message = renderSupabaseVerificationTemplate(mode);
  await writeFile(new URL(`./auth-email-templates/confirm-signup-${mode}.html`, import.meta.url), message.html);
  await writeFile(new URL(`./auth-email-templates/confirm-signup-${mode}.txt`, import.meta.url), message.text);
}
console.log('Updated local HTML/text previews. No emails sent. Open account-deletion-kit/web/email-preview.html.');
