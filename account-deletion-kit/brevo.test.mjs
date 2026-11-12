import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const paths = ['./brevo.ts'];
const localBundle = '../supabase/functions/_shared/brevo.ts';
if (existsSync(new URL(localBundle, import.meta.url))) paths.push(localBundle);
for (const path of paths) {
  test(`${path}: deletion notices use support identity and preserve real action links`, async () => {
    const previousDeno = globalThis.Deno;
    const previousFetch = globalThis.fetch;
    const calls = [];
    globalThis.Deno = { env: { get: key => ({ BREVO_API_KEY: 'test-only-key', FROM_EMAIL: 'support@fineascent.org' })[key] } };
    globalThis.fetch = async (url, init) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      return Response.json({ messageId: 'test-only-receipt' }, { status: 201 });
    };
    try {
      const { sendConfirmationEmail, sendFarewellEmail } = await import(path);
      const link = 'https://fineascent.org/noblecart/delete-account/confirm/?token_hash=real-runtime-value&type=magiclink';
      assert.equal((await sendConfirmationEmail('customer@example.invalid', link)).ok, true);
      assert.equal((await sendFarewellEmail('customer@example.invalid', '<Alex>')).ok, true);
      assert.equal(calls.length, 2);
      for (const call of calls) {
        assert.equal(call.url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(call.body.sender.email, 'support@fineascent.org');
        assert.deepEqual(call.body.replyTo, call.body.sender);
        assert.equal(call.body.to[0].email, 'customer@example.invalid');
        assert.ok(call.body.htmlContent.includes('mailto:support@fineascent.org'));
        assert.ok(call.body.htmlContent.includes('alt="NobleCart"'));
        assert.ok(call.body.htmlContent.includes('alt="FineAscent mountain"'));
        assert.ok(call.body.textContent.includes('support@fineascent.org'));
        assert.ok(!call.body.htmlContent.includes('test-only-key'));
      }
      assert.ok(calls[0].body.htmlContent.includes(link.replaceAll('&', '&amp;')));
      assert.ok(calls[0].body.textContent.includes(link));
      assert.ok(calls[1].body.htmlContent.includes('&lt;Alex&gt;'));
      assert.ok(!calls[1].body.htmlContent.includes('Permanently delete my account'));
    } finally {
      globalThis.fetch = previousFetch;
      if (previousDeno === undefined) delete globalThis.Deno;
      else globalThis.Deno = previousDeno;
    }
  });
}
