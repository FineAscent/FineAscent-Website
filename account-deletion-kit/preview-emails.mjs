/** Run locally with Node; creates HTML previews without sending any email. */
import { writeFile } from 'node:fs/promises';
import { renderConfirmationEmail, renderFarewellEmail } from './email-template.mjs';

// Reserved invalid domain: the preview can never trigger a real account deletion.
const link = 'https://example.invalid/delete-account/confirm?token_hash=preview-only&type=magiclink';
const previewOptions = { logoUrl: '../../images/logo2.png', wordmarkUrl: '../../images/noblecart-wordmark-black.png' };
const messages = {
  'email-confirmation-preview': renderConfirmationEmail(link, previewOptions),
  'email-deleted-preview': renderFarewellEmail('Alex', previewOptions),
};
for (const [name, content] of Object.entries(messages)) {
  await writeFile(new URL(`./web/${name}.html`, import.meta.url), content.html);
  await writeFile(new URL(`./web/${name}.txt`, import.meta.url), content.text);
}
console.log('Updated local HTML/text previews. No emails sent. Open account-deletion-kit/web/email-preview.html.');
