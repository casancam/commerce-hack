import { checkCounter, parsePounds, productForCounter } from "@/lib/counter";
import { saveCounter } from "@/lib/store";
import { sendTelegram } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
  };
};

export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;

  if (!text || chatId === undefined) {
    return Response.json({ ok: true });
  }

  const allowed = process.env.TELEGRAM_CHAT_ID;
  if (allowed && String(chatId) !== String(allowed)) {
    return Response.json({ ok: true });
  }

  const pounds = parsePounds(text);
  const result = pounds === null ? null : checkCounter(productForCounter(), pounds);
  const reply = result?.reply ?? "Reply with a price, like 70";

  if (result) await saveCounter(result);

  await sendTelegram(reply, String(chatId));
  return Response.json({ ok: true });
}
