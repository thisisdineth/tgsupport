import { GoogleGenAI } from "@google/genai";

const token = process.env.TELEGRAM_BOT_TOKEN;
const geminiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;
const tg = (method) => `https://api.telegram.org/bot${token}/${method}`;

async function telegram(method, body) {
  const r = await fetch(tg(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Telegram ${method}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function send(chatId, text, extra = {}) {
  const chunks = String(text).match(/[\s\S]{1,4000}/g) || ["Sorry, I couldn't create a reply."];
  for (const chunk of chunks) {
    await telegram("sendMessage", { chat_id: chatId, text: chunk, ...extra });
  }
}

const SYSTEM = `You are the official ApilageAI customer support assistant.
ApilageAI is an educational AI platform for Sri Lankan students.
Help with product usage, accounts, login, payments/credits, features, bugs and general support.
Reply in the user's language when practical, including Sinhala or English.
Be concise, friendly and professional.
Never request passwords, OTPs, API keys, card PINs or other secrets.
Never claim to have checked an account, payment, database or internal system unless that information is actually provided to you.
Do not invent ApilageAI policies, prices, features or account facts. If uncertain, clearly say so and suggest contacting the human support team.
For emergencies or sensitive account/security matters, recommend human support.`;

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "ApilageAI Telegram Support Bot" });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  if (webhookSecret && req.headers["x-telegram-bot-api-secret-token"] !== webhookSecret) {
    return res.status(401).json({ ok: false });
  }

  // Acknowledge unsupported updates without failing Telegram retries.
  const msg = req.body?.message;
  if (!msg?.chat?.id || !msg?.text) return res.status(200).json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const firstName = msg.from?.first_name || "there";

  try {
    if (text === "/start" || text.startsWith("/start@")) {
      await send(chatId, `👋 Hello ${firstName}!\n\nWelcome to ApilageAI Customer Support.\n\nSend your question here and our AI assistant will try to help.`, {
        reply_markup: {
          keyboard: [[{ text: "🧑‍💻 Technical issue" }, { text: "🔐 Account issue" }], [{ text: "💳 Payment / credits" }, { text: "💡 Feedback" }]],
          resize_keyboard: true,
        },
      });
      return res.status(200).json({ ok: true });
    }

    if (text === "/help" || text.startsWith("/help@")) {
      await send(chatId, "Send your problem as a normal message. I can help with login, account, technical, payment/credit and product questions. Never send passwords, OTPs or API keys.");
      return res.status(200).json({ ok: true });
    }

    if (!ai) throw new Error("GEMINI_API_KEY is missing");

    await telegram("sendChatAction", { chat_id: chatId, action: "typing" });
    const response = await ai.models.generateContent({
      model,
      contents: text,
      config: { systemInstruction: SYSTEM, maxOutputTokens: 800 },
    });
    await send(chatId, response.text || "Sorry, I couldn't generate a reply. Please try again.");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    try { await send(chatId, "Sorry — I couldn't process that right now. Please try again shortly."); } catch {}
    return res.status(200).json({ ok: false });
  }
}
