/** Shared, dependency-free HTML and plain-text templates for transactional email. */
const BRAND = {
  name: 'NobleCart',
  website: 'https://fineascent.org/nobelcart.html',
  privacy: 'https://fineascent.org/noblecart/privacy-policy/',
  support: 'mailto:fineascentcreative@gmail.com',
  mountain: 'https://fineascent.org/images/logo2.png',
  wordmark: 'https://fineascent.org/images/noblecart-wordmark-black.png',
};
const FONT = 'Arial, Helvetica, sans-serif';

export function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function actionUrl(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Email action must be an HTTP(S) URL');
  return url.href;
}

/**
 * All copy is plain text and escaped here; callers never supply arbitrary HTML.
 * @param {{title: string, preview: string, paragraphs: string[], note: string,
 * action?: {label: string, url: string}}} content
 * @param {{logoUrl?: string, wordmarkUrl?: string}} [options] Override image URLs for local previews.
 */
export function renderEmail(content, { logoUrl = BRAND.mountain, wordmarkUrl = BRAND.wordmark } = {}) {
  const action = content.action ? { ...content.action, url: actionUrl(content.action.url) } : null;
  const paragraphs = content.paragraphs.map(p => `<p style="margin:0 0 20px;color:#444444;font-family:${FONT};font-size:17px;line-height:27px;">${escapeHtml(p)}</p>`).join('\n');
  const actionHtml = action ? `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;mso-table-lspace:0pt;mso-table-rspace:0pt;">
      <tr><td bgcolor="#333333" align="center" style="background-color:#333333;border-radius:6px;mso-padding-alt:16px 24px;">
        <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:16px 24px;border:1px solid #333333;border-radius:6px;background-color:#333333;color:#ffffff;text-decoration:none;font-family:${FONT};font-size:16px;font-weight:400;line-height:22px;mso-padding-alt:0;">${escapeHtml(action.label)}</a>
      </td></tr>
    </table>` : '';
  const fallbackHtml = action ? `<p style="margin:24px 0 8px;color:#777777;font-family:${FONT};font-size:12px;line-height:19px;">If the button does not work, copy this link into your browser:</p>
    <p style="margin:0;color:#666666;font-family:${FONT};font-size:12px;line-height:19px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapeHtml(action.url)}" style="color:#666666;text-decoration:underline;word-break:break-all;">${escapeHtml(action.url)}</a></p>` : '';
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(content.title)} · ${BRAND.name}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (max-width:620px) {
      .email-outer { padding:20px 12px !important; }
      .email-inner { padding:0 24px 32px !important; }
      .email-header { padding:0 20px 0 24px !important; }
      .email-brand { padding-top:32px !important; padding-bottom:28px !important; }
      .email-title { font-size:27px !important; line-height:34px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#e3e3e3;">
  <div style="display:none;font-size:1px;color:#e3e3e3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preview)}</div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#e3e3e3" style="width:100%;background-color:#e3e3e3;">
    <tr><td class="email-outer" align="center" style="padding:48px 20px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f2f2f2" style="width:100%;max-width:600px;background-color:#f2f2f2;border-radius:8px;">
        <tr><td class="email-header" style="padding:0 24px 0 48px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
            <tr>
              <td class="email-brand" valign="top" style="padding:44px 16px 32px 0;">
                <a href="${BRAND.website}" style="display:block;color:#202020;font-family:${FONT};font-size:24px;line-height:25px;text-decoration:none;">
                  <img src="${escapeHtml(wordmarkUrl)}" width="147" height="25" alt="NobleCart" style="display:block;width:147px;height:25px;border:0;outline:none;color:#202020;font-family:${FONT};font-size:24px;line-height:25px;">
                </a>
                <p style="margin:8px 0 0;color:#777777;font-family:${FONT};font-size:12px;line-height:18px;">By FineAscent</p>
              </td>
              <td width="56" valign="top" align="right" style="width:56px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" bgcolor="#e3e3e3" style="background-color:#e3e3e3;border-radius:0 0 8px 8px;">
                  <tr><td align="center" style="padding:22px 6px 14px;">
                    <a href="https://fineascent.org/" aria-label="FineAscent" style="display:block;text-decoration:none;">
                      <img src="${escapeHtml(logoUrl)}" width="44" height="40" alt="FineAscent mountain" style="display:block;width:44px;height:40px;border:0;outline:none;color:#555555;font-family:${FONT};font-size:10px;line-height:14px;">
                    </a>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="email-inner" style="padding:0 48px 44px;">
          <h1 class="email-title" style="margin:0 0 24px;color:#303030;font-family:${FONT};font-size:30px;font-weight:400;letter-spacing:-0.7px;line-height:38px;">${escapeHtml(content.title)}</h1>
          ${paragraphs}
          ${actionHtml}
          <p style="margin:0;color:#666666;font-family:${FONT};font-size:14px;line-height:23px;">${escapeHtml(content.note)}</p>
          ${fallbackHtml}
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;margin-top:36px;border-top:1px solid #d8d8d8;">
            <tr><td style="padding-top:22px;color:#777777;font-family:${FONT};font-size:12px;line-height:21px;">
              NobleCart by FineAscent<br>
              <a href="${BRAND.support}" style="color:#666666;text-decoration:underline;">Contact support</a>
              <span style="color:#b0b0b0;">&nbsp; · &nbsp;</span>
              <a href="${BRAND.privacy}" style="color:#666666;text-decoration:underline;">Privacy policy</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`.replace(/^[ \t]+$/gm, '');
  const text = [BRAND.name + ' by FineAscent', content.title, ...content.paragraphs,
    ...(action ? [action.label + ':\n' + action.url] : []), content.note,
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
