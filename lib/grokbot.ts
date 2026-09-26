import type { Brief } from "@/lib/types";

type SendResult = { sent: boolean; reason?: string };

export async function wakeGrokBot(brief: Brief): Promise<SendResult> {
  const url = process.env.GROK_BOT_WEBHOOK_URL;
  const key = process.env.GROK_BOT_WEBHOOK_KEY;
  if (!url || !key) return { sent: false, reason: "Grok Bot webhook is not set." };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Automation-Key": key,
    },
    body: JSON.stringify({
      source: "haggly",
      action: "campaign_proposal",
      product: brief.chosen.title,
      campaignPriceCents: brief.chosen.campaignPriceCents,
      headline: brief.chosen.headline,
      primaryText: brief.chosen.primaryText,
      note: brief.telegram,
      images: (brief.chosen.variants ?? []).map((variant) => ({
        id: variant.id,
        label: variant.label,
        imageUrl: variant.imageUrl,
        why: variant.why,
      })),
      task: "Post this Haggly campaign to Slack. If the merchant replies with a change, apply it to the ad. If they say push or go live, push the staged Meta and TikTok ads.",
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return { sent: false, reason: `Grok Bot did not start (${response.status}).` };
  return { sent: true };
}
