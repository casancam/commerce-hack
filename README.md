# Today's pick

A merchant desk that chooses one product from a seeded catalog, stages a Meta and TikTok campaign, and sends the suggestion to Telegram. Reply with a price and it checks stock and margin.

The catalog lives in `lib/catalog.ts`. The rule is 40% minimum margin, £150 a day, and stock of at least 5. The demo winner is the wool overshirt. The cheap tee is rejected for stock. The silk scarf and sunglasses are rejected for margin.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The page works before any keys are set. Telegram sending starts once the bot env vars are filled in.

## Telegram

1. Message [@BotFather](https://t.me/BotFather), create a bot, and copy the token into `TELEGRAM_BOT_TOKEN`.
2. Message your bot once.
3. Run `npm run telegram:chat` and copy the printed id into `TELEGRAM_CHAT_ID`.
4. Click **Send to Telegram** on the page.
5. Reply `40` (not doable) and `70` (doable).

Phone replies need a public URL. After the app is on Vercel:

```bash
npm run telegram:webhook -- https://your-app.vercel.app
```

That registers `https://your-app.vercel.app/api/telegram`.

## Supabase

Optional. Run `supabase/schema.sql` in the SQL editor, then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Decisions and counters are stored there. The page still renders from the seeded catalog when those vars are empty.

## Demo replies

- `40` — under the 40% margin floor
- `70` — clears the floor, 40 units in stock
