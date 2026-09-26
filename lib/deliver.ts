import { wakeGrokBot } from "@/lib/grokbot";
import { proposalText } from "@/lib/proposal";
import { postSlackCampaign } from "@/lib/slack";
import { saveDecision } from "@/lib/store";
import type { Brief } from "@/lib/types";

export async function deliverProposal(brief: Brief, warning?: string | null) {
  const text = [proposalText(brief), warning].filter(Boolean).join("\n\n");
  const telegram = { sent: false, reason: "Telegram is off." };
  const grokbot = await wakeGrokBot(brief, text);
  const slack = grokbot.sent
    ? { sent: true as const, reason: "Sent to Slack through Grok Bot." }
    : await postSlackCampaign(brief, text);
  if (!grokbot.sent && slack.channel && slack.ts) {
    brief.slack = { channel: slack.channel, ts: slack.ts };
    await saveDecision(brief);
  }
  return { telegram, slack, grokbot };
}
