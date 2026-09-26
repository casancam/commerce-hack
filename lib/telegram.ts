type SendResult = { sent: boolean; reason?: string };

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

async function telegram(method: string, body: Record<string, unknown>, chatId = process.env.TELEGRAM_CHAT_ID): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    return { sent: false, reason: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID" };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, ...body }),
  });

  if (!response.ok) {
    const raw = await response.text();
    return { sent: false, reason: raw.slice(0, 180) };
  }

  return { sent: true };
}

export async function sendTelegram(text: string, chatId = process.env.TELEGRAM_CHAT_ID): Promise<SendResult> {
  return telegram("sendMessage", { text: text.slice(0, 4000) }, chatId);
}

export async function sendTelegramPhoto(photo: string, caption: string, chatId = process.env.TELEGRAM_CHAT_ID) {
  if (!photo.startsWith("https://")) return { sent: false, reason: "Telegram needs a public image URL." };
  return telegram("sendPhoto", { photo, caption: caption.slice(0, 900) }, chatId);
}
