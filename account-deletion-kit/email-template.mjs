/** Shared, dependency-free HTML and plain-text templates for transactional email. */
import { brandedEmailHtml, SUPPORT_EMAIL } from './email-layout.mjs';
import { receiptEmailHtml } from './receipt-email.mjs';
export { SUPPORT_EMAIL } from './email-layout.mjs';

const BRAND = {
  name: 'NobleCart',
  website: 'https://fineascent.org/nobelcart.html',
  privacy: 'https://fineascent.org/noblecart/privacy-policy/',
  support: 'mailto:' + SUPPORT_EMAIL,
  mountain: 'https://fineascent.org/images/logo2.png',
  wordmark: 'https://raw.githubusercontent.com/FineAscent/FineAscent-Website/d81c1579aa11e6986029ead9a7dc590c222abbfe/images/noblecart-wordmark-black.png',
};
const FONT = 'Arial, Helvetica, sans-serif';

export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function previewImages(html, { logoUrl = BRAND.mountain, wordmarkUrl = BRAND.wordmark } = {}) {
  return html.replaceAll(BRAND.mountain, escapeHtml(logoUrl))
    .replaceAll(BRAND.wordmark, escapeHtml(wordmarkUrl));
}

function actionUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Email action must be an HTTP(S) URL');
  return url.href;
}

/**
 * All copy is plain text and escaped here; callers never supply arbitrary HTML.
 * @param {{title: string, preview: string, paragraphs: string[], note: string,
 * action?: {label: string, url: string}, code?: string,
 * secondaryAction?: {label: string, url: string}}} content
 * @param {{logoUrl?: string, wordmarkUrl?: string}} [options] Override image URLs for local previews.
 */
export function renderEmail(content, { logoUrl = BRAND.mountain, wordmarkUrl = BRAND.wordmark } = {}) {
  if (content.code && content.action) throw new Error('Choose a verification code or an action link');
  const action = content.action ? { ...content.action, url: actionUrl(content.action.url) } : null;
  const secondaryAction = content.secondaryAction ? { ...content.secondaryAction, url: actionUrl(content.secondaryAction.url) } : null;
  const paragraphs = content.paragraphs.map(p => `<p style="margin:0 0 20px;color:#444444;font-family:${FONT};font-size:17px;line-height:27px;">${escapeHtml(p)}</p>`).join('\n');
  const actionHtml = action ? `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr><td bgcolor="#333333" align="center" style="background-color:#333333;border-radius:6px;mso-padding-alt:16px 24px;">
        <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:16px 24px;border:1px solid #333333;border-radius:6px;background-color:#333333;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:16px;font-weight:400;line-height:22px;mso-padding-alt:0;">${escapeHtml(action.label)}</a>
      </td></tr>
    </table>` : '';
  const codeHtml = content.code ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px;">
    <tr><td align="center" bgcolor="#ffffff" style="padding:22px 12px;background-color:#ffffff;border:1px solid #d8d8d8;border-radius:6px;">
      <p style="margin:0 0 10px;color:#777777;font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:1.5px;">VERIFICATION CODE</p>
      <p style="margin:0;color:#303030;font-family:${FONT};font-size:34px;font-weight:600;line-height:44px;letter-spacing:6px;">${escapeHtml(content.code)}</p>
    </td></tr>
    </table>` : '';
  const fallbackHtml = action ? `<p style="margin:24px 0 8px;color:#777777;font-family:${FONT};font-size:12px;line-height:19px;">If the button does not work, copy this link into your browser:</p>
    <p style="margin:0;color:#666666;font-family:${FONT};font-size:12px;line-height:19px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapeHtml(action.url)}" style="color:#666666;text-decoration:underline;word-break:break-all;">${escapeHtml(action.url)}</a></p>` : '';
  const html = previewImages(brandedEmailHtml({
    title: content.title, preheader: content.preview,
    contentHtml: `          <h1 class="email-title" style="margin:0 0 24px;color:#303030;font-family:${FONT};font-size:27px;font-weight:400;letter-spacing:-0.7px;line-height:34px;">${escapeHtml(content.title)}</h1>
          ${paragraphs}
          ${actionHtml}
          ${codeHtml}
          ${secondaryAction ? `<p style="margin:0 0 24px;font-family:${FONT};font-size:14px;line-height:23px;"><a href="${escapeHtml(secondaryAction.url)}" style="color:#555555;text-decoration:underline;">${escapeHtml(secondaryAction.label)}</a></p>` : ''}
          <p style="margin:0;color:#666666;font-family:${FONT};font-size:14px;line-height:23px;">${escapeHtml(content.note)}</p>
          ${fallbackHtml}
`.replace(/^[ \t]+$/gm, ''),
  }), { logoUrl, wordmarkUrl });
  const text = [BRAND.name + ' by FineAscent', content.title, ...content.paragraphs,
    ...(content.code ? [content.code] : []),
    ...(action ? [action.label + ':\n' + action.url] : []), content.note,
    ...(secondaryAction ? [secondaryAction.label + ':\n' + secondaryAction.url] : []),
    'Contact support: ' + BRAND.support.replace('mailto:', ''), 'Privacy: ' + BRAND.privacy].join('\n\n');
  return { html, text };
}

export function renderConfirmationEmail(link, options = {}) {
  return renderEmail({
    title: 'Confirm account deletion',
    preview: 'Confirm your request to permanently delete your NobleCart account. This link expires in one hour.',
    paragraphs: [
      'We received a request to permanently delete your NobleCart account.',
      'This cannot be undone. If you want to go ahead, confirm within one hour using the button below.',
    ],
    action: { label: 'Permanently delete my account', url: link },
    note: 'If you did not request this, ignore this email. Your account is only deleted if the confirmation link is used.',
  }, options);
}

export function renderFarewellEmail(name, options = {}) {
  return renderEmail({
    title: 'Your account has been deleted',
    preview: 'Confirmation of your NobleCart account deletion.',
    paragraphs: [
      `Hi ${name || 'there'},`,
      'Your account and the data attached to it have been permanently deleted.',
      'You will not receive any further email from us.',
    ],
    note: 'If you did not request this, contact support immediately using the link below.',
  }, options);
}

/** Verification design: use the method already supported by the NobleCart app. */
export function renderVerificationEmail({ link, code, fallbackLink }, options = {}) {
  if (Boolean(link) === Boolean(code)) throw new Error('Provide exactly one verification link or code');
  return renderEmail({
    title: 'Verify your email',
    preview: 'Confirm your email address to finish setting up NobleCart.',
    paragraphs: [
      'Welcome to NobleCart.',
      code ? 'Enter this verification code in the app to confirm your email address.'
        : 'Confirm your email address to finish setting up your account.',
    ],
    ...(code ? { code } : { action: { label: 'Verify email address', url: link } }),
    ...(code && fallbackLink ? { secondaryAction: { label: 'Or confirm your email using this link', url: fallbackLink } } : {}),
    note: code ? 'Keep this code private. If you did not request this email, you can ignore it.'
      : 'If you did not create a NobleCart account, you can ignore this email.',
  }, options);
}

/** Supabase substitutes these Go-template variables when it sends the email. */
export function renderSupabaseVerificationTemplate(mode) {
  const marker = 'https://example.invalid/supabase-confirmation-url';
  if (!['code', 'link'].includes(mode)) throw new Error('Verification mode must be link or code');
  const message = mode === 'code'
    ? renderVerificationEmail({ code: '{{ .Token }}', fallbackLink: marker })
    : renderVerificationEmail({ link: marker });
  return {
    html: message.html.replaceAll(marker, '{{ .ConfirmationURL }}'),
    text: message.text.replaceAll(marker, '{{ .ConfirmationURL }}'),
  };
}

/** Receipt HTML stays identical to the approved application renderer. */
export function renderReceiptEmail(receipt, options = {}) {
  const currency = (receipt.currency || 'USD').toUpperCase();
  const money = cents => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100); }
    catch { return `${currency} ${(cents / 100).toFixed(2)}`; }
  };
  const lines = receipt.items.map(item => {
    const qty = Number(item.quantity || item.qty || 1) || 1;
    const unit = Number(item.unit_price_cents || item.amount_cents / qty || 0);
    const total = Number(item.total_price_cents || item.amount_cents || 0);
    return `${item.product_name || item.name || item.description || 'Item'} — Qty: ${qty}; Unit price: ${money(unit)}; Total: ${money(total)}`;
  });
  return {
    html: previewImages(receiptEmailHtml(receipt), options),
    text: ['NobleCart by FineAscent', 'Thank you for your purchase',
      'We’ve received your payment. Here’s a summary of your order.',
      `Receipt: ${receipt.receiptId || ''}`, `Date: ${receipt.timestamp}`, `Currency: ${currency}`,
      ...lines, `Total amount: ${money(receipt.totalCents)}`, 'Keep this email for your records.',
      `Contact support: ${SUPPORT_EMAIL}`, `Privacy: ${BRAND.privacy}`].join('\n\n'),
  };
}
