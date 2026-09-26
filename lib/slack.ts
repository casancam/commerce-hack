import { createHmac, timingSafeEqual } from "node:crypto";
import { gbp } from "@/lib/format";
import type { Brief } from "@/lib/types";

export type SlackSend = { sent: boolean; reason?: string; channel?: string; ts?: string };

function token() {
  return process.env.SLACK_BOT_TOKEN;
}

export function verifySlack(request: Request, raw: string) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!timestamp || !Number.isFinite(age) || age > 60 * 5) return false;
  const digest = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
  const left = Buffer.from(digest);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function slackApi(method: string, body: Record<string, unknown>) {
  const auth = token();
  if (!auth) return { ok: false, error: "Slack is not connected." };
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return (await response.json()) as { ok?: boolean; error?: string; channel?: string; ts?: string };
}

export async function postSlackCampaign(brief: Brief): Promise<SlackSend> {
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token() || !channel) return { sent: false, reason: "Slack is not connected." };

  const images = (brief.chosen.variants ?? []).filter((variant) => variant.imageUrl.startsWith("https://")).slice(0, 2);
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `Haggly · ${brief.chosen.title}`.slice(0, 150) },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${brief.chosen.headline}*\n${brief.chosen.primaryText}\nCampaign price ${gbp(brief.chosen.campaignPriceCents)}`,
      },
    },
    ...images.map((variant) => ({
      type: "image",
      image_url: variant.imageUrl,
      alt_text: variant.label,
      title: { type: "plain_text", text: variant.label.slice(0, 150) },
    })),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Reply in this thread to change an image, name another product, or say *push* to go live.",
        },
      ],
    },
  ];

  const json = await slackApi("chat.postMessage", { channel, text: brief.telegram, blocks });
  if (!json.ok) return { sent: false, reason: `Slack: ${json.error ?? "could not post"}` };
  return { sent: true, channel: json.channel, ts: json.ts };
}

export async function replySlack(channel: string, text: string, threadTs?: string, imageUrl?: string) {
  const blocks = imageUrl?.startsWith("https://")
    ? [
        { type: "section", text: { type: "mrkdwn", text } },
        { type: "image", image_url: imageUrl, alt_text: "Updated ad" },
      ]
    : undefined;
  const json = await slackApi("chat.postMessage", {
    channel,
    text,
    thread_ts: threadTs,
    blocks,
  });
  return { sent: Boolean(json.ok), reason: json.ok ? undefined : json.error };
}
