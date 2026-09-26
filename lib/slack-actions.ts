import { handleMerchantReply } from "@/lib/reply";

export async function actOnSlack(text: string) {
  const outcome = await handleMerchantReply(text);
  return { reply: outcome.reply, imageUrl: outcome.imageUrls[0], brief: outcome.brief };
}
