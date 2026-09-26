import { loadEnv } from "./load-env.mjs";

loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN in .env.local");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const body = await response.json();
if (!response.ok) {
  console.error(body);
  process.exit(1);
}

const chats = new Map();
for (const update of body.result ?? []) {
  const chat = update.message?.chat;
  if (chat?.id) chats.set(chat.id, chat);
}

if (chats.size === 0) {
  console.log("No chats yet. Open Telegram, message your bot, then run this again.");
  process.exit(0);
}

for (const chat of chats.values()) {
  console.log(`${chat.id}\t${chat.username ?? chat.first_name ?? "chat"}`);
}
