import { renderEmail, SUPPORT_EMAIL } from './email-template.mjs';

const INBOX = 'fineascentcreative@gmail.com';
const ORIGINS = new Set(['https://fineascent.org', 'https://www.fineascent.org', 'http://localhost:8765', 'http://127.0.0.1:8765']);
const INTERESTS = new Set(['Bring NobleCart to our stores', 'Explore a business partnership', 'Discuss another opportunity']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s<>"(),:;\\]+@[^\s<>"(),:;\\]+\.[^\s<>"(),:;\\]+$/;

export function validateInquiry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid inquiry');
  const read = (key, max, multiline = false) => {
    if (typeof input[key] !== 'string') throw new Error('Missing field');
    const value = input[key].trim();
    if (!value || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
      || (!multiline && /[\r\n]/.test(value))) throw new Error('Invalid field');
    return value;
  };
  const result = {
    requestId: read('requestId', 36), name: read('name', 100), email: read('email', 254).toLowerCase(),
    company: read('company', 160), interest: read('interest', 80), message: read('message', 2400, true),
  };
  if (!UUID.test(result.requestId) || !EMAIL.test(result.email) || !INTERESTS.has(result.interest)) throw new Error('Invalid inquiry');
  return result;
}

export function buildEmailBatch(data, senderEmail = SUPPORT_EMAIL, previewOptions = {}) {
  const internal = renderEmail({
    title: 'A new conversation.', preview: 'A business inquiry for NobleCart.',
    paragraphs: [`Name: ${data.name}`, `Work email: ${data.email}`, `Company: ${data.company}`,
      `Interest: ${data.interest}`, 'Message:', ...data.message.split(/\r?\n/).filter(Boolean)],
    note: 'Contact the visitor using the work email listed above.',
  }, previewOptions);
  // A fixed acknowledgment avoids reflecting arbitrary visitor content to another inbox.
  const acknowledgment = renderEmail({
    title: 'A good place to begin.', preview: 'Your NobleCart inquiry has been received.',
    paragraphs: ['Thank you for reaching out.', 'Our team will review your inquiry and reply to your email.'],
    note: 'NobleCart by FineAscent. A team working alongside yours.',
  }, previewOptions);
  return {
    sender: { name: 'NobleCart', email: senderEmail },
    replyTo: { name: 'NobleCart', email: senderEmail },
    headers: { idempotencyKey: data.requestId },
    subject: 'Your NobleCart inquiry', htmlContent: acknowledgment.html, textContent: acknowledgment.text,
    messageVersions: [
      { to: [{ email: INBOX, name: 'FineAscent' }], replyTo: { email: senderEmail, name: 'NobleCart' },
        subject: `NobleCart inquiry — ${data.company}`, htmlContent: internal.html, textContent: internal.text },
      { to: [{ email: data.email }], replyTo: { email: senderEmail, name: 'NobleCart' },
        subject: 'We’ve received your NobleCart inquiry', htmlContent: acknowledgment.html, textContent: acknowledgment.text },
    ],
  };
}

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > 16384) throw new Error('Too large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) { await reader.cancel(); throw new Error('Too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createHandler({ env, fetchImpl = fetch, cryptoImpl = crypto, log = console.error }) {
  return async request => {
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (ORIGINS.has(origin)) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    });
    const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
    if (!ORIGINS.has(origin)) return json(403, { ok: false, error: 'origin' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json(405, { ok: false }, { Allow: 'POST, OPTIONS' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { ok: false });
    let input, data;
    try {
      input = await readBody(request);
      if (typeof input?.website === 'string' && input.website.trim()) return json(200, { ok: true });
      data = validateInquiry(input);
    } catch { return json(400, { ok: false, error: 'validation' }); }
    const apiKey = env('BREVO_API_KEY');
    const dbUrl = env('SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const salt = env('IP_HASH_SALT');
    if (!apiKey || !dbUrl || !serviceKey || !salt) return json(503, { ok: false, error: 'unavailable' });
    const dbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
    const hash = async text => Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
    const dbFetch = (path, options) => fetchImpl(`${dbUrl}/rest/v1/${path}`, { ...options, headers: dbHeaders, signal: AbortSignal.timeout(10000) });
    let reserved = false;
    try {
      const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      const { requestId, ...payload } = data;
      const claim = await dbFetch('rpc/claim_business_inquiry', { method: 'POST', body: JSON.stringify({
        p_id: requestId, p_payload_hash: await hash(JSON.stringify(payload)),
        p_ip_hash: await hash(salt + ':ip:' + ip), p_email_hash: await hash(salt + ':email:' + data.email),
      }) });
      if (!claim.ok) throw new Error('Reservation unavailable');
      const state = await claim.json();
      if (state === 'duplicate') return json(200, { ok: true });
      if (state === 'limited') return json(429, { ok: false, error: 'rate_limit' }, { 'Retry-After': '3600' });
      if (state === 'busy') return json(409, { ok: false, error: 'sending' }, { 'Retry-After': '60' });
      if (state === 'expired' || state === 'mismatch') return json(409, { ok: false, error: 'expired' });
      if (state !== 'claimed') throw new Error('Unexpected reservation state');
      reserved = true;
      const result = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(buildEmailBatch(data, (env('FROM_EMAIL') || SUPPORT_EMAIL).trim())), signal: AbortSignal.timeout(15000),
      });
      const receipt = await result.json().catch(() => ({}));
      const duplicate = receipt.code === 'duplicate_parameter' && /idempotency/i.test(receipt.message || '');
      if (!result.ok && !duplicate) throw new Error(`Email provider status ${result.status}`);
      if (result.ok && (!Array.isArray(receipt.messageIds) || receipt.messageIds.length !== 2)) throw new Error('Missing provider receipt');
      const saved = await dbFetch(`business_inquiry_delivery?id=eq.${data.requestId}`, { method: 'PATCH', body: JSON.stringify({ state: 'sent' }) });
      if (!saved.ok) log('business-inquiry: receipt metadata update failed');
      return json(200, { ok: true });
    } catch (error) {
      // Never log visitor data, provider bodies, API keys, or database credentials.
      log('business-inquiry: delivery unavailable', error instanceof Error ? error.message : 'unknown error');
      if (reserved) {
        try { await dbFetch(`business_inquiry_delivery?id=eq.${data.requestId}`, { method: 'PATCH', body: JSON.stringify({ state: 'failed' }) }); } catch { /* Same provider idempotency key protects retry. */ }
      }
      return json(503, { ok: false, error: 'unavailable' });
    }
  };
}
