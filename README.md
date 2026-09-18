# ApilageAI Customer Support

Telegram and WhatsApp Business customer support using Gemini in one Vercel project.

- Telegram webhook: `/api/telegram` (normal bot and Business messages)
- WhatsApp Cloud API webhook: `/api/whatsapp`
- Shared support knowledge/prompt: `lib/knowledge.js`
- Shared Gemini configuration: `lib/support.js`

Both channels use the same `GEMINI_API_KEY` and `GEMINI_MODEL`. Edit the shared
knowledge file to add verified FAQs, product details, and support contact details,
then redeploy. No external knowledge database is configured. Conversation memory keeps the last five customer messages and their AI replies per chat; see below.

See [SETUP.md](SETUP.md) for Telegram and [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md)
for connecting WhatsApp. Run `npm test` for the WhatsApp webhook tests.

## Conversation memory

Both channels remember five completed customer-message/AI-reply pairs. The next
question includes these pairs as context. Customers, platforms, business accounts,
and Telegram topics are isolated; Telegram group memory is also separate per sender.
Memory expires after 24 hours without a saved reply.

For reliable memory on Vercel, create/connect an Upstash Redis database and add its
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel's Production
environment variables, then redeploy. Use the REST credentials, not a Redis TCP URL.
These are also supported in `.env.local`. No additional npm dependency is required.

Without both variables, unconfigured storage uses temporary process memory (up to
1,000 chats). This may disappear on restart or differ across Vercel instances. If
only one variable is provided or Redis is unavailable, replies continue without
reliable memory and a diagnostic is logged. Stored content includes customer text
and generated replies. Failed/empty generations are not stored; replies are saved
before channel delivery. Simultaneous questions can see the same prior history;
this simple memory does not queue conversations or deduplicate webhook retries.

To check: send “My name is Nimal”, then “What is my name?” in the same chat. A
separate customer or platform should not know that name from this conversation.
