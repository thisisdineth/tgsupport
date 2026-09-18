# ApilageAI Customer Support

Telegram and WhatsApp Business customer support using Gemini in one Vercel project.

- Telegram webhook: `/api/telegram` (normal bot and Business messages)
- WhatsApp Cloud API webhook: `/api/whatsapp`
- Shared support knowledge/prompt: `lib/knowledge.js`
- Shared Gemini configuration: `lib/support.js`

Both channels use the same `GEMINI_API_KEY` and `GEMINI_MODEL`. Edit the shared
knowledge file to add verified FAQs, product details, and support contact details,
then redeploy. No external knowledge database or conversation history is configured.

See [SETUP.md](SETUP.md) for Telegram and [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md)
for connecting WhatsApp. Run `npm test` for the WhatsApp webhook tests.
