import { deliverProposal } from "@/lib/deliver";
import { handleMerchantReply } from "@/lib/reply";
import { sendTelegram, sendTelegramPhoto } from "@/lib/telegram";

export const maxDuration = 120;

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

  const chat = String(chatId);
  try {
    const outcome = await handleMerchantReply(text);
    if (/\bcampaigns?\b/i.test(text) && outcome.brief) {
      await deliverProposal(outcome.brief);
      return Response.json({ ok: true });
    }
    await sendTelegram(outcome.reply, chat);
    for (const [index, imageUrl] of outcome.imageUrls.entries()) {
      await sendTelegramPhoto(imageUrl, outcome.imageUrls.length > 1 ? `Still ${index + 1}` : "Updated still", chat);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not apply that.";
    await sendTelegram(message, chat);
  }
  return Response.json({ ok: true });
}
