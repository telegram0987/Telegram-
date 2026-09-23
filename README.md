# Telegram SMM Bot — Render Ready

Render:
- Service: Web Service
- Plan: Free
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/health` (optional)

Environment Variables:
- `BOT_TOKEN`
- `SMM_API_URL` = `https://my.smmsun.com/api/v2`
- `SMM_API_KEY`
- `ADMIN_ID`

Render automatically provides `RENDER_EXTERNAL_URL` for a Web Service, and the bot uses it to configure Telegram webhook.

Included now:
- `/start`
- Services from SMM provider API
- Provider balance
- New Order placeholder
- My Orders placeholder

Customer balance, payment, order database and admin price controls are not yet included.
Never upload real `.env`, bot token or API key to GitHub.
