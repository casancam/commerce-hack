import { wakeGrokBot } from "@/lib/grokbot";
import { postSlackCampaign } from "@/lib/slack";
import { saveDecision } from "@/lib/store";
import { sendTelegram } from "@/lib/telegram";
import type { Brief } from "@/lib/types";

export async function deliverProposal(brief: Brief, warning?: string | null) {
  const text = [brief.telegram, warning].filter(Boolean).join("\n\n");
  const [telegram, slack, grokbot] = await Promise.all([
    sendTelegram(text),
    postSlackCampaign(brief),
    wakeGrokBot(brief),
  ]);
  if (slack.channel && slack.ts) {
    brief.slack = { channel: slack.channel, ts: slack.ts };
    await saveDecision(brief);
  }
  return { telegram, slack, grokbot };
}
