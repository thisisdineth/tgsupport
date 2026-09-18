# ApilageAI Telegram Support Bot — Setup

## 1. What you need
- A Telegram account
- A bot created with **@BotFather**
- A Gemini API key from Google AI Studio
- GitHub account
- Vercel account

## 2. Create the Telegram bot
Open Telegram and message **@BotFather**.

1. Send `/newbot`.
2. Choose a display name.
3. Choose a username ending in `bot`.
4. BotFather gives you a bot token. Keep it secret.

Set commands through BotFather (`/setcommands`) and paste:

```text
start - Start ApilageAI Support
help - View support help
```

## 3. Get a Gemini API key
Create a Gemini API key in Google AI Studio. Never commit the key to GitHub.

## 4. Put this project on GitHub
Unzip this project, open Terminal in the folder, then run:

```bash
git init
git add .
git commit -m "Initial Telegram support bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Create the empty GitHub repository first. Do **not** commit `.env` or `.env.local`.

## 5. Deploy on Vercel
1. Sign in to Vercel.
2. Choose **Add New → Project**.
3. Import the GitHub repository.
4. Add these Environment Variables:

```text
TELEGRAM_BOT_TOKEN=YOUR_BOTFATHER_TOKEN
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
TELEGRAM_WEBHOOK_SECRET=YOUR_RANDOM_SECRET
```

For `TELEGRAM_WEBHOOK_SECRET`, use a long random string containing letters, numbers, `_` and `-`.

5. Deploy.

Your endpoint will be similar to:

```text
https://YOUR-PROJECT.vercel.app/api/telegram
```

Open that endpoint in a browser. You should see JSON saying the service is running.

## 6. Connect Telegram to Vercel
In Terminal, replace all placeholder values and run:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://YOUR-PROJECT.vercel.app/api/telegram","secret_token":"YOUR_RANDOM_SECRET","allowed_updates":["message"]}'
```

Telegram should return an `ok: true` response.

Check webhook status with:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

**Security warning:** commands containing the bot token may be saved in shell history. You can delete the command from history afterward, or set the webhook using a temporary environment variable instead.

## 7. Test
Open your bot in Telegram and press **Start**, or send:

```text
/start
```

Then send a normal question such as:

```text
I can't log in to my ApilageAI account
```

The request flow is:

```text
Telegram → Vercel webhook → Gemini → Vercel → Telegram
```

## 8. Updating the bot
Edit your code, then:

```bash
git add .
git commit -m "Update bot"
git push
```

Vercel will redeploy the connected GitHub repository automatically.

## 9. Troubleshooting
### Bot does not reply
Check Vercel's function logs and then run `getWebhookInfo` as shown above. Confirm the webhook URL ends with `/api/telegram`.

### 401 from the webhook
Make sure `TELEGRAM_WEBHOOK_SECRET` in Vercel exactly matches the `secret_token` used when setting the Telegram webhook.

### Gemini error
Confirm `GEMINI_API_KEY` exists in Vercel Environment Variables and redeploy after changing environment variables.

### Change Gemini model
Change `GEMINI_MODEL` in Vercel and redeploy. The default included here is `gemini-3.5-flash-lite`.

## Important limitations
The bot remembers the last five customer-message/AI-reply pairs per chat. See README.md for persistent Redis configuration on Vercel. Customer accounts and support tickets are not stored.

Do not place secrets directly in source code or commit `.env` files to GitHub.
