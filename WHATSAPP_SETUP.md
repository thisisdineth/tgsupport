# Connect WhatsApp Business to the same Gemini support bot

## 1. Set up Meta WhatsApp Cloud API

Use Meta's [Cloud API getting-started guide](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started).
You need a Meta app with WhatsApp enabled, a WhatsApp Business Account, and a
Cloud API phone number. Start with Meta's test number and an allowed test recipient.
If your existing number is already in the WhatsApp Business mobile app, check the
onboarding options Meta offers for that number before attempting to register it.
This code connects to Cloud API; it does not connect by scanning a WhatsApp QR code.

## 2. Add environment variables in the existing Vercel project

Keep your current Telegram and Gemini variables. Add:

| Variable | Value |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Meta access token authorized to message using this business number |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone Number ID from Meta (not the actual telephone number or WABA ID) |
| `WHATSAPP_VERIFY_TOKEN` | A random secret you choose; enter the identical value when registering the webhook |
| `WHATSAPP_APP_SECRET` | App Secret from your Meta app settings, used to verify incoming request signatures |
| `WHATSAPP_API_VERSION` | Supported Graph API version shown in your Meta dashboard, in `vNN.0` format |

Use a suitable system-user token for production instead of the temporary test token.
Do not paste credentials into source files. Redeploy after changing variables.
`GEMINI_MODEL` keeps the existing project's default; if generation fails, select a
model available to your Gemini account using this variable.

## 3. Register the webhook

In your Meta app's WhatsApp webhook configuration, enter:

```text
Callback URL: https://YOUR-PROJECT.vercel.app/api/whatsapp
Verify token: the value of WHATSAPP_VERIFY_TOKEN
```

Subscribe to the `messages` webhook field. Ensure the app is subscribed to the
WhatsApp Business Account; Meta documents the `/{WABA-ID}/subscribed_apps` endpoint
in its [Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).
The public webhook must be reachable without Vercel deployment protection.
Opening its URL without the verification parameters returns 403 by design.

## 4. Test the connection

From an allowed test recipient, send a text question to the Meta test number.
The flow is WhatsApp → `/api/whatsapp` → shared Gemini support → WhatsApp reply.
Try Sinhala, English, or Singlish, then check that Telegram still answers too.
Once testing succeeds, complete Meta's production onboarding for your business number.

## Shared knowledge

Both channels load `lib/knowledge.js`. The existing support instructions were moved
there unchanged. Add accurate FAQs, pricing/credit rules, and a human support contact
there as needed; redeploy to apply changes. A Gemini API key does not automatically
load documents or instructions from a separate Google AI Studio conversation.

## Behavior and limitations

- Text questions are answered; attachments receive a request to send text.
- Delivery statuses and events for other Phone Number IDs are ignored.
- Requests require a valid Meta signature over the original request body.
- No chat history, durable queue, or persistent message deduplication is included.
  Meta retries or partial batch failures can result in duplicate replies.
- Processing completes before acknowledging the webhook. For higher volume, add a
  durable queue and message-ID deduplication so the webhook can acknowledge quickly.
  Ensure your Vercel function duration accommodates Gemini and outbound API calls.
- This handler replies to incoming questions; it does not initiate template campaigns.
- A Gemini failure sends a short fallback. An outbound API failure returns 500 so
  Meta can retry. Check Vercel logs for delivery status codes, and confirm the token,
  Phone Number ID, API version, recipient eligibility, and Gemini configuration.

## Local verification

```sh
npm test
```

Tests use mocked Gemini and Meta calls. They do not verify live credentials, Meta
onboarding, or your deployed Vercel configuration.
