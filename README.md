# Trusted BAZAAR Telegram SMM Bot

## Required Render Environment Variables
- BOT_TOKEN
- SMM_API_KEY
- ADMIN_ID
- DATABASE_URL
- SMM_API_URL=https://my.smmsun.com/api/v2

Start command: `node bot.js`

## IMPORTANT: Persistent data
Customer balances, deposits, orders, services, prices, payment numbers, users, and referral data are stored in PostgreSQL (`DATABASE_URL`). The bot now refuses to start if `DATABASE_URL` is missing, so a redeploy cannot silently start with empty temporary data.

Keep the **same PostgreSQL DATABASE_URL** across every deploy. Do not create a new database or replace the URL when redeploying.

The bot loads the saved database before accepting Telegram updates and preserves existing user/referral fields when a user sends a message.

## Order behavior
Orders are submitted server-side to the configured SMM API using `SMM_API_KEY`. The customer is not redirected to the provider website.

Do not put BOT_TOKEN or SMM_API_KEY in source code. Keep them in Render Environment Variables.
