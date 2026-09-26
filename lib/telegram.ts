type SendResult = { sent: boolean; reason?: string };

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegram(text: string, chatId = process.env.TELEGRAM_CHAT_ID): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    return { sent: false, reason: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID" };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { sent: false, reason: body.slice(0, 180) };
  }

  return { sent: true };
}
