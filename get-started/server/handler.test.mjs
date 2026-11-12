import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { buildEmailBatch, createHandler, validateInquiry } from './handler.mjs';

const payload = { requestId: 'c755133c-e224-4e2a-917b-d18d372ea5cd', name: 'Test Person', email: 'retail+test@example.invalid', company: 'Test & Co', interest: 'Bring NobleCart to our stores', message: 'Line one\nLine two', website: '' };
const request = (body = payload, origin = 'https://fineascent.org', method = 'POST') => new Request('https://example.invalid/inquiry', {method, headers: {origin, 'Content-Type':'application/json'}, ...(method === 'POST' ? {body: JSON.stringify(body)} : {})});
function fixture({claim = 'claimed', providerStatus = 201, receipt = {messageIds:['one','two']}} = {}) {
  const calls = [];
  const handler = createHandler({cryptoImpl: webcrypto, log() {}, env: key => ({BREVO_API_KEY:'fake-provider-key', SUPABASE_URL:'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY:'fake-service-key', IP_HASH_SALT:'fake-salt'})[key], fetchImpl: async (url, options) => {
    calls.push({url, options});
    if (url.includes('/rpc/')) return Response.json(claim);
    if (url.includes('/business_inquiry_delivery?')) return new Response(null,{status:204});
    return Response.json(receipt,{status:providerStatus});
  }});
  return {handler,calls};
}
test('validates fields and rejects header injection and oversized messages', () => {
  assert.equal(validateInquiry(payload).email,payload.email);
  for (const changes of [{email:'victim@example.com\r\nBcc: other@example.com'}, {company:'Company\nInjected'}, {requestId:'bad'}, {interest:'arbitrary'}, {message:'x'.repeat(2401)}, {name:'\u0000bad'}]) {
    assert.throws(() => validateInquiry({...payload,...changes}));
  }
});
test('inbox recipient stays fixed, From and Reply-To use support, and HTML is escaped', () => {
  const batch = buildEmailBatch({...payload,company:'<img src=x onerror=alert(1)>',message:'<script>bad</script>'});
  assert.equal(batch.messageVersions[0].to[0].email,'fineascentcreative@gmail.com');
  assert.equal(batch.sender.email,'support@fineascent.org');
  assert.equal(batch.replyTo.email,'support@fineascent.org');
  for (const message of batch.messageVersions) {
    assert.equal(message.replyTo.email,'support@fineascent.org');
    assert.ok(message.htmlContent.includes('mailto:support@fineascent.org'));
    assert.ok(message.textContent.includes('support@fineascent.org'));
  }
  assert.ok(batch.messageVersions[0].textContent.includes(payload.email));
  assert.equal(batch.messageVersions[1].to[0].email,payload.email);
  assert.ok(batch.messageVersions[0].htmlContent.includes('&lt;script&gt;'));
  assert.ok(!batch.messageVersions[0].htmlContent.includes('<script>'));
  assert.ok(!batch.messageVersions[1].htmlContent.includes(payload.message));
  assert.equal(batch.headers.idempotencyKey,payload.requestId);
});
test('rejects other origins, wrong methods, invalid JSON fields, and oversized bodies before provider access', async () => {
  const {handler,calls}=fixture();
  assert.equal((await handler(request(payload,'https://other.invalid'))).status,403);
  assert.equal((await handler(request(payload,undefined,'GET'))).status,405);
  assert.equal((await handler(request({...payload,email:'bad'}))).status,400);
  assert.equal((await handler(request({...payload,message:'x'.repeat(18000)}))).status,400);
  assert.equal(calls.length,0);
});
test('honeypot prevents any outbound email',async()=>{
  const {handler,calls}=fixture();
  assert.equal((await handler(request({...payload,website:'spam'}))).status,200);
  assert.equal(calls.length,0);
});
test('success requires a provider receipt, then marks reservation sent; hashes omit raw email and IP',async()=>{
  const {handler,calls}=fixture();
  const res=await handler(request());
  assert.deepEqual(await res.json(),{ok:true});
  assert.equal(calls.length,3);
  const sent = JSON.parse(calls[1].options.body);
  assert.equal(sent.sender.email, 'support@fineascent.org');
  assert.equal(sent.replyTo.email, 'support@fineascent.org');
  assert.ok(sent.messageVersions.every(message => message.replyTo.email === 'support@fineascent.org'));
  assert.equal(calls[2].options.body,JSON.stringify({state:'sent'}));
  assert.ok(!calls[0].options.body.includes(payload.email));
  assert.equal(JSON.parse(calls[0].options.body).p_email_hash.length,64);
});
test('rate limits and duplicate reservations never call provider',async()=>{
  for(const [claim,status] of [['limited',429],['duplicate',200],['busy',409],['mismatch',409],['expired',409]]) {
    const {handler,calls}=fixture({claim});
    assert.equal((await handler(request())).status,status);
    assert.equal(calls.length,1);
  }
});
test('provider failure reports failure and preserves the same idempotency key for retry',async()=>{
  const {handler,calls}=fixture({providerStatus:503,receipt:{code:'unavailable'}});
  assert.equal((await handler(request())).status,503);
  assert.equal(JSON.parse(calls[1].options.body).headers.idempotencyKey,payload.requestId);
  assert.equal(calls[2].options.body,JSON.stringify({state:'failed'}));
});
test('only a documented idempotency duplicate is considered an accepted retry',async()=>{
  const {handler}=fixture({providerStatus:400,receipt:{code:'duplicate_parameter',message:'An email with this idempotency key has already been sent'}});
  assert.equal((await handler(request())).status,200);
  const invalid=fixture({providerStatus:400,receipt:{code:'duplicate_parameter',message:'Other duplicate field'}});
  assert.equal((await invalid.handler(request())).status,503);
});
