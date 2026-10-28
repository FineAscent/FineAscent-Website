/** Shared, dependency-free HTML and plain-text templates for transactional email. */
const BRAND = {
  name: 'NobleCart',
  website: 'https://fineascent.org/nobelcart.html',
  privacy: 'https://fineascent.org/noblecart/privacy-policy/',
  support: 'mailto:fineascentcreative@gmail.com',
  mountain: 'https://fineascent.org/images/logo2.png',
  wordmark: 'https://raw.githubusercontent.com/FineAscent/FineAscent-Website/d81c1579aa11e6986029ead9a7dc590c222abbfe/images/noblecart-wordmark-black.png',
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
  const codeHtml = content.code ? `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 28px;">
    <tr><td align="center" bgcolor="#e3e3e3" style="padding:22px 12px;background-color:#e3e3e3;border-radius:6px;color:#303030;font-family:${FONT};font-size:32px;line-height:40px;letter-spacing:6px;">${escapeHtml(content.code)}</td></tr>
    </table>` : '';
  const fallbackHtml = action ? `<p style="margin:24px 0 8px;color:#777777;font-family:${FONT};font-size:12px;line-height:19px;">If the button does not work, copy this link into your browser:</p>
    <p style="margin:0;color:#666666;font-family:${FONT};font-size:12px;line-height:19px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapeHtml(action.url)}" style="color:#666666;text-decoration:underline;word-break:break-all;">${escapeHtml(action.url)}</a></p>` : '';
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${escapeHtml(content.title)} · ${BRAND.name}</title>
  <style>
    :root { color-scheme:light only; supported-color-schemes:light only; }
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    @media only screen and (min-width:621px) {
      .email-outer { padding:48px 20px !important; }
      .email-inner { padding:0 48px 44px !important; }
      .email-header { padding:0 24px 0 48px !important; }
      .email-brand { padding-top:44px !important; padding-bottom:32px !important; }
      .email-title { font-size:30px !important; line-height:38px !important; }
    }
    @media only screen and (max-width:620px) {
      .email-outer { padding:20px 12px !important; }
      .email-inner { padding:0 24px 32px !important; }
      .email-header { padding:0 20px 0 24px !important; }
      .email-brand { padding-top:32px !important; padding-bottom:28px !important; }
      .email-title { font-size:27px !important; line-height:34px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#e3e3e3;color-scheme:light only;">
  <div style="display:none;font-size:1px;color:#e3e3e3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preview)}</div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#e3e3e3" style="width:100%;background-color:#e3e3e3;">
    <tr><td class="email-outer" align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f2f2f2" style="width:100%;max-width:600px;background-color:#f2f2f2;border-radius:8px;">
        <tr><td class="email-header" style="padding:0 20px 0 24px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
            <tr>
              <td class="email-brand" valign="top" style="padding:32px 16px 28px 0;">
                <a href="${BRAND.website}" style="display:block;color:#202020;font-family:${FONT};font-size:24px;line-height:25px;text-decoration:none;">
                  <img src="${escapeHtml(wordmarkUrl)}" width="147" height="25" alt="NobleCart" style="display:block;width:147px;height:25px;border:0;outline:none;color:#202020;font-family:${FONT};font-size:24px;line-height:25px;">
                </a>
                <p style="margin:8px 0 0;color:#777777;font-family:${FONT};font-size:12px;line-height:18px;">By FineAscent</p>
              </td>
              <td width="44" valign="top" align="right" style="width:44px;padding:24px 0 0;">
                <a href="https://fineascent.org/" aria-label="FineAscent" style="display:block;text-decoration:none;">
                  <img src="${escapeHtml(logoUrl)}" width="40" height="36" alt="FineAscent mountain" style="display:block;width:40px;height:36px;border:0;outline:none;color:#555555;font-family:${FONT};font-size:10px;line-height:14px;">
                </a>
              </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="email-inner" style="padding:0 24px 32px;">
          <h1 class="email-title" style="margin:0 0 24px;color:#303030;font-family:${FONT};font-size:27px;font-weight:400;letter-spacing:-0.7px;line-height:34px;">${escapeHtml(content.title)}</h1>
          ${paragraphs}
          ${actionHtml}
          ${codeHtml}
          ${secondaryAction ? `<p style="margin:0 0 24px;font-family:${FONT};font-size:14px;line-height:23px;"><a href="${escapeHtml(secondaryAction.url)}" style="color:#555555;text-decoration:underline;">${escapeHtml(secondaryAction.label)}</a></p>` : ''}
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
