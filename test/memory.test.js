import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemory, conversationKey } from '../lib/memory.js';
import { createReply } from '../lib/support.js';
import { SYSTEM } from '../lib/knowledge.js';

test('support system restricts answers to official ApilageAI websites only', () => {
  assert.match(SYSTEM, /apilageai\.lk/i);
  assert.match(SYSTEM, /apilageai\.dev/i);
  assert.match(SYSTEM, /only.*official.*website|outside knowledge|do not use outside knowledge/i);
});

test('follow-up includes only the last five customer messages and replies', async () => {
  const store = createMemory({ env: {} });
  let captured;
  const reply = createReply({ store, generate: async params => { captured = params; return { text: 'answer' }; } });
  for (let i = 0; i < 7; i++) await reply(`question ${i}`, 'chat');
  assert.equal(captured.contents.length, 11);
  assert.equal(captured.contents[0].parts[0].text, 'question 1');
  assert.equal(captured.contents[1].role, 'model');
  assert.equal(captured.contents.at(-1).parts[0].text, 'question 6');
  assert.equal((await store.read('chat')).length, 5);
});
test('users, platforms and business accounts have separate memory', async () => {
  const store = createMemory({ env: {} });
  const a = conversationKey('telegram', 'business', 'user1');
  await store.append(a, 'private question', 'reply');
  for (const parts of [['telegram', 'business', 'user2'], ['whatsapp', 'business', 'user1'], ['telegram', 'other', 'user1']]) {
    assert.deepEqual(await store.read(conversationKey(...parts)), []);
  }
});
test('temporary memory expires after 24 hours', async () => {
  let time = 0;
  const store = createMemory({ env: {}, now: () => time });
  await store.append('chat', 'hello', 'hi');
  time = 86400001;
  assert.deepEqual(await store.read('chat'), []);
});
test('Gemini failure and empty output do not enter memory', async () => {
  const store = createMemory({ env: {} });
  const failed = createReply({ store, generate: async () => { throw Error('failed'); } });
  await assert.rejects(failed('hello', 'chat'));
  await createReply({ store, generate: async () => ({}) })('hello', 'chat');
  assert.deepEqual(await store.read('chat'), []);
});
test('storage outage does not prevent support replies', async () => {
  const store = { read: async () => { throw Error('offline'); }, append: async () => { throw Error('offline'); } };
  assert.equal(await createReply({ store, generate: async () => ({ text: 'help' }) })('hello', 'chat'), 'help');
});
test('Redis history works across instances and appends atomically with retention', async () => {
  const commands = [];
  const env = { UPSTASH_REDIS_REST_URL: 'https://example.test', UPSTASH_REDIS_REST_TOKEN: 'test' };
  const request = async (url, init) => {
    const body = JSON.parse(init.body); commands.push({ url, body });
    return { ok: true, json: async () => url.endsWith('/multi-exec') ? [{result:1},{result:'OK'},{result:1}] : {result:[JSON.stringify({user:'hello',model:'hi'})]} };
  };
  await createMemory({env,request}).append('chat', 'hello', 'hi');
  assert.deepEqual(await createMemory({env,request}).read('chat'), [{user:'hello',model:'hi'}]);
  assert.equal(commands[0].url, 'https://example.test/multi-exec');
  assert.deepEqual(commands[0].body.slice(1), [['LTRIM','chat',-5,-1],['EXPIRE','chat',86400]]);
});
