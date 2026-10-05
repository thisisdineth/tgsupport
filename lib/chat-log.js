import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_LOG_PATH = '/tmp/apilageai-chat-log.json';

export function createChatLog({ env = process.env, filePath = env.CHAT_LOG_PATH || DEFAULT_LOG_PATH } = {}) {
  return {
    async read() {
      try {
        const text = await readFile(filePath, 'utf8');
        const json = JSON.parse(text);
        return Array.isArray(json) ? json : [];
      } catch {
        return [];
      }
    },
    async append(entry) {
      const nextEntry = {
        id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        channel: entry.channel || 'whatsapp',
        from: entry.from || 'unknown',
        incoming: entry.incoming || '',
        reply: entry.reply || '',
        escalatedToHuman: Boolean(entry.escalatedToHuman),
        createdAt: entry.createdAt || new Date().toISOString(),
      };

      const existing = await this.read();
      const updated = [...existing, nextEntry].slice(-500);

      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(updated, null, 2));
      return nextEntry;
    },
  };
}

export const chatLog = createChatLog();
