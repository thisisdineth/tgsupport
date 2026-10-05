import { chatLog } from '../lib/chat-log.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  const chats = await chatLog.read();
  return res.status(200).json({ ok: true, chats: chats.slice().reverse() });
}
