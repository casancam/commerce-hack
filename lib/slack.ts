import { createHmac, timingSafeEqual } from "node:crypto";
import { proposalText } from "@/lib/proposal";
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
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return (await response.json()) as { ok?: boolean; error?: string; channel?: string; ts?: string };
}

export async function postSlackCampaign(brief: Brief, text = proposalText(brief)): Promise<SlackSend> {
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token() || !channel) return { sent: false, reason: "Slack is not connected." };

  const images = (brief.chosen.variants ?? []).filter((variant) => variant.imageUrl.startsWith("https://")).slice(0, 4);
  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: text.slice(0, 2900) },
    },
    ...images.map((variant) => ({
      type: "image",
      image_url: variant.imageUrl,
      alt_text: variant.label,
      title: { type: "plain_text", text: variant.label.slice(0, 150) },
    })),
  ];

  const json = await slackApi("chat.postMessage", { channel, text: text.slice(0, 2900), blocks });
  if (!json.ok) return { sent: false, reason: `Slack: ${json.error ?? "could not post"}` };
  return { sent: true, channel: json.channel, ts: json.ts };
}

export async function downloadSlackFile(url: string) {
  const auth = token();
  if (!auth) throw new Error("Slack is not connected.");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Could not download that Slack file.");
  const type = (response.headers.get("content-type") || "application/octet-stream").split(";")[0];
  return { bytes: Buffer.from(await response.arrayBuffer()), type };
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
