import type { Brief } from "@/lib/types";

type SendResult = { sent: boolean; reason?: string };

export async function wakeGrokBot(brief: Brief, message?: string): Promise<SendResult> {
  const url = process.env.GROK_BOT_WEBHOOK_URL;
  const key = process.env.GROK_BOT_WEBHOOK_KEY;
  if (!url || !key) return { sent: false, reason: "Grok Bot webhook is not set." };
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");

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
      message: message || brief.telegram,
      images: (brief.chosen.variants ?? []).map((variant) => ({
        id: variant.id,
        label: variant.label,
        imageUrl: variant.imageUrl,
        why: variant.why,
      })),
      replyUrl: appUrl ? `${appUrl}/api/grokbot` : null,
      task: [
        "Post message to Slack verbatim, then post each image.",
        "Do not change the price, product, or variant text.",
        "Ignore Telegram.",
        appUrl
          ? `A typed Slack reply is handled by Haggly. A voice note is transcribed first. If you receive a voice reply, POST {"text":"the instruction"} to ${appUrl}/api/grokbot with the same webhook key, then post the returned reply and imageUrls in the thread.`
          : "Reply in the Slack thread.",
      ].join(" "),
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return { sent: false, reason: `Grok Bot did not start (${response.status}).` };
  return { sent: true };
}

export async function sendVoiceToAgent(input: { transcript: string; instruction: string; result: string }) {
  const url = process.env.GROK_BOT_WEBHOOK_URL;
  const key = process.env.GROK_BOT_WEBHOOK_KEY;
  if (!url || !key) return { sent: false, reason: "Grok Bot webhook is not set." };
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Automation-Key": key,
    },
    body: JSON.stringify({
      source: "haggly",
      action: "slack_voice",
      transcript: input.transcript,
      instruction: input.instruction,
      result: input.result,
      replyUrl: appUrl ? `${appUrl}/api/grokbot` : null,
      task: "A Slack voice note was transcribed and already applied in Haggly. Post result to the Slack thread. Do not apply it again. Ignore Telegram.",
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return { sent: false, reason: `Grok Bot did not start (${response.status}).` };
  return { sent: true };
}
