import { answerMerchant } from "@/lib/argue";
import { deliverProposal } from "@/lib/deliver";
import { saveCounter } from "@/lib/store";
import { sendTelegram } from "@/lib/telegram";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    message?: string;
    productId?: string;
    intent?: string;
  } | null;
  const outcome = await answerMerchant(String(body?.message ?? ""), body?.productId, body?.intent);
  if (outcome.result) await saveCounter(outcome.result);
  if (outcome.brief) {
    const delivered = await deliverProposal(outcome.brief);
    return Response.json({ reply: outcome.reply, brief: outcome.brief, result: outcome.result, ...delivered });
  }
  const telegram = await sendTelegram(outcome.reply);
  return Response.json({ reply: outcome.reply, brief: outcome.brief, result: outcome.result, telegram });
}
