import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderEmail, renderConfirmationEmail, renderFarewellEmail } from './email-template.mjs';

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
  assert.match(html, /src="https:\/\/fineascent.org\/images\/noblecart-wordmark-black.png"/);
  assert.match(html, /alt="NobleCart"/);
  assert.match(html, /max-width:600px/);
  assert.match(html, /\[if mso\]/);
  assert.match(html, /max-width:620px/);
  assert.match(html, /mailto:fineascentcreative@gmail.com/);
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
