import { answerMerchant } from "@/lib/argue";
import { saveCounter } from "@/lib/store";
import { sendTelegram } from "@/lib/telegram";

export const maxDuration = 60;

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

  const outcome = await answerMerchant(text);
  if (outcome.result) await saveCounter(outcome.result);
  await sendTelegram(outcome.reply, String(chatId));
  return Response.json({ ok: true });
}
