import { GoogleGenAI } from "@google/genai";

const token = process.env.TELEGRAM_BOT_TOKEN;
const geminiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

const ai = geminiKey
  ? new GoogleGenAI({ apiKey: geminiKey })
  : null;

const tg = (method) =>
  `https://api.telegram.org/bot${token}/${method}`;


// --------------------------------------------------
// Telegram API helper
// --------------------------------------------------

async function telegram(method, body) {
  const r = await fetch(tg(method), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await r.text();

  if (!r.ok) {
    throw new Error(
      `Telegram ${method}: ${r.status} ${responseText}`
    );
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}


// --------------------------------------------------
// Send message
// Supports normal bot + Telegram Business
// --------------------------------------------------

async function send(
  chatId,
  text,
  businessConnectionId = null,
  extra = {}
) {
  const chunks =
    String(text).match(/[\s\S]{1,4000}/g) || [
      "Sorry, I couldn't create a reply.",
    ];

  for (const chunk of chunks) {
    const body = {
      chat_id: chatId,
      text: chunk,
      ...extra,
    };

    // Important for Telegram Business / Secretary Mode
    if (businessConnectionId) {
      body.business_connection_id = businessConnectionId;
    }

    await telegram("sendMessage", body);
  }
}


// --------------------------------------------------
// Typing indicator
// --------------------------------------------------

async function typing(chatId, businessConnectionId = null) {
  const body = {
    chat_id: chatId,
    action: "typing",
  };

  if (businessConnectionId) {
    body.business_connection_id = businessConnectionId;
  }

  try {
    await telegram("sendChatAction", body);
  } catch (error) {
    console.error("Typing indicator failed:", error);
  }
}


// --------------------------------------------------
// Gemini system prompt
// --------------------------------------------------

const SYSTEM = `
You are the official ApilageAI customer support assistant.

ApilageAI is an educational AI platform for Sri Lankan students.

Your job is to help customers with:

- Product usage
- Account issues
- Login problems
- Payments and credits
- ApilageAI features
- Technical problems
- Bug reports
- Feedback
- General customer support

LANGUAGE:

Reply in the same language the customer uses whenever practical.

If the customer writes in Sinhala, reply in Sinhala.

If the customer writes in English, reply in English.

If they use Singlish, you may naturally respond in Singlish or Sinhala
depending on what is easiest to understand.

SECURITY:

Never request:

- Passwords
- OTP codes
- API keys
- Card PINs
- Authentication tokens
- Other sensitive secrets

Never claim that you checked:

- Their ApilageAI account
- Their payment
- The database
- Internal systems

unless that information was actually provided to you.

Do not invent ApilageAI:

- Policies
- Prices
- Features
- Account information
- Payment information

If you are uncertain, clearly tell the customer that you do not have
enough information.

If necessary, recommend contacting the human ApilageAI support team.

For sensitive account, payment, security or privacy matters,
recommend human support.

Keep responses concise, friendly and professional.
`;


// --------------------------------------------------
// Main Vercel handler
// --------------------------------------------------

export default async function handler(req, res) {

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "ApilageAI Telegram Support Bot",
      business_support: true,
    });
  }


  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }


  // --------------------------------------------------
  // Verify Telegram webhook
  // --------------------------------------------------

  if (
    webhookSecret &&
    req.headers["x-telegram-bot-api-secret-token"] !==
      webhookSecret
  ) {
    console.error("Invalid Telegram webhook secret");

    return res.status(401).json({
      ok: false,
    });
  }


  const update = req.body;

  console.log(
    "Telegram update type:",
    Object.keys(update || {})
  );


  // --------------------------------------------------
  // Telegram Business connection event
  // --------------------------------------------------

  if (update?.business_connection) {

    console.log(
      "Business connection:",
      JSON.stringify(update.business_connection)
    );

    return res.status(200).json({
      ok: true,
    });
  }


  // --------------------------------------------------
  // NORMAL BOT MESSAGE
  // OR
  // TELEGRAM BUSINESS MESSAGE
  // --------------------------------------------------

  const isBusiness = Boolean(update?.business_message);

  const msg =
    update?.business_message ||
    update?.message;


  // Ignore unsupported updates
  if (!msg?.chat?.id) {
    return res.status(200).json({
      ok: true,
    });
  }


  // Currently only handle text messages
  if (!msg?.text) {
    return res.status(200).json({
      ok: true,
    });
  }


  const chatId = msg.chat.id;

  const text = msg.text.trim();

  const firstName =
    msg.from?.first_name || "there";


  // --------------------------------------------------
  // THIS IS IMPORTANT FOR BUSINESS MODE
  // --------------------------------------------------

  const businessConnectionId =
    msg.business_connection_id || null;


  console.log("Incoming message:", {
    chatId,
    isBusiness,
    businessConnectionId:
      businessConnectionId || "normal-bot-chat",
    text,
  });


  try {

    // --------------------------------------------------
    // /start
    // --------------------------------------------------

    if (
      text === "/start" ||
      text.startsWith("/start@")
    ) {

      await send(
        chatId,

        `👋 Hello ${firstName}!

Welcome to ApilageAI Customer Support.

Send your question here and our AI assistant will try to help.`,

        businessConnectionId,

        {
          reply_markup: {
            keyboard: [
              [
                { text: "🧑‍💻 Technical issue" },
                { text: "🔐 Account issue" },
              ],
              [
                { text: "💳 Payment / credits" },
                { text: "💡 Feedback" },
              ],
            ],
            resize_keyboard: true,
          },
        }
      );


      return res.status(200).json({
        ok: true,
      });
    }


    // --------------------------------------------------
    // /help
    // --------------------------------------------------

    if (
      text === "/help" ||
      text.startsWith("/help@")
    ) {

      await send(
        chatId,

        `Send your problem as a normal message.

I can help with:

• Login issues
• Account problems
• Technical issues
• Payments and credits
• ApilageAI features
• Feedback

🔐 Never send passwords, OTPs or API keys.`,

        businessConnectionId
      );


      return res.status(200).json({
        ok: true,
      });
    }


    // --------------------------------------------------
    // Check Gemini
    // --------------------------------------------------

    if (!ai) {
      throw new Error(
        "GEMINI_API_KEY is missing"
      );
    }


    // --------------------------------------------------
    // Show typing
    // --------------------------------------------------

    await typing(
      chatId,
      businessConnectionId
    );


    // --------------------------------------------------
    // Ask Gemini
    // --------------------------------------------------

    const response =
      await ai.models.generateContent({
        model,

        contents: text,

        config: {
          systemInstruction: SYSTEM,
          maxOutputTokens: 800,
        },
      });


    const reply =
      response.text ||
      "Sorry, I couldn't generate a reply. Please try again.";


    // --------------------------------------------------
    // Send AI response
    // --------------------------------------------------

    await send(
      chatId,
      reply,
      businessConnectionId
    );


    return res.status(200).json({
      ok: true,
    });

  } catch (err) {

    console.error(
      "Telegram handler error:",
      err
    );


    try {

      await send(
        chatId,
        "Sorry — I couldn't process that right now. Please try again shortly.",
        businessConnectionId
      );

    } catch (sendError) {

      console.error(
        "Could not send error message:",
        sendError
      );

    }


    // Return 200 so Telegram doesn't continuously retry
    return res.status(200).json({
      ok: false,
    });
  }
}