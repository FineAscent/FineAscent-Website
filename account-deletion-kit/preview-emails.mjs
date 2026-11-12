/** Run locally with Node; creates HTML previews without sending any email. */
import { mkdir, writeFile } from 'node:fs/promises';
import { renderConfirmationEmail, renderFarewellEmail, renderVerificationEmail, renderSupabaseVerificationTemplate, renderReceiptEmail } from './email-template.mjs';
import { buildEmailBatch } from '../get-started/server/handler.mjs';

// Reserved invalid domain: the preview can never trigger a real account deletion.
const link = 'https://example.invalid/delete-account/confirm?token_hash=preview-only&type=magiclink';
const previewOptions = { logoUrl: '../../images/logo2.png', wordmarkUrl: '../../images/noblecart-wordmark-black.png' };
const inquiry = buildEmailBatch({ requestId: 'preview-only', name: 'Alex', email: 'alex@example.invalid',
  company: 'Example Grocery', interest: 'Bring NobleCart to our stores', message: 'Local design preview only.' }, undefined, previewOptions);
const messages = {
  'email-confirmation-preview': renderConfirmationEmail(link, previewOptions),
  'email-deleted-preview': renderFarewellEmail('Alex', previewOptions),
  'email-receipt-preview': renderReceiptEmail({ receiptId: 'PREVIEW-ONLY', timestamp: 'November 5, 2026', currency: 'USD', totalCents: 1123,
    items: [{ product_name: 'Organic apples', quantity: 2, unit_price_cents: 249, total_price_cents: 498 },
      { product_name: 'Whole grain bread', quantity: 1, unit_price_cents: 625, total_price_cents: 625 }] }, previewOptions),
  'email-inquiry-preview': { html: inquiry.messageVersions[1].htmlContent, text: inquiry.messageVersions[1].textContent },
  'email-inquiry-internal-preview': { html: inquiry.messageVersions[0].htmlContent, text: inquiry.messageVersions[0].textContent },
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
