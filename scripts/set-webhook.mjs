import { loadEnv } from "./load-env.mjs";

loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.argv[2] ?? process.env.APP_URL;
if (!token || !appUrl) {
  console.error("Usage: npm run telegram:webhook -- https://your-app.vercel.app");
  process.exit(1);
}

const webhook = `${appUrl.replace(/\/$/, "")}/api/telegram`;
const response = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhook)}`,
);
const body = await response.json();
console.log(webhook);
console.log(body);
if (!response.ok || body.ok === false) process.exit(1);
