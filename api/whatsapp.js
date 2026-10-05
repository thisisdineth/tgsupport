import { conversationKey } from "../lib/memory.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { generateReply } from "../lib/support.js";
import { chatLog } from "../lib/chat-log.js";
import { HUMAN_SUPPORT_NUMBER, buildEscalationMessage, normalizePhoneNumber, shouldEscalateToHuman } from "../lib/human-handoff.js";

// Signature verification must use the original bytes, not re-serialized JSON.
export const config = { api: { bodyParser: false } };

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) throw new Error("Payload too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function sendWhatsAppMessage({ request, env, to, body, contextMessageId = null }) {
  const response = await request(
    `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        ...(contextMessageId ? { context: { message_id: contextMessageId } } : {}),
        type: "text",
        text: { body },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error(`WhatsApp send failed (${response.status})`);
  return response;
}

export function createHandler({ reply = generateReply, request = fetch, env = process.env } = {}) {
  return async function handler(req, res) {
    if (req.method === "GET") {
      const query = new URL(req.url, "https://localhost").searchParams;
      if (env.WHATSAPP_VERIFY_TOKEN && query.get("hub.mode") === "subscribe" &&
          query.get("hub.verify_token") === env.WHATSAPP_VERIFY_TOKEN && query.has("hub.challenge")) {
        return res.status(200).send(query.get("hub.challenge"));
      }
      return res.status(403).json({ ok: false });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });
    if (!env.WHATSAPP_APP_SECRET) return res.status(503).json({ ok: false });

    let body;
    try { body = await readBody(req); }
    catch { return res.status(413).json({ ok: false }); }
    const signature = req.headers["x-hub-signature-256"];
    const expected = createHmac("sha256", env.WHATSAPP_APP_SECRET).update(body).digest();
    if (typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/i.test(signature) ||
        !timingSafeEqual(Buffer.from(signature.slice(7), "hex"), expected)) {
      return res.status(401).json({ ok: false });
    }
    let update;
    try { update = JSON.parse(body.toString("utf8")); }
    catch { return res.status(400).json({ ok: false }); }
    if (update?.object !== "whatsapp_business_account") return res.status(200).json({ ok: true });
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID ||
        !/^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION || "")) {
      return res.status(503).json({ ok: false });
    }

    try {
      for (const entry of update.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (change.field !== "messages" ||
              value?.metadata?.phone_number_id !== env.WHATSAPP_PHONE_NUMBER_ID) continue;
          // Delivery/read statuses have no messages. Outgoing echoes use a different field.
          for (const message of value.messages || []) {
            if (!message.from || !message.id) continue;
            const text = message.type === "text" ? message.text?.body?.trim() : "";
            const escalatedToHuman = Boolean(text && shouldEscalateToHuman(text));
            let answer;
            if (text) {
              if (escalatedToHuman) {
                answer = "Thanks for reaching out. I have forwarded your request to a real person and they will respond as soon as possible.";
              } else {
                try { answer = await reply(text, conversationKey("whatsapp", env.WHATSAPP_PHONE_NUMBER_ID, message.from)); }
                catch {
                  console.error("WhatsApp Gemini reply failed");
                  answer = "Sorry — I couldn't process that right now. Please try again shortly.";
                }
              }
            } else {
              answer = "Please send your question as a text message so I can help.";
            }
            for (const chunk of String(answer).match(/[\s\S]{1,4000}/gu) || []) {
              await sendWhatsAppMessage({
                request,
                env,
                to: message.from,
                body: chunk,
                contextMessageId: message.id,
              });
            }

            if (escalatedToHuman) {
              const staffMessage = buildEscalationMessage(message.from, text);
              await sendWhatsAppMessage({
                request,
                env,
                to: normalizePhoneNumber(HUMAN_SUPPORT_NUMBER),
                body: staffMessage,
              });
            }

            await chatLog.append({
              channel: 'whatsapp',
              from: message.from,
              incoming: text || '[non-text message]',
              reply: answer,
              escalatedToHuman,
            });
          }
        }
      }
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("WhatsApp webhook failed:", error.message);
      return res.status(500).json({ ok: false });
    }
  };
}

export default createHandler();
