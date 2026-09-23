# Trusted BAZAAR Telegram SMM Bot — Customer + Admin

## Default Service IDs
979, 133, 174, 3758, 1753, 622, 893, 2194, 1850, 1722, 9445

Only these IDs are shown to customers initially.

## Admin
Set `ADMIN_ID` to the numeric Telegram user ID of the owner.

Use `/admin` in Telegram.

Admin can:
- Add Service IDs
- Remove Service IDs
- Set a service price
- Increase a service price
- Decrease a service price
- View selected services
- Add/remove payment numbers
- View user count

## Customer
Customer sees only selected Service IDs.

Prices saved by admin are shown to customers instead of provider rate.

## Render
Build: `npm install`
Start: `npm start`
Plan: Free Web Service

Environment:
BOT_TOKEN
SMM_API_URL=https://my.smmsun.com/api/v2
SMM_API_KEY
ADMIN_ID

## Important
This version stores settings in `data/settings.json`. Render Free Web Services do not provide persistent disk storage, so settings can be lost after a service replacement/redeploy/restart. For a real production bot, use a database (PostgreSQL/Redis/etc.).

Payment numbers in this version are only displayed/stored. Automatic payment verification and customer wallet/order processing are not implemented yet.
