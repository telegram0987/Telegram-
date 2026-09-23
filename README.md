# Trusted BAZAAR Telegram SMM Bot — Customer Balance + SMM Orders

## Included
- Customer Services list from SMM provider API.
- Customer wallet/balance stored in PostgreSQL JSON data.
- Add Balance flow: payment number -> amount -> TxID -> pending request.
- Admin Payment Requests with Approve/Reject buttons.
- Admin can add, remove, set, increase and decrease service prices.
- Admin can add/remove payment numbers and replace the current payment number.
- Admin can add any numeric SMM Service ID.
- Customer New Order: Service -> Link -> Quantity -> balance check -> SMM API `action=add` -> deduct balance only after provider accepts the order.
- My Orders shows local order, cost, status and provider order ID.
- PostgreSQL persistence.
- Render-compatible long polling (no webhook setup required).

## Environment variables
Required:
- BOT_TOKEN
- SMM_API_KEY
- ADMIN_ID
- DATABASE_URL

Optional:
- SMM_API_URL=https://my.smmsun.com/api/v2
- PORT=10000
- RENDER_EXTERNAL_URL=<your Render public URL>

## Price behavior
Prices are stored as BDT per 1,000 units. If no custom price exists, the provider's `rate` is used. Increase/decrease uses the current custom price; if none exists it starts from the provider rate.

## Important payment note
The bot does not automatically verify a bank/mobile-wallet transaction. Customer payment requests are marked pending until an admin reviews the submitted amount and TxID and presses Approve or Reject.


## Deployment note
This version intentionally uses Telegram long polling. You do not need `RENDER_EXTERNAL_URL` for Telegram updates. Keep Start Command as `node bot.js`.
