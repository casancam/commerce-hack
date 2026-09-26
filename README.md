# Today's pick

A merchant desk that chooses one product from a seeded catalog, stages a Meta and TikTok campaign, and sends the suggestion to Telegram. Reply with a price and it checks stock and margin.

The catalog lives in `lib/catalog.ts`. The rule is 40% minimum margin, £150 a day, and stock of at least 5. The demo winner is the wool overshirt. The cheap tee is rejected for stock. The silk scarf and sunglasses are rejected for margin.

## Run

```bash
npm install
npm run infra:check
npm run dev
```

Open http://localhost:3000. The page works from the seeded catalog before the other services are connected.

## Infra

`npm run infra:check` pings Supabase, Tavily, Shopify, Meta, and TikTok. It only reads accounts. It does not create ads.

Supabase is already pointed at your project. Open the SQL editor and run `supabase/schema.sql` once. That creates products, policies, decisions, counters, campaigns, and research.

Tavily has no separate redeem step. Sign in at [app.tavily.com](https://app.tavily.com), copy the API key into `TAVILY_API_KEY`, and the credits already on that account are what the key spends. A basic search costs 1 credit. A hackathon coupon, if you were handed one, goes in Billing on that same page.

Shopify trial stores are merchant stores. This app needs a dev store in the same org as the app.

1. Open [dev.shopify.com/dashboard](https://dev.shopify.com/dashboard) → Stores → Create store → Dev. Skip Shopify's demo products.
2. Create an app in that dashboard. Scopes: `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`, `read_orders`.
3. Install the app on the dev store. Copy the client id and secret into `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`. Put the `*.myshopify.com` domain in `SHOPIFY_STORE_DOMAIN`.
4. Run `npm run shopify:seed`. It creates the ten catalog products with price, cost, and stock.

If the trial store already gave you an Admin API token, put that in `SHOPIFY_ADMIN_TOKEN` instead of the client id and secret.

Meta: Ads Manager → the ad account id from the URL, and a token with `ads_read` from [Graph API Explorer](https://developers.facebook.com/tools/explorer/) or a system user. Set `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`. `META_PAGE_ID` is for launching a paused ad later.

TikTok: [business-api.tiktok.com](https://business-api.tiktok.com) → your app's advertiser token and advertiser id. Set `TIKTOK_ACCESS_TOKEN` and `TIKTOK_ADVERTISER_ID`.

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
