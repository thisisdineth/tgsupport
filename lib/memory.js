import { createHash } from 'node:crypto';

export const HISTORY_LIMIT = 5; // Customer messages, each with its AI reply.
const TTL_SECONDS = 86400;

export function conversationKey(...parts) {
  return `apilageai:chat:${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}

export function createMemory({ env = process.env, request = fetch, now = Date.now } = {}) {
  const chats = new Map();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  async function command(body, path = '') {
    if (!url || !token) throw new Error('Both Redis REST variables are required');
    const response = await request(`${url.replace(/\/$/, '')}${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Memory storage request failed');
    const data = await response.json();
    if ((Array.isArray(data) ? data : [data]).some(item => item.error)) throw new Error('Memory storage command failed');
    return data;
  }
  function localHistory(key) {
    const item = chats.get(key);
    if (!item || item.expires <= now()) { chats.delete(key); return []; }
    return item.turns;
  }
  return {
    async read(key) {
      if (url || token) {
        const { result } = await command(['LRANGE', key, -HISTORY_LIMIT, -1]);
        return result.map(value => JSON.parse(value));
      }
      return structuredClone(localHistory(key));
    },
    async append(key, user, model) {
      const turn = { user, model };
      if (url || token) {
        await command([
          ['RPUSH', key, JSON.stringify(turn)],
          ['LTRIM', key, -HISTORY_LIMIT, -1],
          ['EXPIRE', key, TTL_SECONDS],
        ], '/multi-exec');
        return;
      }
      const turns = [...localHistory(key), turn].slice(-HISTORY_LIMIT);
      chats.delete(key);
      chats.set(key, { turns, expires: now() + TTL_SECONDS * 1000 });
      // Bound temporary memory usage even when many different customers write.
      while (chats.size > 1000) chats.delete(chats.keys().next().value);
    },
  };
}

export const memory = createMemory();
