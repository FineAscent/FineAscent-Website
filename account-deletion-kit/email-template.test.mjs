import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderEmail, renderConfirmationEmail, renderFarewellEmail, renderVerificationEmail, renderSupabaseVerificationTemplate, renderReceiptEmail } from './email-template.mjs';

const link = 'https://example.invalid/delete-account/confirm?token_hash=a%2Bb%2Fc%3D&type=magiclink';

test('confirmation keeps the signed URL intact in HTML and plain text', () => {
  const { html, text } = renderConfirmationEmail(link);
  const escaped = link.replaceAll('&', '&amp;');
  assert.ok(html.includes(`href="${escaped}"`));
  assert.ok(html.includes(`>${escaped}</a>`));
  assert.ok(text.includes(link));
  assert.match(html, /Permanently delete my account/);
  assert.match(text, /within one hour/);
  assert.match(text, /Your account is only deleted if the confirmation link is used/);
});

test('verification code is copyable text, with no confirmation or deletion action', () => {
  const message = renderVerificationEmail({ code: '482619' });
  assert.match(message.html, />482619<\/p>/);
  assert.ok(message.text.includes('482619'));
  assert.ok(!message.html.includes('Permanently delete'));
  assert.ok(!message.html.includes('If the button does not work'));
  assert.throws(() => renderVerificationEmail({}));
  assert.throws(() => renderVerificationEmail({ code: '123456', link }));
});

test('Supabase receives dynamic variables, never the preview code or link', async () => {
  const code = renderSupabaseVerificationTemplate('code');
  const signupLink = renderSupabaseVerificationTemplate('link');
  assert.match(code.html, />\{\{ \.Token \}\}<\/p>/);
  assert.ok(!code.html.includes('482619'));
  assert.ok(code.html.includes('href="{{ .ConfirmationURL }}"'));
  assert.ok(!code.html.includes('example.invalid'));
  assert.ok(signupLink.html.includes('href="{{ .ConfirmationURL }}"'));
  assert.ok(!signupLink.html.includes('example.invalid'));
  assert.throws(() => renderSupabaseVerificationTemplate('other'));
  for (const [mode, message] of [['code', code], ['link', signupLink]]) {
    assert.equal(await readFile(new URL(`./auth-email-templates/confirm-signup-${mode}.html`, import.meta.url), 'utf8'), message.html);
  }
});

test('personalized names are rendered as text, never markup', () => {
  const name = '<img src=x onerror="alert(1)"> & Sam';
  const { html, text } = renderFarewellEmail(name);
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /Hi &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; Sam/);
  assert.ok(text.includes(`Hi ${name},`));
  assert.match(renderFarewellEmail('').html, /Hi there,/);
  assert.ok(!html.includes('Permanently delete my account'));
});

test('rejects executable and non-web action links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', '/relative']) {
    assert.throws(() => renderConfirmationEmail(url));
  }
  assert.doesNotThrow(() => renderConfirmationEmail('http://localhost:8765/confirm'));
});

test('copy is escaped and the brand tag uses the original PNG with text fallback', () => {
  const { html } = renderEmail({ title: '<Title>', preview: '<Preview>', paragraphs: ['<script>no</script>'], note: '<Note>' });
  for (const text of ['&lt;Title&gt;', '&lt;Preview&gt;', '&lt;script&gt;no&lt;/script&gt;', '&lt;Note&gt;']) assert.ok(html.includes(text));
  assert.ok(!/<script\b|<link\b|<iframe\b/i.test(html));
  assert.match(html, /src="https:\/\/fineascent.org\/images\/logo2.png"/);
  assert.match(html, /alt="FineAscent mountain"/);
  assert.match(html, /src="https:\/\/raw.githubusercontent.com\/FineAscent\/FineAscent-Website\/d81c1579aa11e6986029ead9a7dc590c222abbfe\/images\/noblecart-wordmark-black.png"/);
  assert.match(html, /alt="NobleCart"/);
  assert.match(html, /max-width:600px/);
  assert.match(html, /\[if mso\]/);
  assert.match(html, /max-width:620px/);
  assert.match(html, /mailto:support@fineascent.org/);
});

test('saved previews use exactly the production template with a non-working example link', async () => {
  const options = { logoUrl: '../../images/logo2.png', wordmarkUrl: '../../images/noblecart-wordmark-black.png' };
  const confirmation = renderConfirmationEmail('https://example.invalid/delete-account/confirm?token_hash=preview-only&type=magiclink', options);
  const farewell = renderFarewellEmail('Alex', options);
  for (const [name, message] of [['confirmation', confirmation], ['deleted', farewell]]) {
    assert.equal(await readFile(new URL(`./web/email-${name}-preview.html`, import.meta.url), 'utf8'), message.html);
    assert.equal(await readFile(new URL(`./web/email-${name}-preview.txt`, import.meta.url), 'utf8'), message.text);
  }
});

test('every email has properly nested tables and the common support/privacy footer', () => {
  const messages = [renderConfirmationEmail(link), renderFarewellEmail('Alex'),
    renderVerificationEmail({ link }), renderVerificationEmail({ code: '009871' }),
    renderSupabaseVerificationTemplate('link'), renderSupabaseVerificationTemplate('code'),
    renderReceiptEmail({ items: [], totalCents: 0, receiptId: 'empty', timestamp: '2026-11-05' })];
  for (const { html, text } of messages) {
    // Outlook-only markup is a separate balanced wrapper, hidden from ordinary clients.
    const markup = html.replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    for (const match of markup.matchAll(/<(\/?)(table|thead|tbody|tfoot|tr|td|th)\b[^>]*>/g)) {
      if (match[1]) assert.equal(stack.pop(), match[2], `Unbalanced closing ${match[2]}`);
      else stack.push(match[2]);
    }
    assert.deepEqual(stack, []);
    assert.ok(html.includes('mailto:support@fineascent.org'));
    assert.ok(text.includes('Contact support: support@fineascent.org'));
    assert.ok(html.includes('https://fineascent.org/noblecart/privacy-policy/'));
    assert.ok(!html.includes('fineascentcreative@gmail.com'));
  }
});

test('real generated codes retain leading zeros and escape markup without a fabricated link', () => {
  const { html, text } = renderVerificationEmail({ code: '009871' });
  assert.ok(html.includes('>009871</p>'));
  assert.ok(text.includes('009871'));
  assert.ok(html.includes('VERIFICATION CODE'));
  assert.ok(!html.includes('{{ .Token }}'));
  assert.ok(!html.includes('example.invalid'));
  assert.ok(!html.includes('Verify email address</a>'));
  assert.ok(renderVerificationEmail({ code: '<script>1</script>' }).html.includes('&lt;script&gt;1&lt;/script&gt;'));
});

test('receipt preserves quantities, unit prices, totals, currency, and escaped customer values', () => {
  const { html, text } = renderReceiptEmail({
    receiptId: '<receipt>', timestamp: '<date>', currency: 'USD', totalCents: 1123,
    items: [{ product_name: '<img src=x> Apples', quantity: 2, unit_price_cents: 249, total_price_cents: 498 },
      { product_name: 'Bread', quantity: 1, unit_price_cents: 625, total_price_cents: 625 }],
  });
  for (const amount of ['$2.49', '$4.98', '$6.25', '$11.23']) {
    assert.ok(html.includes(amount));
    assert.ok(text.includes(amount));
  }
  assert.ok(html.includes('&lt;receipt&gt;'));
  assert.ok(html.includes('&lt;date&gt;'));
  assert.ok(html.includes('&lt;img src=x&gt; Apples'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(text.includes('Qty: 2'));
  assert.ok(text.includes('Currency: USD'));
});

test('inquiry bundle uses the same saved renderer and its dependencies', async () => {
  for (const name of ['email-template.mjs', 'email-layout.mjs', 'receipt-email.mjs']) {
    assert.equal(await readFile(new URL(`../get-started/server/${name}`, import.meta.url), 'utf8'),
      await readFile(new URL(`./${name}`, import.meta.url), 'utf8'));
  }
});
