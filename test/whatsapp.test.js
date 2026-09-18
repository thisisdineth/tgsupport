import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';
import { conversationKey } from '../lib/memory.js';
import { createHandler } from '../api/whatsapp.js';

const env = { WHATSAPP_VERIFY_TOKEN: 'verify', WHATSAPP_APP_SECRET: 'secret', WHATSAPP_ACCESS_TOKEN: 'token', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_API_VERSION: 'v25.0' };
const payload = (messages, phone = '123') => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: phone }, messages } }] }] });
const message = { id: 'wamid.test', from: '94770000000', type: 'text', text: { body: 'Login help' } };
async function run(body, options = {}) {
  const raw = options.raw ?? JSON.stringify(body);
  const req = Readable.from([Buffer.from(raw)]);
  req.method = options.method || 'POST';
  req.url = options.url || '/api/whatsapp';
  req.headers = { 'x-hub-signature-256': options.signature ?? `sha256=${createHmac('sha256', env.WHATSAPP_APP_SECRET).update(raw).digest('hex')}` };
  const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; }, send(data) { this.data = data; } };
  const sent = [], prompts = [], keys = [];
  await createHandler({ env: options.env || env, reply: async (text, key) => { prompts.push(text); keys.push(key); if (options.aiFailure) throw Error('failed'); return options.answer || 'Hello'; }, request: async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: !options.sendFailure, status: 503 }; } })(req, res);
  return { ...res, sent, prompts, keys };
}
test('verification challenge and invalid token', async () => {
  assert.equal((await run({}, { method: 'GET', url: '/api/whatsapp?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=123' })).data, '123');
  assert.equal((await run({}, { method: 'GET' })).code, 403);
});
test('invalid signatures rejected before Gemini', async () => {
  const result = await run(payload([message]), { signature: 'sha256=bad' });
  assert.equal(result.code, 401); assert.equal(result.prompts.length, 0);
});
test('signed raw JSON handled and reply routed to sender', async () => {
  const result = await run(payload([message]), { raw: JSON.stringify(payload([message]), null, 2) });
  assert.equal(result.code, 200); assert.deepEqual(result.prompts, ['Login help']);
  assert.equal(result.keys[0], conversationKey('whatsapp', '123', message.from));
  assert.equal(result.sent[0].body.to, message.from);
  assert.equal(result.sent[0].body.context.message_id, message.id);
});
test('statuses and other phone numbers ignored', async () => {
  for (const body of [payload(undefined), payload([message], '456')]) {
    const result = await run(body); assert.equal(result.code, 200); assert.equal(result.sent.length, 0);
  }
});
test('all batched messages and long replies handled', async () => {
  const result = await run(payload([message, { ...message, id: 'two' }]), { answer: 'a'.repeat(4500) });
  assert.equal(result.sent.length, 4); assert.equal(result.sent[0].body.text.body.length, 4000);
});
test('non-text messages get guidance without Gemini', async () => {
  const result = await run(payload([{ ...message, type: 'image' }]));
  assert.equal(result.prompts.length, 0); assert.match(result.sent[0].body.text.body, /text message/);
});
test('Gemini errors send fallback; delivery failures request retry', async () => {
  assert.equal((await run(payload([message]), { aiFailure: true })).code, 200);
  assert.equal((await run(payload([message]), { sendFailure: true })).code, 500);
});
test('malformed JSON and missing secret fail closed', async () => {
  assert.equal((await run({}, { raw: '{' })).code, 400);
  assert.equal((await run({}, { env: {} })).code, 503);
});
